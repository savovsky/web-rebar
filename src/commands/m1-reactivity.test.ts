// T2 — headless reactivity proofs: the §A "dependency graph correctness"
// probe (M1 plan §2). The memoized-selector graph (project state →
// selectSectionPrimitives) must re-derive correctly after every edit class:
// host-follow move (§E revised 2026-08-09), move fully off the cut plane,
// deleteElement, deleteBar. Driven through the §N command layer exactly as
// the tools drive it; the bar is resolved with the same engine/placement
// math as the Place Bar tool (M0 acceptance fixture); cut bars cross the
// real WASM boundary (initWasmFromDisk).
import { beforeAll, describe, expect, it } from 'vitest';
import { createSection, deleteBar, deleteElement, moveElement, placeBar, placeWall, undo } from '@/commands';
import { DEFAULT_BAR_DIAMETER_MM, resolveDefaultCover } from '@/commands/place-bar';
import { getWallFaceFrame, resolveBarCenterline } from '@/engine/placement';
import { type SectionPrimitives, selectSectionPrimitives } from '@/engine/sectioning';
import { initWasmFromDisk } from '@/engine/wasm-test-init';
import { createAppStore } from '@/stores';

beforeAll(initWasmFromDisk);

const WALL_LENGTH_MM = 4000;
const WALL_THICKNESS_MM = 200;
const WALL_HEIGHT_MM = 2800;
const BAR_HEIGHT_MM = 1400;
/** Expected centerline offset from the +Y face: cover (25) + radius (Ø12/2).
 *  Section u runs along −y (right = forward × +Z), so the covered +Y face is
 *  the u-min side of the outline. */
const EXPECTED_CENTERLINE_OFFSET_MM = 31;

interface Fixture {
  store: ReturnType<typeof createAppStore>;
  wallId: string;
  barId: string;
  sectionId: string;
  /** Primitives before any edit — the probe's baseline. */
  baseline: SectionPrimitives;
  /** [min, max] of the baseline outline's u coordinate. */
  baselineURange: [number, number];
}

/**
 * Wall (4000 × 200 × 2800) + one Ø12 bar at 25 mm cover from the +Y face
 * (centerline 31 mm inside) + a perpendicular section at x = 2000 looking
 * along +X (2500 mm depth) — the M0 acceptance setup, now edited.
 */
const createFixture = (): Fixture => {
  const store = createAppStore();
  const wallId = store.dispatch(
    placeWall({
      startPoint: { x: 0, y: 0, z: 0 },
      endPoint: { x: WALL_LENGTH_MM, y: 0, z: 0 },
      thickness: WALL_THICKNESS_MM,
      height: WALL_HEIGHT_MM,
    }),
  );

  const wall = store.getState().project.elements[wallId];
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

  const sectionId = store.dispatch(
    createSection({
      name: 'S-1',
      lineStart: { x: 2000, y: -500, z: 0 },
      lineEnd: { x: 2000, y: 500, z: 0 },
      depthPoint: { x: 4500, y: 0, z: 0 },
      targetElementIds: [wallId],
    }),
  );

  const baseline = selectSectionPrimitives(store.getState(), sectionId);
  if (baseline === null) throw new Error('expected primitives for a known section');
  expect(baseline.concreteOutlines).toHaveLength(1);
  expect(baseline.cutBars).toHaveLength(1);
  const us = baseline.concreteOutlines[0].map((point) => point.u);
  return { store, wallId, barId, sectionId, baseline, baselineURange: [Math.min(...us), Math.max(...us)] };
};

describe('M1 reactivity — the selector graph re-derives after every edit class (§A probe)', () => {
  it('moveElement: outline follows the wall; the dot keeps its 31 mm offset (host-follow) — and the selector is memoized', () => {
    const { store, wallId, sectionId, baseline, baselineURange } = createFixture();

    // Baseline: covered face is +Y (u min); the dot sits 31 mm inside it.
    const [baselineDot] = baseline.cutBars;
    expect(baselineDot.center.u - baselineURange[0]).toBeCloseTo(EXPECTED_CENTERLINE_OFFSET_MM);
    // Memoized: no state change → the identical reference, no recompute.
    expect(selectSectionPrimitives(store.getState(), sectionId)).toBe(baseline);

    // Move the wall 300 mm along +Y — still crossed by the cut plane AND
    // within the cut line extent (y ∈ [200, 400] ⊂ [-500, 500], §G.1 revised).
    // u runs along −y → the section content shifts by −300.
    store.dispatch(moveElement({ elementId: wallId, delta: { x: 0, y: 300, z: 0 } }));

    const moved = selectSectionPrimitives(store.getState(), sectionId);
    if (moved === null) throw new Error('expected primitives');
    expect(moved).not.toBe(baseline); // re-derived from the new project state
    expect(moved.concreteOutlines).toHaveLength(1);
    const movedUs = moved.concreteOutlines[0].map((point) => point.u);
    expect(Math.min(...movedUs)).toBeCloseTo(baselineURange[0] - 300); // outline follows the wall
    expect(Math.max(...movedUs)).toBeCloseTo(baselineURange[1] - 300);
    expect(moved.cutBars).toHaveLength(1);
    const [movedDot] = moved.cutBars;
    expect(movedDot.center.u).toBeCloseTo(baselineDot.center.u - 300); // the bar followed its host
    expect(movedDot.center.v).toBeCloseTo(BAR_HEIGHT_MM);
    expect(movedDot.diameterMm).toBe(DEFAULT_BAR_DIAMETER_MM);
    // The offset from the covered face survives the move exactly (host-follow).
    expect(movedDot.center.u - Math.min(...movedUs)).toBeCloseTo(EXPECTED_CENTERLINE_OFFSET_MM);

    // One undo restores wall + bar to the pre-move state exactly — the exact
    // project reference comes back, so the memoized selector returns the
    // baseline primitives object itself.
    store.dispatch(undo());
    expect(selectSectionPrimitives(store.getState(), sectionId)).toBe(baseline);
  });

  it('moveElement SIDEWAYS beyond the cut line extent: the outline/dot set empties (§G.1 revised — the T4 author scenario)', () => {
    const { store, wallId, sectionId, baseline } = createFixture();

    // The infinite cut plane still crosses the wall after a +Y move — but the
    // section view is bounded by the drawn line (y ∈ [-500, 500]), so the
    // content must disappear, matching the 3D wireframe volume.
    store.dispatch(moveElement({ elementId: wallId, delta: { x: 0, y: 10_000, z: 0 } }));

    const moved = selectSectionPrimitives(store.getState(), sectionId);
    if (moved === null) throw new Error('expected primitives');
    expect(moved).not.toBe(baseline); // re-derived — the change IS visible
    expect(moved.concreteOutlines).toEqual([]);
    expect(moved.cutBars).toEqual([]);
    expect(moved.backgroundLines).toEqual([]);

    store.dispatch(undo());
    expect(selectSectionPrimitives(store.getState(), sectionId)).toBe(baseline);
  });

  it('moveElement fully off the cut plane: the outline/dot set empties', () => {
    const { store, wallId, sectionId } = createFixture();

    store.dispatch(moveElement({ elementId: wallId, delta: { x: 10_000, y: 0, z: 0 } }));

    // The wall (x ∈ [10000, 14000]) misses the plane at x = 2000 entirely and
    // lies beyond the 2500 mm view depth — nothing cut, nothing behind.
    const primitives = selectSectionPrimitives(store.getState(), sectionId);
    if (primitives === null) throw new Error('expected primitives — the section itself survives');
    expect(primitives.concreteOutlines).toHaveLength(0);
    expect(primitives.cutBars).toHaveLength(0);
    expect(primitives.backgroundLines).toHaveLength(0);

    // Moving back (another command) re-derives the full picture.
    store.dispatch(moveElement({ elementId: wallId, delta: { x: -10_000, y: 0, z: 0 } }));
    const restored = selectSectionPrimitives(store.getState(), sectionId);
    expect(restored?.concreteOutlines).toHaveLength(1);
    expect(restored?.cutBars).toHaveLength(1);
  });

  it('deleteElement: the section survives but drops the wall (and its hosted bar)', () => {
    const { store, wallId, sectionId, baseline } = createFixture();

    store.dispatch(deleteElement({ id: wallId }));

    const primitives = selectSectionPrimitives(store.getState(), sectionId);
    if (primitives === null) throw new Error('expected primitives — deleteElement keeps sections');
    expect(primitives.concreteOutlines).toHaveLength(0);
    expect(primitives.cutBars).toHaveLength(0);
    expect(primitives.backgroundLines).toHaveLength(0);
    expect(store.getState().project.sections[sectionId]).toBeDefined();

    // Undo restores the cascade exactly — baseline reference returns.
    store.dispatch(undo());
    expect(selectSectionPrimitives(store.getState(), sectionId)).toBe(baseline);
  });

  it('deleteBar: the dot is gone, the outline stays', () => {
    const { store, barId, sectionId } = createFixture();

    store.dispatch(deleteBar({ id: barId }));

    const primitives = selectSectionPrimitives(store.getState(), sectionId);
    if (primitives === null) throw new Error('expected primitives');
    expect(primitives.cutBars).toHaveLength(0);
    expect(primitives.concreteOutlines).toHaveLength(1);
    const us = primitives.concreteOutlines[0].map((point) => point.u);
    const vs = primitives.concreteOutlines[0].map((point) => point.v);
    expect(Math.max(...us) - Math.min(...us)).toBeCloseTo(WALL_THICKNESS_MM);
    expect(Math.max(...vs) - Math.min(...vs)).toBeCloseTo(WALL_HEIGHT_MM);
  });
});
