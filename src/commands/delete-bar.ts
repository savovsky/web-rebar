import type { AppThunk } from '@/stores';
import { removeBar } from '@/stores/project-slice';
import { setSelection } from '@/stores/ui-slice';
import { CommandError } from './command-error';

export interface DeleteBarParams {
  id: string;
}

/** §N command: delete one reinforcement bar; its host element is untouched. */
export const deleteBar =
  (params: DeleteBarParams): AppThunk =>
  (dispatch, getState) => {
    const state = getState();
    if (!state.project.reinforcement[params.id]) {
      throw new CommandError('NOT_FOUND', `deleteBar: bar not found: ${params.id}`);
    }

    dispatch(removeBar({ id: params.id }));

    const { selection } = state.ui;
    if (selection.barIds.includes(params.id)) {
      dispatch(
        setSelection({
          elementIds: selection.elementIds,
          barIds: selection.barIds.filter((id) => id !== params.id),
        }),
      );
    }
  };
