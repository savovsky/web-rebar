import type { Intersection } from 'three';
import { afterEach, describe, expect, it } from 'vitest';
import {
  clearHoverTarget,
  getHoverTarget,
  pickPointerWinner,
  setHoverFromPick,
  setHoverPinned,
  setHoverTarget,
  setShiftHeld,
} from './hover-target';

/** The transient module store persists across tests — reset after each. */
afterEach(() => {
  setHoverPinned(false);
  setShiftHeld(false);
  setHoverFromPick(null, false);
  setHoverTarget(null);
});

/** Minimal R3F intersection stub — pickPointerWinner reads object.userData only. */
const hit = (userData: Record<string, string>): Intersection => ({ object: { userData } }) as Intersection;

const bar = (id: string, hostElementId: string) => hit({ entityType: 'bar', entityId: id, hostElementId });
const wall = (id: string) => hit({ entityType: 'wall', entityId: id });
const section = (id: string) => hit({ entityType: 'section', entityId: id });

describe('pickPointerWinner', () => {
  it('returns null for empty or untagged hits (ground plane, sky)', () => {
    expect(pickPointerWinner([])).toBeNull();
    expect(pickPointerWinner([hit({})])).toBeNull();
    expect(pickPointerWinner([hit({ entityType: 'wall' })])).toBeNull(); // tag without id
  });

  it('picks the only hit entity (wall, section, or bar over the void)', () => {
    expect(pickPointerWinner([wall('w1')])).toEqual({ entityType: 'wall', id: 'w1' });
    expect(pickPointerWinner([section('s1')])).toEqual({ entityType: 'section', id: 's1' });
    expect(pickPointerWinner([bar('b1', 'w1')])).toEqual({ entityType: 'bar', id: 'b1' });
  });

  it('lets a bar beat the wall face in front of it when the wall hosts it (§B.5, §L.2)', () => {
    // Ray order: wall front face (nearer), then the bar inside the concrete.
    expect(pickPointerWinner([wall('w1'), bar('b1', 'w1')])).toEqual({ entityType: 'bar', id: 'b1' });
  });

  it('never lets a bar beat a wall that does NOT host it (hidden in a wall behind)', () => {
    expect(pickPointerWinner([wall('w1'), wall('w2'), bar('b1', 'w2')])).toEqual({
      entityType: 'wall',
      id: 'w1',
    });
  });

  it('lets bars and walls beat section volumes (clickable through the wireframe)', () => {
    expect(pickPointerWinner([section('s1'), wall('w1'), bar('b1', 'w1')])).toEqual({
      entityType: 'bar',
      id: 'b1',
    });
    expect(pickPointerWinner([section('s1'), wall('w1')])).toEqual({ entityType: 'wall', id: 'w1' });
  });

  it('picks the closest entity within a type', () => {
    expect(pickPointerWinner([bar('b1', 'w1'), bar('b2', 'w1'), wall('w1')])).toEqual({
      entityType: 'bar',
      id: 'b1',
    });
    expect(pickPointerWinner([wall('w1'), wall('w2')])).toEqual({ entityType: 'wall', id: 'w1' });
  });

  it('keeps the placement-group handle on a bar winner (the Shift+hover group pre-selection input)', () => {
    const groupBar = hit({ entityType: 'bar', entityId: 'b1', hostElementId: 'w1', placementGroupId: 'g1' });
    expect(pickPointerWinner([wall('w1'), groupBar])).toEqual({
      entityType: 'bar',
      id: 'b1',
      placementGroupId: 'g1',
    });
    // A group-less bar carries NO handle.
    expect(pickPointerWinner([bar('b2', 'w1')])).toEqual({ entityType: 'bar', id: 'b2' });
  });
});

describe('Shift+hover group pre-selection (§B.5 revised 2026-08-22, M3 T5)', () => {
  const groupBarWinner = { entityType: 'bar' as const, id: 'b1', placementGroupId: 'g1' };

  it('Shift+hover over a group member highlights the ENTIRE group instead of the bar', () => {
    setHoverFromPick(groupBarWinner, true);
    expect(getHoverTarget()).toEqual({ entityType: 'barGroup', id: 'g1' });
  });

  it('without Shift the hover stays the bar itself', () => {
    setHoverFromPick(groupBarWinner, false);
    expect(getHoverTarget()).toEqual(groupBarWinner);
  });

  it('a group-less bar never resolves to a group — Shift changes nothing', () => {
    setHoverFromPick({ entityType: 'bar', id: 'b2' }, true);
    expect(getHoverTarget()).toEqual({ entityType: 'bar', id: 'b2' });
  });

  it('walls and sections are unaffected by Shift', () => {
    setHoverFromPick({ entityType: 'wall', id: 'w1' }, true);
    expect(getHoverTarget()).toEqual({ entityType: 'wall', id: 'w1' });
    setHoverFromPick({ entityType: 'section', id: 's1' }, true);
    expect(getHoverTarget()).toEqual({ entityType: 'section', id: 's1' });
  });

  it('pressing/releasing Shift re-resolves the hover WITHOUT a pointer move (the remembered pick)', () => {
    setHoverFromPick(groupBarWinner, false); // hover a group bar, no Shift
    expect(getHoverTarget()).toEqual(groupBarWinner);

    setShiftHeld(true); // hold Shift while stationary → the group lights up
    expect(getHoverTarget()).toEqual({ entityType: 'barGroup', id: 'g1' });

    setShiftHeld(false); // release → back to the bar
    expect(getHoverTarget()).toEqual(groupBarWinner);
  });

  it('clearing the hovered bar forgets the pick — a later Shift press cannot resurrect a stale group', () => {
    setHoverFromPick(groupBarWinner, false);
    clearHoverTarget({ entityType: 'bar', id: 'b1' });

    setShiftHeld(true);
    expect(getHoverTarget()).toBeNull();
  });

  it('a pinned hover FREEZES at its pinned-time resolution — Shift mid-drag (the §B.3 snap toggle) changes nothing', () => {
    setHoverFromPick(groupBarWinner, false); // hovering the bar alone when the drag starts
    setHoverPinned(true); // freeze

    setShiftHeld(true); // Shift for fine positioning mid-drag
    expect(getHoverTarget()).toEqual(groupBarWinner);

    setHoverPinned(false); // unpinning re-resolves from the remembered pick + Shift
    expect(getHoverTarget()).toEqual({ entityType: 'barGroup', id: 'g1' });
  });

  it('a GROUP drag (started under Shift) keeps its group highlight for the whole gesture', () => {
    setHoverFromPick(groupBarWinner, true); // Shift+hover → the group lights up
    expect(getHoverTarget()?.entityType).toBe('barGroup');

    setHoverPinned(true); // the group drag starts — the group stays highlighted
    expect(getHoverTarget()).toEqual({ entityType: 'barGroup', id: 'g1' });

    setShiftHeld(false); // Shift released mid-drag: the commit still moves the group
    expect(getHoverTarget()).toEqual({ entityType: 'barGroup', id: 'g1' }); // frozen

    setHoverPinned(false); // release → hover re-resolves to the remembered pick (no Shift)
    expect(getHoverTarget()).toEqual(groupBarWinner);
  });

  it('clearing the group target directly also works (the BarMesh pointer-out path)', () => {
    setHoverFromPick(groupBarWinner, true);
    expect(getHoverTarget()?.entityType).toBe('barGroup');

    clearHoverTarget({ entityType: 'bar', id: 'b1' }); // forget the raw pick
    clearHoverTarget({ entityType: 'barGroup', id: 'g1' }); // clear the resolved hover
    expect(getHoverTarget()).toBeNull();

    setShiftHeld(false);
    expect(getHoverTarget()).toBeNull(); // nothing resurrects
  });
});
