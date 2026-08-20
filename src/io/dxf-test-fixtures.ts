/**
 * Shared test-only builders for the DXF adapter tests (the ifc-test-fixtures.ts
 * precedent): synthetic DxfDocumentLike documents feed mapDxfToReference-
 * Primitives directly (the Q6 contract — the mapping layer is parser-free),
 * and one end-to-end DXF text exercises the real parser. Imported from
 * `*.test.ts` only.
 */
import type { ReferenceArcPrimitive, ReferenceLinePrimitive, ReferencePrimitive } from '@/data/models';
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
