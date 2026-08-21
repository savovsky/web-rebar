/**
 * Placement group model (§F.2 revised 2026-08-21 — M3 T1, plan Q3-a/Q7-a).
 * A group is a stored placement RULE over a host-local face region: param
 * edits re-generate the bars (M3 T3 commands); moving an individual bar
 * breaks it from the group (Q6 — the bar-side `placementGroupId` handle).
 * Dimensions in millimetres; params only — a group is never a visibility/
 * freeze/lock scope (the Layer Model stays a deferred topic, plan door check).
 */

/**
 * Stable host-local face key of a parametric prism (M3 plan Q3-a): the
 * element-LOCAL box face — never a world-space plane, never a mesh id. The
 * face frame is re-derived from the host transform on every use (the M0
 * getWallFaceFrame path), so host translation/rotation follows for free.
 * All six box faces are enumerated now so M4 elements (slab/beam/column —
 * the same parametric-prism family) slot in without a type migration; M3's
 * engine samples wall faces only (plan scope line). 'length' = the prism
 * axis direction (wall chord), 'thickness' = cross-section width, top/bottom
 * = ±Z (slab faces fold in naturally at M4).
 */
export type ElementFaceKey =
  | 'face:negLength'
  | 'face:posLength'
  | 'face:negThickness'
  | 'face:posThickness'
  | 'face:top'
  | 'face:bottom';

/** Runtime enumeration of the face keys — the M3 T3 command layer validates
 *  group targets against this list (the CommandError input-validation
 *  doorway, plan door check). */
export const ELEMENT_FACE_KEYS: readonly ElementFaceKey[] = [
  'face:negLength',
  'face:posLength',
  'face:negThickness',
  'face:posThickness',
  'face:top',
  'face:bottom',
];

/**
 * Face-local rectangle (M3 plan Q3-a): (u,v) offsets measured along the face
 * frame (u = horizontal along the face, v = "up" the face — the M0 FaceFrame
 * convention). Stored face-local so an arbitrary polygon can extend the shape
 * later (M4 door — plan Q4-a records the extension point).
 */
export interface FaceRegion {
  uMin: number;
  uMax: number;
  vMin: number;
  vMax: number;
}

/** Bar id (project-wide UUID string — the codebase uses plain string ids;
 *  §F.2's `BarId[]` ≡ `string[]`). */
export interface PlacementGroup {
  id: string;
  /** Composite face target (Q3-a): host element + stable local face key.
   *  §F.2's original `targetFaceId: string` resolves to this pair. */
  hostElementId: string;
  faceKey: ElementFaceKey;
  /** Face-local (u,v) region rectangle (Q3-a). */
  region: FaceRegion;
  /** ONE position number for ALL generated bars (Q7-a — that's what a
   *  position number is: same mark = same bar, N instances). Taken from the
   *  project's next-bar-mark counter at placement; user-editing is §J scope. */
  barMark: number;
  barDiameter: number;
  coverDistance: number;
  /** mm center-to-center. */
  barSpacing: number;
  /** mm from the region edge along the run direction (start side). */
  edgeDistanceStart: number;
  /** mm from the region edge along the run direction (end side). */
  edgeDistanceEnd: number;
  orientation: 'horizontal' | 'vertical';
  /** Generated bar ids in layout order — membership lives here; the bar-side
   *  back-reference (`placementGroupId`) is the Q6 detach handle. */
  bars: string[];
}
