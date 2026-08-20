// Endpoint/midpoint snap targets over reference linework (§B.3 — those rows
// get their first real target at M2 T6). Pure + identity-memoized: reference
// documents are frozen model objects (the M1 T5 finding), so per-document
// target extraction is cached in a WeakMap keyed by the document — a
// 67k-primitive import derives its ~200k targets ONCE, not per pointer move.
import type { LineworkReferenceDocument, ReferenceDocument, ReferencePrimitive } from '@/data/models';

export interface ReferenceSnapTarget {
  x: number;
  y: number;
  /** The document's elevation — where the snapped point (and marker) sits. */
  z: number;
  kind: 'endpoint' | 'midpoint';
}

interface TargetCollector {
  targets: ReferenceSnapTarget[];
  elevationMm: number;
}

function collectPrimitiveTargets(collector: TargetCollector, primitive: ReferencePrimitive): void {
  const { targets, elevationMm: z } = collector;
  const push = (target: ReferenceSnapTarget): void => {
    targets.push(target);
  };
  switch (primitive.kind) {
    case 'line':
      push({ x: primitive.start.x, y: primitive.start.y, z, kind: 'endpoint' });
      push({ x: primitive.end.x, y: primitive.end.y, z, kind: 'endpoint' });
      push({
        x: (primitive.start.x + primitive.end.x) / 2,
        y: (primitive.start.y + primitive.end.y) / 2,
        z,
        kind: 'midpoint',
      });
      break;
    case 'polyline': {
      const { points, closed: isClosed } = primitive;
      for (const point of points) push({ x: point.x, y: point.y, z, kind: 'endpoint' });
      const segmentCount = isClosed ? points.length : points.length - 1;
      for (let index = 0; index < segmentCount; index += 1) {
        const from = points[index];
        const to = points[(index + 1) % points.length];
        push({ x: (from.x + to.x) / 2, y: (from.y + to.y) / 2, z, kind: 'midpoint' });
      }
      break;
    }
    case 'arc': {
      const { center, radius, startAngle, endAngle } = primitive;
      // CCW sweep endpoints + the mid-SWEEP point (a point on the arc — the
      // chord midpoint would not lie on the linework).
      const angles = [startAngle, endAngle, startAngle + Math.max(0, endAngle - startAngle) / 2];
      const kinds: ReferenceSnapTarget['kind'][] = ['endpoint', 'endpoint', 'midpoint'];
      angles.forEach((angle, index) => {
        push({
          x: center.x + radius * Math.cos(angle),
          y: center.y + radius * Math.sin(angle),
          z,
          kind: kinds[index],
        });
      });
      break;
    }
    case 'circle':
      // A closed curve has no endpoints/midpoints — and §B.3 defines no
      // Center snap row yet, so circles contribute nothing (task-log decision).
      break;
  }
}

const targetCache = new WeakMap<LineworkReferenceDocument, ReferenceSnapTarget[]>();

/** One document's snap targets — memoized on the frozen document identity.
 *  LINEWORK documents only: Q7 reference solids (T6.5) are never snap
 *  targets — the `content` discriminant keeps them out at compile time. */
export function getReferenceSnapTargets(document: LineworkReferenceDocument): ReferenceSnapTarget[] {
  const cached = targetCache.get(document);
  if (cached) return cached;
  const collector: TargetCollector = { targets: [], elevationMm: document.elevationMm };
  for (const primitive of document.primitives) collectPrimitiveTargets(collector, primitive);
  targetCache.set(document, collector.targets);
  return collector.targets;
}

/** Snap targets of every VISIBLE document — hidden backgrounds never snap
 *  (an invisible magnet is a bug, not a feature; task-log decision). */
export function collectReferenceSnapTargets(documents: ReferenceDocument[]): ReferenceSnapTarget[] {
  return documents
    .filter(
      (document): document is LineworkReferenceDocument =>
        document.content === 'linework' && document.visible,
    )
    .flatMap(getReferenceSnapTargets);
}

export interface FindReferenceSnapOptions {
  point: { x: number; y: number };
  targets: readonly ReferenceSnapTarget[];
  toleranceMm: number;
}

/** Nearest target within tolerance (plan X–Y distance — z never participates:
 *  ground-plane tools are z-indifferent, face tools re-project onto the face). */
export function findReferenceSnap({
  point,
  targets,
  toleranceMm,
}: FindReferenceSnapOptions): ReferenceSnapTarget | null {
  let best: ReferenceSnapTarget | null = null;
  let bestDistanceMm = toleranceMm;
  for (const target of targets) {
    const distanceMm = Math.hypot(target.x - point.x, target.y - point.y);
    if (distanceMm <= bestDistanceMm) {
      best = target;
      bestDistanceMm = distanceMm;
    }
  }
  return best;
}
