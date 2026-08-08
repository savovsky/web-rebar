# M0 — One Wall, One Bar: Plan & Task Tracker

> **Back to:** [Implementation Plans & Tasks](./README.md) · [Root README](../../README.md) · [Architecture Spec](../08-architecture-spec.md)
> **Plan approved:** 2026-08-08 (author answered Q1–Q3 with the recommended options)

---

## ▶️ Current State (read this first in a fresh session)

- **Next task:** **T3 — `generate_bar_mesh` (Rust) + real bridge binding**; test cylinder in viewport.
- **Done:** T1 (WASM toolchain + crate + round-trip) — `bc11f9b`.
- **Awaiting review:** T2 (data models + steel catalog seed).
- **Workflow:** implement one task → `pnpm lint` + `pnpm build` green → present changes → **author reviews and commits** → next task.

## M0 Goal (Architecture Spec §A)

Fixed wall in a 3D viewport. User places one straight bar at correct cover. One section cuts the wall and shows the bar as a dot.
**Risks probed:** WASM bundle size/load · section algorithm correctness · Rust↔TS data passing.

**Milestone acceptance:** place wall → place bar at 25 mm cover → cut section → 2D view shows wall outline + bar dot at the correct offset.

### Scope

| In scope | Explicitly out (and why) |
|---|---|
| WASM crate + 2 real functions | Undo/redo (M1 — reducers written undo-compatible) |
| Data models, RTK store, 4–5 commands | Placement groups (M3), IFC (M2), OPFS persistence |
| 3D viewport (R3F), section view (Canvas2D) | Validation UI (warnings only computed/logged, §K.4) |
| Tools: Place Wall / Place Bar / Section Cut (+ minimal Select/Pan/Orbit) | Snapping beyond grid, annotation, bar marks/schedule |

**Door check (§N + deferred topics):** nothing in M0 closes the Layer Model, Annotation, or MCP doors — all mutations via commands, models are plain serializable objects.

### Approved decisions (Q1–Q3)

| Q | Decision |
|---|---|
| Q1 — WASM return encoding | **(b)** positions/normals as `Float32Array` + indices as `Uint32Array` (Three.js wants Float32; still flat arrays per §D.3) |
| Q2 — Test runner | **Add vitest in T5** — §N commands are designed to be headless-testable |
| Q3 — WASM/Vite wiring | **wasm-pack `--target web` + explicit `init()`** — no Vite plugins needed (confirmed working in T1) |

---

## Approved Plan (summary — full detail was in the planning session)

### 1. Rust `core/` crate (§D)

Stateless pure functions, flat arrays only. M0 needs exactly two:

```rust
pub fn generate_bar_mesh(path_points: &[f64], diameter: f64, segments: u32) -> /* Float32 verts+normals, Uint32 indices (Q1-b) */
pub fn plane_polyline_intersection(plane_origin: &[f64], plane_normal: &[f64], path_points: &[f64]) -> Vec<f64>
```

The wall's concrete outline at the cut plane is **not** a WASM call — it is a TS parametric query on the wall model (§G.1 Tier 1: "a data query, not a mesh slice"). `src/engine/sectioning.ts` orchestrates: wall profile from model + one `plane_polyline_intersection` per bar → 2D primitives.

### 2. TypeScript data models (`src/data/models/`, before any UI — rule 4)

Units mm, IDs strings (`crypto.randomUUID`). Files: `geometry.ts` (`Vec3`, `Plane`), `elements.ts` (`WallElement`, `ConcreteElement` union), `reinforcement.ts` (`ReinforcementBar`: hostElementId, diameter, path `Vec3[]`, coverDistance, steelGrade), `sections.ts` (`SectionDefinition`: plane, viewDepth, targetElementIds), `project.ts` (`ProjectModel` — §H.1 subset with entity dictionaries).
Catalog seed `src/data/catalog/steel.ts`: DIN/EC2 diameters `[6..25]`, grade `B500B`, default wall cover 25 mm — JSON-shaped per §K.5.

### 3. RTK store

- `project-slice.ts` — extends `ProjectModel`; reducers `addElement/addBar/addSection/removeElement/removeBar` (called by commands only).
- `ui-slice.ts` — extends existing stub with `selection`, `placementDraft` (click-committed points only; 60 FPS pointer data stays in refs, §E), `activeSectionId`.
- Derived data (bar meshes, section primitives) computed in memoized selectors via `src/engine/` — never stored (§E, §H.2).

### 4. Commands (`src/commands/`) — the only mutation doorway (§N)

`placeWall`, `placeBar`, `createSection`, `deleteElement`, `deleteBar`, `setActiveSection` — each a thunk with one plain params object (max-params 2 compliant), validating inputs, throwing `CommandError` on violation. Plus `commands/index.ts` exporting a **command registry** (`{ name, thunk }` map) — the future MCP/scripting door (§N.2).

### 5. Viewport & section view

- `src/ui/viewport/Viewport3D.tsx` — R3F Canvas, drei OrbitControls (right-drag orbit, middle pan, scroll zoom, §B.6), `WallMesh` (box from params), `BarMesh` (WASM BufferGeometry via memoized selector; plain mesh in M0 — InstancedMesh arrives M3 per §L.1), grid plane + click capture for tools.
- `src/ui/section-view/SectionView.tsx` — dockable panel (§B.2), Canvas2D render of `selectSectionPrimitives` (`concreteOutline`, `cutBars`, `backgroundLines`), auto-fit world→canvas, true relative dot diameters (§M.4). Projection math lives in `src/engine/sectioning.ts`, not the component (rule 2).
- App shell: toolbar left, viewport center, section panel bottom-right, status bar (§B.2). Tailwind + tokens only (rule 6).

### 6. Environment (done in T1)

Windows machine **without** MSVC Build Tools → host toolchain pinned to `stable-x86_64-pc-windows-gnu` (bundled MinGW linker) via `core/rust-toolchain.toml` (repo-committed, reproducible). `wasm-pack` 0.15.0 installed as prebuilt binary (cargo-install requires a host linker). Target: `wasm32-unknown-unknown` (bundled rust-lld).

---

## Task Tracker

| # | Task | Verify by | State | Commit |
|---|---|---|---|---|
| T1 | wasm-pack setup: `core/` crate, `wasm:build` script, Vite wiring, round-trip probe | `pnpm build` bundles WASM; bridge call returns value | ✅ Done | `bc11f9b` |
| T2 | Data models + steel catalog seed (`src/data/models/`, `src/data/catalog/`) | `tsc` typecheck, lint | 🟡 Review | — |
| T3 | `generate_bar_mesh` (Rust) + real bridge binding; test cylinder in viewport | lint/build; visual | ⬜ Pending | — |
| T4 | Store: project-slice reducers + ui-slice extension; typed hooks | typecheck | ⬜ Pending | — |
| T5 | Commands + registry + `CommandError`; **add vitest** (Q2) | headless unit tests | ⬜ Pending | — |
| T6 | App shell layout + toolbar (M0 tool set, §B.6) + status bar | manual | ⬜ Pending | — |
| T7 | Viewport3D + Place Wall tool (click-click-Enter → `placeWall`) | wall renders | ⬜ Pending | — |
| T8 | Place Bar tool (click face → 2 points → `placeBar`, default cover from catalog) | bar renders in wall | ⬜ Pending | — |
| T9 | `plane_polyline_intersection` (Rust) + `sectioning.ts` (parametric outline + dots + projection) | unit tests | ⬜ Pending | — |
| T10 | Section Cut tool + SectionView panel (Canvas2D, auto-fit) | dot at correct cover | ⬜ Pending | — |
| T11 | Acceptance pass against root README review checklist | zero store imports in `src/ui/`, lint+build clean | ⬜ Pending | — |

---

## Task Log

### T1 — WASM toolchain & round-trip ✅ (2026-08-08, committed `bc11f9b`)

**Machine setup (not in repo):** rustup via winget; `wasm32-unknown-unknown` target; `wasm-pack 0.15.0` prebuilt binary in `~/.cargo/bin`; `stable-x86_64-pc-windows-gnu` toolchain (see §6 above — cargo-install of wasm-pack failed without MSVC linker, hence prebuilt).

**Files added:** `core/Cargo.toml`, `core/src/lib.rs` (`core_version`, `sum_flat`, `scale_flat` probes), `core/rust-toolchain.toml`, `.prettierrc.json`, `.prettierignore`; generated `src/core/pkg/` (gitignored).

**Files changed:** `src/engine/wasm-bridge.ts` (real `initWasm` + probe wrappers + `wasmSelfTest`; T3/T9 stubs kept), `src/main.tsx` (parallel WASM init + self-test log), `eslint.config.js` (ignore `core`, `src/core/pkg`; prettier options extracted to `.prettierrc.json`; JSDoc cast for react-hooks/ESLint-10 type conflict), `package.json` (`wasm:build` script); one-time prettier normalization of `index.html`, `src/index.css`, `tsconfig.json`, `tsconfig.app.json`.

**Verification:** `pnpm lint` ✅ · `pnpm build` ✅ (WASM asset **14.55 kB raw / 6.5 kB gzip** — bundle-size risk looks good) · Node round-trip ✅ (`sum_flat([1,2,3])=6`, `scale_flat` correct) · `prettier --check .` ✅ · `tsc --checkJs` on eslint.config.js ✅.

**Incidental fixes (same review batch):** `.prettierrc.json` extracted so CLI and IDE Prettier share one config (IDE was showing phantom errors); `.prettierignore` excludes `*.md` + lockfile; react-hooks v7 plugin type cast for ESLint 10 (upstream types lag, 7.1.1 is latest).

### T2 — Data models + steel catalog seed 🟡 (2026-08-08, awaiting author commit)

**Files added:** `src/data/models/` — `geometry.ts` (`Vec3`, `Plane`), `elements.ts` (`WallElement`, `ConcreteElement` union), `reinforcement.ts` (`ReinforcementBar` with stored cover intent, §C), `sections.ts` (`SectionDefinition` with `viewDepth`, §G.2.3), `project.ts` (`ProjectModel` — §H.1 subset, normalized entity dictionaries), `index.ts` (type-only barrel). `src/data/catalog/steel.ts` — `SteelCatalog` JSON-shaped per §K.5: DE / DIN 1045+EC2 seed, 8 diameters with nominal kg/m weights (feeds §J schedule later), grade `B500B`, cover defaults (wall 25 mm), `DEFAULT_DIAMETERS` convenience export. `.gitkeep` files removed from both dirs.

**Design notes:** all coordinates plain numbers (JSON-serializable, §H.1); derived values (wall length, meshes, section primitives) documented as never stored; magic-number lint satisfied because catalog data lives in object literals (`detectObjects: false`).

**Verification:** `pnpm lint` ✅ · `pnpm build` ✅ (typecheck covers the new modules).

## Change Log

| Date | Change |
|---|---|
| 2026-08-08 | Plan written and approved (Q1-b, Q2-yes, Q3-no-plugins) |
| 2026-08-08 | T1 implemented; task tracker created |
| 2026-08-08 | T1 committed (`bc11f9b`); T2 implemented, awaiting review |
