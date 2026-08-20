// T4 — Move tool drag support (the React-free half): move-target picking
// (only a §B.5 WALL winner is a drag target — a bar winner resolves to null,
// so a bar grab starts NO drag, not even of its host wall; "highlighted =
// what will move"), plan-only drag delta, the transient offset store (§E),
// and the commit path — one moveElement per drag (host-follow, one undo
// level restores wall + bars exactly), single-shot auto-return to Select
// unless sticky (§B.6 rule 1/2), sub-tolerance delta = click (no-op),
// command rejection = status hint.
import type { Intersection } from 'three';
import { describe, expect, it, vi } from 'vitest';
import { placeBar, placeWall, undo } from '@/commands';
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

  it('resolves a WALL winner to itself — the only drag target in M1', () => {
    expect(resolveMoveTarget([wall('w1')])).toEqual({ entityType: 'wall', id: 'w1' });
    // A bar hidden in the wall BEHIND never wins (§B.5) — the front wall is the target.
    expect(resolveMoveTarget([wall('w1'), wall('w2'), bar('b1', 'w2')])).toEqual({
      entityType: 'wall',
      id: 'w1',
    });
  });

  it('resolves a BAR winner to null: bar moves are M3 scope — a bar grab starts NO drag', () => {
    // The bar beats its own host wall (§B.5), so hovering it highlights the
    // bar alone — and "highlighted = what will move" forbids moving the wall.
    expect(resolveMoveTarget([wall('w1'), bar('b1', 'w1')])).toBeNull();
    expect(resolveMoveTarget([bar('b1', 'w1')])).toBeNull(); // bar over the void
    expect(resolveMoveTarget([hit({ entityType: 'bar', entityId: 'b1' })])).toBeNull(); // no host tag
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

    commitElementDrag({ dispatch: store.dispatch, elementId: wallId, delta: DELTA, isSticky: false });

    const { elements, reinforcement } = store.getState().project;
    expect(elements[wallId].startPoint).toEqual({ x: 500, y: 300, z: 0 });
    expect(reinforcement[barId].path[0]).toEqual({ x: 500, y: 369, z: 500 });

    store.dispatch(undo());
    expect(store.getState().project).toBe(baseline); // one level, exact reference
  });

  it('auto-returns to Select after a completed move (single-shot, §B.6 rule 1)', () => {
    const { store, wallId } = createStoreWithWall();
    expect(store.getState().ui.activeTool).toBe('move');

    commitElementDrag({ dispatch: store.dispatch, elementId: wallId, delta: DELTA, isSticky: false });

    expect(store.getState().ui.activeTool).toBe('select');
  });

  it('keeps a sticky (double-click-locked) Move tool active (§B.6 rule 2)', () => {
    const { store, wallId } = createStoreWithWall(true);

    commitElementDrag({ dispatch: store.dispatch, elementId: wallId, delta: DELTA, isSticky: true });

    expect(store.getState().ui.activeTool).toBe('move');
    expect(store.getState().ui.sticky).toBe(true);
  });

  it('treats a sub-tolerance delta as a click: no move, no undo level, tool kept', () => {
    const { store, wallId } = createStoreWithWall();
    const baseline = store.getState().project;
    const pastLevels = store.getState().undo.past.length;

    commitElementDrag({
      dispatch: store.dispatch,
      elementId: wallId,
      delta: { x: 0, y: 0, z: 0 },
      isSticky: false,
    });

    expect(store.getState().project).toBe(baseline);
    expect(store.getState().undo.past.length).toBe(pastLevels);
    expect(store.getState().ui.activeTool).toBe('move');
  });

  it('surfaces a command rejection as a status hint and keeps the tool', () => {
    const { store } = createStoreWithWall();

    commitElementDrag({ dispatch: store.dispatch, elementId: 'no-such-wall', delta: DELTA, isSticky: false });

    expect(store.getState().ui.cursorHint).toContain('element not found');
    expect(store.getState().ui.activeTool).toBe('move');
  });
});
