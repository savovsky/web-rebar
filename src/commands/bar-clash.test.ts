// T6 — Q8 clash surfacing at the §N command layer (milestone acceptance
// sentence 4, headless): a group placed over pre-existing individual bars
// (and over a second overlapping group) flags EXACTLY the clashing bar pairs
// (centerline distance < r₁ + r₂) with exact pair ids + distances; a clean
// control reports nothing (no false positives); placement/move/regenerate
// stay NON-BLOCKING (§K.4). Also: the no-openings scope line is pinned —
// bar-vs-bar only (nothing else exists to collide against until M4).
// Crosses the real WASM boundary (initWasmFromDisk).
import { beforeAll, describe, expect, it } from 'vitest';
import {
  moveBar,
  movePlacementGroup,
  placeBar,
  placeBarGroup,
  placeWall,
  undo,
  updatePlacementGroup,
} from '@/commands';
import type { BarClash } from '@/engine/collision';
import { initWasmFromDisk } from '@/engine/wasm-test-init';
import { createAppStore } from '@/stores';

beforeAll(initWasmFromDisk);

/** The M0 acceptance wall: 4000 × 200 × 2800 (x 0..4000, y −100..100, z 0..2800). */
const WALL_PARAMS = {
  startPoint: { x: 0, y: 0, z: 0 },
  endPoint: { x: 4000, y: 0, z: 0 },
  thickness: 200,
  height: 2800,
};

/** Full posThickness face (the T2 corpus): horizontal Ø12 @ 150, cover 25,
 *  edges 60 → 18 bars at y = 69, z = 60 + k·150 (k = 0..17), x 25..3975. */
const groupParams = (wallId: string) => ({
  hostElementId: wallId,
  faceKey: 'face:posThickness' as const,
  region: { uMin: -2000, uMax: 2000, vMin: -1400, vMax: 1400 },
  diameter: 12,
  barSpacing: 150,
  edgeDistanceStart: 60,
  edgeDistanceEnd: 60,
  orientation: 'horizontal' as const,
});

/** An individual bar's centerline on the same cover plane (y = 69), Ø12. */
const placeIndividual = (options: {
  store: ReturnType<typeof createAppStore>;
  wallId: string;
  zMm: number;
}): string =>
  options.store.dispatch(
    placeBar({
      hostElementId: options.wallId,
      diameter: 12,
      path: [
        { x: 500, y: 69, z: options.zMm },
        { x: 3500, y: 69, z: options.zMm },
      ],
      coverDistance: 25,
    }),
  );

/** Pair key, order-normalized (UUID order is not predictable). */
const pairKey = (idA: string, idB: string): string => [idA, idB].sort().join('|');

/** The clashes as a comparable map: pair key → exact min distance. */
const clashMap = (clashes: BarClash[]): Map<string, number> =>
  new Map(clashes.map((clash) => [pairKey(clash.barIdA, clash.barIdB), clash.minDistanceMm]));

const expectSorted = (clashes: BarClash[]): void => {
  const keys = clashes.map((clash) => `${clash.barIdA}|${clash.barIdB}`);
  expect(keys).toEqual([...keys].sort((a, b) => a.localeCompare(b)));
};

/** Exact distances, tolerant of the face-frame float noise (the T2-recorded
 *  `normalize` rounding, ~1e-13 mm) — the engine is exact; the generated
 *  PATHS carry sub-nanometer noise. */
const expectDistance = (actual: number | undefined, expectedMm: number): void => {
  expect(actual).toBeDefined();
  expect(Math.abs((actual ?? Number.NaN) - expectedMm)).toBeLessThan(1e-9);
};

const createStoreWithWall = () => {
  const store = createAppStore();
  const wallId = store.dispatch(placeWall(WALL_PARAMS));
  return { store, wallId };
};

describe('T6 acceptance sentence 4 — collision probe', () => {
  it('a group over pre-existing individual bars flags EXACTLY the clashing pairs, and placement is NOT blocked', () => {
    const { store, wallId } = createStoreWithWall();
    // barA coincides with the group bar at z = 660 (distance 0); barB is
    // 8 mm from it (clash, exact); barC is 40 mm clear of the nearest group
    // bar (control — never reported). barA and barB ALSO clash with each
    // other (8 mm) — that pair touches no placed bar and must NOT appear.
    const barA = placeIndividual({ store, wallId, zMm: 660 });
    const barB = placeIndividual({ store, wallId, zMm: 668 });
    const barC = placeIndividual({ store, wallId, zMm: 1000 });

    const result = store.dispatch(placeBarGroup(groupParams(wallId)));

    // Non-blocking: the group and all 18 bars landed.
    expect(result.barIds).toHaveLength(18);
    expect(store.getState().project.placementGroups[result.groupId]).toBeDefined();

    // The group bar at z = 660 is the 5th in layout order (z = 60 + 4·150).
    const groupBar660 = result.barIds[4];
    const clashes = clashMap(result.clashes);
    expect(clashes.size).toBe(2);
    expectDistance(clashes.get(pairKey(groupBar660, barA)), 0);
    expectDistance(clashes.get(pairKey(groupBar660, barB)), 8);
    // No false positives: the clean control appears in NO pair, and the
    // pre-existing barA↔barB clash (no group bar involved) is not reported.
    expect([...clashes.keys()].some((key) => key.includes(barC))).toBe(false);
    expect(clashes.has(pairKey(barA, barB))).toBe(false);
    expectSorted(result.clashes);
  });

  it('a second overlapping group flags every cross-group pair (18 × distance 8)', () => {
    const { store, wallId } = createStoreWithWall();
    const groupA = store.dispatch(placeBarGroup(groupParams(wallId)));
    expect(groupA.clashes).toEqual([]); // clean control: nothing to hit yet
    // Second group, same face, shifted 8 mm in z (edgeStart 68): every B bar
    // sits 8 mm from its A counterpart — 18 exact pairs.
    const groupB = store.dispatch(
      placeBarGroup({ ...groupParams(wallId), edgeDistanceStart: 68, edgeDistanceEnd: 60 }),
    );
    expect(groupB.barIds).toHaveLength(18);
    expect(groupB.clashes).toHaveLength(18);
    const setA = new Set(groupA.barIds);
    const setB = new Set(groupB.barIds);
    for (const clash of groupB.clashes) {
      expectDistance(clash.minDistanceMm, 8);
      // Every pair is one A bar × one B bar.
      const ids = [clash.barIdA, clash.barIdB];
      expect(ids.filter((id) => setA.has(id))).toHaveLength(1);
      expect(ids.filter((id) => setB.has(id))).toHaveLength(1);
    }
    // Each B bar clashes exactly once.
    expect(
      new Set(groupB.clashes.flatMap((c) => [c.barIdA, c.barIdB]).filter((id) => setB.has(id))).size,
    ).toBe(18);
    expectSorted(groupB.clashes);
  });

  it('a clean group reports no clashes (no false positives)', () => {
    const { store, wallId } = createStoreWithWall();
    const barC = placeIndividual({ store, wallId, zMm: 1000 });
    const result = store.dispatch(placeBarGroup(groupParams(wallId)));
    expect(result.clashes).toEqual([]);
    expect(Object.keys(store.getState().project.reinforcement)).toHaveLength(19);
    expect(store.getState().project.reinforcement[barC]).toBeDefined();
  });

  it('moveBar into a clash reports the exact pair; moving back out clears it', () => {
    const { store, wallId } = createStoreWithWall();
    const barA = placeIndividual({ store, wallId, zMm: 700 });
    const group = store.dispatch(placeBarGroup(groupParams(wallId)));
    expect(group.clashes).toEqual([]); // 700 is 40 mm clear of the grid

    const intoClash = store.dispatch(moveBar({ barId: barA, delta: { x: 0, y: 0, z: -40 } }));
    expect(intoClash.clashes).toHaveLength(1);
    expectDistance(clashMap(intoClash.clashes).get(pairKey(barA, group.barIds[4])), 0);

    const backOut = store.dispatch(moveBar({ barId: barA, delta: { x: 0, y: 0, z: 15 } }));
    expect(backOut.clashes).toEqual([]); // z = 675: 15 mm clear of the 660 bar
  });

  it('updatePlacementGroup (regenerate) reports clashes created by the new rule', () => {
    const { store, wallId } = createStoreWithWall();
    const barA = placeIndividual({ store, wallId, zMm: 700 });
    const group = store.dispatch(placeBarGroup(groupParams(wallId)));
    expect(group.clashes).toEqual([]);

    // edgeStart 60 → 100: bars shift to z = 100 + k·150 — k = 4 lands on 700.
    const updated = store.dispatch(
      updatePlacementGroup({ groupId: group.groupId, patch: { edgeDistanceStart: 100 } }),
    );
    expect(updated.clashes).toHaveLength(1);
    expectDistance(clashMap(updated.clashes).get(pairKey(barA, updated.barIds[4])), 0);
    // The report carries the REGENERATED ids (the old set is gone).
    expect(group.barIds).not.toContain(updated.barIds[4]);
    expect(store.getState().project.reinforcement[updated.barIds[4]]?.path[0]?.z).toBeCloseTo(700, 9);
  });

  it('movePlacementGroup reports clashes at the re-targeted region', () => {
    const { store, wallId } = createStoreWithWall();
    const barA = placeIndividual({ store, wallId, zMm: 700 });
    const group = store.dispatch(placeBarGroup(groupParams(wallId)));
    expect(group.clashes).toEqual([]);

    // +40 in z (the face v axis): bars shift to z = 100 + k·150 → 700 hits.
    const moved = store.dispatch(
      movePlacementGroup({ groupId: group.groupId, delta: { x: 0, y: 0, z: 40 } }),
    );
    expect(moved.region.vMin).toBe(-1360);
    expect(moved.clashes).toHaveLength(1);
    expectDistance(clashMap(moved.clashes).get(pairKey(barA, moved.barIds[4])), 0);
  });

  it('a perpendicular same-plane MESH (vertical group over horizontal group) flags every crossing at placement', () => {
    // The author's T6 review finding: bars in one cover plane in TWO
    // directions must be caught — 18 horizontal × 26 vertical crossings at
    // distance 0, all involving the placed (second) group's bars.
    const { store, wallId } = createStoreWithWall();
    const horizontal = store.dispatch(placeBarGroup(groupParams(wallId)));
    expect(horizontal.clashes).toEqual([]);
    const vertical = store.dispatch(placeBarGroup({ ...groupParams(wallId), orientation: 'vertical' }));
    expect(vertical.barIds).toHaveLength(26);
    expect(vertical.clashes).toHaveLength(18 * 26);
    const horizontalIds = new Set(horizontal.barIds);
    for (const clash of vertical.clashes) {
      expectDistance(clash.minDistanceMm, 0);
      // Every pair crosses one horizontal and one vertical bar.
      expect([clash.barIdA, clash.barIdB].filter((id) => horizontalIds.has(id))).toHaveLength(1);
    }
  });

  it('stays non-blocking through undo: ONE undo level removes the clashing placement', () => {
    const { store, wallId } = createStoreWithWall();
    placeIndividual({ store, wallId, zMm: 660 });
    const before = Object.keys(store.getState().project.reinforcement).length;
    const result = store.dispatch(placeBarGroup(groupParams(wallId)));
    expect(result.clashes).toHaveLength(1);
    store.dispatch(undo());
    // The clashing placement is fully undone (group + 18 bars) — nothing was
    // blocked, skipped, or auto-moved on the way in.
    expect(Object.keys(store.getState().project.reinforcement)).toHaveLength(before);
    expect(store.getState().project.placementGroups[result.groupId]).toBeUndefined();
  });
});
