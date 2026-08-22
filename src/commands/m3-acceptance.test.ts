// T8 — M3 acceptance pass (Architecture Spec §A, M3 plan section 8): the
// milestone acceptance sentences as durable headless tests, mirroring
// M0 T11 / M1 T6 / M2 T8. Sentences 1–4 restated from the task-level suites
// ("restate, don't reinvent" — the M2 T8 pattern): (1) group placement
// rule-exact + ONE undo level (T3's placement-group-commands.test.ts);
// (2) group edit/regenerate exact-restore (T3); (3) host-follow + detach
// (T5's move-bar.test.ts); (4) collision probe exact + non-blocking (T6's
// bar-clash.test.ts — the helpers are shared via test-utils.ts). Sentence 5
// (placement UX over a real DXF background) is the manual/author probe by
// definition — persisted as scenarios M3-T06…T26. Rule-exactness is asserted
// against the T2 engine output directly plus the T2-verified corpus numbers.
// The rule-by-rule audit + the milestone verdict table live in the T8 task
// log; the undo-per-command row is enforced by the registry-completeness
// probe in command-undo-probes.test.ts (all 25 commands — a new command
// fails it until its undo behavior is decided). Crosses the real WASM
// boundary (initWasmFromDisk — group placement is a WASM layout).
import { beforeAll, describe, expect, it } from 'vitest';
import {
  moveBar,
  moveElement,
  placeBar,
  placeBarGroup,
  placeWall,
  redo,
  undo,
  updatePlacementGroup,
} from '@/commands';
import { DEFAULT_STEEL_CATALOG } from '@/data/catalog/steel';
import { generateBarGroupPaths } from '@/engine/placement-group';
import { initWasmFromDisk } from '@/engine/wasm-test-init';
import { createAppStore } from '@/stores';
import { clashMap, clashPairKey, expectClashDistance, expectClashesSorted } from './test-utils';

beforeAll(initWasmFromDisk);

/** The M0 acceptance wall: 4000 × 200 × 2800 (x 0..4000, y −100..100, z 0..2800). */
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

interface GroupRule {
  coverMm: number;
  diameterMm: number;
  spacingMm: number;
  edgeStartMm: number;
  edgeEndMm: number;
  orientation: 'horizontal' | 'vertical';
}

interface ExpectedPathsOptions {
  store: ReturnType<typeof createAppStore>;
  wallId: string;
  rule: GroupRule;
}

/** Engine-expected paths for the CURRENT wall state and a rule — the
 *  command's output must equal the T2 orchestration's exactly (reads the
 *  live host, so post-move calls resolve against the moved face). */
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
    orientation: options.rule.orientation,
  });

const BASE_RULE: GroupRule = {
  coverMm: 25,
  diameterMm: 12,
  spacingMm: 150,
  edgeStartMm: 60,
  edgeEndMm: 60,
  orientation: 'horizontal',
};

const createStoreWithWall = () => {
  const store = createAppStore();
  const wallId = store.dispatch(placeWall(WALL_PARAMS));
  return { store, wallId };
};

describe('sentence 1 — group placement, rule-exact', () => {
  it('placeBarGroup lands the stored rule EXACTLY (count, centerlines, cover from ALL faces, host, ONE shared mark) — exactly ONE undo level removes group + bars; redo re-applies', () => {
    const { store, wallId } = createStoreWithWall();
    const prePlacement = store.getState().project;

    const { groupId, barIds } = store.dispatch(placeBarGroup(groupParams(wallId)));
    const project = store.getState().project;

    // Rule-exact: the count is derived from region/spacing/edges and every
    // centerline equals the T2 engine output exactly, in layout order.
    const expected = expectedPaths({ store, wallId, rule: BASE_RULE });
    expect(barIds).toHaveLength(18);
    barIds.forEach((barId, index) => {
      const bar = project.reinforcement[barId];
      expect(bar.path).toEqual(expected[index]);
      expect(bar.hostElementId).toBe(wallId);
      expect(bar.diameter).toBe(12);
      expect(bar.coverDistance).toBe(25); // catalog default for a wall host
      // Q7: ONE shared mark for ALL generated bars; the back-reference is set.
      expect(bar.barMark).toBe(1);
      expect(bar.placementGroupId).toBe(groupId);
    });
    // Cover kept from ALL element faces (the M0 applyConcreteCover clamp —
    // edges/start/end included): 31 mm off the captured face (cover 25 +
    // r6), the run-axis endpoints inset the cover exactly from the wall's
    // end faces (x = 25 … 3975), the position axis off the region edges.
    const first = project.reinforcement[barIds[0]].path;
    expect(first[0].x).toBeCloseTo(3975);
    expect(first[1].x).toBeCloseTo(25);
    expect(first[0].y).toBeCloseTo(69);
    expect(first[0].z).toBeCloseTo(60);
    expect(project.reinforcement[barIds[17]].path[0].z).toBeCloseTo(2610);

    // The stored rule (§F.2 revised) + membership in layout order; the
    // project mark counter advanced by exactly ONE for the whole group.
    const group = project.placementGroups[groupId];
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
    expect(project.nextBarMark).toBe(2);

    // Exactly ONE undo level removes group + bars (placeWall + placeBarGroup
    // = two levels of history); undo restores the exact pre-placement
    // reference, redo re-applies it.
    expect(store.getState().undo.past).toHaveLength(2);
    store.dispatch(undo());
    expect(store.getState().project).toBe(prePlacement);
    expect(store.getState().project.reinforcement).toEqual({});
    expect(store.getState().project.placementGroups).toEqual({});
    store.dispatch(redo());
    expect(store.getState().project).toBe(project);
  });
});

describe('sentence 2 — group edit/regenerate, exact-restore', () => {
  it('updatePlacementGroup regenerates to the NEW rule exactly (spacing, then cover + Ø + edges + orientation) — old bars gone, new bars rule-exact — ONE undo level per edit restores the pre-edit group AND its previous bars', () => {
    const { store, wallId } = createStoreWithWall();
    const { groupId, barIds: placedIds } = store.dispatch(placeBarGroup(groupParams(wallId)));
    const preEdit1 = store.getState().project;

    // Edit 1 — the spacing leg: 150 → 250 → 11 bars (the T2-verified count).
    const edit1 = store.dispatch(updatePlacementGroup({ groupId, patch: { barSpacing: 250 } }));
    const postEdit1 = store.getState().project;
    expect(edit1.groupId).toBe(groupId); // the group's identity survives
    expect(edit1.barIds).toHaveLength(11);
    for (const oldId of placedIds) expect(postEdit1.reinforcement[oldId]).toBeUndefined();
    const expected1 = expectedPaths({ store, wallId, rule: { ...BASE_RULE, spacingMm: 250 } });
    edit1.barIds.forEach((barId, index) => {
      const bar = postEdit1.reinforcement[barId];
      expect(bar.path).toEqual(expected1[index]);
      expect(bar.placementGroupId).toBe(groupId);
      expect(bar.barMark).toBe(1); // regenerate keeps the mark — none consumed
    });
    expect(postEdit1.nextBarMark).toBe(2);
    const preEdit2 = postEdit1;

    // Edit 2 — the sentence's remaining legs in one patch: cover, Ø, edge
    // distances, orientation (horizontal → vertical).
    const edit2 = store.dispatch(
      updatePlacementGroup({
        groupId,
        patch: {
          coverDistance: 40,
          barDiameter: 16,
          edgeDistanceStart: 100,
          edgeDistanceEnd: 100,
          orientation: 'vertical',
        },
      }),
    );
    const postEdit2 = store.getState().project;
    for (const oldId of edit1.barIds) expect(postEdit2.reinforcement[oldId]).toBeUndefined();
    const verticalRule: GroupRule = {
      coverMm: 40,
      diameterMm: 16,
      spacingMm: 250,
      edgeStartMm: 100,
      edgeEndMm: 100,
      orientation: 'vertical',
    };
    const expected2 = expectedPaths({ store, wallId, rule: verticalRule });
    // u = −1900 + k·250 ≤ 1900 → k = 0..15 → 16 bars.
    expect(edit2.barIds).toHaveLength(16);
    edit2.barIds.forEach((barId, index) => {
      const bar = postEdit2.reinforcement[barId];
      expect(bar.path).toEqual(expected2[index]);
      expect(bar.diameter).toBe(16);
      expect(bar.coverDistance).toBe(40);
      expect(bar.steelGrade).toBe(DEFAULT_STEEL_CATALOG.defaultGrade); // carried over
      expect(bar.placementGroupId).toBe(groupId);
      expect(bar.barMark).toBe(1);
    });
    // Vertical corpus spot-checks: positions step along u (x = 2000 − u):
    // first x = 3900, last x = 150; every centerline 48 mm off the captured
    // face (cover 40 + r8); run-axis endpoints inset the cover exactly.
    const vFirst = postEdit2.reinforcement[edit2.barIds[0]].path;
    expect(vFirst[0].x).toBeCloseTo(3900);
    expect(postEdit2.reinforcement[edit2.barIds[15]].path[0].x).toBeCloseTo(150);
    expect(vFirst[0].y).toBeCloseTo(52);
    expect(vFirst[1].y).toBeCloseTo(52);
    expect(Math.min(vFirst[0].z, vFirst[1].z)).toBeCloseTo(40);
    expect(Math.max(vFirst[0].z, vFirst[1].z)).toBeCloseTo(2760);
    expect(postEdit2.placementGroups[groupId]).toMatchObject({
      hostElementId: wallId,
      faceKey: 'face:posThickness',
      barMark: 1,
      barDiameter: 16,
      coverDistance: 40,
      barSpacing: 250,
      edgeDistanceStart: 100,
      edgeDistanceEnd: 100,
      orientation: 'vertical',
    });

    // ONE undo level per edit restores the exact pre-edit reference — the
    // pre-edit group AND its previous bars (the M1 exact-reference pattern).
    expect(store.getState().undo.past).toHaveLength(4); // wall + place + 2 edits
    store.dispatch(undo());
    expect(store.getState().project).toBe(preEdit2);
    expect(store.getState().project.reinforcement[edit1.barIds[0]]).toBeDefined();
    store.dispatch(undo());
    expect(store.getState().project).toBe(preEdit1);
    expect(store.getState().project.reinforcement[placedIds[0]]).toBeDefined();
    store.dispatch(redo());
    expect(store.getState().project).toBe(preEdit2);
    store.dispatch(redo());
    expect(store.getState().project).toBe(postEdit2);
  });
});

describe('sentence 3 — host-follow + detach', () => {
  it('moveElement carries the group bars (§E host-follow) and a post-move regenerate stays rule-exact against the moved face; moveBar detaches a member (Q6) and a regenerate refills its slot — ONE undo level per command, exact restore throughout', () => {
    const { store, wallId } = createStoreWithWall();
    const { groupId, barIds } = store.dispatch(placeBarGroup(groupParams(wallId)));
    const HOST_DELTA = { x: 0, y: 300, z: 0 };

    // (1) Host-follow: the group's bars translate with the host (§E revised).
    const preHostMove = store.getState().project;
    store.dispatch(moveElement({ elementId: wallId, delta: HOST_DELTA }));
    const preRegenerate = store.getState().project;
    for (const barId of barIds) {
      const before = preHostMove.reinforcement[barId].path;
      const after = preRegenerate.reinforcement[barId].path;
      after.forEach((point, index) => {
        expect(point).toEqual({ x: before[index].x, y: before[index].y + 300, z: before[index].z });
      });
    }
    // The stored rule is host-local — untouched by the move (Q3-a).
    expect(preRegenerate.placementGroups[groupId].region).toEqual(
      preHostMove.placementGroups[groupId].region,
    );

    // (2) A post-move regenerate is rule-exact against the MOVED face (the
    // Q3 host-local params make this free) — asserted against the T2 engine
    // output computed from the moved host.
    store.dispatch(updatePlacementGroup({ groupId, patch: { barSpacing: 250 } }));
    const postRegenerate = store.getState().project;
    const expected = expectedPaths({
      store,
      wallId,
      rule: { ...BASE_RULE, spacingMm: 250 },
    });
    const regeneratedIds = postRegenerate.placementGroups[groupId].bars;
    expect(regeneratedIds).toHaveLength(11);
    regeneratedIds.forEach((barId, index) => {
      expect(postRegenerate.reinforcement[barId].path).toEqual(expected[index]);
      // Cover kept from the moved faces: y = 300 + 100 − 31.
      expect(postRegenerate.reinforcement[barId].path[0].y).toBeCloseTo(369);
    });

    // (3) Detach one regenerated bar (Q6 — moving a group member breaks it
    // from the group), then a same-rule regenerate refills the vacated slot
    // (the stored rule is the group's truth); the detached bar stays where
    // the user put it, now independent.
    const detachedId = regeneratedIds[0];
    store.dispatch(moveBar({ barId: detachedId, delta: { x: 100, y: 0, z: 0 } }));
    const postDetach = store.getState().project;
    const preRefill = postDetach;
    expect(postDetach.placementGroups[groupId].bars).toHaveLength(10);
    expect(postDetach.reinforcement[detachedId].placementGroupId).toBeUndefined();
    expect(postDetach.reinforcement[detachedId].barMark).toBe(1); // mark kept
    const detachedPath = postDetach.reinforcement[detachedId].path;

    store.dispatch(updatePlacementGroup({ groupId, patch: { barSpacing: 250 } }));
    const postRefill = store.getState().project;
    expect(postRefill.placementGroups[groupId].bars).toHaveLength(11);
    expect(postRefill.placementGroups[groupId].bars).not.toContain(detachedId);
    expect(postRefill.reinforcement[detachedId].path).toEqual(detachedPath);

    // (4) The whole sequence unwinds ONE undo level per command — exact
    // frozen references all the way back (placeWall, placeBarGroup,
    // moveElement, regenerate, moveBar, regenerate = 6 levels).
    expect(store.getState().undo.past).toHaveLength(6);
    store.dispatch(undo());
    expect(store.getState().project).toBe(preRefill);
    store.dispatch(undo());
    expect(store.getState().project).toBe(postRegenerate);
    store.dispatch(undo());
    expect(store.getState().project).toBe(preRegenerate);
    store.dispatch(undo());
    expect(store.getState().project).toBe(preHostMove);
    store.dispatch(redo());
    expect(store.getState().project).toBe(preRegenerate);
  });
});

describe('sentence 4 — collision probe, exact + non-blocking', () => {
  it('a group placed over pre-existing individual bars flags EXACTLY the clashing pairs with exact distances — placement is NOT blocked (§K.4) and ONE undo level removes it', () => {
    const { store, wallId } = createStoreWithWall();
    // barA coincides with the group bar at z = 660 (distance 0); barB is
    // 8 mm from it (clash, exact); barC is 40 mm clear of the nearest group
    // bar (control — never reported). barA and barB ALSO clash with each
    // other (8 mm) — that pair touches no placed bar and must NOT appear.
    const placeIndividual = (zMm: number): string =>
      store.dispatch(
        placeBar({
          hostElementId: wallId,
          diameter: 12,
          path: [
            { x: 500, y: 69, z: zMm },
            { x: 3500, y: 69, z: zMm },
          ],
          coverDistance: 25,
        }),
      );
    const barA = placeIndividual(660);
    const barB = placeIndividual(668);
    const barC = placeIndividual(1000);
    const depthBefore = store.getState().undo.past.length;

    const result = store.dispatch(placeBarGroup(groupParams(wallId)));

    // Non-blocking: the group and all 18 bars landed.
    expect(result.barIds).toHaveLength(18);
    expect(store.getState().project.placementGroups[result.groupId]).toBeDefined();

    // The group bar at z = 660 is the 5th in layout order (z = 60 + 4·150).
    const groupBar660 = result.barIds[4];
    const clashes = clashMap(result.clashes);
    expect(clashes.size).toBe(2);
    expectClashDistance(clashes.get(clashPairKey(groupBar660, barA)), 0);
    expectClashDistance(clashes.get(clashPairKey(groupBar660, barB)), 8);
    // No false positives: the clean control appears in NO pair, and the
    // pre-existing barA↔barB clash (no group bar involved) is not reported.
    expect([...clashes.keys()].some((key) => key.includes(barC))).toBe(false);
    expect(clashes.has(clashPairKey(barA, barB))).toBe(false);
    expectClashesSorted(result.clashes);

    // ONE undo level removes the clashing placement entirely — nothing was
    // blocked, skipped, or auto-moved on the way in.
    expect(store.getState().undo.past).toHaveLength(depthBefore + 1);
    store.dispatch(undo());
    expect(store.getState().project.placementGroups[result.groupId]).toBeUndefined();
    expect(Object.keys(store.getState().project.reinforcement)).toHaveLength(3);
  });

  it('a second overlapping group flags every cross-group pair (18 × 8 mm); a clean group reports nothing', () => {
    const { store, wallId } = createStoreWithWall();
    const groupA = store.dispatch(placeBarGroup(groupParams(wallId)));
    expect(groupA.clashes).toEqual([]); // clean control: nothing to hit yet
    // Second group, same face, shifted 8 mm in z (edgeStart 68): every B bar
    // sits 8 mm from its A counterpart — 18 exact pairs.
    const groupB = store.dispatch(
      placeBarGroup({ ...groupParams(wallId), edgeDistanceStart: 68, edgeDistanceEnd: 60 }),
    );
    expect(groupB.barIds).toHaveLength(18);
    expect(groupB.clashes).toHaveLength(18);
    const setA = new Set(groupA.barIds);
    const setB = new Set(groupB.barIds);
    for (const clash of groupB.clashes) {
      expectClashDistance(clash.minDistanceMm, 8);
      // Every pair is one A bar × one B bar.
      const ids = [clash.barIdA, clash.barIdB];
      expect(ids.filter((id) => setA.has(id))).toHaveLength(1);
      expect(ids.filter((id) => setB.has(id))).toHaveLength(1);
    }
    // Each B bar clashes exactly once.
    expect(
      new Set(groupB.clashes.flatMap((clash) => [clash.barIdA, clash.barIdB]).filter((id) => setB.has(id)))
        .size,
    ).toBe(18);
    expectClashesSorted(groupB.clashes);
  });
});
