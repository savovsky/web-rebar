// T6 clash orchestration tests (§D.2, plan Q2/Q8) — typed bars → exact,
// deterministic clash reports across the real WASM boundary (parry3d-f64
// primitive, gate verdict 2026-08-22). Covers the involving-ids filter (a
// command reports only pairs touching ITS affected bars), the deterministic
// id-sorted report order, the invalid-input guards, and the WASM-side
// 1,000-bar timing probe for the gate record (T7 arms the budget — T6
// measures the shape, nothing asserted on time here).
import { beforeAll, describe, expect, it } from 'vitest';
import { type BarCollisionInput, findBarClashes } from './collision';
import { initWasmFromDisk } from './wasm-test-init';

beforeAll(initWasmFromDisk);

type PointTuple = [number, number, number];

const bar = (options: { id: string; path: PointTuple[]; diameter?: number }): BarCollisionInput => ({
  id: options.id,
  path: options.path.map(([x, y, z]) => ({ x, y, z })),
  diameter: options.diameter ?? 12,
});

const straight = (options: { id: string; from: PointTuple; to: PointTuple }): BarCollisionInput =>
  bar({ id: options.id, path: [options.from, options.to] });

describe('findBarClashes', () => {
  it('reports an overlapping parallel pair with the exact centerline distance', () => {
    const bars = [
      straight({ id: 'a', from: [0, 0, 700], to: [3000, 0, 700] }),
      straight({ id: 'b', from: [0, 0, 708], to: [3000, 0, 708] }),
    ];
    const clashes = findBarClashes({ bars, involvingIds: ['a', 'b'] });
    expect(clashes).toEqual([{ barIdA: 'a', barIdB: 'b', minDistanceMm: 8 }]);
  });

  it('touching exactly (distance == r₁ + r₂) is NOT a clash', () => {
    const bars = [
      straight({ id: 'a', from: [0, 0, 700], to: [3000, 0, 700] }),
      straight({ id: 'b', from: [0, 0, 712], to: [3000, 0, 712] }),
    ];
    expect(findBarClashes({ bars, involvingIds: ['a', 'b'] })).toEqual([]);
  });

  it('reports crossing bars at zero distance', () => {
    const bars = [
      straight({ id: 'a', from: [0, 0, 700], to: [3000, 0, 700] }),
      straight({ id: 'b', from: [1500, -100, 700], to: [1500, 100, 700] }),
    ];
    const clashes = findBarClashes({ bars, involvingIds: ['b'] });
    expect(clashes).toEqual([{ barIdA: 'a', barIdB: 'b', minDistanceMm: 0 }]);
  });

  it('finds the clash through a bent bar’s middle segment', () => {
    const bars = [
      bar({
        id: 'l',
        path: [
          [0, 0, 700],
          [3000, 0, 700],
          [3000, 0, 100],
        ],
      }),
      straight({ id: 's', from: [2900, -500, 695], to: [2900, 500, 695] }),
    ];
    const clashes = findBarClashes({ bars, involvingIds: ['s'] });
    expect(clashes).toEqual([{ barIdA: 'l', barIdB: 's', minDistanceMm: 5 }]);
  });

  it('reports only pairs involving the candidate ids', () => {
    // a/b clash with each other AND with c — asking for c's pairs excludes a-b.
    const bars = [
      straight({ id: 'a', from: [0, 0, 700], to: [3000, 0, 700] }),
      straight({ id: 'b', from: [0, 0, 704], to: [3000, 0, 704] }),
      straight({ id: 'c', from: [1500, -100, 702], to: [1500, 100, 702] }),
    ];
    const clashes = findBarClashes({ bars, involvingIds: ['c'] });
    expect(clashes).toEqual([
      { barIdA: 'a', barIdB: 'c', minDistanceMm: 2 },
      { barIdA: 'b', barIdB: 'c', minDistanceMm: 2 },
    ]);
  });

  it('sorts the report by id pair regardless of input order (deterministic)', () => {
    const make = (): BarCollisionInput[] => [
      straight({ id: 'zz-bar', from: [0, 0, 700], to: [3000, 0, 700] }),
      straight({ id: 'aa-bar', from: [0, 0, 704], to: [3000, 0, 704] }),
      straight({ id: 'mm-bar', from: [1500, -100, 702], to: [1500, 100, 702] }),
    ];
    const forward = findBarClashes({ bars: make(), involvingIds: ['zz-bar', 'aa-bar', 'mm-bar'] });
    const reversed = findBarClashes({
      bars: make().reverse(),
      involvingIds: ['zz-bar', 'aa-bar', 'mm-bar'],
    });
    expect(forward).toEqual(reversed);
    const pairIds = forward.map((clash) => `${clash.barIdA}|${clash.barIdB}`);
    expect(pairIds).toEqual([...pairIds].sort());
  });

  it('returns an empty report for empty candidates or a single bar', () => {
    const bars = [
      straight({ id: 'a', from: [0, 0, 700], to: [3000, 0, 700] }),
      straight({ id: 'b', from: [0, 0, 704], to: [3000, 0, 704] }),
    ];
    expect(findBarClashes({ bars, involvingIds: [] })).toEqual([]);
    expect(findBarClashes({ bars: [bars[0]], involvingIds: ['a'] })).toEqual([]);
  });

  it('rejects degenerate engine input (guards, not user validation)', () => {
    expect(() =>
      findBarClashes({ bars: [bar({ id: 'a', path: [[0, 0, 0]] })], involvingIds: ['a'] }),
    ).toThrow(/at least 2 points/);
    expect(() =>
      findBarClashes({
        bars: [
          bar({
            id: 'a',
            path: [
              [0, 0, 0],
              [1, 1, 1],
            ],
            diameter: 0,
          }),
        ],
        involvingIds: ['a'],
      }),
    ).toThrow(/diameter must be positive/);
    expect(() =>
      findBarClashes({
        bars: [
          bar({
            id: 'a',
            path: [
              [0, 0, Number.NaN],
              [1, 1, 1],
            ],
          }),
        ],
        involvingIds: ['a'],
      }),
    ).toThrow(/non-finite/);
  });

  it('WASM-side timing probe: the 1,000-bar all-pairs-with-prefilter shape (T6 gate iii)', () => {
    // The cargo probe's corpus through the real boundary: a 10×10×10 grid of
    // straight bars 150 mm apart (no clashes) + two planted clash bars.
    const bars: BarCollisionInput[] = [];
    for (let gx = 0; gx < 10; gx++) {
      for (let gy = 0; gy < 10; gy++) {
        for (let gz = 0; gz < 10; gz++) {
          const base = (g: number) => g * 150;
          bars.push(
            straight({
              id: `g${gx}-${gy}-${gz}`,
              from: [base(gx), base(gy), base(gz)],
              to: [base(gx) + 100, base(gy), base(gz)],
            }),
          );
        }
      }
    }
    expect(bars).toHaveLength(1000);
    bars.push(straight({ id: 'planted', from: [0, 0, 4], to: [100, 0, 4] }));
    bars.push(straight({ id: 'crosser', from: [800, -50, 2], to: [800, 50, 2] }));
    const involvingIds = bars.map((b) => b.id);
    const start = performance.now();
    const clashes = findBarClashes({ bars, involvingIds });
    const elapsedMs = performance.now() - start;
    // T6 measures the shape — T7 arms the regression tripwire on this number.
    console.info(`T6 gate probe (WASM): 1,002-bar all-pairs with prefilter took ${elapsedMs.toFixed(2)} ms`);
    const pairIds = clashes.map((clash) => `${clash.barIdA}|${clash.barIdB}`).sort();
    expect(pairIds).toEqual(['crosser|g5-0-0', 'g0-0-0|planted']);
    expect(clashes.map((clash) => clash.minDistanceMm).sort()).toEqual([2, 4]);
  });
});
