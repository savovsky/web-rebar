// Shared draft-feedback crosshair (§B.6): unit geometry in the ground (XY)
// plane — ±1 in X/Y, so one grid cell per arm when scaled by the grid spacing.
// The bar previews orient it onto a wall face via faceOrientation; all
// previews render it as an always-on-top overlay (depthTest off), like a CAD
// cursor.
import { BufferGeometry, Float32BufferAttribute, Quaternion, Vector3 } from 'three';
import type { Vec3 } from '@/data/models';

const CROSSHAIR_COMPONENTS = 3;
export const CROSSHAIR_RENDER_ORDER = 1;

/** The crosshair geometry's home normal (it lies in the XY ground plane). */
const UP_VECTOR = new Vector3(0, 0, 1);
const scratchNormal = new Vector3();
const scratchQuaternion = new Quaternion();

/** Quaternion rotating the ground-plane crosshair onto the face plane. */
export function faceOrientation(faceNormal: Vec3): Quaternion {
  scratchNormal.set(faceNormal.x, faceNormal.y, faceNormal.z);
  return scratchQuaternion.setFromUnitVectors(UP_VECTOR, scratchNormal);
}

/** Unit crosshair on the ground plane (±1 in X/Y) — scaled by the grid spacing. */
export function createCrosshairGeometry(): BufferGeometry {
  const geometry = new BufferGeometry();
  geometry.setAttribute(
    'position',
    new Float32BufferAttribute([-1, 0, 0, 1, 0, 0, 0, -1, 0, 0, 1, 0], CROSSHAIR_COMPONENTS),
  );
  return geometry;
}
