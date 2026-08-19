// Reference-scale project fixture (M1 T5, §A risk probes): a deterministic
// "large M1-scale building slice" built ENTIRELY through the §N commands
// (placeWall / placeBar / createSection), reusable by benchmarks and the M1
// T6 acceptance pass. Pure and UI-free (rules 1+2); the bar placement uses
// the same engine/placement math as the Place Bar tool. Requires the WASM
// module to be initialized first (initWasmFromDisk in tests) — the section
// primitives and bar meshes cross the §D boundary.
import { createSection } from '@/commands/create-section';
import { DEFAULT_BAR_DIAMETER_MM, placeBar, resolveDefaultCover } from '@/commands/place-bar';
import { placeWall } from '@/commands/place-wall';
import { getWallFaceFrame, resolveBarCenterline } from '@/engine/placement';
import { createAppStore } from '@/stores';

// --- reference scale ---

/** §5 reference scale: 50 walls × 20 bars = 1,000 bars. */
export const REFERENCE_WALL_COUNT = 50;
export const REFERENCE_BARS_PER_WALL = 20;
/** One section per grid column: the cut line spans all 10 rows, so each
 *  section cuts the 10 walls of its column (targets = the walls the drawn
 *  line crosses, as the Section Cut tool resolves them). */
export const REFERENCE_SECTION_COUNT = 5;
const WALLS_PER_SECTION = 10;

/** One wall: 4000 × 200 × 2800 (the M0 acceptance dimensions). */
const WALL_LENGTH_MM = 4000;
const WALL_THICKNESS_MM = 200;
const WALL_HEIGHT_MM = 2800;
/** Grid pitch (mm): walls run along X, spaced on a 5-column grid (no overlaps). */
const WALLS_PER_ROW = 5;
const WALL_SPACING_X_MM = 6000;
const WALL_SPACING_Y_MM = 6000;

/** Bars (mm): L-shaped (horizontal leg + 300 mm upward hook at the right
 *  end — a realistic wall bar that also exercises the swept-bend mesh path),
 *  at the catalog cover from the +Y face, stacked vertically with a 120 mm
 *  pitch (Ø12/120). Highest bar + hook: 31 + 20·120 + 300 = 2731 ≤ 2800 − 31. */
const BAR_SPACING_Z_MM = 120;
const BAR_START_INSET_MM = 200;
const BAR_END_INSET_MM = 500;
const BAR_HOOK_MM = 300;
/** Sections: perpendicular cuts across a 10-wall band, looking along the
 *  wall axes with a 2500 mm view depth (M0 acceptance convention). */
const SECTION_DEPTH_MM = 2500;
const SECTION_LINE_MARGIN_Y_MM = 500;

export type ReferenceStore = ReturnType<typeof createAppStore>;

export interface ReferenceProject {
  store: ReferenceStore;
  /** In build order — wall i hosts bars [i*BARS, (i+1)*BARS). */
  wallIds: string[];
  barIds: string[];
  sectionIds: string[];
}

export interface BuildReferenceProjectOptions {
  /** Store factory — defaults to the canonical createAppStore. Benchmarks
   *  pass a production-representative store (see performance-probes.ts) to
   *  keep the 1,055-command build fast and the timings dev-check-free. */
  createStore?: () => ReferenceStore;
}

interface WallGridPosition {
  originX: number;
  originY: number;
}

const wallGridPosition = (index: number): WallGridPosition => ({
  originX: (index % WALLS_PER_ROW) * WALL_SPACING_X_MM,
  originY: Math.floor(index / WALLS_PER_ROW) * WALL_SPACING_Y_MM,
});

interface BarPlacementOptions {
  store: ReferenceStore;
  wallId: string;
  wallIndex: number;
  barIndex: number;
}

/** One horizontal bar on the wall's +Y face (tool-equivalent placement math:
 *  face points → cover offset → clamp from ALL faces). */
const placeBarOnWall = (options: BarPlacementOptions): string => {
  const { store, wallId, wallIndex, barIndex } = options;
  const wall = store.getState().project.elements[wallId];
  const { originX, originY } = wallGridPosition(wallIndex);
  const coverMm = resolveDefaultCover('wall');
  const radiusMm = DEFAULT_BAR_DIAMETER_MM / 2;
  const z = coverMm + radiusMm + (barIndex + 1) * BAR_SPACING_Z_MM;
  const yFace = originY + WALL_THICKNESS_MM / 2;
  const centerline = resolveBarCenterline({
    facePoints: [
      { x: originX + BAR_START_INSET_MM, y: yFace, z },
      { x: originX + WALL_LENGTH_MM - BAR_END_INSET_MM, y: yFace, z },
      { x: originX + WALL_LENGTH_MM - BAR_END_INSET_MM, y: yFace, z: z + BAR_HOOK_MM },
    ],
    frame: getWallFaceFrame(wall, { x: 0, y: 1, z: 0 }),
    wall,
    coverMm,
    radiusMm,
  });
  return store.dispatch(
    placeBar({ hostElementId: wallId, diameter: DEFAULT_BAR_DIAMETER_MM, path: centerline }),
  );
};

/**
 * Builds the reference project (deterministic geometry — nothing
 * performance-relevant depends on the UUID ids). 50 walls on a 5 × 10 grid,
 * 20 bars per wall (1,000 total), 5 sections; section s cuts the 10 walls of
 * grid column s (wall indices s, s+5, …, s+45).
 */
export const buildReferenceProject = (options?: BuildReferenceProjectOptions): ReferenceProject => {
  const store = options?.createStore ? options.createStore() : createAppStore();
  const wallIds: string[] = [];
  const barIds: string[] = [];
  for (let wallIndex = 0; wallIndex < REFERENCE_WALL_COUNT; wallIndex++) {
    const { originX, originY } = wallGridPosition(wallIndex);
    const wallId = store.dispatch(
      placeWall({
        startPoint: { x: originX, y: originY, z: 0 },
        endPoint: { x: originX + WALL_LENGTH_MM, y: originY, z: 0 },
        thickness: WALL_THICKNESS_MM,
        height: WALL_HEIGHT_MM,
      }),
    );
    wallIds.push(wallId);
    for (let barIndex = 0; barIndex < REFERENCE_BARS_PER_WALL; barIndex++) {
      barIds.push(placeBarOnWall({ store, wallId, wallIndex, barIndex }));
    }
  }

  const sectionIds: string[] = [];
  const lastRowY = (WALLS_PER_SECTION - 1) * WALL_SPACING_Y_MM;
  for (let s = 0; s < REFERENCE_SECTION_COUNT; s++) {
    const lineX = s * WALL_SPACING_X_MM + WALL_LENGTH_MM / 2;
    const targets = wallIds.filter((_, index) => index % WALLS_PER_ROW === s);
    sectionIds.push(
      store.dispatch(
        createSection({
          name: `S-${s + 1}`,
          lineStart: { x: lineX, y: -SECTION_LINE_MARGIN_Y_MM, z: 0 },
          lineEnd: { x: lineX, y: lastRowY + SECTION_LINE_MARGIN_Y_MM, z: 0 },
          depthPoint: { x: lineX + SECTION_DEPTH_MM, y: 0, z: 0 },
          targetElementIds: targets,
        }),
      ),
    );
  }
  return { store, wallIds, barIds, sectionIds };
};
