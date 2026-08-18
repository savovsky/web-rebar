/**
 * M2 T1 — web-ifc write-capability spike: the §D.4 decision gate (plan Q1).
 *
 * Gate criteria:
 *  (i)  all entities + properties survive web-ifc's own save/load — tested here;
 *  (ii) doubles survive within 1e-6 mm — tested here (exactly, in fact);
 *  (iii) the file opens in an external IFC viewer — MANUAL author check; this
 *        test drops the artifact at docs/test-fixtures/ifc/m2-t1-spike.ifc.
 *
 * The reopen side always uses a FRESH IfcAPI instance (own WASM heap) so the
 * probe proves file-level persistence, not in-memory reuse.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { IfcAPI } from 'web-ifc';
import {
  IFCMATERIALLAYERSETUSAGE,
  IFCPROPERTYSET,
  IFCREINFORCINGBAR,
  IFCRELASSOCIATESMATERIAL,
  IFCRELCONTAINEDINSPATIALSTRUCTURE,
  IFCRELDEFINESBYPROPERTIES,
  IFCWALLSTANDARDCASE,
} from 'web-ifc';
import type { SpikeBar, SpikeModelResult, SpikeWall } from './ifc-write-spike';
import { buildSpikeModel } from './ifc-write-spike';
import { createIfcApi, loadIfcApi } from './web-ifc-loader';

const SPIKE_WALL: SpikeWall = {
  id: 'wall-1',
  startPoint: { x: 1000, y: 0, z: 500 },
  endPoint: { x: 5000, y: 0, z: 500 },
  thickness: 300,
  height: 2800,
  baseElevation: 0,
};

const SPIKE_BAR: SpikeBar = {
  id: 'bar-1',
  hostElementId: 'wall-1',
  diameter: 12,
  steelGrade: 'B500B',
  coverDistance: 25,
  path: [
    { x: 1125.375, y: 100.125, z: 500 },
    { x: 4800.5, y: 100.125, z: 500 },
    { x: 4800.5, y: 1499.75, z: 500 },
  ],
};

const SPIKE_ARTIFACT_DIR = fileURLToPath(new URL('../../docs/test-fixtures/ifc/', import.meta.url));
const SPIKE_ARTIFACT_FILE = `${SPIKE_ARTIFACT_DIR}m2-t1-spike.ifc`;

/** Narrowed views of the flattened lines web-ifc returns (GetLine is `any`). */
interface ValueBox<T> {
  value: T;
}
interface PointLine {
  Coordinates: ValueBox<number>[];
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
  Name: ValueBox<string>;
  Tag: ValueBox<string>;
  ObjectPlacement: { RelativePlacement: { Location: PointLine } };
  Representation: { Representations: (WallBodyRep | WallAxisRep)[] };
}
interface BarLine {
  Name: ValueBox<string>;
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
interface RelDefinesLine {
  RelatedObjects: { expressID: number }[];
  RelatingPropertyDefinition: { expressID: number };
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
  return Array.from({ length: ids.size() }, (_, i) => ids.get(i));
}

function psetProps(pset: PsetLine): Record<string, string | number> {
  return Object.fromEntries(pset.HasProperties.map((p) => [p.Name.value, p.NominalValue.value]));
}

async function buildAndReopen(): Promise<{ written: SpikeModelResult; reader: IfcAPI; modelID: number }> {
  const writer = await createIfcApi();
  const written = buildSpikeModel(writer, { wall: SPIKE_WALL, bar: SPIKE_BAR });
  writer.CloseModel(written.modelID);
  const reader = await createIfcApi();
  const modelID = reader.OpenModel(written.bytes);
  return { written, reader, modelID };
}

describe('web-ifc lazy loader (M2 T1)', () => {
  it('initializes web-ifc and shares one app-wide instance', async () => {
    const first = loadIfcApi();
    const second = loadIfcApi();
    expect(second).toBe(first);
    const api = await first;
    const modelID = api.CreateModel({ schema: 'IFC4' });
    expect(api.GetModelSchema(modelID)).toBe('IFC4');
    api.CloseModel(modelID);
  });
});

describe('IFC write-capability spike — §D.4 decision gate (M2 T1)', () => {
  it('saves a valid IFC4 SPF file containing the wall, bar and intent psets', async () => {
    const writer = await createIfcApi();
    const written = buildSpikeModel(writer, { wall: SPIKE_WALL, bar: SPIKE_BAR });
    writer.CloseModel(written.modelID);
    const text = new TextDecoder().decode(written.bytes);
    expect(text.startsWith('ISO-10303-21;')).toBe(true);
    expect(text).toContain("FILE_SCHEMA(('IFC4'))");
    // web-ifc's default header names the IFC2X3 MVD even for IFC4 files — we
    // override it with the actual IFC4 MVD (strict readers flag the mismatch).
    expect(text).toContain('ViewDefinition [ReferenceView]');
    expect(text).toContain('IFCWALLSTANDARDCASE');
    expect(text).toContain('IFCREINFORCINGBAR');
    expect(text).toContain('IFCSWEPTDISKSOLID');
    expect(text).toContain('Pset_WebRebar_Wall');
    expect(text).toContain('Pset_WebRebar_ReinforcingBar');
  });

  it('gate criterion (i): entities, structure and intent properties survive save/load', async () => {
    const { reader, modelID } = await buildAndReopen();
    const req: ReadRequest = { api: reader, modelID };
    expect(reader.GetModelSchema(modelID)).toBe('IFC4');
    expect(lineIds({ ...req, type: IFCWALLSTANDARDCASE })).toHaveLength(1);
    expect(lineIds({ ...req, type: IFCREINFORCINGBAR })).toHaveLength(1);
    expect(lineIds({ ...req, type: IFCPROPERTYSET })).toHaveLength(2);
    expect(lineIds({ ...req, type: IFCRELDEFINESBYPROPERTIES })).toHaveLength(2);
    expect(lineIds({ ...req, type: IFCRELCONTAINEDINSPATIALSTRUCTURE })).toHaveLength(1);
    expect(lineIds({ ...req, type: IFCMATERIALLAYERSETUSAGE })).toHaveLength(1);
    expect(lineIds({ ...req, type: IFCRELASSOCIATESMATERIAL })).toHaveLength(1);

    const wall = getFlattened<WallLine>({
      ...req,
      expressID: lineIds({ ...req, type: IFCWALLSTANDARDCASE })[0],
    });
    expect(wall.Tag.value).toBe(SPIKE_WALL.id);

    const bar = getFlattened<BarLine>({ ...req, expressID: lineIds({ ...req, type: IFCREINFORCINGBAR })[0] });
    expect(bar.SteelGrade.value).toBe(SPIKE_BAR.steelGrade);

    const psets = lineIds({ ...req, type: IFCPROPERTYSET }).map((expressID) =>
      getFlattened<PsetLine>({ ...req, expressID }),
    );
    const wallPset = psets.find((p) => p.Name.value === 'Pset_WebRebar_Wall');
    const barPset = psets.find((p) => p.Name.value === 'Pset_WebRebar_ReinforcingBar');
    expect(psetProps(wallPset as PsetLine)).toEqual({ WebRebarId: SPIKE_WALL.id });
    expect(psetProps(barPset as PsetLine)).toEqual({
      WebRebarId: SPIKE_BAR.id,
      HostElementId: SPIKE_BAR.hostElementId,
      CoverDistance: SPIKE_BAR.coverDistance,
      SteelGrade: SPIKE_BAR.steelGrade,
    });

    const rels = lineIds({ ...req, type: IFCRELDEFINESBYPROPERTIES }).map((expressID) =>
      getFlattened<RelDefinesLine>({ ...req, expressID }),
    );
    const barExpressId = lineIds({ ...req, type: IFCREINFORCINGBAR })[0];
    const barRel = rels.find((r) => r.RelatedObjects[0].expressID === barExpressId);
    expect(barRel).toBeDefined();

    // The IfcWallStandardCase material convention (Allplan import requirement).
    const wallExpressId = lineIds({ ...req, type: IFCWALLSTANDARDCASE })[0];
    const materialRel = getFlattened<RelAssociatesMaterialLine>({
      ...req,
      expressID: lineIds({ ...req, type: IFCRELASSOCIATESMATERIAL })[0],
    });
    expect(materialRel.RelatedObjects[0].expressID).toBe(wallExpressId);
    expect(materialRel.RelatingMaterial.ForLayerSet.MaterialLayers[0].LayerThickness.value).toBe(
      SPIKE_WALL.thickness,
    );
    reader.CloseModel(modelID);
  });

  it('gate criterion (ii): geometry doubles survive within 1e-6 mm (in fact exactly)', async () => {
    const { reader, modelID } = await buildAndReopen();
    const req: ReadRequest = { api: reader, modelID };

    const wall = getFlattened<WallLine>({
      ...req,
      expressID: lineIds({ ...req, type: IFCWALLSTANDARDCASE })[0],
    });
    const location = wall.ObjectPlacement.RelativePlacement.Location.Coordinates.map((c) => c.value);
    expect(location).toEqual([SPIKE_WALL.startPoint.x, SPIKE_WALL.baseElevation, SPIKE_WALL.startPoint.z]);

    // IfcWallStandardCase carries TWO representations: 'Axis' (reference line)
    // + 'Body' (extrusion) — the Axis one is an Allplan import requirement.
    const reps = wall.Representation.Representations;
    expect(reps.map((r) => r.RepresentationIdentifier.value).sort()).toEqual(['Axis', 'Body']);
    const bodyRep = reps.find((r) => r.RepresentationIdentifier.value === 'Body') as WallBodyRep;
    const solid = bodyRep.Items[0];
    expect(solid.SweptArea.XDim.value).toBe(4000); // |end - start|
    expect(solid.SweptArea.YDim.value).toBe(SPIKE_WALL.thickness);
    expect(solid.Depth.value).toBe(SPIKE_WALL.height);
    const axisRep = reps.find((r) => r.RepresentationIdentifier.value === 'Axis') as WallAxisRep;
    const axisPoints = axisRep.Items[0].Points.map((p) => p.Coordinates.map((c) => c.value));
    expect(axisPoints).toEqual([
      [0, 0],
      [4000, 0],
    ]);

    const bar = getFlattened<BarLine>({ ...req, expressID: lineIds({ ...req, type: IFCREINFORCINGBAR })[0] });
    expect(bar.NominalDiameter.value).toBe(SPIKE_BAR.diameter);
    const sweptDisk = bar.Representation.Representations[0].Items[0];
    expect(sweptDisk.Radius.value).toBe(SPIKE_BAR.diameter / 2);
    const points = sweptDisk.Directrix.Points.map((p) => p.Coordinates.map((c) => c.value));
    expect(points).toEqual(SPIKE_BAR.path.map((v) => [v.x, v.y, v.z]));

    reader.CloseModel(modelID);
  });

  it('gate criterion (iii) artifact: writes the spike file for the author to open in an external viewer', async () => {
    const writer = await createIfcApi();
    const written = buildSpikeModel(writer, { wall: SPIKE_WALL, bar: SPIKE_BAR });
    writer.CloseModel(written.modelID);
    mkdirSync(SPIKE_ARTIFACT_DIR, { recursive: true });
    writeFileSync(SPIKE_ARTIFACT_FILE, written.bytes);
    // 3.8 kB for the full boilerplate + wall + bar + psets — IFC-SPF stays tiny
    // at our model subset; the heavy part of web-ifc is its 1.3 MB WASM asset.
    expect(written.bytes.length).toBeGreaterThan(1000);
    expect(written.bytes.length).toBeLessThan(10000);
  });
});
