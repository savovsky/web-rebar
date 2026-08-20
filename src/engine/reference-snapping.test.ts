import { describe, expect, it } from 'vitest';
import type { ReferenceDocument, ReferencePrimitive } from '@/data/models';
import {
  collectReferenceSnapTargets,
  findReferenceSnap,
  getReferenceSnapTargets,
} from './reference-snapping';

function makeDocument(
  primitives: ReferencePrimitive[],
  overrides: Partial<ReferenceDocument> = {},
): ReferenceDocument {
  return {
    id: 'doc-1',
    name: 'plan.dxf',
    source: { kind: 'dxf', fileName: 'plan.dxf', insunits: 4 },
    elevationMm: 0,
    visible: true,
    primitives,
    ...overrides,
  };
}

describe('getReferenceSnapTargets', () => {
  it('contributes both endpoints and the midpoint of a line, at the document elevation', () => {
    const document = makeDocument([{ kind: 'line', start: { x: 0, y: 0 }, end: { x: 400, y: 200 } }], {
      elevationMm: 2500,
    });
    const targets = getReferenceSnapTargets(document);
    expect(targets).toEqual([
      { x: 0, y: 0, z: 2500, kind: 'endpoint' },
      { x: 400, y: 200, z: 2500, kind: 'endpoint' },
      { x: 200, y: 100, z: 2500, kind: 'midpoint' },
    ]);
  });

  it('contributes every polyline vertex plus one midpoint per segment (open)', () => {
    const document = makeDocument([
      {
        kind: 'polyline',
        closed: false,
        points: [
          { x: 0, y: 0 },
          { x: 100, y: 0 },
          { x: 100, y: 100 },
        ],
      },
    ]);
    const targets = getReferenceSnapTargets(document);
    expect(targets).toHaveLength(5); // 3 vertices + 2 segment midpoints
    expect(targets.filter((target) => target.kind === 'endpoint')).toHaveLength(3);
    expect(targets).toContainEqual({ x: 50, y: 0, z: 0, kind: 'midpoint' });
    expect(targets).toContainEqual({ x: 100, y: 50, z: 0, kind: 'midpoint' });
  });

  it('adds the closing-segment midpoint for a closed polyline', () => {
    const document = makeDocument([
      {
        kind: 'polyline',
        closed: true,
        points: [
          { x: 0, y: 0 },
          { x: 100, y: 0 },
          { x: 0, y: 100 },
        ],
      },
    ]);
    const targets = getReferenceSnapTargets(document);
    expect(targets.filter((target) => target.kind === 'endpoint')).toHaveLength(3);
    expect(targets.filter((target) => target.kind === 'midpoint')).toHaveLength(3);
    expect(targets).toContainEqual({ x: 0, y: 50, z: 0, kind: 'midpoint' }); // closing segment
  });

  it('contributes arc sweep endpoints plus the mid-SWEEP point on the arc', () => {
    // 40° sweep across +X stored wrapped past 2π (350° → 390°): the midpoint
    // must be the point at 10° ON the arc, not the chord midpoint.
    const radius = 200;
    const startAngle = (350 * Math.PI) / 180;
    const endAngle = (390 * Math.PI) / 180;
    const document = makeDocument([{ kind: 'arc', center: { x: 0, y: 0 }, radius, startAngle, endAngle }]);
    const targets = getReferenceSnapTargets(document);
    expect(targets).toHaveLength(3);
    const midAngle = (startAngle + endAngle) / 2;
    const midpoint = targets.find((target) => target.kind === 'midpoint');
    expect(midpoint?.x).toBeCloseTo(radius * Math.cos(midAngle), 6);
    expect(midpoint?.y).toBeCloseTo(radius * Math.sin(midAngle), 6);
    // The mid-sweep point lies on the arc (radius distance from the center).
    expect(Math.hypot(midpoint!.x, midpoint!.y)).toBeCloseTo(radius, 6);
  });

  it('contributes nothing for a circle (§B.3 has no Center snap row yet)', () => {
    const document = makeDocument([{ kind: 'circle', center: { x: 100, y: 100 }, radius: 50 }]);
    expect(getReferenceSnapTargets(document)).toEqual([]);
  });

  it('memoizes per frozen document identity', () => {
    const document = makeDocument([{ kind: 'line', start: { x: 0, y: 0 }, end: { x: 1, y: 1 } }]);
    expect(getReferenceSnapTargets(document)).toBe(getReferenceSnapTargets(document));
  });
});

describe('collectReferenceSnapTargets', () => {
  it('composes across documents and skips hidden ones (hidden never snaps)', () => {
    const line: ReferencePrimitive = { kind: 'line', start: { x: 0, y: 0 }, end: { x: 10, y: 0 } };
    const visible = makeDocument([line], { id: 'visible' });
    const hidden = makeDocument([line], { id: 'hidden', visible: false });
    const targets = collectReferenceSnapTargets([visible, hidden]);
    expect(targets).toHaveLength(3); // only the visible document's line
  });
});

describe('findReferenceSnap', () => {
  const targets = [
    { x: 0, y: 0, z: 0, kind: 'endpoint' as const },
    { x: 100, y: 0, z: 0, kind: 'endpoint' as const },
    { x: 50, y: 0, z: 0, kind: 'midpoint' as const },
  ];

  it('returns the nearest target within tolerance', () => {
    expect(findReferenceSnap({ point: { x: 46, y: 4 }, targets, toleranceMm: 10 })).toEqual(targets[2]);
  });

  it('includes the exact tolerance boundary', () => {
    expect(findReferenceSnap({ point: { x: 40, y: 0 }, targets, toleranceMm: 10 })).toEqual(targets[2]);
  });

  it('returns null beyond tolerance', () => {
    expect(findReferenceSnap({ point: { x: 46, y: 40 }, targets, toleranceMm: 10 })).toBeNull();
  });

  it('ignores z when measuring distance', () => {
    const elevated = [{ x: 0, y: 0, z: 2800, kind: 'endpoint' as const }];
    expect(findReferenceSnap({ point: { x: 1, y: 1 }, targets: elevated, toleranceMm: 5 })).toEqual(
      elevated[0],
    );
  });

  it('returns null for an empty target set', () => {
    expect(findReferenceSnap({ point: { x: 0, y: 0 }, targets: [], toleranceMm: 100 })).toBeNull();
  });
});
