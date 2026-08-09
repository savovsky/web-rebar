// Canvas2D renderer for the 2D section view (§I.1 — Canvas2D is the main
// drawing surface; the SVG interaction overlay arrives with annotation work).
// Pure rendering: the auto-fit transform math lives in
// engine/section-view-transform (rule 2), ink colors come from design tokens
// (doc 10), line weights/dash from the domain pen table (§M.4,
// src/data/appearance.ts).
import { DEFAULT_SECTION_PEN_TABLE } from '@/data/appearance';
import {
  type SectionViewTransform,
  computeAutoFitTransform,
  getSectionBounds,
  sectionToCanvas,
} from '@/engine/section-view-transform';
import type { SectionPoint, SectionPrimitives } from '@/engine/sectioning';
import { SECTION_FIT_PADDING_PX } from './constants';
import type { SectionViewTheme } from './section-view-theme';

interface TracePolylineOptions {
  context: CanvasRenderingContext2D;
  points: SectionPoint[];
  transform: SectionViewTransform;
  isClosed: boolean;
}

function tracePolyline(options: TracePolylineOptions): void {
  const { context, points, transform, isClosed } = options;
  const first = points[0] as SectionPoint | undefined;
  if (!first) return;
  const start = sectionToCanvas(first, transform);
  context.beginPath();
  context.moveTo(start.xPx, start.yPx);
  for (const point of points.slice(1)) {
    const canvas = sectionToCanvas(point, transform);
    context.lineTo(canvas.xPx, canvas.yPx);
  }
  if (isClosed) context.closePath();
  context.stroke();
}

export interface RenderSectionOptions {
  context: CanvasRenderingContext2D;
  widthPx: number;
  heightPx: number;
  primitives: SectionPrimitives | null;
  theme: SectionViewTheme;
}

/** Draws one frame of the section view onto the canvas (clears first). */
export function renderSectionToCanvas(options: RenderSectionOptions): void {
  const { context, widthPx, heightPx, primitives, theme } = options;
  const dpr = window.devicePixelRatio || 1; // crisp lines on HiDPI displays
  context.canvas.width = Math.round(widthPx * dpr);
  context.canvas.height = Math.round(heightPx * dpr);
  context.setTransform(dpr, 0, 0, dpr, 0, 0);
  context.clearRect(0, 0, widthPx, heightPx);
  if (!primitives) return;
  const bounds = getSectionBounds(primitives);
  if (!bounds) return;
  const transform = computeAutoFitTransform({
    bounds,
    canvasWidthPx: widthPx,
    canvasHeightPx: heightPx,
    paddingPx: SECTION_FIT_PADDING_PX,
  });

  // Background within viewDepth — dashed, muted ink (§G.2.3 convention).
  context.strokeStyle = theme.backgroundInk;
  context.lineWidth = DEFAULT_SECTION_PEN_TABLE.backgroundLineWidthPx;
  context.setLineDash(DEFAULT_SECTION_PEN_TABLE.backgroundDashPx);
  for (const line of primitives.backgroundLines) {
    tracePolyline({ context, points: line, transform, isClosed: false });
  }

  // Cut concrete — solid outlines (hatching arrives with the pen-table work).
  context.setLineDash([]);
  context.strokeStyle = theme.ink;
  context.lineWidth = DEFAULT_SECTION_PEN_TABLE.concreteOutlineWidthPx;
  for (const outline of primitives.concreteOutlines) {
    tracePolyline({ context, points: outline, transform, isClosed: true });
  }

  // Cut bars — filled dots at TRUE relative diameters (§M.4).
  context.fillStyle = theme.ink;
  for (const dot of primitives.cutBars) {
    const center = sectionToCanvas(dot.center, transform);
    context.beginPath();
    context.arc(center.xPx, center.yPx, (dot.diameterMm / 2) * transform.scalePxPerMm, 0, 2 * Math.PI);
    context.fill();
  }
}
