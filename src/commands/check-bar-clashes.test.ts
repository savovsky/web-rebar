// checkBarClashes — the §K.1 ON-DEMAND clash check (M3 T6 review amendment,
// author direction 2026-08-22: the "Collision Check" button). Verifies: the
// exact report over the full model (incl. the perpendicular same-plane MESH
// case — vertical × horizontal bars in one cover plane, the author's review
// finding), the surfacing (ui.clashWarning + status-bar hint, "no clashes"
// feedback on a clean run), the scope seam (the future active layer), and
// the read-only contract (zero undo levels, project untouched).
// Crosses the real WASM boundary (initWasmFromDisk).
import { beforeAll, describe, expect, it } from 'vitest';
import { checkBarClashes, placeBar, placeBarGroup, placeWall } from '@/commands';
import { initWasmFromDisk } from '@/engine/wasm-test-init';
import { createAppStore } from '@/stores';
import { setClashWarning } from '@/stores/ui-slice';

beforeAll(initWasmFromDisk);

/** The M0 acceptance wall: 4000 × 200 × 2800 (x 0..4000, y −100..100, z 0..2800). */
const WALL_PARAMS = {
  startPoint: { x: 0, y: 0, z: 0 },
  endPoint: { x: 4000, y: 0, z: 0 },
  thickness: 200,
  height: 2800,
};

const groupParams = (wallId: string, orientation: 'horizontal' | 'vertical') => ({
  hostElementId: wallId,
  faceKey: 'face:posThickness' as const,
  region: { uMin: -2000, uMax: 2000, vMin: -1400, vMax: 1400 },
  diameter: 12,
  barSpacing: 150,
  edgeDistanceStart: 60,
  edgeDistanceEnd: 60,
  orientation,
});

/** 18 horizontal × 26 vertical bars, same cover plane (y = 69) — every
 *  vertical crosses every horizontal at distance 0. */
const MESH_PAIR_COUNT = 18 * 26;

const createStoreWithWall = () => {
  const store = createAppStore();
  const wallId = store.dispatch(placeWall(WALL_PARAMS));
  return { store, wallId };
};

describe('checkBarClashes — the §K.1 on-demand check', () => {
  it('reports the perpendicular same-plane MESH exactly (18 × 26 crossings at distance 0)', () => {
    const { store, wallId } = createStoreWithWall();
    const horizontal = store.dispatch(placeBarGroup(groupParams(wallId, 'horizontal')));
    const vertical = store.dispatch(placeBarGroup(groupParams(wallId, 'vertical')));
    // A clean re-check would have cleared the placement-time warning — the
    // on-demand check re-derives the truth from the model.
    store.dispatch(setClashWarning(null));

    const result = store.dispatch(checkBarClashes());

    expect(result.checkedCount).toBe(18 + 26);
    expect(result.clashes).toHaveLength(MESH_PAIR_COUNT);
    const horizontalIds = new Set(horizontal.barIds);
    const verticalIds = new Set(vertical.barIds);
    for (const clash of result.clashes) {
      // Exact 0 up to the face-frame float noise (the T2-recorded ~1e-13 mm).
      expect(clash.minDistanceMm).toBeCloseTo(0, 9);
      const ids = [clash.barIdA, clash.barIdB];
      expect(ids.filter((id) => horizontalIds.has(id))).toHaveLength(1);
      expect(ids.filter((id) => verticalIds.has(id))).toHaveLength(1);
    }
    // Surfacing: the warning layer carries the exact report; the hint says it.
    expect(store.getState().ui.clashWarning?.pairs).toEqual(result.clashes);
    expect(store.getState().ui.cursorHint).toContain(`${MESH_PAIR_COUNT} bar pairs`);
    expect(store.getState().ui.cursorHint).toContain('0.0 mm');
  });

  it('catches B-tool individual bars (placeBar runs no placement-time check)', () => {
    const { store, wallId } = createStoreWithWall();
    // A vertical × horizontal pair in one cover plane (y = 69) — crossing at
    // distance 0, placed with the B-tool flow (no clash report exists yet).
    const verticalBar = store.dispatch(
      placeBar({
        hostElementId: wallId,
        diameter: 12,
        path: [
          { x: 1000, y: 69, z: 25 },
          { x: 1000, y: 69, z: 2775 },
        ],
        coverDistance: 25,
      }),
    );
    const horizontalBar = store.dispatch(
      placeBar({
        hostElementId: wallId,
        diameter: 12,
        path: [
          { x: 25, y: 69, z: 700 },
          { x: 3975, y: 69, z: 700 },
        ],
        coverDistance: 25,
      }),
    );

    const result = store.dispatch(checkBarClashes());

    expect(result.checkedCount).toBe(2);
    expect(result.clashes).toHaveLength(1);
    const [clash] = result.clashes;
    expect(clash.minDistanceMm).toBe(0);
    expect([clash.barIdA, clash.barIdB].sort()).toEqual([verticalBar, horizontalBar].sort());
  });

  it('a clean run clears the warning layer and announces the clean result', () => {
    const { store, wallId } = createStoreWithWall();
    store.dispatch(placeBarGroup(groupParams(wallId, 'horizontal')));
    store.dispatch(setClashWarning({ pairs: [{ barIdA: 'stale-a', barIdB: 'stale-b', minDistanceMm: 0 }] }));

    const result = store.dispatch(checkBarClashes());

    expect(result.clashes).toEqual([]);
    expect(result.checkedCount).toBe(18);
    expect(store.getState().ui.clashWarning).toBeNull();
    expect(store.getState().ui.cursorHint).toBe('Collision check: no clashes (18 bars checked)');
  });

  it('honors the scope seam (the future active layer): only pairs INSIDE the scope are reported', () => {
    const { store, wallId } = createStoreWithWall();
    const horizontal = store.dispatch(placeBarGroup(groupParams(wallId, 'horizontal')));
    const vertical = store.dispatch(placeBarGroup(groupParams(wallId, 'vertical')));

    // Scope = the horizontal bars only → no pair has both members in scope.
    const scoped = store.dispatch(checkBarClashes({ scopeBarIds: horizontal.barIds }));
    expect(scoped.checkedCount).toBe(18);
    expect(scoped.clashes).toEqual([]);
    expect(store.getState().ui.clashWarning).toBeNull();

    // Scope = everything → the mesh is found (same as the default).
    const full = store.dispatch(checkBarClashes({ scopeBarIds: [...horizontal.barIds, ...vertical.barIds] }));
    expect(full.clashes).toHaveLength(MESH_PAIR_COUNT);
  });

  it('skips unknown scope ids silently (a stale scope is not an error)', () => {
    const { store, wallId } = createStoreWithWall();
    const horizontal = store.dispatch(placeBarGroup(groupParams(wallId, 'horizontal')));
    const result = store.dispatch(checkBarClashes({ scopeBarIds: [...horizontal.barIds, 'no-such-bar'] }));
    expect(result.checkedCount).toBe(18);
    expect(result.clashes).toEqual([]);
  });

  it('is read-only: zero undo levels, project reference untouched', () => {
    const { store, wallId } = createStoreWithWall();
    store.dispatch(placeBarGroup(groupParams(wallId, 'horizontal')));
    store.dispatch(placeBarGroup(groupParams(wallId, 'vertical')));
    const projectBefore = store.getState().project;
    const depthBefore = store.getState().undo.past.length;

    store.dispatch(checkBarClashes());

    expect(store.getState().undo.past).toHaveLength(depthBefore);
    expect(store.getState().project).toBe(projectBefore);
    expect(store.getState().ui.clashWarning?.pairs).toHaveLength(MESH_PAIR_COUNT);
  });
});
