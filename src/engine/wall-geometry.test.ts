import { describe, expect, it } from 'vitest';
import { getWallTransform } from './wall-geometry';

const SECTION = { thickness: 200, height: 2800, baseElevation: 0 };

describe('getWallTransform', () => {
  it('aligns local +X with a +X axis (no rotation)', () => {
    const transform = getWallTransform({
      ...SECTION,
      startPoint: { x: 0, y: 0, z: 0 },
      endPoint: { x: 4000, y: 0, z: 0 },
    });
    expect(transform.lengthMm).toBe(4000);
    expect(transform.rotationY).toBe(0);
    expect(transform.center).toEqual({ x: 2000, y: 1400, z: 0 });
  });

  it('yaws -90° for a +Z axis so local +X maps onto +Z', () => {
    const transform = getWallTransform({
      ...SECTION,
      startPoint: { x: 0, y: 0, z: 0 },
      endPoint: { x: 0, y: 0, z: 3000 },
    });
    // Local +X yawed by θ maps to (cosθ, 0, −sinθ) — must equal the axis direction (0, 0, 1).
    expect(transform.rotationY).toBeCloseTo(-Math.PI / 2);
    expect(Math.cos(transform.rotationY)).toBeCloseTo(0);
    expect(-Math.sin(transform.rotationY)).toBeCloseTo(1);
  });

  it('handles a reversed axis (direction −X)', () => {
    const transform = getWallTransform({
      ...SECTION,
      startPoint: { x: 2000, y: 0, z: 0 },
      endPoint: { x: 0, y: 0, z: 0 },
    });
    expect(transform.rotationY).toBeCloseTo(Math.PI);
    expect(transform.center.x).toBe(1000);
  });

  it('computes a diagonal axis length and yaw', () => {
    const transform = getWallTransform({
      ...SECTION,
      startPoint: { x: 0, y: 0, z: 0 },
      endPoint: { x: 300, y: 0, z: 400 },
    });
    expect(transform.lengthMm).toBeCloseTo(500);
    expect(transform.rotationY).toBeCloseTo(Math.atan2(-400, 300));
  });

  it('elevates the center by baseElevation + height/2', () => {
    const transform = getWallTransform({
      ...SECTION,
      baseElevation: 500,
      startPoint: { x: 0, y: 0, z: 0 },
      endPoint: { x: 1000, y: 0, z: 0 },
    });
    expect(transform.center.y).toBe(1900);
  });
});
