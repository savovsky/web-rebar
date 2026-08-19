import { describe, expect, it } from 'vitest';
import { snapPointToGrid } from './snapping';

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
