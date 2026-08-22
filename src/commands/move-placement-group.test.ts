// T5 — §N movePlacementGroup command (author direction 2026-08-22, mid-review:
// the Shift+hover pre-selection's move half — a Shift+drag from a group
// member moves the ENTIRE group). The group has no world position of its own
// (host-local region, Q3-a) → the move re-targets the REGION: the world
// delta projects onto the face frame (worldToFaceLocalDelta), the stored
// region shifts, and the nested updatePlacementGroup regenerates rule-exact
// (new ids; the group keeps id + barMark). Detached bars (Q6-a) stay behind.
// ONE undo level restores the pre-move region AND bars exactly. Crosses the
// real WASM boundary (initWasmFromDisk).
import { beforeAll, describe, expect, it } from 'vitest';
import { moveBar, movePlacementGroup, placeBarGroup, placeWall, redo, undo } from '@/commands';
import { generateBarGroupPaths } from '@/engine/placement-group';
import { initWasmFromDisk } from '@/engine/wasm-test-init';
import { createAppStore } from '@/stores';
import { expectCommandError } from './test-utils';

beforeAll(initWasmFromDisk);

/** The M0 acceptance wall: 4000 × 200 × 2800. */
const WALL_PARAMS = {
  startPoint: { x: 0, y: 0, z: 0 },
  endPoint: { x: 4000, y: 0, z: 0 },
  thickness: 200,
  height: 2800,
};

/** Full posThickness face (u ±2000, v ±1400), horizontal Ø12 @ 150 → 18 bars
 *  (the T2-verified corpus). posThickness: u = −X, v = +Z. */
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

const EXPECTED_BAR_COUNT = 18;

const createStoreWithGroup = () => {
  const store = createAppStore();
  const wallId = store.dispatch(placeWall(WALL_PARAMS));
  const { groupId, barIds } = store.dispatch(placeBarGroup(groupParams(wallId)));
  return { store, wallId, groupId, barIds };
};

describe('movePlacementGroup (author direction: the Shift pre-selection move half)', () => {
  it('shifts the region by the face-plane projection and regenerates rule-exactly — ONE undo level restores region + bars exactly', () => {
    const { store, wallId, groupId, barIds: oldBarIds } = createStoreWithGroup();
    const preMove = store.getState().project;
    const depthBefore = store.getState().undo.past.length;

    // Plan drag along the wall chord: du = −500 (u = −X), dv = 0 (v = ±Z).
    const result = store.dispatch(movePlacementGroup({ groupId, delta: { x: 500, y: 300, z: 0 } }));
    const postMove = store.getState().project;

    const SHIFTED_REGION = { uMin: -2500, uMax: 1500, vMin: -1400, vMax: 1400 };
    expect(result.groupId).toBe(groupId);
    expect(result.region).toEqual(SHIFTED_REGION);
    expect(result.barIds).toHaveLength(EXPECTED_BAR_COUNT);

    // The stored rule re-targeted; the group keeps id + mark.
    const group = postMove.placementGroups[groupId];
    expect(group.region).toEqual(SHIFTED_REGION);
    expect(group.barMark).toBe(1);
    expect(group.bars).toEqual(result.barIds);
    // Regenerate contract: new ids, the old set is gone.
    for (const oldId of oldBarIds) expect(postMove.reinforcement[oldId]).toBeUndefined();

    // Rule-exact against the T2 engine output for the shifted region.
    const expected = generateBarGroupPaths({
      host: postMove.elements[wallId],
      faceKey: 'face:posThickness',
      region: SHIFTED_REGION,
      coverMm: 25,
      diameterMm: 12,
      spacingMm: 150,
      edgeDistanceStartMm: 60,
      edgeDistanceEndMm: 60,
      orientation: 'horizontal',
    });
    expect(expected).toHaveLength(EXPECTED_BAR_COUNT);
    result.barIds.forEach((barId, index) => {
      const bar = postMove.reinforcement[barId];
      expect(bar.path).toEqual(expected[index]);
      expect(bar.placementGroupId).toBe(groupId);
      expect(bar.barMark).toBe(1);
    });
    // World sanity (T2 clamp semantics): the region's run edges land at
    // world x = 500 and 4500 — the end pushed PAST the face edge clamps at
    // cover (3975), the end inside the face moved exactly +500 (25 → 525).
    expect(postMove.reinforcement[result.barIds[0]].path[0].x).toBeCloseTo(3975);
    expect(postMove.reinforcement[result.barIds[0]].path[1].x).toBeCloseTo(525);

    // ONE undo level restores the pre-move region AND bars exactly; redo re-applies.
    expect(store.getState().undo.past).toHaveLength(depthBefore + 1);
    store.dispatch(undo());
    expect(store.getState().project).toBe(preMove);
    store.dispatch(redo());
    expect(store.getState().project).toBe(postMove);
  });

  it('an explicit z delta shifts along v too (only the TOOL is plan-locked — the command accepts any finite delta)', () => {
    const { store, groupId } = createStoreWithGroup();

    store.dispatch(movePlacementGroup({ groupId, delta: { x: 0, y: 300, z: 400 } }));

    const group = store.getState().project.placementGroups[groupId];
    expect(group.region).toEqual({ uMin: -2000, uMax: 2000, vMin: -1400 + 400, vMax: 1400 + 400 });
  });

  it('detached bars (Q6-a) stay where the user put them — the group moves without them', () => {
    const { store, groupId, barIds } = createStoreWithGroup();
    const detachedId = barIds[0];
    store.dispatch(moveBar({ barId: detachedId, delta: { x: 0, y: 300, z: 0 } }));
    const detachedPath = store.getState().project.reinforcement[detachedId].path;

    const { barIds: movedIds } = store.dispatch(
      movePlacementGroup({ groupId, delta: { x: 500, y: 0, z: 0 } }),
    );

    const project = store.getState().project;
    expect(movedIds).not.toContain(detachedId);
    expect(project.reinforcement[detachedId].path).toEqual(detachedPath); // unmoved
    expect(project.reinforcement[detachedId].placementGroupId).toBeUndefined();
    // The moved group's bars shifted +500 in world X (u = −X, du = −500; the
    // in-face run end moved 25 → 525, the past-edge end clamps at 3975).
    expect(project.reinforcement[movedIds[0]].path[1].x).toBeCloseTo(525);
  });
});

describe('movePlacementGroup — rejection doorway (nothing recorded)', () => {
  it('rejects unknown groups and hosts before any side effect', () => {
    const { store, groupId } = createStoreWithGroup();
    const before = store.getState().project;

    expectCommandError(
      () => store.dispatch(movePlacementGroup({ groupId: 'ghost', delta: { x: 500, y: 0, z: 0 } })),
      'NOT_FOUND',
    );
    expectCommandError(
      () => store.dispatch(movePlacementGroup({ groupId, delta: { x: Number.NaN, y: 0, z: 0 } })),
      'INVALID_PARAMS',
    );

    expect(store.getState().project).toBe(before);
    expect(store.getState().undo.past).toHaveLength(2); // placeWall + placeBarGroup only
  });

  it('rejects a delta with no face-plane component (a vertical side face accepts along-u plan deltas only)', () => {
    // posThickness: u = −X, v = +Z — a cross-chord plan delta projects to nothing.
    const { store, groupId } = createStoreWithGroup();
    const before = store.getState().project;

    expectCommandError(
      () => store.dispatch(movePlacementGroup({ groupId, delta: { x: 0, y: 300, z: 0 } })),
      'INVALID_PARAMS',
    );
    expectCommandError(
      () => store.dispatch(movePlacementGroup({ groupId, delta: { x: 0, y: 0, z: 0 } })),
      'INVALID_PARAMS',
    );

    expect(store.getState().project).toBe(before);
    expect(store.getState().undo.past).toHaveLength(2);
  });
});
