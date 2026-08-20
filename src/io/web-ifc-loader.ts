/**
 * web-ifc lazy integration (§D.4, M2 T1). web-ifc ships a ~1.3 MB WASM module,
 * so it must never land in the shell bundle: the first IFC action triggers the
 * dynamic import + WASM init, and the initialized API is shared as a singleton.
 *
 * Runtime split:
 * - Browser: the package's ESM build is used; the .wasm asset URL comes from
 *   Vite (`?url`, content-hashed) and is handed to web-ifc through a custom
 *   locateFile handler, because SetWasmPath() only takes a directory prefix
 *   and cannot express a hashed file name.
 * - Node (vitest — the §N command layer is headless): the package's node build
 *   loads web-ifc-node.wasm from disk by itself; no path setup needed.
 */
import type { IfcAPI } from 'web-ifc';

const WEB_IFC_WASM_NAME = 'web-ifc.wasm';

let ifcApiPromise: Promise<IfcAPI> | null = null;

/**
 * Creates and initializes one isolated IfcAPI instance (its own WASM heap).
 * Tests and multi-model flows use this; app code should prefer loadIfcApi().
 */
export async function createIfcApi(): Promise<IfcAPI> {
  const webIfc = await import('web-ifc');
  const api = new webIfc.IfcAPI();
  if (typeof window === 'undefined') {
    // Node/vitest: the node build self-locates web-ifc-node.wasm via __dirname.
    await api.Init();
    return api;
  }
  const { default: wasmUrl } = await import('web-ifc/web-ifc.wasm?url');
  await api.Init((path: string) => (path === WEB_IFC_WASM_NAME ? wasmUrl : path));
  return api;
}

/** App-wide shared instance — created lazily on the first IFC action. */
export function loadIfcApi(): Promise<IfcAPI> {
  ifcApiPromise ??= createIfcApi();
  return ifcApiPromise;
}
