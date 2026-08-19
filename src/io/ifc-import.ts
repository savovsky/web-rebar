/**
 * M2 T3 — IFC import mapping: IFC4 entity graph → internal models (§C adapter;
 * pure — no React, no store; the web-ifc API instance is injected, the §N
 * importIfcModel command owns lazy loading, dispatch, and validation).
 * ⚠️ This module imports web-ifc's 3.5 MB API STATICALLY (same builder/reader
 * split as ifc-mapping.ts) — app code may only reach it through a dynamic
 * import (the importIfcModel command does); a static import anywhere in the
 * shell graph would break the Q1 lazy-loading contract. Tests may import it
 * statically.
 *
 * Scope (plan §3 + Q2): IfcWallStandardCase + IfcReinforcingBar carrying our
 * Q2 design-intent psets. Entities WITHOUT them (foreign files) are skipped
 * with a reported count — foreign-file re-derivation is M4 scope. Non-wall/bar
 * IfcElement products are likewise skipped and counted.
 *
 * Coordinates read VERBATIM — model space is Z-up mm, identical to IFC since
 * the T2.5 migration; there is no transform and no inverse (T1 proved SPF
 * doubles round-trip exactly). Placements compose up the PlacementRelTo chain
 * (identity in our own exports — the composition exists so a nested chain
 * cannot silently shift coordinates).
 *
 * Identity: internal ids decode from IfcRoot.GlobalId (reversible compressed
 * UUID, ifc-guid.ts); Tag and the pset WebRebarId property carry the same id
 * as belt-and-braces (fallback when GlobalId is not a decodable UUID). The
 * SAME UUIDs come back, so imported bars' hostElementId resolves by
 * construction (T2 finding #4). Boilerplate (project/site/building/storey)
 * and rel GUIDs are synthetic per-export — they carry no identity and are not
 * mapped back.
 */
import type { IfcAPI } from 'web-ifc';
import { IFCELEMENT, IFCREINFORCINGBAR, IFCRELDEFINESBYPROPERTIES, IFCWALLSTANDARDCASE } from 'web-ifc';
import type { ReinforcementBar, Vec3, WallElement } from '@/data/models';
import { decompressIfcGuidToUuid } from './ifc-guid';

export const WALL_INTENT_PSET = 'Pset_WebRebar_Wall';
export const BAR_INTENT_PSET = 'Pset_WebRebar_ReinforcingBar';

/** Narrowed views of the flattened lines web-ifc returns (GetLine is `any`;
 *  verified against web-ifc 0.0.77 — numeric value boxes expose `.value`). */
interface ValueBox<T> {
  value: T;
}
interface FlatPoint {
  Coordinates: ValueBox<number>[];
}
interface FlatDirection {
  DirectionRatios: ValueBox<number>[];
}
interface FlatAxis2Placement {
  Location: FlatPoint;
  Axis: FlatDirection | null;
  RefDirection: FlatDirection | null;
}
/** Flattened IfcLocalPlacement — PlacementRelTo inlines recursively. */
export interface FlatLocalPlacement {
  PlacementRelTo: FlatLocalPlacement | null;
  RelativePlacement: FlatAxis2Placement;
}
interface FlatExtrusion {
  SweptArea: { XDim: ValueBox<number>; YDim: ValueBox<number> };
  Depth: ValueBox<number>;
}
interface FlatSweptDisk {
  Directrix: { Points: FlatPoint[] };
}
interface FlatRepresentation {
  RepresentationIdentifier: ValueBox<string>;
  Items: unknown[];
}
interface FlatProductLine {
  GlobalId: ValueBox<string>;
  ObjectPlacement: FlatLocalPlacement | null;
  Representation: { Representations: FlatRepresentation[] } | null;
}
interface FlatBarLine extends FlatProductLine {
  NominalDiameter: ValueBox<number> | null;
  SteelGrade: ValueBox<string> | null;
}
interface FlatRelDefines {
  RelatedObjects: { expressID: number }[];
  RelatingPropertyDefinition: {
    Name: ValueBox<string>;
    HasProperties: { Name: ValueBox<string>; NominalValue: ValueBox<string | number> | null }[];
  } | null;
}

/** The Q2 intent carrier found for one entity (undefined when absent). */
interface IntentPset {
  name: string;
  props: Record<string, string | number>;
}

export interface IfcImportSkipCounts {
  /** Walls/bars WITHOUT the Q2 intent pset (foreign files — M4 scope, Q2). */
  missingIntentPset: number;
  /** IfcElement products that are neither wall nor bar (M4 scope). */
  unsupportedElements: number;
}

export interface IfcImportResult {
  walls: WallElement[];
  bars: ReinforcementBar[];
  skipped: IfcImportSkipCounts;
}

interface ReadRequest {
  api: IfcAPI;
  modelID: number;
}

/** SPF files open with this ASCII magic. web-ifc's WASM ABORTS (unrecoverable
 *  RuntimeError) on malformed input instead of throwing a parse error — so
 *  obvious non-SPF bytes are rejected here, before OpenModel ever sees them. */
const SPF_MAGIC = 'ISO-10303-21;';

function assertSpfEnvelope(bytes: Uint8Array): void {
  const head = new TextDecoder('ascii').decode(bytes.subarray(0, SPF_MAGIC.length));
  if (head !== SPF_MAGIC) {
    throw new Error('ifc-import: not an IFC-SPF file (missing ISO-10303-21 header)');
  }
}

function lineIds(req: ReadRequest & { type: number; includeInherited?: boolean }): number[] {
  const ids = req.api.GetLineIDsWithType(req.modelID, req.type, req.includeInherited ?? false);
  return Array.from({ length: ids.size() }, (_, index) => ids.get(index));
}

function getFlattened<T>(req: ReadRequest & { expressID: number }): T {
  return req.api.GetLine(req.modelID, req.expressID, true) as T;
}

const coordsOf = (point: FlatPoint): Vec3 => {
  const [x, y, z] = point.Coordinates.map((c) => c.value);
  return { x, y, z: z ?? 0 };
};

const directionOf = (dir: FlatDirection | null): Vec3 | null =>
  dir ? coordsOf({ Coordinates: dir.DirectionRatios }) : null;

/** Rigid transform: world axes of the local frame + world origin. */
export interface PlacementTransform {
  origin: Vec3;
  xAxis: Vec3;
  yAxis: Vec3;
  zAxis: Vec3;
}

const IDENTITY_TRANSFORM: PlacementTransform = {
  origin: { x: 0, y: 0, z: 0 },
  xAxis: { x: 1, y: 0, z: 0 },
  yAxis: { x: 0, y: 1, z: 0 },
  zAxis: { x: 0, y: 0, z: 1 },
};

const add = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });
const scale = (v: Vec3, s: number): Vec3 => ({ x: v.x * s, y: v.y * s, z: v.z * s });
const cross = (a: Vec3, b: Vec3): Vec3 => ({
  x: a.y * b.z - a.z * b.y,
  y: a.z * b.x - a.x * b.z,
  z: a.x * b.y - a.y * b.x,
});

function normalize(v: Vec3): Vec3 {
  const length = Math.hypot(v.x, v.y, v.z);
  if (length === 0) throw new Error('ifc-import: zero-length direction vector');
  return scale(v, 1 / length);
}

/** Local frame axes from Axis (local Z) + RefDirection (local X) with the IFC
 *  defaults (Z = +Z, X = a perpendicular) when omitted. */
function frameAxes(axis: Vec3 | null, refDirection: Vec3 | null): Omit<PlacementTransform, 'origin'> {
  const zAxis = axis ? normalize(axis) : IDENTITY_TRANSFORM.zAxis;
  const xGuess = refDirection ? normalize(refDirection) : perpendicularTo(zAxis);
  const yAxis = normalize(cross(zAxis, xGuess));
  return { xAxis: cross(yAxis, zAxis), yAxis, zAxis };
}

/** IFC default for a missing RefDirection: +X when Z is ±Z (the normal
 *  case), +Z otherwise — any vector in the plane perpendicular to z works,
 *  frameAxes orthonormalizes. */
function perpendicularTo(z: Vec3): Vec3 {
  const isNearlyVertical = Math.abs(z.z) > 1 / Math.SQRT2;
  return isNearlyVertical ? IDENTITY_TRANSFORM.xAxis : IDENTITY_TRANSFORM.zAxis;
}

const applyDirection = (t: PlacementTransform, d: Vec3): Vec3 =>
  add(add(scale(t.xAxis, d.x), scale(t.yAxis, d.y)), scale(t.zAxis, d.z));

/** Local point → world (origin + axis combination). */
export const applyTransformPoint = (t: PlacementTransform, p: Vec3): Vec3 =>
  add(t.origin, applyDirection(t, p));

/** parent ∘ local — walk the PlacementRelTo chain from the root down. */
export function resolvePlacementTransform(placement: FlatLocalPlacement | null): PlacementTransform {
  if (!placement) return IDENTITY_TRANSFORM;
  const rel = placement.RelativePlacement;
  const local: PlacementTransform = {
    origin: coordsOf(rel.Location),
    ...frameAxes(directionOf(rel.Axis), directionOf(rel.RefDirection)),
  };
  if (!placement.PlacementRelTo) return local;
  const parent = resolvePlacementTransform(placement.PlacementRelTo);
  return {
    origin: applyTransformPoint(parent, local.origin),
    xAxis: applyDirection(parent, local.xAxis),
    yAxis: applyDirection(parent, local.yAxis),
    zAxis: applyDirection(parent, local.zAxis),
  };
}

/** entity expressID → its Q2 intent pset (both pset kinds; the entity mappers
 *  check the expected name). */
function collectIntentPsets(req: ReadRequest): Map<number, IntentPset> {
  const intentByExpressId = new Map<number, IntentPset>();
  for (const expressID of lineIds({ ...req, type: IFCRELDEFINESBYPROPERTIES })) {
    const rel = getFlattened<FlatRelDefines>({ ...req, expressID });
    const pset = rel.RelatingPropertyDefinition;
    if (!pset || (pset.Name.value !== WALL_INTENT_PSET && pset.Name.value !== BAR_INTENT_PSET)) continue;
    const props: Record<string, string | number> = {};
    for (const prop of pset.HasProperties) {
      if (prop.NominalValue) props[prop.Name.value] = prop.NominalValue.value;
    }
    for (const target of rel.RelatedObjects) {
      intentByExpressId.set(target.expressID, { name: pset.Name.value, props });
    }
  }
  return intentByExpressId;
}

/** GlobalId is authoritative (T2 finding #4); the pset WebRebarId is the
 *  documented fallback for a non-decodable GlobalId. */
function entityUuid(globalId: string, intent: IntentPset): string {
  try {
    return decompressIfcGuidToUuid(globalId);
  } catch {
    const fallback = intent.props.WebRebarId;
    if (typeof fallback === 'string') return fallback;
    throw new Error('ifc-import: GlobalId is not a compressed UUID and the intent pset has no WebRebarId');
  }
}

interface BodyItemRequest {
  line: FlatProductLine;
  entityId: string;
  what: string;
}

function findBodyItem<T>(req: BodyItemRequest): T {
  const reps = req.line.Representation?.Representations ?? [];
  const item = reps.find((rep) => rep.RepresentationIdentifier.value === 'Body')?.Items[0];
  if (!item) throw new Error(`ifc-import: ${req.entityId} has no ${req.what} Body representation`);
  return item as T;
}

function wallFromLine(id: string, line: FlatProductLine): WallElement {
  const body = findBodyItem<FlatExtrusion>({ line, entityId: id, what: 'extruded' });
  if (!line.ObjectPlacement) throw new Error(`ifc-import: wall ${id} has no object placement`);
  const { origin, xAxis } = resolvePlacementTransform(line.ObjectPlacement);
  const length = body.SweptArea.XDim.value;
  return {
    id,
    kind: 'wall',
    // startPoint.z is an ignored field in WallElement — elevation lives in
    // baseElevation (the placement origin's z).
    startPoint: { x: origin.x, y: origin.y, z: 0 },
    endPoint: { x: origin.x + xAxis.x * length, y: origin.y + xAxis.y * length, z: 0 },
    thickness: body.SweptArea.YDim.value,
    height: body.Depth.value,
    baseElevation: origin.z,
  };
}

interface BarMapping {
  id: string;
  line: FlatBarLine;
  props: Record<string, string | number>;
}

function barFromLine(mapping: BarMapping): ReinforcementBar {
  const { id, line, props } = mapping;
  const sweptDisk = findBodyItem<FlatSweptDisk>({ line, entityId: id, what: 'swept-disk' });
  const { HostElementId, CoverDistance, SteelGrade } = props;
  if (typeof HostElementId !== 'string' || typeof CoverDistance !== 'number') {
    throw new Error(`ifc-import: bar ${id} intent pset lacks HostElementId/CoverDistance`);
  }
  const steelGrade = typeof SteelGrade === 'string' ? SteelGrade : (line.SteelGrade?.value ?? '');
  if (steelGrade === '') throw new Error(`ifc-import: bar ${id} has no steel grade (pset or attribute)`);
  if (!line.NominalDiameter) throw new Error(`ifc-import: bar ${id} has no NominalDiameter`);
  const transform = resolvePlacementTransform(line.ObjectPlacement);
  return {
    id,
    hostElementId: HostElementId,
    diameter: line.NominalDiameter.value,
    path: sweptDisk.Directrix.Points.map((point) => applyTransformPoint(transform, coordsOf(point))),
    coverDistance: CoverDistance,
    steelGrade,
  };
}

interface MappingRequest extends ReadRequest {
  intentByExpressId: Map<number, IntentPset>;
  skipped: IfcImportSkipCounts;
}

/** Walls with the wall intent pset → WallElement; the rest counted as skipped. */
function mapWalls(req: MappingRequest): WallElement[] {
  const walls: WallElement[] = [];
  for (const expressID of lineIds({ ...req, type: IFCWALLSTANDARDCASE })) {
    const intent = req.intentByExpressId.get(expressID);
    if (intent?.name !== WALL_INTENT_PSET) {
      req.skipped.missingIntentPset += 1;
      continue;
    }
    const line = getFlattened<FlatProductLine>({ ...req, expressID });
    walls.push(wallFromLine(entityUuid(line.GlobalId.value, intent), line));
  }
  return walls;
}

function mapBars(req: MappingRequest): ReinforcementBar[] {
  const bars: ReinforcementBar[] = [];
  for (const expressID of lineIds({ ...req, type: IFCREINFORCINGBAR })) {
    const intent = req.intentByExpressId.get(expressID);
    if (intent?.name !== BAR_INTENT_PSET) {
      req.skipped.missingIntentPset += 1;
      continue;
    }
    const line = getFlattened<FlatBarLine>({ ...req, expressID });
    bars.push(barFromLine({ id: entityUuid(line.GlobalId.value, intent), line, props: intent.props }));
  }
  return bars;
}

/**
 * Parses IFC-SPF bytes into internal wall/bar models + a skip report. Opens
 * and closes its own model handle on the injected API instance. Throws on
 * malformed intent-carrying entities (a file claiming our psets but lacking
 * the geometry fails loudly rather than silently dropping content).
 */
export function parseIfcModel(api: IfcAPI, bytes: Uint8Array): IfcImportResult {
  assertSpfEnvelope(bytes);
  const modelID = api.OpenModel(bytes);
  try {
    const req: ReadRequest = { api, modelID };
    const wallCount = lineIds({ ...req, type: IFCWALLSTANDARDCASE }).length;
    const barCount = lineIds({ ...req, type: IFCREINFORCINGBAR }).length;
    const elementCount = lineIds({ ...req, type: IFCELEMENT, includeInherited: true }).length;
    const skipped: IfcImportSkipCounts = {
      missingIntentPset: 0,
      unsupportedElements: elementCount - wallCount - barCount,
    };
    const mapping: MappingRequest = { ...req, intentByExpressId: collectIntentPsets(req), skipped };
    return { walls: mapWalls(mapping), bars: mapBars(mapping), skipped };
  } finally {
    api.CloseModel(modelID);
  }
}
