// Status bar (§B.2, §B.6 rule 4): active tool + hint on the left, snap state /
// grid / cursor coordinates on the right (monospace — doc 10 §2). Coordinates
// stream from the viewport's transient cursor module (§E — outside Redux).
import { useSyncExternalStore } from 'react';
import { useAppDispatch, useAppSelector } from '@/stores/hooks';
import { toggleSnap } from '@/stores/ui-slice';
import { TOOL_BY_ID } from '@/ui/toolbar/tools';
import {
  formatCursorPosition,
  getCursorSnapshot,
  subscribeCursorPosition,
} from '@/ui/viewport/cursor-position';

export function StatusBar() {
  const dispatch = useAppDispatch();
  const activeTool = useAppSelector((state) => state.ui.activeTool);
  const cursorHint = useAppSelector((state) => state.ui.cursorHint);
  const isSnapEnabled = useAppSelector((state) => state.ui.snapEnabled);
  const gridSpacingMm = useAppSelector((state) => state.ui.gridSpacingMm);
  const cursorPosition = useSyncExternalStore(subscribeCursorPosition, getCursorSnapshot);
  const tool = TOOL_BY_ID.get(activeTool)!; // map covers every ToolId
  return (
    <footer className='flex h-statusbar items-center gap-3 border-t border-border bg-panel px-panel text-xs'>
      <span className='font-medium text-foreground'>{tool.label}</span>
      <span className='truncate text-muted-foreground'>{cursorHint || tool.hint}</span>
      <span className='ml-auto flex items-center gap-3 font-mono text-muted-foreground'>
        <button
          type='button'
          aria-pressed={isSnapEnabled}
          onClick={() => dispatch(toggleSnap())}
          className={`rounded-sm px-1 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring ${isSnapEnabled ? 'text-success' : ''}`}
        >
          Snap: {isSnapEnabled ? 'ON' : 'OFF'}
        </button>
        <span>Grid: {gridSpacingMm} mm</span>
        <span className='whitespace-pre'>{formatCursorPosition(cursorPosition)}</span>
      </span>
    </footer>
  );
}
