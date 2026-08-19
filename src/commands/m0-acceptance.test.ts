// T11 — M0 acceptance pass (Architecture Spec §A): "place wall → place bar at
// 25 mm cover → cut section → 2D view shows wall outline + bar dot at the
// correct offset", driven headlessly through the §N command layer exactly as
// the tools drive it (the Place Bar tool resolves face clicks to a centerline
// via engine/placement; this test uses the same resolver). Cut bars cross the
// real WASM boundary (initWasmFromDisk).
import { beforeAll, describe, expect, it } from 'vitest';
import { createSection, placeBar, placeWall, setActiveSection } from '@/commands';
import { DEFAULT_BAR_DIAMETER_MM, resolveDefaultCover } from '@/commands/place-bar';
import { getWallFaceFrame, resolveBarCenterline } from '@/engine/placement';
import { selectSectionPrimitives } from '@/engine/sectioning';
import { initWasmFromDisk } from '@/engine/wasm-test-init';
import { createAppStore } from '@/stores';

beforeAll(initWasmFromDisk);

const WALL_LENGTH_MM = 4000;
const WALL_THICKNESS_MM = 200;
const WALL_HEIGHT_MM = 2800;
const BAR_HEIGHT_MM = 1400;
/** Expected centerline offset from the +Y face: cover (25) + radius (Ø12/2). */
const EXPECTED_CENTERLINE_OFFSET_MM = 31;

describe('M0 acceptance: one wall, one bar, one section', () => {
  it('placeWall → placeBar at 25 mm cover → createSection → outline + dot at u = 31 mm', () => {
    const store = createAppStore();

    // 1. Place the wall (Place Wall tool → placeWall command).
    const wallId = store.dispatch(
      placeWall({
        startPoint: { x: 0, y: 0, z: 0 },
        endPoint: { x: WALL_LENGTH_MM, y: 0, z: 0 },
        thickness: WALL_THICKNESS_MM,
        height: WALL_HEIGHT_MM,
      }),
    );

    // 2. Place the bar at 25 mm cover (Place Bar tool → placeBar command).
    //    Face clicks on the +Y face resolve to a centerline 31 mm inside,
    //    exactly as place-bar-draft.ts computes them.
    const wall = store.getState().project.elements[wallId];
    expect(wall?.kind).toBe('wall');
    const frame = getWallFaceFrame(wall, { x: 0, y: 1, z: 0 });
    const centerline = resolveBarCenterline({
      facePoints: [
        { x: 500, y: WALL_THICKNESS_MM / 2, z: BAR_HEIGHT_MM },
        { x: 3500, y: WALL_THICKNESS_MM / 2, z: BAR_HEIGHT_MM },
      ],
      frame,
      wall,
      coverMm: resolveDefaultCover('wall'),
      radiusMm: DEFAULT_BAR_DIAMETER_MM / 2,
    });
    const barId = store.dispatch(
      placeBar({ hostElementId: wallId, diameter: DEFAULT_BAR_DIAMETER_MM, path: centerline }),
    );

    // The stored bar keeps the resolved cover as design intent (§C).
    const bar = store.getState().project.reinforcement[barId];
    expect(bar.coverDistance).toBe(25);
    for (const point of bar.path) {
      expect(WALL_THICKNESS_MM / 2 - point.y).toBeCloseTo(EXPECTED_CENTERLINE_OFFSET_MM);
      expect(point.z).toBe(BAR_HEIGHT_MM);
    }

    // 3. Cut the section (Section Cut tool → createSection command):
    //    perpendicular line at x = 2000, looking along +X, 2500 mm depth.
    const sectionId = store.dispatch(
      createSection({
        name: 'S-1',
        lineStart: { x: 2000, y: -500, z: 0 },
        lineEnd: { x: 2000, y: 500, z: 0 },
        depthPoint: { x: 4500, y: 0, z: 0 },
        targetElementIds: [wallId],
      }),
    );
    store.dispatch(setActiveSection({ sectionId }));
    expect(store.getState().ui.activeSectionId).toBe(sectionId);

    // 4. The 2D view (memoized §G.1 Tier 1 selector — derived, never stored).
    const primitives = selectSectionPrimitives(store.getState(), sectionId);
    if (primitives === null) throw new Error('expected primitives for a known section');
    const { concreteOutlines, cutBars, backgroundLines } = primitives;

    // Wall outline: one rectangle, thickness × height in section coords.
    expect(concreteOutlines).toHaveLength(1);
    const [outline] = concreteOutlines;
    const us = outline.map((point) => point.u);
    const vs = outline.map((point) => point.v);
    expect(Math.max(...us) - Math.min(...us)).toBeCloseTo(WALL_THICKNESS_MM);
    expect(Math.max(...vs) - Math.min(...vs)).toBeCloseTo(WALL_HEIGHT_MM);

    // Bar dot: one crossing, true diameter (§M.4), at the correct offset —
    // 31 mm (cover 25 + Ø/2) from the covered outline side, v = bar height.
    // (u runs along −y for a cut looking along +X, so the covered +Y face is
    // the u-min side of the outline.)
    expect(cutBars).toHaveLength(1);
    const [dot] = cutBars;
    expect(dot.diameterMm).toBe(DEFAULT_BAR_DIAMETER_MM);
    expect(dot.center.v).toBeCloseTo(BAR_HEIGHT_MM);
    expect(dot.center.u - Math.min(...us)).toBeCloseTo(EXPECTED_CENTERLINE_OFFSET_MM);
    expect(dot.center.u).toBeGreaterThan(Math.min(...us));
    expect(dot.center.u).toBeLessThan(Math.max(...us));

    // Background (§G.2.3): the perpendicular mid-wall cut's far-end edges
    // coincide with the outline sides and the bar runs along the view
    // direction (its end-on representation is the cut dot) — nothing left.
    expect(backgroundLines).toHaveLength(0);
  });
});
