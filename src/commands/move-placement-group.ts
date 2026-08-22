// §N command: move a placement GROUP on its face (M3 T5, author direction
// 2026-08-22 mid-review: the Shift+hover pre-selection's move half — a
// Shift+drag from a group member moves the ENTIRE group, while an unmodified
// drag still detaches the single bar per Q6). The group has no world
// position of its own — its region is host-local (Q3-a) — so the move
// re-targets the REGION: the world delta projects onto the face frame's
// in-plane axes (worldToFaceLocalDelta; the normal component drops), the
// region rect shifts by (du, dv), and the nested updatePlacementGroup
// regenerates the bars rule-exactly (new ids — the same contract as every
// param edit; the group keeps its id AND its barMark). Detached bars (Q6-a)
// stay where the user put them. ONE undo level restores the pre-move region
// AND bars exactly (the nested thunk joins this command's scope, Q4-a).
// Plan-locked drags (z = 0 from the Move tool) map fully on top/bottom faces
// and along-u on vertical side faces (v is ±Z there); a delta with no face-
// plane component is invalid, not a silent no-op. T6 (Q8, §K.4): the clash
// report of the nested regenerate propagates into this result — the group
// move is NON-BLOCKING like every placement command.
import type { FaceRegion, PlacementGroup, Vec3 } from '@/data/models';
import type { BarClash } from '@/engine/collision';
import { worldToFaceLocalDelta } from '@/engine/placement-group';
import type { AppThunk } from '@/stores';
import { CommandError } from './command-error';
import { updatePlacementGroup } from './update-placement-group';

export interface MovePlacementGroupParams {
  groupId: string;
  /** World translation in model space (mm); only the face-plane components
   *  apply (the Move tool passes plan deltas, z = 0). */
  delta: Vec3;
}

export interface MovePlacementGroupResult {
  groupId: string;
  /** The re-targeted (shifted) face-local region — the stored rule update. */
  region: FaceRegion;
  /** The NEW generated bar ids in layout order (regenerate contract). */
  barIds: string[];
  /** Exact clash report (Q8, §K.4 — non-blocking), propagated from the
   *  nested regenerate; empty when nothing clashes. */
  clashes: BarClash[];
}

/** mm — a delta whose face-plane projection is below this on BOTH axes is a
 *  click, not a move (moveElement/moveBar's zero-delta convention). */
const FACE_DELTA_EPSILON_MM = 1e-9;

export const movePlacementGroup =
  (params: MovePlacementGroupParams): AppThunk<MovePlacementGroupResult> =>
  (dispatch, getState) => {
    const state = getState();
    const group: PlacementGroup | undefined = state.project.placementGroups[params.groupId];
    if (!group) {
      throw new CommandError('NOT_FOUND', `movePlacementGroup: group not found: ${params.groupId}`);
    }
    const host = state.project.elements[group.hostElementId];
    if (!host) {
      // Same guard as updatePlacementGroup: a group whose host is gone can
      // never move/regenerate (the T3-recorded sections precedent — the
      // host-cascade door stays open for T8).
      throw new CommandError(
        'NOT_FOUND',
        `movePlacementGroup: host element not found: ${group.hostElementId}`,
      );
    }
    const { x, y, z } = params.delta;
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) {
      throw new CommandError(
        'INVALID_PARAMS',
        `movePlacementGroup: delta components must be finite, got (${x}, ${y}, ${z})`,
      );
    }

    // Validation passed — resolve the face-plane projection BEFORE any side
    // effect: zero there means the drag aimed off the face's reachable axes.
    const { du, dv } = worldToFaceLocalDelta({ host, faceKey: group.faceKey, delta: params.delta });
    if (Math.abs(du) < FACE_DELTA_EPSILON_MM && Math.abs(dv) < FACE_DELTA_EPSILON_MM) {
      throw new CommandError(
        'INVALID_PARAMS',
        'movePlacementGroup: the delta has no face-plane component (a vertical side face accepts plan deltas along the face u axis only)',
      );
    }

    const region: FaceRegion = {
      uMin: group.region.uMin + du,
      uMax: group.region.uMax + du,
      vMin: group.region.vMin + dv,
      vMax: group.region.vMax + dv,
    };
    // Nested command: the regenerate machinery + rule validation live in
    // updatePlacementGroup; it joins THIS command's ONE undo level (Q4-a),
    // and its Q8 clash report (computed over the same prospective model)
    // propagates unchanged.
    const { barIds, clashes } = dispatch(
      updatePlacementGroup({ groupId: params.groupId, patch: { region } }),
    );
    return { groupId: params.groupId, region, barIds, clashes };
  };
