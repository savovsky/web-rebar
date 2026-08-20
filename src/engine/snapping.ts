// Snapping (§B.3) — pure math, no three.js dependency. Shift-disables-snap is
// decided by the event handler; this only does the resolution. M2 T6 added
// reference-linework endpoint/midpoint snaps (the §B.3 rows' first real
// target): a reference target within tolerance beats the grid (object snap =
// High priority, grid = Low).
import type { Vec3 } from '@/data/models';
import { type ReferenceSnapTarget, findReferenceSnap } from './reference-snapping';

/** Snaps plan coordinates (x/y) to the nearest grid multiple; z passes through. */
export function snapPointToGrid(point: Vec3, spacingMm: number): Vec3 {
  if (spacingMm <= 0) return point;
  return {
    x: Math.round(point.x / spacingMm) * spacingMm,
    y: Math.round(point.y / spacingMm) * spacingMm,
    z: point.z,
  };
}

/** Reference snaps win inside half a grid cell — the tolerance scales with
 *  the grid the user works on until the configurable 5–20 px screen aperture
 *  (§B.3) gets its settings UI (task-log decision, M2 T6). Exported: the
 *  Place Bar face flow composes its own (u,v) snap and needs the same value. */
export const REFERENCE_SNAP_TOLERANCE_GRID_CELLS = 0.5;

export interface ResolveSnapPointOptions {
  raw: Vec3;
  /** Already AND-ed with the Shift key by the event handler (Shift disables
   *  ALL snapping, §B.3) and with the Snap: OFF toggle. */
  isSnapEnabled: boolean;
  /** Endpoint/midpoint targets of the visible reference documents. */
  referenceTargets: readonly ReferenceSnapTarget[];
  gridSpacingMm: number;
}

export interface SnapResolution {
  point: Vec3;
  /** 'reference' = a linework endpoint/midpoint won (callers must NOT
   *  re-round the result to a grid — the traced point must survive exactly);
   *  'grid' = plain grid rounding; 'none' = snapping disabled. */
  target: 'reference' | 'grid' | 'none';
}

/**
 * Placement-draft point resolution (§B.3): reference endpoint/midpoint within
 * half a grid cell beats grid rounding; both off when snapping is disabled.
 * Only x/y are snapped — z passes through (plan tools are z-indifferent; the
 * Place Bar face flow re-projects onto the captured face plane).
 */
export function resolveSnapPoint({
  raw,
  isSnapEnabled,
  referenceTargets,
  gridSpacingMm,
}: ResolveSnapPointOptions): SnapResolution {
  if (!isSnapEnabled) return { point: raw, target: 'none' };
  const hit = findReferenceSnap({
    point: raw,
    targets: referenceTargets,
    toleranceMm: gridSpacingMm * REFERENCE_SNAP_TOLERANCE_GRID_CELLS,
  });
  if (hit) return { point: { x: hit.x, y: hit.y, z: raw.z }, target: 'reference' };
  return { point: snapPointToGrid(raw, gridSpacingMm), target: 'grid' };
}
