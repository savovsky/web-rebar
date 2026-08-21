// Bar group layout orchestration (§F.2, M3 T2) — host + faceKey → FaceFrame
// → region rect → WASM layout → typed bar paths. Reuses the M0 face-frame
// math (getWallFaceFrame via wallLocalNormalToWorld) and the M0 cover clamp
// (applyConcreteCover) so generated bars keep their cover from ALL element
// faces, exactly like individually placed bars. Insane params throw here —
// the T3 command layer maps them to CommandError (plan door check: input
// validation in the §N doorway, not §K code-compliance).
// Pure and three-free (rule 2): components never compute this.
import { ELEMENT_FACE_KEYS, type ElementFaceKey, type FaceRegion, type Vec3 } from '@/data/models';
import { type FaceFrame, applyConcreteCover, getWallFaceFrame, wallLocalNormalToWorld } from './placement';
import { type WallGeometryParams, getWallTransform } from './wall-geometry';
import { generateBarGroupLayout } from './wasm-bridge';

const dot = (a: Vec3, b: Vec3): number => a.x * b.x + a.y * b.y + a.z * b.z;

/** Element-local box normals per face key (wall local box: +X = axis,
 *  +Y = thickness, +Z = up). The face frame is then re-derived from the host
 *  transform on every call — host translation/rotation follows for free
 *  (M3 plan Q3-a). */
export const FACE_KEY_LOCAL_NORMALS: Record<ElementFaceKey, Vec3> = {
  'face:negLength': { x: -1, y: 0, z: 0 },
  'face:posLength': { x: 1, y: 0, z: 0 },
  'face:negThickness': { x: 0, y: -1, z: 0 },
  'face:posThickness': { x: 0, y: 1, z: 0 },
  'face:top': { x: 0, y: 0, z: 1 },
  'face:bottom': { x: 0, y: 0, z: -1 },
};

/** Face half extents (mm) by key class — used to sanity-check the inward
 *  cover offset against the element dimension perpendicular to the face. */
type FaceKeyClass = 'length' | 'thickness' | 'horizontal';

function faceKeyClass(faceKey: ElementFaceKey): FaceKeyClass {
  if (faceKey === 'face:top' || faceKey === 'face:bottom') return 'horizontal';
  return faceKey.includes('Length') ? 'length' : 'thickness';
}

export function faceFrameForKey(host: WallGeometryParams, faceKey: ElementFaceKey): FaceFrame {
  const worldNormal = wallLocalNormalToWorld(host, FACE_KEY_LOCAL_NORMALS[faceKey]);
  return getWallFaceFrame(host, worldNormal);
}

/** Face key of a raycast hit face: the mesh-local box normal identifies the
 *  face exactly (box faces are axis-aligned in local space). The max-dot
 *  match is exact for box geometry, tolerant of float noise. */
export function faceKeyForLocalNormal(localNormal: Vec3): ElementFaceKey {
  let best: ElementFaceKey = 'face:posThickness';
  let bestDot = Number.NEGATIVE_INFINITY;
  for (const faceKey of ELEMENT_FACE_KEYS) {
    const alignment = dot(localNormal, FACE_KEY_LOCAL_NORMALS[faceKey]);
    if (alignment > bestDot) {
      bestDot = alignment;
      best = faceKey;
    }
  }
  return best;
}

/** Half extents (mm) of the face rect along the frame's in-plane axes — the
 *  same support-function shape as getWallFaceFrame's halfAlongNormal. Exact
 *  for the axis-aligned box faces of a parametric prism. */
function faceHalfExtents(host: WallGeometryParams, frame: FaceFrame): { halfU: number; halfV: number } {
  const transform = getWallTransform(host);
  const axis: Vec3 = { x: Math.cos(transform.rotationZ), y: Math.sin(transform.rotationZ), z: 0 };
  const thicknessDir: Vec3 = { x: -axis.y, y: axis.x, z: 0 };
  const along = (dir: Vec3): number =>
    Math.abs(dot(dir, axis)) * (transform.lengthMm / 2) +
    Math.abs(dot(dir, thicknessDir)) * (host.thickness / 2) +
    Math.abs(dir.z) * (host.height / 2);
  return { halfU: along(frame.u), halfV: along(frame.v) };
}

/** Whole-face region (M3 plan Q4-a default shortcut — "committing without
 *  dragging fills the captured face"): the full face rect in face-local
 *  (u,v); the frame origin is the face CENTER for box faces, so the rect is
 *  symmetric. Edge distances stay rule params (they inset from the rect). */
export function wholeFaceRegion(host: WallGeometryParams, faceKey: ElementFaceKey): FaceRegion {
  const frame = faceFrameForKey(host, faceKey);
  const { halfU, halfV } = faceHalfExtents(host, frame);
  return { uMin: -halfU, uMax: halfU, vMin: -halfV, vMax: halfV };
}

export interface FaceRegionFromCornersOptions {
  frame: FaceFrame;
  cornerA: Vec3;
  cornerB: Vec3;
}

/** Two corner points (on or off the plane — the normal component drops) →
 *  the normalized face-local region rect, either corner order. */
export function faceRegionFromCorners(options: FaceRegionFromCornersOptions): FaceRegion {
  const { frame, cornerA, cornerB } = options;
  const toFaceLocal = (point: Vec3): { u: number; v: number } => {
    const relative = {
      x: point.x - frame.origin.x,
      y: point.y - frame.origin.y,
      z: point.z - frame.origin.z,
    };
    return { u: dot(relative, frame.u), v: dot(relative, frame.v) };
  };
  const a = toFaceLocal(cornerA);
  const b = toFaceLocal(cornerB);
  return {
    uMin: Math.min(a.u, b.u),
    uMax: Math.max(a.u, b.u),
    vMin: Math.min(a.v, b.v),
    vMax: Math.max(a.v, b.v),
  };
}

export interface ResolveGroupRegionOptions {
  host: WallGeometryParams;
  faceKey: ElementFaceKey;
  /** Drag anchor corner on the face; null → whole face (Q4-a default). */
  cornerA: Vec3 | null;
  /** Drag release corner; null → whole face. */
  cornerB: Vec3 | null;
}

/** The group tool's gesture → region resolution (M3 T4): no drag corners =
 *  the whole-face default shortcut; two corners = the dragged rectangle. */
export function resolveGroupRegion(options: ResolveGroupRegionOptions): FaceRegion {
  const { host, faceKey, cornerA, cornerB } = options;
  if (cornerA === null || cornerB === null) return wholeFaceRegion(host, faceKey);
  return faceRegionFromCorners({ frame: faceFrameForKey(host, faceKey), cornerA, cornerB });
}

export interface GenerateBarGroupPathsParams {
  host: WallGeometryParams;
  faceKey: ElementFaceKey;
  /** Face-local (u,v) region rectangle. */
  region: FaceRegion;
  coverMm: number;
  diameterMm: number;
  /** Center-to-center spacing (mm) along the spacing axis. */
  spacingMm: number;
  edgeDistanceStartMm: number;
  edgeDistanceEndMm: number;
  /** 'horizontal' = bars run along the face u axis (spaced along v);
   *  'vertical' = run along v (spaced along u). */
  orientation: 'horizontal' | 'vertical';
}

const isFiniteNumber = (value: number): boolean => Number.isFinite(value);

function fail(message: string): never {
  throw new Error(`generateBarGroupPaths: ${message}`);
}

/** Region and numeric sanity (complexity-split helpers below `validateParams`). */
function validateRegionAndNumbers(params: GenerateBarGroupPathsParams): void {
  const { region, coverMm, diameterMm, spacingMm, edgeDistanceStartMm, edgeDistanceEndMm } = params;
  const numbers = [
    region.uMin,
    region.uMax,
    region.vMin,
    region.vMax,
    coverMm,
    diameterMm,
    spacingMm,
    edgeDistanceStartMm,
    edgeDistanceEndMm,
  ];
  if (!numbers.every(isFiniteNumber)) fail('all region/rule numbers must be finite');
  if (region.uMin >= region.uMax || region.vMin >= region.vMax) {
    fail('region must have positive extent on both axes');
  }
  if (diameterMm <= 0) fail('bar diameter must be positive');
  if (spacingMm <= 0) fail('spacing must be positive');
  if (coverMm < 0 || edgeDistanceStartMm < 0 || edgeDistanceEndMm < 0) {
    fail('cover and edge distances must not be negative');
  }
}

/** The inward offset (cover + radius) must fit the element dimension
 *  perpendicular to the sampled face. */
function validateCoverFit(params: GenerateBarGroupPathsParams): void {
  const { host, faceKey, coverMm, diameterMm } = params;
  const transform = getWallTransform(host);
  const inward = coverMm + diameterMm / 2;
  const faceClass = faceKeyClass(faceKey);
  let halfExtent: number;
  if (faceClass === 'length') halfExtent = transform.lengthMm / 2;
  else if (faceClass === 'thickness') halfExtent = host.thickness / 2;
  else halfExtent = host.height / 2;
  if (inward >= halfExtent) {
    fail(`cover + radius (${inward} mm) does not fit the element dimension (${halfExtent * 2} mm)`);
  }
}

/** Edge distances and cover-inset endpoints must fit the region spans. */
function validateRegionSpans(params: GenerateBarGroupPathsParams): void {
  const { region, coverMm, edgeDistanceStartMm, edgeDistanceEndMm, orientation } = params;
  const spacingExtent = orientation === 'horizontal' ? region.vMax - region.vMin : region.uMax - region.uMin;
  if (edgeDistanceStartMm + edgeDistanceEndMm > spacingExtent) {
    fail('edge distances exceed the region span');
  }
  const runExtent = orientation === 'horizontal' ? region.uMax - region.uMin : region.vMax - region.vMin;
  if (2 * coverMm > runExtent) {
    fail('cover insets exceed the region span along the bar direction');
  }
}

/** Validates the placement params — insane params throw here; the command
 *  doorway (T3) maps them to CommandError('INVALID_PARAMS'). */
function validateParams(params: GenerateBarGroupPathsParams): void {
  const { faceKey } = params;
  if (!ELEMENT_FACE_KEYS.includes(faceKey)) fail(`unknown face key: ${faceKey as string}`);
  validateRegionAndNumbers(params);
  validateCoverFit(params);
  validateRegionSpans(params);
}

const COMPONENTS_PER_POINT = 3;
const FRAME_COMPONENTS = 12;
const ENDPOINTS_PER_BAR = 2;

/**
 * Rule-exact straight bar centerlines (M3 plan Q1-a): the WASM call samples
 * the face-local region; then `applyConcreteCover` clamps every endpoint
 * against ALL element faces (the M0 semantics — edges/start/end included).
 * Returns one 2-point path per bar in layout order.
 */
export function generateBarGroupPaths(params: GenerateBarGroupPathsParams): Vec3[][] {
  validateParams(params);
  const { host, faceKey, region, coverMm, diameterMm, orientation } = params;
  const frame = faceFrameForKey(host, faceKey);
  const frameParts = [frame.origin, frame.u, frame.v, frame.normal];
  const flatFrame = new Float64Array(FRAME_COMPONENTS);
  frameParts.forEach((part, index) => {
    flatFrame.set([part.x, part.y, part.z], index * COMPONENTS_PER_POINT);
  });
  const layout = generateBarGroupLayout({
    faceFrame: flatFrame,
    region: new Float64Array([region.uMin, region.uMax, region.vMin, region.vMax]),
    rule: new Float64Array([
      coverMm,
      diameterMm,
      params.spacingMm,
      params.edgeDistanceStartMm,
      params.edgeDistanceEndMm,
    ]),
    isVertical: orientation === 'vertical',
  });
  const paths: Vec3[][] = [];
  for (let bar = 0; bar < layout.barCount; bar++) {
    const offset = bar * ENDPOINTS_PER_BAR * COMPONENTS_PER_POINT;
    const points: Vec3[] = [];
    for (let endpoint = 0; endpoint < ENDPOINTS_PER_BAR; endpoint++) {
      const at = offset + endpoint * COMPONENTS_PER_POINT;
      points.push({ x: layout.paths[at], y: layout.paths[at + 1], z: layout.paths[at + 2] });
    }
    paths.push(applyConcreteCover({ path: points, wall: host, coverMm, radiusMm: diameterMm / 2 }));
  }
  return paths;
}
