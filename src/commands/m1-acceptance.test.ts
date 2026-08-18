// T6 — M1 acceptance pass (Architecture Spec §A): the milestone sentence
// end-to-end through the §N command layer — "place wall → place bar → cut
// section → move the wall → the wall AND its hosted bars update (host-follow,
// §E revised 2026-08-09) and the open 2D section view updates immediately →
// undo restores wall+bars to the pre-move state exactly in ONE step, redo
// re-applies it"; 30 undo levels; every M0+M1 command undoable. Driven
// headlessly exactly as the tools drive it (the Move tool's commitElementDrag
// dispatches the same moveElement; the Place Bar tool's face-click resolution
// is reused for placement). Cut bars cross the real WASM boundary
// (initWasmFromDisk). The reference-scale part reuses the T5 fixture
// (reference-project.ts) on the production-middleware benchmark store
// (performance-probes.ts) — under the dev-only RTK invariant checks the
// 1,055-command fixture build costs ~44 s (see the T5 task log).
import { beforeAll, describe, expect, it } from 'vitest';
import {
  type CommandName,
  commandRegistry,
  createSection,
  deleteBar,
  deleteElement,
  deleteSection,
  deleteSelection,
  extendBar,
  moveElement,
  placeBar,
  placeWall,
  redo,
  reshapeSection,
  setActiveSection,
  undo,
} from '@/commands';
import { createBenchmarkStore } from '@/commands/performance-probes';
import { DEFAULT_BAR_DIAMETER_MM, resolveDefaultCover } from '@/commands/place-bar';
import {
  REFERENCE_BARS_PER_WALL,
  type ReferenceStore,
  buildReferenceProject,
} from '@/commands/reference-project';
import { getWallFaceFrame, resolveBarCenterline } from '@/engine/placement';
import { type SectionPrimitives, selectSectionPrimitives } from '@/engine/sectioning';
import { initWasmFromDisk } from '@/engine/wasm-test-init';
import { createAppStore } from '@/stores';
import { setSelection } from '@/stores/ui-slice';

beforeAll(initWasmFromDisk);

/** One wall: 4000 × 200 × 2800 (the M0 acceptance dimensions). */
const WALL_LENGTH_MM = 4000;
const WALL_THICKNESS_MM = 200;
const WALL_HEIGHT_MM = 2800;
/** Two hosted bars (the sentence says "bars") at 25 mm cover from +Z. */
const BAR_HEIGHTS_MM = [700, 1400] as const;
/** Expected centerline offset from the +Z face: cover (25) + radius (Ø12/2). */
const EXPECTED_CENTERLINE_OFFSET_MM = 31;
/** In-plan move — 300 mm along +Z keeps the wall crossed by the cut plane AND
 *  within the drawn cut line extent (z ∈ [200, 400] ⊂ [-500, 500], §G.1). */
const MOVE_DELTA = { x: 0, y: 0, z: 300 } as const;

const WALL_PARAMS = {
  startPoint: { x: 0, y: 0, z: 0 },
  endPoint: { x: WALL_LENGTH_MM, y: 0, z: 0 },
  thickness: WALL_THICKNESS_MM,
  height: WALL_HEIGHT_MM,
};

interface PlaceBarAtCoverOptions {
  store: ReferenceStore;
  wallId: string;
  yMm: number;
}

/** Tool-equivalent bar placement (the Place Bar draft's own resolution). */
const placeBarAtCover = (options: PlaceBarAtCoverOptions): string => {
  const { store, wallId, yMm } = options;
  const wall = store.getState().project.elements[wallId];
  const centerline = resolveBarCenterline({
    facePoints: [
      { x: 500, y: yMm, z: WALL_THICKNESS_MM / 2 },
      { x: 3500, y: yMm, z: WALL_THICKNESS_MM / 2 },
    ],
    frame: getWallFaceFrame(wall, { x: 0, y: 0, z: 1 }),
    wall,
    coverMm: resolveDefaultCover('wall'),
    radiusMm: DEFAULT_BAR_DIAMETER_MM / 2,
  });
  return store.dispatch(
    placeBar({ hostElementId: wallId, diameter: DEFAULT_BAR_DIAMETER_MM, path: centerline }),
  );
};

const sectionParams = (wallId: string) => ({
  name: 'S-1',
  lineStart: { x: 2000, y: 0, z: -500 },
  lineEnd: { x: 2000, y: 0, z: 500 },
  depthPoint: { x: 4500, y: 0, z: 0 },
  targetElementIds: [wallId],
});

const requirePrimitives = (store: ReferenceStore, sectionId: string): SectionPrimitives => {
  const primitives = selectSectionPrimitives(store.getState(), sectionId);
  if (primitives === null) throw new Error('expected primitives for a known section');
  return primitives;
};

/** Sorted u-centers of the outlines (u ≈ position along the drawn cut line). */
const outlineUCenters = (primitives: SectionPrimitives): number[] =>
  primitives.concreteOutlines
    .map((outline) => {
      const us = outline.map((point) => point.u);
      return (Math.min(...us) + Math.max(...us)) / 2;
    })
    .sort((a, b) => a - b);

describe('M1 acceptance sentence (§A): one wall, two hosted bars, one open section', () => {
  it('place wall → place bars → cut section → move: wall AND bars update (host-follow), the open 2D view re-derives → ONE undo restores all exactly → redo re-applies', () => {
    const store = createAppStore();

    // 1–2. Place the wall and its hosted bars (§N commands; the Place Bar
    // tool's face-click math resolves the cover-true centerlines).
    const wallId = store.dispatch(placeWall(WALL_PARAMS));
    const barIds = BAR_HEIGHTS_MM.map((yMm) => placeBarAtCover({ store, wallId, yMm }));

    // 3. Cut the section and OPEN the 2D view (Section Cut tool → panel).
    const sectionId = store.dispatch(createSection(sectionParams(wallId)));
    store.dispatch(setActiveSection({ sectionId }));
    expect(store.getState().ui.activeSectionId).toBe(sectionId);

    const baseline = requirePrimitives(store, sectionId);
    expect(baseline.concreteOutlines).toHaveLength(1);
    expect(baseline.cutBars).toHaveLength(BAR_HEIGHTS_MM.length);
    const baselineUs = baseline.concreteOutlines[0].map((point) => point.u);
    const baselineURange: [number, number] = [Math.min(...baselineUs), Math.max(...baselineUs)];
    for (const [index, dot] of baseline.cutBars.entries()) {
      expect(baselineURange[1] - dot.center.u).toBeCloseTo(EXPECTED_CENTERLINE_OFFSET_MM);
      expect(dot.center.v).toBeCloseTo(BAR_HEIGHTS_MM[index]);
      expect(dot.diameterMm).toBe(DEFAULT_BAR_DIAMETER_MM);
    }

    const preMove = store.getState().project;

    // 4. Move the wall (the Move tool's commitElementDrag dispatches this).
    store.dispatch(moveElement({ elementId: wallId, delta: MOVE_DELTA }));
    const postMove = store.getState().project;
    expect(postMove).not.toBe(preMove);

    // The WALL updates in 3D — plan translation; section-defining params untouched.
    const movedWall = postMove.elements[wallId];
    expect(movedWall.startPoint).toEqual({ x: 0, y: 0, z: MOVE_DELTA.z });
    expect(movedWall.endPoint).toEqual({ x: WALL_LENGTH_MM, y: 0, z: MOVE_DELTA.z });
    expect(movedWall.thickness).toBe(WALL_THICKNESS_MM);
    expect(movedWall.height).toBe(WALL_HEIGHT_MM);

    // Its HOSTED BARS update in 3D with it (host-follow, §E revised 2026-08-09).
    for (const barId of barIds) {
      const before = preMove.reinforcement[barId];
      const after = postMove.reinforcement[barId];
      expect(after).not.toBe(before);
      expect(after.hostElementId).toBe(wallId);
      expect(after.coverDistance).toBe(25); // design intent survives (§C)
      after.path.forEach((point, pointIndex) => {
        expect(point.x).toBe(before.path[pointIndex].x);
        expect(point.y).toBe(before.path[pointIndex].y);
        expect(point.z).toBeCloseTo(before.path[pointIndex].z + MOVE_DELTA.z);
      });
    }

    // The OPEN 2D section view updates immediately (memoized §G.1 selector re-derives).
    const moved = requirePrimitives(store, sectionId);
    expect(moved).not.toBe(baseline);
    expect(moved.concreteOutlines).toHaveLength(1);
    const movedUs = moved.concreteOutlines[0].map((point) => point.u);
    expect(Math.min(...movedUs)).toBeCloseTo(baselineURange[0] + MOVE_DELTA.z);
    expect(Math.max(...movedUs)).toBeCloseTo(baselineURange[1] + MOVE_DELTA.z);
    expect(moved.cutBars).toHaveLength(BAR_HEIGHTS_MM.length);
    for (const [index, dot] of moved.cutBars.entries()) {
      expect(dot.center.u).toBeCloseTo(baseline.cutBars[index].center.u + MOVE_DELTA.z);
      expect(dot.center.v).toBeCloseTo(BAR_HEIGHTS_MM[index]);
      // The cover offset from the covered face survives the move exactly.
      expect(Math.max(...movedUs) - dot.center.u).toBeCloseTo(EXPECTED_CENTERLINE_OFFSET_MM);
    }

    // 5. ONE undo restores wall + bars to the pre-move state EXACTLY — the
    // exact frozen project reference returns, so the memoized selector hands
    // back the baseline primitives object itself.
    store.dispatch(undo());
    expect(store.getState().project).toBe(preMove);
    expect(requirePrimitives(store, sectionId)).toBe(baseline);

    // 6. Redo re-applies the move exactly.
    store.dispatch(redo());
    expect(store.getState().project).toBe(postMove);
    expect(requirePrimitives(store, sectionId)).toBe(moved);
  });
});

describe('M1 acceptance at reference scale (T5 fixture: 50 walls × 20 bars = 1,000 bars + 5 sections)', () => {
  it('moveElement: all 20 hosted bars follow in ONE command (one undo level), the open section re-derives, one undo restores all exactly, redo re-applies', () => {
    const { store, wallIds, barIds, sectionIds } = buildReferenceProject({
      createStore: createBenchmarkStore,
    });
    // Wall 0 sits in grid column 0 → section S-1 cuts it (10 outlines, 200 dots).
    const wallId = wallIds[0];
    const hostedBarIds = barIds.slice(0, REFERENCE_BARS_PER_WALL);
    const foreignBarId = barIds[REFERENCE_BARS_PER_WALL]; // wall 1's first bar
    const sectionId = sectionIds[0];
    store.dispatch(setActiveSection({ sectionId }));

    const baseline = requirePrimitives(store, sectionId);
    expect(baseline.concreteOutlines).toHaveLength(10);
    expect(baseline.cutBars).toHaveLength(200);
    const baselineOutlineUs = outlineUCenters(baseline);
    const baselineDotUs = baseline.cutBars.map((dot) => dot.center.u).sort((a, b) => a - b);

    const preMove = store.getState().project;
    const foreignBarBefore = preMove.reinforcement[foreignBarId];

    store.dispatch(moveElement({ elementId: wallId, delta: MOVE_DELTA }));

    // ONE undo level for the whole 21-action host-follow cascade (Q4-a): the
    // 1,055-command fixture build already filled the 30-level cap, and the
    // cascade's single recorded snapshot is the pre-move state itself (a
    // per-action recording would have left a mid-cascade state on top).
    const past = store.getState().undo.past;
    expect(past).toHaveLength(30);
    expect(past[past.length - 1]).toBe(preMove);

    const postMove = store.getState().project;
    // Wall + all 20 hosted bars translated; everything else untouched by identity.
    expect(postMove.elements[wallId].startPoint.z).toBeCloseTo(MOVE_DELTA.z);
    for (const barId of hostedBarIds) {
      const before = preMove.reinforcement[barId];
      const after = postMove.reinforcement[barId];
      expect(after).not.toBe(before);
      after.path.forEach((point, pointIndex) => {
        expect(point.z).toBeCloseTo(before.path[pointIndex].z + MOVE_DELTA.z);
      });
    }
    expect(postMove.reinforcement[foreignBarId]).toBe(foreignBarBefore);

    // The open section re-derives: the moved wall's outline and its 20 dots
    // shifted +300 in u, the other 9 walls' content untouched. (Wall 0 is the
    // lowest-u content and stays lowest after +300, so sorted order holds.)
    const moved = requirePrimitives(store, sectionId);
    expect(moved).not.toBe(baseline);
    expect(moved.concreteOutlines).toHaveLength(10);
    expect(moved.cutBars).toHaveLength(200);
    const movedOutlineUs = outlineUCenters(moved);
    expect(movedOutlineUs[0]).toBeCloseTo(baselineOutlineUs[0] + MOVE_DELTA.z);
    for (let index = 1; index < movedOutlineUs.length; index += 1) {
      expect(movedOutlineUs[index]).toBeCloseTo(baselineOutlineUs[index]);
    }
    const movedDotUs = moved.cutBars.map((dot) => dot.center.u).sort((a, b) => a - b);
    for (let index = 0; index < movedDotUs.length; index += 1) {
      const shift = index < REFERENCE_BARS_PER_WALL ? MOVE_DELTA.z : 0;
      expect(movedDotUs[index]).toBeCloseTo(baselineDotUs[index] + shift);
    }

    // One undo restores all 1,021 entities' relevant state exactly; redo re-applies.
    store.dispatch(undo());
    expect(store.getState().project).toBe(preMove);
    expect(requirePrimitives(store, sectionId)).toBe(baseline);
    store.dispatch(redo());
    expect(store.getState().project).toBe(postMove);
    expect(requirePrimitives(store, sectionId)).toBe(moved);
  });
});

describe('30 undo levels (§E)', () => {
  it('caps the edit history at 30 — oldest levels trimmed; 30 undos land exactly on the oldest retained snapshot; the 31st is a guarded no-op', () => {
    const store = createAppStore();
    const wallId = store.dispatch(placeWall(WALL_PARAMS));
    placeBarAtCover({ store, wallId, yMm: BAR_HEIGHTS_MM[0] });

    // 35 move edits on top of the 2 placement levels = 37 recorded levels;
    // the cap keeps the newest 30 (the placement levels + edits 1–5 pre-states
    // are trimmed).
    const EDIT_COUNT = 35;
    let afterFiveEdits = store.getState().project;
    for (let edit = 1; edit <= EDIT_COUNT; edit += 1) {
      const z = edit % 2 === 1 ? 100 : -100; // alternating non-zero deltas
      store.dispatch(moveElement({ elementId: wallId, delta: { x: 0, y: 0, z } }));
      if (edit === 5) afterFiveEdits = store.getState().project;
    }
    expect(store.getState().undo.past).toHaveLength(30);

    for (let step = 0; step < 30; step += 1) store.dispatch(undo());
    expect(store.getState().project).toBe(afterFiveEdits); // exact frozen reference
    expect(store.getState().undo.past).toHaveLength(0);

    // The 31st undo step is a guarded no-op with a status hint.
    store.dispatch(undo());
    expect(store.getState().project).toBe(afterFiveEdits);
    expect(store.getState().ui.cursorHint).toBe('Nothing to undo');
  });
});

interface ProbeFixture {
  store: ReturnType<typeof createAppStore>;
  wallId: string;
  barId: string;
  sectionId: string;
}

const STRAIGHT_BAR_PATH = [
  { x: 0, y: 500, z: 87 },
  { x: WALL_LENGTH_MM, y: 500, z: 87 },
];

/** Fresh wall + bar + section per probe — three recorded levels of history. */
const createProbeFixture = (): ProbeFixture => {
  const store = createAppStore();
  const wallId = store.dispatch(placeWall(WALL_PARAMS));
  const barId = store.dispatch(
    placeBar({ hostElementId: wallId, diameter: DEFAULT_BAR_DIAMETER_MM, path: STRAIGHT_BAR_PATH }),
  );
  const sectionId = store.dispatch(createSection(sectionParams(wallId)));
  return { store, wallId, barId, sectionId };
};

/** One dispatch per registry command against the probe fixture. */
const commandProbes: Record<CommandName, (fixture: ProbeFixture) => void> = {
  placeWall: ({ store }) => {
    store.dispatch(placeWall({ ...WALL_PARAMS, baseElevation: 3000 }));
  },
  placeBar: ({ store, wallId }) => {
    store.dispatch(placeBar({ hostElementId: wallId, diameter: 16, path: STRAIGHT_BAR_PATH }));
  },
  extendBar: ({ store, barId }) => {
    store.dispatch(extendBar({ barId, point: { x: WALL_LENGTH_MM, y: 1500, z: 87 } }));
  },
  createSection: ({ store, wallId }) => {
    store.dispatch(
      createSection({
        name: 'S-2',
        lineStart: { x: 1000, y: 0, z: -500 },
        lineEnd: { x: 1000, y: 0, z: 500 },
        depthPoint: { x: 3500, y: 0, z: 0 },
        targetElementIds: [wallId],
      }),
    );
  },
  reshapeSection: ({ store, sectionId }) => {
    store.dispatch(
      reshapeSection({
        sectionId,
        lineStart: { x: 1000, y: 0, z: -500 },
        lineEnd: { x: 1000, y: 0, z: 500 },
        depthPoint: { x: 3500, y: 0, z: 0 },
      }),
    );
  },
  setActiveSection: ({ store, sectionId }) => {
    store.dispatch(setActiveSection({ sectionId }));
  },
  moveElement: ({ store, wallId }) => {
    store.dispatch(moveElement({ elementId: wallId, delta: MOVE_DELTA }));
  },
  deleteBar: ({ store, barId }) => {
    store.dispatch(deleteBar({ id: barId }));
  },
  deleteElement: ({ store, wallId }) => {
    store.dispatch(deleteElement({ id: wallId }));
  },
  deleteSection: ({ store, sectionId }) => {
    store.dispatch(deleteSection({ sectionId }));
  },
  deleteSelection: ({ store, wallId }) => {
    store.dispatch(setSelection({ elementIds: [wallId], barIds: [] }));
    store.dispatch(deleteSelection());
  },
  undo: ({ store }) => {
    store.dispatch(undo());
  },
  redo: ({ store }) => {
    store.dispatch(redo());
  },
};

describe('every M0+M1 command is undoable (§E — the review-checklist row that was N/A in M0)', () => {
  it('probes cover EVERY registry command — a future command fails here until its undo behavior is decided', () => {
    expect(Object.keys(commandProbes).sort()).toEqual(Object.keys(commandRegistry).sort());
  });

  it('each project-mutating command records exactly ONE undo level and restores the exact pre-command reference on undo/redo', () => {
    const mutating: CommandName[] = [
      'placeWall',
      'placeBar',
      'extendBar',
      'createSection',
      'reshapeSection',
      'moveElement',
      'deleteBar',
      'deleteElement',
      'deleteSection',
      'deleteSelection',
    ];
    for (const name of mutating) {
      const fixture = createProbeFixture();
      const before = fixture.store.getState().project;
      const depthBefore = fixture.store.getState().undo.past.length;

      commandProbes[name](fixture);

      const after = fixture.store.getState().project;
      expect(after, name).not.toBe(before);
      expect(fixture.store.getState().undo.past, name).toHaveLength(depthBefore + 1);

      fixture.store.dispatch(undo());
      expect(fixture.store.getState().project, name).toBe(before); // exact frozen reference
      fixture.store.dispatch(redo());
      expect(fixture.store.getState().project, name).toBe(after);
    }
  });

  it('setActiveSection records no undo level — undo covers project state only (§E)', () => {
    const fixture = createProbeFixture();
    const depthBefore = fixture.store.getState().undo.past.length;
    const projectBefore = fixture.store.getState().project;

    commandProbes.setActiveSection(fixture);

    expect(fixture.store.getState().undo.past).toHaveLength(depthBefore);
    expect(fixture.store.getState().project).toBe(projectBefore);
    expect(fixture.store.getState().ui.activeSectionId).toBe(fixture.sectionId);
  });

  it('undo/redo themselves are never recorded', () => {
    const fixture = createProbeFixture();
    const depthBefore = fixture.store.getState().undo.past.length;
    const projectBefore = fixture.store.getState().project;

    commandProbes.undo(fixture);
    expect(fixture.store.getState().undo.past).toHaveLength(depthBefore - 1);
    expect(fixture.store.getState().undo.future).toHaveLength(1);

    commandProbes.redo(fixture);
    expect(fixture.store.getState().undo.past).toHaveLength(depthBefore);
    expect(fixture.store.getState().undo.future).toHaveLength(0);
    expect(fixture.store.getState().project).toBe(projectBefore);
  });
});
