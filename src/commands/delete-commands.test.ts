import { describe, expect, it } from 'vitest';
import {
  createSection,
  deleteBar,
  deleteElement,
  deleteSection,
  placeBar,
  placeWall,
  redo,
  setActiveSection,
  undo,
} from '@/commands';
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

describe('deleteSection', () => {
  /** Wall + two sections, the first one shown in the 2D panel. */
  const createStoreWithSections = () => {
    const store = createAppStore();
    const wallId = store.dispatch(placeWall(wallParams));
    const sectionId1 = store.dispatch(
      createSection({
        name: 'S-1',
        lineStart: { x: 2000, y: 0, z: -500 },
        lineEnd: { x: 2000, y: 0, z: 500 },
        depthPoint: { x: 4500, y: 0, z: 0 },
        targetElementIds: [wallId],
      }),
    );
    const sectionId2 = store.dispatch(
      createSection({
        name: 'S-2',
        lineStart: { x: 3000, y: 0, z: -500 },
        lineEnd: { x: 3000, y: 0, z: 500 },
        depthPoint: { x: 5500, y: 0, z: 0 },
        targetElementIds: [wallId],
      }),
    );
    store.dispatch(setActiveSection({ sectionId: sectionId1 }));
    return { store, wallId, sectionId1, sectionId2 };
  };

  it('removes the section and closes the 2D panel when it showed the section', () => {
    const { store, wallId, sectionId1 } = createStoreWithSections();
    store.dispatch(deleteSection({ sectionId: sectionId1 }));

    const state = store.getState();
    expect(state.project.sections[sectionId1]).toBeUndefined();
    expect(Object.keys(state.project.sections)).toHaveLength(1);
    expect(state.ui.activeSectionId).toBeNull();
    // Elements are untouched — a section is a stored query, not geometry (§G).
    expect(state.project.elements[wallId]).toBeDefined();
  });

  it('leaves the 2D panel alone when it shows another section', () => {
    const { store, sectionId1, sectionId2 } = createStoreWithSections();
    store.dispatch(deleteSection({ sectionId: sectionId2 }));

    expect(store.getState().project.sections[sectionId2]).toBeUndefined();
    expect(store.getState().ui.activeSectionId).toBe(sectionId1);
  });

  it('is undo/redo-able: the section definition restores exactly (project state only — the panel stays closed)', () => {
    const { store, sectionId1 } = createStoreWithSections();
    const preDelete = store.getState().project;

    store.dispatch(deleteSection({ sectionId: sectionId1 }));
    store.dispatch(undo());
    expect(store.getState().project).toBe(preDelete); // exact frozen reference
    expect(store.getState().ui.activeSectionId).toBeNull(); // §E: undo covers project state only

    store.dispatch(redo());
    expect(store.getState().project.sections[sectionId1]).toBeUndefined();
  });

  it('rejects an unknown section id', () => {
    const store = createAppStore();
    expectCommandError(() => store.dispatch(deleteSection({ sectionId: 'ghost' })), 'NOT_FOUND');
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
