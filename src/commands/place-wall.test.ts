import { describe, expect, it } from 'vitest';
import { placeWall } from '@/commands';
import { createAppStore } from '@/stores';
import { expectCommandError } from './test-utils';

const wallParams = {
  startPoint: { x: 0, y: 0, z: 0 },
  endPoint: { x: 4000, y: 0, z: 0 },
  thickness: 200,
  height: 2800,
};

describe('placeWall', () => {
  it('adds a wall to the project and returns its id', () => {
    const store = createAppStore();
    const wallId = store.dispatch(placeWall(wallParams));

    const wall = store.getState().project.elements[wallId];
    expect(wall.kind).toBe('wall');
    expect(wall.startPoint).toEqual(wallParams.startPoint);
    expect(wall.thickness).toBe(200);
    expect(wall.height).toBe(2800);
  });

  it('defaults baseElevation to 0 and keeps an explicit value', () => {
    const store = createAppStore();
    const defaultId = store.dispatch(placeWall(wallParams));
    const raisedId = store.dispatch(placeWall({ ...wallParams, baseElevation: 3000 }));

    const { elements } = store.getState().project;
    expect(elements[defaultId].baseElevation).toBe(0);
    expect(elements[raisedId].baseElevation).toBe(3000);
    expect(Object.keys(elements)).toHaveLength(2);
  });

  it('rejects a zero-length wall axis', () => {
    const store = createAppStore();
    expectCommandError(
      () => store.dispatch(placeWall({ ...wallParams, endPoint: { x: 0, y: 0, z: 0 } })),
      'INVALID_PARAMS',
    );
    expect(Object.keys(store.getState().project.elements)).toHaveLength(0);
  });

  it('rejects non-positive thickness and height', () => {
    const store = createAppStore();
    expectCommandError(() => store.dispatch(placeWall({ ...wallParams, thickness: 0 })), 'INVALID_PARAMS');
    expectCommandError(() => store.dispatch(placeWall({ ...wallParams, height: -100 })), 'INVALID_PARAMS');
    expect(Object.keys(store.getState().project.elements)).toHaveLength(0);
  });
});
