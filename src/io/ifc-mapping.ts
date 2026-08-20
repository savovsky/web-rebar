/**
 * M2 T2 — IFC export mapping: pure ProjectModel → IFC4 entity graph (§C
 * adapter; rule 2 — no React, no store; the web-ifc API instance is injected,
 * the §N exportIfc command owns lazy loading and the model handle).
 * ⚠️ This module imports web-ifc's 3.5 MB API STATICALLY (the class-based
 * builder pattern needs the IFC4 namespace constructors) — app code may only
 * reach it through a dynamic import (the exportIfc command does); a static
 * import anywhere in the shell graph would break the Q1 lazy-loading contract
 * (the build's INEFFECTIVE_DYNAMIC_IMPORT warning is the tripwire).
 * Generalizes the T1 spike builder (src/io/ifc-write-spike.ts — kept
 * untouched as the §D.4 decision-gate record) over a whole ProjectModel and
 * inherits its three Allplan exporter conventions, which foreign-tool import
 * requires beyond the schema minimum (see the T1 task log):
 *  1. every IfcWallStandardCase carries an IfcMaterialLayerSetUsage chain;
 *  2. every wall carries an 'Axis'/'Curve2D' shape representation (genuine 2D
 *     points) next to the 'Body'/'SweptSolid' one;
 *  3. FILE_DESCRIPTION names the IFC4 MVD via CreateModel description —
 *     web-ifc's default header names the IFC2X3 MVD even for IFC4 files.
 * Schema decision (recorded per the T1 log): **IFC4**. The Q1 gate and all
 * four Allplan-2022 import iterations validated IFC4 end-to-end, and
 * IfcWallStandardCase (IFC4+) is the entity those iterations proved. The
 * author's real-file fixture being IFC2X3 is import-side evidence (T3 reads
 * whatever web-ifc reads) — it does not constrain what we write.
 *
 * Coordinates: model space is Z-up right-handed mm (the engineering
 * convention — plan in X–Y, elevation in Z; data/models/geometry.ts),
 * IDENTICAL to IFC's coordinate convention — the mapping carries no
 * rotation, so there is no handedness/mirroring failure class at this seam
 * and T3's import reads coordinates verbatim (round-trip exactness by
 * construction; T1 proved SPF doubles round-trip exactly).
 *
 * Identity: wall/bar GlobalId = compressed encoding of the entity's UUID
 * (ifc-guid.ts, Q2 — reversible and deterministic); the same id also rides
 * in Tag and the Pset_WebRebar_* WebRebarId property. Boilerplate
 * (project/site/building/storey) and relationship entities get deterministic
 * per-export synthetic GUIDs — T3 re-creates them on import, so no identity
 * round-trips through them.
 */
import type { IfcAPI, IfcLineObject } from 'web-ifc';
import { IFC4, Schemas } from 'web-ifc';
import type { ProjectMetadata, ProjectModel, ReinforcementBar, Vec3, WallElement } from '@/data/models';
import { compressUuidToIfcGuid } from './ifc-guid';

export interface IfcModelResult {
  modelID: number;
  /** The saved IFC-SPF file content. */
  bytes: Uint8Array;
}

const MILLIS_PER_SECOND = 1000;
const CONTEXT_PRECISION = 1e-7;
/** Deterministic CreationDate for projects without metadata timestamps (the
 *  M0/M1 initial state ships '' — project commands arrive later, §H). */
const FALLBACK_CREATION_TIMESTAMP = 0;

/** web-ifc declares enum members as `any` — narrowed once, here. */
const IFC_ENUM = {
  added: IFC4.IfcChangeActionEnum.ADDED as IFC4.IfcChangeActionEnum,
  element: IFC4.IfcElementCompositionEnum.ELEMENT as IFC4.IfcElementCompositionEnum,
  areaProfile: IFC4.IfcProfileTypeEnum.AREA as IFC4.IfcProfileTypeEnum,
  lengthUnit: IFC4.IfcUnitEnum.LENGTHUNIT as IFC4.IfcUnitEnum,
  planeAngleUnit: IFC4.IfcUnitEnum.PLANEANGLEUNIT as IFC4.IfcUnitEnum,
  milli: IFC4.IfcSIPrefix.MILLI as IFC4.IfcSIPrefix,
  metre: IFC4.IfcSIUnitName.METRE as IFC4.IfcSIUnitName,
  radian: IFC4.IfcSIUnitName.RADIAN as IFC4.IfcSIUnitName,
  barRoleUndefined: IFC4.IfcReinforcingBarRoleEnum.NOTDEFINED as IFC4.IfcReinforcingBarRoleEnum,
  layerSetAxis2: IFC4.IfcLayerSetDirectionEnum.AXIS2 as IFC4.IfcLayerSetDirectionEnum,
  directionPositive: IFC4.IfcDirectionSenseEnum.POSITIVE as IFC4.IfcDirectionSenseEnum,
};

/** Boilerplate + relationship entities carry no round-tripped identity (T3
 *  re-creates the spatial structure on import) — they get deterministic
 *  per-export GUIDs compressed from a counter UUID, so the export bytes stay
 *  stable for a stable model. */
function createSyntheticGuidSource(): () => IFC4.IfcGloballyUniqueId {
  let counter = 0;
  return () => {
    counter += 1;
    const uuid = `00000000-0000-0000-0000-${String(counter).padStart(12, '0')}`;
    return new IFC4.IfcGloballyUniqueId(compressUuidToIfcGuid(uuid));
  };
}

function cartesian(point: Vec3): IFC4.IfcCartesianPoint {
  return new IFC4.IfcCartesianPoint([
    new IFC4.IfcLengthMeasure(point.x),
    new IFC4.IfcLengthMeasure(point.y),
    new IFC4.IfcLengthMeasure(point.z),
  ]);
}

/** Curve2D items are genuine 2D points — 3D points trip strict importers. */
function cartesian2d(x: number, y: number): IFC4.IfcCartesianPoint {
  return new IFC4.IfcCartesianPoint([new IFC4.IfcLengthMeasure(x), new IFC4.IfcLengthMeasure(y)]);
}

function direction(vector: Vec3): IFC4.IfcDirection {
  return new IFC4.IfcDirection([
    new IFC4.IfcReal(vector.x),
    new IFC4.IfcReal(vector.y),
    new IFC4.IfcReal(vector.z),
  ]);
}

/** Epoch seconds for IfcTimeStamp; empty/unparseable metadata timestamps fall
 *  back to null/epoch rather than wall-clock time — deterministic output. */
function toIfcTimeStamp(iso: string): IFC4.IfcTimeStamp | null {
  const millis = Date.parse(iso);
  if (Number.isNaN(millis)) return null;
  return new IFC4.IfcTimeStamp(Math.round(millis / MILLIS_PER_SECOND));
}

function buildOwnerHistory(metadata: ProjectMetadata): IFC4.IfcOwnerHistory {
  const person = new IFC4.IfcPerson(null, null, null, null, null, null, null, null);
  const org = new IFC4.IfcOrganization(null, new IFC4.IfcLabel('web-rebar'), null, null, null);
  const personOrg = new IFC4.IfcPersonAndOrganization(person, org, null);
  const app = new IFC4.IfcApplication(
    org,
    new IFC4.IfcLabel(metadata.appVersion),
    new IFC4.IfcLabel('web-rebar'),
    new IFC4.IfcIdentifier('web-rebar'),
  );
  return new IFC4.IfcOwnerHistory(
    personOrg,
    app,
    null,
    IFC_ENUM.added,
    toIfcTimeStamp(metadata.lastModified),
    null,
    null,
    toIfcTimeStamp(metadata.createdAt) ?? new IFC4.IfcTimeStamp(FALLBACK_CREATION_TIMESTAMP),
  );
}

/** mm length + radian plane angle — IFC4 SI units for our mm model space. */
function buildUnits(): IFC4.IfcUnitAssignment {
  const mm = new IFC4.IfcSIUnit(IFC_ENUM.lengthUnit, IFC_ENUM.milli, IFC_ENUM.metre);
  const radian = new IFC4.IfcSIUnit(IFC_ENUM.planeAngleUnit, null, IFC_ENUM.radian);
  return new IFC4.IfcUnitAssignment([mm, radian]);
}

function buildModelContext(): IFC4.IfcGeometricRepresentationContext {
  const worldOrigin = new IFC4.IfcAxis2Placement3D(cartesian({ x: 0, y: 0, z: 0 }), null, null);
  return new IFC4.IfcGeometricRepresentationContext(
    new IFC4.IfcLabel('Model'),
    new IFC4.IfcLabel('Model'),
    new IFC4.IfcDimensionCount(3),
    new IFC4.IfcReal(CONTEXT_PRECISION),
    worldOrigin,
    null,
  );
}

/** Everything every entity builder needs — bundles the max-params-2 rule into
 *  one options object (§N plain-params-object convention). */
interface EntityFactory {
  /** Entity ids → compressed UUIDs (Q2 — reversible, round-tripped). */
  entityGuid: (uuid: string) => IFC4.IfcGloballyUniqueId;
  /** Boilerplate/rels: deterministic per-export synthetic GUIDs. */
  nextSyntheticGuid: () => IFC4.IfcGloballyUniqueId;
  history: IFC4.IfcOwnerHistory;
  context: IFC4.IfcGeometricRepresentationContext;
}

/** Factory + the spatial placement new products hang under. */
interface RootedFactory extends EntityFactory {
  parentPlacement: IFC4.IfcLocalPlacement;
}

function identityPlacement(parent: IFC4.IfcLocalPlacement | null): IFC4.IfcLocalPlacement {
  return new IFC4.IfcLocalPlacement(
    parent,
    new IFC4.IfcAxis2Placement3D(cartesian({ x: 0, y: 0, z: 0 }), null, null),
  );
}

interface SpatialStructure {
  storeyPlacement: IFC4.IfcLocalPlacement;
  aggregationRels: IFC4.IfcRelAggregates[];
  storey: IFC4.IfcBuildingStorey;
}

/** Project → Site → Building → Storey boilerplate (storey assignment is M4 scope). */
function buildSpatialStructure(factory: EntityFactory, projectName: string): SpatialStructure {
  const { nextSyntheticGuid, history, context } = factory;
  const project = new IFC4.IfcProject(
    nextSyntheticGuid(),
    history,
    new IFC4.IfcLabel(projectName),
    null,
    null,
    null,
    null,
    [context],
    buildUnits(),
  );
  const sitePlacement = identityPlacement(null);
  const site = new IFC4.IfcSite(
    nextSyntheticGuid(),
    history,
    new IFC4.IfcLabel('Site'),
    null,
    null,
    sitePlacement,
    null,
    null,
    IFC_ENUM.element,
    null,
    null,
    null,
    null,
    null,
  );
  const buildingPlacement = identityPlacement(sitePlacement);
  const building = new IFC4.IfcBuilding(
    nextSyntheticGuid(),
    history,
    new IFC4.IfcLabel('Building'),
    null,
    null,
    buildingPlacement,
    null,
    null,
    IFC_ENUM.element,
    null,
    null,
    null,
  );
  const storeyPlacement = identityPlacement(buildingPlacement);
  const storey = new IFC4.IfcBuildingStorey(
    nextSyntheticGuid(),
    history,
    new IFC4.IfcLabel('Storey 0'),
    null,
    null,
    storeyPlacement,
    null,
    null,
    IFC_ENUM.element,
    new IFC4.IfcLengthMeasure(0),
  );
  const aggregationRels = [
    new IFC4.IfcRelAggregates(nextSyntheticGuid(), history, null, null, project, [site]),
    new IFC4.IfcRelAggregates(nextSyntheticGuid(), history, null, null, site, [building]),
    new IFC4.IfcRelAggregates(nextSyntheticGuid(), history, null, null, building, [storey]),
  ];
  return { storeyPlacement, aggregationRels, storey };
}

/** Q2 intent carrier: one name → value property (IfcText / IfcLengthMeasure). */
function singleValue(name: string, value: IFC4.IfcValue): IFC4.IfcPropertySingleValue {
  return new IFC4.IfcPropertySingleValue(new IFC4.IfcIdentifier(name), null, value, null);
}

interface WallBuildResult {
  wall: IFC4.IfcWallStandardCase;
  psetRel: IFC4.IfcRelDefinesByProperties;
  materialRel: IFC4.IfcRelAssociatesMaterial;
}

/** Axis-start placement (X along the axis, Z up) + length × thickness
 *  rectangle extruded +Z by height; intent id in GlobalId (Q2, reversible),
 *  Tag and Pset_WebRebar_Wall. Model space is already Z-up — coordinates
 *  cross verbatim (no rotation at this seam, see the header). */
function buildWall(factory: RootedFactory, wall: WallElement): WallBuildResult {
  const { entityGuid, nextSyntheticGuid, history, context, parentPlacement } = factory;
  const dx = wall.endPoint.x - wall.startPoint.x;
  const dy = wall.endPoint.y - wall.startPoint.y;
  const length = Math.hypot(dx, dy);
  const origin: Vec3 = { x: wall.startPoint.x, y: wall.startPoint.y, z: wall.baseElevation };
  const axisDirection: Vec3 = { x: dx / length, y: dy / length, z: 0 };
  const placement = new IFC4.IfcLocalPlacement(
    parentPlacement,
    new IFC4.IfcAxis2Placement3D(
      cartesian(origin),
      direction({ x: 0, y: 0, z: 1 }),
      direction(axisDirection),
    ),
  );
  const profile = new IFC4.IfcRectangleProfileDef(
    IFC_ENUM.areaProfile,
    null,
    new IFC4.IfcAxis2Placement2D(
      new IFC4.IfcCartesianPoint([new IFC4.IfcLengthMeasure(length / 2), new IFC4.IfcLengthMeasure(0)]),
      null,
    ),
    new IFC4.IfcPositiveLengthMeasure(length),
    new IFC4.IfcPositiveLengthMeasure(wall.thickness),
  );
  const solid = new IFC4.IfcExtrudedAreaSolid(
    profile,
    new IFC4.IfcAxis2Placement3D(cartesian({ x: 0, y: 0, z: 0 }), null, null),
    direction({ x: 0, y: 0, z: 1 }),
    new IFC4.IfcPositiveLengthMeasure(wall.height),
  );
  const bodyShape = new IFC4.IfcShapeRepresentation(
    context,
    new IFC4.IfcLabel('Body'),
    new IFC4.IfcLabel('SweptSolid'),
    [solid],
  );
  // IfcWallStandardCase 'Axis' representation (Allplan import requirement —
  // the T1 spike file failed there without it): the reference line as a
  // Curve2D polyline along local +X.
  const axisShape = new IFC4.IfcShapeRepresentation(
    context,
    new IFC4.IfcLabel('Axis'),
    new IFC4.IfcLabel('Curve2D'),
    [new IFC4.IfcPolyline([cartesian2d(0, 0), cartesian2d(length, 0)])],
  );
  const wallLine = new IFC4.IfcWallStandardCase(
    entityGuid(wall.id),
    history,
    new IFC4.IfcLabel(`Wall ${wall.id}`),
    null,
    null,
    placement,
    new IFC4.IfcProductDefinitionShape(null, null, [axisShape, bodyShape]),
    new IFC4.IfcIdentifier(wall.id),
    null,
  );
  const pset = new IFC4.IfcPropertySet(
    nextSyntheticGuid(),
    history,
    new IFC4.IfcLabel('Pset_WebRebar_Wall'),
    null,
    [singleValue('WebRebarId', new IFC4.IfcText(wall.id))],
  );
  const psetRel = new IFC4.IfcRelDefinesByProperties(
    nextSyntheticGuid(),
    history,
    null,
    null,
    [wallLine],
    pset,
  );
  // IfcWallStandardCase material convention (and an Allplan import requirement
  // — the T1 spike file failed there without it): a single-layer material
  // layer set whose usage centers the layer on the wall's reference plane
  // (AXIS2 = local Y = thickness direction; offset −t/2 with POSITIVE sense).
  const concrete = new IFC4.IfcMaterial(new IFC4.IfcLabel('Concrete'), null, null);
  const layer = new IFC4.IfcMaterialLayer(
    concrete,
    new IFC4.IfcNonNegativeLengthMeasure(wall.thickness),
    null,
    new IFC4.IfcLabel('Structure'),
    null,
    null,
    null,
  );
  const layerSet = new IFC4.IfcMaterialLayerSet([layer], new IFC4.IfcLabel('Wall Layers'), null);
  const layerSetUsage = new IFC4.IfcMaterialLayerSetUsage(
    layerSet,
    IFC_ENUM.layerSetAxis2,
    IFC_ENUM.directionPositive,
    new IFC4.IfcLengthMeasure(-wall.thickness / 2),
    null,
  );
  const materialRel = new IFC4.IfcRelAssociatesMaterial(
    nextSyntheticGuid(),
    history,
    null,
    null,
    [wallLine],
    layerSetUsage,
  );
  return { wall: wallLine, psetRel, materialRel };
}

interface BarBuildResult {
  bar: IFC4.IfcReinforcingBar;
  psetRel: IFC4.IfcRelDefinesByProperties;
}

/** Swept disk (radius Ø/2) over the full centerline path incl. bending places;
 *  intent (host, cover, grade) in Pset_WebRebar_ReinforcingBar (Q2). */
function buildBar(factory: RootedFactory, bar: ReinforcementBar): BarBuildResult {
  const { entityGuid, nextSyntheticGuid, history, context, parentPlacement } = factory;
  const directrix = new IFC4.IfcPolyline(bar.path.map(cartesian));
  const sweptDisk = new IFC4.IfcSweptDiskSolid(
    directrix,
    new IFC4.IfcPositiveLengthMeasure(bar.diameter / 2),
    null,
    new IFC4.IfcParameterValue(0),
    new IFC4.IfcParameterValue(1),
  );
  const shape = new IFC4.IfcShapeRepresentation(
    context,
    new IFC4.IfcLabel('Body'),
    new IFC4.IfcLabel('SweptSolid'),
    [sweptDisk],
  );
  const crossSectionArea = Math.PI * (bar.diameter / 2) ** 2;
  const barLine = new IFC4.IfcReinforcingBar(
    entityGuid(bar.id),
    history,
    new IFC4.IfcLabel(`Bar ${bar.id}`),
    null,
    null,
    identityPlacement(parentPlacement),
    new IFC4.IfcProductDefinitionShape(null, null, [shape]),
    new IFC4.IfcIdentifier(bar.id),
    new IFC4.IfcLabel(bar.steelGrade),
    new IFC4.IfcPositiveLengthMeasure(bar.diameter),
    new IFC4.IfcAreaMeasure(crossSectionArea),
    null,
    IFC_ENUM.barRoleUndefined,
    null,
  );
  const pset = new IFC4.IfcPropertySet(
    nextSyntheticGuid(),
    history,
    new IFC4.IfcLabel('Pset_WebRebar_ReinforcingBar'),
    null,
    [
      singleValue('WebRebarId', new IFC4.IfcText(bar.id)),
      singleValue('HostElementId', new IFC4.IfcText(bar.hostElementId)),
      singleValue('CoverDistance', new IFC4.IfcLengthMeasure(bar.coverDistance)),
      singleValue('SteelGrade', new IFC4.IfcText(bar.steelGrade)),
    ],
  );
  const psetRel = new IFC4.IfcRelDefinesByProperties(
    nextSyntheticGuid(),
    history,
    null,
    null,
    [barLine],
    pset,
  );
  return { bar: barLine, psetRel };
}

/**
 * Builds the IFC4 export model for a whole ProjectModel and returns the saved
 * SPF bytes. The caller owns closing modelID (api.CloseModel). Empty models
 * export the spatial boilerplate only (containment requires ≥1 product).
 */
export function buildIfcModel(api: IfcAPI, project: ProjectModel): IfcModelResult {
  const modelID = api.CreateModel({
    schema: Schemas.IFC4,
    name: project.metadata.name,
    // web-ifc's default FILE_DESCRIPTION is the IFC2X3 MVD name even for IFC4
    // files — name the actual IFC4 MVD (T1 Allplan probe finding).
    description: ['ViewDefinition [ReferenceView]'],
  });
  const factory: EntityFactory = {
    entityGuid: (uuid) => new IFC4.IfcGloballyUniqueId(compressUuidToIfcGuid(uuid)),
    nextSyntheticGuid: createSyntheticGuidSource(),
    history: buildOwnerHistory(project.metadata),
    context: buildModelContext(),
  };
  const spatial = buildSpatialStructure(factory, project.metadata.name);
  const rooted: RootedFactory = { ...factory, parentPlacement: spatial.storeyPlacement };
  const wallBuilds = Object.values(project.elements).map((wall) => buildWall(rooted, wall));
  const barBuilds = Object.values(project.reinforcement).map((bar) => buildBar(rooted, bar));
  const topLevel: IfcLineObject[] = [...spatial.aggregationRels];
  const products = [...wallBuilds.map((build) => build.wall), ...barBuilds.map((build) => build.bar)];
  if (products.length > 0) {
    topLevel.push(
      new IFC4.IfcRelContainedInSpatialStructure(
        factory.nextSyntheticGuid(),
        factory.history,
        null,
        null,
        products,
        spatial.storey,
      ),
    );
  }
  for (const build of wallBuilds) {
    topLevel.push(build.psetRel, build.materialRel);
  }
  for (const build of barBuilds) {
    topLevel.push(build.psetRel);
  }
  // Top-level writes cascade: every nested line object is emitted recursively;
  // shared objects (context, history, placements) rewrite the same expressID
  // idempotently (verified against web-ifc 0.0.77 WriteLine).
  for (const line of topLevel) {
    api.WriteLine(modelID, line);
  }
  return { modelID, bytes: api.SaveModel(modelID) };
}
