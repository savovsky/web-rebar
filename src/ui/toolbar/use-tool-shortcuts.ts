// Global keyboard shortcuts for the tool palette (§B.6 rule 3). The key → tool
// mapping comes from shortcuts.json; Escape cancels to Select and deselects (§B.5).
import { useEffect } from 'react';
import { useAppDispatch } from '@/stores/hooks';
import { type ToolId, clearSelection, setTool } from '@/stores/ui-slice';
import shortcuts from './shortcuts.json';

const KEY_TO_TOOL = new Map<string, ToolId>(
  Object.entries(shortcuts).map(([toolId, key]): [string, ToolId] => [key, toolId as ToolId]),
);

function isEditableTarget(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
  );
}

export function useToolShortcuts() {
  const dispatch = useAppDispatch();
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (isEditableTarget(event.target) || event.ctrlKey || event.metaKey || event.altKey) return;
      if (event.key === 'Escape') {
        dispatch(clearSelection());
        dispatch(setTool({ tool: 'select' }));
        return;
      }
      const tool = KEY_TO_TOOL.get(event.key.toLowerCase());
      if (tool) dispatch(setTool({ tool }));
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [dispatch]);
}
