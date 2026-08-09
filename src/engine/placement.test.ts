// Unit tests for the M0 Place Bar face math (T8): face capture, on-face
// projection/snapping, and the inward centerline offset.
import { describe, expect, it } from 'vitest';
import type { WallElement } from '@/data/models';
import {
  getWallFaceFrame,
  offsetFromFace,
  resolveBarCenterline,
  resolveFacePoint,
  wallLocalNormalToWorld,
} from './placement';

/** 4 m wall along +X, 200 mm thick, 2800 mm high, centered at (2000, 1400, 0). */
const wall: WallElement = {
  id: 'wall-1',
  kind: 'wall',
  startPoint: { x: 0, y: 0, z: 0 },
  endPoint: { x: 4000, y: 0, z: 0 },
  thickness: 200,
  height: 2800,
  baseElevation: 0,
};

describe('wallLocalNormalToWorld', () => {
  it('keeps normals of an axis-aligned wall unchanged', () => {
    expect(wallLocalNormalToWorld(wall, { x: 0, y: 0, z: 1 })).toEqual({ x: 0, y: 0, z: 1 });
    expect(wallLocalNormalToWorld(wall, { x: 1, y: 0, z: 0 })).toEqual({ x: 1, y: 0, z: 0 });
  });

  it('rotates normals with the wall yaw', () => {
    // Wall along +Z: rotationY = atan2(−3000, 0) = −π/2.
    const yawedWall: WallElement = { ...wall, endPoint: { x: 0, y: 0, z: 3000 } };
    const normal = wallLocalNormalToWorld(yawedWall, { x: 0, y: 0, z: 1 });
    expect(normal.x).toBeCloseTo(-1);
    expect(normal.y).toBeCloseTo(0);
    expect(normal.z).toBeCloseTo(0);
  });
});

describe('getWallFaceFrame', () => {
  it('frames a vertical side face (origin on the face, u along, v up)', () => {
    const frame = getWallFaceFrame(wall, { x: 0, y: 0, z: 1 });
    expect(frame.origin).toEqual({ x: 2000, y: 1400, z: 100 });
    expect(frame.u).toEqual({ x: 1, y: 0, z: 0 });
    expect(frame.v).toEqual({ x: 0, y: 1, z: 0 });
  });

  it('frames an end face', () => {
    const frame = getWallFaceFrame(wall, { x: 1, y: 0, z: 0 });
    expect(frame.origin).toEqual({ x: 4000, y: 1400, z: 0 });
    expect(frame.v).toEqual({ x: 0, y: 1, z: 0 });
  });

  it('frames the top face (u = wall axis, v across the thickness)', () => {
    const frame = getWallFaceFrame(wall, { x: 0, y: 1, z: 0 });
    expect(frame.origin).toEqual({ x: 2000, y: 2800, z: 0 });
    expect(frame.u.x).toBeCloseTo(1);
    expect(frame.u.z).toBeCloseTo(0);
    expect(Math.hypot(frame.v.x, frame.v.y, frame.v.z)).toBeCloseTo(1);
    expect(frame.v.y).toBeCloseTo(0);
  });

  it('places the origin at half thickness from the center for a diagonal wall', () => {
    const diagonalWall: WallElement = { ...wall, endPoint: { x: 3000, y: 0, z: 4000 } };
    const normal = wallLocalNormalToWorld(diagonalWall, { x: 0, y: 0, z: 1 });
    const frame = getWallFaceFrame(diagonalWall, normal);
    const centerToOrigin = {
      x: frame.origin.x - 1500,
      y: frame.origin.y - 1400,
      z: frame.origin.z - 2000,
    };
    expect(centerToOrigin.x).toBeCloseTo(normal.x * 100);
    expect(centerToOrigin.y).toBeCloseTo(0);
    expect(centerToOrigin.z).toBeCloseTo(normal.z * 100);
  });
});

describe('resolveFacePoint', () => {
  const frame = getWallFaceFrame(wall, { x: 0, y: 0, z: 1 });

  it('snaps the in-plane coordinates to the grid', () => {
    const point = resolveFacePoint({
      frame,
      worldPoint: { x: 2137, y: 1562, z: 100 },
      gridSpacingMm: 100,
      isSnapEnabled: true,
    });
    expect(point).toEqual({ x: 2100, y: 1600, z: 100 });
  });

  it('projects onto the face plane even when snapping is off', () => {
    // z = 132 is 32 mm off the plane — the normal component is dropped.
    const point = resolveFacePoint({
      frame,
      worldPoint: { x: 2137, y: 1562, z: 132 },
      gridSpacingMm: 100,
      isSnapEnabled: false,
    });
    expect(point.x).toBeCloseTo(2137);
    expect(point.y).toBeCloseTo(1562);
    expect(point.z).toBeCloseTo(100);
  });

  it('passes points through unchanged with a zero grid spacing', () => {
    const point = resolveFacePoint({
      frame,
      worldPoint: { x: 2137, y: 1562, z: 100 },
      gridSpacingMm: 0,
      isSnapEnabled: true,
    });
    expect(point.x).toBeCloseTo(2137);
    expect(point.y).toBeCloseTo(1562);
  });
});

describe('offsetFromFace', () => {
  it('moves the point inward against the outward normal', () => {
    // 25 mm cover + 6 mm radius (Ø12) = 31 mm inside the concrete.
    const point = offsetFromFace({
      point: { x: 100, y: 200, z: 100 },
      faceNormal: { x: 0, y: 0, z: 1 },
      distanceMm: 31,
    });
    expect(point).toEqual({ x: 100, y: 200, z: 69 });
  });
});

describe('resolveBarCenterline — concrete cover against ALL faces', () => {
  // +Z face of the default wall: plane z = 100; centerline plane z = 69.
  const frame = getWallFaceFrame(wall, { x: 0, y: 0, z: 1 });
  const coverMm = 25;
  const radiusMm = 6;
  const resolve = (facePoints: { x: number; y: number; z: number }[]) =>
    resolveBarCenterline({ facePoints, frame, wall, coverMm, radiusMm });

  it('offsets the centerline by cover + radius from the captured face', () => {
    const path = resolve([
      { x: 500, y: 500, z: 100 },
      { x: 3000, y: 500, z: 100 },
    ]);
    expect(path[0]).toMatchObject({ x: 500, y: 500 });
    expect(path[0].z).toBeCloseTo(69);
    expect(path[1].z).toBeCloseTo(69);
  });

  it('pulls the bar start/end inside from the end faces — exactly cover (flat end caps)', () => {
    // Clicks exactly on the wall end edges (x = 0 and x = 4000).
    const path = resolve([
      { x: 0, y: 500, z: 100 },
      { x: 4000, y: 500, z: 100 },
    ]);
    expect(path[0].x).toBeCloseTo(25);
    expect(path[1].x).toBeCloseTo(3975);
  });

  it('offsets from both planes forming an edge (top edge click)', () => {
    const path = resolve([
      { x: 500, y: 2800, z: 100 },
      { x: 3000, y: 2800, z: 100 },
    ]);
    // Bar runs along the top face → cylinder surface: cover + radius below it.
    expect(path[0].y).toBeCloseTo(2769);
    expect(path[0].z).toBeCloseTo(69);
  });

  it('offsets from the bottom face as well', () => {
    const path = resolve([
      { x: 500, y: 0, z: 100 },
      { x: 3000, y: 0, z: 100 },
    ]);
    expect(path[0].y).toBeCloseTo(31);
  });

  it('bent corner near the wall end keeps cover + radius from the end face', () => {
    // L-shape: along +X, then bending up (+Y) at the wall end. The corner
    // vertex and the last point bulge toward the end face → cover + radius.
    const path = resolve([
      { x: 500, y: 500, z: 100 },
      { x: 4000, y: 500, z: 100 },
      { x: 4000, y: 2000, z: 100 },
    ]);
    expect(path[0].x).toBeCloseTo(500);
    expect(path[1].x).toBeCloseTo(3969);
    expect(path[2].x).toBeCloseTo(3969);
    expect(path[2].y).toBeCloseTo(2000);
  });

  it('works for a yawed wall (local box clamping, not world axes)', () => {
    // Wall along +Z from the origin: ends at z = 0 and z = 3000.
    const yawedWall: WallElement = { ...wall, endPoint: { x: 0, y: 0, z: 3000 } };
    const normal = wallLocalNormalToWorld(yawedWall, { x: 0, y: 0, z: 1 }); // (−1, 0, 0)
    const yawedFrame = getWallFaceFrame(yawedWall, normal);
    const path = resolveBarCenterline({
      facePoints: [
        { x: -100, y: 500, z: 0 },
        { x: -100, y: 500, z: 3000 },
      ],
      frame: yawedFrame,
      wall: yawedWall,
      coverMm,
      radiusMm,
    });
    expect(path[0].z).toBeCloseTo(25);
    expect(path[1].z).toBeCloseTo(2975);
    expect(path[0].x).toBeCloseTo(-69);
  });

  it('collapses onto the center plane when the cover does not fit the element', () => {
    const thinWall: WallElement = { ...wall, thickness: 40 }; // 40 < 2 × 31
    const thinFrame = getWallFaceFrame(thinWall, { x: 0, y: 0, z: 1 });
    const path = resolveBarCenterline({
      facePoints: [
        { x: 500, y: 500, z: 20 },
        { x: 3000, y: 500, z: 20 },
      ],
      frame: thinFrame,
      wall: thinWall,
      coverMm,
      radiusMm,
    });
    expect(path[0].z).toBeCloseTo(0);
  });
});
