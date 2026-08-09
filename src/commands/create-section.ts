import type { SectionDefinition, Vec3 } from '@/data/models';
import { sectionGeometryFromDepthPoint } from '@/engine/section-cut';
import type { AppThunk } from '@/stores';
import { addSection } from '@/stores/project-slice';
import { CommandError } from './command-error';

/** 'S-1', 'S-2', … — count-based; a duplicate after deletions is harmless in M0. */
export function resolveNextSectionName(sections: Record<string, SectionDefinition>): string {
  return `S-${Object.keys(sections).length + 1}`;
}

export interface CreateSectionParams {
  /** Display name, e.g. 'S-1'. */
  name: string;
  /** Section line start in plan (y ignored) — see SectionDefinition. */
  lineStart: Vec3;
  /** Section line end in plan (y ignored). */
  lineEnd: Vec3;
  /** A point on the viewed side: its side decides the view direction, its
   *  perpendicular distance from the line becomes the view depth (§B.6 —
   *  the third click of the Section Cut tool). */
  depthPoint: Vec3;
  /** Elements contributing concrete outlines. Must all exist. */
  targetElementIds: string[];
}

/**
 * §N command: define a section view from its line + depth point. The plane
 * (vertical, through the line, looking toward the depth point) and view depth
 * are derived here — the definition is a stored query; the 2D primitives are
 * derived from it on demand (§G, §H.2). Returns the new section id.
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
    const geometry = sectionGeometryFromDepthPoint(params);
    if (geometry === null) {
      throw new CommandError(
        'INVALID_PARAMS',
        'createSection: zero-length section line or depth point on the line',
      );
    }

    const section: SectionDefinition = {
      id: crypto.randomUUID(),
      name,
      lineStart: { x: params.lineStart.x, y: 0, z: params.lineStart.z },
      lineEnd: { x: params.lineEnd.x, y: 0, z: params.lineEnd.z },
      plane: geometry.plane,
      viewDepth: geometry.viewDepthMm,
      targetElementIds: [...params.targetElementIds],
    };
    dispatch(addSection(section));
    return section.id;
  };
