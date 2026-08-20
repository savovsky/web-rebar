/**
 * M2 T5 — the pure DXF mapping machinery (plan Q4): entity filter with skip
 * counts (nothing silently lost), BLOCK/INSERT explosion (bounded recursion +
 * cycle guard), OCS/extrusion handling, plan projection (source z dropped —
 * Q3 primitives are 2D). Primitive emission (curve verdicts, bulge → arc,
 * polyline coalescing) lives in dxf-primitives.ts; the 3D affine math in
 * dxf-affine.ts; the $INSUNITS units table + the parser seam in
 * dxf-adapter.ts (the plan's named module — the units factor reaches this
 * file folded into the root frame's affine).
 *
 * Consumes the library-neutral DxfDocumentLike shape below (structurally
 * satisfied by dxf-parser's IDxf), so a parser swap (the Q6 documented
 * fallback) never touches this file. Pure and parser-free — but it ships in
 * the same lazy chunk, so the dxf-adapter.ts dynamic-import contract covers
 * it too (never import it statically from app code).
 */
import type { ReferencePrimitive, Vec3 } from '@/data/models';
import {
  addVec3,
  applyAffineVector,
  axisScaleAffine,
  composeAffine,
  ocsAffine,
  rotationZAffine,
  scaleVec3,
  translationAffine,
} from './dxf-affine';
import type { Affine3 } from './dxf-affine';
import {
  type EmitContext,
  bumpUnsupported,
  emitArc,
  emitCircle,
  emitPolyline,
  isZeroLength,
  planPoint,
  point3,
  resolveSourceLayer,
  withSourceLayer,
} from './dxf-primitives';

// ---------------------------------------------------------------------------
// Library-neutral input shape (Q6 — our code depends on THIS, not on
// dxf-parser's interfaces; its IDxf is structurally assignable to this).
// ---------------------------------------------------------------------------

/** dxf-parser omits absent coordinates (a 2D point has no z key) — all optional. */
export interface DxfPointLike {
  x?: number;
  y?: number;
  z?: number;
}

export interface DxfVertexLike extends DxfPointLike {
  /** Segment bulge ( tan(includedAngle/4) ) carried by the segment STARTING at
   *  this vertex — AutoCAD semantics for both LWPOLYLINE and old POLYLINE. */
  bulge?: number;
}

export interface DxfEntityLike {
  type: string;
  /** DXF group 8; '0' inside a block means "inherit the INSERT's layer". */
  layer?: string;
  inPaperSpace?: boolean;
}

export interface DxfBlockLike {
  entities?: DxfEntityLike[];
  /** Base point — block content coordinates are relative to it. */
  position?: DxfPointLike;
  paperSpace?: boolean;
}

export interface DxfDocumentLike {
  /** Header variables keyed WITH the '$' prefix (dxf-parser convention). */
  header?: Record<string, unknown>;
  entities?: DxfEntityLike[];
  blocks?: Record<string, DxfBlockLike>;
}

// ---------------------------------------------------------------------------
// Public result types
// ---------------------------------------------------------------------------

export interface DxfImportOptions {
  /** Q4 units-override: wins over the file's $INSUNITS. Must be a known code
   *  (the INSUNITS table in dxf-adapter.ts) — an unknown override throws, it
   *  never silently guesses. */
  insunitsOverride?: number;
}

/** Everything deliberately NOT carried into the reference document, counted
 *  so the import summary can report it (Q4: nothing silently lost). */
export interface DxfImportSkips {
  /** Unsupported entity types, by DXF type name (TEXT/MTEXT, SPLINE, ELLIPSE,
   *  HATCH, SOLID, DIMENSION, 3DFACE, POINT, ATTDEF, 3DSOLID, BODY, …). */
  unsupportedEntities: Record<string, number>;
  /** Paper-space (layout sheet) entities — sheets are not model background. */
  paperSpaceEntities: number;
  /** INSERTs naming a block absent from the BLOCKS table. */
  unresolvedInserts: number;
  /** INSERTs dropped by the block-reference cycle guard (A inserts B inserts A). */
  cyclicInserts: number;
  /** INSERTs dropped by the recursion depth cap (belt-and-braces bound — the
   *  cycle guard already bounds depth by the block count). */
  depthCappedInserts: number;
  /** Array INSERTs (row/column grid) whose cell count exceeded the sanity cap. */
  cappedArrayInserts: number;
  /** Arcs/circles a non-uniform (or zero) insert scale would turn into
   *  ellipses — not representable as Q3 primitives. Lines survive any scale. */
  nonUniformScaledCurves: number;
  /** Arcs/circles whose plane is tilted against the plan (genuine 3D content —
   *  their plan projection is an ellipse). */
  tiltedCurves: number;
  /** Zero-length segments / corrupt entities lacking coordinates. */
  degenerateSegments: number;
}

export interface DxfImportResult {
  primitives: ReferencePrimitive[];
  /** $INSUNITS exactly as declared (undefined when the header lacks it). */
  headerInsunits: number | undefined;
  /** The units code actually applied (override wins; unitless/missing/unknown → 4 = mm). */
  appliedInsunits: number;
  /** Multiplier applied to raw coordinates to get model mm. */
  scaleToMm: number;
  /** true when units were ASSUMED (unitless/missing/unknown header, no
   *  override) — the Q4 status-bar-warning case. */
  unitsAssumed: boolean;
  skipped: DxfImportSkips;
}

export const createEmptySkips = (): DxfImportSkips => ({
  unsupportedEntities: {},
  paperSpaceEntities: 0,
  unresolvedInserts: 0,
  cyclicInserts: 0,
  depthCappedInserts: 0,
  cappedArrayInserts: 0,
  nonUniformScaledCurves: 0,
  tiltedCurves: 0,
  degenerateSegments: 0,
});

// ---------------------------------------------------------------------------
// Entity narrowing (dxf-parser field shapes; all optional — corrupt partial
// entities must not crash the mapping, they count as degenerate).
// ---------------------------------------------------------------------------

interface ExtrusionCarrier {
  extrusionDirection?: DxfPointLike;
  extrusionDirectionX?: number;
  extrusionDirectionY?: number;
  extrusionDirectionZ?: number;
}

/** The entity fields the mapping reads, unified across entity kinds (each
 *  mapper touches only the fields its entity type can carry). */
interface NarrowedEntity extends ExtrusionCarrier {
  type: string;
  layer?: string;
  inPaperSpace?: boolean;
  // LINE / LWPOLYLINE / POLYLINE (DxfVertexLike so bulge reads uniformly).
  vertices?: DxfVertexLike[];
  shape?: boolean; // closed flag on both polyline kinds
  elevation?: number; // LWPOLYLINE group 38
  is3dPolygonMesh?: boolean;
  isPolyfaceMesh?: boolean;
  includesCurveFitVertices?: boolean;
  includesSplineFitVertices?: boolean;
  // ARC / CIRCLE. Angles in DEGREES, CCW (DXF convention).
  center?: DxfPointLike;
  radius?: number;
  startAngle?: number;
  endAngle?: number;
  // INSERT.
  name?: string;
  position?: DxfPointLike;
  rotation?: number; // degrees, CCW
  xScale?: number;
  yScale?: number;
  zScale?: number;
  columnCount?: number;
  rowCount?: number;
  columnSpacing?: number;
  rowSpacing?: number;
}

// NOTE: dxf-parser parses no group 210 for CIRCLE — circles always read as
// plan-oriented. Recorded limitation (T5 task log): zero circle+210 entities
// exist in the author fixtures outside the genuine-3D export.

function extrusionOf(entity: ExtrusionCarrier): Vec3 | undefined {
  if (entity.extrusionDirection !== undefined) {
    const d = entity.extrusionDirection;
    return { x: d.x ?? 0, y: d.y ?? 0, z: d.z ?? 1 };
  }
  const { extrusionDirectionX, extrusionDirectionY, extrusionDirectionZ } = entity;
  if (
    extrusionDirectionX !== undefined ||
    extrusionDirectionY !== undefined ||
    extrusionDirectionZ !== undefined
  ) {
    return { x: extrusionDirectionX ?? 0, y: extrusionDirectionY ?? 0, z: extrusionDirectionZ ?? 1 };
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// Mapping frame + bounds
// ---------------------------------------------------------------------------

/** Explosion context carried down the BLOCK/INSERT recursion. */
export interface ExplodeFrame {
  /** content-local → model-mm world (units scale outermost); z dropped at emission. */
  affine: Affine3;
  /** Layer for block content on layer '0' (the DXF ByBlock convention). */
  inheritLayer: string | undefined;
  depth: number;
  /** Block names on the current recursion path — the cycle guard. */
  blockPath: ReadonlySet<string>;
}

const DEFAULT_LAYER_NAME = '0';
const MAX_BLOCK_INSERT_DEPTH = 32;
/** Array-INSERT sanity cap (no real fixture exceeds 1 cell; a hostile
 *  10000×10000 grid must not OOM the tab). */
const MAX_ARRAY_CELLS = 1024;
const DEGREES_TO_RADIANS = Math.PI / 180;

// ---------------------------------------------------------------------------
// Entity mappers
// ---------------------------------------------------------------------------

interface EntityRequest {
  context: EmitContext;
  frame: ExplodeFrame;
  entity: NarrowedEntity;
  blocks: Record<string, DxfBlockLike>;
}

function mapLineEntity({ context, frame, entity }: EntityRequest): void {
  const [from, to] = entity.vertices ?? [];
  if (from === undefined || to === undefined || isZeroLength(point3(from), point3(to))) {
    context.skipped.degenerateSegments += 1;
    return;
  }
  const affine = composeAffine(frame.affine, ocsAffine(extrusionOf(entity)));
  context.out.push({
    kind: 'line',
    start: planPoint(affine, point3(from)),
    end: planPoint(affine, point3(to)),
    ...withSourceLayer(resolveSourceLayer(entity.layer, frame.inheritLayer)),
  });
}

function mapArcEntity({ context, frame, entity }: EntityRequest): void {
  if (entity.center === undefined || entity.radius === undefined || entity.radius <= 0) {
    context.skipped.degenerateSegments += 1;
    return;
  }
  emitArc({
    context,
    affine: composeAffine(frame.affine, ocsAffine(extrusionOf(entity))),
    curve: {
      center: point3(entity.center),
      radius: entity.radius,
      startAngle: (entity.startAngle ?? 0) * DEGREES_TO_RADIANS,
      endAngle: (entity.endAngle ?? 0) * DEGREES_TO_RADIANS,
      layer: resolveSourceLayer(entity.layer, frame.inheritLayer),
    },
  });
}

function mapCircleEntity({ context, frame, entity }: EntityRequest): void {
  if (entity.center === undefined || entity.radius === undefined || entity.radius <= 0) {
    context.skipped.degenerateSegments += 1;
    return;
  }
  // No OCS composition: dxf-parser parses no extrusion for CIRCLE (recorded
  // limitation, see the note above NarrowedEntity).
  emitCircle({
    context,
    affine: frame.affine,
    curve: {
      center: point3(entity.center),
      radius: entity.radius,
      startAngle: 0,
      endAngle: 0,
      layer: resolveSourceLayer(entity.layer, frame.inheritLayer),
    },
  });
}

function mapLwpolylineEntity({ context, frame, entity }: EntityRequest): void {
  const elevation = entity.elevation ?? 0;
  emitPolyline({
    context,
    affine: composeAffine(frame.affine, ocsAffine(extrusionOf(entity))),
    vertices: (entity.vertices ?? []).map((vertex) => ({
      x: vertex.x ?? 0,
      y: vertex.y ?? 0,
      z: elevation,
      bulge: vertex.bulge ?? 0,
    })),
    closed: entity.shape ?? false,
    layer: resolveSourceLayer(entity.layer, frame.inheritLayer),
    typeName: 'LWPOLYLINE',
  });
}

function mapPolylineEntity({ context, frame, entity }: EntityRequest): void {
  if (entity.is3dPolygonMesh === true || entity.isPolyfaceMesh === true) {
    bumpUnsupported(context.skipped, 'POLYLINE (mesh)');
    return;
  }
  if (entity.includesCurveFitVertices === true || entity.includesSplineFitVertices === true) {
    // Fit-curve vertices are control points, not on-curve — reconstructing the
    // fit curve is SPLINE-class work Q4 puts out of scope.
    bumpUnsupported(context.skipped, 'POLYLINE (curve/spline-fit)');
    return;
  }
  emitPolyline({
    context,
    affine: composeAffine(frame.affine, ocsAffine(extrusionOf(entity))),
    vertices: (entity.vertices ?? []).map((vertex) => ({
      x: vertex.x ?? 0,
      y: vertex.y ?? 0,
      z: vertex.z ?? 0,
      bulge: vertex.bulge ?? 0,
    })),
    closed: entity.shape ?? false,
    layer: resolveSourceLayer(entity.layer, frame.inheritLayer),
    typeName: 'POLYLINE',
  });
}

// ---------------------------------------------------------------------------
// INSERT explosion (Q4): world = frame ∘ OCS(insert) ∘ translate(position +
// cellOffset) ∘ rotate ∘ scale ∘ translate(−basePoint). Nested INSERTs recurse
// with a path-set cycle guard and a depth cap.
// ---------------------------------------------------------------------------

/** Grid cells of an array INSERT (row/column counts default to 1); null when
 *  the grid exceeds the sanity cap. Spacing steps run inside the insert's
 *  rotation AND scale (the AutoCAD MINSERT convention). */
function insertGridCells(entity: NarrowedEntity): { x: number; y: number }[] | null {
  const columns = Math.max(1, Math.floor(entity.columnCount ?? 1));
  const rows = Math.max(1, Math.floor(entity.rowCount ?? 1));
  if (columns * rows > MAX_ARRAY_CELLS) return null;
  const cells: { x: number; y: number }[] = [];
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      cells.push({ x: column * (entity.columnSpacing ?? 0), y: row * (entity.rowSpacing ?? 0) });
    }
  }
  return cells;
}

type InsertGuardFailure = 'unresolvedInserts' | 'cyclicInserts' | 'depthCappedInserts';

type InsertGuard = { failure: InsertGuardFailure } | { failure: null; name: string; block: DxfBlockLike };

function checkInsertGuards(request: EntityRequest): InsertGuard {
  const { frame, entity, blocks } = request;
  const block = entity.name === undefined ? undefined : blocks[entity.name];
  if (entity.name === undefined || block === undefined) return { failure: 'unresolvedInserts' };
  if (frame.blockPath.has(entity.name)) return { failure: 'cyclicInserts' };
  if (frame.depth >= MAX_BLOCK_INSERT_DEPTH) return { failure: 'depthCappedInserts' };
  return { failure: null, name: entity.name, block };
}

function explodeInsert(request: EntityRequest): void {
  const { context, frame, entity, blocks } = request;
  const guard = checkInsertGuards(request);
  if (guard.failure !== null) {
    context.skipped[guard.failure] += 1;
    return;
  }
  const cells = insertGridCells(entity);
  if (cells === null) {
    context.skipped.cappedArrayInserts += 1;
    return;
  }
  const rotation = (entity.rotation ?? 0) * DEGREES_TO_RADIANS;
  const scale3 = { x: entity.xScale ?? 1, y: entity.yScale ?? 1, z: entity.zScale ?? 1 };
  const position = point3(entity.position ?? {});
  const base = point3(guard.block.position ?? {});
  const rotateScale = composeAffine(rotationZAffine(rotation), axisScaleAffine(scale3));
  const suffix = composeAffine(rotateScale, translationAffine(scaleVec3(base, -1)));
  const prefix = composeAffine(frame.affine, ocsAffine(extrusionOf(entity)));
  const inheritLayer =
    entity.layer !== undefined && entity.layer !== DEFAULT_LAYER_NAME ? entity.layer : frame.inheritLayer;
  const childPath = new Set(frame.blockPath).add(guard.name);
  for (const cell of cells) {
    // Cell offset transformed into the rotated+scaled insert frame.
    const step = applyAffineVector(rotateScale, { x: cell.x, y: cell.y, z: 0 });
    const affine = composeAffine(prefix, composeAffine(translationAffine(addVec3(position, step)), suffix));
    mapEntities({
      out: context.out,
      skipped: context.skipped,
      blocks,
      entities: guard.block.entities ?? [],
      frame: { affine, inheritLayer, depth: frame.depth + 1, blockPath: childPath },
    });
  }
}

function mapEntity(request: EntityRequest): void {
  const { context, entity } = request;
  if (entity.inPaperSpace === true) {
    context.skipped.paperSpaceEntities += 1;
    return;
  }
  switch (entity.type) {
    case 'LINE':
      mapLineEntity(request);
      return;
    case 'LWPOLYLINE':
      mapLwpolylineEntity(request);
      return;
    case 'POLYLINE':
      mapPolylineEntity(request);
      return;
    case 'ARC':
      mapArcEntity(request);
      return;
    case 'CIRCLE':
      mapCircleEntity(request);
      return;
    case 'INSERT':
      explodeInsert(request);
      return;
    default:
      // Q4 skip list (TEXT/MTEXT, SPLINE, ELLIPSE, HATCH, SOLID, DIMENSION,
      // 3DFACE, …) and every parser-level marker — counted, never silent.
      bumpUnsupported(context.skipped, entity.type);
  }
}

/** The recursion driver — maps an entity list under a frame; INSERTs recurse
 *  into their block content with an extended frame. Returns the collected
 *  primitives (`out` is shared across the recursion when provided). */
export interface EntitiesMappingRequest {
  entities: DxfEntityLike[];
  blocks: Record<string, DxfBlockLike>;
  frame: ExplodeFrame;
  skipped: DxfImportSkips;
  out?: ReferencePrimitive[];
}

export function mapEntities(request: EntitiesMappingRequest): ReferencePrimitive[] {
  const out = request.out ?? [];
  const context: EmitContext = { out, skipped: request.skipped };
  for (const entity of request.entities) {
    mapEntity({ context, frame: request.frame, entity, blocks: request.blocks });
  }
  return out;
}
