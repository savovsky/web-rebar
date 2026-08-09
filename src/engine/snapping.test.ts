import { describe, expect, it } from 'vitest';
import { snapPointToGrid } from './snapping';

describe('snapPointToGrid', () => {
  it('snaps plan coordinates to the nearest grid multiple', () => {
    expect(snapPointToGrid({ x: 123, y: 0, z: 260 }, 100)).toEqual({ x: 100, y: 0, z: 300 });
  });

  it('rounds halves up', () => {
    expect(snapPointToGrid({ x: 150, y: 0, z: -50 }, 100)).toEqual({ x: 200, y: 0, z: -0 });
  });

  it('handles negative coordinates', () => {
    expect(snapPointToGrid({ x: -120, y: 0, z: -480 }, 100)).toEqual({ x: -100, y: 0, z: -500 });
  });

  it('passes y through untouched', () => {
    expect(snapPointToGrid({ x: 10, y: 42, z: 10 }, 100)).toEqual({ x: 0, y: 42, z: 0 });
  });

  it('returns the point unchanged for non-positive spacing', () => {
    const point = { x: 123, y: 0, z: 456 };
    expect(snapPointToGrid(point, 0)).toEqual(point);
  });
});
