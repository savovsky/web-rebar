// WASM bridge — the ONLY module allowed to import the generated wasm-bindgen glue (§D).
// Rust functions are stateless and pure; geometry crosses the boundary as flat arrays (§D.3).
// Regenerate the glue with `pnpm wasm:build` (output: src/core/pkg/, gitignored).
import initModule, * as wasmCore from '@/core/pkg/web_rebar_core';

let initPromise: Promise<void> | null = null;

/** Loads and initializes the WASM module exactly once. Safe to call from anywhere. */
export function initWasm(): Promise<void> {
  initPromise ??= initModule().then(() => undefined);
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
}

/** Swept-cylinder mesh for a bar polyline. Degenerate input → empty arrays. */
export function generateBarMesh(params: GenerateBarMeshParams): BarMeshData {
  const mesh = wasmCore.generate_bar_mesh(params.pathPoints, params.diameter, params.segments);
  try {
    return { positions: mesh.positions, normals: mesh.normals, indices: mesh.indices };
  } finally {
    // Getters copy into JS-owned arrays — release the WASM-side struct immediately.
    mesh.free();
  }
}

export interface SectionPlaneIntersectionParams {
  planeOrigin: [number, number, number];
  planeNormal: [number, number, number];
  elementVertices: Float64Array;
}

export function sectionPlaneIntersection(_params: SectionPlaneIntersectionParams): Float64Array {
  throw new Error('Not implemented — see M0 task T9');
}
