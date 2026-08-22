// M3 T7 — performance probes at reference scale WITH GROUPS (M3 plan §7):
//  (i)   group regenerate dispatch — the scheduled F3 revisit, now with the
//        T1 batch reducers AND the T6 Q8 prospective clash check riding
//        inside the command (the 100 ms F3 tripwire stays armed);
//  (ii)  collision check at 1,000 bars — the T6 gate shape (~24 ms through
//        the boundary on the 1,002-bar corpus, T6 task log) gets its armed
//        tripwire: the engine call standalone AND the §K.1 on-demand
//        checkBarClashes command dispatch (the T6 review amendment — both);
//  (iii) section recompute with group bars — the M1 §5 full-recompute probe
//        re-run at reference+groups (the 16 ms budget stays armed);
//  (iv)  per-bar-mesh render cost — the §L.1 InstancedMesh door's evidence
//        task: measure and REPORT (NO optimization — the scope line: M3
//        measures, a budget breach escalates to the author, the F3 loop).
// Same harness as M1 T5: production middleware set (createBenchmarkStore —
// the dev-only RTK invariant checks cost ~170 ms/dispatch at this scale),
// medians over 12 runs after 3 warm-ups, generous regression tripwires at
// measured-safe margins — never tightened budgets. Measured numbers land in
// the M3 tracker T7 task log (console.info output below).
import { beforeAll, describe, expect, it } from 'vitest';
import { checkBarClashes, moveElement, updatePlacementGroup } from '@/commands';
import { createBenchmarkStore, timingStats } from '@/commands/performance-probes';
import {
  type GroupReferenceProject,
  REFERENCE_GROUP_BAR_COUNT,
  REFERENCE_GROUP_SPACING_MM,
  REFERENCE_SECTION_COUNT,
  REFERENCE_WALL_COUNT,
  buildGroupReferenceProject,
  buildReferenceProject,
} from '@/commands/reference-project';
import type { ReinforcementBar } from '@/data/models';
import { createBarGeometry } from '@/engine/bar-geometry';
import { findBarClashes } from '@/engine/collision';
import { selectSectionPrimitives } from '@/engine/sectioning';
import { initWasmFromDisk } from '@/engine/wasm-test-init';

beforeAll(initWasmFromDisk);

/** §5 frame budget (M1 T5) — the derived-data recompute after an edit must
 *  fit 60 FPS; stays armed for the group-bars re-run (probe iii). */
const FRAME_BUDGET_MS = 16;
/** F3 dispatch tripwire (M1 T5) — stays armed for the revisit. It catches
 *  regressions BEYOND the current architecture's cost class, never a budget
 *  tightening: a breach escalates to the author (the F3 loop). */
const DISPATCH_TRIPWIRE_MS = 100;
/** Clash-check tripwire — T6 measured ~24 ms through the full WASM/TS
 *  boundary at 1,002 bars (T6 task log; ~4.4 ms native release). 100 ms is a
 *  ~4× regression alarm at a measured-safe margin. */
const CLASH_CHECK_TRIPWIRE_MS = 100;
/** Probe (iv) is REPORT-FIRST — no budget exists (§L stays watch-only in
 *  M3): the assertion is a coarse regression alarm only, NOT a budget. */
const MESH_REBUILD_TRIPWIRE_MS = 500;

const WARMUP_RUNS = 3;
const TIMED_RUNS = 12;
/** Same small alternating plan delta as M1 T5 — every run is a real move
 *  (state changes), but the wall stays inside its section band. */
const MOVE_DELTA_MM = 8;

describe('M3 T7 — group-built reference project (50 walls × 1 group × 20 bars)', () => {
  it('builds at the expected scale through the §N commands', { timeout: 120_000 }, () => {
    const startedAt = performance.now();
    const project = buildGroupReferenceProject({ createStore: createBenchmarkStore });
    const buildMs = performance.now() - startedAt;
    const state = project.store.getState();
    expect(Object.keys(state.project.elements)).toHaveLength(REFERENCE_WALL_COUNT);
    expect(Object.keys(state.project.placementGroups)).toHaveLength(REFERENCE_WALL_COUNT);
    expect(Object.keys(state.project.reinforcement)).toHaveLength(
      REFERENCE_WALL_COUNT * REFERENCE_GROUP_BAR_COUNT,
    );
    expect(Object.keys(state.project.sections)).toHaveLength(REFERENCE_SECTION_COUNT);
    // Every bar is group-owned (Q6 handle), shares its group's ONE mark
    // (Q7-a), and is a rule-generated straight 2-point path.
    for (const groupId of project.groupIds) {
      const group = state.project.placementGroups[groupId];
      expect(group.bars).toHaveLength(REFERENCE_GROUP_BAR_COUNT);
      for (const barId of group.bars) {
        const bar = state.project.reinforcement[barId];
        expect(bar.placementGroupId).toBe(groupId);
        expect(bar.barMark).toBe(group.barMark);
        expect(bar.path).toHaveLength(2);
      }
    }
    // The open section cuts its whole column: 10 outlines, 10 × 20 = 200 dots.
    const primitives = selectSectionPrimitives(state, project.sectionIds[0]);
    expect(primitives?.concreteOutlines).toHaveLength(10);
    expect(primitives?.cutBars).toHaveLength(10 * REFERENCE_GROUP_BAR_COUNT);
    console.info(
      `[T7 fixture] group-built reference project: 105 §N commands ` +
        `(50 placeWall + 50 placeBarGroup incl. Q8 checks + 5 createSection) in ${buildMs.toFixed(0)} ms`,
    );
  });
});

describe('M3 T7 probe (i) — group regenerate dispatch (the scheduled F3 revisit)', () => {
  it('updatePlacementGroup at reference scale stays inside the 100 ms tripwire', { timeout: 120_000 }, () => {
    const project = buildGroupReferenceProject({ createStore: createBenchmarkStore });
    const { store, groupIds } = project;
    const groupId = groupIds[0];

    // Alternating spacing patch: every run is a REAL regenerate (20 ↔ 18
    // bars). Each dispatch = the T2 layout + the Q8 prospective clash check
    // over the ~1,000-bar model + the T1 batch reducers (removeBars /
    // addBars / group) + the undo snapshot — the full F3 cost class measured
    // as ONE dispatch (the standalone clash cost is split out in probe (ii)).
    const regenerate = (runIndex: number): number => {
      const barSpacing = runIndex % 2 === 0 ? 150 : REFERENCE_GROUP_SPACING_MM;
      const startedAt = performance.now();
      const result = store.dispatch(updatePlacementGroup({ groupId, patch: { barSpacing } }));
      const elapsedMs = performance.now() - startedAt;
      expect(result.clashes).toEqual([]);
      return elapsedMs;
    };

    for (let run = 0; run < WARMUP_RUNS; run++) regenerate(run);
    const runsMs: number[] = [];
    for (let run = 0; run < TIMED_RUNS; run++) runsMs.push(regenerate(WARMUP_RUNS + run));
    const dispatch = timingStats(runsMs);

    // The group stays consistent through the regenerates (no orphan ids).
    const group = store.getState().project.placementGroups[groupId];
    expect(group.bars.length).toBeGreaterThan(0);
    for (const barId of group.bars) {
      expect(store.getState().project.reinforcement[barId]).toBeDefined();
    }

    console.info(
      [
        '[T7 (i) group regenerate dispatch @ 50 groups × 20 bars = 1,000 bars — F3 revisit]',
        '  updatePlacementGroup dispatch (T2 layout + Q8 prospective clash check + T1 batch reducers + undo snapshot):',
        `    median ${dispatch.medianMs.toFixed(2)} ms (min ${dispatch.minMs.toFixed(2)}, max ${dispatch.maxMs.toFixed(2)}) — F3 tripwire ${DISPATCH_TRIPWIRE_MS} ms`,
      ].join('\n'),
    );

    expect(dispatch.medianMs).toBeLessThan(DISPATCH_TRIPWIRE_MS);
  });
});

describe('M3 T7 probe (ii) — collision check at 1,000 bars (the T6 gate shape, armed)', () => {
  it(
    'engine call AND on-demand checkBarClashes dispatch stay inside the tripwire',
    { timeout: 120_000 },
    () => {
      const project = buildGroupReferenceProject({ createStore: createBenchmarkStore });
      const { store } = project;
      const bars = Object.values(store.getState().project.reinforcement);
      expect(bars).toHaveLength(REFERENCE_WALL_COUNT * REFERENCE_GROUP_BAR_COUNT);
      const involvingIds = bars.map((bar) => bar.id);

      // (a) The engine call standalone (JS flatten + WASM all-pairs-with-
      // prefilter + deterministic report) — the T6 gate shape on a REAL model.
      const engineRun = (): number => {
        const startedAt = performance.now();
        const clashes = findBarClashes({ bars, involvingIds });
        const elapsedMs = performance.now() - startedAt;
        expect(clashes).toEqual([]); // the reference model is clash-free
        return elapsedMs;
      };
      for (let run = 0; run < WARMUP_RUNS; run++) engineRun();
      const engineRunsMs: number[] = [];
      for (let run = 0; run < TIMED_RUNS; run++) engineRunsMs.push(engineRun());
      const engine = timingStats(engineRunsMs);

      // (b) The §K.1 on-demand command dispatch (T6 review amendment) — the
      // engine over the implicit active layer (all model bars) + the
      // warning-layer surfacing; read-only, zero undo levels.
      const undoDepthBefore = store.getState().undo.past.length;
      const commandRun = (): number => {
        const startedAt = performance.now();
        const result = store.dispatch(checkBarClashes());
        const elapsedMs = performance.now() - startedAt;
        expect(result.checkedCount).toBe(bars.length);
        expect(result.clashes).toEqual([]);
        return elapsedMs;
      };
      for (let run = 0; run < WARMUP_RUNS; run++) commandRun();
      const commandRunsMs: number[] = [];
      for (let run = 0; run < TIMED_RUNS; run++) commandRunsMs.push(commandRun());
      const command = timingStats(commandRunsMs);
      // The on-demand check stays read-only (zero undo levels) under repetition.
      expect(store.getState().undo.past).toHaveLength(undoDepthBefore);

      console.info(
        [
          '[T7 (ii) collision check @ 1,000 group-owned bars — T6 tripwire armed]',
          '  findBarClashes engine call (flatten + WASM all-pairs-with-prefilter + report):',
          `    median ${engine.medianMs.toFixed(2)} ms (min ${engine.minMs.toFixed(2)}, max ${engine.maxMs.toFixed(2)}) — tripwire ${CLASH_CHECK_TRIPWIRE_MS} ms`,
          '  checkBarClashes command dispatch (engine + surfacing, read-only):',
          `    median ${command.medianMs.toFixed(2)} ms (min ${command.minMs.toFixed(2)}, max ${command.maxMs.toFixed(2)}) — tripwire ${CLASH_CHECK_TRIPWIRE_MS} ms`,
          '  T6 gate record (2026-08-22): ~4.4 ms native release / ~24 ms boundary on the 1,002-bar corpus',
        ].join('\n'),
      );

      expect(engine.medianMs).toBeLessThan(CLASH_CHECK_TRIPWIRE_MS);
      expect(command.medianMs).toBeLessThan(CLASH_CHECK_TRIPWIRE_MS);
    },
  );
});

interface FrameTiming {
  dispatchMs: number;
  openSectionMs: number;
  allSectionsMs: number;
  meshMs: number;
}

/** One full edit frame at reference+groups scale — the M1 T5 §5 frame re-run
 *  on group-owned bars: moveElement (wall + its group's 20 bars, §E
 *  host-follow) → memoized selectSectionPrimitives recompute (the OPEN
 *  section + all 5 as a conservative bound) → createBarGeometry per changed
 *  bar (what BarMesh's useMemo rebuilds on bar object identity change). */
const runGroupEditFrame = (project: GroupReferenceProject, runIndex: number): FrameTiming => {
  const { store, wallIds, groupIds, sectionIds } = project;
  const sign = runIndex % 2 === 0 ? 1 : -1;

  const t0 = performance.now();
  store.dispatch(moveElement({ elementId: wallIds[0], delta: { x: 0, y: 0, z: sign * MOVE_DELTA_MM } }));
  const t1 = performance.now();

  const state = store.getState();
  // The open section is the one cutting the moved wall (column 0).
  const openPrimitives = selectSectionPrimitives(state, sectionIds[0]);
  expect(openPrimitives?.concreteOutlines).toHaveLength(10);
  expect(openPrimitives?.cutBars).toHaveLength(10 * REFERENCE_GROUP_BAR_COUNT);
  const t2 = performance.now();

  for (const sectionId of sectionIds) {
    expect(selectSectionPrimitives(state, sectionId)).not.toBeNull();
  }
  const t3 = performance.now();

  const changedBarIds = state.project.placementGroups[groupIds[0]].bars;
  const geometries = changedBarIds.map((barId) => {
    const bar = state.project.reinforcement[barId];
    return createBarGeometry({ path: bar.path, diameter: bar.diameter });
  });
  const t4 = performance.now();
  for (const geometry of geometries) {
    expect(geometry.getAttribute('position').count).toBeGreaterThan(0);
    geometry.dispose();
  }
  return { dispatchMs: t1 - t0, openSectionMs: t2 - t1, allSectionsMs: t3 - t2, meshMs: t4 - t3 };
};

describe('M3 T7 probe (iii) — section recompute with group bars (the §5 probe re-run)', () => {
  it(
    'one edit frame (moveElement → section recompute → mesh regen) fits the 16 ms budget',
    { timeout: 120_000 },
    () => {
      const project = buildGroupReferenceProject({ createStore: createBenchmarkStore });
      // Warm-up: WASM + JIT + selector caches reach steady state.
      for (let run = 0; run < WARMUP_RUNS; run++) runGroupEditFrame(project, run);

      const frames: FrameTiming[] = [];
      for (let run = 0; run < TIMED_RUNS; run++) frames.push(runGroupEditFrame(project, WARMUP_RUNS + run));

      const dispatch = timingStats(frames.map((frame) => frame.dispatchMs));
      const openSection = timingStats(frames.map((frame) => frame.openSectionMs));
      const allSections = timingStats(frames.map((frame) => frame.allSectionsMs));
      const meshes = timingStats(frames.map((frame) => frame.meshMs));
      // The §5 probe: the derived-data recompute after the edit — the ONE
      // open section + the changed bars' meshes (all 5 = conservative bound).
      const recomputeProbe = timingStats(frames.map((frame) => frame.openSectionMs + frame.meshMs));
      const recomputeBound = timingStats(frames.map((frame) => frame.allSectionsMs + frame.meshMs));

      console.info(
        [
          '[T7 (iii) §5 full-recompute re-run @ 50 walls × 1 group × 20 bars = 1,000 group-owned bars + 5 sections]',
          `  moveElement dispatch (wall + 20 group bars, host-follow — the UNCHANGED M1 per-bar cascade): median ${dispatch.medianMs.toFixed(2)} ms (max ${dispatch.maxMs.toFixed(2)}) — F3 tripwire ${DISPATCH_TRIPWIRE_MS} ms`,
          `  selectSectionPrimitives — open section (200 dots):  median ${openSection.medianMs.toFixed(2)} ms (max ${openSection.maxMs.toFixed(2)})`,
          `  selectSectionPrimitives — all 5 sections (bound):   median ${allSections.medianMs.toFixed(2)} ms (max ${allSections.maxMs.toFixed(2)})`,
          `  createBarGeometry × 20 changed group bars:          median ${meshes.medianMs.toFixed(2)} ms (max ${meshes.maxMs.toFixed(2)})`,
          `  §5 PROBE (open section + meshes):                   median ${recomputeProbe.medianMs.toFixed(2)} ms (max ${recomputeProbe.maxMs.toFixed(2)}) — budget ${FRAME_BUDGET_MS} ms`,
          `  §5 probe bound (all 5 sections + meshes):           median ${recomputeBound.medianMs.toFixed(2)} ms (max ${recomputeBound.maxMs.toFixed(2)})`,
          '  M1 T5 record (individual L-bars, 2026-08-09):       probe 3.51 ms median / bound 9.28 ms / dispatch ~37 ms (F3)',
        ].join('\n'),
      );

      // The §5 probe — the derived-data full recompute after the edit.
      expect(recomputeProbe.medianMs).toBeLessThan(FRAME_BUDGET_MS);
      expect(recomputeBound.medianMs).toBeLessThan(FRAME_BUDGET_MS);
      // The F3 dispatch tripwire stays armed on the group model (the
      // host-follow cascade is the unchanged M1 cost class — reported).
      expect(dispatch.medianMs).toBeLessThan(DISPATCH_TRIPWIRE_MS);
    },
  );
});

interface MeshBuildStats {
  medianMs: number;
  maxMs: number;
  perBarMs: number;
  totalTriangles: number;
  trianglesPerBar: number;
  drawCalls: number;
}

/** Full-scene per-bar mesh build (what the initial render / a full
 *  invalidation costs with BarMesh's one-mesh-per-bar approach): every run
 *  rebuilds ALL bar geometries through the real WASM boundary and disposes
 *  them (the React unmount path). Median over the timed runs. */
const measureMeshBuild = (bars: readonly ReinforcementBar[]): MeshBuildStats => {
  const buildAll = (): { elapsedMs: number; triangles: number } => {
    const startedAt = performance.now();
    let triangles = 0;
    for (const bar of bars) {
      const geometry = createBarGeometry({ path: bar.path, diameter: bar.diameter });
      triangles += (geometry.index?.count ?? 0) / 3;
      geometry.dispose();
    }
    return { elapsedMs: performance.now() - startedAt, triangles };
  };
  for (let run = 0; run < WARMUP_RUNS; run++) buildAll();
  const runsMs: number[] = [];
  let totalTriangles = 0;
  for (let run = 0; run < TIMED_RUNS; run++) {
    const measured = buildAll();
    runsMs.push(measured.elapsedMs);
    totalTriangles = measured.triangles;
  }
  const stats = timingStats(runsMs);
  return {
    medianMs: stats.medianMs,
    maxMs: stats.maxMs,
    perBarMs: stats.medianMs / bars.length,
    totalTriangles,
    trianglesPerBar: totalTriangles / bars.length,
    // One mesh = one draw call per bar (BarMesh.tsx) — the §L.1 evidence.
    drawCalls: bars.length,
  };
};

describe('M3 T7 probe (iv) — §L.1 evidence: per-bar-mesh render cost (REPORT ONLY)', () => {
  it(
    'measures the full-scene per-bar mesh build at 1,000 bars, straight (groups) and bent (individuals)',
    { timeout: 120_000 },
    () => {
      const groupProject = buildGroupReferenceProject({ createStore: createBenchmarkStore });
      const individualProject = buildReferenceProject({ createStore: createBenchmarkStore });
      const groupBars = Object.values(groupProject.store.getState().project.reinforcement);
      const individualBars = Object.values(individualProject.store.getState().project.reinforcement);

      const straight = measureMeshBuild(groupBars);
      const bent = measureMeshBuild(individualBars);
      const instancedDrawCalls = 10; // §L.1: one InstancedMesh per diameter (Ø10…Ø32 ≈ 10)

      console.info(
        [
          '[T7 (iv) §L.1 per-bar-mesh evidence @ 1,000 bars — REPORT ONLY (M3 measures; post-M3 optimizes)]',
          `  straight group bars (2-point paths):  full rebuild median ${straight.medianMs.toFixed(2)} ms (max ${straight.maxMs.toFixed(2)}), ${straight.perBarMs.toFixed(3)} ms/bar, ${straight.totalTriangles.toLocaleString()} triangles (${straight.trianglesPerBar.toFixed(0)}/bar)`,
          `  bent individual bars (3-point L):     full rebuild median ${bent.medianMs.toFixed(2)} ms (max ${bent.maxMs.toFixed(2)}), ${bent.perBarMs.toFixed(3)} ms/bar, ${bent.totalTriangles.toLocaleString()} triangles (${bent.trianglesPerBar.toFixed(0)}/bar)`,
          `  draw calls (one mesh per bar, BarMesh.tsx): ${straight.drawCalls} at reference scale → ~50,000 at the §L.1 50K-bar target (InstancedMesh per diameter: ~${instancedDrawCalls})`,
          `  §L.1 CPU extrapolation (mesh build ×50): ~${(straight.medianMs * 50).toFixed(0)} ms straight / ~${(bent.medianMs * 50).toFixed(0)} ms bent per full rebuild`,
        ].join('\n'),
      );

      // Report-first probe: the assertions are coarse regression alarms at a
      // measured-safe margin, NOT budgets (§L stays watch-only in M3 — a
      // breach escalates to the author, the F3 loop).
      expect(straight.medianMs).toBeLessThan(MESH_REBUILD_TRIPWIRE_MS);
      expect(bent.medianMs).toBeLessThan(MESH_REBUILD_TRIPWIRE_MS);
    },
  );
});
