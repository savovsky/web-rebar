// T8 — M2 acceptance pass (Architecture Spec §A revised 2026-08-09, amended
// 2026-08-18 — Q7): the FOUR milestone sentences as durable headless tests,
// mirroring M0 T11 / M1 T6. Restated from the task-level suites ("restate,
// don't reinvent" — the T6.5/T7 findings): (1) the IFC round-trip
// identical-model sentence (T3's import-ifc.test.ts) incl. a bent-bar case
// and the undo behavior of import; (2) DXF import of a SYNTHETIC fixture
// built to mimic the real-file features — cm units, nested blocks, bulges
// (T5's adapter/command suites; the fixture lives in dxf-test-fixtures.ts);
// (3) DXF export exactness (T7's export-section-dxf.test.ts) — the export is
// AUTHOR-VERIFIED in Allplan 2022: the ODA/Teigha kernel needed the full
// R2000 ownership/handle graph, so the structure assertions pinning that
// graph stay; (4) the Q7 reference-solids sentence (T6.5's import-ifc
// tests). The rule-by-rule audit lives in the T8 task log (verdict table);
// the undo-per-command row is enforced by the registry-completeness probe in
// m1-acceptance.test.ts (all 19 commands — a new command fails it until its
// undo behavior is decided). Cut bars cross the real WASM boundary
// (initWasmFromDisk).
import { beforeAll, describe, expect, it } from 'vitest';
import {
  createSection,
  exportIfc,
  exportSectionDxf,
  importIfcModel,
  importReferenceDocument,
  placeBar,
  placeWall,
  redo,
  undo,
} from '@/commands';
import type { LineworkReferenceDocument, ReferenceDocument } from '@/data/models';
import { selectSectionPrimitives } from '@/engine/sectioning';
import { initWasmFromDisk } from '@/engine/wasm-test-init';
import { importDxfReference } from '@/io/dxf-adapter';
import {
  SYNTHETIC_REAL_FILE_DXF,
  entityGroups,
  entityGroupsAll,
  parseGroups,
  totalSkips,
  valueOf,
  valuesOf,
} from '@/io/dxf-test-fixtures';
import { FOREIGN_SOLIDS, buildForeignSolidsBytes } from '@/io/ifc-test-fixtures';
import { createIfcApi } from '@/io/web-ifc-loader';
import { createAppStore } from '@/stores';
import { sortedBarMarks, stripBarMarks } from './test-utils';

beforeAll(initWasmFromDisk);

/** The §A fixture: one wall + one bent bar at the 25 mm catalog cover. */
const WALL = {
  startPoint: { x: 0, y: 0, z: 0 },
  endPoint: { x: 4000, y: 0, z: 0 },
  thickness: 200,
  height: 2800,
};
const ELEVATED_WALL = { ...WALL, baseElevation: 3000 };
const BENT_BAR_PATH = [
  { x: 500, y: 87, z: 700 },
  { x: 3500, y: 87, z: 700 },
  { x: 3500, y: 87, z: 1400 },
];

/** Perpendicular cut at x=2000 looking +X (u runs along −y). */
const SECTION = (wallId: string) => ({
  name: 'S-1',
  lineStart: { x: 2000, y: -500, z: 0 },
  lineEnd: { x: 2000, y: 500, z: 0 },
  depthPoint: { x: 4500, y: 0, z: 0 },
  targetElementIds: [wallId],
});

function asLinework(document: ReferenceDocument): LineworkReferenceDocument {
  if (document.content !== 'linework') throw new Error('expected a linework document');
  return document;
}

describe('sentence 1 — IFC round-trip: model → exportIfc → importIfcModel → identical model', () => {
  it('a command-built model (wall + bent bar at 25 mm cover) round-trips EXACTLY (ids, geometry, intent); the import is exactly ONE undo level with exact undo/redo restore', async () => {
    const source = createAppStore();
    const wallId = source.dispatch(placeWall(WALL));
    source.dispatch(placeWall(ELEVATED_WALL));
    source.dispatch(placeBar({ hostElementId: wallId, diameter: 12, path: BENT_BAR_PATH }));
    source.dispatch(placeBar({ hostElementId: wallId, diameter: 16, path: BENT_BAR_PATH.slice(0, 2) }));
    const { bytes } = await source.dispatch(exportIfc());
    const sourceProject = source.getState().project;

    const target = createAppStore();
    const preImport = target.getState().project;
    const summary = await target.dispatch(importIfcModel({ buffer: bytes }));

    expect(summary.importedWalls).toBe(2);
    expect(summary.importedBars).toBe(2);
    expect(summary.skipped).toEqual({ missingIntentPset: 0, unsupportedElements: 0 });
    // Identical model (metadata/sections excluded per the §A definition): ids
    // via GlobalId decode, geometry EXACT (T1 proved SPF doubles round-trip
    // exactly), design intent (coverDistance, hostElementId, steelGrade,
    // diameter) exactly equal. barMark (M3 T1, plan Q7 — assigned identity,
    // never in IFC) is normalized out like metadata; the assignment must be
    // a complete bijection, asserted via sortedBarMarks.
    const imported = target.getState().project;
    expect(imported.elements).toEqual(sourceProject.elements);
    expect(stripBarMarks(imported.reinforcement)).toEqual(stripBarMarks(sourceProject.reinforcement));
    expect(sortedBarMarks(imported.reinforcement)).toEqual([1, 2]);

    // Exactly ONE undo level per import (Q4-a — the async command scope);
    // undo restores the exact pre-import reference, redo re-applies it.
    const postImport = target.getState().project;
    expect(postImport).not.toBe(preImport);
    expect(target.getState().undo.past).toHaveLength(1);
    target.dispatch(undo());
    expect(target.getState().project).toBe(preImport);
    target.dispatch(redo());
    expect(target.getState().project).toBe(postImport);
  });
});

describe('sentence 2 — DXF import: synthetic real-file fixture → the expected ReferenceDocument', () => {
  it('cm units, nested blocks and a bulge map to exact mm primitives; ONE document, ONE undo level, exact undo/redo restore', async () => {
    const store = createAppStore();
    const preImport = store.getState().project;

    const summary = await store.dispatch(
      importReferenceDocument({ text: SYNTHETIC_REAL_FILE_DXF, fileName: 'synthetic-architect.dxf' }),
    );

    // Q4: declared cm honored (×10 to model mm) — the KOMO fixtures' units.
    expect(summary).toMatchObject({
      name: 'synthetic-architect.dxf',
      primitiveCount: 4,
      appliedInsunits: 5,
      scaleToMm: 10,
      unitsAssumed: false,
    });
    expect(summary.skipped.unsupportedEntities.TEXT).toBe(1); // nothing silently lost

    const document = asLinework(store.getState().project.referenceDocuments[summary.documentId]);
    expect(document.name).toBe('synthetic-architect.dxf');
    expect(document.source).toEqual({ kind: 'dxf', fileName: 'synthetic-architect.dxf', insunits: 5 });
    expect(document.elevationMm).toBe(0);
    expect(document.visible).toBe(true);

    expect(document.primitives).toHaveLength(4);
    // Top-level line, cm → mm.
    expect(document.primitives[0]).toEqual({
      kind: 'line',
      start: { x: 10, y: 10 },
      end: { x: 20, y: 10 },
      sourceLayer: 'WALLS',
    });
    // Bulge 1 from (0,0) to (2,0): lower semicircle, center (1,0) r 1 → ×10.
    const arc = document.primitives[1];
    if (arc.kind !== 'arc') throw new Error(`expected an arc primitive, got ${arc.kind}`);
    expect(arc.sourceLayer).toBe('0');
    expect(arc.center.x).toBeCloseTo(10);
    expect(arc.center.y).toBeCloseTo(0);
    expect(arc.radius).toBeCloseTo(10);
    expect(arc.startAngle).toBeCloseTo(Math.PI);
    expect(arc.endAngle).toBeCloseTo(0);
    // NESTED blocks: OUTER at (100,0) → its line (0,0)-(2,0) → mm
    // (1000,0)-(1020,0); INNER at (10,0) inside OUTER → its line (0,0)-(1,0)
    // → mm (1100,0)-(1110,0). Block content on layer '0' inherits MARKS.
    expect(document.primitives[2]).toEqual({
      kind: 'line',
      start: { x: 1000, y: 0 },
      end: { x: 1020, y: 0 },
      sourceLayer: 'MARKS',
    });
    expect(document.primitives[3]).toEqual({
      kind: 'line',
      start: { x: 1100, y: 0 },
      end: { x: 1110, y: 0 },
      sourceLayer: 'MARKS',
    });

    // ONE document = ONE undo level; undo restores the exact pre-import
    // reference, redo re-applies it.
    const postImport = store.getState().project;
    expect(postImport).not.toBe(preImport);
    expect(store.getState().undo.past).toHaveLength(1);
    store.dispatch(undo());
    expect(store.getState().project).toBe(preImport);
    store.dispatch(redo());
    expect(store.getState().project).toBe(postImport);
  });
});

// Sentence 3's structure pin: the export is AUTHOR-VERIFIED in Allplan 2022
// (T7 iteration 2 — the ODA/Teigha kernel requires the complete R2000
// ownership/handle graph), so these assertions keep the graph load-bearing.
describe('sentence 3 — DXF export of the active section: exact 1:1 mm geometry on the verified R2000 structure', () => {
  const buildStore = () => {
    const store = createAppStore();
    const wallId = store.dispatch(placeWall(WALL));
    store.dispatch(
      placeBar({
        hostElementId: wallId,
        diameter: 12,
        path: [
          { x: 0, y: 87, z: 700 },
          { x: 4000, y: 87, z: 700 },
        ],
      }),
    );
    const sectionId = store.dispatch(createSection(SECTION(wallId)));
    return { store, sectionId };
  };

  it('the exported file reimports through our own importer with EXACT geometry (outline == selectSectionPrimitives, dot radius == Ø/2, no flip) and zero skips', async () => {
    const { store, sectionId } = buildStore();
    const expected = selectSectionPrimitives(store.getState(), sectionId);
    if (expected === null) throw new Error('expected primitives for a known section');

    const { text } = await store.dispatch(exportSectionDxf({ sectionId }));
    const result = importDxfReference(text);
    expect(result.appliedInsunits).toBe(4); // true 1:1 mm model space
    expect(result.unitsAssumed).toBe(false);
    expect(totalSkips(result.skipped)).toBe(0);

    const polylines = result.primitives.filter((primitive) => primitive.kind === 'polyline');
    const circles = result.primitives.filter((primitive) => primitive.kind === 'circle');

    // The wall outline: exact coordinates, u→x / v→y (no flip).
    expect(polylines).toHaveLength(expected.concreteOutlines.length);
    expected.concreteOutlines.forEach((outline, index) => {
      const reimported = polylines[index];
      if (reimported.kind !== 'polyline') throw new Error('unreachable');
      outline.forEach((point, pointIndex) => {
        expect(reimported.points[pointIndex].x).toBeCloseTo(point.u, 9);
        expect(reimported.points[pointIndex].y).toBeCloseTo(point.v, 9);
      });
    });
    const outline = polylines[0];
    if (outline.kind !== 'polyline') throw new Error('unreachable');
    const xs = outline.points.map((point) => point.x);
    const ys = outline.points.map((point) => point.y);
    expect(Math.max(...xs) - Math.min(...xs)).toBeCloseTo(200); // true thickness
    expect(Math.max(...ys) - Math.min(...ys)).toBeCloseTo(2800); // true height

    // The cut dot: Ø12 → a 12 mm circle (§M.4 true relative diameters).
    expect(expected.cutBars).toHaveLength(1);
    expect(circles).toHaveLength(1);
    const dot = circles[0];
    if (dot.kind !== 'circle') throw new Error('unreachable');
    expect(dot.radius).toBeCloseTo(6, 9);
    expect(dot.center.x).toBeCloseTo(expected.cutBars[0].center.u, 9);
    expect(dot.center.y).toBeCloseTo(expected.cutBars[0].center.v, 9);
  });

  it('keeps the full R2000 ownership/handle graph the ODA/Teigha kernel requires (the Allplan 2022 verification)', async () => {
    const { store, sectionId } = buildStore();
    const { text } = await store.dispatch(exportSectionDxf({ sectionId }));
    const groups = parseGroups(text);

    // CRLF terminators; $ACADVER AC1015 (R2000); $INSUNITS=4 (mm); $HANDSEED.
    expect(text.endsWith('\r\n')).toBe(true);
    expect(text.replaceAll('\r\n', '')).not.toContain('\n');
    const acadver = groups.findIndex((group) => group.value === '$ACADVER');
    expect(groups[acadver + 1]).toEqual({ code: 1, value: 'AC1015' });
    const insunits = groups.findIndex((group) => group.value === '$INSUNITS');
    expect(groups[insunits + 1]).toEqual({ code: 70, value: '4' });
    expect(groups.some((group) => group.value === '$HANDSEED')).toBe(true);
    expect(groups[groups.length - 1]).toEqual({ code: 0, value: 'EOF' });

    // The three Q5 layers with mm lineweights from the plot seed; background
    // DASHED at the layer level (6 on / 3 off in model mm).
    const layers = entityGroupsAll(groups, 'LAYER');
    expect(layers.map((entry) => valueOf(entry, 2))).toEqual([
      '0',
      'WEBREBAR-CONCRETE',
      'WEBREBAR-REBAR',
      'WEBREBAR-BACKGROUND',
    ]);
    expect(valueOf(layers[1], 370)).toBe('50'); // 0.50 mm
    expect(valueOf(layers[2], 370)).toBe('35'); // 0.35 mm
    expect(valueOf(layers[3], 370)).toBe('18'); // 0.18 mm
    expect(valueOf(layers[3], 6)).toBe('DASHED');
    const dashed = entityGroups(groups, { typeName: 'LTYPE', occurrence: 3 });
    expect(valueOf(dashed, 2)).toBe('DASHED');
    expect(valuesOf(dashed, 49)).toEqual(['6.0', '-3.0']);

    // The ownership graph: every entity carries a unique hex handle (group 5)
    // and a 330 owner ref to *Model_Space (1F).
    const entities = [
      ...entityGroupsAll(groups, 'LWPOLYLINE'),
      ...entityGroupsAll(groups, 'CIRCLE'),
      ...entityGroupsAll(groups, 'LINE'),
    ];
    expect(entities.length).toBeGreaterThan(0);
    for (const entity of entities) {
      expect(valueOf(entity, 5)).toMatch(/^[0-9A-F]+$/);
      expect(valueOf(entity, 330)).toBe('1F');
    }
    const handles = entities.map((entity) => valueOf(entity, 5) as string);
    expect(new Set(handles).size).toBe(handles.length);

    // BLOCK_RECORD table (*Model_Space + *Paper_Space → their layouts), the
    // BLOCKS section with matching BLOCK/ENDBLK pairs, and the OBJECTS
    // section (root dictionary + the four named dictionaries + 2 layouts).
    const records = entityGroupsAll(groups, 'BLOCK_RECORD');
    expect(records.map((record) => valueOf(record, 2))).toEqual(['*Model_Space', '*Paper_Space']);
    expect(valueOf(records[0], 340)).toBe('22'); // → the Model layout
    expect(valueOf(records[1], 340)).toBe('24'); // → the Layout1 layout
    expect(entityGroupsAll(groups, 'BLOCK')).toHaveLength(2);
    expect(entityGroupsAll(groups, 'ENDBLK')).toHaveLength(2);
    const root = entityGroupsAll(groups, 'DICTIONARY').find((d) => valueOf(d, 5) === 'C');
    expect(root).toBeDefined();
    expect(valuesOf(root ?? [], 3)).toEqual(
      expect.arrayContaining(['ACAD_GROUP', 'ACAD_LAYOUT', 'ACAD_PLOTSETTINGS', 'ACAD_PLOTSTYLENAME']),
    );
    expect(entityGroupsAll(groups, 'LAYOUT')).toHaveLength(2);
  });
});

describe('sentence 4 — IFC reference solids (Q7)', () => {
  it('a foreign file (geometry, no intent psets) imports as ONE reference document with solids + ZERO editable entities + exactly ONE undo level', async () => {
    const api = await createIfcApi();
    const { bytes } = buildForeignSolidsBytes(api);
    const store = createAppStore();
    const preImport = store.getState().project;

    const summary = await store.dispatch(importIfcModel({ buffer: bytes, fileName: 'foreign-steel.ifc' }));

    expect(summary.importedWalls).toBe(0);
    expect(summary.importedBars).toBe(0);
    expect(summary.reference).toMatchObject({
      products: 2, // wall + proxy; the opening is excluded
      parts: 2,
      triangles: FOREIGN_SOLIDS.trianglesPerBox * 2,
      lengthUnitAssumed: false,
    });
    expect(summary.skipped).toEqual({ missingIntentPset: 0, unsupportedElements: 1 });

    const documents = Object.values(store.getState().project.referenceDocuments);
    expect(documents).toHaveLength(1);
    const [document] = documents;
    expect(document.id).toBe(summary.reference?.documentId);
    expect(document.source).toEqual({ kind: 'ifc', fileName: 'foreign-steel.ifc' });
    expect(document.content).toBe('solids');
    if (document.content !== 'solids') throw new Error('expected a solids document');
    expect(document.solids).toHaveLength(2);
    expect(document.solids[0].positions).toBeInstanceOf(Float32Array);
    expect(document.solids[0].indices).toBeInstanceOf(Uint32Array);

    // ONE undo level for the whole import; undo restores the exact pre-import
    // reference (typed arrays shared by reference); redo re-applies.
    expect(store.getState().undo.past).toHaveLength(1);
    store.dispatch(undo());
    expect(store.getState().project).toBe(preImport);
    store.dispatch(redo());
    expect(Object.keys(store.getState().project.referenceDocuments)).toHaveLength(1);
  });

  it('our OWN export imports as editable entities with NO reference document', async () => {
    const source = createAppStore();
    const wallId = source.dispatch(placeWall(WALL));
    source.dispatch(placeBar({ hostElementId: wallId, diameter: 12, path: BENT_BAR_PATH }));
    const { bytes } = await source.dispatch(exportIfc());

    const target = createAppStore();
    const summary = await target.dispatch(importIfcModel({ buffer: bytes }));
    expect(summary.importedWalls).toBe(1);
    expect(summary.importedBars).toBe(1);
    expect(summary.reference).toBeNull();
    expect(target.getState().project.referenceDocuments).toEqual({});
  });
});
