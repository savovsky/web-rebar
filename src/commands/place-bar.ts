import { DEFAULT_DIAMETERS, DEFAULT_STEEL_CATALOG } from '@/data/catalog/steel';
import type { ReinforcementBar, Vec3 } from '@/data/models';
import type { AppThunk } from '@/stores';
import { addBar } from '@/stores/project-slice';
import { CommandError } from './command-error';

export interface PlaceBarParams {
  /** Element the bar belongs to (M0: a wall). Must exist. */
  hostElementId: string;
  /** Bar diameter (mm) — must exist in the steel catalog (§K.3). */
  diameter: number;
  /** Centerline path in model space. M0: exactly 2 points (straight bar). */
  path: Vec3[];
  /** Concrete cover (mm); defaults to the catalog default for the host kind. */
  coverDistance?: number;
  /** Steel grade catalog key; defaults to the catalog default grade. */
  steelGrade?: string;
}

const isZeroLengthPath = (path: Vec3[]): boolean => {
  const [first, last] = [path[0], path[path.length - 1]];
  return first.x === last.x && first.y === last.y && first.z === last.z;
};

/**
 * §N command: place one straight bar in a host element. Cover and steel grade
 * default from the DIN/EC2 catalog seed (§K.2); the stored bar keeps the
 * resolved values as design intent (§C). Returns the new bar id.
 */
export const placeBar =
  (params: PlaceBarParams): AppThunk<string> =>
  (dispatch, getState) => {
    const host = getState().project.elements[params.hostElementId];
    if (!host) {
      throw new CommandError('NOT_FOUND', `placeBar: host element not found: ${params.hostElementId}`);
    }
    if (!DEFAULT_DIAMETERS.includes(params.diameter)) {
      throw new CommandError('INVALID_PARAMS', `placeBar: Ø${params.diameter} not in steel catalog`);
    }
    if (params.path.length !== 2) {
      throw new CommandError(
        'INVALID_PARAMS',
        'placeBar: M0 places straight bars only — path must be 2 points',
      );
    }
    if (isZeroLengthPath(params.path)) {
      throw new CommandError('INVALID_PARAMS', 'placeBar: zero-length bar path');
    }

    const coverDistance = params.coverDistance ?? DEFAULT_STEEL_CATALOG.defaultCover[host.kind];
    if (coverDistance <= 0) {
      throw new CommandError('INVALID_PARAMS', `placeBar: cover must be > 0, got ${coverDistance}`);
    }
    const steelGrade = params.steelGrade ?? DEFAULT_STEEL_CATALOG.defaultGrade;
    const isKnownGrade = DEFAULT_STEEL_CATALOG.grades.some((grade) => grade.name === steelGrade);
    if (!isKnownGrade) {
      throw new CommandError('INVALID_PARAMS', `placeBar: unknown steel grade: ${steelGrade}`);
    }

    const bar: ReinforcementBar = {
      id: crypto.randomUUID(),
      hostElementId: params.hostElementId,
      diameter: params.diameter,
      path: params.path,
      coverDistance,
      steelGrade,
    };
    dispatch(addBar(bar));
    return bar.id;
  };
