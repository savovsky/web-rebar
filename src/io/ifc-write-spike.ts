/**
 * M2 T1 spike — the §D.4 write-capability decision gate (plan Q1). Builds the
 * smallest meaningful IFC4 file for our model subset entirely through
 * web-ifc's write API: IfcProject → IfcSite → IfcBuilding → IfcBuildingStorey
 * boilerplate, one IfcWallStandardCase (extruded rectangle) + one
 * IfcReinforcingBar (swept disk over a polyline directrix), and the Q2
 * design-intent property sets (Pset_WebRebar_Wall / Pset_WebRebar_ReinforcingBar).
 *
 * This is a capability probe, not the shipping adapter — T2's ifc-mapping
 * module generalizes the same entity pattern over a full ProjectModel. The
 * file stays as the executable record of HOW the gate verdict was reached.
 *
 * Conventions used here (T2 inherits them):
 * - Schema IFC4, length unit MILLI.METRE — our model space is mm (§C).
 * - Wall local placement: origin at the axis start point, X along the wall
 *   axis, Z up; the body profile is a length × thickness rectangle extruded
 *   +Z by the wall height.
 * - web-ifc's WriteLine cascade: nested line objects are written recursively
 *   and replaced by handles, so writing the top-level relationship entities
 *   emits the whole graph.
 */
import type { IfcAPI, IfcLineObject } from 'web-ifc';
import { IFC4, Schemas } from 'web-ifc';
import type { Vec3 } from '@/data/models';

/** Wall fixture for the spike — mirrors WallElement's parametric shape (mm). */
export interface SpikeWall {
  id: string;
  startPoint: Vec3;
  endPoint: Vec3;
  thickness: number;
  height: number;
  baseElevation: number;
}

/** Bar fixture for the spike — mirrors ReinforcementBar's intent + path (mm). */
export interface SpikeBar {
  id: string;
  hostElementId: string;
  diameter: number;
  steelGrade: string;
  coverDistance: number;
  /** Centerline path in model space (mm) — becomes the swept-disk directrix. */
  path: Vec3[];
}

export interface SpikeModelParams {
  wall: SpikeWall;
  bar: SpikeBar;
}

export interface SpikeModelResult {
  modelID: number;
  /** The saved IFC-SPF file content. */
  bytes: Uint8Array;
  wallExpressId: number;
  barExpressId: number;
}

/** IFC GUID charset is 0-9A-Za-z_$ — deterministic opaque ids suffice here
 *  (T2 implements the reversible UUID ↔ compressed-GUID encoding, Q2). */
const IFC_GUID_LENGTH = 22;
const SPIKE_CREATION_TIMESTAMP = 1754200000; // 2025-08-03, fixed for determinism
const CONTEXT_PRECISION = 1e-7;

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

/** Deterministic 22-char placeholder GUIDs for the spike ('1...1NNNN'). */
function createGuidSource(): () => IFC4.IfcGloballyUniqueId {
  let counter = 0;
  return () => {
    counter += 1;
    return new IFC4.IfcGloballyUniqueId(String(counter).padStart(IFC_GUID_LENGTH, '1'));
  };
}

function cartesian(point: Vec3): IFC4.IfcCartesianPoint {
  return new IFC4.IfcCartesianPoint([
    new IFC4.IfcLengthMeasure(point.x),
    new IFC4.IfcLengthMeasure(point.y),
    new IFC4.IfcLengthMeasure(point.z),
  ]);
}

function direction(v: Vec3): IFC4.IfcDirection {
  return new IFC4.IfcDirection([new IFC4.IfcReal(v.x), new IFC4.IfcReal(v.y), new IFC4.IfcReal(v.z)]);
}

function buildOwnerHistory(): IFC4.IfcOwnerHistory {
  const person = new IFC4.IfcPerson(null, null, null, null, null, null, null, null);
  const org = new IFC4.IfcOrganization(null, new IFC4.IfcLabel('web-rebar'), null, null, null);
  const personOrg = new IFC4.IfcPersonAndOrganization(person, org, null);
  const app = new IFC4.IfcApplication(
    org,
    new IFC4.IfcLabel('0.0.0'),
    new IFC4.IfcLabel('web-rebar'),
    new IFC4.IfcIdentifier('web-rebar'),
  );
  return new IFC4.IfcOwnerHistory(
    personOrg,
    app,
    null,
    IFC_ENUM.added,
    null,
    null,
    null,
    new IFC4.IfcTimeStamp(SPIKE_CREATION_TIMESTAMP),
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

interface SpatialStructure {
  storeyPlacement: IFC4.IfcLocalPlacement;
  aggregationRels: IFC4.IfcRelAggregates[];
  storey: IFC4.IfcBuildingStorey;
}

/** Everything every entity builder needs — bundles the max-params-2 rule into
 *  one options object (§N plain-params-object convention). */
interface EntityFactory {
  nextGuid: () => IFC4.IfcGloballyUniqueId;
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

/** Project → Site → Building → Storey boilerplate (storey assignment is M4 scope). */
function buildSpatialStructure(factory: EntityFactory, units: IFC4.IfcUnitAssignment): SpatialStructure {
  const { nextGuid, history, context } = factory;
  const project = new IFC4.IfcProject(
    nextGuid(),
    history,
    new IFC4.IfcLabel('web-rebar spike'),
    null,
    null,
    null,
    null,
    [context],
    units,
  );
  const sitePlacement = identityPlacement(null);
  const site = new IFC4.IfcSite(
    nextGuid(),
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
    nextGuid(),
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
    nextGuid(),
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
    new IFC4.IfcRelAggregates(nextGuid(), history, null, null, project, [site]),
    new IFC4.IfcRelAggregates(nextGuid(), history, null, null, site, [building]),
    new IFC4.IfcRelAggregates(nextGuid(), history, null, null, building, [storey]),
  ];
  return { storeyPlacement, aggregationRels, storey };
}

interface WallBuildResult {
  wall: IFC4.IfcWallStandardCase;
  psetRel: IFC4.IfcRelDefinesByProperties;
  materialRel: IFC4.IfcRelAssociatesMaterial;
}

/** Axis start placement (X along the axis, Z up) + length × thickness
 *  rectangle extruded +Z by height; intent id in Pset_WebRebar_Wall (Q2). */
function buildWall(factory: RootedFactory, params: SpikeWall): WallBuildResult {
  const { nextGuid, history, context, parentPlacement } = factory;
  const dx = params.endPoint.x - params.startPoint.x;
  const dz = params.endPoint.z - params.startPoint.z;
  const length = Math.hypot(dx, dz);
  const placement = new IFC4.IfcLocalPlacement(
    parentPlacement,
    new IFC4.IfcAxis2Placement3D(
      cartesian({ x: params.startPoint.x, y: params.baseElevation, z: params.startPoint.z }),
      direction({ x: 0, y: 0, z: 1 }),
      direction({ x: dx / length, y: 0, z: dz / length }),
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
    new IFC4.IfcPositiveLengthMeasure(params.thickness),
  );
  const solid = new IFC4.IfcExtrudedAreaSolid(
    profile,
    new IFC4.IfcAxis2Placement3D(cartesian({ x: 0, y: 0, z: 0 }), null, null),
    direction({ x: 0, y: 0, z: 1 }),
    new IFC4.IfcPositiveLengthMeasure(params.height),
  );
  const bodyShape = new IFC4.IfcShapeRepresentation(
    context,
    new IFC4.IfcLabel('Body'),
    new IFC4.IfcLabel('SweptSolid'),
    [solid],
  );
  // IfcWallStandardCase 'Axis' representation (Allplan import requirement —
  // the T1 spike file failed there without it): the wall's reference line as
  // a Curve2D polyline along local +X. Curve2D items are genuine 2D points
  // (x = along the axis) — 3D points here trip strict importers.
  const axisShape = new IFC4.IfcShapeRepresentation(
    context,
    new IFC4.IfcLabel('Axis'),
    new IFC4.IfcLabel('Curve2D'),
    [
      new IFC4.IfcPolyline([
        new IFC4.IfcCartesianPoint([new IFC4.IfcLengthMeasure(0), new IFC4.IfcLengthMeasure(0)]),
        new IFC4.IfcCartesianPoint([new IFC4.IfcLengthMeasure(length), new IFC4.IfcLengthMeasure(0)]),
      ]),
    ],
  );
  const wall = new IFC4.IfcWallStandardCase(
    nextGuid(),
    history,
    new IFC4.IfcLabel(`Wall ${params.id}`),
    null,
    null,
    placement,
    new IFC4.IfcProductDefinitionShape(null, null, [axisShape, bodyShape]),
    new IFC4.IfcIdentifier(params.id),
    null,
  );
  const pset = new IFC4.IfcPropertySet(nextGuid(), history, new IFC4.IfcLabel('Pset_WebRebar_Wall'), null, [
    new IFC4.IfcPropertySingleValue(
      new IFC4.IfcIdentifier('WebRebarId'),
      null,
      new IFC4.IfcText(params.id),
      null,
    ),
  ]);
  const psetRel = new IFC4.IfcRelDefinesByProperties(nextGuid(), history, null, null, [wall], pset);
  // IfcWallStandardCase material convention (and an Allplan import requirement
  // — the T1 spike file failed there without it): a single-layer material
  // layer set whose usage centers the layer on the wall's reference plane
  // (AXIS2 = local Y = thickness direction; offset −t/2 with POSITIVE sense).
  const concrete = new IFC4.IfcMaterial(new IFC4.IfcLabel('Concrete'), null, null);
  const layer = new IFC4.IfcMaterialLayer(
    concrete,
    new IFC4.IfcNonNegativeLengthMeasure(params.thickness),
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
    new IFC4.IfcLengthMeasure(-params.thickness / 2),
    null,
  );
  const materialRel = new IFC4.IfcRelAssociatesMaterial(
    nextGuid(),
    history,
    null,
    null,
    [wall],
    layerSetUsage,
  );
  return { wall, psetRel, materialRel };
}

interface BarBuildResult {
  bar: IFC4.IfcReinforcingBar;
  psetRel: IFC4.IfcRelDefinesByProperties;
}

/** Swept disk (radius Ø/2) over the full centerline path incl. bending places;
 *  intent (host, cover, grade) in Pset_WebRebar_ReinforcingBar (Q2). */
function buildBar(factory: RootedFactory, params: SpikeBar): BarBuildResult {
  const { nextGuid, history, context, parentPlacement } = factory;
  const directrix = new IFC4.IfcPolyline(params.path.map(cartesian));
  const sweptDisk = new IFC4.IfcSweptDiskSolid(
    directrix,
    new IFC4.IfcPositiveLengthMeasure(params.diameter / 2),
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
  const crossSectionArea = Math.PI * (params.diameter / 2) ** 2;
  const bar = new IFC4.IfcReinforcingBar(
    nextGuid(),
    history,
    new IFC4.IfcLabel(`Bar ${params.id}`),
    null,
    null,
    identityPlacement(parentPlacement),
    new IFC4.IfcProductDefinitionShape(null, null, [shape]),
    new IFC4.IfcIdentifier(params.id),
    new IFC4.IfcLabel(params.steelGrade),
    new IFC4.IfcPositiveLengthMeasure(params.diameter),
    new IFC4.IfcAreaMeasure(crossSectionArea),
    null,
    IFC_ENUM.barRoleUndefined,
    null,
  );
  const pset = new IFC4.IfcPropertySet(
    nextGuid(),
    history,
    new IFC4.IfcLabel('Pset_WebRebar_ReinforcingBar'),
    null,
    [
      new IFC4.IfcPropertySingleValue(
        new IFC4.IfcIdentifier('WebRebarId'),
        null,
        new IFC4.IfcText(params.id),
        null,
      ),
      new IFC4.IfcPropertySingleValue(
        new IFC4.IfcIdentifier('HostElementId'),
        null,
        new IFC4.IfcText(params.hostElementId),
        null,
      ),
      new IFC4.IfcPropertySingleValue(
        new IFC4.IfcIdentifier('CoverDistance'),
        null,
        new IFC4.IfcLengthMeasure(params.coverDistance),
        null,
      ),
      new IFC4.IfcPropertySingleValue(
        new IFC4.IfcIdentifier('SteelGrade'),
        null,
        new IFC4.IfcText(params.steelGrade),
        null,
      ),
    ],
  );
  const psetRel = new IFC4.IfcRelDefinesByProperties(nextGuid(), history, null, null, [bar], pset);
  return { bar, psetRel };
}

/**
 * Builds the spike IFC4 model in a fresh web-ifc model and returns the saved
 * SPF bytes. The caller owns closing modelID (api.CloseModel).
 */
export function buildSpikeModel(api: IfcAPI, params: SpikeModelParams): SpikeModelResult {
  const modelID = api.CreateModel({
    schema: Schemas.IFC4,
    name: 'web-rebar-spike',
    // web-ifc's default FILE_DESCRIPTION is the IFC2X3 MVD name even for IFC4
    // files — name the actual IFC4 MVD (found in the T1 Allplan probe).
    description: ['ViewDefinition [ReferenceView]'],
  });
  const factory: EntityFactory = {
    nextGuid: createGuidSource(),
    history: buildOwnerHistory(),
    context: buildModelContext(),
  };
  const { nextGuid, history } = factory;
  const spatial = buildSpatialStructure(factory, buildUnits());
  const rooted: RootedFactory = { ...factory, parentPlacement: spatial.storeyPlacement };
  const { wall, psetRel: wallPsetRel, materialRel: wallMaterialRel } = buildWall(rooted, params.wall);
  const { bar, psetRel: barPsetRel } = buildBar(rooted, params.bar);
  const containment = new IFC4.IfcRelContainedInSpatialStructure(
    nextGuid(),
    history,
    null,
    null,
    [wall, bar],
    spatial.storey,
  );
  // Top-level writes cascade: every nested line object is emitted recursively.
  const topLevel: IfcLineObject[] = [
    ...spatial.aggregationRels,
    containment,
    wallPsetRel,
    barPsetRel,
    wallMaterialRel,
  ];
  for (const line of topLevel) {
    api.WriteLine(modelID, line);
  }
  return {
    modelID,
    bytes: api.SaveModel(modelID),
    wallExpressId: wall.expressID,
    barExpressId: bar.expressID,
  };
}
