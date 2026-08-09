// Bar geometry orchestration: model bar path → THREE.BufferGeometry via the WASM core (§D).
// Components never call the bridge directly — they receive geometry from here (rule 2).
import { BufferAttribute, BufferGeometry } from 'three';
import { resolveBendRadiusMm } from '@/data/catalog/steel';
import type { Vec3 } from '@/data/models';
import { generateBarMesh } from './wasm-bridge';

/** §L.3 LOD: default radial resolution; far zoom reduces this (post-M0). */
const DEFAULT_BAR_SEGMENTS = 20;
const COMPONENTS_PER_POINT = 3;

export interface BarGeometryParams {
  /** Bar centerline in model space (mm) — sharp vertices; the bend radius is
   *  render geometry, the stored path keeps design intent (§M.4). */
  path: Vec3[];
  /** Bar diameter (mm). */
  diameter: number;
  segments?: number;
  /** Centerline bend radius override (mm) — defaults to the catalog mandrel
   *  radius for the diameter. User control arrives post-POC (properties). */
  bendRadiusMm?: number;
}

/** Builds a BufferGeometry for one bar. Caller owns disposal. */
export function createBarGeometry(params: BarGeometryParams): BufferGeometry {
  const flat = new Float64Array(params.path.length * COMPONENTS_PER_POINT);
  params.path.forEach((point, i) => {
    flat.set([point.x, point.y, point.z], i * COMPONENTS_PER_POINT);
  });
  const mesh = generateBarMesh({
    pathPoints: flat,
    diameter: params.diameter,
    segments: params.segments ?? DEFAULT_BAR_SEGMENTS,
    bendRadiusMm: params.bendRadiusMm ?? resolveBendRadiusMm(params.diameter),
  });
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(mesh.positions, COMPONENTS_PER_POINT));
  geometry.setAttribute('normal', new BufferAttribute(mesh.normals, COMPONENTS_PER_POINT));
  geometry.setIndex(new BufferAttribute(mesh.indices, 1));
  return geometry;
}
