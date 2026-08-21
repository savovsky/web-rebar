// WASM bridge — the ONLY module allowed to import the generated wasm-bindgen glue (§D).
// Rust functions are stateless and pure; geometry crosses the boundary as flat arrays (§D.3).
// Regenerate the glue with `pnpm wasm:build` (output: src/core/pkg/, gitignored).
import initModule, * as wasmCore from '@/core/pkg/web_rebar_core';
import type { Vec3 } from '@/data/models';

let initPromise: Promise<void> | null = null;

export interface InitWasmOptions {
  /** Pre-loaded .wasm bytes — required under Node/vitest, where the glue's
   *  default `fetch(new URL(...))` cannot read file:// URLs. Browsers omit
   *  this and fetch the bundled asset. */
  wasmBytes?: BufferSource;
}

/** Loads and initializes the WASM module exactly once. Safe to call from anywhere. */
export function initWasm(options?: InitWasmOptions): Promise<void> {
  initPromise ??= initModule(options?.wasmBytes).then(() => undefined);
  return initPromise;
}

/** Crate version string — smoke-test that the WASM module loaded. */
export function coreVersion(): string {
  return wasmCore.core_version();
}

/** T1 round-trip probe: flat array in, scalar out. */
export function sumFlat(values: Float64Array): number {
  return wasmCore.sum_flat(values);
}

/** T1 round-trip probe: flat array in, flat array out (the §D.3 pattern). */
export function scaleFlat(values: Float64Array, factor: number): Float64Array {
  return wasmCore.scale_flat(values, factor);
}

/** T1 self-test: verifies the flat-array round-trip after init. */
export function wasmSelfTest(): {
  version: string;
  probeSum: number;
  probeScaled: Float64Array;
} {
  return {
    version: coreVersion(),
    probeSum: sumFlat(new Float64Array([1, 2, 3])),
    probeScaled: scaleFlat(new Float64Array([1, 2, 3]), 2),
  };
}

// --- §D.3 boundary functions ---

/** Render mesh as Three.js-ready typed arrays (Q1-b: Float32 verts, Uint32 indices). */
export interface BarMeshData {
  positions: Float32Array;
  normals: Float32Array;
  indices: Uint32Array;
}

export interface GenerateBarMeshParams {
  /** Flat xyz triples in mm: [x1,y1,z1, x2,y2,z2, ...] */
  pathPoints: Float64Array;
  /** Bar diameter in mm. */
  diameter: number;
  /** Cylinder radial resolution (§L.3 LOD: ~20 near, fewer far). */
  segments: number;
  /** Centerline arc radius at bends in mm (catalog mandrel radius + bar
   *  radius); 0 = sharp mitered joints. */
  bendRadiusMm: number;
}

/** Swept-cylinder mesh for a bar polyline. Degenerate input → empty arrays. */
export function generateBarMesh(params: GenerateBarMeshParams): BarMeshData {
  const mesh = wasmCore.generate_bar_mesh(
    params.pathPoints,
    params.diameter,
    params.segments,
    params.bendRadiusMm,
  );
  try {
    return { positions: mesh.positions, normals: mesh.normals, indices: mesh.indices };
  } finally {
    // Getters copy into JS-owned arrays — release the WASM-side struct immediately.
    mesh.free();
  }
}

export interface PlanePolylineIntersectionParams {
  /** A point on the cutting plane (mm). */
  planeOrigin: Vec3;
  /** Plane normal — normalized defensively on the Rust side (§D). */
  planeNormal: Vec3;
  /** Bar centerline as flat xyz triples (mm): [x1,y1,z1, x2,y2,z2, ...]. */
  pathPoints: Float64Array;
}

export interface GenerateBarGroupLayoutParams {
  /** Face frame as 12 flat f64: origin, u axis, v axis, outward normal. */
  faceFrame: Float64Array;
  /** Face-local region rect [uMin, uMax, vMin, vMax] (mm). */
  region: Float64Array;
  /** Placement rule [cover, diameter, spacing, edgeStart, edgeEnd] (mm). */
  rule: Float64Array;
  /** true = bars run along the face v axis (spaced along u); false = along u. */
  isVertical: boolean;
}

/** §F.2 layout result (M3): flat xyz triples (two endpoints per bar) + count. */
export interface BarGroupLayoutData {
  paths: Float64Array;
  barCount: number;
}

/**
 * Parametric face-local group sampling (M3 plan Q1-a): region rect + rule →
 * straight bar centerlines (pure arithmetic, no mesh). Invalid input yields
 * an empty layout — TS-side validation (engine/placement-group.ts) rejects
 * insane params with descriptive errors before the call.
 */
export function generateBarGroupLayout(params: GenerateBarGroupLayoutParams): BarGroupLayoutData {
  const layout = wasmCore.generate_bar_group_layout(
    params.faceFrame,
    params.region,
    params.rule,
    params.isVertical,
  );
  try {
    return { paths: layout.paths, barCount: layout.barCount() };
  } finally {
    layout.free();
  }
}

/**
 * §G.1 Tier 1: points where one bar's stored path crosses the section plane
 * (flat xyz triples, empty when nothing crosses). One call per bar; a bent
 * bar can cross 0..n times and each crossing becomes a section dot.
 */
export function planePolylineIntersection(params: PlanePolylineIntersectionParams): Float64Array {
  const { planeOrigin, planeNormal, pathPoints } = params;
  return wasmCore.plane_polyline_intersection(
    new Float64Array([planeOrigin.x, planeOrigin.y, planeOrigin.z]),
    new Float64Array([planeNormal.x, planeNormal.y, planeNormal.z]),
    pathPoints,
  );
}
