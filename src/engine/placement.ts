// Bar placement math (§F) — pure and three-free (rule 2: components never compute this).
// M0 (T8): resolve a clicked wall face into a face frame (origin + in-plane
// axes), project/snap points onto the face plane, and offset the bar centerline
// inward from the face. Group placement / face sampling (§F.2) arrives at M3.
import type { Vec3 } from '@/data/models';
import { type WallGeometryParams, getWallTransform } from './wall-geometry';

const UNIT_Z: Vec3 = { x: 0, y: 0, z: 1 };
/** |normal·up| at/above this → the face is horizontal (wall top/bottom). */
const HORIZONTAL_FACE_DOT = 0.99;

/**
 * Local 2D frame of a wall face in model space: `origin` sits on the face
 * plane, `u` runs along the face horizontally, `v` runs "up" (+Z) the face
 * (for horizontal faces: u = wall axis, v = across the thickness).
 */
export interface FaceFrame {
  origin: Vec3;
  /** Outward unit normal (world space) — defines the cover offset direction. */
  normal: Vec3;
  u: Vec3;
  v: Vec3;
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

/** Rotates a wall-mesh local direction (e.g. a raycast face normal) into world
 *  space — walls are yawed only, so this is a pure Z-rotation. */
export function wallLocalNormalToWorld(wall: WallGeometryParams, localNormal: Vec3): Vec3 {
  const { rotationZ } = getWallTransform(wall);
  const cos = Math.cos(rotationZ);
  const sin = Math.sin(rotationZ);
  // R_z(θ) · (x,y,z) = (x·cosθ − y·sinθ, x·sinθ + y·cosθ, z)
  return normalize({
    x: localNormal.x * cos - localNormal.y * sin,
    y: localNormal.x * sin + localNormal.y * cos,
    z: localNormal.z,
  });
}

/** Face frame for the wall face with the given outward world normal. The origin
 *  is the box support point along the normal (center + half-extent in that
 *  direction) — exact for the axis-aligned faces of the wall box. */
export function getWallFaceFrame(wall: WallGeometryParams, faceNormal: Vec3): FaceFrame {
  const transform = getWallTransform(wall);
  const axis: Vec3 = { x: Math.cos(transform.rotationZ), y: Math.sin(transform.rotationZ), z: 0 };
  const thicknessDir: Vec3 = { x: -Math.sin(transform.rotationZ), y: Math.cos(transform.rotationZ), z: 0 };
  const halfAlongNormal =
    Math.abs(dot(faceNormal, axis)) * (transform.lengthMm / 2) +
    Math.abs(dot(faceNormal, UNIT_Z)) * (wall.height / 2) +
    Math.abs(dot(faceNormal, thicknessDir)) * (wall.thickness / 2);
  const isHorizontal = Math.abs(dot(faceNormal, UNIT_Z)) >= HORIZONTAL_FACE_DOT;
  return {
    origin: add(transform.center, scale(faceNormal, halfAlongNormal)),
    normal: faceNormal,
    u: isHorizontal ? axis : normalize(cross(UNIT_Z, faceNormal)),
    v: isHorizontal ? normalize(cross(faceNormal, axis)) : UNIT_Z,
  };
}

const RAY_PARALLEL_EPSILON = 1e-9;

export interface RayFacePlanePointOptions {
  frame: FaceFrame;
  rayOrigin: Vec3;
  rayDirection: Vec3;
}

/** Ray ∩ face plane (mm) — the pointer position for a CAPTURED drag, where
 *  the cursor may have left the mesh surface (pointer capture keeps events
 *  flowing; only the ray is reliable). Returns null when the ray is parallel
 *  to the face or points away from it (the groundPointFromRay convention). */
export function rayFacePlanePoint(options: RayFacePlanePointOptions): Vec3 | null {
  const { frame, rayOrigin, rayDirection } = options;
  const denominator = dot(rayDirection, frame.normal);
  if (Math.abs(denominator) < RAY_PARALLEL_EPSILON) return null;
  const t = dot(subtract(frame.origin, rayOrigin), frame.normal) / denominator;
  if (t < 0) return null;
  return add(rayOrigin, scale(rayDirection, t));
}

export interface ResolveFacePointOptions {
  frame: FaceFrame;
  /** Raw raycast hit in model space (need not lie on the face plane). */
  worldPoint: Vec3;
  gridSpacingMm: number;
  isSnapEnabled: boolean;
}

/** Projects a world point onto the face plane and snaps its in-plane (u,v)
 *  coordinates to the grid (§B.3). The normal component is always dropped, so
 *  the result lies exactly on the face even when snapping is off. */
export function resolveFacePoint({
  frame,
  worldPoint,
  gridSpacingMm,
  isSnapEnabled,
}: ResolveFacePointOptions): Vec3 {
  const relative = subtract(worldPoint, frame.origin);
  const snap = (value: number): number =>
    isSnapEnabled && gridSpacingMm > 0 ? Math.round(value / gridSpacingMm) * gridSpacingMm : value;
  const alongU = snap(dot(relative, frame.u));
  const alongV = snap(dot(relative, frame.v));
  return add(frame.origin, add(scale(frame.u, alongU), scale(frame.v, alongV)));
}

export interface OffsetFromFaceOptions {
  /** Point on the face plane. */
  point: Vec3;
  /** Outward face normal. */
  faceNormal: Vec3;
  /** Inward distance (mm) — cover + bar radius for a bar centerline. */
  distanceMm: number;
}

/** Moves a face point inward along the (outward) normal — the bar centerline
 *  sits at cover + radius inside the concrete. */
export function offsetFromFace({ point, faceNormal, distanceMm }: OffsetFromFaceOptions): Vec3 {
  return subtract(point, scale(faceNormal, distanceMm));
}

// --- concrete cover against ALL element faces (wall-local box clamping) ---

/** Wall-local box frame: +X along the axis, +Y across the thickness, +Z up. */
interface LocalBoxFrame {
  center: Vec3;
  rotationZ: number;
  halfX: number;
  halfY: number;
  halfZ: number;
}

const toLocal = (point: Vec3, frame: LocalBoxFrame): Vec3 => {
  const dx = point.x - frame.center.x;
  const dy = point.y - frame.center.y;
  const cos = Math.cos(frame.rotationZ);
  const sin = Math.sin(frame.rotationZ);
  // local = R_z(−θ) · (world − center)
  return { x: dx * cos + dy * sin, y: -dx * sin + dy * cos, z: point.z - frame.center.z };
};

const toWorld = (local: Vec3, frame: LocalBoxFrame): Vec3 => {
  const cos = Math.cos(frame.rotationZ);
  const sin = Math.sin(frame.rotationZ);
  return {
    x: frame.center.x + local.x * cos - local.y * sin,
    y: frame.center.y + local.x * sin + local.y * cos,
    z: frame.center.z + local.z,
  };
};

interface ClampAxisOptions {
  value: number;
  halfExtent: number;
  inset: number;
}

const clampAxis = ({ value, halfExtent, inset }: ClampAxisOptions): number => {
  const lo = -halfExtent + inset;
  const hi = halfExtent - inset;
  // Cover thicker than the element itself — collapse onto the center plane.
  if (lo > hi) return 0;
  return Math.min(Math.max(value, lo), hi);
};

/** Unit directions of the segment(s) adjacent to path vertex `index`. */
const adjacentDirections = (localPath: Vec3[], index: number): Vec3[] => {
  const directions: Vec3[] = [];
  if (index > 0) directions.push(normalize(subtract(localPath[index], localPath[index - 1])));
  if (index < localPath.length - 1) {
    directions.push(normalize(subtract(localPath[index + 1], localPath[index])));
  }
  return directions;
};

interface AxisInsetOptions {
  directions: Vec3[];
  axis: keyof Vec3;
  coverMm: number;
  radiusMm: number;
}

/** Inset along one local axis: cover + radius projected onto that axis. A
 *  segment running INTO a face (|d·axis| = 1) needs only cover — the flat end
 *  cap stops at the centerline endpoint; a segment running ALONG a face needs
 *  cover + radius — the cylinder surface bulges toward it. */
const axisInset = ({ directions, axis, coverMm, radiusMm }: AxisInsetOptions): number =>
  coverMm + radiusMm * Math.max(...directions.map((d) => Math.sqrt(Math.max(0, 1 - d[axis] * d[axis]))));

export interface ApplyConcreteCoverOptions {
  /** Centerline path (already offset inward from the captured face). */
  path: Vec3[];
  wall: WallGeometryParams;
  coverMm: number;
  radiusMm: number;
}

/**
 * Pulls every path vertex fully inside the element so the bar keeps the given
 * concrete cover from ALL faces: vertices clicked on/near an edge are offset
 * from both planes forming the edge, and the bar start/end keep cover from
 * the faces they terminate at. Works in wall-local box coordinates where the
 * six faces are three independent axis pairs, so per-axis clamping is exact.
 */
export function applyConcreteCover({ path, wall, coverMm, radiusMm }: ApplyConcreteCoverOptions): Vec3[] {
  const transform = getWallTransform(wall);
  const frame: LocalBoxFrame = {
    center: transform.center,
    rotationZ: transform.rotationZ,
    halfX: transform.lengthMm / 2,
    halfY: wall.thickness / 2,
    halfZ: wall.height / 2,
  };
  const localPath = path.map((point) => toLocal(point, frame));
  return localPath.map((local, index) => {
    const directions = adjacentDirections(localPath, index);
    return toWorld(
      {
        x: clampAxis({
          value: local.x,
          halfExtent: frame.halfX,
          inset: axisInset({ directions, axis: 'x', coverMm, radiusMm }),
        }),
        y: clampAxis({
          value: local.y,
          halfExtent: frame.halfY,
          inset: axisInset({ directions, axis: 'y', coverMm, radiusMm }),
        }),
        z: clampAxis({
          value: local.z,
          halfExtent: frame.halfZ,
          inset: axisInset({ directions, axis: 'z', coverMm, radiusMm }),
        }),
      },
      frame,
    );
  });
}

export interface ResolveBarCenterlineOptions {
  /** Clicked points on the captured face plane (projected + snapped). */
  facePoints: Vec3[];
  /** Frame of the captured face. */
  frame: FaceFrame;
  wall: WallGeometryParams;
  coverMm: number;
  radiusMm: number;
}

/**
 * Face-plane clicks → final bar centerline: offset inward from the captured
 * face by cover + radius, then applyConcreteCover pulls every vertex inside
 * the element so the whole bar keeps its cover (edges, start, and end).
 */
export function resolveBarCenterline({
  facePoints,
  frame,
  wall,
  coverMm,
  radiusMm,
}: ResolveBarCenterlineOptions): Vec3[] {
  const offsetPath = facePoints.map((point) =>
    offsetFromFace({ point, faceNormal: frame.normal, distanceMm: coverMm + radiusMm }),
  );
  return applyConcreteCover({ path: offsetPath, wall, coverMm, radiusMm });
}
