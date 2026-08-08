// Placeholder for the T3 smoke scene's slot — the real R3F canvas (Viewport3D)
// lands here in T7. Keeps the §B.2 shell honest until then.
import { useAppSelector } from '@/stores/hooks';
import { TOOL_BY_ID } from '@/ui/toolbar/tools';

export function ViewportPlaceholder() {
  const activeTool = useAppSelector((state) => state.ui.activeTool);
  const tool = TOOL_BY_ID.get(activeTool)!; // map covers every ToolId
  return (
    <div className='grid h-full place-items-center'>
      <p className='text-center text-xs text-muted-foreground'>
        3D viewport arrives in T7 — active tool:{' '}
        <span className='font-medium text-foreground'>{tool.label}</span>
      </p>
    </div>
  );
}
