import type { Plane, SectionDefinition } from '@/data/models';
import type { AppThunk } from '@/stores';
import { addSection } from '@/stores/project-slice';
import { CommandError } from './command-error';

export interface CreateSectionParams {
  /** Display name, e.g. 'S-1'. */
  name: string;
  /** Cutting plane. M0: vertical planes only (normal.y === 0); the normal is normalized here. */
  plane: Plane;
  /** View depth behind the plane (mm) for convention-based background (§G.2.3). */
  viewDepth: number;
  /** Elements contributing concrete outlines. Must all exist. */
  targetElementIds: string[];
}

/**
 * §N command: define a section view. The definition is a stored query — the 2D
 * primitives are derived from it on demand (§G, §H.2), so this command only
 * validates and stores. Returns the new section id.
 */
export const createSection =
  (params: CreateSectionParams): AppThunk<string> =>
  (dispatch, getState) => {
    const name = params.name.trim();
    if (name.length === 0) {
      throw new CommandError('INVALID_PARAMS', 'createSection: name must not be empty');
    }
    if (params.targetElementIds.length === 0) {
      throw new CommandError('INVALID_PARAMS', 'createSection: at least one target element required');
    }
    const missingId = params.targetElementIds.find((id) => !getState().project.elements[id]);
    if (missingId !== undefined) {
      throw new CommandError('NOT_FOUND', `createSection: target element not found: ${missingId}`);
    }
    if (params.viewDepth <= 0) {
      throw new CommandError(
        'INVALID_PARAMS',
        `createSection: viewDepth must be > 0, got ${params.viewDepth}`,
      );
    }

    const { normal } = params.plane;
    if (normal.y !== 0) {
      throw new CommandError(
        'INVALID_PARAMS',
        'createSection: M0 supports vertical planes only (normal.y must be 0)',
      );
    }
    const normalLength = Math.hypot(normal.x, normal.y, normal.z);
    if (normalLength === 0) {
      throw new CommandError('INVALID_PARAMS', 'createSection: plane normal must not be the zero vector');
    }

    const section: SectionDefinition = {
      id: crypto.randomUUID(),
      name,
      plane: {
        origin: params.plane.origin,
        normal: { x: normal.x / normalLength, y: 0, z: normal.z / normalLength },
      },
      viewDepth: params.viewDepth,
      targetElementIds: [...params.targetElementIds],
    };
    dispatch(addSection(section));
    return section.id;
  };
