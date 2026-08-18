// Performance-probe helpers (M1 T5, §A risks): timing statistics and a
// structural-sharing-aware retained-size estimator. Pure and UI-free —
// reusable by the M1 T6 acceptance pass. These are regression tripwires,
// not micro-benchmarks: warm-ups + medians + generous thresholds.
import { configureStore } from '@reduxjs/toolkit';
import projectReducer from '@/stores/project-slice';
import scheduleReducer from '@/stores/schedule-slice';
import uiReducer from '@/stores/ui-slice';
import { undoListenerMiddleware, undoScopeMiddleware } from '@/stores/undo-middleware';
import undoReducer from '@/stores/undo-slice';

/**
 * Benchmark store: RTK's serializable/immutable invariant middleware is
 * DEV-ONLY (configureStore adds it unless NODE_ENV === 'production'; the
 * vite build sets production, vitest does not). At the reference scale those
 * deep state traversals cost ~170 ms per dispatch, drowning the §A
 * full-recompute number being probed — so benchmarks run on the production
 * middleware set (identical reducers + undo chain: what the shipped app
 * actually runs). The dev app keeps the checks via createAppStore.
 */
export const createBenchmarkStore = () =>
  configureStore({
    reducer: {
      project: projectReducer,
      schedule: scheduleReducer,
      ui: uiReducer,
      undo: undoReducer,
    },
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware({ serializableCheck: false, immutableCheck: false })
        .prepend(undoScopeMiddleware)
        .concat(undoListenerMiddleware.middleware),
  });
//
// Retained-size model (documented estimate, NOT a profiler): the walk counts
// every object reachable from the root exactly ONCE (identity-deduped), so
// Immer's structurally shared subtrees cost nothing — that is precisely the
// Q2-a property being measured. String payloads are value-deduped (keys like
// UUIDs repeat across snapshot records; V8 interns/references them). V8
// layout estimates:
const NUMBER_BYTES = 8; // heap number (small ints are pointers, but paths are doubles)
const BOOLEAN_BYTES = 4;
const STRING_BASE_BYTES = 16;
const STRING_BYTES_PER_CHAR = 2; // one-byte Latin1 when possible; UUIDs are ASCII
const OBJECT_BASE_BYTES = 16; // header + property backing store base
const OBJECT_FIELD_BYTES = 8; // one pointer per own property
const ARRAY_BASE_BYTES = 16;
const ARRAY_SLOT_BYTES = 8;
const KIB_BYTES = 1024;

export interface RetainedSize {
  bytes: number;
  objects: number;
  strings: number;
  numbers: number;
}

/**
 * Estimated retained heap size of the object graph reachable from `root`,
 * deduplicating shared references (structural sharing) and repeated strings.
 * Depth-first, iterative (snapshot graphs are shallow, but 30 × 1,000-entry
 * records would still blow a recursive walk's readability more than its stack).
 */
export const measureRetainedBytes = (root: unknown): RetainedSize => {
  const seenObjects = new Set<object>();
  const seenStrings = new Set<string>();
  const size: RetainedSize = { bytes: 0, objects: 0, strings: 0, numbers: 0 };
  const pending: unknown[] = [root];
  while (pending.length > 0) {
    const value = pending.pop();
    if (value === null || value === undefined) continue;
    if (typeof value === 'number') {
      size.bytes += NUMBER_BYTES;
      size.numbers += 1;
      continue;
    }
    if (typeof value === 'boolean') {
      size.bytes += BOOLEAN_BYTES;
      continue;
    }
    if (typeof value === 'string') {
      if (!seenStrings.has(value)) {
        seenStrings.add(value);
        size.strings += 1;
        size.bytes += STRING_BASE_BYTES + value.length * STRING_BYTES_PER_CHAR;
      }
      continue;
    }
    if (typeof value !== 'object' || seenObjects.has(value)) continue;
    seenObjects.add(value);
    size.objects += 1;
    if (Array.isArray(value)) {
      const entries = value as unknown[];
      size.bytes += ARRAY_BASE_BYTES + entries.length * ARRAY_SLOT_BYTES;
      pending.push(...entries);
      continue;
    }
    if (ArrayBuffer.isView(value)) {
      size.bytes += value.byteLength;
      continue;
    }
    const record = value as Record<string, unknown>;
    const keys = Object.keys(record);
    size.bytes += OBJECT_BASE_BYTES + keys.length * OBJECT_FIELD_BYTES;
    for (const key of keys) pending.push(key, record[key]);
  }
  return size;
};

/** Human-readable size for the task-log reports (KiB below 1 MiB, else MiB). */
export const formatBytes = (bytes: number): string => {
  const mib = bytes / (KIB_BYTES * KIB_BYTES);
  if (mib >= 1) return `${mib.toFixed(2)} MiB`;
  return `${(bytes / KIB_BYTES).toFixed(1)} KiB`;
};

export interface TimingStats {
  runsMs: number[];
  medianMs: number;
  minMs: number;
  maxMs: number;
}

/** Median/min/max over the measured runs (CI-robust: outliers land in max). */
export const timingStats = (runsMs: number[]): TimingStats => {
  const sorted = [...runsMs].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  const isEven = sorted.length % 2 === 0;
  const medianMs = isEven ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
  return { runsMs, medianMs, minMs: sorted[0], maxMs: sorted[sorted.length - 1] };
};
