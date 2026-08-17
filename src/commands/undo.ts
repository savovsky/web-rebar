import type { AppThunk } from '@/stores';
import { restoreProjectSnapshot } from '@/stores/project-slice';
import { setCursorHint } from '@/stores/ui-slice';
import { shiftToPast } from '@/stores/undo-slice';

/**
 * §N command (§E): restore the previous project snapshot in ONE step — a whole
 * command transaction (Q4-a), e.g. a deleteElement cascade with its hosted
 * bars. Guard: no-op with a status hint when the past stack is empty. Undo is
 * never itself recorded: restoreProjectSnapshot is excluded from the undo
 * listener matcher and the stack shift lives in the undo slice. Selection is
 * NOT restored (undo covers project state only) — dangling ids are harmless;
 * render layers tolerate missing entities.
 */
export const undo = (): AppThunk => (dispatch, getState) => {
  const state = getState();
  const previous = state.undo.past[state.undo.past.length - 1];
  if (previous === undefined) {
    dispatch(setCursorHint('Nothing to undo'));
    return;
  }
  dispatch(shiftToPast(state.project));
  dispatch(restoreProjectSnapshot(previous));
};
