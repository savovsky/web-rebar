// Auto-fit world→canvas transform: bounds (dots extend by their true radius,
// §M.4), uniform fit limited by the tighter dimension, centering, Y-flip.
import { describe, expect, it } from 'vitest';
import {
  computeAutoFitTransform,
  getSectionBounds,
  hasSectionGeometry,
  sectionToCanvas,
} from './section-view-transform';
import type { SectionPrimitives } from './sectioning';

const PADDING_PX = 16;

const primitives = (overrides: Partial<SectionPrimitives>): SectionPrimitives => ({
  concreteOutlines: [],
  cutBars: [],
  backgroundLines: [],
  ...overrides,
});

/** The M0 acceptance geometry: 200 × 2800 wall outline + Ø12 dot at u = 31. */
const acceptancePrimitives = primitives({
  concreteOutlines: [
    [
      { u: 0, v: 0 },
      { u: 200, v: 0 },
      { u: 200, v: 2800 },
      { u: 0, v: 2800 },
    ],
  ],
  cutBars: [{ center: { u: 31, v: 500 }, diameterMm: 12 }],
});

describe('getSectionBounds', () => {
  it('bounds the outline, background lines, and dots extended by their radius', () => {
    const bounds = getSectionBounds(
      primitives({
        concreteOutlines: acceptancePrimitives.concreteOutlines,
        cutBars: [{ center: { u: 31, v: 500 }, diameterMm: 12 }],
        backgroundLines: [
          [
            { u: -100, v: 0 },
            { u: -100, v: 2800 },
          ],
        ],
      }),
    );
    expect(bounds).toEqual({ minU: -100, minV: 0, maxU: 200, maxV: 2800 });
  });

  it('extends the bounds by the dot radius when the dot is the extreme', () => {
    const bounds = getSectionBounds(primitives({ cutBars: [{ center: { u: 50, v: 50 }, diameterMm: 20 }] }));
    expect(bounds).toEqual({ minU: 40, minV: 40, maxU: 60, maxV: 60 });
  });

  it('returns null when there is nothing to draw', () => {
    expect(getSectionBounds(primitives({}))).toBeNull();
  });
});

describe('hasSectionGeometry', () => {
  it('is false for null and empty primitives, true for any content', () => {
    expect(hasSectionGeometry(null)).toBe(false);
    expect(hasSectionGeometry(primitives({}))).toBe(false);
    expect(hasSectionGeometry(primitives({ cutBars: [{ center: { u: 0, v: 0 }, diameterMm: 8 }] }))).toBe(
      true,
    );
  });
});

describe('computeAutoFitTransform + sectionToCanvas', () => {
  const canvas = { canvasWidthPx: 320, canvasHeightPx: 220, paddingPx: PADDING_PX };

  it('fits with a uniform scale limited by the tighter dimension', () => {
    // Outline 200 × 2800 into 288 × 188 fit area → height limits: 188/2800.
    const bounds = getSectionBounds(acceptancePrimitives)!;
    const transform = computeAutoFitTransform({ bounds, ...canvas });
    expect(transform.scalePxPerMm).toBeCloseTo((canvas.canvasHeightPx - 2 * PADDING_PX) / 2800);
  });

  it('centers the bounds in the canvas', () => {
    const bounds = getSectionBounds(acceptancePrimitives)!;
    const transform = computeAutoFitTransform({ bounds, ...canvas });
    const center = sectionToCanvas(
      { u: (bounds.minU + bounds.maxU) / 2, v: (bounds.minV + bounds.maxV) / 2 },
      transform,
    );
    expect(center.xPx).toBeCloseTo(canvas.canvasWidthPx / 2);
    expect(center.yPx).toBeCloseTo(canvas.canvasHeightPx / 2);
  });

  it('respects the padding on the limiting dimension', () => {
    const bounds = getSectionBounds(acceptancePrimitives)!;
    const transform = computeAutoFitTransform({ bounds, ...canvas });
    // Height-limited fit: v extremes land exactly on the padding margins.
    expect(sectionToCanvas({ u: 0, v: bounds.maxV }, transform).yPx).toBeCloseTo(PADDING_PX);
    expect(sectionToCanvas({ u: 0, v: bounds.minV }, transform).yPx).toBeCloseTo(
      canvas.canvasHeightPx - PADDING_PX,
    );
  });

  it('flips Y: a higher section point lands higher up on the canvas (smaller y)', () => {
    const bounds = getSectionBounds(acceptancePrimitives)!;
    const transform = computeAutoFitTransform({ bounds, ...canvas });
    const low = sectionToCanvas({ u: 100, v: 100 }, transform);
    const high = sectionToCanvas({ u: 100, v: 2000 }, transform);
    expect(high.yPx).toBeLessThan(low.yPx);
  });

  it('never divides by ~0 on degenerate (single-dot) content', () => {
    const dotOnly = primitives({ cutBars: [{ center: { u: 0, v: 0 }, diameterMm: 0 }] });
    const transform = computeAutoFitTransform({ bounds: getSectionBounds(dotOnly)!, ...canvas });
    expect(Number.isFinite(transform.scalePxPerMm)).toBe(true);
    expect(transform.scalePxPerMm).toBeGreaterThan(0);
  });
});
