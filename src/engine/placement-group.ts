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

/** Element-local box normals per face key (wall local box: +X = axis,
 *  +Y = thickness, +Z = up). The face frame is then re-derived from the host
 *  transform on every call — host translation/rotation follows for free
 *  (M3 plan Q3-a). */
const FACE_KEY_LOCAL_NORMALS: Record<ElementFaceKey, Vec3> = {
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
