// §N command: move ONE reinforcement bar (M3 plan section 5, Q6-a — the
// moveElement shape, bar-relative). An INDIVIDUAL bar simply translates
// (translateBar — bending places included, one bar stays one position). A
// GROUP member DETACHES first (§F.1: "moving individual bars breaks them
// from the group"): it leaves `group.bars`, the bar-side `placementGroupId`
// handle clears (the T3 detachBars reducer — built for exactly this), and it
// keeps its mark and position; then it translates. On the next regenerate
// the stored rule is the group's truth and the vacated slot IS refilled
// (Q6-a — the detached bar stays wherever the user put it, now independent).
// Detach + translate run in ONE command scope → ONE undo level restores
// membership AND position exactly (milestone acceptance sentence 3).
//
// A group MOVE gesture is deliberately NOT this command (decided in-task,
// raised to the author): a group has no position of its own — its region is
// host-local (Q3-a), so "move the group" = move the host (§E host-follow,
// already shipping). The T4-recorded Shift+hover pre-selection therefore
// feeds group DELETE (deleteSelection → deletePlacementGroup) only.
import type { Vec3 } from '@/data/models';
import type { AppThunk } from '@/stores';
import {
  detachBars,
  translateBar,
  updatePlacementGroup as updatePlacementGroupReducer,
} from '@/stores/project-slice';
import { CommandError } from './command-error';

export interface MoveBarParams {
  barId: string;
  /** Translation in model space (mm). The Move tool passes plan deltas
   *  (z = 0) like the element drag; the command accepts any finite delta. */
  delta: Vec3;
}

export interface MoveBarResult {
  barId: string;
  /** Set when the bar was a group member: the group it detached from
   *  (Q6-a). Absent for individual bars. */
  detachedFromGroupId?: string;
}

export const moveBar =
  (params: MoveBarParams): AppThunk<MoveBarResult> =>
  (dispatch, getState) => {
    const bar = getState().project.reinforcement[params.barId];
    if (!bar) {
      throw new CommandError('NOT_FOUND', `moveBar: bar not found: ${params.barId}`);
    }
    const { x, y, z } = params.delta;
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) {
      throw new CommandError(
        'INVALID_PARAMS',
        `moveBar: delta components must be finite, got (${x}, ${y}, ${z})`,
      );
    }
    if (x === 0 && y === 0 && z === 0) {
      throw new CommandError('INVALID_PARAMS', 'moveBar: delta must be non-zero');
    }

    // Validation passed — side effects start. Q6-a detach: membership list
    // (group-side) and the handle (bar-side) both clear in this scope.
    let detachedFromGroupId: string | undefined;
    const groupId = bar.placementGroupId;
    if (groupId !== undefined) {
      const group = getState().project.placementGroups[groupId];
      if (group) {
        dispatch(
          updatePlacementGroupReducer({ ...group, bars: group.bars.filter((id) => id !== params.barId) }),
        );
      }
      dispatch(detachBars({ ids: [params.barId] }));
      detachedFromGroupId = groupId;
    }
    dispatch(translateBar({ id: params.barId, delta: params.delta }));
    return { barId: params.barId, detachedFromGroupId };
  };
