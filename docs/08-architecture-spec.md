# 08 — Architecture Specification

> **Back to:** [README.md](../README.md)  
> **Date:** 2026-07-21  
> **Status:** Decisions locked — implementation-ready

---

## Purpose

This document captures all architectural decisions made during tech-design sessions. Each decision is locked — it has been discussed, alternatives considered, and a path chosen. This is the single source of truth for the development plan.

When a decision must be revisited, update this document and note the revision date and rationale.

---

## A — MVP Scope & Milestone Sequence

**Decision:** Staged milestones, each a blocker-finding probe into a specific architectural risk.

| Milestone | Deliverable | Risk It Probes |
| --- | --- | --- |
| **M0: One Wall, One Bar** | Fixed wall in 3D viewport. User places one straight bar at correct cover. One section cuts wall, shows bar as dot. | WASM bundle size/load; section algorithm correctness; Rust↔TS data passing |
| **M1: Edit + Reactivity** | Move wall → section updates. Undo/redo. | Dependency graph correctness; full recompute performance; undo stack memory |
| **M2: Adapters Round-Trip (IFC + DXF)** (revised 2026-08-09 — was "IFC Round-Trip") | Model wall+bar → export IFC → reload → identical model. DXF: import 2D linework as a reference background (the doc-11 tracing workflow); export a section view to DXF | IFC schema fit; web-ifc write capability; lossless round-trip; DXF units/blocks/real-file handling; reference-background storage (Layer Model door) |
| **M3: Real Bar Placement** | Multi-bar placement on face with spacing, cover, edge distance | Face sampling algorithm; collision detection; placement UX |
| **M4: Multi-Element Building** | 5 floors, 3 wall types, 2 slab types, real reinforcement | Performance at scale; building tree UX; OPFS storage size |

> **Revised 2026-08-09 — M2 scope widened from IFC-only to IFC + DXF adapters (author decision).** Rationale: the POC's job is finding tech walls as early as possible, and DXF is the second §C adapter — probing both in one milestone validates the whole adapter-layer pattern (two adapters prove the pattern; one proves only the exception). DXF's walls are different from IFC's: not parsing (doc 07 rates it low-effort) but units/scale handling, real-world block/insert explosion, and — the one architectural question — **where imported 2D reference linework lives in the model**, which must NOT silently preempt the deferred **Layer Model** topic (decided explicitly in the M2 plan). DXF scope in M2: import as 2D reference background + export of a §G.1 section view. Explicitly out: DXF→3D model entity mapping (DXF carries no 3D design intent — doc 07: "IFC for 3D, DXF for 2D reference drawings") and DWG (stays a Deferred Topic).

**Rationale:** M0-M2 are architecture-validation (prove the stack works). M3-M4 are domain-validation (prove reinforcement algorithms are correct). Each milestone must demonstrate working, interactive code before moving to the next.

---

## B — User Interaction Model

### B.1 Philosophy

**Decision:** "Figma for concrete" — hybrid direct-manipulation-first model.

- 3D viewport is the primary interaction surface
- Context-sensitive property panel (not always-visible grid)
- Snapping provides precision without dialogs
- Keyboard shortcuts for all tools (default + user-editable)
- Figma-style tool behavior: tools auto-return to Select after one use

**Rationale:** Direct manipulation is 10x faster than Allplan's property-grid-heavy workflow. The Esc-key-escape-from-dialogs pain in Allplan is eliminated by making the viewport the primary canvas.

### B.2 Screen Layout

```text
┌──────────────────────────────────────────────────────────┐
│  [File] [Edit] [View] [Tools] ...          [⚙️] [👤]     │  Menu bar (thin)
├──────┬───────────────────────────────────────┬───────────┤
│      │                                        │           │
│  T   │                                        │  Tabs:    │
│  O   │         3D VIEWPORT                    │ [Building]│
│  O   │         (main working area)            │ [Props]   │
│  L   │                                        │           │
│      │         ┌──────────────┐               │           │
│  B   │         │  2D SECTION   │              │           │
│  A   │         │  (dockable)   │              │           │
│  R   │         └──────────────┘              │           │
│      │                                        │           │
├──────┴───────────────────────────────────────┴───────────┤
│  Status bar: [Snap: ON] [Grid: 100mm]  [X:3420 Y:1200]   │
└──────────────────────────────────────────────────────────┘
```

- **Left:** Tool bar (vertical icon column) with keyboard shortcuts
- **Center:** 3D viewport (main canvas)
- **Bottom-right (dockable):** 2D section view — can float, dock, or fill viewport
- **Right:** Tabbed panel — "Building" tab (storeys, layers, tree) and "Properties" tab (context-sensitive)
- **Bottom:** Status bar (snap state, grid, cursor coordinates)

### B.3 Snapping System

| Snap Target | Visual | Priority |
| --- | --- | --- |
| Grid (configurable spacing, default 100mm) | Dashed grid lines | Low |
| Edge | Highlighted edge line | Medium |
| Face (+ distance indicator) | Face highlight | High |
| Midpoint / Endpoint | Dot marker | High |
| Intersection | Cross marker | High |
| Existing bar (+ offset label) | Bar highlight | Medium |
| Angle (0°, 45°, 90° increments) | Arc + degree readout | Low |
| Parallel / Perpendicular guide | Dashed guide line | Low |

- Holding **Shift** disables all snapping
- Status bar shows active snap target
- Configurable tolerance (5-20px)
- Dedicated array/divide tool for bar spacing patterns (separate from snapping)

### B.4 Precision Input

- After placement, typing a number + Enter offsets from snap reference
- Tab cycles dimension fields in property panel during placement
- Cover distance: default from code, editable in property panel during tool use

### B.5 Selection Model

| Action | Behavior |
| --- | --- |
| Hover entity under the Select tool | Pre-selection highlight (hover token) shows exactly which entity a click would select (added 2026-08-09) |
| Hover entity under the Move tool | "Highlighted = what will move": a WALL winner highlights the wall AND its hosted bars (they move together — host-follow §E); a BAR winner highlights the bar alone and a drag from it does NOTHING (bar-relative moves are M3 scope — the host wall must not move either) (added 2026-08-09) |
| Click element in viewport | Select, deselect others |
| Ctrl+Click | Add/remove from selection |
| Drag-select (marquee) | Select all intersecting |
| Double-click bar | Select parent bar group |
| Escape | Deselect all / cancel tool → Select |
| Shift+scroll wheel | Cycle through overlapping objects under cursor |

Selection priority: smallest entity wins (bar > wall > section volume). **Revised 2026-08-09:** hover and click share ONE ray-resolution — a bar beats the transparent wall face in front of it only when that wall hosts it (§L.2); a bar hidden in a wall behind never wins; section wireframe volumes are the lowest-priority hit area, so entities inside a volume stay clickable through it.

**Parked (post-POC polish, noted 2026-08-09):** once slabs/beams/columns/openings and annotation (§M) exist, this ordering must become an explicit hover-priority table covering every entity type, and overlapping-entity cycling gets a decided gesture — the Shift+scroll row above vs. Tab-flipping the hovered candidate (pick ONE or support both deliberately). `pickPointerWinner` (src/ui/viewport/hover-target.ts) already computes the ranked candidate list, so cycling is an index into it.

### B.6 Tool Palette Design

> **Locked 2026-07-29** — Designed for M0 minimal viable tool set, extensible to full palette.

**Decision:** Single vertical icon column (left edge of viewport). Figma-style auto-return to Select after single-use tools. Keyboard shortcuts configurable via JSON mapping (defaults below). Users can double-click a tool to lock it (sticky mode — stays active after use until another tool or Esc is selected).

#### M0 Tool Set (Minimal Viable)

| Icon | Tool | Shortcut | Behavior |
|------|------|----------|----------|
| ↖️ | Select | V | Click to select, drag to marquee, Ctrl+Click to toggle, Esc to deselect. Auto-return from other tools. |
| 🧱 | Place Wall | W | Click the start point, click the end point — the wall is created on the second click and the next wall chains from it (chained placement, revised 2026-08-08). Esc exits. Property panel shows w×h×t fields. |
| ⏹ | Place Bar | B | Click a wall face (sets the cover side), then click the bar path point by point — the bar is created on the second click and each further click EXTENDS the same bar: the chain is ONE bar with bending places, a single position for the schedule (§J) and bar counts (revised 2026-08-08). Esc finishes the bar and exits. Cover and diameter auto-filled from catalog defaults; cover is kept from ALL element faces — clicks on/near an edge are offset from both planes forming the edge, and the bar start/end keep cover from the faces they terminate at; bends render with the code mandrel radius per diameter (DIN/EC2 catalog seed, revised 2026-08-08). |
| ✂️ | Section Cut | S | Click-drag across an element to place the section line, then a third click sets the view depth — the section looks toward that click (revised 2026-08-09). The 2D view opens in the dockable, resizable panel. Every section shows in the 3D viewport as a wireframe volume (cut line × depth × target height); clicking it re-opens the panel, and the active volume can be moved by dragging its body and stretched by dragging its corner handles. |
| ✋ | Pan | H | Click-drag to pan viewport. Also middle-mouse-drag. |
| 🔄 | Orbit | (middle/right drag) | Right-click-drag to orbit 3D view. Scroll to zoom. |

#### Full Palette (Post-M0 Expansion)

| Category | Tools | Default Shortcuts |
|----------|-------|-------------------|
| **Selection** | Select, Add-to-Selection (Ctrl+Click), Deselect (Esc) | V |
| **Create** | Wall, Slab, Beam, Column, Bar Individual, Bar Group, Opening | W, (Slab/Beam/Column TBD), B, G, O |
| **Section** | Section Cut, Detail Cut, Elevation Marker | S, D, E |
| **Annotate** | Dimension, Label, Leader Line, Elevation Marker | D, L, (Leader TBD), E |
| **Modify** | Move, Copy, Mirror, Array, Rotate, Trim, Extend | M, Ctrl+C/V, (Mirror TBD), A, R |
| **Measure** | Distance, Angle | (TBD) |
| **View** | Pan, Orbit, Zoom (scroll), Fit to Screen, Section Toggle | H, (Orbit native), F, (Toggle TBD) |

#### Tool Behavior Rules

1. **Auto-return:** Single-shot tools (e.g., Section Cut — one use = line drag + depth click, revised 2026-08-09) return to Select after one successful use. This matches Figma convention and prevents accidental repeated operations. **Revised 2026-08-08 (author feedback):** drawing tools (Place Wall, Place Bar — click-click tools) do NOT auto-return and need no Enter: the second click creates the element and immediately chains the next one from that point; the tool exits only on Esc (or another tool). Sticky mode (rule 2) is therefore moot for chaining tools and remains for single-shot tools. **Chaining semantics differ per tool (author feedback, same revision):** Place Wall chains produce separate walls; Place Bar chains EXTEND one bar — intermediate clicks are bending places, so the chain stays a single bar/position (§J) and counts as one bar.
2. **Sticky mode:** Double-click a tool to lock it. It stays active after use until another tool or Esc is pressed. Visual indicator (e.g., thicker border around tool icon) shows sticky state.
3. **Keyboard shortcuts:** Defined in a JSON config file (`src/ui/toolbar/shortcuts.json`). User-editable in-app via Settings → Keyboard Shortcuts (post-M0).
4. **Status bar feedback:** When a tool is active, the status bar shows tool name, hint (e.g., "Click first point for wall start"), and active snap constraints.
5. **Tool icons:** SVG icons, 24×24px, monochrome (inherit current color from toolbar theme). Semantic naming matching tool IDs (e.g., `icon-select.svg`, `icon-place-wall.svg`).

#### Tool State Model

```typescript
interface ToolState {
  activeTool: ToolId;          // 'select' | 'placeWall' | 'placeBar' | 'sectionCut' | 'pan' | 'orbit'
  sticky: boolean;             // Is the active tool locked?
  cursorHint: string;          // Current hint text for status bar
  isInProgress: boolean;       // Is there an unfinished placement action?
}
```

Managed in `ui-slice.ts` alongside selection state. Tool activation dispatches a command-like thunk (`toolbarSlice.actions.setTool`). Tool completion (e.g., wall placed) dispatches completion back to the slice.

---

## C — Internal Data Model

**Decision:** Internal TypeScript model designed for editing workflows. IFC + DXF are import/export only — not the runtime model, not the storage format.

**Rationale:** IFC stores results (3D positions), not design intent (cover distance, spacing rules). When a user places bars "at 35mm cover, 150mm spacing," the intent must be preserved for editing and re-generation. IFC cannot represent this. Every professional BIM tool uses an internal model + IFC adapter.

**Alternatives considered:**

- **True IFC-native:** Rejected — IFC cannot store design intent, transient state, or placement rules
- **Hybrid IFC-core + extensions:** Over-complicated for our scope

**IFC/DXF adapters:** Separate layer that translates internal model ↔ IFC-SPF / DXF. No IFC dependency in core data structures.

**Coordinate convention:** Model space is **millimetres, Z-up, right-handed** — plan geometry in X–Y (north = +Y), elevation in +Z. This is the engineering/BIM convention and matches IFC and DXF exactly, so the adapters carry **no rotation** (an up-axis mismatch would live entirely at this seam, with a silent-mirroring failure class — eliminated by construction). The renderer's Y-up default (Three.js) is a *view* concern, absorbed once in the viewport setup (`camera.up = +Z`, ground helpers oriented into the XY plane) — picking/raycasting stays 1:1 with model coordinates. Section view frames follow the drafting convention: up = +Z, right = forward × up.

> **Revised 2026-08-18 (M2 T2.5):** model space migrated from Y-up (Three.js's convention, inherited in M0) to Z-up before the IFC import adapter landed — the M2 T2 `toIfcPoint` rotation (x, −z, y) was deleted in the same change, and T3's import reads coordinates verbatim. Migration cost at M0–M2 scale: ~20 source files + test fixtures; after M3 (modify tools, placement groups) it would have roughly doubled.

---

## D — WASM / TypeScript Boundary

### D.1 Principle

**Decision:** Rust/WASM functions are **stateless, pure functions**. No WASM-side state, no Rust-side undo/redo, no project awareness. TypeScript handles all state, UI, and business logic.

**Rationale:** Stateless WASM is simple to test, impossible to get wrong with undo/redo, and naturally parallelizable. The boundary is a library of geometry compute functions.

### D.2 Division of Responsibility

| Layer | Rust/WASM | TypeScript |
| --- | --- | --- |
| Data types | Struct definitions via wasm-bindgen | TS interfaces (mirrored) |
| Bar geometry | Swept cylinder mesh generation | Call WASM, receive mesh data |
| Placement computation | Face sampling, spacing math, collision | Placement intent (params), call WASM |
| Section generation | Plane-mesh intersection, hidden lines | Define plane, receive 2D geometry |
| CSG (openings) | Subtract box from wall/slab mesh | Define opening, call WASM |
| Validation | Cover check, spacing check, code rules | Define rules, call WASM, display violations |
| State management | Nothing | RTK (Redux Toolkit) store, undo/redo |
| IFC I/O | — | web-ifc library (existing WASM) |
| DXF I/O | — | Custom parser/writer |
| Rendering | Nothing | Three.js / React Three Fiber |

### D.3 Data Passing

**Decision:** Flat arrays across the WASM boundary (minimize serialization overhead).

```rust
// Example signature pattern
pub fn generate_bar_mesh(
    path_points: &[f64],   // flat: [x1,y1,z1, x2,y2,z2, ...]
    diameter: f64,
    segments: u32
) -> Vec<f64>              // flat vertices + normals + indices
```

Complex objects stay in TypeScript. Only geometry data crosses the boundary.

### D.4 IFC Import

**Decision:** Use existing `web-ifc` TypeScript library for IFC geometry parsing.

**Fallback:** If web-ifc proves insufficient for write support or specific IFC entities, write a custom IFC parser. Documented as a known risk to validate in M2.

> **Revised 2026-08-18 (M2 T1 — write-capability spike verdict, plan Q1-a):** web-ifc write support **CONFIRMED — the fallback is NOT executed.** The decision-gate probe (`src/io/ifc-write-spike.test.ts`) wrote a minimal IFC4 file (IfcWallStandardCase extrusion + IfcReinforcingBar swept disk + the design-intent property sets) entirely through web-ifc's write API and re-read it losslessly: (i) all entities + properties survived web-ifc's own save/load; (ii) doubles round-tripped *exactly* (17-significant-digit SPF output) — far inside the 1e-6 mm gate; (iii) the artifact `docs/test-fixtures/ifc/m2-t1-spike.ifc` opens and imports completely in the author's Allplan 2022 (wall + bar created, zero ignored/defective; a bare `edmiImportStepFile (11108)` modal line with no failing entity is accepted as a non-blocking Allplan reader notice). Three exporter-convention requirements beyond the schema minimum were found through this check and recorded for the adapter: material layer set usage on walls, an Axis shape representation (2D Curve2D) alongside Body, and an MVD-correct FILE_DESCRIPTION (web-ifc defaults to the IFC2X3 name — override via `CreateModel({ description })`). Two refinements recorded with the verdict: the fallback, had it been needed, is a **custom TypeScript IFC-SPF writer in `src/io/`** (not Rust — §D.2 puts IFC I/O in TS and `core/` stays IFC-free per §C; approved M2 plan Q1), and web-ifc is **lazy-loaded** via dynamic import (`src/io/web-ifc-loader.ts`) so its 3.5 MB JS / 1.3 MB WASM never enter the shell bundle.

---

## E — State Management & Undo/Redo

> **Revised 2026-07-28** — State library changed from Zustand to RTK (Redux Toolkit). Rationale: the author's 10 years of Redux/RTK experience; thunks map one-to-one onto the §N command layer; Immer is built in; Redux DevTools provide action log and time-travel debugging out of the box. The undo design itself is unchanged.
>
> **Revised 2026-08-09** — "No auto-follow" replaced by **host-follow**: moving/copying an element moves/copies its hosted reinforcement (bars identified via `hostElementId`) as part of the same command transaction — one undo step restores all of it. There is still **no live dependency graph**: the follow is computed once inside the command, not propagated. Rationale: host-follow matches detailing reality (reinforcement belongs to its element — Allplan behaves the same) and the explicit-cascade pattern was already proven in M0 by `deleteElement` (which removes hosted bars in-command); the original concern was cascading *live* updates, which this does not introduce. Scope: M1 implements translation-follow; rotation is the same class of point transform (later); **mirror** flips bend handedness (a mirrored bar is a different physical shape for the schedule) — a Modify-tools (M3+) concern. Cross-element bars: the host wins — the whole bar follows its host; §K validation flags resulting violations. Placement groups (§F.2, M3): generated bars translate with the host like individual bars; param edits regenerate as before.

**Decision:** RTK (Redux Toolkit) + Immer (built in). Full state snapshots per undo level.

- 30 undo levels (session only, not persisted)
- Snapshots stored compressed in memory
- 3D meshes excluded from undo (regenerated on restore)
- Host-follow moves/copies (revised 2026-08-09): move/copy element → hosted bars move/copy with it, in the same command (no live dependency graph — see revision note above)

**Transient interaction state stays out of the store:** during drag/move gestures (60 FPS (Frames Per Second) pointer updates), in-progress values live in component-local state or refs. Only the committed result dispatches a command (on pointer-up / drop). This prevents dispatch overhead and action-log spam.

**Rationale:** No cascading/derived *live* updates — all model changes are explicit, in-command, and synchronous (including host-follow, revised 2026-08-09). This eliminates propagation graphs and makes snapshot-based undo simple and correct: one command = one snapshot = exact restore.

**Estimated memory:** ~5-10 MB per snapshot × 30 levels = 150-300 MB worst case. Acceptable for target scale.

**Alternatives considered:**

- **Zustand + Immer:** Previously locked (2026-07-21); superseded by RTK on 2026-07-28 — RTK's thunk/action model matches the §N command layer natively, and the author is deeply experienced with it.
- **Command pattern (for undo):** Rejected — over-complex for independent-object model
- **Structural sharing (Immer):** Used within snapshots but full snapshots chosen for undo levels

---

## F — Reinforcement Placement

### F.1 Placement Modes

**Decision:** Two modes:

1. **Individual placement:** Fire-and-forget. Bar is placed, no memory of placement parameters. Edit by deleting and re-placing.

2. **Group placement:** Bars placed in a region (face + parameters: cover, spacing, edge distance). Group stores the placement rule. User can edit group params and re-generate bars. Moving individual bars breaks them from the group.

### F.2 Placement Group Model

```typescript
interface PlacementGroup {
  id: string;
  targetFaceId: string;        // Which element face
  barDiameter: number;         // mm
  barMark: number;             // Position number for schedule
  coverDistance: number;       // mm
  barSpacing: number;          // mm center-to-center
  edgeDistanceStart: number;   // mm from edge
  edgeDistanceEnd: number;     // mm from edge
  orientation: "horizontal" | "vertical";
  bars: BarId[];               // Generated bar references
}
```

---

## G — Section / View Generation

> **Revised 2026-07-28** — Changed from "mesh-based sectioning (Path A)" to a two-tier strategy. Analysis showed standard structural elements don't need mesh slicing — a section is a parametric data query. This reduces WASM scope and eliminates the watertightness risk for native elements.

### G.1 Two-Tier Strategy

**Decision:** Parametric-first section generation, with mesh plane-intersection as the general fallback.

**Tier 1 — Parametric sections (native elements):** Standard elements (walls, slabs, beams, columns, straight stairs) know their own cross-section profile along their axis. A section at position X is a data query, not a mesh slice:

1. **Concrete outline at X** → query element profile parameters (b × h rectangle or L/T polygon).
2. **Cut bars (dots)** → bars whose stored 3D path intersects the section plane (plane-polyline intersection — simple linear math, no BREP kernel needed).
3. **Background within view depth [X, X+depth]** → stirrups, bars, and element edges projected as lines per drafting convention (typically simplified/dashed beyond the first plane).

**Revised 2026-08-09 (M1 T4 review):** the view is bounded by the **drawn cut line segment** — content (outlines, dots, background) is clipped to the line's u-extent, so the 2D view matches the 3D wireframe volume (line × depth). Previously the cut plane was treated as infinite: an element moved sideways out of the wireframe box kept its outline/dot (and the auto-fit canvas masked the shift), so a move that left the plane's infinite trace did not visibly update the section. All three primitive kinds above are clipped/dropped at the line ends.

Executes in microseconds with pure math. No mesh slicing, no watertightness dependency, clean vector output.

**Tier 2 — Mesh plane-intersection (fallback):** For imported IFC solids and non-parametric geometry with no queryable profile:

**Algorithm:**

```text
1. Define clipping plane (position + normal)
2. For each concrete element:
   a. Plane-triangle intersection → intersection segments
   b. Sort segments into closed polygon loop(s)
3. For each reinforcement bar:
   a. Plane-polyline intersection → intersection point
   b. Classify as dot (cut) or hidden (behind plane)
4. Hidden line removal: depth-test render to offscreen buffer
5. Output: 2D vector primitives (lines, arcs, dots)
```

### G.2 Key Risks & Open Questions

1. **Mesh watertightness (Tier 2 only):** If meshes are non-watertight after CSG (Constructive Solid Geometry) operations (opening subtract), section polygons will have gaps. **Mitigation:** We control mesh generation in WASM — can ensure watertight tessellation. If CSG is needed for openings/junctions, Manifold-3D (lightweight WASM mesh-boolean library) is the preferred option; OpenCASCADE.js (30+ MB BREP (Boundary Representation) kernel) remains the last-resort fallback.
2. **Element junctions — RESOLVED (2026-07-29):** 2D polygon union of parametric cross-section profiles at the cut plane.

   At beam-column-slab joints, each element provides its 2D cross-section polygon (via Tier 1 parametric query). A lightweight 2D polygon boolean union merges touching profiles into one monolithic concrete boundary. Implemented in Rust/WASM as a pure function (small, no 3D BREP kernel, no OpenCascade dependency). For Tier 2 (mesh) fallback, the same 2D union applies to mesh-intersection polygons.

   **Rationale:** View-composition (draw overlapping profiles in order) leaves visible seam lines — incorrect for monolithic concrete. Full 3D CSG union requires watertight meshes and adds a heavy dependency. 2D polygon union is the sweet spot: simple (<1ms for joint profiles), correct, and works for both Tier 1 and Tier 2.

   **Implementation:** Pure Rust function `union_2d_profiles(profiles: &[Polygon2D]) -> Vec<Polygon2D>`. The `polygon-clipping` TS library or a minimal Rust geo crate can serve as reference. Decided now (pre-M0) because it affects section algorithm design — but only implemented when joint sections are needed (M4).

3. **Hidden lines in depth views — RESOLVED (2026-07-29):** Convention-based visibility as default; raster-assisted HLR deferred.

   **Tier 1 — Convention-based (default, M0 onward):** All geometry within the view depth is drawn with line-style classification — cut concrete (solid + hatch), cut bars (solid dots), visible-within-depth concrete edges (dashed), visible-within-depth bars/dashed continuation (dashed). No occlusion computation. This matches what structural drafters produce manually (everyone "reads through" dashed background bars) and executes in microseconds.

   **Tier 2 — Raster-assisted HLR (deferred, on-demand post-M4):** For congested joints where conventional depth drawing produces too much dashed-line clutter, render the 3D scene from the section direction to an offscreen depth buffer (Three.js) and classify 2D lines as visible/hidden. Activated by user toggle. Not needed for M0–M4.

   **Rationale:** Real vector HLR is complex and expensive. Convention-based drawing is the industry standard for structural sections (check any real plan set). Investing in raster-assisted HLR makes sense only after validating that convention-based output is insufficient for real congested joints — which we cannot know before M4 scale.

---

## H — Project File Structure

> **Revised 2026-07-28** — Confirmed JSON-in-OPFS after evaluating IndexedDB and SQLite-WASM. Added IndexedDB role and cloud-storage deferral (§H.4).

### H.1 Format

**Decision:** Single `project.json` in OPFS (Origin Private File System). No SQLite.

```typescript
interface ProjectFile {
  version: string;
  metadata: {
    name: string;
    createdAt: string;
    lastModified: string;
    appVersion: string;
  };
  building: {
    storeys: Storey[];
    layers: Layer[];
  };
  elements: ConcreteElement[];
  reinforcement: ReinforcementBar[];
  placementGroups: PlacementGroup[];
  sections: SectionDefinition[];
  annotations: Annotation[];
  layouts: DrawingLayout[];
}
```

### H.2 What Is NOT Persisted

| Data | Reason |
| --- | --- |
| 3D meshes (vertex buffers) | Derived data — regenerated on load |
| Undo stack | Session only |
| Viewport camera state | Session only |

### H.3 Save/Load

- **Autosave:** Every 30 seconds + after significant actions
- **Open:** Read OPFS file → hydrate RTK store → WASM regenerates meshes
- **Export IFC/DXF:** Run adapter on current model state
- **PWA:** All data in Service-Worker-cached app + OPFS

**Alternatives considered:**

- **SQLite via OPFS:** Rejected for PoC — JSON is simpler and sufficient for target scale. May revisit if filtering/querying needs emerge.
- **IFC as native format:** Rejected — see Topic C.

### H.4 App-Level State & Cloud (Deferred)

- **IndexedDB (Indexed Database):** Stores app-level state only — user settings, UI layout, recent-project list, autosave checkpoints. Not project geometry.
- **SQLite via WASM:** Re-evaluate only if M4-scale querying emerges (e.g., "all Ø16 bars in storey 3" filters). Migration from clean JSON is a contained refactoring, not a rewrite.
- **Cloud storage (BaaS — Backend as a Service):** Deferred past MVP. `project.json` being one self-contained file makes cloud v1 a simple upload/download. Leaning: Supabase-style (auth + file storage + metadata tables); Convex-style reactive sync only if multi-user collaboration becomes a requirement. Offline-first PWA is a selling point for engineering firms with data-security policies, not a limitation.

---

## I — 2D Drawing & PDF Pipeline

### I.1 Architecture

**Decision:** Hybrid Canvas2D + SVG overlay.

```text
3D Model → WASM Sectioner → 2D Vector Primitives
                                        │
                    ┌───────────────────┴───────────────────┐
                    ▼                                         ▼
           Canvas2D (main drawing)                  SVG Overlay (interaction)
           - Lines, arcs, hatches                  - Selection handles
           - Bar intersections                     - Dimension editing
           - Fast for large counts                 - DOM events
                    │
                    ▼
           PDF Export (jsPDF)
           - Same vector primitives
           - A0-A4 + custom sheet sizes
           - Title blocks, borders
```

### I.2 Drawing Layouts

**Decision:** A0, A1, A2, A3, A4 + custom sizes. Predefined and custom title blocks with borders.

**Rationale:** DIN-standard sheets are the delivery format for structural engineering plans.

### I.3 PDF Export

**Decision:** Vector PDF (not rasterized). Same drawing commands rendered to PDF primitives via jsPDF. Must preserve scale accuracy for plotting (1:50, 1:100, etc.).

### I.4 Rebar Representation

See [§M.4](#m4-rebar-representation-in-2d) — true-scale geometry with drafting-convention pen weights and true bending shapes.

---

## J — Bar Bending Schedule

### J.1 Update Model

**Decision:** Live push-update on every bar change when the schedule is visible on screen.

**Rationale:** Matches Allplan behavior. The schedule must always be correct — it's the deliverable to the bending machine (BVBS) and construction site.

### J.2 Data Structure

```typescript
interface BarSchedule {
  marks: BarMark[];
  totalWeight: number;       // kg
  totalCount: number;
}

interface BarMark {
  positionNumber: number;    // Bar mark number
  diameter: number;          // mm
  count: number;             // Quantity
  shape: string;             // Bending shape code
  segmentLengths: number[];  // [a, b, c, ...] in mm
  totalLength: number;       // mm per bar
  weightPerBar: number;      // kg
  totalWeight: number;       // kg (count × weight)
}
```

### J.3 Placement

Schedule is a table element that can be placed in the 2D drawing layout (title block area or separate sheet).

### J.4 BVBS Export

Future: export schedule data to BVBS format for direct bending machine input. Clean text format, low risk.

---

## K — Validation & Code Compliance

### K.1 Trigger

**Decision:** On-demand — user clicks "Validate." Applied only to layers currently in edit mode.

### K.2 Code Standard

**Decision:** Start with DIN/EC2. Other country codes added later via JSON rule files.

### K.3 Validation Rules (PoC)

| Rule | Check |
| --- | --- |
| Cover distance | Bar surface to nearest concrete face ≥ code minimum |
| Bar spacing | Clear distance between bars ≥ max(Ø, 20mm) |
| Edge distance | Bar to element edge ≥ code minimum |
| Diameter compatibility | Ø exists in selected steel grade catalog |
| Bending radius | Mandrel diameter ≥ code minimum for Ø and steel grade |
| Max bar length | Single bar ≤ 12m (transport limit) |

### K.4 Behavior

- Validation is **non-blocking** — user can place non-compliant bars
- Violations are **warnings** (not errors)
- UI: red highlight on bar in 3D, warning icon in tree, red cell in schedule, tooltip with explanation
- "Fit to Code" button for auto-fix where possible

### K.5 Extensibility

Country rules defined in JSON:

```typescript
interface CodeRules {
  country: string;          // "DE", "UK", "FR"
  standard: string;         // "DIN 1045 / EC2"
  minCover: CoverTable;     // By exposure class
  minSpacing: SpacingRule;
  bendingRadii: BendingRadiusTable;
  // ...
}
```

---

## L — Performance & Rendering Strategy

### L.1 Bar Rendering

**Decision:** Instanced rendering via Three.js `InstancedMesh` — one draw call per diameter.

```text
All Ø10 bars → InstancedMesh 1
All Ø12 bars → InstancedMesh 2
All Ø16 bars → InstancedMesh 3
...
```

**Expected performance:**

| Scenario | Bars | Draw calls | Expected FPS |
| --- | --- | --- | --- |
| Small house | 2,000 | 3-5 | 60 |
| Medium apartment | 20,000 | 8-12 | 30-60 |
| Large building | 50,000 | 10-15 | 20-40 |

### L.2 Concrete Transparency

**Decision:** No occlusion culling for bars. Concrete elements must support transparency (user can see bars through concrete, like Allplan). Depth ordering + transparent materials handle this instead of hiding bars inside elements.

### L.3 Additional Techniques

| Technique | Application |
| --- | --- |
| Frustum culling | Built into Three.js — automatic |
| LOD (Level of Detail) | Far zoom: reduce cylinder segments (20 → 8 → 4) |
| Web Worker mesh gen | During bar placement — keep UI responsive |
| Simplified zoomed-out bars | Bars become lines instead of cylinders at far zoom |

### L.4 Validation

These techniques must be tested with real data. If instanced rendering proves insufficient, alternatives (WebGPU compute, custom buffer geometry, spatial partitioning for culling) will be evaluated.

---

## M — Annotation & Labeling Strategy

> **Added 2026-07-28** — Records the strategic decision that annotation is the product's differentiator and defines the technical approach.

### M.1 Strategic Role

Auto-labeling is the **killer feature**: over 50% of reinforcement drawing time is spent placing labels, dimension chains, and leader lines. Competing tools (Allplan) leave this almost entirely manual. MVP ships **manual tools with smart defaults**; auto-labeling is developed as the differentiator and **prototyped early** — it is 2D-only (operates on 2D view primitives, not the 3D stack), so it does not need to wait for the full 3D pipeline.

### M.2 Layered Auto-Placement Approach

1. **Deterministic zone placement** — dimension chains and callouts start at fixed drafting-convention offsets from the concrete outline (outer chain, inner chain, spacing chains).
2. **Collision detection** — spatial index (e.g., rbush R-tree) over placed label/leader bounding boxes.
3. **Local optimization pass** — resolve overlaps by nudging labels along allowed axes, flipping leader orientation, trying alternate anchors (hill-climbing, milliseconds).
4. **Manual parametric handles** — user overrides stored as relative offsets (text offset, leader type, anchor position, lock flag), surviving model changes. Target outcome: clean sheet with 0–5 manual adjustments for standard elements; excellent manual tools for congested cases (joints, multi-layer congestion).

### M.3 Label Content Model

Labels are generated from bar metadata via **templates** (per country/company standard), never hardcoded strings. Examples: section view `Pos. 1 - 5 Ø16 @ 15`, elevation `5 Ø16 L=3.50m`, schedule row. LLM (Large Language Model) role is limited to translating natural-language formatting preferences into labeling-rule JSON — never to geometric placement, which stays deterministic and debuggable.

### M.4 Rebar Representation in 2D

- Geometry and positions always **true scale** (bar centers, bend points, cover) — clearances and fits are checkable.
- Line weights follow **drafting convention** (configurable pen table), not true Ø — a Ø8 bar at 1:50 would print invisibly otherwise.
- Section dots keep **true relative diameters** (Ø20 dot visibly larger than Ø8 dot).
- Bars render with **true bending shapes**: real bends, hooks (e.g., 135°), bend radii, lap offsets — derived from the bending-form definition (segment lengths a–g, see doc 04 data model).
- BBS (Bar Bending Schedule) shape diagrams are rendered from the same bending-form data.

---

## N — Command Layer & AI Extensibility

> **Added 2026-07-28** — Locks a design rule that keeps the door open for AI-driven features (MCP server, natural-language input, scripting) without building them now.

### N.1 The Rule (affects all implementation from M0 onward)

**Decision:** Every mutation of the project model goes through a **named command function** — never directly from a UI (User Interface) event handler into state mutation.

```text
UI (click, drag, keyboard) → command(name, params) → validate → mutate store → views update
```

Commands are pure TypeScript, UI-free, and take plain parameter objects (same shape as §F PlacementGroup and other schemas). Command calls are logged, which complements §E snapshot undo/redo.

**Mental model (RTK (Redux Toolkit) mapping — literal, per §E):** commands = thunks, store mutations = slice reducers, command log = Redux action log (DevTools time-travel included). React components stay as dumb as possible — they render and dispatch, never decide.

**Example — forbidden vs. required:**

```tsx
// ❌ FORBIDDEN — domain logic in the component / raw slice actions dispatched from UI:
<button onClick={() => {
  dispatch(projectSlice.actions.updateBeam({ beamId: "beam-1", height: 700 }));
  if (700 > 600) { /* ad-hoc logic sneaking in... */ }
}} />

// ✅ REQUIRED — the handler only invokes a named command (an RTK thunk):
// commands/setBeamHeight.ts (pure TypeScript, no React):
export const setBeamHeight =
  (beamId: string, height: number) =>
  (dispatch: AppDispatch) => {
    if (height < 200) throw new CommandError("Min height 200mm");
    const stirrupClass = height > 600 ? "heavy" : "standard"; // domain logic lives HERE
    dispatch(projectSlice.actions.updateBeam({ beamId, height, stirrupClass }));
  };

// BeamPanel.tsx — the component is a thin messenger:
<button onClick={() => dispatch(setBeamHeight("beam-1", 700))} />
```

**Consequence:** anything that can call a function can drive the app — UI, keyboard, MCP tool, LLM (Large Language Model) output, or a test script — through one doorway with one logic.

### N.2 Why (Doors Left Open)

The same command layer serves four future consumers with **zero changes to core logic**:

1. **UI** (M0 onward) — mouse/keyboard/touch.
2. **MCP (Model Context Protocol) server** (Phase 2+) — external AI (Artificial Intelligence) agents call commands as tools. The core engine (data model + commands + WASM (WebAssembly)) is packaged for Node.js; the MCP server is a thin wrapper. Note: a browser app cannot host a server, so this is a separate small companion process reusing the core package (a remote MCP endpoint becomes possible once a backend exists, §H.4).

   **Bring-your-own-AI model (noted 2026-07-28):** users drive the app with their OWN AI subscription and tool of choice (Claude Desktop, Claude Code, Codex CLI (Command Line Interface), Cursor — any MCP client; the protocol is client-agnostic). Product-side inference cost is zero, no API-key management, and project data stays within the user's own AI relationship (a strong privacy argument for engineering firms). This pattern is validated by existing FreeCAD + Claude Desktop MCP integrations. It also means an external AI can serve as the first natural-language front-end and even perform sketch-photo interpretation — while the app stays deterministic: commands are validated (§K) and confirmed by the user before execution.
3. **Natural-language input** (Phase 2) — an LLM (Large Language Model) translates user text ("Beam 30×60, two spans 5+6m, bottom 4Ø20, stirrups Ø8/15") into command parameters, validated against the steel catalog and code rules (§K), shown to the user for confirmation, then executed by the deterministic engine. The LLM produces intent, never geometry.
4. **Batch/scripting** (Phase 2+) — macros, test fixtures, automated project generation.

### N.3 Explicitly NOT Built Now

No MCP server, no LLM integration, no public API (Application Programming Interface) hardening in M0–M4. **Only the command-layer discipline is required from day one.** Skipping it makes these features a rewrite; keeping it makes them nearly free.

---

## Technology Stack Summary

| Component | Technology | Version |
| --- | --- | --- |
| UI Framework | React | 19 |
| State Management | Redux Toolkit (RTK) + Immer (built in) | Latest |
| 3D Rendering | React Three Fiber + Drei | Latest |
| 2D Rendering | Canvas2D + SVG overlay | Browser native |
| PDF Export | jsPDF | Latest |
| Geometry Engine | Rust → WASM via wasm-pack | Latest Rust |
| Math Library (Rust) | nalgebra | Latest |
| Collision Detection | parry3d | Latest |
| IFC Import | web-ifc | Latest |
| CSS | Tailwind CSS | Latest |
| Build | Vite + pnpm | Latest |
| Language | TypeScript | Latest |
| Storage | OPFS (PWA) | Browser native |

---

## Dependency Graph

```text
User Action (UI)
    │
    ▼
React Component (e.g., WallReinforcementPanel)
    │
    ▼
RTK Store (e.g., reinforcementSlice) + Commands/Thunks (§N)
    │
    ▼
WASM Solver (Rust — stateless functions)
    ├── BarGenerator::generate(params) → mesh data
    ├── CoverValidator::validate(bar, element) → violations
    ├── CollisionDetector::check_conflicts(bars) → conflicts
    └── SectionGenerator::clip(plane, elements) → 2D primitives
    │
    ▼
Three.js Scene (instanced meshes) + Canvas2D (sections)
    │
    ├── 3D Viewport (R3F)
    ├── 2D Section View (Canvas2D)
    └── Schedule Table (React)
    │
    ▼
Export Adapters
    ├── IFC (web-ifc)
    ├── DXF (custom)
    ├── PDF (jsPDF)
    └── BVBS (future)
```

---

## Source Module Layout (Planned)

```text
src/
├── core/                      ← WASM (Rust)
│   ├── geometry/              ← Bar shape generation, CSG, sectioning
│   ├── solver/                ← Placement algorithms, cover checks
│   └── bvbs/                  ← BVBS export (future)
│
├── data/                      ← TypeScript data model
│   ├── models/                ← ConcreteElement, ReinforcementBar, etc.
│   ├── catalog/               ← Steel grades, diameters, code rules
│   └── validation/            ← Code compliance rules
│
├── engine/                    ← WASM bridge + geometry orchestration
│   ├── wasm-bridge.ts         ← WASM function bindings
│   ├── placement.ts           ← Bar placement logic
│   └── sectioning.ts          ← Section generation orchestration
│
├── stores/                    ← RTK slices + store configuration
│   ├── project-slice.ts       ← Project state, undo/redo
│   ├── ui-slice.ts            ← Tool state, selections, viewport
│   └── schedule-slice.ts      ← Derived schedule data
├── commands/                  ← Named command functions / thunks (§N) — the ONLY doorway for model mutations
│
├── ui/                        ← React components
│   ├── viewport/              ← 3D viewport (React Three Fiber)
│   ├── section-view/          ← 2D section view (Canvas2D)
│   ├── panels/                ← Building tree, property panel
│   ├── toolbar/               ← Tool palette
│   ├── schedule/              ← Bar bending schedule table
│   └── layouts/               ← Drawing sheet layouts
│
├── io/                        ← Import/Export adapters
│   ├── ifc-adapter.ts         ← IFC read/write
│   ├── dxf-adapter.ts         ← DXF read/write
│   └── pdf-export.ts          ← PDF vector export
│
└── blocks/                    ← Parametric reinforcement blocks (Phase 2)
    └── definitions/           ← JSON block definitions
```
