// Unit tests for the M0 Place Bar face math (T8): face capture, on-face
// projection/snapping, and the inward centerline offset.
// Model space is Z-up: plan in X–Y, elevation in Z (data/models/geometry.ts).
import { describe, expect, it } from 'vitest';
import type { WallElement } from '@/data/models';
import {
  getWallFaceFrame,
  offsetFromFace,
  resolveBarCenterline,
  resolveFacePoint,
  wallLocalNormalToWorld,
} from './placement';

/** 4 m wall along +X, 200 mm thick (Y), 2800 mm high (Z), centered at (2000, 0, 1400). */
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
    expect(wallLocalNormalToWorld(wall, { x: 0, y: 1, z: 0 })).toEqual({ x: 0, y: 1, z: 0 });
    expect(wallLocalNormalToWorld(wall, { x: 1, y: 0, z: 0 })).toEqual({ x: 1, y: 0, z: 0 });
  });

  it('rotates normals with the wall yaw', () => {
    // Wall along +Y: rotationZ = atan2(3000, 0) = +π/2; local +Y → (−1, 0, 0).
    const yawedWall: WallElement = { ...wall, endPoint: { x: 0, y: 3000, z: 0 } };
    const normal = wallLocalNormalToWorld(yawedWall, { x: 0, y: 1, z: 0 });
    expect(normal.x).toBeCloseTo(-1);
    expect(normal.y).toBeCloseTo(0);
    expect(normal.z).toBeCloseTo(0);
  });
});

describe('getWallFaceFrame', () => {
  it('frames a vertical side face (origin on the face, u along, v up)', () => {
    const frame = getWallFaceFrame(wall, { x: 0, y: 1, z: 0 });
    expect(frame.origin).toEqual({ x: 2000, y: 100, z: 1400 });
    expect(frame.u).toEqual({ x: -1, y: 0, z: 0 });
    expect(frame.v).toEqual({ x: 0, y: 0, z: 1 });
  });

  it('frames an end face', () => {
    const frame = getWallFaceFrame(wall, { x: 1, y: 0, z: 0 });
    expect(frame.origin).toEqual({ x: 4000, y: 0, z: 1400 });
    expect(frame.v).toEqual({ x: 0, y: 0, z: 1 });
  });

  it('frames the top face (u = wall axis, v across the thickness)', () => {
    const frame = getWallFaceFrame(wall, { x: 0, y: 0, z: 1 });
    expect(frame.origin).toEqual({ x: 2000, y: 0, z: 2800 });
    expect(frame.u.x).toBeCloseTo(1);
    expect(frame.u.y).toBeCloseTo(0);
    expect(Math.hypot(frame.v.x, frame.v.y, frame.v.z)).toBeCloseTo(1);
    expect(frame.v.z).toBeCloseTo(0);
  });

  it('places the origin at half thickness from the center for a diagonal wall', () => {
    const diagonalWall: WallElement = { ...wall, endPoint: { x: 3000, y: 4000, z: 0 } };
    const normal = wallLocalNormalToWorld(diagonalWall, { x: 0, y: 1, z: 0 });
    const frame = getWallFaceFrame(diagonalWall, normal);
    const centerToOrigin = {
      x: frame.origin.x - 1500,
      y: frame.origin.y - 2000,
      z: frame.origin.z - 1400,
    };
    expect(centerToOrigin.x).toBeCloseTo(normal.x * 100);
    expect(centerToOrigin.y).toBeCloseTo(normal.y * 100);
    expect(centerToOrigin.z).toBeCloseTo(0);
  });
});

describe('resolveFacePoint', () => {
  const frame = getWallFaceFrame(wall, { x: 0, y: 1, z: 0 });

  it('snaps the in-plane coordinates to the grid', () => {
    const point = resolveFacePoint({
      frame,
      worldPoint: { x: 2137, y: 100, z: 1562 },
      gridSpacingMm: 100,
      isSnapEnabled: true,
    });
    expect(point).toEqual({ x: 2100, y: 100, z: 1600 });
  });

  it('projects onto the face plane even when snapping is off', () => {
    // y = 132 is 32 mm off the plane — the normal component is dropped.
    const point = resolveFacePoint({
      frame,
      worldPoint: { x: 2137, y: 132, z: 1562 },
      gridSpacingMm: 100,
      isSnapEnabled: false,
    });
    expect(point.x).toBeCloseTo(2137);
    expect(point.y).toBeCloseTo(100);
    expect(point.z).toBeCloseTo(1562);
  });

  it('passes points through unchanged with a zero grid spacing', () => {
    const point = resolveFacePoint({
      frame,
      worldPoint: { x: 2137, y: 100, z: 1562 },
      gridSpacingMm: 0,
      isSnapEnabled: true,
    });
    expect(point.x).toBeCloseTo(2137);
    expect(point.z).toBeCloseTo(1562);
  });
});

describe('offsetFromFace', () => {
  it('moves the point inward against the outward normal', () => {
    // 25 mm cover + 6 mm radius (Ø12) = 31 mm inside the concrete.
    const point = offsetFromFace({
      point: { x: 100, y: 100, z: 200 },
      faceNormal: { x: 0, y: 1, z: 0 },
      distanceMm: 31,
    });
    expect(point).toEqual({ x: 100, y: 69, z: 200 });
  });
});

describe('resolveBarCenterline — concrete cover against ALL faces', () => {
  // +Y face of the default wall: plane y = 100; centerline plane y = 69.
  const frame = getWallFaceFrame(wall, { x: 0, y: 1, z: 0 });
  const coverMm = 25;
  const radiusMm = 6;
  const resolve = (facePoints: { x: number; y: number; z: number }[]) =>
    resolveBarCenterline({ facePoints, frame, wall, coverMm, radiusMm });

  it('offsets the centerline by cover + radius from the captured face', () => {
    const path = resolve([
      { x: 500, y: 100, z: 500 },
      { x: 3000, y: 100, z: 500 },
    ]);
    expect(path[0]).toMatchObject({ x: 500, z: 500 });
    expect(path[0].y).toBeCloseTo(69);
    expect(path[1].y).toBeCloseTo(69);
  });

  it('pulls the bar start/end inside from the end faces — exactly cover (flat end caps)', () => {
    // Clicks exactly on the wall end edges (x = 0 and x = 4000).
    const path = resolve([
      { x: 0, y: 100, z: 500 },
      { x: 4000, y: 100, z: 500 },
    ]);
    expect(path[0].x).toBeCloseTo(25);
    expect(path[1].x).toBeCloseTo(3975);
  });

  it('offsets from both planes forming an edge (top edge click)', () => {
    const path = resolve([
      { x: 500, y: 100, z: 2800 },
      { x: 3000, y: 100, z: 2800 },
    ]);
    // Bar runs along the top face → cylinder surface: cover + radius below it.
    expect(path[0].z).toBeCloseTo(2769);
    expect(path[0].y).toBeCloseTo(69);
  });

  it('offsets from the bottom face as well', () => {
    const path = resolve([
      { x: 500, y: 100, z: 0 },
      { x: 3000, y: 100, z: 0 },
    ]);
    expect(path[0].z).toBeCloseTo(31);
  });

  it('bent corner near the wall end keeps cover + radius from the end face', () => {
    // L-shape: along +X, then bending up (+Z) at the wall end. The corner
    // vertex and the last point bulge toward the end face → cover + radius.
    const path = resolve([
      { x: 500, y: 100, z: 500 },
      { x: 4000, y: 100, z: 500 },
      { x: 4000, y: 100, z: 2000 },
    ]);
    expect(path[0].x).toBeCloseTo(500);
    expect(path[1].x).toBeCloseTo(3969);
    expect(path[2].x).toBeCloseTo(3969);
    expect(path[2].z).toBeCloseTo(2000);
  });

  it('works for a yawed wall (local box clamping, not world axes)', () => {
    // Wall along +Y from the origin: ends at y = 0 and y = 3000.
    const yawedWall: WallElement = { ...wall, endPoint: { x: 0, y: 3000, z: 0 } };
    const normal = wallLocalNormalToWorld(yawedWall, { x: 0, y: 1, z: 0 }); // (−1, 0, 0)
    const yawedFrame = getWallFaceFrame(yawedWall, normal);
    const path = resolveBarCenterline({
      facePoints: [
        { x: -100, y: 0, z: 500 },
        { x: -100, y: 3000, z: 500 },
      ],
      frame: yawedFrame,
      wall: yawedWall,
      coverMm,
      radiusMm,
    });
    expect(path[0].y).toBeCloseTo(25);
    expect(path[1].y).toBeCloseTo(2975);
    expect(path[0].x).toBeCloseTo(-69);
  });

  it('collapses onto the center plane when the cover does not fit the element', () => {
    const thinWall: WallElement = { ...wall, thickness: 40 }; // 40 < 2 × 31
    const thinFrame = getWallFaceFrame(thinWall, { x: 0, y: 1, z: 0 });
    const path = resolveBarCenterline({
      facePoints: [
        { x: 500, y: 20, z: 500 },
        { x: 3000, y: 20, z: 500 },
      ],
      frame: thinFrame,
      wall: thinWall,
      coverMm,
      radiusMm,
    });
    expect(path[0].y).toBeCloseTo(0);
  });
});
