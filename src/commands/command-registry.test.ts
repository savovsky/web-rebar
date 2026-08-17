import { describe, expect, it } from 'vitest';
import { commandRegistry } from '@/commands';

describe('commandRegistry', () => {
  it('exposes all commands (8 M0 + undo/redo T1 + moveElement/deleteSection T2 + deleteSelection T3) under names matching their keys', () => {
    expect(Object.keys(commandRegistry).sort()).toEqual([
      'createSection',
      'deleteBar',
      'deleteElement',
      'deleteSection',
      'deleteSelection',
      'extendBar',
      'moveElement',
      'placeBar',
      'placeWall',
      'redo',
      'reshapeSection',
      'setActiveSection',
      'undo',
    ]);
    for (const [key, entry] of Object.entries(commandRegistry)) {
      expect(entry.name).toBe(key);
      expect(entry.thunk).toBeTypeOf('function');
    }
  });
});
