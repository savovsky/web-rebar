// M2 T7 — DXF section export writer (plan §7, Q5). Text-level exactness
// (group-code pairs, exact coordinate strings, layer/linetype/INSUNITS
// assertions) + the reimport-fidelity probe: the T5 importer reads the T7
// export back — the round-trip class that caught real bugs in T2/T3.
// Iteration 1 (2026-08-18): the writer follows AutoCAD's own conventions
// (CRLF, subclass markers, ByBlock/ByLayer, layer "0", STYLE Standard,
// decimal-point floats, padded integers, header extents) after Allplan 2022's
// AutoCAD-data import rejected the schema-minimal first file.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { SectionPrimitives } from '@/engine/sectioning';
import {
  DXF_LAYER_BACKGROUND,
  DXF_LAYER_CONCRETE,
  DXF_LAYER_REBAR,
  exportDxfSection,
  importDxfReference,
} from './dxf-adapter';
import type { DxfImportSkips } from './dxf-adapter';

interface DxfGroup {
  code: number;
  value: string;
}

/** Minimal group-pair reader for text-level assertions (the real parser is
 *  dxf-parser — exercised by the reimport probe below). */
function parseGroups(text: string): DxfGroup[] {
  const lines = text.split('\n');
  const groups: DxfGroup[] = [];
  for (let i = 0; i + 1 < lines.length; i += 2) {
    groups.push({ code: Number(lines[i].trim()), value: lines[i + 1].trim() });
  }
  return groups;
}

/** The groups of one entity/entry starting at its 0-marker (up to the next). */
function entityGroups(groups: DxfGroup[], query: { typeName: string; occurrence?: number }): DxfGroup[] {
  const { typeName, occurrence = 0 } = query;
  const startIndexes = groups
    .map((group, index) => (group.code === 0 && group.value === typeName ? index : -1))
    .filter((index) => index >= 0);
  const start = startIndexes[occurrence];
  if (start === undefined) throw new Error(`entity not found: ${typeName} #${occurrence}`);
  let end = groups.length;
  for (let i = start + 1; i < groups.length; i += 1) {
    if (groups[i].code === 0) {
      end = i;
      break;
    }
  }
  return groups.slice(start, end);
}

/** All occurrences of an entity/entry type, in file order. */
function entityGroupsAll(groups: DxfGroup[], typeName: string): DxfGroup[][] {
  const count = groups.filter((group) => group.code === 0 && group.value === typeName).length;
  return Array.from({ length: count }, (_, occurrence) => entityGroups(groups, { typeName, occurrence }));
}

const valueOf = (groups: DxfGroup[], code: number): string | undefined =>
  groups.find((group) => group.code === code)?.value;

const valuesOf = (groups: DxfGroup[], code: number): string[] =>
  groups.filter((group) => group.code === code).map((group) => group.value);

/** The file path of the artifact the author opens in real CAD (the T1/T2
 *  artifact pattern). NOT under test-fixtures/dxf/ — that dir is globbed by
 *  the real-file import probe (a 5-primitive file would break its census). */
const EXPORT_ARTIFACT_DIR = fileURLToPath(new URL('../../docs/test-fixtures/dxf-export/', import.meta.url));
const EXPORT_ARTIFACT_FILE = join(EXPORT_ARTIFACT_DIR, 'm2-t7-section.dxf');

function totalSkips(skipped: DxfImportSkips): number {
  const structural =
    skipped.paperSpaceEntities +
    skipped.unresolvedInserts +
    skipped.cyclicInserts +
    skipped.depthCappedInserts +
    skipped.cappedArrayInserts +
    skipped.nonUniformScaledCurves +
    skipped.tiltedCurves +
    skipped.degenerateSegments;
  return Object.values(skipped.unsupportedEntities).reduce((sum, count) => sum + count, structural);
}

/** Two outlines, two dots (one with a float-awkward center), one dashed
 *  background LINE and one 3-point background polyline. */
const PRIMITIVES: SectionPrimitives = {
  concreteOutlines: [
    [
      { u: -100, v: 0 },
      { u: 100, v: 0 },
      { u: 100, v: 2800 },
      { u: -100, v: 2800 },
    ],
    [
      { u: -450, v: 3000 },
      { u: -150, v: 3000 },
      { u: -150, v: 5800 },
      { u: -450, v: 5800 },
    ],
  ],
  cutBars: [
    { center: { u: -69, v: 700 }, diameterMm: 12 },
    { center: { u: 31.000000000000004, v: 1400 }, diameterMm: 16 },
  ],
  backgroundLines: [
    [
      { u: -50, v: 0 },
      { u: -50, v: 2800 },
    ],
    [
      { u: 0, v: 100 },
      { u: 40, v: 100 },
      { u: 40, v: 200 },
    ],
  ],
};

const EMPTY_PRIMITIVES: SectionPrimitives = {
  concreteOutlines: [],
  cutBars: [],
  backgroundLines: [],
};

describe('exportDxfSection — HEADER / TABLES (Q5)', () => {
  const text = exportDxfSection(PRIMITIVES);
  const groups = parseGroups(text);

  it('uses CRLF line endings (the DXF terminator — the iteration-1 Allplan fix)', () => {
    expect(text.endsWith('\r\n')).toBe(true);
    expect(text.replaceAll('\r\n', '')).not.toContain('\n');
  });

  it('writes $ACADVER AC1015 (R2000: LWPOLYLINE + lineweight support) and $INSUNITS=4 (mm)', () => {
    const acadver = groups.findIndex((group) => group.value === '$ACADVER');
    expect(groups[acadver + 1]).toEqual({ code: 1, value: 'AC1015' });
    const insunits = groups.findIndex((group) => group.value === '$INSUNITS');
    expect(groups[insunits + 1]).toEqual({ code: 70, value: '4' });
    expect(groups[groups.length - 1]).toEqual({ code: 0, value: 'EOF' });
  });

  it('writes the header context vars: $DWGCODEPAGE, $INSBASE, and TRUE computed $EXTMIN/$EXTMAX/$LIMMIN/$LIMMAX', () => {
    const codepage = groups.findIndex((group) => group.value === '$DWGCODEPAGE');
    expect(groups[codepage + 1]).toEqual({ code: 3, value: 'ANSI_1252' });
    expect(groups.some((group) => group.value === '$INSBASE')).toBe(true);
    // Extents over ALL entities (circles include their radius): x −450…100,
    // y 0…5800 for the fixture primitives.
    const extmin = groups.findIndex((group) => group.value === '$EXTMIN');
    expect(groups[extmin + 1]).toEqual({ code: 10, value: '-450.0' });
    expect(groups[extmin + 2]).toEqual({ code: 20, value: '0.0' });
    expect(groups[extmin + 3]).toEqual({ code: 30, value: '0.0' });
    const extmax = groups.findIndex((group) => group.value === '$EXTMAX');
    expect(groups[extmax + 1]).toEqual({ code: 10, value: '100.0' });
    expect(groups[extmax + 2]).toEqual({ code: 20, value: '5800.0' });
    const limmin = groups.findIndex((group) => group.value === '$LIMMIN');
    expect(groups[limmin + 1]).toEqual({ code: 10, value: '-450.0' });
    const limmax = groups.findIndex((group) => group.value === '$LIMMAX');
    expect(groups[limmax + 2]).toEqual({ code: 20, value: '5800.0' });
  });

  it('declares ByBlock/ByLayer/Continuous + a DASHED linetype with the mm plot-seed pattern (all with subclass markers)', () => {
    const layerTypes = entityGroups(groups, { typeName: 'TABLE' });
    expect(valueOf(layerTypes, 70)).toBe('4');
    const names = entityGroupsAll(groups, 'LTYPE').map((entry) => valueOf(entry, 2));
    expect(names).toEqual(['ByBlock', 'ByLayer', 'Continuous', 'DASHED']);
    const dashed = entityGroups(groups, { typeName: 'LTYPE', occurrence: 3 });
    expect(valuesOf(dashed, 100)).toEqual(['AcDbSymbolTableRecord', 'AcDbLinetypeTableRecord']);
    expect(valueOf(dashed, 73)).toBe('2');
    expect(valueOf(dashed, 40)).toBe('9.0'); // 6 on + 3 off (mm, model space)
    expect(valuesOf(dashed, 49)).toEqual(['6.0', '-3.0']);
  });

  it('declares the mandatory layer "0" + the three Q5 layers with mm lineweights from the plot seed', () => {
    const entries = entityGroupsAll(groups, 'LAYER');
    expect(entries).toHaveLength(4);

    const zero = entries[0];
    expect(valueOf(zero, 2)).toBe('0');
    expect(valueOf(zero, 6)).toBe('Continuous');
    expect(valueOf(zero, 370)).toBe('-3'); // default lineweight (ByLayer)

    const concrete = entries[1];
    expect(valuesOf(concrete, 100)).toEqual(['AcDbSymbolTableRecord', 'AcDbLayerTableRecord']);
    expect(valueOf(concrete, 2)).toBe(DXF_LAYER_CONCRETE);
    expect(valueOf(concrete, 6)).toBe('Continuous');
    expect(valueOf(concrete, 370)).toBe('50'); // 0.50 mm (integer group)

    const rebar = entries[2];
    expect(valueOf(rebar, 2)).toBe(DXF_LAYER_REBAR);
    expect(valueOf(rebar, 370)).toBe('35'); // 0.35 mm

    // §G.2.3: background draws DASHED — at the LAYER level, entities stay ByLayer.
    const background = entries[3];
    expect(valueOf(background, 2)).toBe(DXF_LAYER_BACKGROUND);
    expect(valueOf(background, 6)).toBe('DASHED');
    expect(valueOf(background, 370)).toBe('18'); // 0.18 mm
  });

  it('declares a STYLE table with the "Standard" text style', () => {
    const style = entityGroups(groups, { typeName: 'STYLE' }); // the only STYLE entry
    expect(valuesOf(style, 100)).toEqual(['AcDbSymbolTableRecord', 'AcDbTextStyleTableRecord']);
    expect(valueOf(style, 2)).toBe('Standard');
    expect(valueOf(style, 3)).toBe('txt');
  });

  it('iteration 2: declares the BLOCK_RECORD table with *Model_Space + *Paper_Space owned by the table, each pointing at its layout', () => {
    const records = entityGroupsAll(groups, 'BLOCK_RECORD');
    expect(records).toHaveLength(2);
    const [model, paper] = records;
    expect(valueOf(model, 2)).toBe('*Model_Space');
    expect(valuesOf(model, 100)).toEqual(['AcDbSymbolTableRecord', 'AcDbBlockTableRecord']);
    expect(valueOf(model, 330)).toBe('1'); // owned by the BLOCK_RECORD table
    expect(valueOf(model, 340)).toBe('22'); // → the Model layout
    expect(valueOf(paper, 2)).toBe('*Paper_Space');
    expect(valueOf(paper, 67)).toBe('1'); // paper space flag
    expect(valueOf(paper, 340)).toBe('24'); // → the Layout1 layout
  });
});

describe('exportDxfSection — ownership graph (iteration 2: handles + 330 refs + BLOCKS + OBJECTS)', () => {
  const groups = parseGroups(exportDxfSection(PRIMITIVES));

  it('every object carries a hex handle (group 5) and a 330 owner ref; entities are owned by *Model_Space (1F)', () => {
    // Entities: each has a handle + owner 1F.
    const entities = [
      ...entityGroupsAll(groups, 'LWPOLYLINE'),
      ...entityGroupsAll(groups, 'CIRCLE'),
      ...entityGroupsAll(groups, 'LINE'),
    ];
    // 2 outlines + 1 background polyline (LWPOLYLINE), 2 dots (CIRCLE), 1 background LINE.
    expect(entities.length).toBe(6);
    for (const entity of entities) {
      expect(valueOf(entity, 5)).toMatch(/^[0-9A-F]+$/); // hex handle
      expect(valueOf(entity, 330)).toBe('1F'); // owned by *Model_Space
    }
    // Entity handles are unique and ascend.
    const handles = entities.map((entity) => valueOf(entity, 5) as string);
    expect(new Set(handles).size).toBe(handles.length);
  });

  it('writes the BLOCKS section with one BLOCK/ENDBLK pair per BLOCK_RECORD (*Model_Space + *Paper_Space)', () => {
    const blocks = entityGroupsAll(groups, 'BLOCK');
    const endblks = entityGroupsAll(groups, 'ENDBLK');
    expect(blocks).toHaveLength(2);
    expect(endblks).toHaveLength(2);
    expect(valuesOf(blocks[0], 100)).toEqual(['AcDbEntity', 'AcDbBlockBegin']);
    expect(valueOf(blocks[0], 2)).toBe('*Model_Space');
    expect(valueOf(blocks[0], 330)).toBe('1F'); // owned by its BLOCK_RECORD
    expect(valuesOf(blocks[1], 100)).toEqual(['AcDbEntity', 'AcDbBlockBegin']);
    expect(valueOf(blocks[1], 2)).toBe('*Paper_Space');
    expect(valueOf(blocks[1], 67)).toBe('1'); // paper space
    expect(valuesOf(endblks[0], 100)).toEqual(['AcDbEntity', 'AcDbBlockEnd']);
  });

  it('writes the OBJECTS section: root dictionary + named dictionaries + Model/Layout1 layouts, all handle-linked', () => {
    // Root dictionary C, owned by 0, names the four named-object dictionaries.
    const dictionaries = entityGroupsAll(groups, 'DICTIONARY');
    const root = dictionaries.find((d) => valueOf(d, 5) === 'C');
    expect(root).toBeDefined();
    expect(valueOf(root as DxfGroup[], 330)).toBe('0');
    const rootNames = valuesOf(root as DxfGroup[], 3);
    expect(rootNames).toEqual(
      expect.arrayContaining(['ACAD_GROUP', 'ACAD_LAYOUT', 'ACAD_PLOTSETTINGS', 'ACAD_PLOTSTYLENAME']),
    );
    // Layouts: Model (tab 1, block-record 1F) and Layout1 (tab 2, block-record D6).
    const layouts = entityGroupsAll(groups, 'LAYOUT');
    expect(layouts).toHaveLength(2);
    // A layout has TWO code-1 values (page-setup name '', then the layout
    // name) — find by membership, not first-match.
    const model = layouts.find((l) => valuesOf(l, 1).includes('Model')) as DxfGroup[];
    expect(model).toBeDefined();
    expect(valuesOf(model, 100)).toContain('AcDbLayout');
    expect(valueOf(model, 71)).toBe('1'); // tab order
    expect(valuesOf(model, 330)).toContain('1A'); // owned by ACAD_LAYOUT dict
    // the layout's LAST 330 (its block-record ref) is 1F
    expect(valuesOf(model, 330).pop()).toBe('1F');
    const paper = layouts.find((l) => valuesOf(l, 1).includes('Layout1')) as DxfGroup[];
    expect(valueOf(paper, 71)).toBe('2');
    expect(valuesOf(paper, 330).pop()).toBe('D6');
  });

  it('writes $HANDSEED and the header context vars', () => {
    const handseed = groups.findIndex((group) => group.value === '$HANDSEED');
    expect(handseed).toBeGreaterThan(0);
    expect(groups[handseed + 1].code).toBe(5);
    expect(groups.some((group) => group.value === '$CLAYER')).toBe(true);
    expect(groups.some((group) => group.value === '$TEXTSTYLE')).toBe(true);
    expect(groups.some((group) => group.value === '$LTSCALE')).toBe(true);
  });
});

describe('exportDxfSection — ENTITIES (exact coordinates, no flip: u→x, v→y)', () => {
  const groups = parseGroups(exportDxfSection(PRIMITIVES));

  it('writes each concrete outline as a closed LWPOLYLINE with exact vertex coordinates', () => {
    const outline = entityGroups(groups, { typeName: 'LWPOLYLINE' });
    expect(valuesOf(outline, 100)).toEqual(['AcDbEntity', 'AcDbPolyline']);
    expect(valueOf(outline, 8)).toBe(DXF_LAYER_CONCRETE);
    expect(valueOf(outline, 90)).toBe('4');
    expect(valueOf(outline, 70)).toBe('1'); // closed
    const xs = outline.filter((group) => group.code === 10).map((group) => group.value);
    const ys = outline.filter((group) => group.code === 20).map((group) => group.value);
    expect(xs).toEqual(['-100.0', '100.0', '100.0', '-100.0']);
    expect(ys).toEqual(['0.0', '0.0', '2800.0', '2800.0']);

    const second = entityGroups(groups, { typeName: 'LWPOLYLINE', occurrence: 1 });
    expect(valueOf(second, 8)).toBe(DXF_LAYER_CONCRETE);
    expect(valueOf(second, 70)).toBe('1');
    const secondYs = second.filter((group) => group.code === 20).map((group) => group.value);
    expect(secondYs).toEqual(['3000.0', '3000.0', '5800.0', '5800.0']);
  });

  it('writes each cut bar as a true-diameter CIRCLE at the exact center (§M.4)', () => {
    const dot = entityGroups(groups, { typeName: 'CIRCLE' });
    expect(valuesOf(dot, 100)).toEqual(['AcDbEntity', 'AcDbCircle']);
    expect(valueOf(dot, 8)).toBe(DXF_LAYER_REBAR);
    expect(valueOf(dot, 10)).toBe('-69.0');
    expect(valueOf(dot, 20)).toBe('700.0');
    expect(valueOf(dot, 40)).toBe('6.0'); // Ø12 → radius 6 mm

    const awkward = entityGroups(groups, { typeName: 'CIRCLE', occurrence: 1 });
    expect(valueOf(awkward, 10)).toBe('31.000000000000004'); // shortest round-trip repr
    expect(valueOf(awkward, 40)).toBe('8.0'); // Ø16 → radius 8 mm
  });

  it('writes 2-point background as LINE and longer runs as open LWPOLYLINE, on the dashed layer', () => {
    const line = entityGroups(groups, { typeName: 'LINE' });
    expect(valuesOf(line, 100)).toEqual(['AcDbEntity', 'AcDbLine']);
    expect(valueOf(line, 8)).toBe(DXF_LAYER_BACKGROUND);
    expect(valueOf(line, 10)).toBe('-50.0');
    expect(valueOf(line, 20)).toBe('0.0');
    expect(valueOf(line, 11)).toBe('-50.0');
    expect(valueOf(line, 21)).toBe('2800.0');

    const run = entityGroups(groups, { typeName: 'LWPOLYLINE', occurrence: 2 }); // after the two outlines
    expect(valueOf(run, 8)).toBe(DXF_LAYER_BACKGROUND);
    expect(valueOf(run, 90)).toBe('3');
    expect(valueOf(run, 70)).toBe('0'); // open
  });

  it('writes an empty ENTITIES section for an empty section', () => {
    const empty = parseGroups(exportDxfSection(EMPTY_PRIMITIVES));
    expect(empty.some((group) => group.value === 'LWPOLYLINE')).toBe(false);
    expect(empty.some((group) => group.value === 'CIRCLE')).toBe(false);
    expect(empty.some((group) => group.value === 'LINE')).toBe(false);
    expect(empty[empty.length - 1]).toEqual({ code: 0, value: 'EOF' });
  });
});

describe('exportDxfSection → importDxfReference — the reimport-fidelity probe (Q5)', () => {
  it('our own importer reads the export back with exact geometry and zero skips', () => {
    const result = importDxfReference(exportDxfSection(PRIMITIVES));
    expect(result.appliedInsunits).toBe(4);
    expect(result.unitsAssumed).toBe(false);
    expect(totalSkips(result.skipped)).toBe(0); // nothing of ours is unsupported

    const polylines = result.primitives.filter((primitive) => primitive.kind === 'polyline');
    const circles = result.primitives.filter((primitive) => primitive.kind === 'circle');
    const lines = result.primitives.filter((primitive) => primitive.kind === 'line');

    // Outlines reimport as closed polylines at the exact coordinates.
    expect(polylines).toHaveLength(PRIMITIVES.concreteOutlines.length + 1); // + the 3-point background run
    PRIMITIVES.concreteOutlines.forEach((outline, index) => {
      const reimported = polylines[index];
      if (reimported.kind !== 'polyline') throw new Error('unreachable');
      expect(reimported.closed).toBe(true);
      expect(reimported.sourceLayer).toBe(DXF_LAYER_CONCRETE);
      expect(reimported.points).toHaveLength(outline.length);
      outline.forEach((point, pointIndex) => {
        expect(reimported.points[pointIndex].x).toBeCloseTo(point.u, 9);
        expect(reimported.points[pointIndex].y).toBeCloseTo(point.v, 9);
      });
    });
    const backgroundRun = polylines[polylines.length - 1];
    if (backgroundRun.kind !== 'polyline') throw new Error('unreachable');
    expect(backgroundRun.closed).toBe(false);
    expect(backgroundRun.sourceLayer).toBe(DXF_LAYER_BACKGROUND);
    expect(backgroundRun.points).toHaveLength(3);

    // Dots reimport as circles at true Ø/2 (the float-awkward center survives).
    expect(circles).toHaveLength(PRIMITIVES.cutBars.length);
    PRIMITIVES.cutBars.forEach((dot, index) => {
      const reimported = circles[index];
      if (reimported.kind !== 'circle') throw new Error('unreachable');
      expect(reimported.sourceLayer).toBe(DXF_LAYER_REBAR);
      expect(reimported.center.x).toBeCloseTo(dot.center.u, 9);
      expect(reimported.center.y).toBeCloseTo(dot.center.v, 9);
      expect(reimported.radius).toBeCloseTo(dot.diameterMm / 2, 9);
    });

    // The 2-point background reimports as a line on the dashed layer.
    expect(lines).toHaveLength(1);
    const [line] = lines;
    if (line.kind !== 'line') throw new Error('unreachable');
    expect(line.sourceLayer).toBe(DXF_LAYER_BACKGROUND);
    expect(line.start).toEqual({ x: -50, y: 0 });
    expect(line.end).toEqual({ x: -50, y: 2800 });
  });

  it('reimports an empty export as a valid empty document', () => {
    const result = importDxfReference(exportDxfSection(EMPTY_PRIMITIVES));
    expect(result.primitives).toHaveLength(0);
    expect(result.unitsAssumed).toBe(false);
    expect(totalSkips(result.skipped)).toBe(0);
  });

  it('artifact: writes the T7 section export for the author to open in Allplan (AutoCAD-data import check)', () => {
    mkdirSync(EXPORT_ARTIFACT_DIR, { recursive: true });
    writeFileSync(EXPORT_ARTIFACT_FILE, exportDxfSection(PRIMITIVES), 'utf8');
    expect(exportDxfSection(PRIMITIVES).length).toBeGreaterThan(500);
  });
});
