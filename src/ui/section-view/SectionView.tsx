// Dockable 2D section view (§B.2 — bottom-right, inside the viewport area).
// Renders the memoized selectSectionPrimitives (engine/sectioning) to Canvas2D
// via the renderer module — the component only selects state and delegates
// (rule 2: no geometry math here). Opened/closed through the §N
// setActiveSection command; docking/floating is post-M0.
import { useEffect, useRef, useState } from 'react';
import { setActiveSection } from '@/commands/set-active-section';
import { hasSectionGeometry } from '@/engine/section-view-transform';
import { selectSectionPrimitives } from '@/engine/sectioning';
import { useAppDispatch, useAppSelector } from '@/stores/hooks';
import { renderSectionToCanvas } from './section-canvas-renderer';
import { useSectionViewTheme } from './section-view-theme';

interface CanvasSize {
  widthPx: number;
  heightPx: number;
}

function SectionViewDock({ sectionId }: { sectionId: string }) {
  const dispatch = useAppDispatch();
  const theme = useSectionViewTheme();
  const sectionName = useAppSelector((state) => state.project.sections[sectionId]?.name ?? sectionId);
  const primitives = useAppSelector((state) => selectSectionPrimitives(state, sectionId));
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const [canvasSize, setCanvasSize] = useState<CanvasSize | null>(null);

  useEffect(() => {
    const body = bodyRef.current;
    if (!body) return;
    const observer = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect;
      if (rect) setCanvasSize({ widthPx: rect.width, heightPx: rect.height });
    });
    observer.observe(body);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const context = canvasRef.current?.getContext('2d');
    if (!context || !canvasSize) return;
    renderSectionToCanvas({
      context,
      widthPx: canvasSize.widthPx,
      heightPx: canvasSize.heightPx,
      primitives,
      theme,
    });
  }, [primitives, canvasSize, theme]);

  return (
    // Initially ~a quarter of the viewport area (½ × ½); user-resizable via
    // the native corner grip (resize: both), down to the token minimums.
    <aside className='absolute right-panel bottom-panel flex h-1/2 w-1/2 min-w-panel-section resize flex-col overflow-hidden rounded-md border border-border bg-panel min-h-section-view'>
      <header className='flex h-control shrink-0 items-center justify-between border-b border-border px-panel'>
        <span className='text-xs font-medium text-foreground'>{sectionName}</span>
        <button
          type='button'
          aria-label={`Close section view ${sectionName}`}
          onClick={() => dispatch(setActiveSection({ sectionId: null }))}
          className='rounded-sm px-1 text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring'
        >
          ✕
        </button>
      </header>
      <div ref={bodyRef} className='relative min-h-0 flex-1'>
        <canvas ref={canvasRef} className='h-full w-full' />
        {!hasSectionGeometry(primitives) && (
          <span className='pointer-events-none absolute inset-0 flex items-center justify-center text-xs text-muted-foreground'>
            No geometry in this view
          </span>
        )}
      </div>
    </aside>
  );
}

export function SectionView() {
  const activeSectionId = useAppSelector((state) => state.ui.activeSectionId);
  if (!activeSectionId) return null;
  return <SectionViewDock sectionId={activeSectionId} />;
}
