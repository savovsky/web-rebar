// Shared on-face point resolution (§B.3): a raycast/ray point on a captured
// wall face → the snapped, face-projected point. Extracted from WallMesh so
// the Place Bar (path clicks) and Place Bar Group (region corners, M3 T4)
// flows resolve identically. A reference endpoint/midpoint within tolerance
// wins over the face-grid snap; the projection onto the face plane keeps the
// result exactly on the face. React-free composition of engine functions
// (rule 2 — no domain math in components).
import type { Vec3 } from '@/data/models';
import { getWallFaceFrame, resolveFacePoint } from '@/engine/placement';
import { type ReferenceSnapTarget, findReferenceSnap } from '@/engine/reference-snapping';
import { REFERENCE_SNAP_TOLERANCE_GRID_CELLS } from '@/engine/snapping';
import type { WallGeometryParams } from '@/engine/wall-geometry';

export interface ResolveOnFacePointOptions {
  wall: WallGeometryParams;
  /** Outward normal of the captured face (world space). */
  faceNormal: Vec3;
  /** Raw pointer point in model space — a mesh hit, or the ray ∩ face-plane
   *  point during a captured drag (the cursor may have left the mesh). */
  worldPoint: Vec3;
  /** Snap toggle already AND-ed with the Shift key by the caller (Shift
   *  disables ALL snapping, §B.3). */
  isSnapActive: boolean;
  referenceTargets: ReferenceSnapTarget[];
  gridSpacingMm: number;
}

export function resolveOnFacePoint({
  wall,
  faceNormal,
  worldPoint,
  isSnapActive,
  referenceTargets,
  gridSpacingMm,
}: ResolveOnFacePointOptions): Vec3 {
  const hit = isSnapActive
    ? findReferenceSnap({
        point: worldPoint,
        targets: referenceTargets,
        toleranceMm: gridSpacingMm * REFERENCE_SNAP_TOLERANCE_GRID_CELLS,
      })
    : null;
  return resolveFacePoint({
    frame: getWallFaceFrame(wall, faceNormal),
    // The reference hit snaps in plan (z stays the raw face hit's); a hit
    // must survive EXACTLY — re-rounding the projected u/v to the grid
    // would pull the point off the traced point.
    worldPoint: hit ? { x: hit.x, y: hit.y, z: worldPoint.z } : worldPoint,
    gridSpacingMm,
    isSnapEnabled: hit === null && isSnapActive,
  });
}
