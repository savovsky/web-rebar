// §N command: delete a placement group (M3 plan section 3). Default removes
// the group AND its bars (the deleteElement cascade precedent — in-task
// decision recorded in the T3 task log); removeBars: false DETACHES all bars
// to individuals instead (the Q6 handle cleared via the T3 detachBars
// reducer — the bars keep their positions and their shared mark). ONE undo
// level restores group + membership + bars exactly, either way.
import type { AppThunk } from '@/stores';
import { detachBars, removeBars, removePlacementGroup } from '@/stores/project-slice';
import { setSelection } from '@/stores/ui-slice';
import { CommandError } from './command-error';

export interface DeletePlacementGroupParams {
  groupId: string;
  /** Default true: the group's bars go with it. false = detach all bars to
   *  individuals (they stay exactly where they are, group-less). */
  removeBars?: boolean;
}

/** Removes the group; prunes selection references to the removed bars. */
export const deletePlacementGroup =
  (params: DeletePlacementGroupParams): AppThunk =>
  (dispatch, getState) => {
    const state = getState();
    const group = state.project.placementGroups[params.groupId];
    if (!group) {
      throw new CommandError('NOT_FOUND', `deletePlacementGroup: group not found: ${params.groupId}`);
    }

    if (params.removeBars === false) {
      dispatch(detachBars({ ids: group.bars }));
    } else {
      dispatch(removeBars({ ids: group.bars }));
    }
    dispatch(removePlacementGroup({ id: params.groupId }));

    // Prune selection references to the removed group (M3 T5) and its bars.
    const { selection } = state.ui;
    const pruned = {
      elementIds: selection.elementIds,
      barIds: selection.barIds.filter((id) => params.removeBars === false || !group.bars.includes(id)),
      placementGroupIds: selection.placementGroupIds.filter((id) => id !== params.groupId),
    };
    if (
      pruned.barIds.length !== selection.barIds.length ||
      pruned.placementGroupIds.length !== selection.placementGroupIds.length
    ) {
      dispatch(setSelection(pruned));
    }
  };
