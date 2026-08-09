// One tool palette button. Click activates (§B.6), double-click locks the tool
// (sticky mode — outer ring indicator). Tool state is UI state, so dispatching
// ui-slice setTool here is the §B.6-sanctioned path — no project-model mutation.
import { Tooltip, TooltipContent, TooltipTrigger } from '@radix-ui/react-tooltip';
import { useAppDispatch, useAppSelector } from '@/stores/hooks';
import { setTool } from '@/stores/ui-slice';
import type { ToolDefinition } from './tools';

function toolButtonClass(isActive: boolean, isSticky: boolean): string {
  // focus-visible: token-based keyboard indicator — replaces the UA default outline
  // (the button keeps DOM focus after activation, e.g. when Esc returns to Select).
  const base =
    'flex h-control-lg w-control-lg items-center justify-center rounded-md transition-colors ' +
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring';
  if (!isActive) return `${base} text-muted-foreground hover:bg-accent hover:text-foreground`;
  // Outer ring + panel-colored offset gap: visible on the primary background in
  // both themes (an inset primary-foreground ring blends into the panel color).
  const stickyRing = isSticky ? ' ring-2 ring-primary ring-offset-2 ring-offset-panel' : '';
  return `${base} bg-primary text-primary-foreground${stickyRing}`;
}

export function ToolButton({ tool }: { tool: ToolDefinition }) {
  const dispatch = useAppDispatch();
  const isActive = useAppSelector((state) => state.ui.activeTool === tool.id);
  const isSticky = useAppSelector((state) => state.ui.sticky && state.ui.activeTool === tool.id);
  const Icon = tool.icon;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type='button'
          aria-label={tool.label}
          aria-pressed={isActive}
          onClick={() => dispatch(setTool({ tool: tool.id }))}
          onDoubleClick={() => dispatch(setTool({ tool: tool.id, sticky: true }))}
          className={toolButtonClass(isActive, isSticky)}
        >
          <Icon className='h-icon w-icon' />
        </button>
      </TooltipTrigger>
      <TooltipContent
        side='right'
        className='z-50 rounded-md border border-border bg-panel px-2 py-1.5 text-xs text-foreground shadow-md'
      >
        <span className='font-medium'>{tool.label}</span>
        {tool.shortcut ? (
          <kbd className='ml-2 font-mono text-muted-foreground'>{tool.shortcut.toUpperCase()}</kbd>
        ) : null}
        <span className='block text-muted-foreground'>Double-click to lock · Esc for Select</span>
      </TooltipContent>
    </Tooltip>
  );
}
