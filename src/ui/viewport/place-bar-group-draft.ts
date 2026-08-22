// Place Bar Group flow (§B.6, M3 T4, plan Q4-a/Q5) — React-free, mirrors
// place-bar-draft.ts / section-cut-draft.ts. Gesture model (author decision
// 2026-08-21, refining the in-task Q4-a gesture BEFORE the task landed):
// pointer-down on a wall face CAPTURES it (face + cover side — the Place Bar
// mechanism). Then TWO separate region actions, both committed by
// Enter/Space (never by pointer-up):
//   A. WHOLE-FACE — no region defined: Enter fills the captured face
//      (edge distances stay rule params);
//   B. REGION — drag the two corners on the captured face (pointer-up only
//      DEFINES the region) or click-click them (first click = corner A,
//      second = corner B); Enter commits the defined region.
// The same face-local region + commit model carries over to slab
// reinforcement later (author note, same day). Params edit pre-commit in the
// Properties panel; the preview follows the drag AND the edits live.
// Mid-draft gestures on OTHER walls are ignored (the placeBar pattern);
// Esc cancels via the global shortcut → setTool. Commit dispatches the T3
// placeBarGroup command ONCE (ONE undo level); single-shot auto-return to
// Select, sticky stays (§B.6 rules 1–2). Rejections keep the captured face
// AND the defined region — the user adjusts the params and re-commits.
import { CommandError } from '@/commands/command-error';
import { placeBarGroup } from '@/commands/place-bar-group';
import type { ElementFaceKey, FaceRegion, Vec3, WallElement } from '@/data/models';
import { resolveGroupRegion } from '@/engine/placement-group';
import type { AppDispatch } from '@/stores';
import { clearDraft, setCursorHint, setSelection, setTool, startDraft } from '@/stores/ui-slice';
import { getBarGroupParams } from './bar-group-params';

export const HINT_CAPTURE_FACE =
  'Click a wall face to capture it · Enter places the whole-face group · Esc to cancel';
export const HINT_FACE_CAPTURED =
  'Drag or click-click the region corners — or press Enter for the whole face · params in the Properties panel · Esc to cancel';
export const HINT_REGION_DEFINED =
  'Region set · Enter places the group · re-drag to redefine · Esc to cancel';

interface CaptureBarGroupFaceOptions {
  dispatch: AppDispatch;
  hostElementId: string;
  /** Face key from the raycast hit's mesh-local normal (exact for box faces). */
  faceKey: ElementFaceKey;
  /** Outward face normal in world space — defines the cover side. */
  faceNormal: Vec3;
}

/** Face capture (the Place Bar mechanism): remember which wall face the
 *  group goes into. A fresh capture clears the previous region state. */
export function captureBarGroupFace(options: CaptureBarGroupFaceOptions): void {
  const { dispatch, hostElementId, faceKey, faceNormal } = options;
  clearRegionState();
  dispatch(startDraft({ kind: 'barGroup', hostElementId, faceNormal, faceKey }));
  dispatch(setCursorHint(HINT_FACE_CAPTURED));
}

// --- transient region state (§E — polled per frame by the preview) ---

/** Drag anchor corner (set between pointer-down and pointer-up). */
let regionAnchor: Vec3 | null = null;
/** Click-click corner A awaiting its corner B. */
let pendingCorner: Vec3 | null = null;
/** The last DEFINED region (drag release or click-click pair) — survives the
 *  gesture; Enter commits it; a fresh capture or Esc clears it. */
let definedRegion: FaceRegion | null = null;

export function getRegionAnchor(): Vec3 | null {
  return regionAnchor;
}

export function setRegionAnchor(point: Vec3 | null): void {
  regionAnchor = point;
}

export function getPendingCorner(): Vec3 | null {
  return pendingCorner;
}

export function setPendingCorner(point: Vec3 | null): void {
  pendingCorner = point;
}

export function getDefinedRegion(): FaceRegion | null {
  return definedRegion;
}

export function setDefinedRegion(region: FaceRegion | null): void {
  definedRegion = region;
}

/** Esc / fresh capture: all region state unwinds. */
export function clearRegionState(): void {
  regionAnchor = null;
  pendingCorner = null;
  definedRegion = null;
}

interface CommitBarGroupOptions {
  dispatch: AppDispatch;
  host: WallElement;
  faceKey: ElementFaceKey;
  /** Sticky (double-click-locked) tools stay active after a commit. */
  isSticky: boolean;
}

/** Enter/Space commit: the defined region, or the whole face when none was
 *  drawn (the two Q4-a actions A/B). The §N placeBarGroup command runs ONCE
 *  → ONE undo level; the new group's bars become the selection (the placeBar
 *  precedent). */
export function commitBarGroup(options: CommitBarGroupOptions): void {
  const { dispatch, host, faceKey, isSticky } = options;
  const region = getDefinedRegion() ?? resolveGroupRegion({ host, faceKey, cornerA: null, cornerB: null });
  const params = getBarGroupParams();
  try {
    const result = dispatch(
      placeBarGroup({
        hostElementId: host.id,
        faceKey,
        region,
        diameter: params.diameterMm,
        coverDistance: params.coverMm,
        barSpacing: params.spacingMm,
        edgeDistanceStart: params.edgeDistanceStartMm,
        edgeDistanceEnd: params.edgeDistanceEndMm,
        orientation: params.orientation,
      }),
    );
    dispatch(setSelection({ elementIds: [], barIds: result.barIds, placementGroupIds: [] }));
  } catch (error) {
    if (!(error instanceof CommandError)) throw error;
    // Keep the captured face AND the region: fix the params and re-commit.
    dispatch(setCursorHint(error.message));
    return;
  }
  clearRegionState();
  // Single-shot auto-return (§B.6 rule 1); sticky keeps the tool (rule 2).
  // setTool already resets the draft and the hint.
  if (isSticky) {
    dispatch(clearDraft());
    dispatch(setCursorHint(HINT_CAPTURE_FACE));
    return;
  }
  dispatch(setTool({ tool: 'select' }));
}
