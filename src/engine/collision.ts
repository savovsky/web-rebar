// Bar-vs-bar clash orchestration (§D.2, M3 T6, plan Q2/Q8) — typed bars in,
// exact clash report out. The WASM call gets flat polyline paths + radii
// (§D.3); ids stay TS-side and are mapped back onto the index pairs. The
// report is EXACT (pair ids + minimum centerline distances) and
// DETERMINISTIC (pairs sorted by id — independent of input enumeration).
// Pure and three-free (rule 2): components never compute this.
//
// Q8 / §K.4: this is a placement-time engine PROBE feeding non-blocking
// warnings — never the validator, never an auto-run, nothing is blocked or
// auto-moved (the §K "Fit to Code" door stays closed). Scope line pinned:
// bar-vs-bar only — nothing else exists to collide against until M4
// openings/junctions (the engine checks bar PAIRS model-wide so those slot
// in later without redesign).
import type { Vec3 } from '@/data/models';
import { checkBarCollisions } from './wasm-bridge';

/** One bar's clash-relevant data (id + centerline + diameter). */
export interface BarCollisionInput {
  id: string;
  path: Vec3[];
  diameter: number;
}

/** One clashing bar pair — centerline distance < r₁ + r₂. */
export interface BarClash {
  barIdA: string;
  barIdB: string;
  /** Minimum centerline distance (mm) — exact, from the WASM engine. */
  minDistanceMm: number;
}

/** Status-bar copy for a clash report (the §K.4 warning surface — pair
 *  count + the closest centerline distance). Shared by the placement-time
 *  surfacing (ui/clash-surfacing) and the on-demand checkBarClashes command.
 *  Wording is placement-neutral: the on-demand check runs when nothing is
 *  being placed. */
export function formatClashHint(clashes: readonly BarClash[]): string {
  const closest = Math.min(...clashes.map((clash) => clash.minDistanceMm));
  const pairWord = clashes.length === 1 ? 'pair' : 'pairs';
  return (
    `Clash warning: ${clashes.length} bar ${pairWord} — ` +
    `closest centerline distance ${closest.toFixed(1)} mm · non-blocking warning (§K.4)`
  );
}

export interface FindBarClashesOptions {
  /** The bar set to check (the command layer passes the PROSPECTIVE model:
   *  existing bars plus the placed/regenerated/moved ones, so a report can be
   *  computed before any dispatch). */
  bars: readonly BarCollisionInput[];
  /** Only report pairs touching one of these ids — the affected bars of the
   *  command (the placed group, the moved bar, the regenerated bars). */
  involvingIds: readonly string[];
}

const fail = (message: string): never => {
  throw new Error(`findBarClashes: ${message}`);
};

/** Model bars are valid by construction (the placeBar/placeBarGroup doorways
 *  reject degenerate input) — this guards engine misuse, not user input. */
function validateBar(bar: BarCollisionInput): void {
  if (bar.path.length < 2) fail(`bar ${bar.id}: path needs at least 2 points`);
  if (!Number.isFinite(bar.diameter) || bar.diameter <= 0) {
    fail(`bar ${bar.id}: diameter must be positive, got ${bar.diameter}`);
  }
  for (const point of bar.path) {
    if (!Number.isFinite(point.x) || !Number.isFinite(point.y) || !Number.isFinite(point.z)) {
      fail(`bar ${bar.id}: non-finite path coordinate`);
    }
  }
}

/**
 * Exact clash pairs among `bars` that involve at least one `involvingIds`
 * member. Deterministic: pairs sorted by (barIdA, barIdB).
 */
export function findBarClashes(options: FindBarClashesOptions): BarClash[] {
  const { bars, involvingIds } = options;
  for (const bar of bars) validateBar(bar);
  if (involvingIds.length === 0 || bars.length < 2) return [];

  const pointCount = bars.reduce((total, bar) => total + bar.path.length, 0);
  const pathPoints = new Float64Array(pointCount * 3);
  const pathOffsets = new Uint32Array(bars.length + 1);
  const radii = new Float64Array(bars.length);
  let writeAt = 0;
  bars.forEach((bar, index) => {
    pathOffsets[index] = writeAt / 3;
    for (const point of bar.path) {
      pathPoints[writeAt] = point.x;
      pathPoints[writeAt + 1] = point.y;
      pathPoints[writeAt + 2] = point.z;
      writeAt += 3;
    }
    radii[index] = bar.diameter / 2;
  });
  pathOffsets[bars.length] = pointCount;

  const { pairs, distances } = checkBarCollisions({ pathPoints, pathOffsets, radii });
  const involving = new Set(involvingIds);
  const clashes: BarClash[] = [];
  for (let pair = 0; pair < distances.length; pair++) {
    const indexA = pairs[pair * 2];
    const indexB = pairs[pair * 2 + 1];
    // Normalize WITHIN the pair (barIdA ≤ barIdB): the report is fully
    // independent of input enumeration — ids are UUIDs, so both the pair
    // order and the inside-pair order sort by id.
    const idA = bars[indexA].id;
    const idB = bars[indexB].id;
    const [barIdA, barIdB] = idA.localeCompare(idB) <= 0 ? [idA, idB] : [idB, idA];
    if (!involving.has(barIdA) && !involving.has(barIdB)) continue;
    clashes.push({ barIdA, barIdB, minDistanceMm: distances[pair] });
  }
  clashes.sort((a, b) => a.barIdA.localeCompare(b.barIdA) || a.barIdB.localeCompare(b.barIdB));
  return clashes;
}
