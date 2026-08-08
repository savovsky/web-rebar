# 03 — Recommended Tech Stack

> **Back to:** [README.md](../README.md)  
> **Related:** [Browser Feasibility](./07-browser-feasibility.md) | [Module Architecture](./05-module-architecture.md)

---

## Architecture Overview

```
┌──────────────────────────────────────────────────────┐
│                    BROWSER (PWA)                      │
│                                                       │
│  ┌─────────────────┐  ┌────────────────────────────┐ │
│  │   React 19       │  │   WASM (Rust via wasm-pack) │ │
│  │   + RTK          │  │                              │ │
│  │   + Three.js     │  │   ┌──────────────────────┐  │ │
│  │   Fiber + Drei   │  │   │ Geometry Engine       │  │ │
│  │                   │  │   │ - parry3d (collision) │  │ │
│  │  3D Viewport     │  │   │ - nalgebra (math)     │  │ │
│  │  2D Plan View    │  │   │ - custom CSG          │  │ │
│  │  Property Panels │  │   │ - IFC parser/writer   │  │ │
│  │  Tree Views      │  │   └──────────────────────┘  │ │
│  │                   │  │                              │ │
│  │                   │  │   ┌──────────────────────┐  │ │
│  │                   │  │   │ Reinforcement Solver  │  │ │
│  │                   │  │   │ - Bar placement       │  │ │
│  │                   │  │   │ - Cover validation    │  │ │
│  │                   │  │   │ - Anchorage/lap calc  │  │ │
│  │                   │  │   │ - BVBS export         │  │ │
│  │                   │  │   └──────────────────────┘  │ │
│  └─────────────────┘  └────────────────────────────┘ │
│                                                       │
│  ┌─────────────────────────────────────────────────┐ │
│  │  Storage: OPFS (Origin Private File System)      │ │
│  │  + JSON project snapshots + IFC export            │ │
│  └─────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────┘
```

---

## Frontend

| Technology | Version | Purpose |
|---|---|---|
| **React** | 19 | UI framework (author's expertise) |
| **Redux Toolkit (RTK)** | Latest | State management — thunks = §N command layer, Immer built in (revised 2026-07-28) |
| **React Three Fiber** | Latest | Declarative Three.js in React |
| **Drei** | Latest | Utility components for R3F (orbit controls, helpers) |
| **Tailwind CSS** | Latest | Styling |
| **Radix UI** | Latest | Accessible primitives (dialogs, dropdowns, tabs, tooltips). Locked 2026-07-28 over react-aria |
| **shadcn/ui** | Latest | Pre-styled components on Radix + Tailwind; code vendored into the repo, not a runtime dependency. Locked 2026-07-28 |

### Why React + Three.js Fiber

- Author has 10 years of React experience
- Three.js Fiber allows writing 3D scenes as React components
- Drei provides orbit controls, gizmos, and helpers out of the box
- Large ecosystem for 2D canvas, SVG, and UI components

### SPA (Single Page Application) Shape

The app is a desktop-class SPA: long-lived session, large in-memory state, continuous rendering — no server rendering involved. Implications:
- Accept a 2–5 MB initial load (Three.js + WASM) with a proper loading state
- Memory discipline matters (meshes excluded from undo snapshots — Architecture Spec §E)
- A future marketing/landing page is a separate server-rendered site, never mixed into the app
- Same codebase can later be wrapped in Tauri/Electron for desktop distribution

### UI Panels (Docking Layout)

**Locked 2026-07-28: custom layout, no docking library.** The §B.2 screen layout is fixed regions (left toolbar, center viewport, right tabbed panel) plus ONE floatable/dockable 2D section view. CSS grid for the fixed regions + a custom floating panel (pointer-event dragging, ~150 lines) covers this — no need for IDE-style tiling libraries (react-mosaic-component rejected: sparsely maintained, class-component era).

Panels:
- **3D Viewport** — main working area
- **2D Plan View** — section/plan display (dockable or floating)
- **Property Panel** — edit selected element properties
- **Building Tree** — floor/element hierarchy
- **Tool Palette** — modeling and reinforcement tools

---

## Geometry & Solver Engine

| Component | Technology | Why |
|---|---|---|
| **Language** | Rust | Type-safe, zero-cost abstractions, excellent WASM support |
| **WASM build** | wasm-pack | Compiles Rust to .wasm + JS bindings |
| **Linear algebra** | nalgebra | Comprehensive math library |
| **Collision detection** | parry3d | Specialized for bar-on-concrete, bar-on-bar |
| **CSG operations** | Custom or Manifold-3D (lightweight WASM mesh booleans) | For concrete element Boolean ops (opening subtracts); OpenCASCADE.js last resort |
| **IFC read/write** | web-ifc (existing WASM) or custom Rust | Parse and generate IFC-SPF |

### Why Rust + WASM

- **Performance:** Near-native speed for geometry computation
- **Safety:** No memory bugs in the geometry kernel
- **Parallelism:** Rayon for parallel bar generation on multi-core
- **Type system:** Rust enums + pattern matching map perfectly to reinforcement type hierarchies
- **Single codebase:** Same Rust code serves WASM (browser) and native (future CLI/server)

### Why Not OpenCASCADE.js for the Core?

OpenCASCADE.js is a full BREP kernel compiled to WASM:
- **Pros:** Complete solid modeling, section generation (HlrBRep)
- **Cons:** 30+ MB WASM file, slow startup, overkill for extrusion-based modeling

**Decision:** Start with parametric profiles + data-query sections (Architecture Spec §G). For mesh booleans (openings, junctions), prefer Manifold-3D. Adopt OpenCASCADE.js only as a last-resort fallback for NURBS surfaces or complex BREP operations.

---

## Data Storage

| Layer | Technology | Purpose |
|---|---|---|
| **Runtime** | RTK store (in-memory) | Application state, undo/redo snapshots |
| **Persistence** | OPFS (Origin Private File System) | `project.json` — one self-contained file per project |
| **App state** | IndexedDB (Indexed Database) | Settings, UI layout, recent-project list, autosave checkpoints |
| **Export** | IFC-SPF text files | Interoperability, archive |
| **Import** | IFC parser, DXF parser | Load external data |
| **Cloud (deferred)** | BaaS (Backend as a Service), Phase 2 | Upload/download of `project.json`; Supabase-leaning (Architecture Spec §H.4) |

### Internal Model + IFC Adapters

**Updated 2026-07-28** — The runtime/storage model is an internal TypeScript/JSON model designed for editing workflows (Architecture Spec §C). IFC is import/export only, via an adapter layer. (This doc previously proposed IFC-as-native — superseded.)

Rationale: IFC stores results (3D positions), not design intent (cover distance, spacing rules, placement parameters). Design intent must be preserved for editing and re-generation.

The adapter maps to standard IFC entities:
- `IfcBuilding` / `IfcBuildingStorey` → building structure
- `IfcWall`, `IfcSlab`, `IfcBeam`, `IfcColumn` → concrete elements
- `IfcReinforcingBar`, `IfcReinforcingMesh` → reinforcement
- `IfcProductDefinitionShape` → geometry (extrusions, faceted BREP)

Benefits kept:
- Import/export via web-ifc (existing WASM library)
- No proprietary lock-in for exchange
- BIM (Building Information Modeling) interoperability out of the box

---

## Build Tooling

| Tool | Version | Purpose |
| --- | --- | --- |
| **Vite** | 8.2 | Frontend build (fast, React support) |
| **wasm-pack** | (pending M0) | Rust → WASM compilation |
| **pnpm** | 11.20 | Package manager |
| **TypeScript** | 6.0 | Type safety across the stack |

---

## Hardware Requirements

### Target Minimum

| Component | Requirement |
|---|---|
| **CPU** | Any dual-core from 2018+ |
| **RAM** | 8 GB (16 GB for large projects) |
| **GPU** | Integrated graphics (Intel UHD 600+, AMD Radeon Vega, Apple M1+) |
| **Browser** | Chrome 100+, Edge 100+, Firefox 100+, Safari 16+ |
| **OS** | Windows, macOS, Linux, ChromeOS |

### Performance Targets

| Scenario | Bars | Memory | 3D Viewport | Section Time |
|---|---|---|---|---|
| Small (house) | ~500-2,000 | ~50 MB | 60 FPS | <200ms |
| Medium (apartment) | ~5,000-20,000 | ~100 MB | 30-60 FPS | <1s |
| Large (high-rise) | ~50,000+ | ~500 MB | 30 FPS+ (WebGPU) | <5s |

### Why This Is Possible

- Allplan loads ACIS + ODA + .NET CLR + Cineware simultaneously — **~2 GB RAM baseline**
- Our app loads only the WASM geometry engine — **~50 MB baseline**
- No legacy graphics stack — WebGL 2.0 is lightweight and GPU-accelerated
- IFC/JSON is loaded on-demand, not a monolithic binary

### Hardware Cost Comparison

| | Allplan 2022 | Our App |
|---|---|---|
| Minimum computer cost | ~€2,000 | ~€400 |
| Annual license | ~€3,000 | TBD (fraction) |
| OS requirement | Windows only | Any modern browser |
| GPU requirement | Discrete GPU | Integrated GPU |