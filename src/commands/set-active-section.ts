import type { AppThunk } from '@/stores';
import { setActiveSection as applyActiveSection } from '@/stores/ui-slice';
import { CommandError } from './command-error';

export interface SetActiveSectionParams {
  /** Section to show in the dockable 2D panel (§B.2); null closes the panel. */
  sectionId: string | null;
}

/** §N command: point the 2D section panel at a section (or close it with null). */
export const setActiveSection =
  (params: SetActiveSectionParams): AppThunk =>
  (dispatch, getState) => {
    if (params.sectionId !== null && !getState().project.sections[params.sectionId]) {
      throw new CommandError('NOT_FOUND', `setActiveSection: section not found: ${params.sectionId}`);
    }
    dispatch(applyActiveSection(params.sectionId));
  };
