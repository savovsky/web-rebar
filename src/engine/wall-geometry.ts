// Wall geometry math — pure and three-free (rule 2: components never compute this).
// A wall renders as a box: axis length × thickness × height, yawed onto its axis.
// Model space is Z-up: plan in X–Y, elevation in Z (data/models/geometry.ts).
import type { Vec3, WallElement } from '@/data/models';

/** Everything the transform needs — WallElement itself satisfies this. */
export type WallGeometryParams = Pick<
  WallElement,
  'startPoint' | 'endPoint' | 'thickness' | 'height' | 'baseElevation'
>;

export interface WallTransform {
  /** Center of the wall box in model space (mm). */
  center: Vec3;
  /** Yaw (radians, about +Z) aligning the box's local +X with the wall axis. */
  rotationZ: number;
  /** Axis length (mm) — the box's local X extent. */
  lengthMm: number;
}

/** atan2 edge cases: −π ≡ π for a yaw, and −0 is a rendering-no-op but breaks
 *  naive equality checks — collapse both to their canonical forms. */
function normalizeYaw(angle: number): number {
  if (angle === -Math.PI) return Math.PI;
  return angle + 0;
}

export function getWallTransform(wall: WallGeometryParams): WallTransform {
  const dx = wall.endPoint.x - wall.startPoint.x;
  const dy = wall.endPoint.y - wall.startPoint.y;
  return {
    center: {
      x: (wall.startPoint.x + wall.endPoint.x) / 2,
      y: (wall.startPoint.y + wall.endPoint.y) / 2,
      z: wall.baseElevation + wall.height / 2,
    },
    // A yaw of θ about +Z maps local +X to (cosθ, sinθ, 0) — solve for the axis direction.
    rotationZ: normalizeYaw(Math.atan2(dy, dx)),
    lengthMm: Math.hypot(dx, dy),
  };
}

/** Plan footprint corners of the wall box (at baseElevation), in order. */
export function wallFootprintCorners(wall: WallGeometryParams): Vec3[] {
  const transform = getWallTransform(wall);
  const axis: Vec3 = { x: Math.cos(transform.rotationZ), y: Math.sin(transform.rotationZ), z: 0 };
  const across: Vec3 = { x: -Math.sin(transform.rotationZ), y: Math.cos(transform.rotationZ), z: 0 };
  const halfLength = transform.lengthMm / 2;
  const halfThickness = wall.thickness / 2;
  const base: Vec3 = { x: transform.center.x, y: transform.center.y, z: wall.baseElevation };
  const offset = (alongAxis: number, acrossAxis: number): Vec3 => ({
    x: base.x + axis.x * alongAxis + across.x * acrossAxis,
    y: base.y + axis.y * alongAxis + across.y * acrossAxis,
    z: base.z,
  });
  return [
    offset(halfLength, halfThickness),
    offset(halfLength, -halfThickness),
    offset(-halfLength, -halfThickness),
    offset(-halfLength, halfThickness),
  ];
}
