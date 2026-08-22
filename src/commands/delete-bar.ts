import type { AppThunk } from '@/stores';
import { removeBar, updatePlacementGroup as updatePlacementGroupReducer } from '@/stores/project-slice';
import { setSelection } from '@/stores/ui-slice';
import { CommandError } from './command-error';

export interface DeleteBarParams {
  id: string;
}

/** §N command: delete one reinforcement bar; its host element is untouched.
 *  A GROUP member also leaves the group's membership list (M3 T5 — resolves
 *  the T3-recorded finding that a deleted member's id lingered in
 *  `group.bars`); the group's rule is untouched, so the next regenerate
 *  refills the slot (Q6-a — the rule is the group's truth). */
export const deleteBar =
  (params: DeleteBarParams): AppThunk =>
  (dispatch, getState) => {
    const state = getState();
    const bar = state.project.reinforcement[params.id];
    if (!bar) {
      throw new CommandError('NOT_FOUND', `deleteBar: bar not found: ${params.id}`);
    }

    dispatch(removeBar({ id: params.id }));

    const groupId = bar.placementGroupId;
    if (groupId !== undefined) {
      const group = state.project.placementGroups[groupId];
      if (group) {
        dispatch(
          updatePlacementGroupReducer({ ...group, bars: group.bars.filter((id) => id !== params.id) }),
        );
      }
    }

    const { selection } = state.ui;
    if (selection.barIds.includes(params.id)) {
      dispatch(
        setSelection({
          elementIds: selection.elementIds,
          barIds: selection.barIds.filter((id) => id !== params.id),
          placementGroupIds: selection.placementGroupIds,
        }),
      );
    }
  };
