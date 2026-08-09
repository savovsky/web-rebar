// Wall geometry math — pure and three-free (rule 2: components never compute this).
// A wall renders as a box: axis length × height × thickness, yawed onto its axis.
import type { Vec3, WallElement } from '@/data/models';

/** Everything the transform needs — WallElement itself satisfies this. */
export type WallGeometryParams = Pick<
  WallElement,
  'startPoint' | 'endPoint' | 'thickness' | 'height' | 'baseElevation'
>;

export interface WallTransform {
  /** Center of the wall box in model space (mm). */
  center: Vec3;
  /** Yaw (radians, about +Y) aligning the box's local +X with the wall axis. */
  rotationY: number;
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
  const dz = wall.endPoint.z - wall.startPoint.z;
  return {
    center: {
      x: (wall.startPoint.x + wall.endPoint.x) / 2,
      y: wall.baseElevation + wall.height / 2,
      z: (wall.startPoint.z + wall.endPoint.z) / 2,
    },
    // A yaw of θ maps local +X to (cosθ, 0, −sinθ) — solve for the axis direction.
    rotationY: normalizeYaw(Math.atan2(-dz, dx)),
    lengthMm: Math.hypot(dx, dz),
  };
}
