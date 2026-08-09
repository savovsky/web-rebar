// Boundary round-trip tests for the T9 section function — prove the §D.3
// flat-array contract against the real Rust/WASM build (M0 risk: Rust↔TS
// data passing). Detailed edge cases live in core/src/section.rs unit tests.
import { beforeAll, describe, expect, it } from 'vitest';
import { planePolylineIntersection } from './wasm-bridge';
import { initWasmFromDisk } from './wasm-test-init';

beforeAll(initWasmFromDisk);

/** Vertical plane x = 500. */
const PLANE = {
  planeOrigin: { x: 500, y: 0, z: 0 },
  planeNormal: { x: 1, y: 0, z: 0 },
} as const;

describe('planePolylineIntersection (WASM round-trip)', () => {
  it('returns the interpolated point for a crossing segment', () => {
    const hits = planePolylineIntersection({
      ...PLANE,
      pathPoints: new Float64Array([0, 0, 0, 1000, 0, 0]),
    });
    expect([...hits]).toEqual([500, 0, 0]);
  });

  it('returns one point per crossing for a bent path (0..n per bar)', () => {
    const hits = planePolylineIntersection({
      ...PLANE,
      pathPoints: new Float64Array([0, 0, 0, 1000, 0, 0, 0, 500, 0]),
    });
    expect([...hits]).toEqual([500, 0, 0, 500, 250, 0]);
  });

  it('counts a shared vertex on the plane exactly once', () => {
    const hits = planePolylineIntersection({
      ...PLANE,
      pathPoints: new Float64Array([0, 0, 0, 500, 0, 0, 1000, 0, 0]),
    });
    expect([...hits]).toEqual([500, 0, 0]);
  });

  it('returns an empty array when the path stays off the plane', () => {
    const hits = planePolylineIntersection({
      ...PLANE,
      pathPoints: new Float64Array([600, 0, 0, 1000, 300, 0]),
    });
    expect(hits.length).toBe(0);
  });
});
