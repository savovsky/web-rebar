import { describe, expect, it } from 'vitest';
import { commandRegistry } from '@/commands';

describe('commandRegistry', () => {
  it('exposes all commands (8 M0 + undo/redo T1 + moveElement/deleteSection T2 + deleteSelection T3 + exportIfc M2-T2 + importIfcModel M2-T3 + reference-document M2-T5 + exportSectionDxf M2-T7 + placement-group M3-T3) under names matching their keys', () => {
    expect(Object.keys(commandRegistry).sort()).toEqual([
      'createSection',
      'deleteBar',
      'deleteElement',
      'deletePlacementGroup',
      'deleteSection',
      'deleteSelection',
      'exportIfc',
      'exportSectionDxf',
      'extendBar',
      'importIfcModel',
      'importReferenceDocument',
      'moveElement',
      'placeBar',
      'placeBarGroup',
      'placeWall',
      'redo',
      'removeReferenceDocument',
      'reshapeSection',
      'setActiveSection',
      'setReferenceDocumentVisibility',
      'undo',
      'updatePlacementGroup',
    ]);
    for (const [key, entry] of Object.entries(commandRegistry)) {
      expect(entry.name).toBe(key);
      expect(entry.thunk).toBeTypeOf('function');
    }
  });
});
