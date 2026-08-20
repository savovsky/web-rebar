// T1 — undo core (§E; M1 Q1-a/Q2-a/Q4-a): every M0 command is undo/redo-able,
// the deleteElement cascade restores in ONE step, a new action clears future,
// the 30-level cap trims the oldest, and undo/redo are never themselves
// recorded. All headless — stores from createAppStore record automatically
// (Q1-a), which is also the MCP/scripting door (§N.2).
import { describe, expect, it } from 'vitest';
import {
  createSection,
  deleteBar,
  deleteElement,
  extendBar,
  placeBar,
  placeWall,
  redo,
  reshapeSection,
  setActiveSection,
  undo,
} from '@/commands';
import { createAppStore } from '@/stores';

const UNDO_CAP = 30;

const wallParams = {
  startPoint: { x: 0, y: 0, z: 0 },
  endPoint: { x: 4000, y: 0, z: 0 },
  thickness: 200,
  height: 2800,
};

const barPath = [
  { x: 0, y: 87, z: 500 },
  { x: 4000, y: 87, z: 500 },
];

const sectionParams = (wallId: string) => ({
  name: 'S-1',
  lineStart: { x: 2000, y: -500, z: 0 },
  lineEnd: { x: 2000, y: 500, z: 0 },
  depthPoint: { x: 4500, y: 0, z: 0 },
  targetElementIds: [wallId],
});

describe('undo core — every M0 command is undo/redo-able', () => {
  it('placeWall: undo removes the wall, redo restores the exact state reference', () => {
    const store = createAppStore();
    store.dispatch(placeWall(wallParams));
    const withWall = store.getState().project;
    expect(Object.keys(withWall.elements)).toHaveLength(1);

    store.dispatch(undo());
    expect(Object.keys(store.getState().project.elements)).toHaveLength(0);

    store.dispatch(redo());
    expect(store.getState().project).toBe(withWall);
  });

  it('placeBar + extendBar: one undo level per command (Q4-a) — bend points, then the bar, then the wall', () => {
    const store = createAppStore();
    const wallId = store.dispatch(placeWall(wallParams));
    const barId = store.dispatch(placeBar({ hostElementId: wallId, diameter: 12, path: barPath }));
    store.dispatch(extendBar({ barId, point: { x: 4000, y: 87, z: 1500 } }));
    store.dispatch(extendBar({ barId, point: { x: 0, y: 87, z: 1500 } }));
    expect(store.getState().project.reinforcement[barId].path).toHaveLength(4);

    store.dispatch(undo()); // last bend point
    expect(store.getState().project.reinforcement[barId].path).toHaveLength(3);
    store.dispatch(undo()); // previous bend point
    expect(store.getState().project.reinforcement[barId].path).toHaveLength(2);
    store.dispatch(undo()); // the bar itself
    expect(store.getState().project.reinforcement[barId]).toBeUndefined();
    store.dispatch(undo()); // the wall
    expect(Object.keys(store.getState().project.elements)).toHaveLength(0);

    store.dispatch(redo());
    store.dispatch(redo());
    store.dispatch(redo());
    store.dispatch(redo());
    expect(store.getState().project.reinforcement[barId].path).toHaveLength(4);
    expect(store.getState().project.elements[wallId]).toBeDefined();
  });

  it('deleteBar: undo restores the bar exactly, redo deletes it again', () => {
    const store = createAppStore();
    const wallId = store.dispatch(placeWall(wallParams));
    const barId = store.dispatch(placeBar({ hostElementId: wallId, diameter: 16, path: barPath }));
    const withBar = store.getState().project;

    store.dispatch(deleteBar({ id: barId }));
    expect(Object.keys(store.getState().project.reinforcement)).toHaveLength(0);

    store.dispatch(undo());
    expect(store.getState().project).toBe(withBar);

    store.dispatch(redo());
    expect(Object.keys(store.getState().project.reinforcement)).toHaveLength(0);
  });

  it('deleteElement: the cascade restores element + hosted bars in ONE step', () => {
    const store = createAppStore();
    const wallId = store.dispatch(placeWall(wallParams));
    store.dispatch(placeBar({ hostElementId: wallId, diameter: 16, path: barPath }));
    store.dispatch(placeBar({ hostElementId: wallId, diameter: 10, path: barPath }));
    const preDelete = store.getState().project;
    const depthBefore = store.getState().undo.past.length;

    store.dispatch(deleteElement({ id: wallId }));
    // One command = one undo level, despite the 3-action cascade (Q4-a).
    expect(store.getState().undo.past).toHaveLength(depthBefore + 1);
    expect(Object.keys(store.getState().project.elements)).toHaveLength(0);
    expect(Object.keys(store.getState().project.reinforcement)).toHaveLength(0);

    store.dispatch(undo());
    expect(store.getState().project).toBe(preDelete); // exact frozen reference (Q2-a)

    store.dispatch(redo());
    expect(Object.keys(store.getState().project.elements)).toHaveLength(0);
    expect(Object.keys(store.getState().project.reinforcement)).toHaveLength(0);
  });

  it('createSection + reshapeSection: undo restores prior geometry, redo re-applies', () => {
    const store = createAppStore();
    const wallId = store.dispatch(placeWall(wallParams));
    const sectionId = store.dispatch(createSection(sectionParams(wallId)));
    const created = store.getState().project.sections[sectionId];

    store.dispatch(
      reshapeSection({
        sectionId,
        lineStart: { x: 1000, y: -500, z: 0 },
        lineEnd: { x: 1000, y: 500, z: 0 },
        depthPoint: { x: 3500, y: 0, z: 0 },
      }),
    );
    expect(store.getState().project.sections[sectionId].lineStart.x).toBe(1000);

    store.dispatch(undo()); // undo the reshape
    expect(store.getState().project.sections[sectionId]).toBe(created);

    store.dispatch(redo());
    expect(store.getState().project.sections[sectionId].lineStart.x).toBe(1000);

    store.dispatch(undo());
    store.dispatch(undo()); // undo the creation
    expect(store.getState().project.sections[sectionId]).toBeUndefined();

    store.dispatch(redo());
    expect(store.getState().project.sections[sectionId]).toBeDefined();
  });

  it('setActiveSection records no undo level — undo covers project state only (§E)', () => {
    const store = createAppStore();
    const wallId = store.dispatch(placeWall(wallParams));
    const sectionId = store.dispatch(createSection(sectionParams(wallId)));
    const depthBefore = store.getState().undo.past.length;

    store.dispatch(setActiveSection({ sectionId }));
    expect(store.getState().undo.past).toHaveLength(depthBefore);

    // The next undo steps over the ui-only change and undoes createSection.
    store.dispatch(undo());
    expect(store.getState().project.sections[sectionId]).toBeUndefined();
    expect(store.getState().ui.activeSectionId).toBe(sectionId); // dangling id is harmless
  });
});

describe('undo core — history invariants', () => {
  it('gives sequential commands separate levels (no over-coalescing)', () => {
    const store = createAppStore();
    const wallA = store.dispatch(placeWall(wallParams));
    store.dispatch(placeWall({ ...wallParams, baseElevation: 3000 }));
    expect(store.getState().undo.past).toHaveLength(2);

    store.dispatch(undo());
    expect(Object.keys(store.getState().project.elements)).toEqual([wallA]);
  });

  it('clears the future stack on a new action', () => {
    const store = createAppStore();
    store.dispatch(placeWall(wallParams));
    store.dispatch(undo());
    expect(store.getState().undo.future).toHaveLength(1);

    const wallB = store.dispatch(placeWall(wallParams));
    expect(store.getState().undo.future).toHaveLength(0);

    store.dispatch(redo()); // no-op — history was forked
    expect(Object.keys(store.getState().project.elements)).toEqual([wallB]);
  });

  it('caps history at 30 levels and trims the oldest (§E)', () => {
    const store = createAppStore();
    const wallIds: string[] = [];
    for (let index = 0; index < UNDO_CAP + 1; index += 1) {
      wallIds.push(store.dispatch(placeWall(wallParams)));
    }
    expect(store.getState().undo.past).toHaveLength(UNDO_CAP);

    for (let step = 0; step < UNDO_CAP; step += 1) {
      store.dispatch(undo());
    }
    // The oldest level (the empty project) was trimmed — the first wall survives.
    expect(Object.keys(store.getState().project.elements)).toEqual([wallIds[0]]);
    expect(store.getState().undo.past).toHaveLength(0);
  });

  it('never records undo/redo themselves', () => {
    const store = createAppStore();
    store.dispatch(placeWall(wallParams));
    expect(store.getState().undo.past).toHaveLength(1);
    expect(store.getState().undo.future).toHaveLength(0);

    store.dispatch(undo());
    expect(store.getState().undo.past).toHaveLength(0);
    expect(store.getState().undo.future).toHaveLength(1);

    store.dispatch(redo());
    expect(store.getState().undo.past).toHaveLength(1);
    expect(store.getState().undo.future).toHaveLength(0);
  });

  it('guards empty stacks: no-op with a status hint, state untouched', () => {
    const store = createAppStore();
    const projectBefore = store.getState().project;

    store.dispatch(undo());
    expect(store.getState().project).toBe(projectBefore);
    expect(store.getState().ui.cursorHint).toBe('Nothing to undo');

    store.dispatch(redo());
    expect(store.getState().project).toBe(projectBefore);
    expect(store.getState().ui.cursorHint).toBe('Nothing to redo');
  });

  it('snapshots are frozen references with structural sharing (Q2-a)', () => {
    const store = createAppStore();
    const wallId = store.dispatch(placeWall(wallParams));
    store.dispatch(placeBar({ hostElementId: wallId, diameter: 12, path: barPath }));

    const { past } = store.getState().undo;
    const latest = past[past.length - 1];
    expect(Object.isFrozen(latest)).toBe(true);
    // Unchanged entities are shared between snapshot and live state, not copied.
    expect(latest.elements[wallId]).toBe(store.getState().project.elements[wallId]);
  });
});
