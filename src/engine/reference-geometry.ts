// Reference linework → render geometry (M2 T6). Pure math (rule 2 — components
// never compute this): tessellates the Q3 primitives (plan X–Y, model mm) into
// ONE flat xyz position buffer, so a whole document renders as a single merged
// LineSegments — the T5 real-file probe reached ~67k primitives per import, so
// per-primitive meshes/React elements are out of the question. z stays 0; the
// layer positions the merged geometry at the document's elevationMm.
import type { ReferencePrimitive } from '@/data/models';

export const LINE_POSITION_COMPONENTS = 3;

/** Full-circle tessellation budget: 64 segments per 2π keeps the sagitta
 *  error ≈ 0.12% of the radius (a Ø20 bolt hole → ~0.01 mm; a 10 m site arc
 *  → ~12 mm) — invisible on a background, and bounded when a real file
 *  explodes to tens of thousands of primitives. */
export const SEGMENTS_PER_FULL_CIRCLE = 64;
/** Even a sliver of arc gets this many segments (a 2-segment arc reads as a kink). */
export const MIN_ARC_SEGMENTS = 4;

const FULL_CIRCLE_RADIANS = Math.PI * 2;

interface ArcTessellation {
  centerX: number;
  centerY: number;
  radius: number;
  startAngle: number;
  /** CCW sweep in radians — tessellation follows it, never the short way. */
  sweepRadians: number;
}

function appendArcSegments(positions: number[], arc: ArcTessellation): void {
  const { centerX, centerY, radius, startAngle, sweepRadians } = arc;
  const segments = Math.max(
    MIN_ARC_SEGMENTS,
    Math.ceil((sweepRadians / FULL_CIRCLE_RADIANS) * SEGMENTS_PER_FULL_CIRCLE),
  );
  for (let step = 0; step < segments; step += 1) {
    const from = startAngle + (sweepRadians * step) / segments;
    const to = startAngle + (sweepRadians * (step + 1)) / segments;
    positions.push(
      centerX + radius * Math.cos(from),
      centerY + radius * Math.sin(from),
      0,
      centerX + radius * Math.cos(to),
      centerY + radius * Math.sin(to),
      0,
    );
  }
}

/**
 * One document's primitives → ONE flat position buffer (x, y, 0 triples, two
 * vertices per segment) for a merged LineSegments. Arcs/circles tessellate at
 * SEGMENTS_PER_FULL_CIRCLE resolution; arc sweeps are stored CCW start → end
 * (radians, possibly wrapping past 2π) and are followed exactly.
 */
export function buildReferenceLinePositions(primitives: ReferencePrimitive[]): Float32Array {
  const positions: number[] = [];
  for (const primitive of primitives) {
    switch (primitive.kind) {
      case 'line':
        positions.push(primitive.start.x, primitive.start.y, 0, primitive.end.x, primitive.end.y, 0);
        break;
      case 'polyline': {
        const { points, closed: isClosed } = primitive;
        const segmentCount = isClosed ? points.length : points.length - 1;
        for (let index = 0; index < segmentCount; index += 1) {
          const from = points[index];
          const to = points[(index + 1) % points.length];
          positions.push(from.x, from.y, 0, to.x, to.y, 0);
        }
        break;
      }
      case 'arc':
        appendArcSegments(positions, {
          centerX: primitive.center.x,
          centerY: primitive.center.y,
          radius: primitive.radius,
          startAngle: primitive.startAngle,
          sweepRadians: Math.max(0, primitive.endAngle - primitive.startAngle),
        });
        break;
      case 'circle':
        appendArcSegments(positions, {
          centerX: primitive.center.x,
          centerY: primitive.center.y,
          radius: primitive.radius,
          startAngle: 0,
          sweepRadians: FULL_CIRCLE_RADIANS,
        });
        break;
    }
  }
  return new Float32Array(positions);
}
