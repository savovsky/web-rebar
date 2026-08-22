// Place Bar click flow (§B.6, chained placement revised 2026-08-08 — mirrors
// the Place Wall flow with one crucial domain difference): click 1 captures a
// wall face (host + outward normal); the 2nd path click CREATES the bar via
// the §N placeBar command and every further click EXTENDS the same bar via
// extendBar — the chain is ONE bar with bending places (a single position for
// the schedule §J and bar counts), never several separate bars. Esc (global
// tool shortcut → setTool) finishes the bar and exits — no Enter confirmation.
// Cover/diameter defaults come from the DIN/EC2 catalog seed via the placeBar
// command module; the centerline keeps the cover from ALL wall faces
// (engine/placement — edges, start, end), not just the captured face.
import { CommandError } from '@/commands/command-error';
import { extendBar } from '@/commands/extend-bar';
import { DEFAULT_BAR_DIAMETER_MM, placeBar, resolveDefaultCover } from '@/commands/place-bar';
import type { Vec3, WallElement } from '@/data/models';
import { getWallFaceFrame, resolveBarCenterline, wallLocalNormalToWorld } from '@/engine/placement';
import type { AppDispatch } from '@/stores';
import {
  type PlacementDraft,
  addDraftPoint,
  setCursorHint,
  setDraftBarId,
  setSelection,
  startDraft,
} from '@/stores/ui-slice';

const HINT_PATH_START = 'Click the bar start point on the face · Esc to finish';
const HINT_NEXT_SEGMENT =
  'Click the next point — each click adds a segment (bending place) to this bar · Esc to finish';

interface CaptureBarFaceOptions {
  dispatch: AppDispatch;
  wall: WallElement;
  /** Face normal in the wall mesh's local space (from the raycast hit). */
  localNormal: Vec3;
}

/** Click 1 of the Place Bar flow: remember which wall face the bar goes into. */
export function captureBarFace({ dispatch, wall, localNormal }: CaptureBarFaceOptions): void {
  const faceNormal = wallLocalNormalToWorld(wall, localNormal);
  dispatch(startDraft({ kind: 'bar', hostElementId: wall.id, faceNormal }));
  dispatch(setCursorHint(HINT_PATH_START));
}

interface AdvanceBarDraftOptions {
  dispatch: AppDispatch;
  /** Host wall — the wall the captured face belongs to. */
  host: WallElement;
  draft: PlacementDraft;
  /** Clicked point, already projected/snapped onto the captured face plane. */
  point: Vec3;
}

export function advanceBarDraft({ dispatch, host, draft, point }: AdvanceBarDraftOptions): void {
  const faceNormal = draft.faceNormal;
  if (!faceNormal) return; // a bar draft always carries one — defensive only
  const startPoint = draft.committedPoints[draft.committedPoints.length - 1] as Vec3 | undefined;
  if (!startPoint) {
    dispatch(addDraftPoint(point));
    dispatch(setCursorHint(HINT_NEXT_SEGMENT));
    return;
  }
  // Face-plane clicks → centerline: cover + radius from the captured face,
  // plus cover from every other face the clicks touch (edges, start, end).
  const centerline = resolveBarCenterline({
    facePoints: [startPoint, point],
    frame: getWallFaceFrame(host, faceNormal),
    wall: host,
    coverMm: resolveDefaultCover(host.kind),
    radiusMm: DEFAULT_BAR_DIAMETER_MM / 2,
  });
  try {
    if (draft.barId) {
      // Extend the SAME bar — the chain is one position with bending places.
      // (Only the NEW endpoint is appended; the committed vertex stays put.)
      dispatch(extendBar({ barId: draft.barId, point: centerline[1] }));
    } else {
      const barId = dispatch(
        placeBar({ hostElementId: host.id, diameter: DEFAULT_BAR_DIAMETER_MM, path: centerline }),
      );
      dispatch(setDraftBarId(barId));
      dispatch(setSelection({ elementIds: [], barIds: [barId], placementGroupIds: [] }));
    }
    dispatch(addDraftPoint(point));
    dispatch(setCursorHint(HINT_NEXT_SEGMENT));
  } catch (error) {
    if (!(error instanceof CommandError)) throw error;
    // e.g. zero-length segment: keep the draft, explain, let the user re-click.
    dispatch(setCursorHint(error.message));
  }
}
