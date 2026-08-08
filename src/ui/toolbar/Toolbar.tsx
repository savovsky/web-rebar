// Vertical tool palette, left edge of the viewport (§B.2 / §B.6).
import { TooltipProvider } from '@radix-ui/react-tooltip';
import { ToolButton } from './ToolButton';
import { TOOLBAR_TOOLS } from './tools';

const TOOLTIP_DELAY_MS = 300;

export function Toolbar() {
  return (
    <TooltipProvider delayDuration={TOOLTIP_DELAY_MS}>
      <nav
        aria-label='Tool palette'
        className='flex w-panel-left flex-col items-center gap-1 border-r border-border bg-panel py-panel'
      >
        {TOOLBAR_TOOLS.map((tool) => (
          <ToolButton key={tool.id} tool={tool} />
        ))}
      </nav>
    </TooltipProvider>
  );
}
