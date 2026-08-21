// T2 bar group layout tests — rule-exactness on known walls over ALL faces
// (positions/count/cover), rotated-wall frames (the M0 Z-rotation math), and
// face-local stability under host translation (M3 plan Q3 acceptance core).
// Crosses the real WASM boundary (initWasmFromDisk).
import { beforeAll, describe, expect, it } from 'vitest';
import { ELEMENT_FACE_KEYS, type Vec3, type WallElement } from '@/data/models';
import {
  faceFrameForKey,
  faceKeyForLocalNormal,
  faceRegionFromCorners,
  generateBarGroupPaths,
  resolveGroupRegion,
  wholeFaceRegion,
} from './placement-group';
import { initWasmFromDisk } from './wasm-test-init';

beforeAll(initWasmFromDisk);

const WALL: WallElement = {
  id: 'wall-1',
  kind: 'wall',
  startPoint: { x: 0, y: 0, z: 0 },
  endPoint: { x: 4000, y: 0, z: 0 },
  thickness: 200,
  height: 2800,
  baseElevation: 0,
};

const RULE = {
  coverMm: 25,
  diameterMm: 12,
  spacingMm: 150,
  edgeDistanceStartMm: 60,
  edgeDistanceEndMm: 60,
  orientation: 'horizontal' as const,
};
/** inward = cover + radius. */
const INWARD = 31;
const FULL_FACE_REGION = { uMin: -2000, uMax: 2000, vMin: -1400, vMax: 1400 };

// mm tolerance matching the engine's own (1e-6): applyConcreteCover's
// normalize(v·(1/len)) rounds mathematically-unit directions to 1−ulp, and
// axisInset then adds ~1e-7 mm of radius inset — pre-existing M0 behavior,
// far below every domain tolerance.
function expectClose(actual: number, expected: number): void {
  expect(Math.abs(actual - expected)).toBeLessThan(1e-6);
}

describe('face frame per face key', () => {
  it('resolves the M0 face frame for all six box faces', () => {
    for (const faceKey of ELEMENT_FACE_KEYS) {
      const frame = faceFrameForKey(WALL, faceKey);
      const length = (v: Vec3): number => Math.hypot(v.x, v.y, v.z);
      expectClose(length(frame.normal), 1);
      expectClose(length(frame.u), 1);
      // Origin lies on the face plane: posThickness → y = +half thickness.
      if (faceKey === 'face:posThickness') expectClose(frame.origin.y, 100);
      if (faceKey === 'face:negThickness') expectClose(frame.origin.y, -100);
      if (faceKey === 'face:posLength') expectClose(frame.origin.x, 4000);
      if (faceKey === 'face:top') expectClose(frame.origin.z, 2800);
      if (faceKey === 'face:bottom') expectClose(frame.origin.z, 0);
    }
  });
});

describe('rule-exactness', () => {
  it('horizontal bars on posThickness keep the M0 u-axis convention', () => {
    // posThickness: world normal (0,1,0), face u axis = −X (M0 FaceFrame
    // rule u = cross(+Z, normal)) — a bar runs start.x 3975 → end.x 25.
    const paths = generateBarGroupPaths({
      host: WALL,
      faceKey: 'face:posThickness',
      region: FULL_FACE_REGION,
      ...RULE,
    });
    // positions v: −1340 + k·150 while ≤ 1340 → 18 bars.
    expect(paths).toHaveLength(18);
    const first = paths[0];
    expect(first).toHaveLength(2);
    expectClose(first[0].x, 3975);
    expectClose(first[1].x, 25);
    // Cover kept from the captured face: y = 100 − (cover + radius).
    expectClose(first[0].y, 100 - INWARD);
    expectClose(first[0].z, 1400 - 1340);
    expectClose(first[0].z, 60);
    // Last bar: largest −1340 + k·150 ≤ 1340 → k = 17 → v = 1210 → z = 2610.
    expectClose(paths[17][0].z, 2610);
  });

  it('negThickness mirrors to the +X u axis', () => {
    const paths = generateBarGroupPaths({
      host: WALL,
      faceKey: 'face:negThickness',
      region: FULL_FACE_REGION,
      ...RULE,
    });
    expect(paths).toHaveLength(18);
    expectClose(paths[0][0].x, 25);
    expectClose(paths[0][1].x, 3975);
    // Inward from y = −100 by 31.
    expectClose(paths[0][0].y, -69);
  });

  it('vertical orientation runs bars along v (z) on a vertical face', () => {
    const paths = generateBarGroupPaths({
      host: WALL,
      faceKey: 'face:negThickness',
      region: FULL_FACE_REGION,
      ...RULE,
      orientation: 'vertical',
      spacingMm: 250,
    });
    // u positions: −1940 + k·250 while ≤ 1940 → k ≤ 15.52 → 16 bars.
    expect(paths).toHaveLength(16);
    // Endpoints inset by cover from the v (z) region edges.
    expectClose(paths[0][0].x, 60);
    expectClose(paths[0][0].z, 25);
    expectClose(paths[0][1].z, 2775);
    // Last bar: u = −1940 + 15·250 = 1810 → x = 3810.
    expectClose(paths[15][0].x, 3810);
  });

  it('top face offsets inward along −Z', () => {
    const paths = generateBarGroupPaths({
      host: WALL,
      faceKey: 'face:top',
      region: { uMin: -2000, uMax: 2000, vMin: -100, vMax: 100 },
      ...RULE,
    });
    expect(paths).toHaveLength(1); // span 200, edges 60+60 = 120 → one bar at −40
    expectClose(paths[0][0].z, 2800 - INWARD);
    expectClose(paths[0][0].y, -40);
  });

  it('bottom face offsets inward along +Z', () => {
    const paths = generateBarGroupPaths({
      host: WALL,
      faceKey: 'face:bottom',
      region: { uMin: -2000, uMax: 2000, vMin: -100, vMax: 100 },
      ...RULE,
    });
    expect(paths).toHaveLength(1);
    expectClose(paths[0][0].z, INWARD);
    // bottom face v axis = −Y (M0 convention for horizontal faces).
    expectClose(paths[0][0].y, 40);
  });

  it('length faces clamp the inward offset against the wall length', () => {
    const paths = generateBarGroupPaths({
      host: WALL,
      faceKey: 'face:posLength',
      region: { uMin: -100, uMax: 100, vMin: -1400, vMax: 1400 },
      ...RULE,
    });
    expect(paths).toHaveLength(18);
    expectClose(paths[0][0].x, 4000 - INWARD);
    // u axis = +Y; endpoints inset by cover from the thickness edges.
    expectClose(paths[0][0].y, -75);
    expectClose(paths[0][1].y, 75);
  });

  it('applyConcreteCover clamps bars closer than cover+r to ALL element faces', () => {
    // Edge distance 10 < cover+r 31: the first bar is pulled to z = 31 so
    // the bar keeps 25 mm cover from the wall's bottom face.
    const paths = generateBarGroupPaths({
      host: WALL,
      faceKey: 'face:negThickness',
      region: FULL_FACE_REGION,
      ...RULE,
      edgeDistanceStartMm: 10,
      edgeDistanceEndMm: 10,
    });
    expectClose(paths[0][0].z, INWARD);
    // The next bar (z = 160) is already inside the clamp and untouched.
    expectClose(paths[1][0].z, 160);
  });

  it('applyConcreteCover clamps endpoints that poke past the wall start/end faces', () => {
    // Region sticks 100 mm out of the wall on both sides — endpoints get
    // clamped to exactly cover (25 mm) from the end faces.
    const paths = generateBarGroupPaths({
      host: WALL,
      faceKey: 'face:negThickness',
      region: { uMin: -2100, uMax: 2100, vMin: -1400, vMax: 1400 },
      ...RULE,
    });
    expectClose(paths[0][0].x, 25);
    expectClose(paths[0][1].x, 3975);
  });
});

describe('host-follow stability (Q3)', () => {
  it('face-local layout is invariant under host translation', () => {
    const movedWall: WallElement = {
      ...WALL,
      startPoint: { x: 1000, y: -500, z: 0 },
      endPoint: { x: 5000, y: -500, z: 0 },
    };
    const params = {
      faceKey: 'face:posThickness' as const,
      region: FULL_FACE_REGION,
      ...RULE,
    };
    const base = generateBarGroupPaths({ host: WALL, ...params });
    const moved = generateBarGroupPaths({ host: movedWall, ...params });
    expect(moved).toHaveLength(base.length);
    for (let bar = 0; bar < base.length; bar++) {
      for (let endpoint = 0; endpoint < 2; endpoint++) {
        expectClose(moved[bar][endpoint].x, base[bar][endpoint].x + 1000);
        expectClose(moved[bar][endpoint].y, base[bar][endpoint].y - 500);
        expectClose(moved[bar][endpoint].z, base[bar][endpoint].z);
      }
    }
  });

  it('face-local layout follows a yawed host (the M0 Z-rotation math)', () => {
    // Wall yawed 30°: axis = (cos30, sin30, 0). posThickness world normal =
    // (−sin30, cos30, 0) — exact values from the M0 rotation.
    const cos30 = Math.cos(Math.PI / 6);
    const sin30 = Math.sin(Math.PI / 6);
    const yawedWall: WallElement = {
      ...WALL,
      startPoint: { x: 1000, y: 2000, z: 0 },
      endPoint: { x: 1000 + 4000 * cos30, y: 2000 + 4000 * sin30, z: 0 },
    };
    const paths = generateBarGroupPaths({
      host: yawedWall,
      faceKey: 'face:posThickness',
      region: FULL_FACE_REGION,
      ...RULE,
    });
    expect(paths).toHaveLength(18);
    // First bar: face-local (u = −1975, v = −1340), origin = center +
    // normal·100, point = origin + u·uAxis + v·vAxis − normal·31.
    const center = {
      x: 1000 + 2000 * cos30,
      y: 2000 + 2000 * sin30,
      z: 1400,
    };
    const normal = { x: -sin30, y: cos30, z: 0 };
    const uAxis = { x: -cos30, y: -sin30, z: 0 }; // cross(+Z, normal)
    const expected = {
      x: center.x + normal.x * 100 + uAxis.x * -1975 - normal.x * INWARD,
      y: center.y + normal.y * 100 + uAxis.y * -1975 - normal.y * INWARD,
      z: center.z - 1340,
    };
    expectClose(paths[0][0].x, expected.x);
    expectClose(paths[0][0].y, expected.y);
    expectClose(paths[0][0].z, expected.z);
  });
});

describe('in-task deviation points', () => {
  it('spacing larger than the region yields a single bar', () => {
    const paths = generateBarGroupPaths({
      host: WALL,
      faceKey: 'face:posThickness',
      region: FULL_FACE_REGION,
      ...RULE,
      spacingMm: 5000,
    });
    expect(paths).toHaveLength(1);
    expectClose(paths[0][0].z, 60); // at the start edge distance
  });

  it('edge-exact final bar still lands (tolerance on the span comparison)', () => {
    const paths = generateBarGroupPaths({
      host: WALL,
      faceKey: 'face:posThickness',
      region: { uMin: -2000, uMax: 2000, vMin: -150, vMax: 150 },
      ...RULE,
      spacingMm: 200,
      edgeDistanceStartMm: 50,
      edgeDistanceEndMm: 50,
    });
    // Span 300, edges 50+50 → positions −100 and +100 exactly → 2 bars.
    expect(paths).toHaveLength(2);
    expectClose(paths[0][0].z, -100 + 1400);
    expectClose(paths[1][0].z, 100 + 1400);
  });
});

describe('insane params throw (T3 maps them to CommandError)', () => {
  const base = {
    host: WALL,
    faceKey: 'face:posThickness' as const,
    region: FULL_FACE_REGION,
    ...RULE,
  };
  it('rejects non-positive spacing / diameter', () => {
    expect(() => generateBarGroupPaths({ ...base, spacingMm: 0 })).toThrow(/spacing/);
    expect(() => generateBarGroupPaths({ ...base, diameterMm: 0 })).toThrow(/diameter/);
  });
  it('rejects cover beyond the element dimension', () => {
    // cover 100 + radius 6 ≥ thickness/2 = 100 → cannot fit.
    expect(() => generateBarGroupPaths({ ...base, coverMm: 100 })).toThrow(/cover \+ radius/);
  });
  it('rejects edge distances past the region span', () => {
    expect(() =>
      generateBarGroupPaths({
        ...base,
        edgeDistanceStartMm: 2000,
        edgeDistanceEndMm: 2000,
      }),
    ).toThrow(/edge distances/);
  });
  it('rejects a degenerate region and non-finite numbers', () => {
    expect(() =>
      generateBarGroupPaths({
        ...base,
        region: { uMin: 5, uMax: 5, vMin: 0, vMax: 10 },
      }),
    ).toThrow(/region/);
    expect(() => generateBarGroupPaths({ ...base, spacingMm: Number.NaN })).toThrow(/finite/);
  });
});

// --- T4 tool draft-state math: face capture, whole-face default, drag region ---

describe('faceKeyForLocalNormal (T4 face capture)', () => {
  it('maps all six box normals to their face keys', () => {
    expect(faceKeyForLocalNormal({ x: 1, y: 0, z: 0 })).toBe('face:posLength');
    expect(faceKeyForLocalNormal({ x: -1, y: 0, z: 0 })).toBe('face:negLength');
    expect(faceKeyForLocalNormal({ x: 0, y: 1, z: 0 })).toBe('face:posThickness');
    expect(faceKeyForLocalNormal({ x: 0, y: -1, z: 0 })).toBe('face:negThickness');
    expect(faceKeyForLocalNormal({ x: 0, y: 0, z: 1 })).toBe('face:top');
    expect(faceKeyForLocalNormal({ x: 0, y: 0, z: -1 })).toBe('face:bottom');
  });
});

describe('wholeFaceRegion (T4 Q4-a default shortcut)', () => {
  it('spans the full face extents for every key class', () => {
    expect(wholeFaceRegion(WALL, 'face:posThickness')).toEqual({
      uMin: -2000,
      uMax: 2000,
      vMin: -1400,
      vMax: 1400,
    });
    // Length faces: u runs across the thickness, v up the height.
    expect(wholeFaceRegion(WALL, 'face:posLength')).toEqual({
      uMin: -100,
      uMax: 100,
      vMin: -1400,
      vMax: 1400,
    });
    // Top/bottom: u along the axis, v across the thickness.
    expect(wholeFaceRegion(WALL, 'face:top')).toEqual({
      uMin: -2000,
      uMax: 2000,
      vMin: -100,
      vMax: 100,
    });
  });

  it('is invariant under host translation and yaw (face-local, Q3)', () => {
    const cos30 = Math.cos(Math.PI / 6);
    const sin30 = Math.sin(Math.PI / 6);
    const yawedWall: WallElement = {
      ...WALL,
      startPoint: { x: 1000, y: 2000, z: 0 },
      endPoint: { x: 1000 + 4000 * cos30, y: 2000 + 4000 * sin30, z: 0 },
    };
    const base = wholeFaceRegion(WALL, 'face:posThickness');
    const yawed = wholeFaceRegion(yawedWall, 'face:posThickness');
    // Hypot-derived length reintroduces ~1 ulp of float noise under yaw.
    expectClose(yawed.uMin, base.uMin);
    expectClose(yawed.uMax, base.uMax);
    expectClose(yawed.vMin, base.vMin);
    expectClose(yawed.vMax, base.vMax);
  });

  it('drives the same rule-exact layout as the hand-written full-face rect', () => {
    const paths = generateBarGroupPaths({
      host: WALL,
      faceKey: 'face:posThickness',
      region: wholeFaceRegion(WALL, 'face:posThickness'),
      ...RULE,
    });
    expect(paths).toHaveLength(18); // identical to the FULL_FACE_REGION corpus
    expectClose(paths[0][0].x, 3975);
    expectClose(paths[0][0].z, 60);
  });
});

describe('faceRegionFromCorners (T4 two-corner drag)', () => {
  // posThickness frame: origin (2000, 100, 1400), u = −X, v = +Z.
  const frame = faceFrameForKey(WALL, 'face:posThickness');
  const cornerA: Vec3 = { x: 1000, y: 100, z: 500 }; // face-local (u=1000, v=−900)
  const cornerB: Vec3 = { x: 3000, y: 100, z: 2000 }; // face-local (u=−1000, v=600)
  const expected = { uMin: -1000, uMax: 1000, vMin: -900, vMax: 600 };

  it('normalizes either corner order', () => {
    expect(faceRegionFromCorners({ frame, cornerA, cornerB })).toEqual(expected);
    expect(faceRegionFromCorners({ frame, cornerA: cornerB, cornerB: cornerA })).toEqual(expected);
  });

  it('drops the normal component (off-plane corners project onto the face)', () => {
    const offPlane: Vec3 = { x: 1000, y: 0, z: 500 }; // 100 mm off the face plane
    expect(faceRegionFromCorners({ frame, cornerA: offPlane, cornerB })).toEqual(expected);
  });
});

describe('resolveGroupRegion (T4 gesture → region)', () => {
  it('returns the whole face when no drag corners are given', () => {
    expect(
      resolveGroupRegion({ host: WALL, faceKey: 'face:posThickness', cornerA: null, cornerB: null }),
    ).toEqual(wholeFaceRegion(WALL, 'face:posThickness'));
  });

  it('returns the dragged rect when both corners are given', () => {
    const region = resolveGroupRegion({
      host: WALL,
      faceKey: 'face:posThickness',
      cornerA: { x: 1000, y: 100, z: 500 },
      cornerB: { x: 3000, y: 100, z: 2000 },
    });
    expect(region).toEqual({ uMin: -1000, uMax: 1000, vMin: -900, vMax: 600 });
    // The dragged region generates a rule-exact sub-layout (the commit path).
    const paths = generateBarGroupPaths({
      host: WALL,
      faceKey: 'face:posThickness',
      region,
      ...RULE,
    });
    // positions v: −840 + k·150 while ≤ 540 → 10 bars.
    expect(paths).toHaveLength(10);
    expectClose(paths[0][0].z, 1400 - 840);
  });
});
