import type { Intersection } from 'three';
import { describe, expect, it } from 'vitest';
import { pickPointerWinner } from './hover-target';

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
});
