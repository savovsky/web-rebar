import { describe, expect, it } from 'vitest';
import { extendBar, placeBar, placeWall } from '@/commands';
import { createAppStore } from '@/stores';
import { expectCommandError } from './test-utils';

const createStoreWithBar = () => {
  const store = createAppStore();
  const wallId = store.dispatch(
    placeWall({
      startPoint: { x: 0, y: 0, z: 0 },
      endPoint: { x: 4000, y: 0, z: 0 },
      thickness: 200,
      height: 2800,
    }),
  );
  const barId = store.dispatch(
    placeBar({
      hostElementId: wallId,
      diameter: 12,
      path: [
        { x: 0, y: 69, z: 500 },
        { x: 4000, y: 69, z: 500 },
      ],
    }),
  );
  return { store, barId };
};

describe('extendBar', () => {
  it('appends a segment to the same bar — the bar stays one position', () => {
    const { store, barId } = createStoreWithBar();
    const returnedId = store.dispatch(extendBar({ barId, point: { x: 4000, y: 69, z: 2000 } }));
    store.dispatch(extendBar({ barId, point: { x: 500, y: 69, z: 2000 } }));

    const state = store.getState().project;
    expect(returnedId).toBe(barId);
    expect(Object.keys(state.reinforcement)).toHaveLength(1);
    expect(state.reinforcement[barId].path).toHaveLength(4);
    expect(state.reinforcement[barId].path[3]).toEqual({ x: 500, y: 69, z: 2000 });
  });

  it('rejects an unknown bar', () => {
    const { store } = createStoreWithBar();
    expectCommandError(
      () => store.dispatch(extendBar({ barId: 'no-such-bar', point: { x: 0, y: 0, z: 0 } })),
      'NOT_FOUND',
    );
  });

  it('rejects a zero-length segment', () => {
    const { store, barId } = createStoreWithBar();
    expectCommandError(
      () => store.dispatch(extendBar({ barId, point: { x: 4000, y: 69, z: 500 } })),
      'INVALID_PARAMS',
    );
    expect(store.getState().project.reinforcement[barId].path).toHaveLength(2);
  });
});
