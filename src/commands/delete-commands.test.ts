import { describe, expect, it } from 'vitest';
import { deleteBar, deleteElement, placeBar, placeWall } from '@/commands';
import { createAppStore } from '@/stores';
import { setSelection } from '@/stores/ui-slice';
import { expectCommandError } from './test-utils';

const wallParams = {
  startPoint: { x: 0, y: 0, z: 0 },
  endPoint: { x: 4000, y: 0, z: 0 },
  thickness: 200,
  height: 2800,
};

const barPath = [
  { x: 0, y: 500, z: 87 },
  { x: 4000, y: 500, z: 87 },
];

/** Wall with two hosted bars, both entities selected. */
const createPopulatedStore = () => {
  const store = createAppStore();
  const wallId = store.dispatch(placeWall(wallParams));
  const barId1 = store.dispatch(placeBar({ hostElementId: wallId, diameter: 16, path: barPath }));
  const barId2 = store.dispatch(placeBar({ hostElementId: wallId, diameter: 10, path: barPath }));
  store.dispatch(setSelection({ elementIds: [wallId], barIds: [barId1, barId2] }));
  return { store, wallId, barId1, barId2 };
};

describe('deleteElement', () => {
  it('removes the element, cascades hosted bars, and prunes the selection', () => {
    const { store, wallId } = createPopulatedStore();
    store.dispatch(deleteElement({ id: wallId }));

    const state = store.getState();
    expect(Object.keys(state.project.elements)).toHaveLength(0);
    expect(Object.keys(state.project.reinforcement)).toHaveLength(0);
    expect(state.ui.selection).toEqual({ elementIds: [], barIds: [] });
  });

  it('leaves bars of other elements untouched', () => {
    const { store, wallId, barId1 } = createPopulatedStore();
    const otherWallId = store.dispatch(placeWall({ ...wallParams, baseElevation: 3000 }));
    const otherBarId = store.dispatch(placeBar({ hostElementId: otherWallId, diameter: 12, path: barPath }));

    store.dispatch(deleteElement({ id: wallId }));

    const state = store.getState();
    expect(state.project.elements[otherWallId]).toBeDefined();
    expect(Object.keys(state.project.reinforcement)).toEqual([otherBarId]);
    expect(barId1).not.toBe(otherBarId);
  });

  it('rejects an unknown element id', () => {
    const store = createAppStore();
    expectCommandError(() => store.dispatch(deleteElement({ id: 'ghost' })), 'NOT_FOUND');
  });
});

describe('deleteBar', () => {
  it('removes the bar, keeps the host element, and prunes the selection', () => {
    const { store, wallId, barId1, barId2 } = createPopulatedStore();
    store.dispatch(deleteBar({ id: barId1 }));

    const state = store.getState();
    expect(state.project.elements[wallId]).toBeDefined();
    expect(Object.keys(state.project.reinforcement)).toEqual([barId2]);
    expect(state.ui.selection).toEqual({ elementIds: [wallId], barIds: [barId2] });
  });

  it('rejects an unknown bar id', () => {
    const store = createAppStore();
    expectCommandError(() => store.dispatch(deleteBar({ id: 'ghost' })), 'NOT_FOUND');
  });
});
