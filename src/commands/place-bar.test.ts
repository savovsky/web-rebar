import { describe, expect, it } from 'vitest';
import { placeBar, placeWall } from '@/commands';
import { DEFAULT_STEEL_CATALOG } from '@/data/catalog/steel';
import { createAppStore } from '@/stores';
import { expectCommandError } from './test-utils';

const createStoreWithWall = () => {
  const store = createAppStore();
  const wallId = store.dispatch(
    placeWall({
      startPoint: { x: 0, y: 0, z: 0 },
      endPoint: { x: 4000, y: 0, z: 0 },
      thickness: 200,
      height: 2800,
    }),
  );
  return { store, wallId };
};

const barParams = (wallId: string) => ({
  hostElementId: wallId,
  diameter: 16,
  path: [
    { x: 0, y: 500, z: 87 },
    { x: 4000, y: 500, z: 87 },
  ],
});

describe('placeBar', () => {
  it('places a bar with catalog defaults for cover and steel grade', () => {
    const { store, wallId } = createStoreWithWall();
    const barId = store.dispatch(placeBar(barParams(wallId)));

    const bar = store.getState().project.reinforcement[barId];
    expect(bar.hostElementId).toBe(wallId);
    expect(bar.diameter).toBe(16);
    expect(bar.coverDistance).toBe(DEFAULT_STEEL_CATALOG.defaultCover.wall);
    expect(bar.steelGrade).toBe(DEFAULT_STEEL_CATALOG.defaultGrade);
  });

  it('keeps explicit cover and steel grade', () => {
    const { store, wallId } = createStoreWithWall();
    const barId = store.dispatch(placeBar({ ...barParams(wallId), coverDistance: 40, steelGrade: 'B500B' }));
    expect(store.getState().project.reinforcement[barId].coverDistance).toBe(40);
  });

  it('rejects an unknown host element', () => {
    const store = createAppStore();
    expectCommandError(() => store.dispatch(placeBar(barParams('no-such-wall'))), 'NOT_FOUND');
    expect(Object.keys(store.getState().project.reinforcement)).toHaveLength(0);
  });

  it('rejects a diameter outside the steel catalog', () => {
    const { store, wallId } = createStoreWithWall();
    expectCommandError(
      () => store.dispatch(placeBar({ ...barParams(wallId), diameter: 15 })),
      'INVALID_PARAMS',
    );
  });

  it('rejects non-straight paths in M0', () => {
    const { store, wallId } = createStoreWithWall();
    const bent = [...barParams(wallId).path, { x: 4000, y: 900, z: 87 }];
    expectCommandError(
      () => store.dispatch(placeBar({ ...barParams(wallId), path: bent })),
      'INVALID_PARAMS',
    );
  });

  it('rejects a zero-length bar path', () => {
    const { store, wallId } = createStoreWithWall();
    const point = { x: 100, y: 500, z: 87 };
    expectCommandError(
      () => store.dispatch(placeBar({ ...barParams(wallId), path: [point, point] })),
      'INVALID_PARAMS',
    );
  });

  it('rejects non-positive cover and unknown steel grades', () => {
    const { store, wallId } = createStoreWithWall();
    expectCommandError(
      () => store.dispatch(placeBar({ ...barParams(wallId), coverDistance: 0 })),
      'INVALID_PARAMS',
    );
    expectCommandError(
      () => store.dispatch(placeBar({ ...barParams(wallId), steelGrade: 'S355' })),
      'INVALID_PARAMS',
    );
  });
});
