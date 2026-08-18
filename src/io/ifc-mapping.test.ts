/**
 * M2 T2 — IFC export adapter tests (plan T2: headless entity-graph tests).
 * The model is built through the §N commands (real UUIDs, real defaults —
 * the same doorway the UI uses), exported via the pure mapping module with an
 * injected web-ifc instance, and REOPENED with a fresh IfcAPI (own WASM heap)
 * so the assertions prove file-level persistence, not in-memory reuse.
 *
 * Asserted: the three T1 Allplan conventions (material layer set usage, Axis
 * Curve2D next to Body, IFC4 MVD FILE_DESCRIPTION), Q2 design-intent psets,
 * GlobalId = reversible compressed UUID, the Y-up→Z-up rotation, exact
 * doubles, shared-object dedup (one owner history / one context for a
 * multi-entity export), and the empty-model case.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { IfcAPI } from 'web-ifc';
import {
  IFCBUILDING,
  IFCBUILDINGSTOREY,
  IFCGEOMETRICREPRESENTATIONCONTEXT,
  IFCMATERIALLAYERSETUSAGE,
  IFCOWNERHISTORY,
  IFCPROJECT,
  IFCPROPERTYSET,
  IFCREINFORCINGBAR,
  IFCRELAGGREGATES,
  IFCRELASSOCIATESMATERIAL,
  IFCRELCONTAINEDINSPATIALSTRUCTURE,
  IFCRELDEFINESBYPROPERTIES,
  IFCSITE,
  IFCWALLSTANDARDCASE,
} from 'web-ifc';
import { placeBar, placeWall } from '@/commands';
import type { ProjectModel } from '@/data/models';
import { createAppStore } from '@/stores';
import { decompressIfcGuidToUuid } from './ifc-guid';
import { buildIfcModel, toIfcPoint } from './ifc-mapping';
import { createIfcApi } from './web-ifc-loader';

/** Two crossing walls (one elevated — proves baseElevation maps to IFC Z) and
 *  a straight + a bent bar hosted by wall A. */
const WALL_A = {
  startPoint: { x: 0, y: 0, z: 0 },
  endPoint: { x: 4000, y: 0, z: 0 },
  thickness: 200,
  height: 2800,
};
const WALL_B = {
  startPoint: { x: 1000, y: 0, z: 2000 },
  endPoint: { x: 1000, y: 0, z: 6000 },
  thickness: 300,
  height: 2800,
  baseElevation: 3000,
};
const STRAIGHT_BAR_PATH = [
  { x: 500, y: 700, z: 87 },
  { x: 3500, y: 700, z: 87 },
];
const BENT_BAR_PATH = [
  { x: 500, y: 1500, z: 87 },
  { x: 3500, y: 1500, z: 87 },
  { x: 3500, y: 2400, z: 87 },
];
const DEFAULT_WALL_COVER_MM = 25; // catalog seed (steel.ts defaultCover.wall)
const DEFAULT_STEEL_GRADE = 'B500B';

const EXPORT_ARTIFACT_DIR = fileURLToPath(new URL('../../docs/test-fixtures/ifc/', import.meta.url));
const EXPORT_ARTIFACT_FILE = `${EXPORT_ARTIFACT_DIR}m2-t2-export.ifc`;

interface Fixture {
  project: ProjectModel;
  wallAId: string;
  wallBId: string;
  straightBarId: string;
  bentBarId: string;
}

/** Builds the fixture model through the §N commands — the same doorway the
 *  tools use — and returns the frozen project snapshot plus the entity ids. */
function buildFixture(): Fixture {
  const store = createAppStore();
  const wallAId = store.dispatch(placeWall(WALL_A));
  const wallBId = store.dispatch(placeWall(WALL_B));
  const straightBarId = store.dispatch(
    placeBar({ hostElementId: wallAId, diameter: 12, path: STRAIGHT_BAR_PATH }),
  );
  const bentBarId = store.dispatch(placeBar({ hostElementId: wallAId, diameter: 16, path: BENT_BAR_PATH }));
  return { project: store.getState().project, wallAId, wallBId, straightBarId, bentBarId };
}

/** Narrowed views of the flattened lines web-ifc returns (GetLine is `any`). */
interface ValueBox<T> {
  value: T;
}
interface PointLine {
  Coordinates: ValueBox<number>[];
}
interface DirectionLine {
  DirectionRatios: ValueBox<number>[];
}
interface WallBodyRep {
  RepresentationIdentifier: ValueBox<string>;
  Items: { Depth: ValueBox<number>; SweptArea: { XDim: ValueBox<number>; YDim: ValueBox<number> } }[];
}
interface WallAxisRep {
  RepresentationIdentifier: ValueBox<string>;
  Items: { Points: PointLine[] }[];
}
interface WallLine {
  GlobalId: ValueBox<string>;
  Name: ValueBox<string>;
  Tag: ValueBox<string>;
  ObjectPlacement: {
    RelativePlacement: { Location: PointLine; Axis: DirectionLine; RefDirection: DirectionLine };
  };
  Representation: { Representations: (WallBodyRep | WallAxisRep)[] };
}
interface BarLine {
  GlobalId: ValueBox<string>;
  Tag: ValueBox<string>;
  NominalDiameter: ValueBox<number>;
  SteelGrade: ValueBox<string>;
  Representation: {
    Representations: { Items: { Radius: ValueBox<number>; Directrix: { Points: PointLine[] } }[] }[];
  };
}
interface PsetLine {
  Name: ValueBox<string>;
  HasProperties: { Name: ValueBox<string>; NominalValue: ValueBox<string | number> }[];
}
interface ContainmentLine {
  /** IFC4 renamed the IFC2X3 'RelatedObjects' attribute to 'RelatedElements'. */
  RelatedElements: { expressID: number }[];
  RelatingStructure: { expressID: number };
}
interface RelAssociatesMaterialLine {
  RelatedObjects: { expressID: number }[];
  RelatingMaterial: { ForLayerSet: { MaterialLayers: { LayerThickness: ValueBox<number> }[] } };
}

interface ReadRequest {
  api: IfcAPI;
  modelID: number;
}

function getFlattened<T>(req: ReadRequest & { expressID: number }): T {
  return req.api.GetLine(req.modelID, req.expressID, true) as T;
}

function lineIds(req: ReadRequest & { type: number }): number[] {
  const ids = req.api.GetLineIDsWithType(req.modelID, req.type);
  return Array.from({ length: ids.size() }, (_, index) => ids.get(index));
}

function psetProps(pset: PsetLine): Record<string, string | number> {
  return Object.fromEntries(pset.HasProperties.map((p) => [p.Name.value, p.NominalValue.value]));
}

const pointCoords = (point: PointLine): number[] => point.Coordinates.map((c) => c.value);

async function exportAndReopen(): Promise<{ fixture: Fixture; reader: IfcAPI; modelID: number }> {
  const fixture = buildFixture();
  const writer = await createIfcApi();
  const { modelID: writeModelID, bytes } = buildIfcModel(writer, fixture.project);
  writer.CloseModel(writeModelID);
  const reader = await createIfcApi();
  const modelID = reader.OpenModel(bytes);
  return { fixture, reader, modelID };
}

function wallsByTag(req: ReadRequest): Map<string, WallLine> {
  const walls = lineIds({ ...req, type: IFCWALLSTANDARDCASE }).map((expressID) =>
    getFlattened<WallLine>({ ...req, expressID }),
  );
  return new Map(walls.map((wall) => [wall.Tag.value, wall]));
}

function barsByTag(req: ReadRequest): Map<string, BarLine> {
  const bars = lineIds({ ...req, type: IFCREINFORCINGBAR }).map((expressID) =>
    getFlattened<BarLine>({ ...req, expressID }),
  );
  return new Map(bars.map((bar) => [bar.Tag.value, bar]));
}

describe('toIfcPoint — Y-up model → Z-up IFC rotation', () => {
  it('maps (x, y, z)model → (x, −z, y)ifc, elevation stays elevation, never emits −0', () => {
    expect(toIfcPoint({ x: 1000, y: 3000, z: 500 })).toEqual({ x: 1000, y: -500, z: 3000 });
    expect(toIfcPoint({ x: 0, y: 0, z: 0 })).toEqual({ x: 0, y: 0, z: 0 });
    expect(Object.is(toIfcPoint({ x: 0, y: 0, z: 0 }).y, -0)).toBe(false);
    expect(toIfcPoint({ x: -250, y: 25, z: -4000 })).toEqual({ x: -250, y: 4000, z: 25 });
  });
});

describe('IFC export mapping — ProjectModel → IFC4 entity graph (M2 T2)', () => {
  it('writes a valid IFC4 SPF header with the IFC4 MVD FILE_DESCRIPTION (T1 convention 3)', async () => {
    const writer = await createIfcApi();
    const { modelID, bytes } = buildIfcModel(writer, buildFixture().project);
    writer.CloseModel(modelID);
    const text = new TextDecoder().decode(bytes);
    expect(text.startsWith('ISO-10303-21;')).toBe(true);
    expect(text).toContain("FILE_SCHEMA(('IFC4'))");
    expect(text).toContain('ViewDefinition [ReferenceView]');
    expect(text).not.toContain('CoordinationView');
    expect(text).toContain('IFCWALLSTANDARDCASE');
    expect(text).toContain('IFCREINFORCINGBAR');
    expect(text).toContain('Pset_WebRebar_Wall');
    expect(text).toContain('Pset_WebRebar_ReinforcingBar');
  });

  it('entity counts: 2 walls + 2 bars, per-entity psets/material rels, ONE containment, deduped shared boilerplate', async () => {
    const { reader, modelID } = await exportAndReopen();
    const req: ReadRequest = { api: reader, modelID };
    expect(reader.GetModelSchema(modelID)).toBe('IFC4');
    expect(lineIds({ ...req, type: IFCWALLSTANDARDCASE })).toHaveLength(2);
    expect(lineIds({ ...req, type: IFCREINFORCINGBAR })).toHaveLength(2);
    expect(lineIds({ ...req, type: IFCPROPERTYSET })).toHaveLength(4);
    expect(lineIds({ ...req, type: IFCRELDEFINESBYPROPERTIES })).toHaveLength(4);
    expect(lineIds({ ...req, type: IFCMATERIALLAYERSETUSAGE })).toHaveLength(2);
    expect(lineIds({ ...req, type: IFCRELASSOCIATESMATERIAL })).toHaveLength(2);
    expect(lineIds({ ...req, type: IFCRELCONTAINEDINSPATIALSTRUCTURE })).toHaveLength(1);
    expect(lineIds({ ...req, type: IFCRELAGGREGATES })).toHaveLength(3);
    expect(lineIds({ ...req, type: IFCPROJECT })).toHaveLength(1);
    expect(lineIds({ ...req, type: IFCSITE })).toHaveLength(1);
    expect(lineIds({ ...req, type: IFCBUILDING })).toHaveLength(1);
    expect(lineIds({ ...req, type: IFCBUILDINGSTOREY })).toHaveLength(1);
    // Shared nested objects cascade-write idempotently: ONE history + ONE
    // context even with 4 products referencing them (WriteLine rewrites the
    // same expressID instead of duplicating the entity).
    expect(lineIds({ ...req, type: IFCOWNERHISTORY })).toHaveLength(1);
    expect(lineIds({ ...req, type: IFCGEOMETRICREPRESENTATIONCONTEXT })).toHaveLength(1);
    reader.CloseModel(modelID);
  });

  it('walls: GlobalId decodes to the internal UUID, placement is the rotated axis frame, Axis Curve2D + Body + material layer (T1 conventions 1+2)', async () => {
    const { fixture, reader, modelID } = await exportAndReopen();
    const req: ReadRequest = { api: reader, modelID };
    const walls = wallsByTag(req);
    expect([...walls.keys()].sort()).toEqual([fixture.wallAId, fixture.wallBId].sort());

    // Wall A: axis along +X at ground level → IFC location (0, 0, 0), X = (1,0,0).
    const wallA = walls.get(fixture.wallAId) as WallLine;
    expect(decompressIfcGuidToUuid(wallA.GlobalId.value)).toBe(fixture.wallAId);
    const placementA = wallA.ObjectPlacement.RelativePlacement;
    expect(pointCoords(placementA.Location)).toEqual([0, 0, 0]);
    expect(placementA.Axis.DirectionRatios.map((r) => r.value)).toEqual([0, 0, 1]);
    expect(placementA.RefDirection.DirectionRatios.map((r) => r.value)).toEqual([1, 0, 0]);

    // Wall B: axis along +Z_model at baseElevation 3000 → IFC location
    // (1000, −2000, 3000) — plan z becomes −y, ELEVATION becomes z.
    const wallB = walls.get(fixture.wallBId) as WallLine;
    expect(decompressIfcGuidToUuid(wallB.GlobalId.value)).toBe(fixture.wallBId);
    const placementB = wallB.ObjectPlacement.RelativePlacement;
    expect(pointCoords(placementB.Location)).toEqual([1000, -2000, 3000]);
    expect(placementB.RefDirection.DirectionRatios.map((r) => r.value)).toEqual([0, -1, 0]);

    // Both walls: Axis (Curve2D reference line) + Body (length × thickness ×
    // height) representations — the Allplan-required pair.
    for (const [wall, params] of [
      [wallA, WALL_A],
      [wallB, WALL_B],
    ] as const) {
      const reps = wall.Representation.Representations;
      expect(reps.map((r) => r.RepresentationIdentifier.value).sort()).toEqual(['Axis', 'Body']);
      const bodyRep = reps.find((r) => r.RepresentationIdentifier.value === 'Body') as WallBodyRep;
      expect(bodyRep.Items[0].SweptArea.XDim.value).toBe(4000);
      expect(bodyRep.Items[0].SweptArea.YDim.value).toBe(params.thickness);
      expect(bodyRep.Items[0].Depth.value).toBe(params.height);
      const axisRep = reps.find((r) => r.RepresentationIdentifier.value === 'Axis') as WallAxisRep;
      expect(axisRep.Items[0].Points.map(pointCoords)).toEqual([
        [0, 0],
        [4000, 0],
      ]);
    }

    // T1 convention 1: one material layer set usage per wall, layer thickness
    // == wall thickness, related back to that wall.
    const materialRels = lineIds({ ...req, type: IFCRELASSOCIATESMATERIAL }).map((expressID) =>
      getFlattened<RelAssociatesMaterialLine>({ ...req, expressID }),
    );
    const wallExpressIds = lineIds({ ...req, type: IFCWALLSTANDARDCASE });
    const thicknessByExpressId = new Map<number, number>();
    for (const rel of materialRels) {
      expect(rel.RelatedObjects).toHaveLength(1);
      const expressId = rel.RelatedObjects[0].expressID;
      expect(wallExpressIds).toContain(expressId);
      thicknessByExpressId.set(
        expressId,
        rel.RelatingMaterial.ForLayerSet.MaterialLayers[0].LayerThickness.value,
      );
    }
    expect([...thicknessByExpressId.values()].sort()).toEqual([WALL_A.thickness, WALL_B.thickness]);
    reader.CloseModel(modelID);
  });

  it('bars: GlobalId decodes to the internal UUID, swept-disk directrix is the rotated full path incl. the bending place, intent psets exact (Q2)', async () => {
    const { fixture, reader, modelID } = await exportAndReopen();
    const req: ReadRequest = { api: reader, modelID };
    const bars = barsByTag(req);
    expect([...bars.keys()].sort()).toEqual([fixture.straightBarId, fixture.bentBarId].sort());

    const straight = bars.get(fixture.straightBarId) as BarLine;
    expect(decompressIfcGuidToUuid(straight.GlobalId.value)).toBe(fixture.straightBarId);
    expect(straight.NominalDiameter.value).toBe(12);
    expect(straight.SteelGrade.value).toBe(DEFAULT_STEEL_GRADE);
    const straightRep = straight.Representation.Representations[0].Items[0];
    expect(straightRep.Radius.value).toBe(6);
    expect(straightRep.Directrix.Points.map(pointCoords)).toEqual([
      [500, -87, 700],
      [3500, -87, 700],
    ]);

    const bent = bars.get(fixture.bentBarId) as BarLine;
    expect(decompressIfcGuidToUuid(bent.GlobalId.value)).toBe(fixture.bentBarId);
    expect(bent.NominalDiameter.value).toBe(16);
    const bentRep = bent.Representation.Representations[0].Items[0];
    expect(bentRep.Radius.value).toBe(8);
    // The bending place survives: 3 directrix points, model y → IFC z.
    expect(bentRep.Directrix.Points.map(pointCoords)).toEqual([
      [500, -87, 1500],
      [3500, -87, 1500],
      [3500, -87, 2400],
    ]);

    const psets = lineIds({ ...req, type: IFCPROPERTYSET }).map((expressID) =>
      getFlattened<PsetLine>({ ...req, expressID }),
    );
    const wallPsets = psets.filter((p) => p.Name.value === 'Pset_WebRebar_Wall');
    const barPsets = psets.filter((p) => p.Name.value === 'Pset_WebRebar_ReinforcingBar');
    expect(wallPsets).toHaveLength(2);
    expect(barPsets).toHaveLength(2);
    // Line order inside the file is a write-cascade detail — compare as sets.
    const sortById = (a: Record<string, string | number>, b: Record<string, string | number>) =>
      String(a.WebRebarId).localeCompare(String(b.WebRebarId));
    expect(wallPsets.map((p) => psetProps(p)).sort(sortById)).toEqual(
      [{ WebRebarId: fixture.wallAId }, { WebRebarId: fixture.wallBId }].sort(sortById),
    );
    expect(barPsets.map((p) => psetProps(p)).sort(sortById)).toEqual(
      [
        {
          WebRebarId: fixture.straightBarId,
          HostElementId: fixture.wallAId,
          CoverDistance: DEFAULT_WALL_COVER_MM,
          SteelGrade: DEFAULT_STEEL_GRADE,
        },
        {
          WebRebarId: fixture.bentBarId,
          HostElementId: fixture.wallAId,
          CoverDistance: DEFAULT_WALL_COVER_MM,
          SteelGrade: DEFAULT_STEEL_GRADE,
        },
      ].sort(sortById),
    );
    reader.CloseModel(modelID);
  });

  it('containment: ONE IfcRelContainedInSpatialStructure relates all 4 products to the storey', async () => {
    const { reader, modelID } = await exportAndReopen();
    const req: ReadRequest = { api: reader, modelID };
    const containment = getFlattened<ContainmentLine>({
      ...req,
      expressID: lineIds({ ...req, type: IFCRELCONTAINEDINSPATIALSTRUCTURE })[0],
    });
    const productIds = containment.RelatedElements.map((ref) => ref.expressID).sort();
    const expectedIds = [
      ...lineIds({ ...req, type: IFCWALLSTANDARDCASE }),
      ...lineIds({ ...req, type: IFCREINFORCINGBAR }),
    ].sort();
    expect(productIds).toEqual(expectedIds);
    expect(containment.RelatingStructure.expressID).toBe(lineIds({ ...req, type: IFCBUILDINGSTOREY })[0]);
    reader.CloseModel(modelID);
  });

  it('empty model: valid IFC4 boilerplate without products or containment (IFC SET cardinality)', async () => {
    const store = createAppStore();
    const writer = await createIfcApi();
    const { modelID: writeModelID, bytes } = buildIfcModel(writer, store.getState().project);
    writer.CloseModel(writeModelID);
    const reader = await createIfcApi();
    const modelID = reader.OpenModel(bytes);
    const req: ReadRequest = { api: reader, modelID };
    expect(lineIds({ ...req, type: IFCPROJECT })).toHaveLength(1);
    expect(lineIds({ ...req, type: IFCBUILDINGSTOREY })).toHaveLength(1);
    expect(lineIds({ ...req, type: IFCWALLSTANDARDCASE })).toHaveLength(0);
    expect(lineIds({ ...req, type: IFCREINFORCINGBAR })).toHaveLength(0);
    expect(lineIds({ ...req, type: IFCRELCONTAINEDINSPATIALSTRUCTURE })).toHaveLength(0);
    reader.CloseModel(modelID);
  });

  it('artifact: writes the T2 export file for the author to open in Allplan (orientation + elevation check)', async () => {
    const writer = await createIfcApi();
    const { modelID, bytes } = buildIfcModel(writer, buildFixture().project);
    writer.CloseModel(modelID);
    mkdirSync(EXPORT_ARTIFACT_DIR, { recursive: true });
    writeFileSync(EXPORT_ARTIFACT_FILE, bytes);
    expect(bytes.length).toBeGreaterThan(1000);
    expect(bytes.length).toBeLessThan(20000);
  });
});
