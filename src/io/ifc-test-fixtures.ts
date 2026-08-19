/**
 * Shared IFC test fixtures for the T3 import adapter (test-only — statically
 * imports web-ifc like the mapping modules; MUST be reachable only from
 * *.test.ts files, never from app code). Foreign-entity builders use the
 * web-ifc class-based write API directly (the ifc-write-spike.ts pattern).
 */
import { IFC4, type IfcAPI, Schemas } from 'web-ifc';
import { compressUuidToIfcGuid } from './ifc-guid';

/** web-ifc declares enum members as `any` — narrowed once, here. */
const AREA_PROFILE = IFC4.IfcProfileTypeEnum.AREA as IFC4.IfcProfileTypeEnum;

const WALL_THICKNESS_MM = 200;
const WALL_HEIGHT_MM = 2800;
const IFC_GUID_LENGTH = 22;
const DANGLING_BAR_COVER_MM = 25;
const CONTEXT_PRECISION = 1e-7;
/** # is outside the IFC GUID charset — a deliberately non-decodable GlobalId. */
const UNDECODABLE_GUID = '#'.repeat(IFC_GUID_LENGTH);
const FALLBACK_ID_WALL = {
  start: { x: 0, y: 0, z: 0 },
  length: 2000,
};
const DANGLING_BAR = {
  diameter: 12,
  hostId: 'host-not-in-file',
  path: [
    { x: 0, y: 0, z: 500 },
    { x: 1000, y: 0, z: 500 },
  ],
};

const point = (p: { x: number; y: number; z: number }): IFC4.IfcCartesianPoint =>
  new IFC4.IfcCartesianPoint([
    new IFC4.IfcLengthMeasure(p.x),
    new IFC4.IfcLengthMeasure(p.y),
    new IFC4.IfcLengthMeasure(p.z),
  ]);

const compressedUuid = (uuid: string): IFC4.IfcGloballyUniqueId =>
  new IFC4.IfcGloballyUniqueId(compressUuidToIfcGuid(uuid));

/** Minimal Model context — IfcShapeRepresentation's context is non-nullable
 *  in IFC4's type declarations (the import mapping never reads it). */
function buildModelContext(): IFC4.IfcGeometricRepresentationContext {
  return new IFC4.IfcGeometricRepresentationContext(
    new IFC4.IfcLabel('Model'),
    new IFC4.IfcLabel('Model'),
    new IFC4.IfcDimensionCount(3),
    new IFC4.IfcReal(CONTEXT_PRECISION),
    new IFC4.IfcAxis2Placement3D(point({ x: 0, y: 0, z: 0 }), null, null),
    null,
  );
}

/**
 * Writes entities a foreign file would carry (no Q2 intent psets) INTO an
 * open model — used to contaminate a export-fixture model with one pset-less
 * wall + one non-wall/bar element. Returns nothing; the caller re-saves.
 */
export function addForeignEntities(api: IfcAPI, modelID: number): void {
  const foreignWall = new IFC4.IfcWallStandardCase(
    compressedUuid(crypto.randomUUID()),
    null,
    new IFC4.IfcLabel('Foreign wall (no psets)'),
    null,
    null,
    null,
    null,
    null,
    null,
  );
  const proxy = new IFC4.IfcBuildingElementProxy(
    compressedUuid(crypto.randomUUID()),
    null,
    new IFC4.IfcLabel('Foreign element (unsupported type)'),
    null,
    null,
    null,
    null,
    null,
    null,
  );
  api.WriteLine(modelID, foreignWall);
  api.WriteLine(modelID, proxy);
}

/**
 * A wall carrying the wall intent pset whose GlobalId is deliberately NOT a
 * decodable UUID — the import must recover the id from the pset WebRebarId
 * property (the documented belt-and-braces fallback).
 */
export function buildFallbackIdWallBytes(api: IfcAPI): { bytes: Uint8Array; wallUuid: string } {
  const modelID = api.CreateModel({ schema: Schemas.IFC4 });
  const wallUuid = crypto.randomUUID();
  const placement = new IFC4.IfcLocalPlacement(
    null,
    new IFC4.IfcAxis2Placement3D(point(FALLBACK_ID_WALL.start), null, null),
  );
  const profile = new IFC4.IfcRectangleProfileDef(
    AREA_PROFILE,
    null,
    null,
    new IFC4.IfcPositiveLengthMeasure(FALLBACK_ID_WALL.length),
    new IFC4.IfcPositiveLengthMeasure(WALL_THICKNESS_MM),
  );
  const solid = new IFC4.IfcExtrudedAreaSolid(
    profile,
    null,
    new IFC4.IfcDirection([new IFC4.IfcReal(0), new IFC4.IfcReal(0), new IFC4.IfcReal(1)]),
    new IFC4.IfcPositiveLengthMeasure(WALL_HEIGHT_MM),
  );
  const shape = new IFC4.IfcProductDefinitionShape(null, null, [
    new IFC4.IfcShapeRepresentation(
      buildModelContext(),
      new IFC4.IfcLabel('Body'),
      new IFC4.IfcLabel('SweptSolid'),
      [solid],
    ),
  ]);
  const wall = new IFC4.IfcWallStandardCase(
    new IFC4.IfcGloballyUniqueId(UNDECODABLE_GUID),
    null,
    new IFC4.IfcLabel('Fallback-id wall'),
    null,
    null,
    placement,
    shape,
    null,
    null,
  );
  const pset = new IFC4.IfcPropertySet(
    compressedUuid(crypto.randomUUID()),
    null,
    new IFC4.IfcLabel('Pset_WebRebar_Wall'),
    null,
    [
      new IFC4.IfcPropertySingleValue(
        new IFC4.IfcIdentifier('WebRebarId'),
        null,
        new IFC4.IfcText(wallUuid),
        null,
      ),
    ],
  );
  const psetRel = new IFC4.IfcRelDefinesByProperties(
    compressedUuid(crypto.randomUUID()),
    null,
    null,
    null,
    [wall],
    pset,
  );
  api.WriteLine(modelID, psetRel);
  const bytes = api.SaveModel(modelID);
  api.CloseModel(modelID);
  return { bytes, wallUuid };
}

/**
 * A syntactically valid bar carrying the bar intent pset whose HostElementId
 * resolves to nothing in the file — the importIfcModel command must reject it
 * with NOT_FOUND before mutating anything.
 */
export function buildDanglingHostBarBytes(api: IfcAPI): Uint8Array {
  const modelID = api.CreateModel({ schema: Schemas.IFC4 });
  const barUuid = crypto.randomUUID();
  const placement = new IFC4.IfcLocalPlacement(
    null,
    new IFC4.IfcAxis2Placement3D(point({ x: 0, y: 0, z: 0 }), null, null),
  );
  const directrix = new IFC4.IfcPolyline(DANGLING_BAR.path.map(point));
  const sweptDisk = new IFC4.IfcSweptDiskSolid(
    directrix,
    new IFC4.IfcPositiveLengthMeasure(DANGLING_BAR.diameter / 2),
    null,
    null,
    null,
  );
  const shape = new IFC4.IfcProductDefinitionShape(null, null, [
    new IFC4.IfcShapeRepresentation(
      buildModelContext(),
      new IFC4.IfcLabel('Body'),
      new IFC4.IfcLabel('SweptSolid'),
      [sweptDisk],
    ),
  ]);
  const bar = new IFC4.IfcReinforcingBar(
    compressedUuid(barUuid),
    null,
    new IFC4.IfcLabel('Dangling-host bar'),
    null,
    null,
    placement,
    shape,
    null,
    new IFC4.IfcLabel('B500B'),
    new IFC4.IfcPositiveLengthMeasure(DANGLING_BAR.diameter),
    null,
    null,
    null,
    null,
  );
  const props = [
    ['WebRebarId', new IFC4.IfcText(barUuid)],
    ['HostElementId', new IFC4.IfcText(DANGLING_BAR.hostId)],
    ['CoverDistance', new IFC4.IfcLengthMeasure(DANGLING_BAR_COVER_MM)],
    ['SteelGrade', new IFC4.IfcText('B500B')],
  ] as const;
  const pset = new IFC4.IfcPropertySet(
    compressedUuid(crypto.randomUUID()),
    null,
    new IFC4.IfcLabel('Pset_WebRebar_ReinforcingBar'),
    null,
    props.map(
      ([name, value]) => new IFC4.IfcPropertySingleValue(new IFC4.IfcIdentifier(name), null, value, null),
    ),
  );
  const psetRel = new IFC4.IfcRelDefinesByProperties(
    compressedUuid(crypto.randomUUID()),
    null,
    null,
    null,
    [bar],
    pset,
  );
  api.WriteLine(modelID, psetRel);
  const bytes = api.SaveModel(modelID);
  api.CloseModel(modelID);
  return bytes;
}
