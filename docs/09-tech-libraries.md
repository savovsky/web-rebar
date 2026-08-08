# 09 — Tech Libraries & Dependencies

> **Back to:** [README.md](../README.md)  
> **Related:** [Tech Stack](./03-tech-stack.md) | [Architecture Spec](./08-architecture-spec.md)  
> **Created:** 2026-07-28  
> **Status:** Planned dependencies — nothing installed yet (no `package.json` exists). Versions are pinned at project init; until then "Latest" means latest stable at init time.

---

## Purpose

The complete list of chosen libraries for the project, with the role of each. This is the reference for:

- **Project init** — what goes into `package.json` and `Cargo.toml`
- **Implementation sessions** — do not add new runtime dependencies without checking this list; if a new one is truly needed, add it here first with rationale
- **Review** — any dependency in code that is not listed here (or in "Deferred") is a red flag

---

## Runtime Dependencies (npm — future `package.json` dependencies)

| Package | Role | Decided in |
| --- | --- | --- |
| **react** (v19) | UI (User Interface) framework — author's core expertise | [03](./03-tech-stack.md) |
| **react-dom** (v19) | React renderer for the browser | [03](./03-tech-stack.md) |
| **@reduxjs/toolkit** (RTK — Redux Toolkit) | State management. Thunks = the §N command layer; slices = reducers; Immer is built in | [§E](./08-architecture-spec.md#e--state-management--undoredo) (revised 2026-07-28) |
| **react-redux** | React bindings for the RTK store (`useSelector`, `useDispatch`) | [§E](./08-architecture-spec.md#e--state-management--undoredo) |
| **three** (Three.js) | 3D rendering engine (WebGL (Web Graphics Library) 2) — viewport, meshes, instancing, raycasting | [03](./03-tech-stack.md), [§L](./08-architecture-spec.md#l--performance--rendering-strategy) |
| **@react-three/fiber** (React Three Fiber) | Declarative React renderer for Three.js — 3D scene as components | [03](./03-tech-stack.md) |
| **@react-three/drei** | Utility components for R3F (React Three Fiber): orbit controls, gizmos, helpers | [03](./03-tech-stack.md) |
| **web-ifc** | IFC (Industry Foundation Classes) parsing and writing (existing WASM (WebAssembly) library) — import/export adapter | [§D.4](./08-architecture-spec.md#d--wasm--typescript-boundary) |
| **jspdf** | Vector PDF (Portable Document Format) export — scale-accurate plan output (A0–A4 + custom) | [§I.3](./08-architecture-spec.md#i--2d-drawing--pdf-pipeline) |
| **rbush** | R-tree spatial index in JavaScript — label/leader collision detection for auto-annotation | [§M.2](./08-architecture-spec.md#m--annotation--labeling-strategy) |
| **dxf-parser** | DXF (Drawing Exchange Format) import (or custom parser — DXF is ASCII; decide at implementation) | [07](./07-browser-feasibility.md) |
| **tailwindcss** | Utility-first CSS (Cascading Style Sheets) for UI styling | [03](./03-tech-stack.md) |
| **@radix-ui/react-*** | Accessible UI primitives (dialogs, dropdowns, tabs, tooltips, context menus). Locked 2026-07-28 — chosen over react-aria: standard Tailwind pairing, shadcn/ui ecosystem, larger community | [03](./03-tech-stack.md) |
| **shadcn/ui** *(not a runtime dependency — code is vendored into the repo)* | Pre-styled component layer built on Radix + Tailwind. Components are copied into `src/ui/components/` and owned by the project. Locked 2026-07-28 | [03](./03-tech-stack.md) |

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

## Dev Dependencies (npm — future `package.json` devDependencies)

| Package | Role |
| --- | --- |
| **vite** | Frontend build tool and dev server |
| **typescript** | Type safety across the stack |
| **wasm-pack** | Rust → WASM compilation with JS (JavaScript) bindings |
| **pnpm** | Package manager (workspace/monorepo support for future `core` package reuse in Node.js — see §N) |
| **@types/*** | Type definitions as needed (react, three, etc.) |

**TBD at project init (not yet decided — do not assume):**

- Test runner (Vitest is the natural Vite companion, but not locked)
- Linter/formatter (ESLint + Prettier or Biome — not locked)
- Vite WASM integration plugin (depends on wasm-pack output mode)

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
