// T3 — §N group commands (M3 plan section 3): placeBarGroup /
// updatePlacementGroup / deletePlacementGroup. The milestone acceptance
// sentences 1 + 2 live here headless: (1) rule-exact group placement — count
// derived from region/spacing/edges, centerline positions exact, cover kept
// from ALL element faces, hostElementId + ONE shared barMark per Q7-a — with
// exactly ONE undo level removing group + bars and redo re-applying; (2)
// param edit → regenerate to the NEW rule exactly, ONE undo level restoring
// the pre-edit group AND its previous bars (exact-reference, the M1 pattern).
// Rule-exactness is asserted against the T2 engine output directly (the
// command must pass the rule through untouched) plus spot-checked numbers
// from the T2-verified corpus. Crosses the real WASM boundary
// (initWasmFromDisk).
import { beforeAll, describe, expect, it } from 'vitest';
import {
  deleteElement,
  deletePlacementGroup,
  placeBar,
  placeBarGroup,
  placeWall,
  redo,
  undo,
  updatePlacementGroup,
} from '@/commands';
import { DEFAULT_STEEL_CATALOG } from '@/data/catalog/steel';
import type { ElementFaceKey } from '@/data/models';
import { generateBarGroupPaths } from '@/engine/placement-group';
import { initWasmFromDisk } from '@/engine/wasm-test-init';
import { createAppStore } from '@/stores';
import { setSelection } from '@/stores/ui-slice';
import { expectCommandError } from './test-utils';

beforeAll(initWasmFromDisk);

/** The M0 acceptance wall: 4000 × 200 × 2800. */
const WALL_PARAMS = {
  startPoint: { x: 0, y: 0, z: 0 },
  endPoint: { x: 4000, y: 0, z: 0 },
  thickness: 200,
  height: 2800,
};

/** Full posThickness face (the T2 test corpus: u ±2000, v ±1400). */
const FULL_FACE_REGION = { uMin: -2000, uMax: 2000, vMin: -1400, vMax: 1400 };

/** The T2-verified rule: horizontal Ø12 @ 150, 25 mm cover, 60 mm edges →
 *  18 bars, first (3975, 69, 60) → (25, 69, 60), last at z = 2610. */
const groupParams = (wallId: string) => ({
  hostElementId: wallId,
  faceKey: 'face:posThickness' as const,
  region: FULL_FACE_REGION,
  diameter: 12,
  barSpacing: 150,
  edgeDistanceStart: 60,
  edgeDistanceEnd: 60,
  orientation: 'horizontal' as const,
});

const EXPECTED_BAR_COUNT = 18;

const createStoreWithWall = () => {
  const store = createAppStore();
  const wallId = store.dispatch(placeWall(WALL_PARAMS));
  return { store, wallId };
};

interface ExpectedPathsOptions {
  store: ReturnType<typeof createAppStore>;
  wallId: string;
  rule: { coverMm: number; diameterMm: number; spacingMm: number; edgeStartMm: number; edgeEndMm: number };
}

/** Engine-expected paths for the current wall state and a rule — the
 *  command's output must equal the T2 orchestration's exactly. */
const expectedPaths = (options: ExpectedPathsOptions) =>
  generateBarGroupPaths({
    host: options.store.getState().project.elements[options.wallId],
    faceKey: 'face:posThickness',
    region: FULL_FACE_REGION,
    coverMm: options.rule.coverMm,
    diameterMm: options.rule.diameterMm,
    spacingMm: options.rule.spacingMm,
    edgeDistanceStartMm: options.rule.edgeStartMm,
    edgeDistanceEndMm: options.rule.edgeEndMm,
    orientation: 'horizontal',
  });

describe('placeBarGroup (milestone acceptance sentence 1)', () => {
  it('places the group rule-exactly — count/positions/cover/host/ONE shared mark — in exactly ONE undo level; redo re-applies', () => {
    const { store, wallId } = createStoreWithWall();
    const prePlacement = store.getState().project;

    const { groupId, barIds } = store.dispatch(placeBarGroup(groupParams(wallId)));
    const postPlacement = store.getState().project;

    // Rule-exact: count derived from region/spacing/edges; centerline
    // positions identical to the T2 engine output, in layout order.
    const expected = expectedPaths({
      store,
      wallId,
      rule: { coverMm: 25, diameterMm: 12, spacingMm: 150, edgeStartMm: 60, edgeEndMm: 60 },
    });
    expect(barIds).toHaveLength(EXPECTED_BAR_COUNT);
    barIds.forEach((barId, index) => {
      const bar = postPlacement.reinforcement[barId];
      expect(bar.path).toEqual(expected[index]);
      expect(bar.hostElementId).toBe(wallId);
      expect(bar.diameter).toBe(12);
      expect(bar.coverDistance).toBe(25); // catalog default for a wall host
      expect(bar.steelGrade).toBe(DEFAULT_STEEL_CATALOG.defaultGrade);
      // Q7-a: ONE shared mark for ALL generated bars; the back-reference is set.
      expect(bar.barMark).toBe(1);
      expect(bar.placementGroupId).toBe(groupId);
    });
    // Spot-checks from the T2 corpus: cover kept from ALL faces (captured
    // face y = 100 − 31; region/run edges inset by cover semantics).
    const first = postPlacement.reinforcement[barIds[0]].path;
    expect(first[0].x).toBeCloseTo(3975);
    expect(first[1].x).toBeCloseTo(25);
    expect(first[0].y).toBeCloseTo(69);
    expect(first[0].z).toBeCloseTo(60);
    expect(postPlacement.reinforcement[barIds[EXPECTED_BAR_COUNT - 1]].path[0].z).toBeCloseTo(2610);

    // The stored rule (§F.2 revised) + membership in layout order; the
    // counter advanced by exactly ONE for the whole group.
    const group = postPlacement.placementGroups[groupId];
    expect(group).toMatchObject({
      hostElementId: wallId,
      faceKey: 'face:posThickness',
      region: FULL_FACE_REGION,
      barMark: 1,
      barDiameter: 12,
      coverDistance: 25,
      barSpacing: 150,
      edgeDistanceStart: 60,
      edgeDistanceEnd: 60,
      orientation: 'horizontal',
    });
    expect(group.bars).toEqual(barIds);
    expect(postPlacement.nextBarMark).toBe(2);

    // Exactly ONE undo level removes group + bars (placeWall + placeBarGroup
    // = two levels of history); undo restores the exact pre-placement
    // reference, redo re-applies it.
    expect(store.getState().undo.past).toHaveLength(2);
    store.dispatch(undo());
    expect(store.getState().project).toBe(prePlacement);
    expect(store.getState().project.reinforcement).toEqual({});
    expect(store.getState().project.placementGroups).toEqual({});
    expect(store.getState().project.nextBarMark).toBe(1);
    store.dispatch(redo());
    expect(store.getState().project).toBe(postPlacement);
  });

  it('marks sequence with individuals: a group consumes exactly ONE mark between individual placements', () => {
    const { store, wallId } = createStoreWithWall();
    const path = [
      { x: 0, y: 87, z: 500 },
      { x: 4000, y: 87, z: 500 },
    ];
    const firstIndividual = store.dispatch(placeBar({ hostElementId: wallId, diameter: 12, path }));
    const { barIds } = store.dispatch(placeBarGroup(groupParams(wallId)));
    const secondIndividual = store.dispatch(placeBar({ hostElementId: wallId, diameter: 12, path }));

    const project = store.getState().project;
    expect(project.reinforcement[firstIndividual].barMark).toBe(1);
    for (const barId of barIds) expect(project.reinforcement[barId].barMark).toBe(2);
    expect(project.reinforcement[secondIndividual].barMark).toBe(3);
    expect(project.nextBarMark).toBe(4);
  });

  it('keeps an explicit cover in the stored rule and the generated bars', () => {
    const { store, wallId } = createStoreWithWall();
    const { groupId, barIds } = store.dispatch(placeBarGroup({ ...groupParams(wallId), coverDistance: 40 }));
    const project = store.getState().project;
    expect(project.placementGroups[groupId].coverDistance).toBe(40);
    // Inward from the captured face: y = 100 − (40 + 6).
    expect(project.reinforcement[barIds[0]].path[0].y).toBeCloseTo(54);
    expect(project.reinforcement[barIds[0]].coverDistance).toBe(40);
  });

  it('rejects invalid input through the CommandError doorway and records nothing', () => {
    const { store, wallId } = createStoreWithWall();
    const base = groupParams(wallId);

    expectCommandError(() => store.dispatch(placeBarGroup(groupParams('no-such-wall'))), 'NOT_FOUND');
    expectCommandError(
      () => store.dispatch(placeBarGroup({ ...base, faceKey: 'face:sideways' as ElementFaceKey })),
      'INVALID_PARAMS',
    );
    expectCommandError(() => store.dispatch(placeBarGroup({ ...base, diameter: 15 })), 'INVALID_PARAMS');
    expectCommandError(
      () => store.dispatch(placeBarGroup({ ...base, orientation: 'diagonal' as 'horizontal' })),
      'INVALID_PARAMS',
    );
    expectCommandError(() => store.dispatch(placeBarGroup({ ...base, coverDistance: 0 })), 'INVALID_PARAMS');
    // The T2 orchestration's validation Errors map to INVALID_PARAMS.
    expectCommandError(() => store.dispatch(placeBarGroup({ ...base, barSpacing: 0 })), 'INVALID_PARAMS');
    expectCommandError(() => store.dispatch(placeBarGroup({ ...base, barSpacing: -150 })), 'INVALID_PARAMS');
    expectCommandError(
      () => store.dispatch(placeBarGroup({ ...base, edgeDistanceStart: 2000, edgeDistanceEnd: 1000 })),
      'INVALID_PARAMS',
    );
    expectCommandError(
      () => store.dispatch(placeBarGroup({ ...base, region: { uMin: 10, uMax: 10, vMin: 0, vMax: 100 } })),
      'INVALID_PARAMS',
    );
    // Cover + radius ≥ thickness/2 — a bar that physically cannot sit.
    expectCommandError(() => store.dispatch(placeBarGroup({ ...base, coverDistance: 95 })), 'INVALID_PARAMS');

    const project = store.getState().project;
    expect(project.reinforcement).toEqual({});
    expect(project.placementGroups).toEqual({});
    expect(project.nextBarMark).toBe(1);
    expect(store.getState().undo.past).toHaveLength(1); // placeWall only
  });
});

describe('updatePlacementGroup (milestone acceptance sentence 2)', () => {
  it('regenerates to the NEW rule exactly — old bars gone, new bars rule-exact — ONE undo restores the pre-edit group AND its previous bars', () => {
    const { store, wallId } = createStoreWithWall();
    const { groupId, barIds: oldBarIds } = store.dispatch(placeBarGroup(groupParams(wallId)));
    const preEdit = store.getState().project;
    const depthBefore = store.getState().undo.past.length;

    const { groupId: sameId, barIds: newBarIds } = store.dispatch(
      updatePlacementGroup({ groupId, patch: { barSpacing: 250 } }),
    );
    const postEdit = store.getState().project;

    expect(sameId).toBe(groupId); // the group's identity survives regenerate
    // k: −1340 + k·250 ≤ 1340 → 11 bars.
    expect(newBarIds).toHaveLength(11);
    for (const oldId of oldBarIds) expect(postEdit.reinforcement[oldId]).toBeUndefined();
    const expected = expectedPaths({
      store,
      wallId,
      rule: { coverMm: 25, diameterMm: 12, spacingMm: 250, edgeStartMm: 60, edgeEndMm: 60 },
    });
    newBarIds.forEach((barId, index) => {
      const bar = postEdit.reinforcement[barId];
      expect(bar.path).toEqual(expected[index]);
      expect(bar.placementGroupId).toBe(groupId);
      expect(bar.barMark).toBe(1); // the group keeps its mark — none consumed
      expect(bar.steelGrade).toBe(DEFAULT_STEEL_CATALOG.defaultGrade);
    });
    expect(postEdit.reinforcement[newBarIds[0]].path[0].z).toBeCloseTo(60);
    expect(postEdit.reinforcement[newBarIds[10]].path[0].z).toBeCloseTo(2560);

    const group = postEdit.placementGroups[groupId];
    expect(group.barSpacing).toBe(250);
    expect(group.bars).toEqual(newBarIds);
    expect(group.barMark).toBe(1);
    expect(postEdit.nextBarMark).toBe(2);

    // ONE undo level restores the pre-edit group AND its previous bars
    // exactly (exact frozen reference, the M1 pattern); redo re-applies.
    expect(store.getState().undo.past).toHaveLength(depthBefore + 1);
    store.dispatch(undo());
    expect(store.getState().project).toBe(preEdit);
    expect(store.getState().project.reinforcement[oldBarIds[0]]).toBeDefined();
    expect(store.getState().project.placementGroups[groupId].barSpacing).toBe(150);
    store.dispatch(redo());
    expect(store.getState().project).toBe(postEdit);
  });

  it('merges a partial patch command-side: only the patched fields change; the group keeps mark and grade', () => {
    const { store, wallId } = createStoreWithWall();
    const { groupId } = store.dispatch(placeBarGroup(groupParams(wallId)));

    const { barIds } = store.dispatch(
      updatePlacementGroup({ groupId, patch: { coverDistance: 40, edgeDistanceStart: 100 } }),
    );
    const project = store.getState().project;
    const group = project.placementGroups[groupId];
    expect(group.coverDistance).toBe(40);
    expect(group.edgeDistanceStart).toBe(100);
    expect(group.barSpacing).toBe(150); // untouched rule fields survive
    expect(group.barDiameter).toBe(12);
    expect(group.barMark).toBe(1);
    expect(barIds).toHaveLength(EXPECTED_BAR_COUNT);
    const first = project.reinforcement[barIds[0]];
    expect(first.coverDistance).toBe(40);
    expect(first.path[0].y).toBeCloseTo(54); // 100 − (40 + 6)
    expect(first.path[0].z).toBeCloseTo(100); // the new start edge distance
    expect(project.nextBarMark).toBe(2);
  });

  it('validates the merged rule like placement and records nothing on rejection', () => {
    const { store, wallId } = createStoreWithWall();
    const { groupId } = store.dispatch(placeBarGroup(groupParams(wallId)));
    const before = store.getState().project;

    expectCommandError(
      () => store.dispatch(updatePlacementGroup({ groupId: 'no-such-group', patch: { barSpacing: 200 } })),
      'NOT_FOUND',
    );
    expectCommandError(
      () => store.dispatch(updatePlacementGroup({ groupId, patch: { barDiameter: 15 } })),
      'INVALID_PARAMS',
    );
    expectCommandError(
      () => store.dispatch(updatePlacementGroup({ groupId, patch: { barSpacing: 0 } })),
      'INVALID_PARAMS',
    );
    expectCommandError(
      () => store.dispatch(updatePlacementGroup({ groupId, patch: { coverDistance: 95 } })),
      'INVALID_PARAMS',
    );
    expectCommandError(
      () =>
        store.dispatch(
          updatePlacementGroup({ groupId, patch: { region: { uMin: 0, uMax: 0, vMin: 0, vMax: 100 } } }),
        ),
      'INVALID_PARAMS',
    );

    // Rejected edits changed nothing — not even a state reference.
    expect(store.getState().project).toBe(before);
    expect(store.getState().undo.past).toHaveLength(2); // placeWall + placeBarGroup
  });

  it('guards a group whose host is gone (the deleteElement cascade keeps dependent records — the sections precedent)', () => {
    const { store, wallId } = createStoreWithWall();
    const { groupId } = store.dispatch(placeBarGroup(groupParams(wallId)));

    store.dispatch(deleteElement({ id: wallId }));
    // The group's bars cascaded away with the host; the rule record survives
    // (recorded T3 decision — the sections precedent) but can never regenerate.
    expect(store.getState().project.reinforcement).toEqual({});
    expect(store.getState().project.placementGroups[groupId]).toBeDefined();
    expectCommandError(
      () => store.dispatch(updatePlacementGroup({ groupId, patch: { barSpacing: 200 } })),
      'NOT_FOUND',
    );
  });
});

describe('deletePlacementGroup', () => {
  it('default removes the group AND its bars (the deleteElement cascade precedent), prunes the selection — ONE undo level restores all exactly', () => {
    const { store, wallId } = createStoreWithWall();
    const { groupId, barIds } = store.dispatch(placeBarGroup(groupParams(wallId)));
    store.dispatch(setSelection({ elementIds: [], barIds: [barIds[0], barIds[5]] }));
    const preDelete = store.getState().project;
    const depthBefore = store.getState().undo.past.length;

    store.dispatch(deletePlacementGroup({ groupId }));
    const postDelete = store.getState().project;

    expect(postDelete.placementGroups).toEqual({});
    for (const barId of barIds) expect(postDelete.reinforcement[barId]).toBeUndefined();
    expect(store.getState().ui.selection.barIds).toEqual([]);

    expect(store.getState().undo.past).toHaveLength(depthBefore + 1);
    store.dispatch(undo());
    expect(store.getState().project).toBe(preDelete); // group + bars exactly back
    store.dispatch(redo());
    expect(store.getState().project).toBe(postDelete);
  });

  it('removeBars: false detaches all bars to individuals — positions and shared mark kept, handle cleared — ONE undo restores membership', () => {
    const { store, wallId } = createStoreWithWall();
    const { groupId, barIds } = store.dispatch(placeBarGroup(groupParams(wallId)));
    const preDelete = store.getState().project;

    store.dispatch(deletePlacementGroup({ groupId, removeBars: false }));
    const postDelete = store.getState().project;

    expect(postDelete.placementGroups).toEqual({});
    expect(Object.keys(postDelete.reinforcement)).toHaveLength(EXPECTED_BAR_COUNT);
    for (const barId of barIds) {
      const bar = postDelete.reinforcement[barId];
      expect(bar).toBeDefined();
      expect(bar.placementGroupId).toBeUndefined(); // now an individual
      expect(bar.barMark).toBe(1); // the shared mark survives the detach
      expect(bar.path).toEqual(preDelete.reinforcement[barId].path); // unmoved
    }

    store.dispatch(undo());
    expect(store.getState().project).toBe(preDelete); // membership + handle exactly back
    store.dispatch(redo());
    expect(store.getState().project).toBe(postDelete);
  });

  it('rejects an unknown group id and records nothing', () => {
    const { store, wallId } = createStoreWithWall();
    store.dispatch(placeBarGroup(groupParams(wallId)));
    const before = store.getState().project;
    expectCommandError(() => store.dispatch(deletePlacementGroup({ groupId: 'ghost' })), 'NOT_FOUND');
    expect(store.getState().project).toBe(before);
    expect(store.getState().undo.past).toHaveLength(2);
  });
});
