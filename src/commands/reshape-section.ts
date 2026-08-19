import type { Vec3 } from '@/data/models';
import { findElementsCrossedByLine, sectionGeometryFromDepthPoint } from '@/engine/section-cut';
import type { AppThunk } from '@/stores';
import { updateSectionGeometry } from '@/stores/project-slice';
import { CommandError } from './command-error';

export interface ReshapeSectionParams {
  sectionId: string;
  lineStart: Vec3;
  lineEnd: Vec3;
  /** Any point on the viewed side; its distance from the line is the view depth. */
  depthPoint: Vec3;
}

/**
 * §N command: move/stretch a section via its 3D wireframe volume (§B.6) —
 * recomputes the plane, view depth, and the crossed target elements. A
 * reshaped section may cross nothing (empty targets): the 2D view then shows
 * its empty state until the section is moved back over an element.
 */
export const reshapeSection =
  (params: ReshapeSectionParams): AppThunk =>
  (dispatch, getState) => {
    const state = getState();
    if (!state.project.sections[params.sectionId]) {
      throw new CommandError('NOT_FOUND', `reshapeSection: section not found: ${params.sectionId}`);
    }
    const geometry = sectionGeometryFromDepthPoint(params);
    if (geometry === null) {
      throw new CommandError(
        'INVALID_PARAMS',
        'reshapeSection: zero-length section line or depth point on the line',
      );
    }
    const targetElementIds = findElementsCrossedByLine({
      lineStart: params.lineStart,
      lineEnd: params.lineEnd,
      elements: state.project.elements,
    });
    dispatch(
      updateSectionGeometry({
        id: params.sectionId,
        lineStart: { x: params.lineStart.x, y: params.lineStart.y, z: 0 },
        lineEnd: { x: params.lineEnd.x, y: params.lineEnd.y, z: 0 },
        plane: geometry.plane,
        viewDepth: geometry.viewDepthMm,
        targetElementIds,
      }),
    );
  };
