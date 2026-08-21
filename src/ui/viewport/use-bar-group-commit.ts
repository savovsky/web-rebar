// Enter/Space commit for the Place Bar Group draft (author decision
// 2026-08-21): pointer gestures only CAPTURE the face and DEFINE the region —
// the commit is an explicit key press, so the user can adjust the Properties
// panel params against the live preview before placing. Whole-face when no
// region was drawn, the defined region otherwise (place-bar-group-draft.ts).
// Mounted once in AppShell next to useToolShortcuts; the isEditableTarget
// guard keeps typing in the params panel safe.
import { useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '@/stores/hooks';
import { isEditableTarget } from '@/ui/is-editable-target';
import { commitBarGroup } from './place-bar-group-draft';

export function useBarGroupCommitKeys() {
  const dispatch = useAppDispatch();
  const isGroupTool = useAppSelector((state) => state.ui.activeTool === 'placeBarGroup');
  const draft = useAppSelector((state) => state.ui.placementDraft);
  const isSticky = useAppSelector((state) => state.ui.sticky);
  const host = useAppSelector((state) =>
    draft.hostElementId ? (state.project.elements[draft.hostElementId] ?? null) : null,
  );

  useEffect(() => {
    if (!isGroupTool || draft.kind !== 'barGroup' || !draft.faceKey || !host) return undefined;
    const faceKey = draft.faceKey;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      if (isEditableTarget(event.target)) return;
      event.preventDefault(); // Space must not scroll; Enter must not re-click
      commitBarGroup({ dispatch, host, faceKey, isSticky });
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [dispatch, isGroupTool, draft.kind, draft.faceKey, host, isSticky]);
}
