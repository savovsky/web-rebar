// Section generation orchestration — §G (two-tier strategy).
// Tier 1 (M0): the concrete outline at the cut plane is a PARAMETRIC query on
// the element model (a data query, not a mesh slice); cut bars come from one
// WASM plane–polyline intersection per bar; geometry within viewDepth behind
// the plane is projected as background per drafting convention (§G.2.3 — no
// occlusion computation). Tier 2 (mesh plane-intersection fallback for
// imported solids) arrives with the IFC adapter (M2+).
// Pure and three-free (rule 2): the T10 SectionView only renders these
// primitives; all projection math lives here. Primitives are DERIVED data —
// computed on demand via the memoized selector, never stored (§E, §H.2).
import { createSelector } from '@reduxjs/toolkit';
import type { ConcreteElement, Plane, ReinforcementBar, SectionDefinition, Vec3 } from '@/data/models';
import type { RootState } from '@/stores';
import { type WallGeometryParams, wallFootprintCorners } from './wall-geometry';
import { planePolylineIntersection } from './wasm-bridge';

const UNIT_Z: Vec3 = { x: 0, y: 0, z: 1 };
const COMPONENTS_PER_POINT = 3;
/** mm — "on the plane" tolerance, shared by chord and background math. */
const PLANE_TOLERANCE_MM = 1e-6;
/** mm — background lines closer to the outline boundary than this duplicate
 *  it visually (a perpendicular cut's far-end edges project exactly onto the
 *  outline sides) and are dropped. */
const COINCIDENCE_TOLERANCE_MM = 1e-3;
/** mm — shorter 2D projections are dropped (e.g. a bar running along the view
 *  direction projects to a point; its end-on representation is the cut dot). */
const MIN_LINE_LENGTH_MM = 1e-3;

// --- 2D primitives (the T10 SectionView renders exactly these) ---

/** 2D point in section coordinates (mm): u = horizontal, v = vertical. */
export interface SectionPoint {
  u: number;
  v: number;
}

/** A cut bar drawn as a dot — keeps the true relative diameter (§M.4). */
export interface CutBarDot {
  center: SectionPoint;
  diameterMm: number;
}

/** 2D vector primitives of one section view — derived, never stored (§H.2). */
export interface SectionPrimitives {
  /** Closed polygon per cut element (M0: one rectangle per wall). */
  concreteOutlines: SectionPoint[][];
  /** One dot per plane crossing per bar (0..n per bar). */
  cutBars: CutBarDot[];
  /** Polylines within viewDepth behind the plane (M0: 2-point segments) —
   *  drawn dashed per drafting convention (§G.2.3). */
  backgroundLines: SectionPoint[][];
}

// --- minimal Vec3 helpers (plain objects — the model stays JSON-shaped, §H.1) ---

const add = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });
const subtract = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
const scale = (v: Vec3, factor: number): Vec3 => ({ x: v.x * factor, y: v.y * factor, z: v.z * factor });
const dot = (a: Vec3, b: Vec3): number => a.x * b.x + a.y * b.y + a.z * b.z;
const cross = (a: Vec3, b: Vec3): Vec3 => ({
  x: a.y * b.z - a.z * b.y,
  y: a.z * b.x - a.x * b.z,
  z: a.x * b.y - a.y * b.x,
});
const normalize = (v: Vec3): Vec3 => {
  const length = Math.hypot(v.x, v.y, v.z);
  return length === 0 ? v : scale(v, 1 / length);
};

// --- section view frame & projection ---

/**
 * Orthonormal view frame of a section plane: `forward` (= the plane normal) is
 * the view direction depth is measured along, `right`/`up` span the 2D view.
 * M0 uses vertical planes only (createSection guard), so up is always +Z and
 * right = forward × up never degenerates. This is the drafting convention:
 * right = forward × up puts e.g. −Y on the right when looking along +X.
 */
export interface SectionFrame {
  origin: Vec3;
  forward: Vec3;
  right: Vec3;
  up: Vec3;
}

export function getSectionFrame(plane: Plane): SectionFrame {
  const forward = normalize(plane.normal);
  return { origin: plane.origin, forward, right: normalize(cross(forward, UNIT_Z)), up: UNIT_Z };
}

export interface SectionProjection {
  point: SectionPoint;
  /** Signed distance from the plane along the view direction (mm): < 0 in
   *  front (cut away), 0 on the plane, > 0 within the viewed part. */
  depthMm: number;
}

/** Projects a model-space point into section coordinates + view depth. */
export function projectToSection(worldPoint: Vec3, frame: SectionFrame): SectionProjection {
  const relative = subtract(worldPoint, frame.origin);
  return {
    point: { u: dot(relative, frame.right), v: dot(relative, frame.up) },
    depthMm: dot(relative, frame.forward),
  };
}

// --- concrete outline (§G.1 Tier 1 parametric query — not a mesh slice) ---

const dedupePoints = (points: Vec3[]): Vec3[] =>
  points.filter((point, index) =>
    points.slice(0, index).every((other) => {
      const dx = point.x - other.x;
      const dy = point.y - other.y;
      const dz = point.z - other.z;
      return dx * dx + dy * dy + dz * dz > PLANE_TOLERANCE_MM * PLANE_TOLERANCE_MM;
    }),
  );

/** The two farthest-apart points — the chord extremes when the plane contains
 *  a whole footprint edge (3+ collinear hits). */
function farthestPair(points: Vec3[]): [Vec3, Vec3] | null {
  let best: [Vec3, Vec3] | null = null;
  let bestDistanceSq = 0;
  for (let i = 0; i < points.length; i++) {
    for (let j = i + 1; j < points.length; j++) {
      const d = subtract(points[j], points[i]);
      const distanceSq = dot(d, d);
      if (distanceSq > bestDistanceSq) {
        bestDistanceSq = distanceSq;
        best = [points[i], points[j]];
      }
    }
  }
  return best;
}

/** Points where the plane's trace crosses the footprint boundary (the chord):
 *  corners lying on the plane plus strict edge crossings, deduplicated. */
function chordThroughFootprint(corners: Vec3[], depths: number[]): [Vec3, Vec3] | null {
  const hits: Vec3[] = [];
  for (let i = 0; i < corners.length; i++) {
    const next = (i + 1) % corners.length;
    const d0 = depths[i];
    const d1 = depths[next];
    if (Math.abs(d0) <= PLANE_TOLERANCE_MM) hits.push(corners[i]);
    if (d0 * d1 < -(PLANE_TOLERANCE_MM * PLANE_TOLERANCE_MM)) {
      hits.push(add(corners[i], scale(subtract(corners[next], corners[i]), d0 / (d0 - d1))));
    }
  }
  return farthestPair(dedupePoints(hits));
}

/** u-extent of the cut line segment in section coordinates — the section
 *  view is bounded by the drawn line (§G.1 revised 2026-08-09), matching the
 *  3D wireframe volume (line × depth). Content beyond the line ends is not
 *  part of the section. */
interface LineExtent {
  uMin: number;
  uMax: number;
}

function lineExtentOf(section: SectionDefinition, frame: SectionFrame): LineExtent {
  const uA = projectToSection(section.lineStart, frame).point.u;
  const uB = projectToSection(section.lineEnd, frame).point.u;
  return { uMin: Math.min(uA, uB), uMax: Math.max(uA, uB) };
}

interface WallOutlineOptions {
  wall: WallGeometryParams;
  frame: SectionFrame;
  extent: LineExtent;
}

/**
 * The wall's cross-section AT the cut plane: the plane's chord through the
 * plan footprint, extruded over the wall height — a rectangle in section
 * coordinates (u along the chord, v up), clipped to the cut line extent
 * (§G.1 revised). Null when the plane misses the wall or the chord lies
 * entirely beyond the line ends.
 */
function wallOutlineAtPlane(options: WallOutlineOptions): SectionPoint[] | null {
  const { wall, frame, extent } = options;
  const corners = wallFootprintCorners(wall);
  const depths = corners.map((corner) => dot(subtract(corner, frame.origin), frame.forward));
  const chord = chordThroughFootprint(corners, depths);
  if (chord === null) return null;
  const uStart = projectToSection(chord[0], frame).point.u;
  const uEnd = projectToSection(chord[1], frame).point.u;
  const uMin = Math.max(Math.min(uStart, uEnd), extent.uMin);
  const uMax = Math.min(Math.max(uStart, uEnd), extent.uMax);
  if (uMax - uMin < PLANE_TOLERANCE_MM) return null; // grazing touch or fully beyond the line ends
  const vBase = wall.baseElevation - frame.origin.z;
  const vTop = vBase + wall.height;
  return [
    { u: uMin, v: vBase },
    { u: uMax, v: vBase },
    { u: uMax, v: vTop },
    { u: uMin, v: vTop },
  ];
}

// --- background within viewDepth (§G.2.3 convention-based visibility) ---

export interface WallBackgroundOptions {
  wall: WallGeometryParams;
  frame: SectionFrame;
  viewDepthMm: number;
  extent: LineExtent;
  /** The cut outline, when the plane slices the wall — background edges
   *  coincident with its sides are dropped (they would double the line). */
  outline: SectionPoint[] | null;
}

/**
 * Vertical wall corner edges strictly behind the plane within viewDepth. A
 * perpendicular cut's far-end corners project exactly onto the outline sides
 * and are dropped; an oblique cut (or a wall fully behind the plane — the
 * "elevation" case) leaves genuine edges. M0 simplification: horizontal edges
 * (top/bottom) always land on the outline's v extremes, so only verticals are
 * emitted.
 */
function wallBackgroundLines(options: WallBackgroundOptions): SectionPoint[][] {
  const { wall, frame, viewDepthMm, extent, outline } = options;
  const vBase = wall.baseElevation - frame.origin.z;
  const vTop = vBase + wall.height;
  const emittedUs: number[] = [];
  const lines: SectionPoint[][] = [];
  for (const corner of wallFootprintCorners(wall)) {
    const { point, depthMm } = projectToSection(corner, frame);
    if (depthMm <= PLANE_TOLERANCE_MM || depthMm > viewDepthMm + PLANE_TOLERANCE_MM) continue;
    // Beyond the cut line ends the edge is not part of this section (§G.1 revised).
    if (
      point.u < extent.uMin - COINCIDENCE_TOLERANCE_MM ||
      point.u > extent.uMax + COINCIDENCE_TOLERANCE_MM
    ) {
      continue;
    }
    const isCoincidentWithOutline =
      outline !== null &&
      (Math.abs(point.u - outline[0].u) < COINCIDENCE_TOLERANCE_MM ||
        Math.abs(point.u - outline[1].u) < COINCIDENCE_TOLERANCE_MM);
    const isAlreadyEmitted = emittedUs.some((u) => Math.abs(u - point.u) < COINCIDENCE_TOLERANCE_MM);
    if (isCoincidentWithOutline || isAlreadyEmitted) continue;
    emittedUs.push(point.u);
    lines.push([
      { u: point.u, v: vBase },
      { u: point.u, v: vTop },
    ]);
  }
  return lines;
}

interface ClipToDepthSlabOptions {
  a: SectionProjection;
  b: SectionProjection;
  viewDepthMm: number;
}

/** Clips a segment to the view-depth slab [plane, plane + viewDepth]. */
function clipToDepthSlab(options: ClipToDepthSlabOptions): [SectionPoint, SectionPoint] | null {
  const { a, b, viewDepthMm } = options;
  const span = b.depthMm - a.depthMm;
  if (Math.abs(span) < PLANE_TOLERANCE_MM) {
    // Parallel to the plane: entirely inside or outside the slab.
    return a.depthMm >= 0 && a.depthMm <= viewDepthMm ? [a.point, b.point] : null;
  }
  let tNear = (0 - a.depthMm) / span;
  let tFar = (viewDepthMm - a.depthMm) / span;
  if (tNear > tFar) [tNear, tFar] = [tFar, tNear];
  const t0 = Math.max(0, tNear);
  const t1 = Math.min(1, tFar);
  if (t1 - t0 < PLANE_TOLERANCE_MM) return null;
  const lerp = (t: number): SectionPoint => ({
    u: a.point.u + t * (b.point.u - a.point.u),
    v: a.point.v + t * (b.point.v - a.point.v),
  });
  return [lerp(t0), lerp(t1)];
}

interface ClipToURangeOptions {
  a: SectionPoint;
  b: SectionPoint;
  extent: LineExtent;
}

/** Clips a 2D segment to the cut line's u-extent (§G.1 revised). */
function clipToURange(options: ClipToURangeOptions): [SectionPoint, SectionPoint] | null {
  const { a, b, extent } = options;
  const span = b.u - a.u;
  if (Math.abs(span) < PLANE_TOLERANCE_MM) {
    // Constant u: entirely inside or outside the extent.
    return a.u >= extent.uMin && a.u <= extent.uMax ? [a, b] : null;
  }
  let tNear = (extent.uMin - a.u) / span;
  let tFar = (extent.uMax - a.u) / span;
  if (tNear > tFar) [tNear, tFar] = [tFar, tNear];
  const t0 = Math.max(0, tNear);
  const t1 = Math.min(1, tFar);
  if (t1 - t0 < PLANE_TOLERANCE_MM) return null;
  const lerp = (t: number): SectionPoint => ({ u: a.u + t * span, v: a.v + t * (b.v - a.v) });
  return [lerp(t0), lerp(t1)];
}

interface BarBackgroundOptions {
  bar: ReinforcementBar;
  frame: SectionFrame;
  viewDepthMm: number;
  extent: LineExtent;
}

/**
 * Bar segments behind the plane, clipped to the view-depth slab AND the cut
 * line extent (§G.1 revised) and projected (§G.2.3 "dashed continuation").
 * Segments running along the view direction project to a point and are
 * dropped — end-on bars within the depth are an M0 simplification.
 */
function barBackgroundLines(options: BarBackgroundOptions): SectionPoint[][] {
  const { bar, frame, viewDepthMm, extent } = options;
  const lines: SectionPoint[][] = [];
  for (let i = 0; i < bar.path.length - 1; i++) {
    const clipped = clipToDepthSlab({
      a: projectToSection(bar.path[i], frame),
      b: projectToSection(bar.path[i + 1], frame),
      viewDepthMm,
    });
    if (clipped === null) continue;
    const inRange = clipToURange({ a: clipped[0], b: clipped[1], extent });
    if (inRange === null) continue;
    const [p, q] = inRange;
    if (Math.hypot(q.u - p.u, q.v - p.v) < MIN_LINE_LENGTH_MM) continue;
    lines.push([p, q]);
  }
  return lines;
}

// --- cut bars (one WASM plane–polyline intersection per bar) ---

const flattenPath = (path: Vec3[]): Float64Array => {
  const flat = new Float64Array(path.length * COMPONENTS_PER_POINT);
  path.forEach((point, i) => {
    flat.set([point.x, point.y, point.z], i * COMPONENTS_PER_POINT);
  });
  return flat;
};

interface CutBarDotsOptions {
  bar: ReinforcementBar;
  frame: SectionFrame;
  extent: LineExtent;
}

/** Dots where the bar's stored path crosses the plane (0..n per bar), bounded
 *  by the cut line extent (§G.1 revised). The diameter travels with the dot —
 *  section dots keep true relative diameters (§M.4). */
function cutBarDots(options: CutBarDotsOptions): CutBarDot[] {
  const { bar, frame, extent } = options;
  const crossings = planePolylineIntersection({
    planeOrigin: frame.origin,
    planeNormal: frame.forward,
    pathPoints: flattenPath(bar.path),
  });
  const dots: CutBarDot[] = [];
  for (let i = 0; i < crossings.length; i += COMPONENTS_PER_POINT) {
    const point: Vec3 = { x: crossings[i], y: crossings[i + 1], z: crossings[i + 2] };
    const center = projectToSection(point, frame).point;
    if (
      center.u < extent.uMin - COINCIDENCE_TOLERANCE_MM ||
      center.u > extent.uMax + COINCIDENCE_TOLERANCE_MM
    ) {
      continue; // beyond the cut line ends — not part of this section
    }
    dots.push({ center, diameterMm: bar.diameter });
  }
  return dots;
}

// --- orchestration ---

export interface ComputeSectionPrimitivesParams {
  section: SectionDefinition;
  elements: Record<string, ConcreteElement>;
  reinforcement: Record<string, ReinforcementBar>;
}

/**
 * §G.1 Tier 1: section definition + model → 2D vector primitives. Sections
 * survive target deletion (deleteElement keeps them) — missing targets are
 * skipped. Bars contribute only via their host element being a target.
 */
export function computeSectionPrimitives(params: ComputeSectionPrimitivesParams): SectionPrimitives {
  const { section, elements, reinforcement } = params;
  const frame = getSectionFrame(section.plane);
  // §G.1 revised 2026-08-09: the view is bounded by the drawn cut line
  // segment (× viewDepth) — matching the 3D wireframe volume; content beyond
  // the line ends is clipped/dropped.
  const extent = lineExtentOf(section, frame);
  const concreteOutlines: SectionPoint[][] = [];
  const backgroundLines: SectionPoint[][] = [];
  for (const elementId of section.targetElementIds) {
    const element = elements[elementId];
    if (!element) continue;
    const outline = wallOutlineAtPlane({ wall: element, frame, extent });
    if (outline !== null) concreteOutlines.push(outline);
    backgroundLines.push(
      ...wallBackgroundLines({ wall: element, frame, viewDepthMm: section.viewDepth, extent, outline }),
    );
  }
  const cutBars: CutBarDot[] = [];
  for (const bar of Object.values(reinforcement)) {
    if (!section.targetElementIds.includes(bar.hostElementId)) continue;
    cutBars.push(...cutBarDots({ bar, frame, extent }));
    backgroundLines.push(...barBackgroundLines({ bar, frame, viewDepthMm: section.viewDepth, extent }));
  }
  return { concreteOutlines, cutBars, backgroundLines };
}

/**
 * Memoized selector for the T10 SectionView — derived data is never stored
 * (§E, §H.2). Returns null when the section does not exist. Requires the WASM
 * module to be initialized (cut bars cross the §D boundary).
 */
export const selectSectionPrimitives = createSelector(
  [(state: RootState) => state.project, (_state: RootState, sectionId: string) => sectionId],
  (project, sectionId): SectionPrimitives | null => {
    const section = project.sections[sectionId];
    if (!section) return null;
    return computeSectionPrimitives({
      section,
      elements: project.elements,
      reinforcement: project.reinforcement,
    });
  },
);
