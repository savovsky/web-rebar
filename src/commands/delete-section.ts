import type { AppThunk } from '@/stores';
import { removeSection } from '@/stores/project-slice';
import { setActiveSection as applyActiveSection } from '@/stores/ui-slice';
import { CommandError } from './command-error';

export interface DeleteSectionParams {
  sectionId: string;
}

/**
 * §N command: delete a section definition — completes the delete family
 * (element, bar, section). Elements and bars are untouched: a section is a
 * stored query (§G), not model geometry. The dockable 2D panel (§B.2) closes
 * when it showed the deleted section (activeSectionId cleared). Selection
 * holds no section ids, so nothing is pruned.
 */
export const deleteSection =
  (params: DeleteSectionParams): AppThunk =>
  (dispatch, getState) => {
    const state = getState();
    if (!state.project.sections[params.sectionId]) {
      throw new CommandError('NOT_FOUND', `deleteSection: section not found: ${params.sectionId}`);
    }
    dispatch(removeSection({ id: params.sectionId }));
    if (state.ui.activeSectionId === params.sectionId) {
      dispatch(applyActiveSection(null));
    }
  };
