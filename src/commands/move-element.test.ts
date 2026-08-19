// T2 — moveElement (§E revised 2026-08-09 host-follow): the wall axis and
// every hosted bar path translate by the same delta in ONE command, so one
// undo level restores wall + bars exactly (exact frozen reference, Q2-a/Q4-a).
// Section reactivity after a move is proven in m1-reactivity.test.ts.
import { describe, expect, it } from 'vitest';
import { moveElement, placeBar, placeWall, redo, undo } from '@/commands';
import { createAppStore } from '@/stores';
import { expectCommandError } from './test-utils';

const wallParams = {
  startPoint: { x: 0, y: 0, z: 0 },
  endPoint: { x: 4000, y: 0, z: 0 },
  thickness: 200,
  height: 2800,
};

const barPath = [
  { x: 0, y: 69, z: 500 },
  { x: 4000, y: 69, z: 500 },
];

const DELTA = { x: 500, y: 300, z: 0 };

/** Wall with two hosted bars (one with a bending place). */
const createPopulatedStore = () => {
  const store = createAppStore();
  const wallId = store.dispatch(placeWall(wallParams));
  const barId1 = store.dispatch(placeBar({ hostElementId: wallId, diameter: 12, path: barPath }));
  const barId2 = store.dispatch(
    placeBar({
      hostElementId: wallId,
      diameter: 16,
      path: [
        { x: 0, y: -69, z: 400 },
        { x: 2000, y: -69, z: 400 },
        { x: 2000, y: -69, z: 1400 },
      ],
    }),
  );
  return { store, wallId, barId1, barId2 };
};

describe('moveElement', () => {
  it('translates the wall axis and every hosted bar path by the delta (host-follow)', () => {
    const { store, wallId, barId1, barId2 } = createPopulatedStore();

    store.dispatch(moveElement({ elementId: wallId, delta: DELTA }));

    const wall = store.getState().project.elements[wallId];
    expect(wall.startPoint).toEqual({ x: 500, y: 300, z: 0 });
    expect(wall.endPoint).toEqual({ x: 4500, y: 300, z: 0 });
    // Cross-section params are untouched.
    expect(wall.thickness).toBe(200);
    expect(wall.height).toBe(2800);
    expect(wall.baseElevation).toBe(0);

    const { reinforcement } = store.getState().project;
    expect(reinforcement[barId1].path).toEqual([
      { x: 500, y: 369, z: 500 },
      { x: 4500, y: 369, z: 500 },
    ]);
    // Bending places translate too — one bar stays one position.
    expect(reinforcement[barId2].path).toEqual([
      { x: 500, y: 231, z: 400 },
      { x: 2500, y: 231, z: 400 },
      { x: 2500, y: 231, z: 1400 },
    ]);
    // Host-follow does not rewrite design intent.
    expect(reinforcement[barId1].hostElementId).toBe(wallId);
    expect(reinforcement[barId1].coverDistance).toBe(25);
  });

  it('leaves elements and bars of other hosts untouched', () => {
    const { store, wallId } = createPopulatedStore();
    const otherWallId = store.dispatch(placeWall({ ...wallParams, baseElevation: 3000 }));
    const otherBarId = store.dispatch(placeBar({ hostElementId: otherWallId, diameter: 12, path: barPath }));

    store.dispatch(moveElement({ elementId: wallId, delta: DELTA }));

    const state = store.getState().project;
    expect(state.elements[otherWallId].startPoint).toEqual({ x: 0, y: 0, z: 0 });
    expect(state.reinforcement[otherBarId].path).toEqual(barPath);
  });

  it('is ONE undo level: undo restores wall + hosted bars exactly, redo re-applies', () => {
    const { store, wallId, barId1, barId2 } = createPopulatedStore();
    const preMove = store.getState().project;
    const depthBefore = store.getState().undo.past.length;

    store.dispatch(moveElement({ elementId: wallId, delta: DELTA }));
    // One command = one undo level, despite the 3-action follow (Q4-a).
    expect(store.getState().undo.past).toHaveLength(depthBefore + 1);
    expect(store.getState().project.elements[wallId].startPoint.x).toBe(500);

    store.dispatch(undo());
    expect(store.getState().project).toBe(preMove); // exact frozen reference (Q2-a)
    expect(store.getState().project.reinforcement[barId1].path[0].y).toBe(69);
    expect(store.getState().project.reinforcement[barId2].path).toHaveLength(3);

    store.dispatch(redo());
    expect(store.getState().project.elements[wallId].startPoint).toEqual({ x: 500, y: 300, z: 0 });
    expect(store.getState().project.reinforcement[barId1].path[0].y).toBe(369);
  });

  it('rejects an unknown element id', () => {
    const store = createAppStore();
    expectCommandError(() => store.dispatch(moveElement({ elementId: 'ghost', delta: DELTA })), 'NOT_FOUND');
  });

  it('rejects a non-finite delta', () => {
    const { store, wallId } = createPopulatedStore();
    for (const delta of [
      { x: Number.NaN, y: 0, z: 0 },
      { x: 0, y: Number.POSITIVE_INFINITY, z: 0 },
      { x: 0, y: 0, z: Number.NaN },
    ]) {
      expectCommandError(() => store.dispatch(moveElement({ elementId: wallId, delta })), 'INVALID_PARAMS');
    }
    // The rejected commands recorded nothing and moved nothing.
    expect(store.getState().project.elements[wallId].startPoint).toEqual({ x: 0, y: 0, z: 0 });
    expect(store.getState().undo.past).toHaveLength(3); // placeWall + 2 placeBar only
  });

  it('rejects a zero delta (a no-op move must not pollute the action log or history)', () => {
    const { store, wallId } = createPopulatedStore();
    expectCommandError(
      () => store.dispatch(moveElement({ elementId: wallId, delta: { x: 0, y: 0, z: 0 } })),
      'INVALID_PARAMS',
    );
    expect(store.getState().undo.past).toHaveLength(3);
  });
});
