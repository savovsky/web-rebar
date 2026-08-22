// T5 — §N moveBar command (M3 plan section 5, Q6-a) + the milestone
// acceptance sentence 3 headless: host-follow + detach. An individual bar
// translates; a GROUP member detaches first (leaves `group.bars`, the
// `placementGroupId` handle clears, mark kept) and then translates — ONE undo
// level restores membership AND position exactly (the T3 detachBars
// primitive, exact frozen references both ways). A regenerate after the
// detach refills the vacated slot (Q6-a: the stored rule is the group's
// truth) and leaves the detached bar where the user put it. Crosses the real
// WASM boundary for the group fixture (initWasmFromDisk).
import { beforeAll, describe, expect, it } from 'vitest';
import {
  moveBar,
  moveElement,
  placeBar,
  placeBarGroup,
  placeWall,
  redo,
  undo,
  updatePlacementGroup,
} from '@/commands';
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

const BAR_PATH = [
  { x: 0, y: 87, z: 500 },
  { x: 4000, y: 87, z: 500 },
];

/** Full posThickness face, horizontal Ø12 @ 150, 25 mm cover, 60 mm edges →
 *  18 bars (the T2-verified corpus). */
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

const createStoreWithWall = () => {
  const store = createAppStore();
  const wallId = store.dispatch(placeWall(WALL_PARAMS));
  return { store, wallId };
};

describe('moveBar — individual bar', () => {
  it('translates the path (bending places included) — ONE undo level restores the exact reference', () => {
    const { store, wallId } = createStoreWithWall();
    const barId = store.dispatch(placeBar({ hostElementId: wallId, diameter: 12, path: BAR_PATH }));
    const preMove = store.getState().project;
    const depthBefore = store.getState().undo.past.length;

    const result = store.dispatch(moveBar({ barId, delta: { x: 100, y: 300, z: 0 } }));

    expect(result).toEqual({ barId, detachedFromGroupId: undefined });
    const bar = store.getState().project.reinforcement[barId];
    expect(bar.path[0]).toEqual({ x: 100, y: 387, z: 500 });
    expect(bar.path[1]).toEqual({ x: 4100, y: 387, z: 500 });

    expect(store.getState().undo.past).toHaveLength(depthBefore + 1);
    store.dispatch(undo());
    expect(store.getState().project).toBe(preMove);
    store.dispatch(redo());
    expect(store.getState().project.reinforcement[barId].path[0]).toEqual({ x: 100, y: 387, z: 500 });
  });
});

describe('moveBar — group member (Q6-a detach-on-move)', () => {
  it('detaches first, then translates: leaves group.bars, clears the handle, keeps the mark — ONE undo level restores membership + position exactly', () => {
    const { store, wallId } = createStoreWithWall();
    const { groupId, barIds } = store.dispatch(placeBarGroup(groupParams(wallId)));
    const barId = barIds[3];
    const preMove = store.getState().project;
    const depthBefore = store.getState().undo.past.length;

    const result = store.dispatch(moveBar({ barId, delta: { x: 0, y: 300, z: 0 } }));
    const postMove = store.getState().project;

    expect(result).toEqual({ barId, detachedFromGroupId: groupId });
    // Detached: out of the membership list, handle cleared, mark kept.
    const group = postMove.placementGroups[groupId];
    expect(group.bars).toHaveLength(EXPECTED_BAR_COUNT - 1);
    expect(group.bars).not.toContain(barId);
    const bar = postMove.reinforcement[barId];
    expect(bar.placementGroupId).toBeUndefined();
    expect(bar.barMark).toBe(1); // the shared mark survives the detach
    // Translated: every path point shifted by the delta.
    bar.path.forEach((point, index) => {
      expect(point).toEqual({
        x: preMove.reinforcement[barId].path[index].x,
        y: preMove.reinforcement[barId].path[index].y + 300,
        z: preMove.reinforcement[barId].path[index].z,
      });
    });

    // ONE undo level restores membership AND position exactly (frozen ref).
    expect(store.getState().undo.past).toHaveLength(depthBefore + 1);
    store.dispatch(undo());
    expect(store.getState().project).toBe(preMove);
    expect(store.getState().project.placementGroups[groupId].bars).toContain(barId);
    expect(store.getState().project.reinforcement[barId].placementGroupId).toBe(groupId);
    store.dispatch(redo());
    expect(store.getState().project).toBe(postMove);
  });

  it('regenerate refills the vacated slot; the detached bar stays independent at its moved position', () => {
    const { store, wallId } = createStoreWithWall();
    const { groupId, barIds } = store.dispatch(placeBarGroup(groupParams(wallId)));
    const barId = barIds[0];
    store.dispatch(moveBar({ barId, delta: { x: 0, y: 300, z: 0 } }));
    const detachedPath = store.getState().project.reinforcement[barId].path;

    // Same-rule regenerate (an empty patch): the stored rule is the truth —
    // the group rebuilds its FULL layout (the vacated slot refills).
    const { barIds: refilled } = store.dispatch(updatePlacementGroup({ groupId, patch: {} }));
    const project = store.getState().project;

    expect(refilled).toHaveLength(EXPECTED_BAR_COUNT);
    expect(refilled).not.toContain(barId); // all freshly generated
    expect(project.placementGroups[groupId].bars).toEqual(refilled);
    // The detached bar is untouched: same id, same path, still group-less.
    const detached = project.reinforcement[barId];
    expect(detached.path).toEqual(detachedPath);
    expect(detached.placementGroupId).toBeUndefined();
    expect(detached.barMark).toBe(1);
  });
});

describe('moveBar — host-follow + detach (milestone acceptance sentence 3)', () => {
  it('moveElement carries the group bars (host-follow §E); a post-move regenerate is rule-exact against the moved face; detach + refill follow Q6-a', () => {
    const { store, wallId } = createStoreWithWall();
    const { groupId, barIds } = store.dispatch(placeBarGroup(groupParams(wallId)));
    const HOST_DELTA = { x: 0, y: 300, z: 0 };

    // (1) Host-follow: the group's bars translate with the host (§E revised).
    const preHostMove = store.getState().project;
    store.dispatch(moveElement({ elementId: wallId, delta: HOST_DELTA }));
    const preRegenerate = store.getState().project;
    const postHostMove = store.getState().project;
    for (const barId of barIds) {
      const before = preHostMove.reinforcement[barId].path;
      const after = postHostMove.reinforcement[barId].path;
      after.forEach((point, index) => {
        expect(point).toEqual({ x: before[index].x, y: before[index].y + 300, z: before[index].z });
      });
    }
    // The stored rule is host-local — untouched by the move (Q3-a).
    expect(postHostMove.placementGroups[groupId].region).toEqual(preHostMove.placementGroups[groupId].region);

    // (2) Post-move regenerate is rule-exact against the MOVED face (the Q3
    // host-local params make this free) — asserted against the T2 engine
    // output computed from the moved host.
    store.dispatch(updatePlacementGroup({ groupId, patch: { barSpacing: 250 } }));
    const postRegenerate = store.getState().project;
    const movedHost = postRegenerate.elements[wallId];
    const expected = generateBarGroupPaths({
      host: movedHost,
      faceKey: 'face:posThickness',
      region: { uMin: -2000, uMax: 2000, vMin: -1400, vMax: 1400 },
      coverMm: 25,
      diameterMm: 12,
      spacingMm: 250,
      edgeDistanceStartMm: 60,
      edgeDistanceEndMm: 60,
      orientation: 'horizontal',
    });
    const regeneratedIds = postRegenerate.placementGroups[groupId].bars;
    expect(regeneratedIds).toHaveLength(expected.length); // 11 at spacing 250
    regeneratedIds.forEach((barId, index) => {
      expect(postRegenerate.reinforcement[barId].path).toEqual(expected[index]);
      // Cover kept from the moved faces: y = 300 + 100 − 31.
      expect(postRegenerate.reinforcement[barId].path[0].y).toBeCloseTo(369);
    });

    // (3) Detach one regenerated bar, then refill via a same-rule regenerate.
    const detachedId = regeneratedIds[0];
    store.dispatch(moveBar({ barId: detachedId, delta: { x: 100, y: 0, z: 0 } }));
    const postDetach = store.getState().project;
    const preRefill = postDetach;
    expect(postDetach.placementGroups[groupId].bars).toHaveLength(expected.length - 1);
    expect(postDetach.reinforcement[detachedId].placementGroupId).toBeUndefined();
    const detachedPath = postDetach.reinforcement[detachedId].path;

    store.dispatch(updatePlacementGroup({ groupId, patch: { barSpacing: 250 } }));
    const postRefill = store.getState().project;
    expect(postRefill.placementGroups[groupId].bars).toHaveLength(expected.length);
    expect(postRefill.placementGroups[groupId].bars).not.toContain(detachedId);
    expect(postRefill.reinforcement[detachedId].path).toEqual(detachedPath);

    // (4) The whole sequence unwinds ONE undo level per command — exact
    // frozen references all the way back (placeWall, placeBarGroup,
    // moveElement, regenerate, moveBar, regenerate = 6 levels).
    expect(store.getState().undo.past).toHaveLength(6);
    store.dispatch(undo());
    expect(store.getState().project).toBe(preRefill);
    store.dispatch(undo());
    expect(store.getState().project).toBe(postRegenerate);
    store.dispatch(undo());
    expect(store.getState().project).toBe(preRegenerate);
    store.dispatch(undo());
    expect(store.getState().project).toBe(preHostMove);
    store.dispatch(redo());
    expect(store.getState().project).toBe(preRegenerate);
  });
});

describe('moveBar — rejection doorway (nothing recorded)', () => {
  it('rejects unknown bars and invalid deltas before any side effect', () => {
    const { store, wallId } = createStoreWithWall();
    const barId = store.dispatch(placeBar({ hostElementId: wallId, diameter: 12, path: BAR_PATH }));
    const before = store.getState().project;

    expectCommandError(
      () => store.dispatch(moveBar({ barId: 'ghost', delta: { x: 1, y: 0, z: 0 } })),
      'NOT_FOUND',
    );
    expectCommandError(
      () => store.dispatch(moveBar({ barId, delta: { x: Number.NaN, y: 0, z: 0 } })),
      'INVALID_PARAMS',
    );
    expectCommandError(
      () => store.dispatch(moveBar({ barId, delta: { x: 0, y: 0, z: 0 } })),
      'INVALID_PARAMS',
    );

    expect(store.getState().project).toBe(before); // not even a state reference changed
    expect(store.getState().undo.past).toHaveLength(2); // placeWall + placeBar only
  });
});
