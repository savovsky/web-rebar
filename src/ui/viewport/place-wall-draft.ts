// Place Wall click flow (§B.6, revised 2026-08-08 — chained placement):
// the 1st click starts the axis; the 2nd click creates the wall via the §N
// placeWall command and immediately starts the next wall from that point.
// Esc (global tool shortcut → setTool) ends the chain — no Enter confirmation.
import { CommandError } from '@/commands/command-error';
import { DEFAULT_WALL_DIMENSIONS, placeWall } from '@/commands/place-wall';
import type { Vec3 } from '@/data/models';
import type { AppDispatch } from '@/stores';
import { addDraftPoint, setCursorHint, setSelection, startDraft } from '@/stores/ui-slice';

const HINT_NEXT_POINT = 'Click the end point — the next wall starts there · Esc to finish';

interface AdvanceWallDraftOptions {
  dispatch: AppDispatch;
  committedPoints: Vec3[];
  point: Vec3;
}

export function advanceWallDraft({ dispatch, committedPoints, point }: AdvanceWallDraftOptions): void {
  const startPoint = committedPoints[committedPoints.length - 1] as Vec3 | undefined;
  if (!startPoint) {
    dispatch(startDraft({ kind: 'wall' }));
    dispatch(addDraftPoint(point));
    dispatch(setCursorHint(HINT_NEXT_POINT));
    return;
  }
  try {
    const wallId = dispatch(placeWall({ startPoint, endPoint: point, ...DEFAULT_WALL_DIMENSIONS }));
    dispatch(setSelection({ elementIds: [wallId], barIds: [] }));
    // Chain: the placed wall's end point becomes the next wall's start point.
    dispatch(startDraft({ kind: 'wall' }));
    dispatch(addDraftPoint(point));
    dispatch(setCursorHint(HINT_NEXT_POINT));
  } catch (error) {
    if (!(error instanceof CommandError)) throw error;
    // e.g. zero-length axis: keep the draft start, explain, let the user re-click.
    dispatch(setCursorHint(error.message));
  }
}
