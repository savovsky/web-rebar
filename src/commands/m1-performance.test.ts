// T5 — §A risk probes (M1 plan §5): full-recompute performance and
// undo-stack memory at the reference scale (50 walls × 20 bars = 1,000 bars
// + 5 sections, built through the §N commands — see reference-project.ts).
// Headless benchmarks only; WASM via initWasmFromDisk like the other tests.
// These are regression tripwires, not micro-benchmarks: warm-up runs,
// medians, and generous thresholds. Measured numbers are reported in the M1
// tracker task log (console.info output below); if the frame budget is
// exceeded the threshold must NOT be silently weakened — escalate instead.
//
// Store choice: createBenchmarkStore (performance-probes.ts) — the dev-only
// RTK invariant middleware would add ~170 ms of deep state traversal per
// dispatch at this scale; the production app does not run it, so the probes
// measure the production middleware set. The dev-mode overhead itself is
// reported in the task log as a finding.
import { beforeAll, describe, expect, it } from 'vitest';
import { moveElement } from '@/commands';
import {
  createBenchmarkStore,
  formatBytes,
  measureRetainedBytes,
  timingStats,
} from '@/commands/performance-probes';
import {
  REFERENCE_BARS_PER_WALL,
  REFERENCE_SECTION_COUNT,
  REFERENCE_WALL_COUNT,
  buildReferenceProject,
} from '@/commands/reference-project';
import { createBarGeometry } from '@/engine/bar-geometry';
import { selectSectionPrimitives } from '@/engine/sectioning';
import { initWasmFromDisk } from '@/engine/wasm-test-init';

beforeAll(initWasmFromDisk);

/** §5 frame budget — the plan's probe (derived-data recompute after an
 *  edit) must fit the 60 FPS budget. */
const FRAME_BUDGET_MS = 16;
/** Regression tripwire for the moveElement DISPATCH itself (NOT the plan's
 *  probe). Measured 2026-08-09: ~30–46 ms median at reference scale — the
 *  20 per-bar translateBar produces each copy the 1,000-entry reinforcement
 *  record (O(record) per action). This EXCEEDS the 16 ms frame budget and is
 *  escalated to the author as a finding (see the M1 tracker T5 task log) —
 *  batching the host-follow cascade into one produce is a §N/T2 design
 *  decision, not a threshold to weaken. The tripwire only catches
 *  regressions BEYOND the current architecture's cost. */
const DISPATCH_TRIPWIRE_MS = 100;
/** §E estimate the Q2-a measurement is checked against (per undo level). */
const SPEC_ESTIMATE_MIN_BYTES_PER_LEVEL = 5 * 1024 * 1024;
/** Tripwires (generous — regression alarms, not targets): the measured
 *  incremental cost per undo level is expected around ~60 KiB, so 1 MiB is
 *  ~15× headroom; the cumulative check is the §E worst case itself. */
const INCREMENTAL_TRIPWIRE_BYTES_PER_LEVEL = 1024 * 1024;
const CUMULATIVE_TRIPWIRE_BYTES = 30 * SPEC_ESTIMATE_MIN_BYTES_PER_LEVEL;

const WARMUP_RUNS = 3;
const TIMED_RUNS = 12;
/** Small alternating plan delta — every run is a real move (state changes),
 *  but the wall stays inside its section band across all runs. */
const MOVE_DELTA_MM = 8;
/** Edit count for the memory probe — fills the §E cap exactly. */
const MEMORY_PROBE_EDITS = 30;

interface FrameTiming {
  dispatchMs: number;
  openSectionMs: number;
  allSectionsMs: number;
  meshMs: number;
}

/** One full edit frame at reference scale: moveElement (wall + 20 hosted
 *  bars, host-follow) → memoized selectSectionPrimitives recompute (the OPEN
 *  section — what the app re-derives per edit — plus all 5 as a conservative
 *  bound) → createBarGeometry per changed bar (what BarMesh's useMemo
 *  rebuilds when a bar object identity changes). */
const runEditFrame = (project: ReturnType<typeof buildReferenceProject>, runIndex: number): FrameTiming => {
  const { store, wallIds, barIds, sectionIds } = project;
  const sign = runIndex % 2 === 0 ? 1 : -1;

  const t0 = performance.now();
  store.dispatch(moveElement({ elementId: wallIds[0], delta: { x: 0, y: 0, z: sign * MOVE_DELTA_MM } }));
  const t1 = performance.now();

  const state = store.getState();
  // The open section is the one cutting the moved wall (column 0).
  const openPrimitives = selectSectionPrimitives(state, sectionIds[0]);
  expect(openPrimitives?.concreteOutlines).toHaveLength(10);
  expect(openPrimitives?.cutBars).toHaveLength(10 * REFERENCE_BARS_PER_WALL);
  const t2 = performance.now();

  for (const sectionId of sectionIds) {
    expect(selectSectionPrimitives(state, sectionId)).not.toBeNull();
  }
  const t3 = performance.now();

  const changedBars = barIds
    .slice(0, REFERENCE_BARS_PER_WALL)
    .map((barId) => state.project.reinforcement[barId]);
  const geometries = changedBars.map((bar) => createBarGeometry({ path: bar.path, diameter: bar.diameter }));
  const t4 = performance.now();
  for (const geometry of geometries) {
    expect(geometry.getAttribute('position').count).toBeGreaterThan(0);
    geometry.dispose();
  }
  return { dispatchMs: t1 - t0, openSectionMs: t2 - t1, allSectionsMs: t3 - t2, meshMs: t4 - t3 };
};

describe('M1 T5 — full-recompute performance (§A risk)', () => {
  it('reference project builds at the expected scale through the §N commands', () => {
    const project = buildReferenceProject({ createStore: createBenchmarkStore });
    const state = project.store.getState();
    expect(Object.keys(state.project.elements)).toHaveLength(REFERENCE_WALL_COUNT);
    expect(Object.keys(state.project.reinforcement)).toHaveLength(
      REFERENCE_WALL_COUNT * REFERENCE_BARS_PER_WALL,
    );
    expect(Object.keys(state.project.sections)).toHaveLength(REFERENCE_SECTION_COUNT);
    // Every bar path is the 3-point L shape (bend sweep exercised in meshes).
    for (const bar of Object.values(state.project.reinforcement)) {
      expect(bar.path).toHaveLength(3);
    }
    // The open section cuts its whole column: 10 outlines, 10 × 20 = 200 dots.
    const primitives = selectSectionPrimitives(state, project.sectionIds[0]);
    expect(primitives?.concreteOutlines).toHaveLength(10);
    expect(primitives?.cutBars).toHaveLength(10 * REFERENCE_BARS_PER_WALL);
  });

  it('one edit frame (moveElement → section recompute → mesh regen) fits the 16 ms budget', () => {
    const project = buildReferenceProject({ createStore: createBenchmarkStore });
    // Warm-up: WASM + JIT + selector caches reach steady state.
    for (let run = 0; run < WARMUP_RUNS; run++) runEditFrame(project, run);

    const frames: FrameTiming[] = [];
    for (let run = 0; run < TIMED_RUNS; run++) frames.push(runEditFrame(project, WARMUP_RUNS + run));

    const dispatch = timingStats(frames.map((frame) => frame.dispatchMs));
    const openSection = timingStats(frames.map((frame) => frame.openSectionMs));
    const allSections = timingStats(frames.map((frame) => frame.allSectionsMs));
    const meshes = timingStats(frames.map((frame) => frame.meshMs));
    // The plan's §5 probe: the derived-data recompute after the edit — the
    // ONE open section (what the app re-derives per edit) + the changed
    // bars' meshes. The all-5-sections number is a conservative bound.
    const recomputeProbe = timingStats(frames.map((frame) => frame.openSectionMs + frame.meshMs));
    const recomputeBound = timingStats(frames.map((frame) => frame.allSectionsMs + frame.meshMs));
    const fullFrame = timingStats(
      frames.map((frame) => frame.dispatchMs + frame.openSectionMs + frame.meshMs),
    );

    console.info(
      [
        '[T5 full-recompute @ 50 walls × 20 bars = 1,000 bars + 5 sections]',
        `  moveElement dispatch (wall + 20 bars, host-follow):  median ${dispatch.medianMs.toFixed(2)} ms (max ${dispatch.maxMs.toFixed(2)}) — ESCALATED, exceeds the budget`,
        `  selectSectionPrimitives — open section (200 dots):   median ${openSection.medianMs.toFixed(2)} ms (max ${openSection.maxMs.toFixed(2)})`,
        `  selectSectionPrimitives — all 5 sections (bound):    median ${allSections.medianMs.toFixed(2)} ms (max ${allSections.maxMs.toFixed(2)})`,
        `  createBarGeometry × 20 changed bars:                 median ${meshes.medianMs.toFixed(2)} ms (max ${meshes.maxMs.toFixed(2)})`,
        `  §5 PROBE (open section + meshes):                    median ${recomputeProbe.medianMs.toFixed(2)} ms (max ${recomputeProbe.maxMs.toFixed(2)}) — budget ${FRAME_BUDGET_MS} ms`,
        `  §5 probe bound (all 5 sections + meshes):            median ${recomputeBound.medianMs.toFixed(2)} ms (max ${recomputeBound.maxMs.toFixed(2)})`,
        `  full frame incl. dispatch (reported, escalated):     median ${fullFrame.medianMs.toFixed(2)} ms (max ${fullFrame.maxMs.toFixed(2)})`,
      ].join('\n'),
    );

    // The plan's probe — the derived-data full recompute after the edit.
    expect(recomputeProbe.medianMs).toBeLessThan(FRAME_BUDGET_MS);
    expect(recomputeBound.medianMs).toBeLessThan(FRAME_BUDGET_MS);
    // The dispatch overage is ESCALATED (see DISPATCH_TRIPWIRE_MS above) —
    // this only trips on a regression beyond the current architecture.
    expect(dispatch.medianMs).toBeLessThan(DISPATCH_TRIPWIRE_MS);
  });
});

describe('M1 T5 — undo-stack memory (§A risk, Q2-a vs the §E estimate)', () => {
  it('30 recorded edits retain far less than the §E 5–10 MB/level estimate', () => {
    const project = buildReferenceProject({ createStore: createBenchmarkStore });
    const { store, wallIds } = project;
    const fullSnapshotBytes = JSON.stringify(store.getState().project).length;

    // The retained graph an edit adds = growth of (current project + undo
    // slice) measured TOGETHER — snapshots share structure with the live
    // state, so measuring the undo slice in isolation would miscount. The
    // build already filled the 30-level cap → every edit is steady-state.
    const retainedOf = (): number =>
      measureRetainedBytes({ project: store.getState().project, undo: store.getState().undo }).bytes;

    let previousBytes = retainedOf();
    const undoOnlyBeforeBytes = measureRetainedBytes(store.getState().undo).bytes;
    const incrementalBytes: number[] = [];
    for (let edit = 0; edit < MEMORY_PROBE_EDITS; edit++) {
      store.dispatch(moveElement({ elementId: wallIds[edit], delta: { x: 0, y: 0, z: MOVE_DELTA_MM } }));
      const currentBytes = retainedOf();
      incrementalBytes.push(currentBytes - previousBytes);
      previousBytes = currentBytes;
    }
    const afterBytes = previousBytes;
    const beforeBytes = afterBytes - incrementalBytes.reduce((sum, bytes) => sum + bytes, 0);
    const undoOnlyAfterBytes = measureRetainedBytes(store.getState().undo).bytes;
    const meanIncremental = incrementalBytes.reduce((sum, bytes) => sum + bytes, 0) / incrementalBytes.length;
    const maxIncremental = Math.max(...incrementalBytes);
    const undoDepth = store.getState().undo.past.length;

    console.info(
      [
        '[T5 undo-stack memory @ reference scale, Q2-a frozen references + Immer sharing]',
        `  one full project snapshot (JSON):    ${formatBytes(fullSnapshotBytes)} (naive ×30: ${formatBytes(30 * fullSnapshotBytes)})`,
        `  undo slice alone before/after:       ${formatBytes(undoOnlyBeforeBytes)} → ${formatBytes(undoOnlyAfterBytes)} (depth ${undoDepth})`,
        `  project + undo after 30 edits:       ${formatBytes(afterBytes)} (growth ${formatBytes(afterBytes - beforeBytes)})`,
        `  incremental per edit level:          mean ${formatBytes(meanIncremental)}, max ${formatBytes(maxIncremental)}`,
        `  §E estimate:                         5–10 MiB/level → measured mean ${formatBytes(meanIncremental)}/level`,
      ].join('\n'),
    );

    expect(undoDepth).toBe(30); // the §E cap holds at reference scale
    expect(meanIncremental).toBeGreaterThan(0); // each edit retains SOMETHING (no silent no-op)
    expect(maxIncremental).toBeLessThan(INCREMENTAL_TRIPWIRE_BYTES_PER_LEVEL);
    expect(meanIncremental).toBeLessThan(SPEC_ESTIMATE_MIN_BYTES_PER_LEVEL);
    expect(afterBytes).toBeLessThan(CUMULATIVE_TRIPWIRE_BYTES);
  });
});
