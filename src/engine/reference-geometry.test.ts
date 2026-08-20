import { describe, expect, it } from 'vitest';
import type { ReferencePrimitive, ReferenceSolidPart } from '@/data/models';
import {
  MIN_ARC_SEGMENTS,
  SEGMENTS_PER_FULL_CIRCLE,
  SOLID_COLOR_COMPONENTS,
  SOLID_NORMAL_COMPONENTS,
  SOLID_POSITION_COMPONENTS,
  buildReferenceLinePositions,
  buildReferenceSolidBuffers,
} from './reference-geometry';

const VERTEX_COMPONENTS = 3;

/** Vertex `index` of the flat buffer as [x, y, z]. */
function vertex(positions: Float32Array, index: number): [number, number, number] {
  const offset = index * VERTEX_COMPONENTS;
  return [positions[offset], positions[offset + 1], positions[offset + 2]];
}

function segmentCount(positions: Float32Array): number {
  return positions.length / (VERTEX_COMPONENTS * 2);
}

describe('buildReferenceLinePositions', () => {
  it('returns an empty buffer for an empty document', () => {
    expect(buildReferenceLinePositions([]).length).toBe(0);
  });

  it('emits a line as one segment at z = 0', () => {
    const primitives: ReferencePrimitive[] = [
      { kind: 'line', start: { x: 100, y: 200 }, end: { x: 500, y: -300 } },
    ];
    const positions = buildReferenceLinePositions(primitives);
    expect(segmentCount(positions)).toBe(1);
    expect(vertex(positions, 0)).toEqual([100, 200, 0]);
    expect(vertex(positions, 1)).toEqual([500, -300, 0]);
  });

  it('emits an open polyline as n−1 segments', () => {
    const primitives: ReferencePrimitive[] = [
      {
        kind: 'polyline',
        closed: false,
        points: [
          { x: 0, y: 0 },
          { x: 100, y: 0 },
          { x: 100, y: 100 },
        ],
      },
    ];
    const positions = buildReferenceLinePositions(primitives);
    expect(segmentCount(positions)).toBe(2);
    expect(vertex(positions, 0)).toEqual([0, 0, 0]);
    expect(vertex(positions, 3)).toEqual([100, 100, 0]);
  });

  it('closes a closed polyline back to its first point', () => {
    const primitives: ReferencePrimitive[] = [
      {
        kind: 'polyline',
        closed: true,
        points: [
          { x: 0, y: 0 },
          { x: 100, y: 0 },
          { x: 0, y: 100 },
        ],
      },
    ];
    const positions = buildReferenceLinePositions(primitives);
    expect(segmentCount(positions)).toBe(3);
    // Closing segment: last point → first point.
    expect(vertex(positions, 4)).toEqual([0, 100, 0]);
    expect(vertex(positions, 5)).toEqual([0, 0, 0]);
  });

  it('tessellates a circle into a closed SEGMENTS_PER_FULL_CIRCLE loop', () => {
    const primitives: ReferencePrimitive[] = [{ kind: 'circle', center: { x: 1000, y: 2000 }, radius: 50 }];
    const positions = buildReferenceLinePositions(primitives);
    expect(segmentCount(positions)).toBe(SEGMENTS_PER_FULL_CIRCLE);
    // Starts at angle 0 (center + r·(1, 0)) and the last vertex returns there.
    expect(vertex(positions, 0)[0]).toBeCloseTo(1050, 6);
    expect(vertex(positions, 0)[1]).toBeCloseTo(2000, 6);
    const lastVertex = vertex(positions, SEGMENTS_PER_FULL_CIRCLE * 2 - 1);
    expect(lastVertex[0]).toBeCloseTo(1050, 6);
    expect(lastVertex[1]).toBeCloseTo(2000, 6);
  });

  it('follows the stored CCW arc sweep — never the short way around', () => {
    // Sweep from 350° to 370°+20°=30° (i.e. 40° across the +X axis, stored
    // wrapped past 2π): the mid-sweep point sits at 10°, NOT at 190°.
    const startAngle = (350 * Math.PI) / 180;
    const endAngle = (390 * Math.PI) / 180; // 2π + 30°
    const radius = 200;
    const primitives: ReferencePrimitive[] = [
      { kind: 'arc', center: { x: 0, y: 0 }, radius, startAngle, endAngle },
    ];
    const positions = buildReferenceLinePositions(primitives);
    const segments = segmentCount(positions);
    expect(segments).toBe(
      Math.max(
        MIN_ARC_SEGMENTS,
        Math.ceil(((endAngle - startAngle) / (Math.PI * 2)) * SEGMENTS_PER_FULL_CIRCLE),
      ),
    );
    expect(segments % 2).toBe(0); // even → the middle vertex is the exact mid-sweep point
    const midVertex = vertex(positions, segments); // first vertex of segment segments/2... see below
    // Middle POINT of the polyline = vertex index `segments` (segments + 1 points).
    // (Precision 3: the buffer is Float32 — 0.0005 mm is far below its ulp.)
    const midAngle = startAngle + (endAngle - startAngle) / 2;
    expect(midVertex[0]).toBeCloseTo(radius * Math.cos(midAngle), 3);
    expect(midVertex[1]).toBeCloseTo(radius * Math.sin(midAngle), 3);
    // Endpoints land exactly on the sweep ends.
    expect(vertex(positions, 0)[0]).toBeCloseTo(radius * Math.cos(startAngle), 3);
    expect(vertex(positions, 0)[1]).toBeCloseTo(radius * Math.sin(startAngle), 3);
    const lastVertex = vertex(positions, segments * 2 - 1);
    expect(lastVertex[0]).toBeCloseTo(radius * Math.cos(endAngle), 3);
    expect(lastVertex[1]).toBeCloseTo(radius * Math.sin(endAngle), 3);
  });

  it('gives a degenerate (zero-sweep) arc MIN_ARC_SEGMENTS on the spot', () => {
    const primitives: ReferencePrimitive[] = [
      { kind: 'arc', center: { x: 0, y: 0 }, radius: 100, startAngle: 1, endAngle: 1 },
    ];
    const positions = buildReferenceLinePositions(primitives);
    expect(segmentCount(positions)).toBe(MIN_ARC_SEGMENTS);
  });

  it('merges multiple primitives into one buffer in order', () => {
    const primitives: ReferencePrimitive[] = [
      { kind: 'line', start: { x: 0, y: 0 }, end: { x: 1, y: 1 } },
      { kind: 'line', start: { x: 2, y: 2 }, end: { x: 3, y: 3 } },
    ];
    const positions = buildReferenceLinePositions(primitives);
    expect(segmentCount(positions)).toBe(2);
    expect(vertex(positions, 2)).toEqual([2, 2, 0]);
  });
});

/** Two tiny triangle parts for the solids-merge tests. */
function makeTrianglePart(override: Partial<ReferenceSolidPart> = {}): ReferenceSolidPart {
  return {
    positions: new Float32Array([0, 0, 0, 100, 0, 0, 0, 100, 0]),
    normals: new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1]),
    indices: new Uint32Array([0, 1, 2]),
    color: { r: 0.5, g: 0.25, b: 0.75, a: 1 },
    ...override,
  };
}

describe('buildReferenceSolidBuffers (M2 T6.5, Q7)', () => {
  it('merges parts into one buffer set with rebased indices, preserving order', () => {
    const second = makeTrianglePart({
      positions: new Float32Array([5, 5, 5, 105, 5, 5, 5, 105, 5]),
    });
    const buffers = buildReferenceSolidBuffers({
      solids: [makeTrianglePart(), second],
      fallbackColor: { r: 0.7, g: 0.7, b: 0.7 },
      opacity: 0.65,
    });
    expect(buffers.positions.length).toBe(6 * SOLID_POSITION_COMPONENTS);
    expect(buffers.normals.length).toBe(6 * SOLID_NORMAL_COMPONENTS);
    expect(buffers.colors.length).toBe(6 * SOLID_COLOR_COMPONENTS);
    // The second part's indices are rebased by the first part's vertex count.
    expect(Array.from(buffers.indices)).toEqual([0, 1, 2, 3, 4, 5]);
    expect(vertex(buffers.positions, 3)).toEqual([5, 5, 5]);
  });

  it('bakes the IFC part color × the reduced opacity into per-vertex RGBA', () => {
    const buffers = buildReferenceSolidBuffers({
      solids: [makeTrianglePart()],
      fallbackColor: { r: 0.7, g: 0.7, b: 0.7 },
      opacity: 0.5,
    });
    expect(Array.from(buffers.colors.slice(0, SOLID_COLOR_COMPONENTS))).toEqual([0.5, 0.25, 0.75, 0.5]);
  });

  it('multiplies a styled part alpha into the baked vertex alpha', () => {
    const translucent = makeTrianglePart({ color: { r: 1, g: 0, b: 0, a: 0.4 } });
    const buffers = buildReferenceSolidBuffers({
      solids: [translucent],
      fallbackColor: { r: 0.7, g: 0.7, b: 0.7 },
      opacity: 0.5,
    });
    expect(buffers.colors[3]).toBeCloseTo(0.2, 6);
  });

  it('applies the token fallback color to unstyled parts (color null)', () => {
    const unstyled = makeTrianglePart({ color: null });
    const buffers = buildReferenceSolidBuffers({
      solids: [unstyled],
      fallbackColor: { r: 0.2, g: 0.4, b: 0.6 },
      opacity: 0.65,
    });
    expect(Array.from(buffers.colors.slice(0, SOLID_COLOR_COMPONENTS))).toEqual([
      expect.closeTo(0.2, 6),
      expect.closeTo(0.4, 6),
      expect.closeTo(0.6, 6),
      expect.closeTo(0.65, 6),
    ]);
  });

  it('returns empty buffers for an empty document', () => {
    const buffers = buildReferenceSolidBuffers({
      solids: [],
      fallbackColor: { r: 0, g: 0, b: 0 },
      opacity: 1,
    });
    expect(buffers.positions.length).toBe(0);
    expect(buffers.indices.length).toBe(0);
  });
});
