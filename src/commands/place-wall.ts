import type { Vec3, WallElement } from '@/data/models';
import type { AppThunk } from '@/stores';
import { addElement } from '@/stores/project-slice';
import { CommandError } from './command-error';

/** M0 wall cross-section defaults (mm) — the property panel makes these
 *  user-editable post-M0 (§B.6). */
export const DEFAULT_WALL_DIMENSIONS = { thickness: 200, height: 2800 } as const;

export interface PlaceWallParams {
  /** Axis start point in plan (X/Y); z ignored — see WallElement.baseElevation. */
  startPoint: Vec3;
  /** Axis end point in plan (X/Y). */
  endPoint: Vec3;
  /** Wall thickness (mm). */
  thickness: number;
  /** Wall height (mm). */
  height: number;
  /** Bottom-of-wall elevation (mm); defaults to 0. */
  baseElevation?: number;
}

/**
 * §N command: create a straight wall. All structural validation lives here —
 * the Place Wall tool (T7) only collects clicks and dispatches this.
 * Returns the new element id so the caller can select/annotate it.
 */
export const placeWall =
  (params: PlaceWallParams): AppThunk<string> =>
  (dispatch) => {
    const { startPoint, endPoint, thickness, height } = params;
    if (startPoint.x === endPoint.x && startPoint.y === endPoint.y) {
      throw new CommandError('INVALID_PARAMS', 'placeWall: zero-length wall axis (start === end in plan)');
    }
    if (thickness <= 0) {
      throw new CommandError('INVALID_PARAMS', `placeWall: thickness must be > 0, got ${thickness}`);
    }
    if (height <= 0) {
      throw new CommandError('INVALID_PARAMS', `placeWall: height must be > 0, got ${height}`);
    }

    const wall: WallElement = {
      id: crypto.randomUUID(),
      kind: 'wall',
      startPoint,
      endPoint,
      thickness,
      height,
      baseElevation: params.baseElevation ?? 0,
    };
    dispatch(addElement(wall));
    return wall.id;
  };
