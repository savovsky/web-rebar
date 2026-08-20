/**
 * M2 T5 — 3D affine machinery for the DXF mapping layer: a basis-vector
 * affine (origin + three axis columns) with composition, plus the OCS
 * ("extrusion direction", DXF groups 210/220/230) reconstruction via
 * AutoCAD's arbitrary-axis algorithm. The OCS path is load-bearing on real
 * files — (0,0,-1) mirrored-plan entities/inserts are common in the author's
 * fixtures, and a tilted plane is what makes an arc unrepresentable in 2D.
 *
 * Same basis-vector shape as ifc-import.ts's PlacementTransform,
 * re-implemented locally because that module statically imports web-ifc
 * (importing IT from here would drag web-ifc into the DXF lazy chunk);
 * concerns also differ (tolerant normalize vs throwing).
 */
import type { Vec3 } from '@/data/models';

export interface Affine3 {
  origin: Vec3;
  xAxis: Vec3;
  yAxis: Vec3;
  zAxis: Vec3;
}

export const ORIGIN: Vec3 = { x: 0, y: 0, z: 0 };
const UNIT_X: Vec3 = { x: 1, y: 0, z: 0 };
const UNIT_Y: Vec3 = { x: 0, y: 1, z: 0 };
const UNIT_Z: Vec3 = { x: 0, y: 0, z: 1 };
export const IDENTITY_AFFINE: Affine3 = { origin: ORIGIN, xAxis: UNIT_X, yAxis: UNIT_Y, zAxis: UNIT_Z };

export const addVec3 = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });
export const scaleVec3 = (v: Vec3, s: number): Vec3 => ({ x: v.x * s, y: v.y * s, z: v.z * s });
const crossVec3 = (a: Vec3, b: Vec3): Vec3 => ({
  x: a.y * b.z - a.z * b.y,
  y: a.z * b.x - a.x * b.z,
  z: a.x * b.y - a.y * b.x,
});

export const applyAffinePoint = (affine: Affine3, p: Vec3): Vec3 =>
  addVec3(
    affine.origin,
    addVec3(
      addVec3(scaleVec3(affine.xAxis, p.x), scaleVec3(affine.yAxis, p.y)),
      scaleVec3(affine.zAxis, p.z),
    ),
  );

export const applyAffineVector = (affine: Affine3, v: Vec3): Vec3 =>
  addVec3(addVec3(scaleVec3(affine.xAxis, v.x), scaleVec3(affine.yAxis, v.y)), scaleVec3(affine.zAxis, v.z));

/** outer ∘ inner (inner applied first). */
export const composeAffine = (outer: Affine3, inner: Affine3): Affine3 => ({
  origin: applyAffinePoint(outer, inner.origin),
  xAxis: applyAffineVector(outer, inner.xAxis),
  yAxis: applyAffineVector(outer, inner.yAxis),
  zAxis: applyAffineVector(outer, inner.zAxis),
});

export const scaleAffine = (factor: number): Affine3 => ({
  origin: ORIGIN,
  xAxis: scaleVec3(UNIT_X, factor),
  yAxis: scaleVec3(UNIT_Y, factor),
  zAxis: scaleVec3(UNIT_Z, factor),
});

export const translationAffine = (offset: Vec3): Affine3 => ({
  origin: offset,
  xAxis: UNIT_X,
  yAxis: UNIT_Y,
  zAxis: UNIT_Z,
});

/** Rotation about the local +Z axis (DXF INSERT rotation is CCW degrees in
 *  the insert's own coordinate system). */
export const rotationZAffine = (radians: number): Affine3 => ({
  origin: ORIGIN,
  xAxis: { x: Math.cos(radians), y: Math.sin(radians), z: 0 },
  yAxis: { x: -Math.sin(radians), y: Math.cos(radians), z: 0 },
  zAxis: UNIT_Z,
});

export const axisScaleAffine = (scale: Vec3): Affine3 => ({
  origin: ORIGIN,
  xAxis: { x: scale.x, y: 0, z: 0 },
  yAxis: { x: 0, y: scale.y, z: 0 },
  zAxis: { x: 0, y: 0, z: scale.z },
});

/** AutoCAD arbitrary-axis algorithm: below this |x|/|y| the world Y axis
 *  serves as the pivot (the normal is near-vertical). */
const ARBITRARY_AXIS_PIVOT_DIVISOR = 64;
const ARBITRARY_AXIS_PIVOT_THRESHOLD = 1 / ARBITRARY_AXIS_PIVOT_DIVISOR;

/** The OCS basis affine for an extrusion normal; undefined/zero-length
 *  normals mean the default (identity — entity coordinates are world). */
export function ocsAffine(normal: Vec3 | undefined): Affine3 {
  if (normal === undefined) return IDENTITY_AFFINE;
  const length = Math.hypot(normal.x, normal.y, normal.z);
  if (length === 0) return IDENTITY_AFFINE; // corrupt zero extrusion — treat as default
  const zAxis = scaleVec3(normal, 1 / length);
  const pivot =
    Math.abs(zAxis.x) < ARBITRARY_AXIS_PIVOT_THRESHOLD && Math.abs(zAxis.y) < ARBITRARY_AXIS_PIVOT_THRESHOLD
      ? UNIT_Y
      : UNIT_Z;
  const xAxis = crossVec3(pivot, zAxis);
  const xUnit = scaleVec3(xAxis, 1 / Math.hypot(xAxis.x, xAxis.y, xAxis.z));
  return { origin: ORIGIN, xAxis: xUnit, yAxis: crossVec3(zAxis, xUnit), zAxis };
}
