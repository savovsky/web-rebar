// T4 — Move tool drag support (the React-free half): move-target picking
// (a §B.5 WALL winner drags the wall + its hosted bars; a BAR winner drags
// the bar alone — the M3 T5 bar branch, Q6; "highlighted = what will move"),
// plan-only drag delta, the transient offset store (§E), and the commit path
// — one moveElement (wall) or moveBar (bar) per drag, one undo level each,
// single-shot auto-return to Select unless sticky (§B.6 rule 1/2),
// sub-tolerance delta = click (no-op), command rejection = status hint.
import type { Intersection } from 'three';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { placeBar, placeBarGroup, placeWall, undo } from '@/commands';
import { initWasmFromDisk } from '@/engine/wasm-test-init';
import { createAppStore } from '@/stores';
import { setTool } from '@/stores/ui-slice';
import {
  clearElementDragOffset,
  commitElementDrag,
  getElementDragOffset,
  planDragDelta,
  resolveMoveTarget,
  setElementDragOffset,
  subscribeElementDragOffset,
} from './element-drag';

beforeAll(initWasmFromDisk); // the group-move commit test places a group (WASM)

/** Minimal R3F intersection stub — the resolvers read object.userData only. */
const hit = (userData: Record<string, string>): Intersection => ({ object: { userData } }) as Intersection;

const bar = (id: string, hostElementId: string) => hit({ entityType: 'bar', entityId: id, hostElementId });
const wall = (id: string) => hit({ entityType: 'wall', entityId: id });
const section = (id: string) => hit({ entityType: 'section', entityId: id });

describe('resolveMoveTarget', () => {
  it('returns null for empty ground, untagged hits, and section volumes', () => {
    expect(resolveMoveTarget([])).toBeNull();
    expect(resolveMoveTarget([hit({})])).toBeNull();
    expect(resolveMoveTarget([section('s1')])).toBeNull(); // sections reshape via their own drag
  });

  it('resolves a WALL winner to itself — the wall moves with its hosted bars (host-follow)', () => {
    expect(resolveMoveTarget([wall('w1')])).toEqual({ entityType: 'wall', id: 'w1' });
    // A bar hidden in the wall BEHIND never wins (§B.5) — the front wall is the target.
    expect(resolveMoveTarget([wall('w1'), wall('w2'), bar('b1', 'w2')])).toEqual({
      entityType: 'wall',
      id: 'w1',
    });
  });

  it('resolves a BAR winner to the bar (M3 T5): the bar alone drags — the host wall must NOT move', () => {
    // The bar beats its own host wall (§B.5) and is now the drag target —
    // "highlighted = what will move": the bar alone, never its host.
    expect(resolveMoveTarget([wall('w1'), bar('b1', 'w1')])).toEqual({ entityType: 'bar', id: 'b1' });
    expect(resolveMoveTarget([bar('b1', 'w1')])).toEqual({ entityType: 'bar', id: 'b1' }); // over the void
  });

  it('keeps the placement-group handle on a bar target (the Q6 detach path needs it)', () => {
    const groupBar = hit({ entityType: 'bar', entityId: 'b1', hostElementId: 'w1', placementGroupId: 'g1' });
    expect(resolveMoveTarget([wall('w1'), groupBar])).toEqual({
      entityType: 'bar',
      id: 'b1',
      placementGroupId: 'g1',
    });
  });

  it('SHIFT AT THE GRAB on a group member resolves to the WHOLE GROUP (author direction 2026-08-22)', () => {
    const groupBar = hit({ entityType: 'bar', entityId: 'b1', hostElementId: 'w1', placementGroupId: 'g1' });
    expect(resolveMoveTarget([wall('w1'), groupBar], true)).toEqual({ entityType: 'barGroup', id: 'g1' });
  });

  it('Shift on a group-LESS bar or a wall changes nothing', () => {
    expect(resolveMoveTarget([wall('w1'), bar('b1', 'w1')], true)).toEqual({ entityType: 'bar', id: 'b1' });
    expect(resolveMoveTarget([wall('w1')], true)).toEqual({ entityType: 'wall', id: 'w1' });
  });

  it('Shift on a section volume still resolves to null (not a move target)', () => {
    expect(resolveMoveTarget([section('s1')], true)).toBeNull();
  });
});

describe('planDragDelta', () => {
  it('subtracts in plan and forces z to 0 (the Move tool drags in plan)', () => {
    expect(
      planDragDelta({
        startGround: { x: 100, y: 200, z: 0 },
        currentGround: { x: 450, y: 150, z: 0 },
      }),
    ).toEqual({ x: 350, y: -50, z: 0 });
  });
});

describe('element drag offset store (transient, §E)', () => {
  it('publishes set/clear to subscribers; clearing an empty store is silent', () => {
    const listener = vi.fn();
    const unsubscribe = subscribeElementDragOffset(listener);
    clearElementDragOffset(); // already null — no notification
    expect(listener).not.toHaveBeenCalled();

    const offset = { elementId: 'w1', delta: { x: 100, y: 0, z: 0 } };
    setElementDragOffset(offset);
    expect(getElementDragOffset()).toBe(offset);
    expect(listener).toHaveBeenCalledTimes(1);

    clearElementDragOffset();
    expect(getElementDragOffset()).toBeNull();
    expect(listener).toHaveBeenCalledTimes(2);
    unsubscribe();
  });
});

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

/** Wall with one hosted bar, Move tool active (non-sticky unless asked). */
const createStoreWithWall = (isSticky = false) => {
  const store = createAppStore();
  const wallId = store.dispatch(placeWall(wallParams));
  const barId = store.dispatch(placeBar({ hostElementId: wallId, diameter: 12, path: barPath }));
  store.dispatch(setTool({ tool: 'move', sticky: isSticky }));
  return { store, wallId, barId };
};

const DELTA = { x: 500, y: 300, z: 0 };

describe('commitElementDrag', () => {
  it('moves the wall AND its hosted bars; one undo level restores both exactly', () => {
    const { store, wallId, barId } = createStoreWithWall();
    const baseline = store.getState().project;

    commitElementDrag({
      dispatch: store.dispatch,
      target: { entityType: 'wall', id: wallId },
      delta: DELTA,
      isSticky: false,
    });

    const { elements, reinforcement } = store.getState().project;
    expect(elements[wallId].startPoint).toEqual({ x: 500, y: 300, z: 0 });
    expect(reinforcement[barId].path[0]).toEqual({ x: 500, y: 369, z: 500 });

    store.dispatch(undo());
    expect(store.getState().project).toBe(baseline); // one level, exact reference
  });

  it('moves a BAR target alone via moveBar (M3 T5) — the host wall stays put', () => {
    const { store, wallId, barId } = createStoreWithWall();
    const baseline = store.getState().project;

    commitElementDrag({
      dispatch: store.dispatch,
      target: { entityType: 'bar', id: barId },
      delta: DELTA,
      isSticky: false,
    });

    const { elements, reinforcement } = store.getState().project;
    expect(reinforcement[barId].path[0]).toEqual({ x: 500, y: 369, z: 500 });
    expect(elements[wallId].startPoint).toEqual({ x: 0, y: 0, z: 0 }); // untouched
    expect(store.getState().ui.activeTool).toBe('select'); // auto-return applies to bars too

    store.dispatch(undo());
    expect(store.getState().project).toBe(baseline); // one level, exact reference
  });

  it('moves a GROUP target via movePlacementGroup (Shift-grab on a member) — region re-targeted, ONE undo level', () => {
    const store = createAppStore();
    const wallId = store.dispatch(placeWall(wallParams));
    const { groupId, barIds: oldBarIds } = store.dispatch(
      placeBarGroup({
        hostElementId: wallId,
        faceKey: 'face:posThickness',
        region: { uMin: -2000, uMax: 2000, vMin: -1400, vMax: 1400 },
        diameter: 12,
        barSpacing: 150,
        edgeDistanceStart: 60,
        edgeDistanceEnd: 60,
        orientation: 'horizontal',
      }),
    );
    store.dispatch(setTool({ tool: 'move' }));
    const baseline = store.getState().project;
    const depthBefore = store.getState().undo.past.length;
    const oldRegion = baseline.placementGroups[groupId].region;

    commitElementDrag({
      dispatch: store.dispatch,
      target: { entityType: 'barGroup', id: groupId },
      delta: { x: 500, y: 0, z: 0 }, // posThickness u axis = −X (u = cross(+Z, normal))
      isSticky: false,
    });

    const project = store.getState().project;
    const group = project.placementGroups[groupId];
    expect(group.region.uMin).toBeCloseTo(oldRegion.uMin - 500);
    expect(group.region.uMax).toBeCloseTo(oldRegion.uMax - 500);
    expect(group.region.vMin).toBeCloseTo(oldRegion.vMin);
    expect(group.region.vMax).toBeCloseTo(oldRegion.vMax);
    // Regenerated: new ids, shifted bars — the old set is gone. The in-face
    // run end moved exactly +500 (the past-face-edge end clamps at cover,
    // the T2 semantics).
    for (const oldId of oldBarIds) expect(project.reinforcement[oldId]).toBeUndefined();
    expect(project.reinforcement[group.bars[0]].path[1].x).toBeCloseTo(
      baseline.reinforcement[oldBarIds[0]].path[1].x + 500,
    );
    expect(project.reinforcement[group.bars[0]].path[0].x).toBeCloseTo(
      baseline.reinforcement[oldBarIds[0]].path[0].x,
    );
    expect(store.getState().undo.past).toHaveLength(depthBefore + 1); // ONE level
    expect(store.getState().ui.activeTool).toBe('select');

    store.dispatch(undo());
    expect(store.getState().project).toBe(baseline); // exact frozen reference
  });

  it('auto-returns to Select after a completed move (single-shot, §B.6 rule 1)', () => {
    const { store, wallId } = createStoreWithWall();
    expect(store.getState().ui.activeTool).toBe('move');

    commitElementDrag({
      dispatch: store.dispatch,
      target: { entityType: 'wall', id: wallId },
      delta: DELTA,
      isSticky: false,
    });

    expect(store.getState().ui.activeTool).toBe('select');
  });

  it('keeps a sticky (double-click-locked) Move tool active (§B.6 rule 2)', () => {
    const { store, wallId } = createStoreWithWall(true);

    commitElementDrag({
      dispatch: store.dispatch,
      target: { entityType: 'wall', id: wallId },
      delta: DELTA,
      isSticky: true,
    });

    expect(store.getState().ui.activeTool).toBe('move');
    expect(store.getState().ui.sticky).toBe(true);
  });

  it('treats a sub-tolerance delta as a click: no move, no undo level, tool kept', () => {
    const { store, wallId } = createStoreWithWall();
    const baseline = store.getState().project;
    const pastLevels = store.getState().undo.past.length;

    commitElementDrag({
      dispatch: store.dispatch,
      target: { entityType: 'wall', id: wallId },
      delta: { x: 0, y: 0, z: 0 },
      isSticky: false,
    });

    expect(store.getState().project).toBe(baseline);
    expect(store.getState().undo.past.length).toBe(pastLevels);
    expect(store.getState().ui.activeTool).toBe('move');
  });

  it('surfaces a command rejection as a status hint and keeps the tool', () => {
    const { store, barId } = createStoreWithWall();

    commitElementDrag({
      dispatch: store.dispatch,
      target: { entityType: 'wall', id: 'no-such-wall' },
      delta: DELTA,
      isSticky: false,
    });
    expect(store.getState().ui.cursorHint).toContain('element not found');
    expect(store.getState().ui.activeTool).toBe('move');

    commitElementDrag({
      dispatch: store.dispatch,
      target: { entityType: 'bar', id: 'no-such-bar' },
      delta: DELTA,
      isSticky: false,
    });
    expect(store.getState().ui.cursorHint).toContain('bar not found');
    expect(store.getState().ui.activeTool).toBe('move');
    expect(store.getState().project.reinforcement[barId]).toBeDefined(); // nothing moved
  });
});
