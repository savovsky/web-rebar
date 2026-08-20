import { describe, expect, it } from 'vitest';
import type { ReferenceSnapTarget } from './reference-snapping';
import { resolveSnapPoint, snapPointToGrid } from './snapping';

describe('snapPointToGrid', () => {
  it('snaps plan coordinates to the nearest grid multiple', () => {
    expect(snapPointToGrid({ x: 123, y: 260, z: 0 }, 100)).toEqual({ x: 100, y: 300, z: 0 });
  });

  it('rounds halves up', () => {
    expect(snapPointToGrid({ x: 150, y: -50, z: 0 }, 100)).toEqual({ x: 200, y: -0, z: 0 });
  });

  it('handles negative coordinates', () => {
    expect(snapPointToGrid({ x: -120, y: -480, z: 0 }, 100)).toEqual({ x: -100, y: -500, z: 0 });
  });

  it('passes z through untouched', () => {
    expect(snapPointToGrid({ x: 10, y: 10, z: 42 }, 100)).toEqual({ x: 0, y: 0, z: 42 });
  });

  it('returns the point unchanged for non-positive spacing', () => {
    const point = { x: 123, y: 456, z: 0 };
    expect(snapPointToGrid(point, 0)).toEqual(point);
  });
});

describe('resolveSnapPoint', () => {
  // §B.3: an endpoint/midpoint of reference linework within half a grid cell
  // beats grid rounding (object snap = High, grid = Low).
  const referenceTargets: ReferenceSnapTarget[] = [
    { x: 123, y: 260, z: 0, kind: 'endpoint' },
    { x: 800, y: 260, z: 0, kind: 'midpoint' },
  ];

  it('snaps to a reference target within half a grid cell instead of the grid', () => {
    const resolution = resolveSnapPoint({
      raw: { x: 130, y: 262, z: 0 },
      isSnapEnabled: true,
      referenceTargets,
      gridSpacingMm: 100,
    });
    expect(resolution.target).toBe('reference');
    expect(resolution.point).toEqual({ x: 123, y: 260, z: 0 });
  });

  it('passes z through on a reference hit (face flows re-project)', () => {
    const resolution = resolveSnapPoint({
      raw: { x: 123, y: 260, z: 1400 },
      isSnapEnabled: true,
      referenceTargets,
      gridSpacingMm: 100,
    });
    expect(resolution.point.z).toBe(1400);
  });

  it('falls back to the grid when no reference target is within tolerance', () => {
    const resolution = resolveSnapPoint({
      raw: { x: 420, y: 480, z: 0 },
      isSnapEnabled: true,
      referenceTargets,
      gridSpacingMm: 100,
    });
    expect(resolution.target).toBe('grid');
    expect(resolution.point).toEqual({ x: 400, y: 500, z: 0 });
  });

  it('grid-rounds when there are no reference targets at all', () => {
    const resolution = resolveSnapPoint({
      raw: { x: 123, y: 260, z: 0 },
      isSnapEnabled: true,
      referenceTargets: [],
      gridSpacingMm: 100,
    });
    expect(resolution).toEqual({ point: { x: 100, y: 300, z: 0 }, target: 'grid' });
  });

  it('returns the raw point untouched when snapping is off (Shift / Snap: OFF)', () => {
    const raw = { x: 123, y: 260, z: 0 };
    const resolution = resolveSnapPoint({ raw, isSnapEnabled: false, referenceTargets, gridSpacingMm: 100 });
    expect(resolution).toEqual({ point: raw, target: 'none' });
  });
});
