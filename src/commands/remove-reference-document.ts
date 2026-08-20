import type { AppThunk } from '@/stores';
import { removeReferenceDocument as applyRemoveReferenceDocument } from '@/stores/project-slice';
import { CommandError } from './command-error';

export interface RemoveReferenceDocumentParams {
  documentId: string;
}

/**
 * §N command: remove a reference document (M2 plan T5, Q3). Elements and bars
 * are untouched — a background is inert linework, never model content; one
 * undo level restores it exactly (the frozen snapshot keeps the document).
 */
export const removeReferenceDocument =
  (params: RemoveReferenceDocumentParams): AppThunk =>
  (dispatch, getState) => {
    if (!getState().project.referenceDocuments[params.documentId]) {
      throw new CommandError(
        'NOT_FOUND',
        `removeReferenceDocument: reference document not found: ${params.documentId}`,
      );
    }
    dispatch(applyRemoveReferenceDocument({ id: params.documentId }));
  };
