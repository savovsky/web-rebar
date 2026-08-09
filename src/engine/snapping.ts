// Grid snapping (§B.3) — pure math, no three.js dependency. Shift-disables-snap
// is decided by the event handler; this only does the rounding.
import type { Vec3 } from '@/data/models';

/** Snaps plan coordinates (x/z) to the nearest grid multiple; y passes through. */
export function snapPointToGrid(point: Vec3, spacingMm: number): Vec3 {
  if (spacingMm <= 0) return point;
  return {
    x: Math.round(point.x / spacingMm) * spacingMm,
    y: point.y,
    z: Math.round(point.z / spacingMm) * spacingMm,
  };
}
