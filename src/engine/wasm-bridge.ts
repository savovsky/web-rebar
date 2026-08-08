// WASM function bindings — stateless pure functions from Rust core
// Signatures defined during M0 implementation planning (§D.3: flat arrays across the boundary)

export function initWasm(): Promise<void> {
  // const wasm = await import('@/core/pkg/web_rebar')
  return Promise.resolve();
}

export interface GenerateBarMeshParams {
  pathPoints: Float64Array;
  diameter: number;
  segments: number;
}

export function generateBarMesh(_params: GenerateBarMeshParams): Float64Array {
  // Stub: calls WASM generate_bar_mesh, receives flat vertices
  throw new Error('Not implemented — see M0');
}

export interface SectionPlaneIntersectionParams {
  planeOrigin: [number, number, number];
  planeNormal: [number, number, number];
  elementVertices: Float64Array;
}

export function sectionPlaneIntersection(_params: SectionPlaneIntersectionParams): Float64Array {
  throw new Error('Not implemented — see M0');
}
