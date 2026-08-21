// Headless test of the Place Bar Group flow (the draft module is React-free):
// face capture → region state (drag/click-click definition is pointer-side;
// the transient setters are exercised directly) → Enter-commit semantics via
// commitBarGroup — whole-face (action A) vs defined region (action B), ONE
// undo level per placement, single-shot auto-return, rejection keeps the
// captured face AND the region (author gesture decision 2026-08-21).
// Model space is Z-up: plan in X–Y, elevation in Z (data/models/geometry.ts).
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { placeWall, undo } from '@/commands';
import { resolveDefaultCover } from '@/commands/place-bar';
import { wholeFaceRegion } from '@/engine/placement-group';
import { initWasmFromDisk } from '@/engine/wasm-test-init';
import { createAppStore } from '@/stores';
import { setTool } from '@/stores/ui-slice';
import {
  captureBarGroupFace,
  clearRegionState,
  commitBarGroup,
  getDefinedRegion,
  setDefinedRegion,
} from './place-bar-group-draft';

// Wall along +X: 4000 long, 200 thick (Y), 2800 high (Z) — the engine corpus.
const createStoreWithCapturedFace = () => {
  const store = createAppStore();
  const wallId = store.dispatch(
    placeWall({
      startPoint: { x: 0, y: 0, z: 0 },
      endPoint: { x: 4000, y: 0, z: 0 },
      thickness: 200,
      height: 2800,
    }),
  );
  const wall = store.getState().project.elements[wallId];
  store.dispatch(setTool({ tool: 'placeBarGroup' }));
  captureBarGroupFace({
    dispatch: store.dispatch,
    hostElementId: wall.id,
    faceKey: 'face:posThickness',
    faceNormal: { x: 0, y: 1, z: 0 },
  });
  return { store, wall };
};

beforeAll(initWasmFromDisk);
beforeEach(clearRegionState);

describe('Place Bar Group flow', () => {
  it('capture starts a barGroup draft carrying the stable face key (Q3-a)', () => {
    const { store, wall } = createStoreWithCapturedFace();
    const draft = store.getState().ui.placementDraft;
    expect(draft.kind).toBe('barGroup');
    expect(draft.hostElementId).toBe(wall.id);
    expect(draft.faceKey).toBe('face:posThickness');
    expect(draft.faceNormal).toEqual({ x: 0, y: 1, z: 0 });
  });

  it('action A — Enter-commit with NO defined region places the whole face', () => {
    const { store, wall } = createStoreWithCapturedFace();
    commitBarGroup({ dispatch: store.dispatch, host: wall, faceKey: 'face:posThickness', isSticky: false });

    const state = store.getState();
    const groups = Object.values(state.project.placementGroups);
    expect(groups).toHaveLength(1);
    // Whole face minus the default edge distances (25 mm cover): vertical
    // bars spaced 150 over 4000 − 50 → floor(3950/150) + 1 = 27 bars.
    expect(groups[0].region).toEqual(wholeFaceRegion(wall, 'face:posThickness'));
    expect(groups[0].bars).toHaveLength(27);
    const bars = Object.values(state.project.reinforcement);
    expect(bars).toHaveLength(27);
    // One shared mark (Q7-a); the selection holds the group's bars.
    expect(new Set(bars.map((bar) => bar.barMark)).size).toBe(1);
    expect(state.ui.selection.barIds).toEqual(groups[0].bars);
    // Single-shot auto-return (§B.6 rule 1); region state cleared.
    expect(state.ui.activeTool).toBe('select');
    expect(getDefinedRegion()).toBeNull();
  });

  it('action B — a defined region commits exactly that region', () => {
    const { store, wall } = createStoreWithCapturedFace();
    // Region: face-local u ∈ [−1000, 1000], v ∈ [−900, 600] (posThickness).
    setDefinedRegion({ uMin: -1000, uMax: 1000, vMin: -900, vMax: 600 });
    commitBarGroup({ dispatch: store.dispatch, host: wall, faceKey: 'face:posThickness', isSticky: false });

    const groups = Object.values(store.getState().project.placementGroups);
    expect(groups).toHaveLength(1);
    expect(groups[0].region).toEqual({ uMin: -1000, uMax: 1000, vMin: -900, vMax: 600 });
    // Vertical bars: u span 2000, edges 25+25 → floor(1950/150) + 1 = 14.
    expect(groups[0].bars).toHaveLength(14);
  });

  it('ONE undo level removes the group AND all its bars; redo re-applies', () => {
    const { store, wall } = createStoreWithCapturedFace();
    commitBarGroup({ dispatch: store.dispatch, host: wall, faceKey: 'face:posThickness', isSticky: false });
    expect(Object.keys(store.getState().project.placementGroups)).toHaveLength(1);
    expect(Object.keys(store.getState().project.reinforcement)).toHaveLength(27);

    store.dispatch(undo());
    expect(Object.keys(store.getState().project.placementGroups)).toHaveLength(0);
    expect(Object.keys(store.getState().project.reinforcement)).toHaveLength(0);
  });

  it('sticky commit keeps the tool and re-arms the capture hint', () => {
    const { store, wall } = createStoreWithCapturedFace();
    commitBarGroup({ dispatch: store.dispatch, host: wall, faceKey: 'face:posThickness', isSticky: true });

    const state = store.getState();
    expect(state.ui.activeTool).toBe('placeBarGroup');
    expect(state.ui.placementDraft.kind).toBeNull(); // re-armed for the next face
    expect(Object.keys(state.project.placementGroups)).toHaveLength(1);
  });

  it('a rejected commit keeps the captured face AND the defined region', () => {
    const { store, wall } = createStoreWithCapturedFace();
    // u span 40 < default edgeStart + edgeEnd (25 + 25) → the T2 validation
    // rejects the rule; the draft must survive for a params fix + re-commit.
    setDefinedRegion({ uMin: -20, uMax: 20, vMin: -100, vMax: 100 });
    commitBarGroup({ dispatch: store.dispatch, host: wall, faceKey: 'face:posThickness', isSticky: false });

    const state = store.getState();
    expect(Object.keys(state.project.placementGroups)).toHaveLength(0);
    expect(state.ui.placementDraft.kind).toBe('barGroup'); // face still captured
    expect(state.ui.placementDraft.faceKey).toBe('face:posThickness');
    expect(getDefinedRegion()).not.toBeNull(); // region kept for a re-commit
    expect(state.ui.cursorHint).toContain('edge distances');
  });

  it('a fresh capture clears the previous region state', () => {
    const { store, wall } = createStoreWithCapturedFace();
    setDefinedRegion({ uMin: -1000, uMax: 1000, vMin: -900, vMax: 600 });
    captureBarGroupFace({
      dispatch: store.dispatch,
      hostElementId: wall.id,
      faceKey: 'face:negThickness',
      faceNormal: { x: 0, y: -1, z: 0 },
    });
    expect(getDefinedRegion()).toBeNull();
    expect(store.getState().ui.placementDraft.faceKey).toBe('face:negThickness');
  });

  it('the whole-face default keeps cover from the captured face', () => {
    const { store, wall } = createStoreWithCapturedFace();
    commitBarGroup({ dispatch: store.dispatch, host: wall, faceKey: 'face:posThickness', isSticky: false });
    const bars = Object.values(store.getState().project.reinforcement);
    // posThickness face at y = 100; cover 25 + radius 6 inward → y = 69.
    const centerY = 100 - (resolveDefaultCover('wall') + 12 / 2);
    for (const bar of bars) {
      expect(bar.path[0].y).toBeCloseTo(centerY);
    }
  });
});
