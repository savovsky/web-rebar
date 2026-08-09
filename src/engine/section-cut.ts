// Section Cut tool + section volume math (§B.6) — pure and three-free (rule 2:
// components never compute geometry). The drag line plus a third depth click
// define the cut plane and view depth; the stored section shows in the 3D
// viewport as a wireframe volume whose body and corner handles move/stretch
// the line and depth.
import type { ConcreteElement, Plane, SectionDefinition, Vec3 } from '@/data/models';
import { wallFootprintCorners } from './wall-geometry';

/** mm — zero-length line guard, minimum chord/depth, geometry equality. */
const LINE_TOLERANCE_MM = 1e-3;
/** Ray direction component below which the ray counts as parallel to the ground. */
const RAY_PARALLEL_EPSILON = 1e-9;

// --- line & depth point → cut plane ---

/** Negation that collapses −0 (keeps model data canonical). */
const flipPlanNormal = (normal: Vec3): Vec3 => ({ x: -normal.x + 0, y: 0, z: -normal.z + 0 });

/**
 * Unit plan normal of a line, rotated 90° clockwise from its direction
 * ((−dir.z, 0, dir.x)). Null for a zero-length line.
 */
export function planNormalFromLine(lineStart: Vec3, lineEnd: Vec3): Vec3 | null {
  const dx = lineEnd.x - lineStart.x;
  const dz = lineEnd.z - lineStart.z;
  const length = Math.hypot(dx, dz);
  if (length < LINE_TOLERANCE_MM) return null;
  return flipPlanNormal({ x: dz / length, y: 0, z: -dx / length });
}

export interface SectionGeometry {
  plane: Plane;
  viewDepthMm: number;
}

export interface LineAndDepthPoint {
  lineStart: Vec3;
  lineEnd: Vec3;
  /** Any point on the viewed side; its perpendicular distance from the line
   *  becomes the view depth, and its side decides the view direction (§B.6 —
   *  the third click). */
  depthPoint: Vec3;
}

/**
 * The section geometry: a VERTICAL plane through the line, looking TOWARD the
 * depth point. Null when the line is zero-length or the point lies on the
 * line (no depth).
 */
export function sectionGeometryFromDepthPoint(options: LineAndDepthPoint): SectionGeometry | null {
  const { lineStart, lineEnd, depthPoint } = options;
  const normal = planNormalFromLine(lineStart, lineEnd);
  if (normal === null) return null;
  const signedDepthMm = (depthPoint.x - lineStart.x) * normal.x + (depthPoint.z - lineStart.z) * normal.z;
  if (Math.abs(signedDepthMm) < LINE_TOLERANCE_MM) return null;
  const isFlipped = signedDepthMm < 0;
  return {
    plane: {
      origin: { x: lineStart.x, y: lineStart.y, z: lineStart.z },
      normal: isFlipped ? flipPlanNormal(normal) : normal,
    },
    viewDepthMm: Math.abs(signedDepthMm),
  };
}

// --- plan (x/z) segment vs. footprint crossing ---

interface PlanPoint {
  x: number;
  z: number;
}

/** 2D cross product of two plan vectors (z takes the y role in plan). */
const cross2d = (u: PlanPoint, v: PlanPoint): number => u.x * v.z - u.z * v.x;

const subtract2d = (a: PlanPoint, b: PlanPoint): PlanPoint => ({ x: a.x - b.x, z: a.z - b.z });

/**
 * Point-in-convex-footprint test: the point must not lie strictly on the far
 * side of any edge. Boundary points count as inside (an endpoint exactly on
 * an edge still yields only a touching chord, which the length guard drops).
 */
function isPointInFootprint(corners: Vec3[], point: PlanPoint): boolean {
  let side = 0;
  for (let i = 0; i < corners.length; i++) {
    const corner = corners[i];
    const cross = cross2d(subtract2d(corners[(i + 1) % corners.length], corner), subtract2d(point, corner));
    if (Math.abs(cross) <= LINE_TOLERANCE_MM) continue; // on the edge line
    const sign = Math.sign(cross);
    if (side === 0) {
      side = sign;
      continue;
    }
    if (sign !== side) return false;
  }
  return true;
}

interface SegmentVsFootprintOptions {
  corners: Vec3[];
  a: PlanPoint;
  b: PlanPoint;
}

/** Intersection points of the drag segment with the footprint edges. */
function edgeCrossings(options: SegmentVsFootprintOptions): PlanPoint[] {
  const { corners, a, b } = options;
  const crossings: PlanPoint[] = [];
  const r: PlanPoint = { x: b.x - a.x, z: b.z - a.z };
  for (let i = 0; i < corners.length; i++) {
    const c = corners[i];
    const d = corners[(i + 1) % corners.length];
    const s: PlanPoint = { x: d.x - c.x, z: d.z - c.z };
    const denominator = r.x * s.z - r.z * s.x;
    if (Math.abs(denominator) <= LINE_TOLERANCE_MM) continue; // parallel/collinear edge
    const ca: PlanPoint = { x: c.x - a.x, z: c.z - a.z };
    const t = (ca.x * s.z - ca.z * s.x) / denominator;
    const u = (ca.x * r.z - ca.z * r.x) / denominator;
    if (t < 0 || t > 1 || u < 0 || u > 1) continue;
    crossings.push({ x: a.x + t * r.x, z: a.z + t * r.z });
  }
  return crossings;
}

/**
 * Chord length (mm) of the drag segment through the footprint: edge crossings
 * plus in-footprint endpoints, deduplicated, farthest pair. 0 for a miss or a
 * grazing touch — the cut plane would contain no element area.
 */
function chordLengthThroughFootprint(options: SegmentVsFootprintOptions): number {
  const { corners, a, b } = options;
  const candidates = edgeCrossings(options);
  if (isPointInFootprint(corners, a)) candidates.push(a);
  if (isPointInFootprint(corners, b)) candidates.push(b);
  const unique = candidates.filter((point, index) =>
    candidates
      .slice(0, index)
      .every((other) => Math.hypot(point.x - other.x, point.z - other.z) > LINE_TOLERANCE_MM),
  );
  let longest = 0;
  for (let i = 0; i < unique.length; i++) {
    for (let j = i + 1; j < unique.length; j++) {
      longest = Math.max(longest, Math.hypot(unique[j].x - unique[i].x, unique[j].z - unique[i].z));
    }
  }
  return longest;
}

export interface FindCrossedElementsOptions {
  lineStart: Vec3;
  lineEnd: Vec3;
  elements: Record<string, ConcreteElement>;
}

/**
 * Ids of the elements whose plan footprint the line cuts with a real chord
 * (> tolerance). M0: every element is a wall — slabs/beams join the dispatch
 * when their kinds arrive (M3/M4).
 */
export function findElementsCrossedByLine(options: FindCrossedElementsOptions): string[] {
  const { lineStart, lineEnd, elements } = options;
  const a: PlanPoint = { x: lineStart.x, z: lineStart.z };
  const b: PlanPoint = { x: lineEnd.x, z: lineEnd.z };
  return Object.values(elements)
    .filter(
      (element) =>
        chordLengthThroughFootprint({ corners: wallFootprintCorners(element), a, b }) > LINE_TOLERANCE_MM,
    )
    .map((element) => element.id);
}

// --- plan geometry of a stored section (the 3D wireframe volume) ---

export interface SectionPlanGeometry {
  lineStart: Vec3;
  lineEnd: Vec3;
  /** Unit normal pointing INTO the viewed depth (= the plane normal). */
  normal: Vec3;
  viewDepthMm: number;
}

export function sectionPlanGeometry(section: SectionDefinition): SectionPlanGeometry {
  return {
    lineStart: section.lineStart,
    lineEnd: section.lineEnd,
    normal: section.plane.normal,
    viewDepthMm: section.viewDepth,
  };
}

/** Command-ready depth point for a plan geometry (on the viewed side). */
export function depthPointOf(geometry: SectionPlanGeometry): Vec3 {
  return {
    x: geometry.lineStart.x + geometry.normal.x * geometry.viewDepthMm,
    y: 0,
    z: geometry.lineStart.z + geometry.normal.z * geometry.viewDepthMm,
  };
}

export function isSameSectionGeometry(a: SectionPlanGeometry, b: SectionPlanGeometry): boolean {
  const samePoint = (p: Vec3, q: Vec3): boolean => Math.hypot(p.x - q.x, p.z - q.z) <= LINE_TOLERANCE_MM;
  return (
    samePoint(a.lineStart, b.lineStart) &&
    samePoint(a.lineEnd, b.lineEnd) &&
    Math.abs(a.viewDepthMm - b.viewDepthMm) <= LINE_TOLERANCE_MM &&
    a.normal.x * b.normal.x + a.normal.z * b.normal.z > 0
  );
}

/** The 4 plan corners of the viewed slab: front (cut line) start/end, then back end/start. */
export function sectionPlanRectangle(geometry: SectionPlanGeometry): [Vec3, Vec3, Vec3, Vec3] {
  const { lineStart, lineEnd, normal, viewDepthMm } = geometry;
  const behind = (point: Vec3): Vec3 => ({
    x: point.x + normal.x * viewDepthMm,
    y: 0,
    z: point.z + normal.z * viewDepthMm,
  });
  return [lineStart, lineEnd, behind(lineEnd), behind(lineStart)];
}

/** Plan corner names in sectionPlanRectangle order — corner handles map onto these. */
export const SECTION_PLAN_CORNERS = ['frontStart', 'frontEnd', 'backEnd', 'backStart'] as const;
export type SectionCorner = (typeof SECTION_PLAN_CORNERS)[number];

/** The 8 volume corners: bottom four (plan rectangle at y = 0), then top four. */
export function sectionVolumeCorners(options: { geometry: SectionPlanGeometry; heightMm: number }): Vec3[] {
  const { geometry, heightMm } = options;
  const plan = sectionPlanRectangle(geometry);
  return [...plan, ...plan.map((point) => ({ x: point.x, y: heightMm, z: point.z }))];
}

/** The 12 box edges as index pairs into sectionVolumeCorners' output. */
export const SECTION_VOLUME_EDGE_INDICES: ReadonlyArray<readonly [number, number]> = [
  [0, 1],
  [1, 2],
  [2, 3],
  [3, 0],
  [4, 5],
  [5, 6],
  [6, 7],
  [7, 4],
  [0, 4],
  [1, 5],
  [2, 6],
  [3, 7],
];

/** mm — minimum rendered slab dimensions (a zero-depth preview still draws). */
const MIN_VOLUME_DIMENSION_MM = 1;

export interface SectionVolumeTransform {
  center: Vec3;
  /** Yaw (radians, about +Y) aligning the box's local +X with the section line. */
  rotationY: number;
  lengthMm: number;
  depthMm: number;
  heightMm: number;
}

/** Box transform for the volume's grab-fill mesh (center/yaw/extents). */
export function sectionVolumeTransform(options: {
  geometry: SectionPlanGeometry;
  heightMm: number;
}): SectionVolumeTransform {
  const { geometry, heightMm } = options;
  const { lineStart, lineEnd, normal, viewDepthMm } = geometry;
  const dx = lineEnd.x - lineStart.x;
  const dz = lineEnd.z - lineStart.z;
  return {
    center: {
      x: (lineStart.x + lineEnd.x) / 2 + (normal.x * viewDepthMm) / 2,
      y: heightMm / 2,
      z: (lineStart.z + lineEnd.z) / 2 + (normal.z * viewDepthMm) / 2,
    },
    rotationY: Math.atan2(-dz, dx),
    lengthMm: Math.max(Math.hypot(dx, dz), MIN_VOLUME_DIMENSION_MM),
    depthMm: Math.max(viewDepthMm, MIN_VOLUME_DIMENSION_MM),
    heightMm,
  };
}

/** Wireframe height: the tallest target element; the fallback when the cut
 *  currently crosses nothing (targets recomputed on reshape can be empty). */
export function sectionVolumeHeightMm(options: {
  section: SectionDefinition;
  elements: Record<string, ConcreteElement>;
  fallbackMm: number;
}): number {
  let heightMm = 0;
  for (const elementId of options.section.targetElementIds) {
    const element = options.elements[elementId];
    if (element) heightMm = Math.max(heightMm, element.baseElevation + element.height);
  }
  return heightMm > 0 ? heightMm : options.fallbackMm;
}

// --- wireframe interaction (move / corner-stretch drags) ---

export interface SectionDragState {
  kind: 'move' | 'corner';
  /** Plan corner being stretched — set when kind is 'corner'. */
  corner?: SectionCorner;
  /** Ground-plane point at pointer-down and the latest one (both snapped). */
  startGround: Vec3;
  currentGround: Vec3;
}

const planShift = (point: Vec3, delta: PlanPoint): Vec3 => ({
  x: point.x + delta.x,
  y: 0,
  z: point.z + delta.z,
});

/** A front (cut-line) corner dragged to a ground point: the line re-forms from
 *  it; the normal keeps its previous side of the (possibly rotated) line. */
function dragFrontCorner(options: {
  geometry: SectionPlanGeometry;
  corner: SectionCorner;
  groundPoint: Vec3;
}): SectionPlanGeometry | null {
  const { geometry, corner, groundPoint } = options;
  const lineStart = corner === 'frontStart' ? groundPoint : geometry.lineStart;
  const lineEnd = corner === 'frontEnd' ? groundPoint : geometry.lineEnd;
  const candidate = planNormalFromLine(lineStart, lineEnd);
  if (candidate === null) return null; // collapsed line — commit will reject
  const isKeepingSide = candidate.x * geometry.normal.x + candidate.z * geometry.normal.z >= 0;
  return {
    lineStart,
    lineEnd,
    normal: isKeepingSide ? candidate : flipPlanNormal(candidate),
    viewDepthMm: geometry.viewDepthMm,
  };
}

/** A back corner dragged to a ground point: the line endpoint slides along the
 *  line direction; the perpendicular distance/side set the new view depth. */
function dragBackCorner(options: {
  geometry: SectionPlanGeometry;
  corner: SectionCorner;
  groundPoint: Vec3;
}): SectionPlanGeometry | null {
  const { geometry, corner, groundPoint } = options;
  const { lineStart, lineEnd, normal } = geometry;
  const length = Math.hypot(lineEnd.x - lineStart.x, lineEnd.z - lineStart.z);
  if (length < LINE_TOLERANCE_MM) return null;
  const dir: PlanPoint = { x: (lineEnd.x - lineStart.x) / length, z: (lineEnd.z - lineStart.z) / length };
  const relative = subtract2d(groundPoint, lineStart);
  const alongMm = relative.x * dir.x + relative.z * dir.z;
  const foot: Vec3 = { x: lineStart.x + dir.x * alongMm, y: 0, z: lineStart.z + dir.z * alongMm };
  const signedDepthMm = (groundPoint.x - foot.x) * normal.x + (groundPoint.z - foot.z) * normal.z;
  const isFlipped = signedDepthMm < 0;
  return {
    lineStart: corner === 'backStart' ? foot : lineStart,
    lineEnd: corner === 'backEnd' ? foot : lineEnd,
    normal: isFlipped ? flipPlanNormal(normal) : normal,
    viewDepthMm: Math.abs(signedDepthMm),
  };
}

/**
 * Applies an in-progress wireframe drag to a section's plan geometry. Null
 * when the result is degenerate (collapsed line) — the preview falls back and
 * the commit rejects. A move without real travel returns the input unchanged
 * (identity = "click, not a drag" for the commit path).
 */
export function applySectionDrag(options: {
  geometry: SectionPlanGeometry;
  drag: SectionDragState;
}): SectionPlanGeometry | null {
  const { geometry, drag } = options;
  if (drag.kind === 'move') {
    const delta = subtract2d(drag.currentGround, drag.startGround);
    if (Math.hypot(delta.x, delta.z) < LINE_TOLERANCE_MM) return geometry;
    return {
      ...geometry,
      lineStart: planShift(geometry.lineStart, delta),
      lineEnd: planShift(geometry.lineEnd, delta),
    };
  }
  if (!drag.corner) return null;
  if (drag.corner === 'frontStart' || drag.corner === 'frontEnd') {
    return dragFrontCorner({ geometry, corner: drag.corner, groundPoint: drag.currentGround });
  }
  return dragBackCorner({ geometry, corner: drag.corner, groundPoint: drag.currentGround });
}

// --- pointer ray → ground plane (wireframe handle drags) ---

/** Plan point where a pointer ray meets the ground plane (y = 0); null when
 *  the ray runs parallel to it or points away. */
export function groundPointFromRay(rayOrigin: Vec3, rayDirection: Vec3): Vec3 | null {
  if (Math.abs(rayDirection.y) < RAY_PARALLEL_EPSILON) return null;
  const t = -rayOrigin.y / rayDirection.y;
  if (t < 0) return null;
  return { x: rayOrigin.x + t * rayDirection.x, y: 0, z: rayOrigin.z + t * rayDirection.z };
}
