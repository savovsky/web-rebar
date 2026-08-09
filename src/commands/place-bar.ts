import { DEFAULT_DIAMETERS, DEFAULT_STEEL_CATALOG } from '@/data/catalog/steel';
import type { ElementKind, ReinforcementBar, Vec3 } from '@/data/models';
import type { AppThunk } from '@/stores';
import { addBar } from '@/stores/project-slice';
import { CommandError } from './command-error';

/** M0 bar diameter default (mm) — the property panel makes this
 *  user-editable post-M0 (§B.6). */
export const DEFAULT_BAR_DIAMETER_MM = 12;

/** Default cover (mm) for a host kind from the catalog seed — the same value
 *  the placeBar command stores when no cover is given. The Place Bar tool
 *  needs it up front to offset the centerline inward from the clicked face. */
export function resolveDefaultCover(hostKind: ElementKind): number {
  return DEFAULT_STEEL_CATALOG.defaultCover[hostKind];
}

export interface PlaceBarParams {
  /** Element the bar belongs to (M0: a wall). Must exist. */
  hostElementId: string;
  /** Bar diameter (mm) — must exist in the steel catalog (§K.3). */
  diameter: number;
  /** Centerline path in model space. 2+ points; intermediate points are
   *  bending places (chained placement extends one bar — see extendBar). */
  path: Vec3[];
  /** Concrete cover (mm); defaults to the catalog default for the host kind. */
  coverDistance?: number;
  /** Steel grade catalog key; defaults to the catalog default grade. */
  steelGrade?: string;
}

const hasZeroLengthSegment = (path: Vec3[]): boolean =>
  path.some((point, index) => {
    if (index === 0) return false;
    const previous = path[index - 1];
    return point.x === previous.x && point.y === previous.y && point.z === previous.z;
  });

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
    if (params.path.length < 2) {
      throw new CommandError('INVALID_PARAMS', 'placeBar: path needs at least 2 points');
    }
    if (hasZeroLengthSegment(params.path)) {
      throw new CommandError('INVALID_PARAMS', 'placeBar: zero-length segment in bar path');
    }

    const coverDistance = params.coverDistance ?? resolveDefaultCover(host.kind);
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
