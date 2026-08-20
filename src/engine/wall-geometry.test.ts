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
    expect(transform.rotationZ).toBe(0);
    expect(transform.center).toEqual({ x: 2000, y: 0, z: 1400 });
  });

  it('yaws +90° for a +Y axis so local +X maps onto +Y', () => {
    const transform = getWallTransform({
      ...SECTION,
      startPoint: { x: 0, y: 0, z: 0 },
      endPoint: { x: 0, y: 3000, z: 0 },
    });
    // Local +X yawed by θ about +Z maps to (cosθ, sinθ, 0) — must equal the axis direction (0, 1, 0).
    expect(transform.rotationZ).toBeCloseTo(Math.PI / 2);
    expect(Math.cos(transform.rotationZ)).toBeCloseTo(0);
    expect(Math.sin(transform.rotationZ)).toBeCloseTo(1);
  });

  it('handles a reversed axis (direction −X)', () => {
    const transform = getWallTransform({
      ...SECTION,
      startPoint: { x: 2000, y: 0, z: 0 },
      endPoint: { x: 0, y: 0, z: 0 },
    });
    expect(transform.rotationZ).toBeCloseTo(Math.PI);
    expect(transform.center.x).toBe(1000);
  });

  it('computes a diagonal axis length and yaw', () => {
    const transform = getWallTransform({
      ...SECTION,
      startPoint: { x: 0, y: 0, z: 0 },
      endPoint: { x: 300, y: 400, z: 0 },
    });
    expect(transform.lengthMm).toBeCloseTo(500);
    expect(transform.rotationZ).toBeCloseTo(Math.atan2(400, 300));
  });

  it('elevates the center by baseElevation + height/2', () => {
    const transform = getWallTransform({
      ...SECTION,
      baseElevation: 500,
      startPoint: { x: 0, y: 0, z: 0 },
      endPoint: { x: 1000, y: 0, z: 0 },
    });
    expect(transform.center.z).toBe(1900);
  });
});
