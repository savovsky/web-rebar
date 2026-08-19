// Section Cut tool + wireframe volume math: line & depth point → cut plane
// (view looks toward the depth click, §B.6), crossed-element detection, and
// the move/corner-stretch drag math behind the 3D wireframe handles.
// Model space is Z-up: plan in X–Y, elevation in Z (data/models/geometry.ts).
import { describe, expect, it } from 'vitest';
import type { ConcreteElement, WallElement } from '@/data/models';
import {
  type SectionPlanGeometry,
  applySectionDrag,
  depthPointOf,
  findElementsCrossedByLine,
  groundPointFromRay,
  isSameSectionGeometry,
  planNormalFromLine,
  sectionGeometryFromDepthPoint,
  sectionVolumeCorners,
  sectionVolumeHeightMm,
  sectionVolumeTransform,
} from './section-cut';

const wall = (overrides: Partial<WallElement>): WallElement => ({
  id: 'wall-1',
  kind: 'wall',
  startPoint: { x: 0, y: 0, z: 0 },
  endPoint: { x: 4000, y: 0, z: 0 },
  thickness: 200,
  height: 2800,
  baseElevation: 0,
  ...overrides,
});

/** Line along +X at y=0, viewed toward +Y with 500 depth. */
const baseGeometry = (): SectionPlanGeometry => ({
  lineStart: { x: 0, y: 0, z: 0 },
  lineEnd: { x: 4000, y: 0, z: 0 },
  normal: { x: 0, y: 1, z: 0 },
  viewDepthMm: 500,
});

describe('planNormalFromLine', () => {
  it('returns the plan-counterclockwise unit normal and never a -0 component', () => {
    expect(planNormalFromLine({ x: 100, y: 200, z: 0 }, { x: 1100, y: 200, z: 0 })).toEqual({
      x: 0,
      y: 1,
      z: 0,
    });
    const diagonal = planNormalFromLine({ x: 0, y: 0, z: 0 }, { x: 3000, y: 4000, z: 0 })!;
    expect(Math.hypot(diagonal.x, diagonal.y)).toBeCloseTo(1);
    expect(diagonal.z).toBe(0);
    expect(diagonal.x * 3000 + diagonal.y * 4000).toBeCloseTo(0); // perpendicular
  });

  it('returns null for a zero-length line', () => {
    expect(planNormalFromLine({ x: 5, y: 5, z: 0 }, { x: 5, y: 5, z: 0 })).toBeNull();
  });
});

describe('sectionGeometryFromDepthPoint', () => {
  const line = { lineStart: { x: 0, y: 0, z: 0 }, lineEnd: { x: 4000, y: 0, z: 0 } };

  it('orients the view toward the depth point and takes its distance as depth', () => {
    const geometry = sectionGeometryFromDepthPoint({ ...line, depthPoint: { x: 2000, y: 3000, z: 0 } })!;
    expect(geometry.plane.origin).toEqual({ x: 0, y: 0, z: 0 });
    expect(geometry.plane.normal).toEqual({ x: 0, y: 1, z: 0 });
    expect(geometry.viewDepthMm).toBeCloseTo(3000);

    const flipped = sectionGeometryFromDepthPoint({ ...line, depthPoint: { x: 2000, y: -1200, z: 0 } })!;
    expect(flipped.plane.normal).toEqual({ x: 0, y: -1, z: 0 });
    expect(flipped.viewDepthMm).toBeCloseTo(1200);
  });

  it('measures depth perpendicularly, not along the line', () => {
    const geometry = sectionGeometryFromDepthPoint({ ...line, depthPoint: { x: 3999, y: 800, z: 0 } })!;
    expect(geometry.viewDepthMm).toBeCloseTo(800);
  });

  it('rejects a zero-length line and a depth point on the line', () => {
    expect(
      sectionGeometryFromDepthPoint({
        lineStart: line.lineStart,
        lineEnd: line.lineStart,
        depthPoint: { x: 0, y: 100, z: 0 },
      }),
    ).toBeNull();
    expect(sectionGeometryFromDepthPoint({ ...line, depthPoint: { x: 2000, y: 0, z: 0 } })).toBeNull();
  });
});

describe('findElementsCrossedByLine', () => {
  const elements = (list: WallElement[]): Record<string, ConcreteElement> =>
    Object.fromEntries(list.map((element) => [element.id, element]));

  it('finds a wall the line crosses perpendicularly', () => {
    const ids = findElementsCrossedByLine({
      lineStart: { x: 2000, y: -500, z: 0 },
      lineEnd: { x: 2000, y: 500, z: 0 },
      elements: elements([wall({})]),
    });
    expect(ids).toEqual(['wall-1']);
  });

  it('ignores a line passing beside the wall', () => {
    const ids = findElementsCrossedByLine({
      lineStart: { x: 2000, y: 200, z: 0 },
      lineEnd: { x: 2000, y: 500, z: 0 },
      elements: elements([wall({})]),
    });
    expect(ids).toEqual([]);
  });

  it('counts a drag that ends inside the footprint (endpoint-in-rect chord)', () => {
    const ids = findElementsCrossedByLine({
      lineStart: { x: 2000, y: -500, z: 0 },
      lineEnd: { x: 2000, y: 0, z: 0 },
      elements: elements([wall({})]),
    });
    expect(ids).toEqual(['wall-1']);
  });

  it('counts a drag fully inside the footprint (zoomed-in cut)', () => {
    const ids = findElementsCrossedByLine({
      lineStart: { x: 1000, y: 0, z: 0 },
      lineEnd: { x: 3000, y: 0, z: 0 },
      elements: elements([wall({})]),
    });
    expect(ids).toEqual(['wall-1']);
  });

  it('ignores a grazing corner touch — no element area in the plane', () => {
    const ids = findElementsCrossedByLine({
      lineStart: { x: 5000, y: 500, z: 0 },
      lineEnd: { x: 4000, y: 100, z: 0 }, // exactly the footprint corner
      elements: elements([wall({})]),
    });
    expect(ids).toEqual([]);
  });

  it('crosses a yawed wall', () => {
    const yawed = wall({
      startPoint: { x: 0, y: 0, z: 0 },
      endPoint: { x: 0, y: 4000, z: 0 }, // axis along +Y → footprint x ∈ [-100, 100]
    });
    const ids = findElementsCrossedByLine({
      lineStart: { x: -500, y: 2000, z: 0 },
      lineEnd: { x: 500, y: 2000, z: 0 },
      elements: elements([yawed]),
    });
    expect(ids).toEqual(['wall-1']);
  });

  it('returns every crossed wall when the line spans several', () => {
    const second = wall({
      id: 'wall-2',
      startPoint: { x: 0, y: 1000, z: 0 },
      endPoint: { x: 4000, y: 1000, z: 0 },
    });
    const ids = findElementsCrossedByLine({
      lineStart: { x: 2000, y: -500, z: 0 },
      lineEnd: { x: 2000, y: 2000, z: 0 },
      elements: elements([wall({}), second]),
    });
    expect(ids).toEqual(['wall-1', 'wall-2']);
  });
});

describe('applySectionDrag', () => {
  it('move: translates the line, keeping depth and normal', () => {
    const next = applySectionDrag({
      geometry: baseGeometry(),
      drag: {
        kind: 'move',
        startGround: { x: 1000, y: 100, z: 0 },
        currentGround: { x: 1300, y: 600, z: 0 },
      },
    })!;
    expect(next.lineStart).toEqual({ x: 300, y: 500, z: 0 });
    expect(next.lineEnd).toEqual({ x: 4300, y: 500, z: 0 });
    expect(next.normal).toEqual({ x: 0, y: 1, z: 0 });
    expect(next.viewDepthMm).toBe(500);
  });

  it('move without travel returns the input unchanged (identity = click)', () => {
    const geometry = baseGeometry();
    const next = applySectionDrag({
      geometry,
      drag: { kind: 'move', startGround: { x: 0, y: 0, z: 0 }, currentGround: { x: 0, y: 0, z: 0 } },
    });
    expect(next).toBe(geometry);
  });

  it('front corner: re-forms the line from the dragged endpoint, keeps the side', () => {
    const next = applySectionDrag({
      geometry: baseGeometry(),
      drag: {
        kind: 'corner',
        corner: 'frontStart',
        startGround: { x: 0, y: 0, z: 0 },
        currentGround: { x: -500, y: -800, z: 0 },
      },
    })!;
    expect(next.lineStart).toEqual({ x: -500, y: -800, z: 0 });
    expect(next.lineEnd).toEqual({ x: 4000, y: 0, z: 0 });
    expect(next.viewDepthMm).toBe(500);
    // The line rotated; the normal must still point into the +Y-ish side.
    expect(next.normal.y).toBeGreaterThan(0);
  });

  it('back corner: slides the line endpoint and re-sets the depth', () => {
    const next = applySectionDrag({
      geometry: baseGeometry(),
      drag: {
        kind: 'corner',
        corner: 'backStart',
        startGround: { x: 0, y: 500, z: 0 },
        currentGround: { x: 700, y: 900, z: 0 },
      },
    })!;
    expect(next.lineStart).toEqual({ x: 700, y: 0, z: 0 }); // foot on the line
    expect(next.lineEnd).toEqual({ x: 4000, y: 0, z: 0 });
    expect(next.viewDepthMm).toBeCloseTo(900);
    expect(next.normal).toEqual({ x: 0, y: 1, z: 0 });
  });

  it('back corner dragged past the line flips the view side', () => {
    const next = applySectionDrag({
      geometry: baseGeometry(),
      drag: {
        kind: 'corner',
        corner: 'backEnd',
        startGround: { x: 4000, y: 500, z: 0 },
        currentGround: { x: 4000, y: -300, z: 0 },
      },
    })!;
    expect(next.normal).toEqual({ x: 0, y: -1, z: 0 });
    expect(next.viewDepthMm).toBeCloseTo(300);
  });

  it('front corner dragged onto the other endpoint collapses to null', () => {
    const next = applySectionDrag({
      geometry: baseGeometry(),
      drag: {
        kind: 'corner',
        corner: 'frontStart',
        startGround: { x: 0, y: 0, z: 0 },
        currentGround: { x: 4000, y: 0, z: 0 },
      },
    });
    expect(next).toBeNull();
  });
});

describe('geometry round-trips and volume helpers', () => {
  it('depthPointOf lands on the viewed side at view depth', () => {
    const geometry = baseGeometry();
    const depthPoint = depthPointOf(geometry);
    expect(depthPoint).toEqual({ x: 0, y: 500, z: 0 });
    const roundTrip = sectionGeometryFromDepthPoint({
      lineStart: geometry.lineStart,
      lineEnd: geometry.lineEnd,
      depthPoint,
    })!;
    expect(roundTrip.plane.normal).toEqual(geometry.normal);
    expect(roundTrip.viewDepthMm).toBeCloseTo(geometry.viewDepthMm);
  });

  it('isSameSectionGeometry respects tolerance and normal side', () => {
    const geometry = baseGeometry();
    expect(isSameSectionGeometry(geometry, { ...geometry })).toBe(true);
    expect(isSameSectionGeometry(geometry, { ...geometry, viewDepthMm: 600 })).toBe(false);
    expect(isSameSectionGeometry(geometry, { ...geometry, normal: { x: 0, y: -1, z: 0 } })).toBe(false);
  });

  it('volume corners: bottom plan rectangle first, then the top four', () => {
    const corners = sectionVolumeCorners({ geometry: baseGeometry(), heightMm: 2800 });
    expect(corners).toHaveLength(8);
    expect(corners[0]).toEqual({ x: 0, y: 0, z: 0 });
    expect(corners[2]).toEqual({ x: 4000, y: 500, z: 0 });
    expect(corners[4]).toEqual({ x: 0, y: 0, z: 2800 });
    expect(corners[7]).toEqual({ x: 0, y: 500, z: 2800 });
  });

  it('volume transform centers the slab box and clamps degenerate extents', () => {
    const transform = sectionVolumeTransform({ geometry: baseGeometry(), heightMm: 2800 });
    expect(transform.center).toEqual({ x: 2000, y: 250, z: 1400 });
    expect(transform.lengthMm).toBeCloseTo(4000);
    expect(transform.depthMm).toBeCloseTo(500);
    expect(transform.rotationZ).toBeCloseTo(0);
    const collapsed = sectionVolumeTransform({
      geometry: { ...baseGeometry(), viewDepthMm: 0 },
      heightMm: 2800,
    });
    expect(collapsed.depthMm).toBeGreaterThan(0);
  });

  it('volume height follows the tallest target, else the fallback', () => {
    const section = {
      id: 's1',
      name: 'S-1',
      lineStart: { x: 0, y: 0, z: 0 },
      lineEnd: { x: 4000, y: 0, z: 0 },
      plane: { origin: { x: 0, y: 0, z: 0 }, normal: { x: 0, y: 1, z: 0 } },
      viewDepth: 500,
      targetElementIds: ['wall-1'],
    };
    const elements: Record<string, ConcreteElement> = { 'wall-1': wall({ height: 3100 }) };
    expect(sectionVolumeHeightMm({ section, elements, fallbackMm: 2800 })).toBe(3100);
    expect(
      sectionVolumeHeightMm({ section: { ...section, targetElementIds: [] }, elements, fallbackMm: 2800 }),
    ).toBe(2800);
  });
});

describe('groundPointFromRay', () => {
  it('intersects a downward ray with the ground plane', () => {
    const point = groundPointFromRay({ x: 100, y: 300, z: 2000 }, { x: 0, y: 0, z: -1 })!;
    expect(point).toEqual({ x: 100, y: 300, z: 0 });
  });

  it('handles tilted rays and rejects parallel/upward ones', () => {
    const tilted = groundPointFromRay({ x: 0, y: 0, z: 1000 }, { x: 0.5, y: 0, z: -0.5 })!;
    expect(tilted.x).toBeCloseTo(1000);
    expect(groundPointFromRay({ x: 0, y: 0, z: 1000 }, { x: 1, y: 0, z: 0 })).toBeNull();
    expect(groundPointFromRay({ x: 0, y: 0, z: 1000 }, { x: 0, y: 0, z: 1 })).toBeNull();
  });
});
