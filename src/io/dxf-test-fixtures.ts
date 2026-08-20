/**
 * Shared test-only builders for the DXF adapter tests (the ifc-test-fixtures.ts
 * precedent): synthetic DxfDocumentLike documents feed mapDxfToReference-
 * Primitives directly (the Q6 contract — the mapping layer is parser-free),
 * and one end-to-end DXF text exercises the real parser. Imported from
 * `*.test.ts` only.
 */
import type { ReferenceArcPrimitive, ReferenceLinePrimitive, ReferencePrimitive } from '@/data/models';
import type { DxfImportSkips } from './dxf-adapter';
import type { DxfDocumentLike, DxfEntityLike } from './dxf-mapping';

export const makeDxf = (overrides: Partial<DxfDocumentLike> = {}): DxfDocumentLike => ({
  header: { $INSUNITS: 4 },
  entities: [],
  blocks: {},
  ...overrides,
});

interface LineSpec {
  from: [number, number];
  to: [number, number];
  extra?: Record<string, unknown>;
}

export const lineEntity = (spec: LineSpec): DxfEntityLike =>
  ({
    type: 'LINE',
    layer: 'WALLS',
    vertices: [
      { x: spec.from[0], y: spec.from[1] },
      { x: spec.to[0], y: spec.to[1] },
    ],
    ...spec.extra,
  }) as DxfEntityLike;

export const insertEntity = (name: string, extra: Record<string, unknown> = {}): DxfEntityLike =>
  ({ type: 'INSERT', name, layer: 'SYMBOLS', ...extra }) as DxfEntityLike;

export const arcEntity = (extra: Record<string, unknown> = {}): DxfEntityLike =>
  ({
    type: 'ARC',
    layer: 'WALLS',
    center: { x: 0, y: 0 },
    radius: 5,
    startAngle: 0,
    endAngle: 90,
    ...extra,
  }) as DxfEntityLike;

export const expectArc = (primitive: ReferencePrimitive): ReferenceArcPrimitive => {
  if (primitive.kind !== 'arc') throw new Error(`expected an arc primitive, got ${primitive.kind}`);
  return primitive;
};

export const expectLine = (primitive: ReferencePrimitive): ReferenceLinePrimitive => {
  if (primitive.kind !== 'line') throw new Error(`expected a line primitive, got ${primitive.kind}`);
  return primitive;
};

// --------------------------------------------------------------------------
// Group-pair readers for text-level DXF assertions (shared by
// dxf-export.test.ts and the M2 acceptance pass; the real parser is
// dxf-parser — exercised by the reimport probes).
// --------------------------------------------------------------------------

export interface DxfGroup {
  code: number;
  value: string;
}

/** Minimal group-pair reader for text-level assertions. */
export function parseGroups(text: string): DxfGroup[] {
  const lines = text.split('\n');
  const groups: DxfGroup[] = [];
  for (let i = 0; i + 1 < lines.length; i += 2) {
    groups.push({ code: Number(lines[i].trim()), value: lines[i + 1].trim() });
  }
  return groups;
}

/** The groups of one entity/entry starting at its 0-marker (up to the next). */
export function entityGroups(
  groups: DxfGroup[],
  query: { typeName: string; occurrence?: number },
): DxfGroup[] {
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
export function entityGroupsAll(groups: DxfGroup[], typeName: string): DxfGroup[][] {
  const count = groups.filter((group) => group.code === 0 && group.value === typeName).length;
  return Array.from({ length: count }, (_, occurrence) => entityGroups(groups, { typeName, occurrence }));
}

export const valueOf = (groups: DxfGroup[], code: number): string | undefined =>
  groups.find((group) => group.code === code)?.value;

export const valuesOf = (groups: DxfGroup[], code: number): string[] =>
  groups.filter((group) => group.code === code).map((group) => group.value);

/** Total of ALL skip counters (unsupported occurrences + structural skips). */
export function totalSkips(skipped: DxfImportSkips): number {
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

/**
 * M2 acceptance fixture (sentence 2) — built to mimic the author's real-file
 * features: cm units ($INSUNITS=5, the KOMO files), NESTED blocks (INNER
 * inserted inside OUTER — the real files nest ≤ 2 deep), a bulged LWPOLYLINE
 * (the ubiquitous real-file curve encoding), TEXT for the skip report. Block
 * content sits on layer '0' → inherits the INSERT's layer (the ByBlock
 * convention).
 */
export const SYNTHETIC_REAL_FILE_DXF = [
  '  0',
  'SECTION',
  '  2',
  'HEADER',
  '  9',
  '$INSUNITS',
  ' 70',
  '     5',
  '  0',
  'ENDSEC',
  '  0',
  'SECTION',
  '  2',
  'BLOCKS',
  '  0',
  'BLOCK',
  '  8',
  '0',
  '  2',
  'INNER',
  ' 70',
  '     0',
  ' 10',
  '0.0',
  ' 20',
  '0.0',
  '  0',
  'LINE',
  '  8',
  '0',
  ' 10',
  '0.0',
  ' 20',
  '0.0',
  ' 11',
  '1.0',
  ' 21',
  '0.0',
  '  0',
  'ENDBLK',
  '  0',
  'BLOCK',
  '  8',
  '0',
  '  2',
  'OUTER',
  ' 70',
  '     0',
  ' 10',
  '0.0',
  ' 20',
  '0.0',
  '  0',
  'LINE',
  '  8',
  '0',
  ' 10',
  '0.0',
  ' 20',
  '0.0',
  ' 11',
  '2.0',
  ' 21',
  '0.0',
  '  0',
  'INSERT',
  '  8',
  '0',
  '  2',
  'INNER',
  ' 10',
  '10.0',
  ' 20',
  '0.0',
  '  0',
  'ENDBLK',
  '  0',
  'ENDSEC',
  '  0',
  'SECTION',
  '  2',
  'ENTITIES',
  '  0',
  'LINE',
  '  8',
  'WALLS',
  ' 10',
  '1.0',
  ' 20',
  '1.0',
  ' 11',
  '2.0',
  ' 21',
  '1.0',
  '  0',
  'LWPOLYLINE',
  '  8',
  '0',
  ' 90',
  '        2',
  ' 70',
  '     0',
  ' 10',
  '0.0',
  ' 20',
  '0.0',
  ' 42',
  '1.0',
  ' 10',
  '2.0',
  ' 20',
  '0.0',
  '  0',
  'TEXT',
  '  8',
  '0',
  ' 10',
  '0.0',
  ' 20',
  '0.0',
  ' 40',
  '2.5',
  '  1',
  'hi',
  '  0',
  'INSERT',
  '  8',
  'MARKS',
  '  2',
  'OUTER',
  ' 10',
  '100.0',
  ' 20',
  '0.0',
  '  0',
  'ENDSEC',
  '  0',
  'EOF',
  '',
].join('\n');

/** End-to-end fixture (cm units): a LINE + CIRCLE + bulged LWPOLYLINE + TEXT +
 *  HATCH in ENTITIES, and a SYM block (one line) inserted once. */
export const END_TO_END_DXF = [
  '  0',
  'SECTION',
  '  2',
  'HEADER',
  '  9',
  '$INSUNITS',
  ' 70',
  '     5',
  '  0',
  'ENDSEC',
  '  0',
  'SECTION',
  '  2',
  'BLOCKS',
  '  0',
  'BLOCK',
  '  8',
  '0',
  '  2',
  'SYM',
  ' 70',
  '     0',
  ' 10',
  '0.0',
  ' 20',
  '0.0',
  '  0',
  'LINE',
  '  8',
  '0',
  ' 10',
  '0.0',
  ' 20',
  '0.0',
  ' 11',
  '1.0',
  ' 21',
  '0.0',
  '  0',
  'ENDBLK',
  '  0',
  'ENDSEC',
  '  0',
  'SECTION',
  '  2',
  'ENTITIES',
  '  0',
  'LINE',
  '  8',
  'WALLS',
  ' 10',
  '1.0',
  ' 20',
  '1.0',
  ' 11',
  '2.0',
  ' 21',
  '1.0',
  '  0',
  'CIRCLE',
  '  8',
  '0',
  ' 10',
  '5.0',
  ' 20',
  '5.0',
  ' 40',
  '2.5',
  '  0',
  'LWPOLYLINE',
  '  8',
  '0',
  ' 90',
  '        2',
  ' 70',
  '     0',
  ' 10',
  '0.0',
  ' 20',
  '0.0',
  ' 42',
  '1.0',
  ' 10',
  '2.0',
  ' 20',
  '0.0',
  '  0',
  'TEXT',
  '  8',
  '0',
  ' 10',
  '0.0',
  ' 20',
  '0.0',
  ' 40',
  '2.5',
  '  1',
  'hello',
  '  0',
  'HATCH',
  '  8',
  '0',
  '  0',
  'INSERT',
  '  8',
  'MARKS',
  '  2',
  'SYM',
  ' 10',
  '100.0',
  ' 20',
  '0.0',
  '  0',
  'ENDSEC',
  '  0',
  'EOF',
  '',
].join('\n');
