import { describe, expect, it } from 'vitest';
import { commandRegistry } from '@/commands';

describe('commandRegistry', () => {
  it('exposes all eight M0 commands under names matching their keys', () => {
    expect(Object.keys(commandRegistry).sort()).toEqual([
      'createSection',
      'deleteBar',
      'deleteElement',
      'extendBar',
      'placeBar',
      'placeWall',
      'reshapeSection',
      'setActiveSection',
    ]);
    for (const [key, entry] of Object.entries(commandRegistry)) {
      expect(entry.name).toBe(key);
      expect(entry.thunk).toBeTypeOf('function');
    }
  });
});
