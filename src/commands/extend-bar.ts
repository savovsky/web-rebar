import type { Vec3 } from '@/data/models';
import type { AppThunk } from '@/stores';
import { appendBarPoint } from '@/stores/project-slice';
import { CommandError } from './command-error';

export interface ExtendBarParams {
  /** Bar to extend (must exist). */
  barId: string;
  /** New path endpoint in model space — appended to the centerline. */
  point: Vec3;
}

/**
 * §N command: append one segment to an existing bar's path. Chained placement
 * (§B.6) builds ONE bar with bending places — not several separate bars — so
 * the schedule (§J) and bar counts treat the chain as a single position.
 * Returns the bar id.
 */
export const extendBar =
  (params: ExtendBarParams): AppThunk<string> =>
  (dispatch, getState) => {
    const bar = getState().project.reinforcement[params.barId];
    if (!bar) {
      throw new CommandError('NOT_FOUND', `extendBar: bar not found: ${params.barId}`);
    }
    const last = bar.path[bar.path.length - 1];
    if (last.x === params.point.x && last.y === params.point.y && last.z === params.point.z) {
      throw new CommandError('INVALID_PARAMS', 'extendBar: zero-length segment (point === current end)');
    }
    dispatch(appendBarPoint({ id: params.barId, point: params.point }));
    return params.barId;
  };
