/**
 * M3 T1 — reducer-level tests for the PlacementGroup data model and its
 * project-slice reducers (plan section 1): add/update/remove group, batch
 * add/remove of group bars (ONE reducer per batch — the M2 DXF-document
 * precedent), and the Q7-a next-mark counter. Command-side validation stays
 * out of scope here (reducers are dumb per §N — the M3 T3 commands validate);
 * these tests pin exact-reference restore and id stability, and the ONE
 * undo level per composite dispatch (Q4-a command scope) that T3's
 * placeBarGroup/updatePlacementGroup regenerate will rely on.
 */
import { describe, expect, it } from 'vitest';
import { redo, undo } from '@/commands';
import type { PlacementGroup, ReinforcementBar } from '@/data/models';
import { createAppStore } from '@/stores';
import {
  addBars,
  addPlacementGroup,
  detachBars,
  removeBars,
  removePlacementGroup,
  setNextBarMark,
  updatePlacementGroup,
} from './project-slice';

const GROUP_ID = 'group-1';

const makeGroupBar = (id: string): ReinforcementBar => ({
  id,
  hostElementId: 'wall-1',
  diameter: 12,
  path: [
    { x: 0, y: 25, z: 700 },
    { x: 4000, y: 25, z: 700 },
  ],
  coverDistance: 25,
  steelGrade: 'B500B',
  barMark: 1,
  placementGroupId: GROUP_ID,
});

const makeGroup = (bars: string[]): PlacementGroup => ({
  id: GROUP_ID,
  hostElementId: 'wall-1',
  faceKey: 'face:posThickness',
  region: { uMin: 0, uMax: 4000, vMin: 0, vMax: 2800 },
  barMark: 1,
  barDiameter: 12,
  coverDistance: 25,
  barSpacing: 150,
  edgeDistanceStart: 50,
  edgeDistanceEnd: 50,
  orientation: 'horizontal',
  bars,
});

describe('project-slice — placement group + batch bar reducers (M3 T1)', () => {
  it('addBars batch + addPlacementGroup + setNextBarMark apply as ONE undo level with exact reference restore', () => {
    const store = createAppStore();
    const bars = [makeGroupBar('bar-1'), makeGroupBar('bar-2')];
    const group = makeGroup(bars.map((bar) => bar.id));
    const pre = store.getState().project;

    store.dispatch((dispatch) => {
      dispatch(addBars(bars));
      dispatch(addPlacementGroup(group));
      dispatch(setNextBarMark(2));
    });

    const post = store.getState().project;
    expect(Object.keys(post.reinforcement)).toEqual(['bar-1', 'bar-2']);
    expect(post.placementGroups[GROUP_ID]).toEqual(group);
    expect(post.nextBarMark).toBe(2);
    // The composite dispatch (the T3 command's dispatch pattern — several
    // batch reducers inside one thunk) records exactly ONE undo level (Q4-a).
    expect(store.getState().undo.past).toHaveLength(1);

    store.dispatch(undo());
    expect(store.getState().project).toBe(pre); // exact reference restore (M1 pattern)
    store.dispatch(redo());
    expect(store.getState().project).toBe(post);
  });

  it('regenerate shape: removeBars + addBars + updatePlacementGroup keeps the group id stable and replaces membership rule-exactly', () => {
    const store = createAppStore();
    const oldBars = [makeGroupBar('bar-1'), makeGroupBar('bar-2')];
    const group = makeGroup(['bar-1', 'bar-2']);
    store.dispatch((dispatch) => {
      dispatch(addBars(oldBars));
      dispatch(addPlacementGroup(group));
    });
    const pre = store.getState().project;

    // The T3 updatePlacementGroup regenerate dispatch pattern: the old set is
    // removed, the new rule-exact set is added, the group's stored rule +
    // membership are replaced — three batch reducers, ONE undo level.
    const newBars = [makeGroupBar('bar-3'), makeGroupBar('bar-4'), makeGroupBar('bar-5')];
    store.dispatch((dispatch) => {
      dispatch(removeBars({ ids: ['bar-1', 'bar-2'] }));
      dispatch(addBars(newBars));
      dispatch(updatePlacementGroup({ ...group, barSpacing: 100, bars: ['bar-3', 'bar-4', 'bar-5'] }));
    });

    const post = store.getState().project;
    expect(post.reinforcement['bar-1']).toBeUndefined();
    expect(post.reinforcement['bar-2']).toBeUndefined();
    expect(Object.keys(post.reinforcement)).toEqual(['bar-3', 'bar-4', 'bar-5']);
    const updated = post.placementGroups[GROUP_ID];
    expect(updated.id).toBe(GROUP_ID); // id stability across the rule replacement
    expect(updated.barSpacing).toBe(100);
    expect(updated.barSpacing).not.toBe(group.barSpacing);
    expect(updated.bars).toEqual(['bar-3', 'bar-4', 'bar-5']);
    expect(store.getState().undo.past).toHaveLength(2);
    store.dispatch(undo());
    expect(store.getState().project).toBe(pre); // exact restore of group + old bars
  });

  it('removePlacementGroup removes only the group record; the bars stay for the T3 removeBars: false detach path', () => {
    const store = createAppStore();
    const bar = makeGroupBar('bar-1');
    store.dispatch((dispatch) => {
      dispatch(addBars([bar]));
      dispatch(addPlacementGroup(makeGroup([bar.id])));
    });
    const pre = store.getState().project;

    store.dispatch((dispatch) => void dispatch(removePlacementGroup({ id: GROUP_ID })));

    expect(store.getState().project.placementGroups).toEqual({});
    expect(store.getState().project.reinforcement[bar.id]).toEqual(bar); // untouched — T3 coordinates
    store.dispatch(undo());
    expect(store.getState().project).toBe(pre);
  });

  it('detachBars clears the bar-side group handle (M3 T3 — the Q6 detach primitive) and ONE undo restores it', () => {
    const store = createAppStore();
    const bars = [makeGroupBar('bar-1'), makeGroupBar('bar-2')];
    store.dispatch((dispatch) => {
      dispatch(addBars(bars));
      dispatch(addPlacementGroup(makeGroup(['bar-1', 'bar-2'])));
    });
    const pre = store.getState().project;

    store.dispatch((dispatch) => void dispatch(detachBars({ ids: ['bar-1', 'bar-2'] })));

    expect(store.getState().project.reinforcement['bar-1'].placementGroupId).toBeUndefined();
    expect(store.getState().project.reinforcement['bar-2'].placementGroupId).toBeUndefined();
    // Positions/marks untouched — only the handle is cleared.
    expect(store.getState().project.reinforcement['bar-1'].barMark).toBe(1);
    store.dispatch(undo());
    expect(store.getState().project).toBe(pre);
  });

  it('updatePlacementGroup on an absent id is a no-op and records no undo level', () => {
    const store = createAppStore();
    store.dispatch((dispatch) => void dispatch(updatePlacementGroup(makeGroup([]))));
    expect(store.getState().project.placementGroups).toEqual({});
    expect(store.getState().undo.past).toHaveLength(0); // no-op produce → no snapshot (listener guard)
  });

  it('batch ids are id-keyed: re-adding a bar replaces it in place (no duplicate membership possible)', () => {
    const store = createAppStore();
    const original = makeGroupBar('bar-1');
    const moved: ReinforcementBar = { ...original, path: original.path.map((p) => ({ ...p, z: 1400 })) };
    store.dispatch((dispatch) => {
      dispatch(addBars([original]));
      dispatch(addBars([moved]));
    });
    expect(Object.keys(store.getState().project.reinforcement)).toEqual(['bar-1']);
    expect(store.getState().project.reinforcement['bar-1'].path[0].z).toBe(1400);
  });
});
