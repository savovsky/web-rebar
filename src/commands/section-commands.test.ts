import { describe, expect, it } from 'vitest';
import { createSection, placeWall, reshapeSection, setActiveSection } from '@/commands';
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

/** Cut line across the wall (footprint z ∈ [-100, 100]); the depth point sits
 *  at +X from the line, so the view looks along +X with 2500 mm depth. */
const sectionParams = (wallId: string) => ({
  name: 'S-1',
  lineStart: { x: 2000, y: 0, z: -500 },
  lineEnd: { x: 2000, y: 0, z: 500 },
  depthPoint: { x: 4500, y: 0, z: 0 },
  targetElementIds: [wallId],
});

describe('createSection', () => {
  it('derives plane + view depth from the line and depth point, and returns the id', () => {
    const { store, wallId } = createStoreWithWall();
    const sectionId = store.dispatch(createSection(sectionParams(wallId)));

    const section = store.getState().project.sections[sectionId];
    expect(section.name).toBe('S-1');
    expect(section.lineStart).toEqual({ x: 2000, y: 0, z: -500 });
    expect(section.lineEnd).toEqual({ x: 2000, y: 0, z: 500 });
    expect(section.plane.origin).toEqual({ x: 2000, y: 0, z: -500 }); // invariant: origin = lineStart
    expect(section.plane.normal).toEqual({ x: 1, y: 0, z: 0 }); // looks toward the depth point
    expect(section.viewDepth).toBeCloseTo(2500);
    expect(section.targetElementIds).toEqual([wallId]);
  });

  it('flips the view direction when the depth point lies on the other side', () => {
    const { store, wallId } = createStoreWithWall();
    const sectionId = store.dispatch(
      createSection({ ...sectionParams(wallId), depthPoint: { x: 500, y: 0, z: 0 } }),
    );
    const section = store.getState().project.sections[sectionId];
    expect(section.plane.normal).toEqual({ x: -1, y: 0, z: 0 });
    expect(section.viewDepth).toBeCloseTo(1500);
  });

  it('rejects an empty name, empty targets, and missing target elements', () => {
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
      () => store.dispatch(createSection({ ...sectionParams(wallId), targetElementIds: [wallId, 'ghost'] })),
      'NOT_FOUND',
    );
  });

  it('rejects a zero-length line and a depth point on the line', () => {
    const { store, wallId } = createStoreWithWall();
    expectCommandError(
      () => store.dispatch(createSection({ ...sectionParams(wallId), lineEnd: { x: 2000, y: 0, z: -500 } })),
      'INVALID_PARAMS',
    );
    expectCommandError(
      () => store.dispatch(createSection({ ...sectionParams(wallId), depthPoint: { x: 2000, y: 0, z: 0 } })),
      'INVALID_PARAMS',
    );
  });
});

describe('reshapeSection', () => {
  it('moves the section and recomputes plane, depth, and targets', () => {
    const { store, wallId } = createStoreWithWall();
    const sectionId = store.dispatch(createSection(sectionParams(wallId)));

    store.dispatch(
      reshapeSection({
        sectionId,
        lineStart: { x: 1000, y: 0, z: -500 },
        lineEnd: { x: 1000, y: 0, z: 500 },
        depthPoint: { x: 3500, y: 0, z: 0 },
      }),
    );

    const section = store.getState().project.sections[sectionId];
    expect(section.lineStart).toEqual({ x: 1000, y: 0, z: -500 });
    expect(section.plane.origin).toEqual({ x: 1000, y: 0, z: -500 });
    expect(section.plane.normal).toEqual({ x: 1, y: 0, z: 0 });
    expect(section.viewDepth).toBeCloseTo(2500);
    expect(section.targetElementIds).toEqual([wallId]); // still crossing
  });

  it('allows reshaping off every element (empty targets — the 2D view shows its empty state)', () => {
    const { store, wallId } = createStoreWithWall();
    const sectionId = store.dispatch(createSection(sectionParams(wallId)));

    store.dispatch(
      reshapeSection({
        sectionId,
        lineStart: { x: 9000, y: 0, z: -500 },
        lineEnd: { x: 9000, y: 0, z: 500 },
        depthPoint: { x: 9500, y: 0, z: 0 },
      }),
    );

    expect(store.getState().project.sections[sectionId].targetElementIds).toEqual([]);
  });

  it('rejects unknown sections and degenerate geometry', () => {
    const { store, wallId } = createStoreWithWall();
    const sectionId = store.dispatch(createSection(sectionParams(wallId)));
    expectCommandError(
      () => store.dispatch(reshapeSection({ ...sectionParams(wallId), sectionId: 'ghost' })),
      'NOT_FOUND',
    );
    expectCommandError(
      () =>
        store.dispatch(
          reshapeSection({
            sectionId,
            lineStart: { x: 0, y: 0, z: 0 },
            lineEnd: { x: 0, y: 0, z: 0 },
            depthPoint: { x: 0, y: 0, z: 100 },
          }),
        ),
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
