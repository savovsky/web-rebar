// M2 T5 — dxf mapping layer unit tests: the Q4 units table, basic entity
// mapping, bulge→arc math vs known arcs, OCS/extrusion conversion. Synthetic
// DxfDocumentLike documents feed mapDxfToReferencePrimitives directly — the
// Q6 contract keeps the mapping layer parser-free. Block/insert explosion
// tests live in dxf-blocks.test.ts; end-to-end parse + real-file probes in
// dxf-adapter.test.ts.
import { describe, expect, it } from 'vitest';
import type { DxfEntityLike } from './dxf-adapter';
import { mapDxfToReferencePrimitives } from './dxf-adapter';
import { arcEntity, expectArc, lineEntity, makeDxf } from './dxf-test-fixtures';

// --------------------------------------------------------------------------
// Q4 units
// --------------------------------------------------------------------------

describe('$INSUNITS → mm (Q4 units table)', () => {
  it('applies the table for the realistic codes (mm/cm/m/in/ft)', () => {
    const cases: [number, number][] = [
      [4, 1],
      [5, 10],
      [6, 1000],
      [1, 25.4],
      [2, 304.8],
    ];
    for (const [insunits, expectedMm] of cases) {
      const result = mapDxfToReferencePrimitives(
        makeDxf({ header: { $INSUNITS: insunits }, entities: [lineEntity({ from: [0, 0], to: [1, 0] })] }),
      );
      expect(result.scaleToMm, `code ${insunits}`).toBe(expectedMm);
      expect(result.appliedInsunits, `code ${insunits}`).toBe(insunits);
      expect(result.unitsAssumed, `code ${insunits}`).toBe(false);
      expect(result.headerInsunits, `code ${insunits}`).toBe(insunits);
      expect(result.primitives[0], `code ${insunits}`).toMatchObject({ end: { x: expectedMm, y: 0 } });
    }
  });

  it('unitless (0), missing, or unknown codes → assume mm and flag the warning', () => {
    for (const header of [{ $INSUNITS: 0 }, {}, { $INSUNITS: 99 }, { $INSUNITS: 'mm' }]) {
      const result = mapDxfToReferencePrimitives(
        makeDxf({ header, entities: [lineEntity({ from: [0, 0], to: [1, 0] })] }),
      );
      expect(result.scaleToMm, JSON.stringify(header)).toBe(1);
      expect(result.appliedInsunits, JSON.stringify(header)).toBe(4);
      expect(result.unitsAssumed, JSON.stringify(header)).toBe(true);
    }
    expect(mapDxfToReferencePrimitives(makeDxf({ header: {} })).headerInsunits).toBeUndefined();
  });

  it('the override wins over the declared units; an unknown override throws', () => {
    const result = mapDxfToReferencePrimitives(
      makeDxf({ header: { $INSUNITS: 5 }, entities: [lineEntity({ from: [0, 0], to: [1, 0] })] }),
      { insunitsOverride: 6 },
    );
    expect(result.scaleToMm).toBe(1000);
    expect(result.appliedInsunits).toBe(6);
    expect(result.headerInsunits).toBe(5);
    expect(result.unitsAssumed).toBe(false);
    expect(() =>
      mapDxfToReferencePrimitives(makeDxf({ entities: [lineEntity({ from: [0, 0], to: [1, 0] })] }), {
        insunitsOverride: 42,
      }),
    ).toThrow(/unknown \$INSUNITS override/);
  });
});

// --------------------------------------------------------------------------
// Basic entity mapping
// --------------------------------------------------------------------------

describe('basic entity mapping', () => {
  it('maps LINE with the source-layer tag; ARC degrees → CCW radians; CIRCLE; polylines', () => {
    const result = mapDxfToReferencePrimitives(
      makeDxf({
        header: { $INSUNITS: 5 }, // cm — scale 10 exercises the unit factor everywhere
        entities: [
          lineEntity({ from: [1, 1], to: [2, 1] }),
          arcEntity(),
          { type: 'CIRCLE', layer: 'COLS', center: { x: 5, y: 5 }, radius: 2.5 } as DxfEntityLike,
          {
            type: 'LWPOLYLINE',
            layer: 'GRID',
            vertices: [
              { x: 0, y: 0 },
              { x: 4, y: 0 },
              { x: 4, y: 3 },
            ],
            shape: true,
          } as DxfEntityLike,
          {
            type: 'POLYLINE',
            layer: 'GRID',
            vertices: [
              { x: 0, y: 0, z: 10 },
              { x: 1, y: 0, z: 20 },
            ],
            shape: false,
          } as DxfEntityLike,
        ],
      }),
    );
    expect(result.primitives[0]).toEqual({
      kind: 'line',
      start: { x: 10, y: 10 },
      end: { x: 20, y: 10 },
      sourceLayer: 'WALLS',
    });
    const arc = expectArc(result.primitives[1]);
    expect(arc.center).toEqual({ x: 0, y: 0 });
    expect(arc.radius).toBe(50);
    expect(arc.startAngle).toBeCloseTo(0);
    expect(arc.endAngle).toBeCloseTo(Math.PI / 2);
    expect(result.primitives[2]).toEqual({
      kind: 'circle',
      center: { x: 50, y: 50 },
      radius: 25,
      sourceLayer: 'COLS',
    });
    expect(result.primitives[3]).toEqual({
      kind: 'polyline',
      points: [
        { x: 0, y: 0 },
        { x: 40, y: 0 },
        { x: 40, y: 30 },
      ],
      closed: true,
      sourceLayer: 'GRID',
    });
    // Old POLYLINE: per-vertex z dropped in the plan projection.
    expect(result.primitives[4]).toMatchObject({ kind: 'polyline', closed: false });
  });

  it('counts zero-length and coordinate-less entities as degenerate', () => {
    const result = mapDxfToReferencePrimitives(
      makeDxf({ entities: [lineEntity({ from: [1, 1], to: [1, 1] }), { type: 'LINE' }] }),
    );
    expect(result.primitives).toHaveLength(0);
    expect(result.skipped.degenerateSegments).toBe(2);
  });

  it('counts paper-space entities and every Q4-listed unsupported type', () => {
    const unsupportedTypes = [
      'TEXT',
      'MTEXT',
      'SPLINE',
      'ELLIPSE',
      'HATCH',
      'SOLID',
      'DIMENSION',
      '3DFACE',
      'POINT',
      'ATTDEF',
    ];
    const result = mapDxfToReferencePrimitives(
      makeDxf({
        entities: [
          lineEntity({ from: [0, 0], to: [1, 0], extra: { inPaperSpace: true } }),
          ...unsupportedTypes.map((type) => ({ type, layer: 'X' })),
        ],
      }),
    );
    expect(result.primitives).toHaveLength(0);
    expect(result.skipped.paperSpaceEntities).toBe(1);
    for (const type of unsupportedTypes) {
      expect(result.skipped.unsupportedEntities[type]).toBe(1);
    }
  });
});

// --------------------------------------------------------------------------
// Bulge → arc (Q4) vs known arcs
// --------------------------------------------------------------------------

const TAN_QUARTER = Math.tan(Math.PI / 8); // bulge of a 90° arc segment

interface BulgedPolylineSpec {
  bulge: number;
  from: [number, number];
  to: [number, number];
}

const bulgedTwoVertexPolyline = (spec: BulgedPolylineSpec): DxfEntityLike =>
  ({
    type: 'LWPOLYLINE',
    layer: 'WALLS',
    vertices: [
      { x: spec.from[0], y: spec.from[1], bulge: spec.bulge },
      { x: spec.to[0], y: spec.to[1] },
    ],
    shape: false,
  }) as DxfEntityLike;

describe('bulge → arc conversion (Q4)', () => {
  it('a quarter-circle bulge (b = tan(π/8)) lands exactly on the unit circle, CCW', () => {
    const result = mapDxfToReferencePrimitives(
      makeDxf({ entities: [bulgedTwoVertexPolyline({ bulge: TAN_QUARTER, from: [1, 0], to: [0, 1] })] }),
    );
    expect(result.primitives).toHaveLength(1);
    const arc = expectArc(result.primitives[0]);
    expect(arc.center.x).toBeCloseTo(0);
    expect(arc.center.y).toBeCloseTo(0);
    expect(arc.radius).toBeCloseTo(1);
    expect(arc.startAngle).toBeCloseTo(0);
    expect(arc.endAngle).toBeCloseTo(Math.PI / 2);
  });

  it('a clockwise bulge (b < 0) mirrors the arc across the chord, renormalized to CCW', () => {
    // Same endpoints, negated bulge → the OTHER quarter circle (center (1,1)):
    // the clockwise arc (1,0)→(0,1) is the CCW arc (0,1)→(1,0), sweep π → 3π/2.
    const result = mapDxfToReferencePrimitives(
      makeDxf({ entities: [bulgedTwoVertexPolyline({ bulge: -TAN_QUARTER, from: [1, 0], to: [0, 1] })] }),
    );
    const arc = expectArc(result.primitives[0]);
    expect(arc.center.x).toBeCloseTo(1);
    expect(arc.center.y).toBeCloseTo(1);
    expect(arc.radius).toBeCloseTo(1);
    expect(arc.startAngle).toBeCloseTo(Math.PI);
    expect(arc.endAngle).toBeCloseTo(-Math.PI / 2);
  });

  it('a semicircle bulge (b = 1) spans π → 2π (the lower half)', () => {
    const result = mapDxfToReferencePrimitives(
      makeDxf({ entities: [bulgedTwoVertexPolyline({ bulge: 1, from: [-1, 0], to: [1, 0] })] }),
    );
    const arc = expectArc(result.primitives[0]);
    expect(arc.center.x).toBeCloseTo(0);
    expect(arc.center.y).toBeCloseTo(0);
    expect(arc.radius).toBeCloseTo(1);
    expect(arc.startAngle).toBeCloseTo(Math.PI);
    expect(arc.endAngle).toBeCloseTo(0);
  });

  it('mixed bulged/straight polylines decompose: straight runs coalesce, bulges become arcs', () => {
    const result = mapDxfToReferencePrimitives(
      makeDxf({
        entities: [
          {
            type: 'LWPOLYLINE',
            layer: 'WALLS',
            vertices: [
              { x: 0, y: 0 },
              { x: 1, y: 0, bulge: TAN_QUARTER },
              { x: 1, y: 1 },
              { x: 2, y: 1 },
            ],
            shape: false,
          } as DxfEntityLike,
        ],
      }),
    );
    expect(result.primitives.map((p) => p.kind)).toEqual(['line', 'arc', 'line']);
    expect(result.primitives[0]).toMatchObject({ start: { x: 0, y: 0 }, end: { x: 1, y: 0 } });
    const arc = expectArc(result.primitives[1]);
    // Quarter arc from (1,0) to (1,1) bulging left of the chord.
    expect(arc.radius).toBeCloseTo(Math.SQRT1_2);
    expect(result.primitives[2]).toMatchObject({ start: { x: 1, y: 1 }, end: { x: 2, y: 1 } });
  });

  it('the closing segment of a closed polyline carries its own bulge', () => {
    const result = mapDxfToReferencePrimitives(
      makeDxf({
        entities: [
          {
            type: 'LWPOLYLINE',
            layer: 'WALLS',
            vertices: [
              { x: 0, y: 0 },
              { x: 2, y: 0 },
              { x: 1, y: 1, bulge: TAN_QUARTER },
            ],
            shape: true,
          } as DxfEntityLike,
        ],
      }),
    );
    expect(result.primitives.map((p) => p.kind)).toEqual(['polyline', 'arc']);
    expect(result.primitives[0]).toMatchObject({
      points: [
        { x: 0, y: 0 },
        { x: 2, y: 0 },
        { x: 1, y: 1 },
      ],
      closed: false, // the bulged closing segment breaks the loop — runs stay open
    });
    // Closing arc from (1,1) back to (0,0).
    expectArc(result.primitives[1]);
  });

  it('a curve-fit/spline-fit or mesh POLYLINE is skipped-and-counted, not exploded', () => {
    const result = mapDxfToReferencePrimitives(
      makeDxf({
        entities: [
          {
            type: 'POLYLINE',
            layer: 'X',
            vertices: [{ x: 0, y: 0 }],
            includesSplineFitVertices: true,
          } as DxfEntityLike,
          { type: 'POLYLINE', layer: 'X', vertices: [{ x: 0, y: 0 }], isPolyfaceMesh: true } as DxfEntityLike,
        ],
      }),
    );
    expect(result.primitives).toHaveLength(0);
    expect(result.skipped.unsupportedEntities['POLYLINE (curve/spline-fit)']).toBe(1);
    expect(result.skipped.unsupportedEntities['POLYLINE (mesh)']).toBe(1);
  });
});

// --------------------------------------------------------------------------
// OCS / extrusion direction (arbitrary-axis algorithm — load-bearing on the
// author's fixtures: (0,0,-1) mirrored-plan entities are common there)
// --------------------------------------------------------------------------

describe('OCS / extrusion direction', () => {
  it('a (0,0,-1) line mirrors x through its own plane (real-file case)', () => {
    const result = mapDxfToReferencePrimitives(
      makeDxf({
        entities: [
          lineEntity({ from: [1, 2], to: [3, 4], extra: { extrusionDirection: { x: 0, y: 0, z: -1 } } }),
        ],
      }),
    );
    expect(result.primitives[0]).toMatchObject({ start: { x: -1, y: 2 }, end: { x: -3, y: 4 } });
  });

  it('an explicit default (0,0,1) extrusion is the identity', () => {
    const result = mapDxfToReferencePrimitives(
      makeDxf({
        entities: [
          lineEntity({ from: [1, 2], to: [3, 4], extra: { extrusionDirection: { x: 0, y: 0, z: 1 } } }),
        ],
      }),
    );
    expect(result.primitives[0]).toMatchObject({ start: { x: 1, y: 2 }, end: { x: 3, y: 4 } });
  });

  it('a (0,0,-1) arc renormalizes its mirrored sweep', () => {
    const result = mapDxfToReferencePrimitives(
      makeDxf({ entities: [arcEntity({ center: { x: 1, y: 0 }, radius: 2, extrusionDirectionZ: -1 })] }),
    );
    const arc = expectArc(result.primitives[0]);
    expect(arc.center.x).toBeCloseTo(-1);
    expect(arc.radius).toBeCloseTo(2);
    expect(arc.startAngle).toBeCloseTo(Math.PI / 2);
    expect(arc.endAngle).toBeCloseTo(Math.PI);
  });

  it('LWPOLYLINE elevation + extrusion apply, then z drops in the plan projection', () => {
    const result = mapDxfToReferencePrimitives(
      makeDxf({
        entities: [
          {
            type: 'LWPOLYLINE',
            layer: 'WALLS',
            elevation: 5,
            extrusionDirectionZ: -1,
            vertices: [
              { x: 1, y: 2 },
              { x: 3, y: 4 },
            ],
            shape: false,
          } as DxfEntityLike,
        ],
      }),
    );
    expect(result.primitives[0]).toMatchObject({
      kind: 'polyline',
      points: [
        { x: -1, y: 2 },
        { x: -3, y: 4 },
      ],
    });
  });

  it('a tilted arc plane (genuine 3D content) is counted and skipped — its projection is an ellipse', () => {
    const result = mapDxfToReferencePrimitives(
      makeDxf({
        entities: [arcEntity({ extrusionDirectionX: 0, extrusionDirectionY: 1, extrusionDirectionZ: 0 })],
      }),
    );
    expect(result.primitives).toHaveLength(0);
    expect(result.skipped.tiltedCurves).toBe(1);
  });

  it('an insert with (0,0,-1) extrusion mirrors the whole block content, insertion point included', () => {
    const result = mapDxfToReferencePrimitives(
      makeDxf({
        blocks: { B1: { entities: [lineEntity({ from: [1, 0], to: [2, 0] })] } },
        entities: [
          {
            type: 'INSERT',
            name: 'B1',
            position: { x: 10, y: 0 },
            extrusionDirection: { x: 0, y: 0, z: -1 },
          } as DxfEntityLike,
        ],
      }),
    );
    // The insertion point is an OCS coordinate too — it mirrors with the content.
    expect(result.primitives[0]).toMatchObject({ start: { x: -11, y: 0 }, end: { x: -12, y: 0 } });
  });
});
