import type { AppThunk } from '@/stores';
import { restoreProjectSnapshot } from '@/stores/project-slice';
import { setCursorHint } from '@/stores/ui-slice';
import { shiftToFuture } from '@/stores/undo-slice';

/**
 * §N command (§E): re-apply the snapshot most recently undone away. Guard:
 * no-op with a status hint when the future stack is empty (also right after
 * any new command — a new action forks history and clears the stack). Like
 * undo, never itself recorded. See the undo command for the mechanics.
 */
export const redo = (): AppThunk => (dispatch, getState) => {
  const state = getState();
  const next = state.undo.future[state.undo.future.length - 1];
  if (next === undefined) {
    dispatch(setCursorHint('Nothing to redo'));
    return;
  }
  dispatch(shiftToFuture(state.project));
  dispatch(restoreProjectSnapshot(next));
};
