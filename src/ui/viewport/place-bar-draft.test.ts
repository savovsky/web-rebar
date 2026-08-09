// Headless test of the chained Place Bar flow (the draft module is React-free):
// a multi-click chain on one face must produce ONE bar whose path holds every
// clicked point as a bending place — never several separate bars (§B.6, §J).
import { describe, expect, it } from 'vitest';
import { placeWall } from '@/commands';
import { DEFAULT_BAR_DIAMETER_MM, resolveDefaultCover } from '@/commands/place-bar';
import type { Vec3, WallElement } from '@/data/models';
import { createAppStore } from '@/stores';
import { advanceBarDraft, captureBarFace } from './place-bar-draft';

// Wall along +X: 4000 long, 200 thick, 2800 high → +Z face plane at z = 100.
const FACE_Z = 100;
const BAR_CENTER_Z = FACE_Z - (resolveDefaultCover('wall') + DEFAULT_BAR_DIAMETER_MM / 2); // 69

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
  captureBarFace({ dispatch: store.dispatch, wall, localNormal: { x: 0, y: 0, z: 1 } });
  return { store, wall };
};

/** Feeds face-plane clicks through the draft flow (WallMesh resolves + snaps
 *  the raw raycast hits before this — the test passes resolved points). */
interface AdvanceFaceClicksOptions {
  store: ReturnType<typeof createAppStore>;
  wall: WallElement;
  points: Vec3[];
}

const advanceFaceClicks = ({ store, wall, points }: AdvanceFaceClicksOptions) => {
  for (const point of points) {
    advanceBarDraft({
      dispatch: store.dispatch,
      host: wall,
      draft: store.getState().ui.placementDraft,
      point,
    });
  }
};

describe('chained Place Bar flow', () => {
  it('builds ONE bar with bending places from a multi-click chain', () => {
    const { store, wall } = createStoreWithCapturedFace();
    advanceFaceClicks({
      store,
      wall,
      points: [
        { x: 500, y: 500, z: FACE_Z },
        { x: 3000, y: 500, z: FACE_Z },
        { x: 3000, y: 2000, z: FACE_Z },
        { x: 500, y: 2000, z: FACE_Z },
      ],
    });

    const state = store.getState();
    const bars = Object.values(state.project.reinforcement);
    // The author's requirement: 4 clicked segments → 1 bar, not 4 (the
    // Building tab counts reinforcement entries; the schedule counts positions).
    expect(bars).toHaveLength(1);
    expect(bars[0].path).toHaveLength(4);
    expect(bars[0].hostElementId).toBe(wall.id);
    expect(bars[0].diameter).toBe(DEFAULT_BAR_DIAMETER_MM);
    expect(bars[0].coverDistance).toBe(resolveDefaultCover('wall'));
    // Every path point sits at cover + radius inside the captured face.
    for (const point of bars[0].path) {
      expect(point.z).toBeCloseTo(BAR_CENTER_Z);
    }
    expect(bars[0].path[0]).toMatchObject({ x: 500, y: 500 });
    expect(bars[0].path[3]).toMatchObject({ x: 500, y: 2000 });
    // The new bar is selected and the draft keeps the chain going.
    expect(state.ui.selection.barIds).toEqual([bars[0].id]);
    expect(state.ui.placementDraft.barId).toBe(bars[0].id);
  });

  it('keeps cover from ALL wall faces — edge clicks pull the bar inside', () => {
    const { store, wall } = createStoreWithCapturedFace();
    // Clicks exactly on the wall end edges (x = 0 and x = 4000): the bar
    // start/end must end up at cover distance from the end faces, not flush.
    advanceFaceClicks({
      store,
      wall,
      points: [
        { x: 0, y: 500, z: FACE_Z },
        { x: 4000, y: 500, z: FACE_Z },
      ],
    });

    const bars = Object.values(store.getState().project.reinforcement);
    expect(bars).toHaveLength(1);
    expect(bars[0].path[0].x).toBeCloseTo(resolveDefaultCover('wall')); // 25
    expect(bars[0].path[1].x).toBeCloseTo(4000 - resolveDefaultCover('wall')); // 3975
    expect(bars[0].path[0].z).toBeCloseTo(BAR_CENTER_Z);
  });

  it('keeps the draft and the bar on a zero-length segment click', () => {
    const { store, wall } = createStoreWithCapturedFace();
    advanceFaceClicks({
      store,
      wall,
      points: [
        { x: 500, y: 500, z: FACE_Z },
        { x: 3000, y: 500, z: FACE_Z },
        { x: 3000, y: 500, z: FACE_Z }, // same point — rejected segment
      ],
    });

    const state = store.getState();
    const bars = Object.values(state.project.reinforcement);
    expect(bars).toHaveLength(1);
    expect(bars[0].path).toHaveLength(2);
    expect(state.ui.placementDraft.committedPoints).toHaveLength(2);
    expect(state.ui.cursorHint).toContain('zero-length');
  });
});
