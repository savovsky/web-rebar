# 09 — Tech Libraries & Dependencies

> **Back to:** [README.md](../README.md)  
> **Related:** [Tech Stack](./03-tech-stack.md) | [Architecture Spec](./08-architecture-spec.md)  
> **Created:** 2026-07-28  
> **Status:** ✅ Installed 2026-08-08 — pinned versions below. Rust crates pending M0 WASM session.

> **package.json:** `C:\work\personal\projects\web-rebar\package.json`  
> **Lockfile:** `C:\work\personal\projects\web-rebar\pnpm-lock.yaml`  
> **Check actual versions:** `pnpm list --depth=0`

---

## Purpose

The complete list of chosen libraries for the project, with the role of each. This is the reference for:

- **Project init** — what goes into `package.json` and `Cargo.toml`
- **Implementation sessions** — do not add new runtime dependencies without checking this list; if a new one is truly needed, add it here first with rationale
- **Review** — any dependency in code that is not listed here (or in "Deferred") is a red flag

---

## Runtime Dependencies (npm — installed 2026-08-08)

| Package | Version | Role | Decided in |
| --- | --- | --- | --- |
| **react** | ^19.2.8 | UI framework — author's core expertise | [03](./03-tech-stack.md) |
| **react-dom** | ^19.2.8 | React renderer for the browser | [03](./03-tech-stack.md) |
| **@reduxjs/toolkit** | ^2.12.0 | State management. Thunks = the §N command layer; slices = reducers; Immer built in | [§E](./08-architecture-spec.md#e--state-management--undoredo) (revised 2026-07-28) |
| **react-redux** | ^9.3.0 | React bindings for the RTK store | [§E](./08-architecture-spec.md#e--state-management--undoredo) |
| **three** | ^0.185.1 | 3D rendering engine — viewport, meshes, instancing, raycasting | [03](./03-tech-stack.md), [§L](./08-architecture-spec.md#l--performance--rendering-strategy) |
| **@react-three/fiber** | ^9.7.0 | Declarative React renderer for Three.js | [03](./03-tech-stack.md) |
| **@react-three/drei** | ^10.7.8 | Utility components: orbit controls, gizmos, helpers | [03](./03-tech-stack.md) |
| **tailwindcss** | ^4.3.3 | Utility-first CSS for UI styling | [03](./03-tech-stack.md) |
| **@tailwindcss/vite** | ^4.3.3 | Tailwind v4 Vite plugin | [03](./03-tech-stack.md) |
| **jspdf** | ^4.2.1 | Vector PDF export — scale-accurate plan output | [§I.3](./08-architecture-spec.md#i--2d-drawing--pdf-pipeline) |
| **@radix-ui/react-tooltip** | ^1.2.16 | Tooltip primitive (M0) | [03](./03-tech-stack.md) |
| **@radix-ui/react-dialog** | ^1.1.23 | Dialog/modal primitive (M0) | [03](./03-tech-stack.md) |
| **@radix-ui/react-tabs** | ^1.1.21 | Tabbed panel primitive (M0) | [03](./03-tech-stack.md) |

### Runtime Dependencies — Not Yet Installed

| Package | Role | When | Decided in |
| --- | --- | --- | --- |
| **web-ifc** | IFC parsing and writing — import/export adapter | M2 (IFC round-trip) | [§D.4](./08-architecture-spec.md#d--wasm--typescript-boundary) |
| **rbush** | R-tree spatial index — label/leader collision detection | After M4 (annotation) | [§M.2](./08-architecture-spec.md#m--annotation--labeling-strategy) |
| **dxf-parser** | DXF import (or custom parser) | When DXF import is needed | [07](./07-browser-feasibility.md) |
| **shadcn/ui** *(vendored)* | Pre-styled Radix + Tailwind components | When first UI component is built | [03](./03-tech-stack.md) |

**Note on DXF export:** a custom writer (plain text formatting against our own vector primitives) — no library. See [07](./07-browser-feasibility.md).

**Note on BVBS:** future BVBS (Bundesverband Bewehrungsstahl bending-machine format) export is also a custom text writer. See [§J.4](./08-architecture-spec.md#j--bar-bending-schedule).

---

## Rust Crates (future `Cargo.toml` — WASM geometry engine)

| Crate | Role | Decided in |
| --- | --- | --- |
| **wasm-bindgen** | Rust ↔ JavaScript bindings (the WASM boundary) | [§D](./08-architecture-spec.md#d--wasm--typescript-boundary) |
| **nalgebra** | Linear algebra (vectors, matrices, transforms) for geometry math | [03](./03-tech-stack.md) |
| **parry3d** | Collision detection — bar-on-concrete, bar-on-bar distance checks | [03](./03-tech-stack.md), [§D](./08-architecture-spec.md#d--wasm--typescript-boundary) |
| **serde** + **serde-json** *(expected)* | (De)serialization of flat-array payloads across the boundary, if needed | [§D.3](./08-architecture-spec.md#d--wasm--typescript-boundary) |
| **rayon** *(optional, later)* | Parallel computation (multi-core bar generation). Requires SharedArrayBuffer + COOP/COEP (Cross-Origin headers) — validate before adopting | [03](./03-tech-stack.md) |

**WASM principle reminder (§D):** all Rust functions are stateless and pure; only flat arrays cross the boundary.

---

## Dev Dependencies (npm — installed 2026-08-08)

| Package | Version | Role |
| --- | --- | --- |
| **vite** | ^8.2.0 | Frontend build tool and dev server |
| **typescript** | ~6.0.2 | Type safety across the stack |
| **@vitejs/plugin-react** | ^6.0.4 | Vite React plugin (supports React Compiler if enabled later) |
| **eslint** | ^10.8.0 | Linting |
| **@eslint/js** | ^10.0.1 | ESLint JS config |
| **typescript-eslint** | ^8.65.0 | ESLint + TypeScript integration |
| **eslint-plugin-react-hooks** | ^7.1.1 | React Hooks lint rules |
| **eslint-plugin-react-refresh** | ^0.5.3 | HMR-safe lint rules |
| **globals** | ^17.7.0 | ESLint global definitions |
| **@types/react** | ^19.2.17 | React type definitions |
| **@types/react-dom** | ^19.2.3 | React DOM type definitions |
| **@types/node** | ^24.13.3 | Node.js type definitions |
| **prettier** | ^3.9.6 | Formatter — runs as an ESLint rule (`prettier/prettier`), options embedded in `eslint.config.js` (no standalone config file) |
| **eslint-plugin-prettier** | ^5.5.6 | Bridges Prettier into ESLint |
| **@trivago/prettier-plugin-sort-imports** | ^6.0.2 | Deterministic import ordering: react → third-party → `@/` alias → relative |

### Dev Dependencies — Not Yet Installed

| Package | Role | When |
| --- | --- | --- |
| **wasm-pack** (CLI) | Rust → WASM compilation with JS bindings | M0 WASM session (installed globally via cargo) |
| **pnpm** (CLI) | Package manager | Already installed globally (v11.20.0 as of 2026-08-08) |

**TBD (not yet decided — do not assume):**

- Test runner (Vitest is the natural Vite companion, but not locked)
- Vite WASM integration plugin (depends on wasm-pack output mode)

**Locked 2026-08-08:** the formatter question is resolved — **Prettier** (not Biome), enforced as an ESLint rule so `pnpm lint` is the single gate. The whole lint/format stack (type-checked `typescript-eslint` via `recommendedTypeChecked`, custom ruleset, Prettier options, import sorting) was adapted from the author's doxeek project config — see `eslint.config.js` header comment.

---

## Browser-Native APIs (no package — verify support, don't polyfill)

| API | Used for | Reference |
| --- | --- | --- |
| **Canvas2D** | Main 2D drawing rendering (sections, plans) | [§I](./08-architecture-spec.md#i--2d-drawing--pdf-pipeline) |
| **SVG (Scalable Vector Graphics) overlay** | Interactive handles, selection, dimension editing on 2D views | [§I](./08-architecture-spec.md#i--2d-drawing--pdf-pipeline) |
| **OPFS (Origin Private File System)** | `project.json` persistence | [§H](./08-architecture-spec.md#h--project-file-structure) |
| **IndexedDB (Indexed Database)** | App-level state: settings, UI layout, recent projects, autosave checkpoints | [§H.4](./08-architecture-spec.md#h--project-file-structure) |
| **Web Workers** | Heavy computation off the main thread (mesh generation, IFC parsing) | [07](./07-browser-feasibility.md), [§L](./08-architecture-spec.md#l--performance--rendering-strategy) |
| **Service Worker (PWA — Progressive Web App)** | Offline capability, asset caching | [07](./07-browser-feasibility.md) |
| **WebGL 2.0** | 3D viewport (via Three.js) | [07](./07-browser-feasibility.md) |
| **WebGPU** *(optional, future)* | Large-model rendering path | [07](./07-browser-feasibility.md), [§L](./08-architecture-spec.md#l--performance--rendering-strategy) |

Browser support matrix: see [07 — Browser API Requirements](./07-browser-feasibility.md).

---

## Deferred / Conditional Dependencies (NOT installed for M0–M4)

| Package | Role | When | Reference |
| --- | --- | --- | --- |
| **manifold-3d** | Lightweight WASM mesh booleans (CSG — Constructive Solid Geometry) — openings, junction handling | Only if Tier-2 sections / junctions require it | [§G.2](./08-architecture-spec.md#g--section--view-generation) |
| **opencascade.js** | Full BREP (Boundary Representation) kernel (30+ MB WASM) — **last resort only** | Only if Manifold proves insufficient | [§G.2](./08-architecture-spec.md#g--section--view-generation) |
| **@supabase/supabase-js** *(leaning, not decided)* | Cloud project storage + auth (BaaS — Backend as a Service) | Phase 2, after product value proven | [§H.4](./08-architecture-spec.md#h--project-file-structure) |
| **wa-sqlite** / **sql.js** | SQLite via WASM for large-scale element querying | Only if M4-scale filtering needs emerge | [§H.4](./08-architecture-spec.md#h--project-file-structure) |
| **@modelcontextprotocol/sdk** | MCP (Model Context Protocol) server — AI agents drive the command layer | Phase 2+, after tool is proven | [§N.2](./08-architecture-spec.md#n--command-layer--ai-extensibility) |
| **LLM (Large Language Model) provider SDK** | Natural-language detailing input (intent → command params) | Phase 2, after schemas stabilize | [§N.2](./08-architecture-spec.md#n--command-layer--ai-extensibility), README deferred topics |

---

## Explicitly Rejected

| Library | Why rejected | Reference |
| --- | --- | --- |
| **zustand** | Previously locked (2026-07-21); superseded by RTK on 2026-07-28 (author's Redux experience, thunk = command fit) | [§E](./08-architecture-spec.md#e--state-management--undoredo) |
| **react-aria** | Superseded by Radix UI (2026-07-28): steeper/verbose API; its advanced widgets aren't needed for M0–M4 | [03](./03-tech-stack.md) |
| **react-mosaic-component** | Rejected 2026-07-28: the §B.2 layout is fixed regions + one floatable section view — CSS grid + a custom floating panel (~150 lines) suffices; the library is sparsely maintained class-component-era code | [§B.2](./08-architecture-spec.md#b--user-interaction-model) |
| **OpenCASCADE.js as core kernel** | 30+ MB WASM, overkill for parametric/extrusion-based modeling | [03](./03-tech-stack.md), [§G](./08-architecture-spec.md#g--section--view-generation) |
| **SQLite (for PoC)** | JSON-in-OPFS is simpler and sufficient for target scale | [§H](./08-architecture-spec.md#h--project-file-structure) |
| **three-csg / @jscad/csg** | Listed as options in early feasibility; Manifold-3D preferred if CSG is needed | [07](./07-browser-feasibility.md), [§G.2](./08-architecture-spec.md#g--section--view-generation) |

---

## Maintenance Rule

When a dependency is added, replaced, or removed in any architecture discussion:

1. Update this file in the same session (with date)
2. Update the deciding section in [08-architecture-spec.md](./08-architecture-spec.md)
3. If it's a rejection, record it in "Explicitly Rejected" with rationale — so no future session re-proposes it without new arguments
