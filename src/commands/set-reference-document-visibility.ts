import type { AppThunk } from '@/stores';
import { setReferenceDocumentVisibility as applySetReferenceDocumentVisibility } from '@/stores/project-slice';
import { CommandError } from './command-error';

export interface SetReferenceDocumentVisibilityParams {
  documentId: string;
  visible: boolean;
}

/**
 * §N command: show/hide a reference document (M2 plan T5, Q3). The flag is
 * document-level and render-only — no freeze/lock/active-layer semantics (the
 * deferred Layer Model door stays open). It lives in the project model, so
 * like every other project mutation it is undoable.
 */
export const setReferenceDocumentVisibility =
  (params: SetReferenceDocumentVisibilityParams): AppThunk =>
  (dispatch, getState) => {
    if (!getState().project.referenceDocuments[params.documentId]) {
      throw new CommandError(
        'NOT_FOUND',
        `setReferenceDocumentVisibility: reference document not found: ${params.documentId}`,
      );
    }
    dispatch(applySetReferenceDocumentVisibility({ id: params.documentId, visible: params.visible }));
  };
