import { describe, expect, it } from 'vitest';
import {
  createSection,
  deleteSelection,
  placeBar,
  placeWall,
  redo,
  setActiveSection,
  undo,
} from '@/commands';
import { createAppStore } from '@/stores';
import { setSelection } from '@/stores/ui-slice';

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

const sectionParams = (wallId: string) => ({
  name: 'S-1',
  lineStart: { x: 2000, y: 0, z: -500 },
  lineEnd: { x: 2000, y: 0, z: 500 },
  depthPoint: { x: 4500, y: 0, z: 0 },
  targetElementIds: [wallId],
});

describe('deleteSelection', () => {
  it('deletes the selected element with its hosted bars — one undo level restores all', () => {
    const store = createAppStore();
    const wallId = store.dispatch(placeWall(wallParams));
    store.dispatch(placeBar({ hostElementId: wallId, diameter: 16, path: barPath }));
    store.dispatch(placeBar({ hostElementId: wallId, diameter: 10, path: barPath }));
    store.dispatch(setSelection({ elementIds: [wallId], barIds: [] }));
    const preDelete = store.getState().project;

    store.dispatch(deleteSelection());
    expect(Object.keys(store.getState().project.elements)).toHaveLength(0);
    expect(Object.keys(store.getState().project.reinforcement)).toHaveLength(0);
    expect(store.getState().ui.selection).toEqual({ elementIds: [], barIds: [] });

    store.dispatch(undo());
    expect(store.getState().project).toBe(preDelete); // exact frozen reference, one step
    store.dispatch(redo());
    expect(Object.keys(store.getState().project.elements)).toHaveLength(0);
  });

  it('deletes the selected bars and keeps their host element', () => {
    const store = createAppStore();
    const wallId = store.dispatch(placeWall(wallParams));
    const barId = store.dispatch(placeBar({ hostElementId: wallId, diameter: 12, path: barPath }));
    store.dispatch(setSelection({ elementIds: [], barIds: [barId] }));

    store.dispatch(deleteSelection());

    const state = store.getState();
    expect(state.project.elements[wallId]).toBeDefined();
    expect(Object.keys(state.project.reinforcement)).toHaveLength(0);
    expect(state.ui.selection).toEqual({ elementIds: [], barIds: [] });
  });

  it('handles a mixed selection (element + bar of another host) as ONE undo level', () => {
    const store = createAppStore();
    const wallId = store.dispatch(placeWall(wallParams));
    const otherWallId = store.dispatch(placeWall({ ...wallParams, baseElevation: 3000 }));
    const otherBarId = store.dispatch(placeBar({ hostElementId: otherWallId, diameter: 12, path: barPath }));
    store.dispatch(setSelection({ elementIds: [wallId], barIds: [otherBarId] }));
    const preDelete = store.getState().project;
    const undoDepthBefore = store.getState().undo.past.length;

    store.dispatch(deleteSelection());

    const state = store.getState();
    expect(state.project.elements[wallId]).toBeUndefined();
    expect(state.project.reinforcement[otherBarId]).toBeUndefined();
    expect(state.project.elements[otherWallId]).toBeDefined(); // the other host survives
    expect(state.undo.past.length).toBe(undoDepthBefore + 1); // composite command = one level

    store.dispatch(undo());
    expect(store.getState().project).toBe(preDelete);
  });

  it('deletes the ACTIVE section when nothing is explicitly selected (and closes the 2D panel)', () => {
    const store = createAppStore();
    const wallId = store.dispatch(placeWall(wallParams));
    const sectionId = store.dispatch(createSection(sectionParams(wallId)));
    store.dispatch(setActiveSection({ sectionId }));

    store.dispatch(deleteSelection());

    const state = store.getState();
    expect(state.project.sections[sectionId]).toBeUndefined();
    expect(state.ui.activeSectionId).toBeNull();
    expect(state.project.elements[wallId]).toBeDefined(); // sections are queries, not geometry
  });

  it('prefers the explicit selection over the active section', () => {
    const store = createAppStore();
    const wallId = store.dispatch(placeWall(wallParams));
    const sectionId = store.dispatch(createSection(sectionParams(wallId)));
    store.dispatch(setActiveSection({ sectionId }));
    store.dispatch(setSelection({ elementIds: [wallId], barIds: [] }));

    store.dispatch(deleteSelection());

    const state = store.getState();
    expect(state.project.elements[wallId]).toBeUndefined();
    expect(state.project.sections[sectionId]).toBeDefined(); // section survives — it was not selected
    expect(state.ui.activeSectionId).toBe(sectionId);
  });

  it('no-ops with a status hint and no undo level when there is nothing to delete', () => {
    const store = createAppStore();
    store.dispatch(placeWall(wallParams)); // something exists, but nothing is selected
    const undoDepthBefore = store.getState().undo.past.length;

    store.dispatch(deleteSelection());

    const state = store.getState();
    expect(state.ui.cursorHint).toBe('Nothing to delete');
    expect(state.undo.past.length).toBe(undoDepthBefore);
    expect(Object.keys(state.project.elements)).toHaveLength(1);
  });

  it('skips dangling selection ids (selection is not restored on undo, §E) and hints instead', () => {
    const store = createAppStore();
    const wallId = store.dispatch(placeWall(wallParams));
    store.dispatch(setSelection({ elementIds: [wallId], barIds: [] }));
    store.dispatch(undo()); // wall gone; the selection still references it
    expect(store.getState().project.elements[wallId]).toBeUndefined();

    store.dispatch(deleteSelection());

    expect(store.getState().ui.cursorHint).toBe('Nothing to delete');
  });
});
