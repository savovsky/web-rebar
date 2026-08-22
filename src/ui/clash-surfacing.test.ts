// Q8 surfacing (§K.4 minimal, M3 T6): a command's exact clash report becomes
// the transient warning layer (ui.clashWarning) + a status-bar hint; a clean
// report CLEARS the layer. React-free — asserted at store level.
import { describe, expect, it } from 'vitest';
import { createAppStore } from '@/stores';
import { setClashWarning } from '@/stores/ui-slice';
import { formatClashHint, surfaceClashReport } from './clash-surfacing';

const clash = (ids: [string, string], minDistanceMm: number) => ({
  barIdA: ids[0],
  barIdB: ids[1],
  minDistanceMm,
});

describe('surfaceClashReport', () => {
  it('sets the warning layer and the status-bar hint for a non-empty report', () => {
    const store = createAppStore();
    const pairs = [clash(['a', 'b'], 8), clash(['c', 'd'], 0)];
    surfaceClashReport(store.dispatch, pairs);
    expect(store.getState().ui.clashWarning?.pairs).toEqual(pairs);
    expect(store.getState().ui.cursorHint).toBe(formatClashHint(pairs));
    expect(store.getState().ui.cursorHint).toContain('2 bar pairs');
    expect(store.getState().ui.cursorHint).toContain('0.0 mm');
  });

  it('a clean report clears the warning layer (the last command fixed it)', () => {
    const store = createAppStore();
    store.dispatch(setClashWarning({ pairs: [clash(['a', 'b'], 8)] }));
    surfaceClashReport(store.dispatch, []);
    expect(store.getState().ui.clashWarning).toBeNull();
  });

  it('formats the singular pair and the closest distance', () => {
    expect(formatClashHint([clash(['a', 'b'], 3.456)])).toBe(
      'Clash warning: 1 bar pair — closest centerline distance 3.5 mm · non-blocking warning (§K.4)',
    );
  });
});
