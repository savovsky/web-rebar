import { describe, expect, it } from 'vitest';
import { createSection, placeWall, setActiveSection } from '@/commands';
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

const sectionParams = (wallId: string) => ({
  name: 'S-1',
  plane: { origin: { x: 2000, y: 0, z: 0 }, normal: { x: 5, y: 0, z: 0 } },
  viewDepth: 5000,
  targetElementIds: [wallId],
});

describe('createSection', () => {
  it('stores the definition with a normalized, vertical normal and returns its id', () => {
    const { store, wallId } = createStoreWithWall();
    const sectionId = store.dispatch(createSection(sectionParams(wallId)));

    const section = store.getState().project.sections[sectionId];
    expect(section.name).toBe('S-1');
    expect(section.plane.normal).toEqual({ x: 1, y: 0, z: 0 });
    expect(section.viewDepth).toBe(5000);
    expect(section.targetElementIds).toEqual([wallId]);
  });

  it('rejects an empty name, empty targets, and non-positive view depth', () => {
    const { store, wallId } = createStoreWithWall();
    expectCommandError(
      () => store.dispatch(createSection({ ...sectionParams(wallId), name: '  ' })),
      'INVALID_PARAMS',
    );
    expectCommandError(
      () => store.dispatch(createSection({ ...sectionParams(wallId), targetElementIds: [] })),
      'INVALID_PARAMS',
    );
    expectCommandError(
      () => store.dispatch(createSection({ ...sectionParams(wallId), viewDepth: 0 })),
      'INVALID_PARAMS',
    );
  });

  it('rejects missing target elements', () => {
    const { store, wallId } = createStoreWithWall();
    expectCommandError(
      () => store.dispatch(createSection({ ...sectionParams(wallId), targetElementIds: [wallId, 'ghost'] })),
      'NOT_FOUND',
    );
  });

  it('rejects non-vertical planes and zero normals in M0', () => {
    const { store, wallId } = createStoreWithWall();
    const tilted = { origin: { x: 0, y: 0, z: 0 }, normal: { x: 0, y: 1, z: 0 } };
    const degenerate = { origin: { x: 0, y: 0, z: 0 }, normal: { x: 0, y: 0, z: 0 } };
    expectCommandError(
      () => store.dispatch(createSection({ ...sectionParams(wallId), plane: tilted })),
      'INVALID_PARAMS',
    );
    expectCommandError(
      () => store.dispatch(createSection({ ...sectionParams(wallId), plane: degenerate })),
      'INVALID_PARAMS',
    );
  });
});

describe('setActiveSection', () => {
  it('activates and clears the section shown in the 2D panel', () => {
    const { store, wallId } = createStoreWithWall();
    const sectionId = store.dispatch(createSection(sectionParams(wallId)));

    store.dispatch(setActiveSection({ sectionId }));
    expect(store.getState().ui.activeSectionId).toBe(sectionId);

    store.dispatch(setActiveSection({ sectionId: null }));
    expect(store.getState().ui.activeSectionId).toBeNull();
  });

  it('rejects an unknown section id', () => {
    const store = createAppStore();
    expectCommandError(() => store.dispatch(setActiveSection({ sectionId: 'ghost' })), 'NOT_FOUND');
  });
});
