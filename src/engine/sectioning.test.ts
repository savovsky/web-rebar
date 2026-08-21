// T9 §G.1 Tier 1 orchestration tests — parametric outline, cut-bar dots,
// convention-based background (§G.2.3), projection math, memoized selector.
// Cut bars cross the real WASM boundary (initWasmFromDisk).
// Model space is Z-up: plan in X–Y, elevation in Z. The view frame keeps the
// drafting convention up = +Z, right = forward × up — so u runs along −y for
// a cut looking along +X.
import { beforeAll, describe, expect, it } from 'vitest';
import { createSection, placeBar, placeWall } from '@/commands';
import type { ReinforcementBar, SectionDefinition, Vec3, WallElement } from '@/data/models';
import { createAppStore } from '@/stores';
import {
  computeSectionPrimitives,
  getSectionFrame,
  projectToSection,
  selectSectionPrimitives,
} from './sectioning';
import { initWasmFromDisk } from './wasm-test-init';

beforeAll(initWasmFromDisk);

const WALL: WallElement = {
  id: 'wall-1',
  kind: 'wall',
  startPoint: { x: 0, y: 0, z: 0 },
  endPoint: { x: 4000, y: 0, z: 0 },
  thickness: 200,
  height: 2800,
  baseElevation: 0,
};

/** Perpendicular cut at x = 2000, looking along +X. */
const makeSection = (overrides?: Partial<SectionDefinition>): SectionDefinition => ({
  id: 'sec-1',
  name: 'S-1',
  lineStart: { x: 2000, y: -500, z: 0 },
  lineEnd: { x: 2000, y: 500, z: 0 },
  plane: { origin: { x: 2000, y: 0, z: 0 }, normal: { x: 1, y: 0, z: 0 } },
  viewDepth: 5000,
  targetElementIds: [WALL.id],
  ...overrides,
});

const makeBar = (path: Vec3[], overrides?: Partial<ReinforcementBar>): ReinforcementBar => ({
  id: 'bar-1',
  hostElementId: WALL.id,
  diameter: 12,
  path,
  coverDistance: 25,
  steelGrade: 'B500B',
  barMark: 1,
  ...overrides,
});

interface ComputeFixture {
  section: SectionDefinition;
  bars?: ReinforcementBar[];
  wall?: WallElement;
}

const compute = ({ section, bars = [], wall = WALL }: ComputeFixture) =>
  computeSectionPrimitives({
    section,
    elements: { [wall.id]: wall },
    reinforcement: Object.fromEntries(bars.map((bar) => [bar.id, bar])),
  });

describe('getSectionFrame / projectToSection', () => {
  it('builds a right-handed view frame (forward × up = right)', () => {
    const frame = getSectionFrame({ origin: { x: 2000, y: 0, z: 0 }, normal: { x: 1, y: 0, z: 0 } });
    expect(frame.forward).toEqual({ x: 1, y: 0, z: 0 });
    expect(frame.right).toEqual({ x: 0, y: -1, z: 0 });
    expect(frame.up).toEqual({ x: 0, y: 0, z: 1 });
  });

  it('normalizes a non-unit normal', () => {
    const frame = getSectionFrame({ origin: { x: 0, y: 0, z: 0 }, normal: { x: 0, y: 5, z: 0 } });
    expect(frame.forward).toEqual({ x: 0, y: 1, z: 0 });
    expect(frame.right).toEqual({ x: 1, y: 0, z: 0 });
  });

  it('projects model points to section coordinates + depth', () => {
    const frame = getSectionFrame({ origin: { x: 2000, y: 0, z: 0 }, normal: { x: 1, y: 0, z: 0 } });
    expect(projectToSection({ x: 2000, y: -50, z: 1400 }, frame)).toEqual({
      point: { u: 50, v: 1400 },
      depthMm: 0,
    });
    expect(projectToSection({ x: 2500, y: 30, z: 100 }, frame)).toEqual({
      point: { u: -30, v: 100 },
      depthMm: 500,
    });
  });
});

describe('computeSectionPrimitives — concrete outline (parametric query)', () => {
  it('cuts a perpendicular section into the thickness × height rectangle', () => {
    const result = compute({ section: makeSection() });
    expect(result.concreteOutlines).toEqual([
      [
        { u: -100, v: 0 },
        { u: 100, v: 0 },
        { u: 100, v: 2800 },
        { u: -100, v: 2800 },
      ],
    ]);
    // The far-end corner edges project exactly onto the outline sides —
    // drawing them would double the line, so nothing is emitted.
    expect(result.backgroundLines).toEqual([]);
  });

  it('widens the outline for an oblique cut and keeps the genuine end edge', () => {
    // 45° plane near the wall end: chord through the footprint is wider than
    // the thickness; the corner behind the plane is a visible edge at u = 0.
    // The cut line spans y ∈ [-500, 500] through the plane origin — real
    // sections always keep line and plane consistent (createSection does).
    const result = compute({
      section: makeSection({
        lineStart: { x: 3900, y: -500, z: 0 },
        lineEnd: { x: 3900, y: 500, z: 0 },
        plane: { origin: { x: 3900, y: 0, z: 0 }, normal: { x: 1, y: 1, z: 0 } },
        viewDepth: 1000,
      }),
    });
    expect(result.concreteOutlines).toHaveLength(1);
    const outline = result.concreteOutlines[0];
    expect(outline[0].u).toBeCloseTo(-200 / Math.SQRT2);
    expect(outline[1].u).toBeCloseTo(200 / Math.SQRT2);
    expect(outline[1].v).toBe(0);
    expect(outline[2].v).toBe(2800);
    expect(result.backgroundLines).toHaveLength(1);
    const [line] = result.backgroundLines;
    expect(line[0].u).toBeCloseTo(0);
    expect(line[0].v).toBe(0);
    expect(line[1].u).toBeCloseTo(0);
    expect(line[1].v).toBe(2800);
  });

  it('returns nothing when the plane misses the wall entirely', () => {
    const section = makeSection({ plane: { origin: { x: 5000, y: 0, z: 0 }, normal: { x: 1, y: 0, z: 0 } } });
    const result = compute({
      section,
      bars: [
        makeBar([
          { x: 500, y: 69, z: 1400 },
          { x: 3500, y: 69, z: 1400 },
        ]),
      ],
    });
    expect(result).toEqual({ concreteOutlines: [], cutBars: [], backgroundLines: [] });
  });

  it('draws a wall fully behind the plane as elevation edges (no outline)', () => {
    const section = makeSection({
      plane: { origin: { x: -1000, y: 0, z: 0 }, normal: { x: 1, y: 0, z: 0 } },
    });
    const result = compute({ section });
    expect(result.concreteOutlines).toEqual([]);
    // 4 footprint corners but only 2 distinct u values (near/far ends share u).
    expect(result.backgroundLines).toEqual([
      [
        { u: -100, v: 0 },
        { u: -100, v: 2800 },
      ],
      [
        { u: 100, v: 0 },
        { u: 100, v: 2800 },
      ],
    ]);
  });

  it('skips missing target elements (sections survive target deletion)', () => {
    const result = compute({ section: makeSection({ targetElementIds: [WALL.id, 'deleted-wall'] }) });
    expect(result.concreteOutlines).toHaveLength(1);
  });
});

describe('computeSectionPrimitives — bounded by the cut line extent (§G.1 revised 2026-08-09)', () => {
  // The fixture line spans y ∈ [-500, 500] at x = 2000 → u-extent [-500, 500].
  const wallAtY = (y: number): WallElement => ({
    ...WALL,
    startPoint: { x: 0, y, z: 0 },
    endPoint: { x: 4000, y, z: 0 },
  });

  it('clips a partially overlapping outline to the line ends', () => {
    // Wall axis at y = 450 → footprint y ∈ [350, 550] → u ∈ [-550, -350]:
    // the chord is clipped to the extent at u = -500.
    const result = compute({ section: makeSection(), wall: wallAtY(450) });
    expect(result.concreteOutlines).toEqual([
      [
        { u: -500, v: 0 },
        { u: -350, v: 0 },
        { u: -350, v: 2800 },
        { u: -500, v: 2800 },
      ],
    ]);
  });

  it('drops content fully beyond the line ends (the T4 author scenario)', () => {
    // Wall axis at y = 700 → footprint y ∈ [600, 800], bar at y = 769: the
    // infinite plane still crosses both, but nothing lies within the line.
    const result = compute({
      section: makeSection(),
      wall: wallAtY(700),
      bars: [
        makeBar([
          { x: 500, y: 769, z: 1400 },
          { x: 3500, y: 769, z: 1400 },
        ]),
      ],
    });
    expect(result).toEqual({ concreteOutlines: [], cutBars: [], backgroundLines: [] });
  });

  it('clips background bar segments at the line ends and keeps a dot exactly on the line end', () => {
    const result = compute({
      section: makeSection(),
      bars: [
        // Diagonal behind the plane: u runs -69 → -1069, clipped at u = -500.
        makeBar([
          { x: 2500, y: 69, z: 500 },
          { x: 3500, y: 1069, z: 500 },
        ]),
        // Straight bar crossing the plane exactly at the line end (u = -500).
        makeBar(
          [
            { x: 500, y: 500, z: 500 },
            { x: 3500, y: 500, z: 500 },
          ],
          { id: 'bar-2' },
        ),
      ],
    });
    expect(result.cutBars).toHaveLength(1);
    expect(result.cutBars[0].center.u).toBeCloseTo(-500);
    expect(result.backgroundLines).toContainEqual([
      { u: -69, v: 500 },
      { u: -500, v: 500 },
    ]);
  });
});

describe('computeSectionPrimitives — cut bars (dots)', () => {
  it('shows a dot where the bar path crosses the plane', () => {
    const result = compute({
      section: makeSection(),
      bars: [
        makeBar([
          { x: 500, y: 69, z: 1400 },
          { x: 3500, y: 69, z: 1400 },
        ]),
      ],
    });
    expect(result.cutBars).toEqual([{ center: { u: -69, v: 1400 }, diameterMm: 12 }]);
    // The behind-plane continuation runs along the view direction — it
    // projects to a point and is dropped (the dot already represents it).
    expect(result.backgroundLines).toEqual([]);
  });

  it('keeps true relative diameters on the dots (§M.4)', () => {
    const bars = [
      makeBar(
        [
          { x: 500, y: 0, z: 1400 },
          { x: 3500, y: 0, z: 1400 },
        ],
        { id: 'bar-8', diameter: 8 },
      ),
      makeBar(
        [
          { x: 500, y: 0, z: 900 },
          { x: 3500, y: 0, z: 900 },
        ],
        { id: 'bar-20', diameter: 20 },
      ),
    ];
    const result = compute({ section: makeSection(), bars });
    expect(result.cutBars.map((dot) => dot.diameterMm).sort((a, b) => a - b)).toEqual([8, 20]);
  });

  it('produces one dot per crossing for a bent bar (0..n)', () => {
    const zigzag = makeBar([
      { x: 500, y: 0, z: 1400 },
      { x: 2500, y: 0, z: 1400 },
      { x: 1500, y: 0, z: 2000 },
    ]);
    const result = compute({ section: makeSection(), bars: [zigzag] });
    expect(result.cutBars).toHaveLength(2);
    expect(result.cutBars[0].center).toEqual({ u: 0, v: 1400 });
    expect(result.cutBars[1].center).toEqual({ u: 0, v: 1700 });
    // The middle segment's behind-plane half is a dashed continuation (§G.2.3).
    expect(result.backgroundLines).toEqual([
      [
        { u: 0, v: 1400 },
        { u: 0, v: 1700 },
      ],
    ]);
  });

  it('ignores bars whose host is not a section target', () => {
    const otherWallBar = makeBar(
      [
        { x: 500, y: 0, z: 1400 },
        { x: 3500, y: 0, z: 1400 },
      ],
      {
        hostElementId: 'wall-2',
      },
    );
    const result = compute({ section: makeSection(), bars: [otherWallBar] });
    expect(result.cutBars).toEqual([]);
    expect(result.backgroundLines).toEqual([]);
  });
});

describe('computeSectionPrimitives — background within viewDepth', () => {
  it('projects a bar behind the plane as a line', () => {
    const result = compute({
      section: makeSection(),
      bars: [
        makeBar([
          { x: 2500, y: 69, z: 100 },
          { x: 2500, y: 69, z: 2700 },
        ]),
      ],
    });
    expect(result.cutBars).toEqual([]);
    expect(result.backgroundLines).toEqual([
      [
        { u: -69, v: 100 },
        { u: -69, v: 2700 },
      ],
    ]);
  });

  it('clips background segments at the view depth', () => {
    const result = compute({
      section: makeSection(),
      bars: [
        makeBar([
          { x: 5500, y: 50, z: 100 },
          { x: 7500, y: 50, z: 2700 },
        ]),
      ],
    });
    expect(result.backgroundLines).toEqual([
      [
        { u: -50, v: 100 },
        { u: -50, v: 2050 }, // 100 + 0.75 × 2600 — clipped at depth 5000
      ],
    ]);
  });

  it('drops bars beyond the view depth', () => {
    const result = compute({
      section: makeSection(),
      bars: [
        makeBar([
          { x: 8000, y: 50, z: 100 },
          { x: 8000, y: 50, z: 2700 },
        ]),
      ],
    });
    expect(result.backgroundLines).toEqual([]);
  });
});

describe('selectSectionPrimitives (memoized selector)', () => {
  const buildStore = () => {
    const store = createAppStore();
    const wallId = store.dispatch(
      placeWall({
        startPoint: { x: 0, y: 0, z: 0 },
        endPoint: { x: 4000, y: 0, z: 0 },
        thickness: 200,
        height: 2800,
      }),
    );
    store.dispatch(
      placeBar({
        hostElementId: wallId,
        diameter: 12,
        path: [
          { x: 500, y: 69, z: 1400 },
          { x: 3500, y: 69, z: 1400 },
        ],
      }),
    );
    const sectionId = store.dispatch(
      createSection({
        name: 'S-1',
        lineStart: { x: 2000, y: 0, z: 0 }, // starts inside the footprint — still a crossing
        lineEnd: { x: 2000, y: 500, z: 0 },
        depthPoint: { x: 7000, y: 0, z: 0 }, // view along +X, 5000 mm deep
        targetElementIds: [wallId],
      }),
    );
    return { store, sectionId };
  };

  it('derives outline + dot from the store via the §N commands', () => {
    const { store, sectionId } = buildStore();
    const primitives = selectSectionPrimitives(store.getState(), sectionId);
    expect(primitives).not.toBeNull();
    expect(primitives?.concreteOutlines).toHaveLength(1);
    expect(primitives?.cutBars).toEqual([{ center: { u: -69, v: 1400 }, diameterMm: 12 }]);
  });

  it('memoizes per (state, sectionId) — same reference on repeat calls', () => {
    const { store, sectionId } = buildStore();
    const first = selectSectionPrimitives(store.getState(), sectionId);
    expect(selectSectionPrimitives(store.getState(), sectionId)).toBe(first);
  });

  it('returns null for an unknown section', () => {
    const { store } = buildStore();
    expect(selectSectionPrimitives(store.getState(), 'nope')).toBeNull();
  });
});
