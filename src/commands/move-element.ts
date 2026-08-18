import type { Vec3 } from '@/data/models';
import type { AppThunk } from '@/stores';
import { translateBar, translateElement } from '@/stores/project-slice';
import { CommandError } from './command-error';

export interface MoveElementParams {
  elementId: string;
  /** Translation in model space (mm). */
  delta: Vec3;
}

/**
 * §N command: move an element with host-follow (§E revised 2026-08-09) — the
 * element and every bar it hosts (via `hostElementId`) translate by the same
 * delta in ONE command transaction, so one undo level restores all of it
 * exactly (undo-middleware command scope, Q4-a). Like the deleteElement
 * cascade, the follow is explicit per-bar dispatches — computed once inside
 * the command, not propagated by a live dependency graph — so the action log
 * shows every change (matters for the MCP door, §N.2).
 *
 * Walls translate in plan (startPoint/endPoint); baseElevation, thickness,
 * and height are untouched. The full delta applies to hosted bar paths —
 * plan-locked callers (the T4 Move tool) pass delta.y = 0. Selection is
 * untouched: ids do not change.
 */
export const moveElement =
  (params: MoveElementParams): AppThunk =>
  (dispatch, getState) => {
    const state = getState();
    if (!state.project.elements[params.elementId]) {
      throw new CommandError('NOT_FOUND', `moveElement: element not found: ${params.elementId}`);
    }
    const { x, y, z } = params.delta;
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) {
      throw new CommandError(
        'INVALID_PARAMS',
        `moveElement: delta components must be finite, got (${x}, ${y}, ${z})`,
      );
    }
    if (x === 0 && y === 0 && z === 0) {
      throw new CommandError('INVALID_PARAMS', 'moveElement: delta must be non-zero');
    }

    const hostedBarIds = Object.values(state.project.reinforcement)
      .filter((bar) => bar.hostElementId === params.elementId)
      .map((bar) => bar.id);
    dispatch(translateElement({ id: params.elementId, delta: params.delta }));
    for (const barId of hostedBarIds) {
      dispatch(translateBar({ id: barId, delta: params.delta }));
    }
  };
