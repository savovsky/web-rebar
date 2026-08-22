// Global keyboard shortcuts for the tool palette (§B.6 rule 3) plus the M1
// edit entry points. The key → tool mapping comes from shortcuts.json; Escape
// cancels to Select and deselects (§B.5) AND dismisses the §K.4 clash warning
// layer (M3 T6 review amendment, author direction 2026-08-22 — Esc = "the
// check is completed"; the transient ui.clashWarning is not undo-derived, so
// dismissal is a plain ui-state clear). Edit keys: Delete/Backspace delete
// the current selection, Ctrl+Z undoes, Ctrl+Shift+Z redoes (Figma
// convention; Cmd works on macOS). Every guard shares isEditableTarget so
// typing in inputs stays safe.
import { useEffect } from 'react';
import { deleteSelection, redo, undo } from '@/commands';
import { useAppDispatch, useAppSelector } from '@/stores/hooks';
import { type ToolId, clearSelection, setClashWarning, setTool } from '@/stores/ui-slice';
import { isEditableTarget } from '@/ui/is-editable-target';
import shortcuts from './shortcuts.json';

const KEY_TO_TOOL = new Map<string, ToolId>(
  Object.entries(shortcuts).map(([toolId, key]): [string, ToolId] => [key, toolId as ToolId]),
);

export function useToolShortcuts() {
  const dispatch = useAppDispatch();
  // Delete is inert while a placement draft is in progress (the in-progress
  // bar is itself selected — deleting it mid-chain would strand the draft);
  // Esc is the cancel path (§B.6).
  const isInProgress = useAppSelector((state) => state.ui.isInProgress);
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (isEditableTarget(event.target)) return;
      if ((event.ctrlKey || event.metaKey) && !event.altKey && event.key.toLowerCase() === 'z') {
        event.preventDefault();
        dispatch(event.shiftKey ? redo() : undo());
        return;
      }
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      if (event.key === 'Delete' || event.key === 'Backspace') {
        if (isInProgress) return;
        event.preventDefault();
        dispatch(deleteSelection());
        return;
      }
      if (event.key === 'Escape') {
        dispatch(clearSelection());
        // Acknowledge/dismiss the clash warning (M3 T6 review amendment).
        dispatch(setClashWarning(null));
        dispatch(setTool({ tool: 'select' }));
        return;
      }
      const tool = KEY_TO_TOOL.get(event.key.toLowerCase());
      if (tool) dispatch(setTool({ tool }));
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [dispatch, isInProgress]);
}
