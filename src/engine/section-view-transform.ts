// Auto-fit world→canvas transform for the 2D section view (§I) — pure and
// three-free (rule 2: the SectionView component only applies this). Section
// coordinates are mm with v growing upward; canvas coordinates are px with y
// growing downward — the mapping is a uniform scale + translation with a
// Y-flip.
import type { SectionPoint, SectionPrimitives } from './sectioning';

/** mm — span floor for degenerate content so the fit never divides by ~0. */
const MIN_SPAN_MM = 1;

export interface SectionBounds {
  minU: number;
  minV: number;
  maxU: number;
  maxV: number;
}

/**
 * Bounding box of all primitives in section coordinates. Cut-bar dots extend
 * the bounds by their radius (true diameters, §M.4). Null when there is
 * nothing to draw.
 */
export function getSectionBounds(primitives: SectionPrimitives): SectionBounds | null {
  let bounds: SectionBounds | null = null;
  const extend = (u: number, v: number): void => {
    if (bounds === null) {
      bounds = { minU: u, minV: v, maxU: u, maxV: v };
      return;
    }
    bounds.minU = Math.min(bounds.minU, u);
    bounds.minV = Math.min(bounds.minV, v);
    bounds.maxU = Math.max(bounds.maxU, u);
    bounds.maxV = Math.max(bounds.maxV, v);
  };
  for (const outline of primitives.concreteOutlines) {
    for (const point of outline) extend(point.u, point.v);
  }
  for (const line of primitives.backgroundLines) {
    for (const point of line) extend(point.u, point.v);
  }
  for (const dot of primitives.cutBars) {
    const radius = dot.diameterMm / 2;
    extend(dot.center.u - radius, dot.center.v - radius);
    extend(dot.center.u + radius, dot.center.v + radius);
  }
  return bounds;
}

/** Empty-view check for the panel's placeholder text. */
export function hasSectionGeometry(primitives: SectionPrimitives | null): boolean {
  return (
    primitives !== null &&
    (primitives.concreteOutlines.length > 0 ||
      primitives.cutBars.length > 0 ||
      primitives.backgroundLines.length > 0)
  );
}

/**
 * Uniform mm→px mapping with Y-flip. Canvas x = offsetX + u·scale, canvas
 * y = offsetY − v·scale.
 */
export interface SectionViewTransform {
  /** px per mm — uniform, the view never distorts. */
  scalePxPerMm: number;
  offsetXPx: number;
  offsetYPx: number;
}

export interface AutoFitOptions {
  bounds: SectionBounds;
  canvasWidthPx: number;
  canvasHeightPx: number;
  paddingPx: number;
}

/**
 * Fits the bounds into the canvas with uniform scale (limited by the tighter
 * dimension) and centers them. Padding is a screen-space margin per side.
 */
export function computeAutoFitTransform(options: AutoFitOptions): SectionViewTransform {
  const { bounds, canvasWidthPx, canvasHeightPx, paddingPx } = options;
  const spanU = Math.max(bounds.maxU - bounds.minU, MIN_SPAN_MM);
  const spanV = Math.max(bounds.maxV - bounds.minV, MIN_SPAN_MM);
  const fitWidthPx = Math.max(canvasWidthPx - 2 * paddingPx, MIN_SPAN_MM);
  const fitHeightPx = Math.max(canvasHeightPx - 2 * paddingPx, MIN_SPAN_MM);
  const scalePxPerMm = Math.min(fitWidthPx / spanU, fitHeightPx / spanV);
  const centerU = (bounds.minU + bounds.maxU) / 2;
  const centerV = (bounds.minV + bounds.maxV) / 2;
  return {
    scalePxPerMm,
    offsetXPx: canvasWidthPx / 2 - centerU * scalePxPerMm,
    offsetYPx: canvasHeightPx / 2 + centerV * scalePxPerMm,
  };
}

export interface CanvasPoint {
  xPx: number;
  yPx: number;
}

/** Section coords → canvas px (Y-flip: v grows up, canvas y grows down). */
export function sectionToCanvas(point: SectionPoint, transform: SectionViewTransform): CanvasPoint {
  return {
    xPx: transform.offsetXPx + point.u * transform.scalePxPerMm,
    yPx: transform.offsetYPx - point.v * transform.scalePxPerMm,
  };
}
