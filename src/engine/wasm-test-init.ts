/// <reference types="node" />
// Test-only WASM init: under vitest (node env) the glue's default
// `fetch(new URL('...wasm', import.meta.url))` cannot read file:// URLs, so
// the bytes are loaded from disk and handed to the bridge. The pkg is
// gitignored — run `pnpm wasm:build` first (required for dev/build anyway).
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { initWasm } from './wasm-bridge';

export function initWasmFromDisk(): Promise<void> {
  const wasmPath = fileURLToPath(new URL('../core/pkg/web_rebar_core_bg.wasm', import.meta.url));
  // Uint8Array copy: Node's Buffer is typed over ArrayBufferLike, which is not
  // assignable to the bridge's BufferSource parameter.
  return initWasm({ wasmBytes: new Uint8Array(readFileSync(wasmPath)) });
}
