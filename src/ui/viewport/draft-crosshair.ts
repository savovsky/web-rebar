// Shared draft-feedback crosshair (§B.6): unit geometry in the ground (XY)
// plane — ±1 in X/Y, so one grid cell per arm when scaled by the grid spacing.
// The bar preview orients it onto a wall face via quaternion; both previews
// render it as an always-on-top overlay (depthTest off), like a CAD cursor.
import { BufferGeometry, Float32BufferAttribute } from 'three';

const CROSSHAIR_COMPONENTS = 3;
export const CROSSHAIR_RENDER_ORDER = 1;

/** Unit crosshair on the ground plane (±1 in X/Y) — scaled by the grid spacing. */
export function createCrosshairGeometry(): BufferGeometry {
  const geometry = new BufferGeometry();
  geometry.setAttribute(
    'position',
    new Float32BufferAttribute([-1, 0, 0, 1, 0, 0, 0, -1, 0, 0, 1, 0], CROSSHAIR_COMPONENTS),
  );
  return geometry;
}
