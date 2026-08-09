import type { AppThunk } from '@/stores';
import { removeBar, removeElement } from '@/stores/project-slice';
import { setSelection } from '@/stores/ui-slice';
import { CommandError } from './command-error';

export interface DeleteElementParams {
  id: string;
}

/**
 * §N command: delete an element and every bar it hosts. The cascade dispatches
 * one removeBar per bar so the action log shows every change individually
 * (matters for undo (§E) and the MCP door (§N.2) — see project-slice header).
 * Selection references to the deleted entities are pruned. Sections targeting
 * the element are kept; the sectioning selector skips missing targets (T9).
 */
export const deleteElement =
  (params: DeleteElementParams): AppThunk =>
  (dispatch, getState) => {
    const state = getState();
    if (!state.project.elements[params.id]) {
      throw new CommandError('NOT_FOUND', `deleteElement: element not found: ${params.id}`);
    }

    const hostedBarIds = Object.values(state.project.reinforcement)
      .filter((bar) => bar.hostElementId === params.id)
      .map((bar) => bar.id);
    for (const barId of hostedBarIds) {
      dispatch(removeBar({ id: barId }));
    }
    dispatch(removeElement({ id: params.id }));

    const { selection } = state.ui;
    const pruned = {
      elementIds: selection.elementIds.filter((id) => id !== params.id),
      barIds: selection.barIds.filter((id) => !hostedBarIds.includes(id)),
    };
    const didSelectionChange =
      pruned.elementIds.length !== selection.elementIds.length ||
      pruned.barIds.length !== selection.barIds.length;
    if (didSelectionChange) {
      dispatch(setSelection(pruned));
    }
  };
