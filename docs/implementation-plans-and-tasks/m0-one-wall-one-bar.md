# M0 — One Wall, One Bar: Plan & Task Tracker

> **Back to:** [Implementation Plans & Tasks](./README.md) · [Root README](../../README.md) · [Architecture Spec](../08-architecture-spec.md)
> **Plan approved:** 2026-08-08 (author answered Q1–Q3 with the recommended options)

---

## ▶️ Current State (read this first in a fresh session)

- **Next task:** **T9 — `plane_polyline_intersection` (Rust) + `sectioning.ts` (parametric outline + dots + projection).**
- **Done:** T1 — `bc11f9b`; T2 — `71ecca2`; T3 — `0a279e1` (visual confirmed by author); T4 — `4413366`; T5 — `a7934d2`; T6 — `20fe9b6` (visual confirmed by author); T7 — `41fe548`; T8 — visual confirmed by author (hash recorded in the tracker table).
- **Awaiting review:** —
- **Workflow:** implement one task → `pnpm lint` + `pnpm build` green → present changes → **author reviews and commits** → next task.

## M0 Goal (Architecture Spec §A)

Fixed wall in a 3D viewport. User places one straight bar at correct cover. One section cuts the wall and shows the bar as a dot.
**Risks probed:** WASM bundle size/load · section algorithm correctness · Rust↔TS data passing.

**Milestone acceptance:** place wall → place bar at 25 mm cover → cut section → 2D view shows wall outline + bar dot at the correct offset.

### Scope

| In scope | Explicitly out (and why) |
| --- | --- |
| WASM crate + 2 real functions | Undo/redo (M1 — reducers written undo-compatible) |
| Data models, RTK store, 4–5 commands | Placement groups (M3), IFC (M2), OPFS persistence |
| 3D viewport (R3F), section view (Canvas2D) | Validation UI (warnings only computed/logged, §K.4) |
| Tools: Place Wall / Place Bar / Section Cut (+ minimal Select/Pan/Orbit) | Snapping beyond grid, annotation, bar marks/schedule |

**Door check (§N + deferred topics):** nothing in M0 closes the Layer Model, Annotation, or MCP doors — all mutations via commands, models are plain serializable objects.

### Approved decisions (Q1–Q3)

| Q | Decision |
| --- | --- |
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
| --- | --- | --- | --- | --- |
| T1 | wasm-pack setup: `core/` crate, `wasm:build` script, Vite wiring, round-trip probe | `pnpm build` bundles WASM; bridge call returns value | ✅ Done | `bc11f9b` |
| T2 | Data models + steel catalog seed (`src/data/models/`, `src/data/catalog/`) | `tsc` typecheck, lint | ✅ Done | `71ecca2` |
| T3 | `generate_bar_mesh` (Rust) + real bridge binding; test cylinder in viewport | lint/build; visual | ✅ Done | `0a279e1` |
| T4 | Store: project-slice reducers + ui-slice extension; typed hooks | typecheck | ✅ Done | `4413366` |
| T5 | Commands + registry + `CommandError`; **add vitest** (Q2) | headless unit tests | ✅ Done | `a7934d2` |
| T6 | App shell layout + toolbar (M0 tool set, §B.6) + status bar | manual | ✅ Done | `20fe9b6` |
| T7 | Viewport3D + Place Wall tool (click-click, chained → `placeWall`) | wall renders | ✅ Done | `41fe548` |
| T8 | Place Bar tool (click face → 2 points → `placeBar`, default cover from catalog) | bar renders in wall | ✅ Done | — |
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

### T2 — Data models + steel catalog seed ✅ (2026-08-08, committed `71ecca2`)

**Files added:** `src/data/models/` — `geometry.ts` (`Vec3`, `Plane`), `elements.ts` (`WallElement`, `ConcreteElement` union), `reinforcement.ts` (`ReinforcementBar` with stored cover intent, §C), `sections.ts` (`SectionDefinition` with `viewDepth`, §G.2.3), `project.ts` (`ProjectModel` — §H.1 subset, normalized entity dictionaries), `index.ts` (type-only barrel). `src/data/catalog/steel.ts` — `SteelCatalog` JSON-shaped per §K.5: DE / DIN 1045+EC2 seed, 8 diameters with nominal kg/m weights (feeds §J schedule later), grade `B500B`, cover defaults (wall 25 mm), `DEFAULT_DIAMETERS` convenience export. `.gitkeep` files removed from both dirs.

**Design notes:** all coordinates plain numbers (JSON-serializable, §H.1); derived values (wall length, meshes, section primitives) documented as never stored; magic-number lint satisfied because catalog data lives in object literals (`detectObjects: false`).

**Verification:** `pnpm lint` ✅ · `pnpm build` ✅ (typecheck covers the new modules).

### T3 — `generate_bar_mesh` + bridge binding + smoke scene ✅ (2026-08-08, committed `0a279e1`)

**Files added:** `core/src/mesh.rs` (swept-cylinder mesh: right-handed ring frames, outward-wound sides + flat end caps, mitered joints for bent paths, degenerate input → empty mesh; 5 Rust unit tests), `src/engine/bar-geometry.ts` (`createBarGeometry` + temporary `createTestBarGeometry` fixture).

**Files changed:** `core/src/lib.rs` (`mod mesh;`), `src/engine/wasm-bridge.ts` (real `generateBarMesh` returning `BarMeshData` — Float32 positions/normals + Uint32 indices per Q1-b; WASM struct freed after array extraction), `src/App.tsx` (temporary R3F smoke scene — WASM-gated, drei `Bounds` auto-fit, replaced in T6/T7), `package.json` (+ `@types/three` devDep).

**Verification:** `cargo test` 5/5 ✅ (counts, radius, unit radial normals, degenerate inputs, bent bar) · Node round-trip ✅ (42 verts / 240 indices for a 2-point Ø16/20-seg bar, radius error ~2e-7 mm, `free()` OK) · `pnpm lint` ✅ · `pnpm build` ✅ (WASM 27.8 kB / 12.4 kB gzip; JS bundle 1.1 MB / 302 kB gzip — three.js; code-splitting deferred to M4 performance work).

**Visual check for the author:** `pnpm dev` → orbitable orange Ø16 bar. Approve = smoke scene confirmed rendering.

### T4 — Store: slices + typed hooks ✅ (2026-08-08, approved by author)

**Files changed:** `src/stores/project-slice.ts` (state = `ProjectModel`; reducers `addElement/removeElement/addBar/removeBar/addSection/removeSection/resetProject`; header documents §N: reducers called by commands only, deletion cascades explicit per-bar for action-log transparency), `src/stores/ui-slice.ts` (+ `selection`, `placementDraft`, `activeSectionId`; `startDraft/addDraftPoint/clearDraft` lifecycle), `src/main.tsx` (Redux `Provider` wired), `README.md` (session state).

**Files added:** `src/stores/hooks.ts` (`useAppDispatch`/`useAppSelector` via `.withTypes()`).

**Deviation from plan (minor):** `placementDraft.faceId` → `hostElementId` + `faceNormal` — wall faces are not first-class entities until face sampling (M3); the pair fully determines the cover offset direction for M0.

**Verification:** `pnpm lint` ✅ · `pnpm build` ✅ (typecheck). Store behavior tests arrive with vitest in T5.

### T6 — App shell + toolbar + status bar ✅ (2026-08-08, committed `20fe9b6`)

**Files added:** `src/ui/styles/` — `tokens.css` (doc 10 token system: HSL color channels in `:root`/`.dark`, typography + CAD density tokens, Tailwind v4 `@theme` mapping → semantic utilities like `bg-panel`, `h-control`, `w-panel-left`; no `tailwind.config.ts`), `globals.css` (base layer, replaces the `src/index.css` placeholder). `src/ui/toolbar/` — `icons.tsx` (6 monochrome 24×24 stroke icons, inherit currentColor, §B.6 rule 5), `shortcuts.json` (§B.6 rule 3 key→tool config: V/W/B/S/H), `tools.ts` (tool metadata: label, default status-bar hint, shortcut, icon), `ToolButton.tsx` (Radix tooltip; click = activate, double-click = sticky lock, §B.6 rules 1–2), `Toolbar.tsx`, `use-tool-shortcuts.ts` (global keydown: shortcuts + Esc → deselect + Select per §B.5; ignores editable targets and modifier combos). `src/ui/shell/` — `AppShell.tsx` (§B.2 layout), `TopBar.tsx` (product + project name), `StatusBar.tsx` (active tool + hint, snap toggle, grid, coordinate placeholders for T7). `src/ui/panels/SidePanel.tsx` (Building/Properties tabs via Radix, §B.2). `src/ui/viewport/ViewportPlaceholder.tsx` (T7 slot).

**Files changed:** `src/stores/ui-slice.ts` (+ `snapEnabled`/`gridSpacingMm` 100 mm §B.3 default, `toggleSnap`; `ToolId` exported), `src/App.tsx` (T3 smoke scene removed — shell owns the screen), `src/main.tsx` (globals.css), `index.html` (`dark` class = theme switch, doc 10), `tsconfig.app.json` (+ `resolveJsonModule`), `src/engine/bar-geometry.ts` (temporary `createTestBarGeometry` fixture removed with the smoke scene).

**Design notes:** tool state is UI state, not project model — dispatching ui-slice `setTool`/`toggleSnap`/`clearSelection` from UI is the §B.6-sanctioned mechanism; §N commands remain the only doorway for project mutations (none exist in T6 UI). Auto-return to Select fires on tool *completion* — arrives with the tools themselves (T7/T8). Default theme: dark (CAD convention) via one class on `<html>`; light theme = remove the class. JS bundle dropped 1.1 MB → 291 kB (three.js no longer imported by the shell; returns with Viewport3D in T7).

**Review fix 2 (author test 3.3):** on Esc, the previously active tool button keeps DOM focus and showed the browser's default white `:focus-visible` outline (unstyled — my omission). Added a semantic `--focus-ring` token (tokens.css, both themes) + explicit `focus-visible` styling on tool buttons, status-bar snap toggle, and panel tab triggers. The blue focus outline on the previously active button after Esc is intended keyboard-focus indication — it follows DOM focus and disappears on the next click; the sticky ring means "locked tool".

**Review fix (author test 2.4):** sticky indicator was an inset `ring-primary-foreground` — in the dark theme that color ≈ panel background, so the ring was invisible (looked like the active background shrank). Changed to an outer `ring-2 ring-primary ring-offset-2 ring-offset-panel` — visible in both themes.

**Deferred to UI/UX polish phase (post-proof, author's call 2026-08-08):** focus ring lingering on the previously active tool until the next click; general focus-management refinement (e.g., returning focus to the viewport after tool switching).

**Verification:** `pnpm lint` ✅ (incl. prettier) · `pnpm test` 23/23 ✅ · `pnpm build` ✅ · built CSS confirmed to contain every custom token utility (`h-control-lg`, `w-panel-left`, `h-statusbar`, …) · doc 10 review check: zero hex/px/font-size literals in `src/ui` outside `tokens.css` ✅.

### T5 — Commands + registry + `CommandError` + vitest ✅ (2026-08-08, committed `a7934d2`)

**Files added:** `src/commands/` — `command-error.ts` (`CommandError`, codes `INVALID_PARAMS`/`NOT_FOUND`), `place-wall.ts`, `place-bar.ts` (catalog defaults for cover/grade resolved inside the command), `create-section.ts` (normal normalized; M0 vertical-plane guard), `delete-element.ts` (explicit per-bar cascade + selection prune), `delete-bar.ts`, `set-active-section.ts`, `index.ts` (barrel + `commandRegistry` name→thunk map, §N.2 MCP door), 5 test files + `test-utils.ts` (23 tests). `vitest.config.ts` (node env, `@` alias — commands are UI-free, no jsdom).

**Files changed:** `src/stores/index.ts` (`createAppStore()` factory + `AppThunk` type — isolated stores for headless tests; singleton kept for the app), `package.json` (+ vitest 4.1.10, `test`/`test:watch` scripts), `tsconfig.node.json` (+ vitest.config.ts), `eslint.config.js` (test override: no-magic-numbers/max-lines-per-function/max-nested-callbacks off — declarative spec style).

**Design notes:** all commands take one plain params object (max-params 2), validate, throw `CommandError`, return the created id for caller follow-up (selection, status bar). `deleteElement` keeps sections targeting the removed element — the T9 selector will skip missing targets.

**Verification:** `pnpm test` 23/23 ✅ · `pnpm lint` ✅ · `pnpm build` ✅.

### T7 — Viewport3D + Place Wall tool ✅ (2026-08-08, implemented — awaiting author review)

**Files added:** `src/engine/wall-geometry.ts` (pure `getWallTransform`: box center/yaw/length from wall params; atan2 −π/−0 normalized) + `src/engine/snapping.ts` (`snapPointToGrid`, §B.3) + 10 unit tests. `src/data/appearance.ts` (domain appearance seed — concrete viewport color; doc 10 §5 keeps domain styling out of the UI theme). `src/ui/viewport/` — `Viewport3D.tsx` (R3F Canvas, mm/Y-up scene, transparent canvas so `bg-viewport` shows through), `ViewportControls.tsx` (§B.6 mouse mapping: right-drag orbit, middle pan, scroll zoom; LEFT = pan only while the Pan tool is active), `ViewportGrid.tsx` (drei infinite grid, spacing from ui-slice, 1 mm below y=0 against z-fighting), `GroundPlane.tsx` (opacity-0 hit plane: cursor tracking + per-tool click routing; drag-vs-click via R3F `event.delta`), `WallsLayer.tsx` / `WallMesh.tsx` (box per wall; click-select under the Select tool only, §B.5), `WallDraftPreview.tsx` (snap marker + translucent preview box + committed-point markers; live cursor applied via refs in `useFrame`, §E), `use-place-wall-confirm.ts` (Enter → `placeWall` command → select new wall → auto-return to Select unless sticky, §B.6 rules 1–2; `CommandError` → draft dropped + status-bar explanation), `constants.ts` (world-space scene config), `cursor-position.ts` (transient cursor module: raw ref for `useFrame` + rounded `useSyncExternalStore` snapshot for the status bar), `viewport-theme.ts` (reads `--guide-line`/`--primary`/`--selection`/`--snap-target` tokens → CSS colors for three.js — doc 10: no viewport palette of its own). `src/ui/is-editable-target.ts` (shared keyboard guard, extracted from use-tool-shortcuts).

**Files changed:** `src/commands/place-wall.ts` (+ `DEFAULT_WALL_DIMENSIONS` 200×2800 mm seed — property-panel-editable post-M0), `src/ui/shell/AppShell.tsx` (placeholder → `Viewport3D`), `src/ui/shell/StatusBar.tsx` (live X/Z plan coordinates via the cursor module; placeholder was scheduled for T7), `src/ui/toolbar/use-tool-shortcuts.ts` (uses the shared guard). `ViewportPlaceholder.tsx` deleted.

**Design notes:** snap applies at event time (snap toggle + Shift held, §B.3) to both committed clicks and the live cursor — what you see is what you get. Status bar shows plan X/Z (model space), not the §B.2 mockup's generic X/Y. Wall clicks during placement tools fall through to the ground plane; Select-tool-only selection keeps placement unambiguous. Frameloop stays `always` in M0 (demand mode + damping is M4 performance work, §L).

**Verification:** `pnpm lint` ✅ (incl. prettier; two justified magic-number disables for camera/light position triples) · `pnpm test` 33/33 ✅ · `pnpm build` ✅ (JS 1.2 MB / 336 kB gzip — three.js returns with the viewport; code-splitting deferred to M4 per T3) · doc 10 review check: zero hex/arbitrary-value literals in `src/ui` outside `tokens.css`, zero project-slice imports in `src/ui` ✅.

**Visual check for the author:** `pnpm dev` → grid + orbit (right-drag)/pan (middle-drag)/zoom; **W** → snap marker follows cursor, click-click-Enter places a 200×2800 wall (selected, blue); status bar shows live coordinates, hints advance per click; Esc cancels a draft; double-click **W** (sticky) keeps placing after Enter.

**Review feedback changes (2026-08-08, author):** (1) Markers are now **crosshairs** (one grid cell per arm, tracks `gridSpacingMm`, drawn as an always-on-top overlay) instead of spheres. (2) **Chained placement**: click 1 starts the axis, click 2 creates the wall and immediately starts the next wall from that point; **Esc exits** — no Enter, no auto-return (§B.6 rule 1 revised in the spec). Zero-length click now keeps the draft and shows the error in the status bar. Files: `place-wall-draft.ts` added (click flow + command dispatch), `use-place-wall-confirm.ts` deleted, GroundPlane delegates; tools.ts hint + spec §B.6 (Place Wall row, rule 1) updated.

**Infra fix (same review batch, 2026-08-08):** pnpm 11.20 supply-chain defaults blocked `pnpm dev`/`install` — (1) `minimumReleaseAge` rejected the lockfile: `browserslist@4.28.8` (transitive via `@babel/helper-compilation-targets` + `update-browserslist-db`) was published the same day it was resolved; fixed with an **override pin to 4.28.7** in the new `pnpm-workspace.yaml` (TODO comment: remove once 4.28.8+ ages past the cutoff). Lockfile diff: 8+/5− (override block + 4.28.8→4.28.7); one cosmetic leftover — the `update-browserslist-db@1.3.0(browserslist@4.28.8)` peer-suffix *key* (its dependency correctly points to 4.28.7; pnpm normalizes the key on a future re-resolution). (2) `strictDepBuilds` (v11 default) hard-failed on core-js's unreviewed build script (funding-banner postinstall, via canvg → jsPDF); explicitly disallowed via `allowBuilds: { core-js: false }`. Note: pnpm 11 removed `ignoredBuiltDependencies` (v10 key) — the reviewed-decision mechanism is now the `allowBuilds` map; `pnpm approve-builds` seeds placeholders into `pnpm-workspace.yaml`. Verified: `pnpm install` / `dev` / `lint` / `test` / `build` all pass with zero policy bypass flags.

### T8 — Place Bar tool ✅ (2026-08-08, implemented — awaiting author review)

**Files added:** `src/engine/placement.ts` (M0 face math, pure + three-free: `wallLocalNormalToWorld`, `getWallFaceFrame` — face origin/u/v frame via the box support distance, `resolveFacePoint` — project onto the face plane + snap the in-plane u/v to the grid §B.3, `offsetFromFace` — centerline = face point − normal·(cover + radius)) + 10 unit tests. `src/ui/viewport/` — `place-bar-draft.ts` (chained click flow mirroring `place-wall-draft.ts`: click 1 captures the face — host + outward normal into `placementDraft`; path click 1 starts, path click 2 dispatches the existing `placeBar` command (cover/grade defaults resolved inside, §N) and chains the next bar from that point on the same face; Esc exits via the global tool shortcut; zero-length path keeps the draft + shows the error in the status bar), `BarDraftPreview.tsx` (face-oriented crosshair markers + always-on-top centerline preview line; live cursor via refs in `useFrame`, §E), `BarMesh.tsx` / `BarsLayer.tsx` (WASM `generate_bar_mesh` BufferGeometry per bar — memoized on the bar object identity, disposed on change/unmount; derived geometry never stored §E/§H.2; plain meshes in M0, InstancedMesh at M3 §L.1), `draft-crosshair.ts` (crosshair geometry extracted from WallDraftPreview, shared).

**Files changed:** `src/commands/place-bar.ts` (+ `DEFAULT_BAR_DIAMETER_MM` Ø12 seed — property-panel-editable post-M0; `resolveDefaultCover` extracted so the tool offsets by the same catalog default the command stores), `src/ui/viewport/WallMesh.tsx` (per-tool click routing: Select → select; Place Bar → face capture / path clicks on the host wall; live on-face cursor tracking via the cursor module; concrete now transparent with `depthWrite` off so bars read inside §L.2), `src/ui/viewport/GroundPlane.tsx` (cursor tracking yields to the wall face while a bar draft runs), `src/ui/viewport/WallDraftPreview.tsx` (shared crosshair module), `src/ui/viewport/Viewport3D.tsx` (+ BarsLayer, BarDraftPreview), `src/data/appearance.ts` (+ `rebarColor`, `concreteOpacity` domain seeds, doc 10 §5), `src/stores/ui-slice.ts` (`PlacementDraft` type exported), `src/ui/toolbar/tools.ts` (Place Bar hint), spec §B.6 (Place Bar row: chained, no Enter — same 2026-08-08 revision as Place Wall).

**Design notes:** path clicks raycast the host wall; the hit is projected onto the *captured* face plane, so the bar path always lies on the chosen face even when the ray hits another face of the host. Snapping happens in face-local (u,v) coordinates — same function for preview and commit (what you see is what you get). Mid-draft clicks on a *different* wall are ignored; re-capturing a face is possible only before the first path point. Face capture uses the raycast face normal rotated into world space (`wallLocalNormalToWorld`) — works for side, top, and end faces. Cover offset = `defaultCover[host.kind]` (25 mm wall) + Ø/2 = 31 mm for the Ø12 default. Bars render in the domain rebar orange; selection highlight stays a UI token.

**Known M0 limitations (documented, by design):** clicking a bar inside concrete selects the wall first (raycast hits the nearer face) — Shift+scroll cycling through overlaps (§B.5) is post-M0; overlapping transparent walls may sort imperfectly (M4 performance/rendering work, §L).

**Verification:** `pnpm lint` ✅ (incl. prettier) · `pnpm test` 43/43 ✅ (10 new placement tests) · `pnpm build` ✅ · doc 10 review check: zero hex/arbitrary-value literals in `src/ui` outside `tokens.css`, zero project-slice imports in `src/ui` ✅.

**Visual check for the author:** `pnpm dev` → place a wall (W), then **B** → click a wall face (hint advances), click two points on the face — an orange Ø12 bar appears 25 mm inside the concrete (visible through the translucent wall), selected in blue; each further click chains the next bar on the same face; the preview line/crosshair track the cursor snapped to the grid on the face; Shift disables snap; Esc exits. Clicking a different wall mid-draft does nothing; clicking the ground does nothing.

**Review feedback changes (2026-08-08, author) — chain = ONE bar with bending places:** the initial T8 created a *separate* bar per segment. Wrong domain semantics: a chained path is a single bar with bends — one position in the schedule (§J), one entry in the Building-tab bar count. Reworked: the 2nd path click creates the bar via `placeBar`, every further click **extends the same bar** via the new §N command `extendBar` (registry now 7 commands) → project-slice reducer `appendBarPoint`; `placementDraft.barId` tracks the bar being extended. `placeBar` now accepts 2+ point paths (zero-length *segments* rejected, including middle ones). Spec §B.6 updated (Place Bar row + rule 1 chaining semantics: walls chain to separate walls, bars chain into one bar). Files: `extend-bar.ts` + tests added; `place-bar.ts`, `project-slice.ts`, `ui-slice.ts`, `place-bar-draft.ts`, `reinforcement.ts` comment, `tools.ts` hint updated; headless regression test `place-bar-draft.test.ts` proves 4 clicks → 1 bar with 4 path points at 31 mm inside the face. Note: starting a *new* bar on the same face = Esc, then B + face click again (no in-chain "new bar" gesture in M0). Tests 43 → 50.

**Review feedback changes #2 (2026-08-08, author) — cover from ALL faces:** the initial T8 offset the centerline only from the *captured* face, so bars clicked at wall edges ended flush with the concrete. Wrong: cover applies in every direction. Added `applyConcreteCover` + `resolveBarCenterline` (engine/placement): face clicks → centerline offset from the captured face (cover + radius), then every vertex is clamped inside the wall's local box with per-axis insets `cover + radius·√(1−(d·axis)²)` per adjacent segment — exactly *cover* where the bar terminates into a face (flat end cap), *cover + radius* where it runs alongside (cylinder surface); bent corners near an edge get the larger inset automatically; degenerate thin elements collapse to the center plane. The committed path and the preview line share the one resolver (WYSIWYG). Only the NEW endpoint is appended on extension — already-committed vertices are never moved. Files: `placement.ts` (+7 unit tests: end faces, top/bottom edges, bent corner, yawed wall, thin-wall guard), `place-bar-draft.ts`, `BarDraftPreview.tsx`, +1 draft-flow test (edge clicks → 25 mm insets). Spec §B.6 Place Bar row updated. Tests 50 → 58.

**Review feedback changes #3 (2026-08-08, author) — bending radius at bends:** chained bars now render rounded bends instead of sharp miters. **Data provenance:** the Allplan-retrieved docs contain only the glossary term "Biegerolle" (bending roller/mandrel diameter, doc 04) — no numeric table was extracted. Seeded standard code values instead: DIN 1045-1 / EN 1992-1-1 Table 8.1 for B500B → min mandrel Ø = 4·Ø (Ø ≤ 16) / 7·Ø (Ø > 16), stored as `mandrelDiameter` per diameter in the steel catalog (swap the catalog if the true Allplan tables get extracted later). Centerline bend radius = mandrel/2 + Ø/2 (Ø12 → 30 mm) via `resolveBendRadiusMm`. **Implementation:** Rust `mesh.rs` — `round_path_corners` resamples the polyline, replacing each interior vertex with a tangent arc (tangent length R·tan(φ/2), shrunk to fit half the shorter adjacent segment so neighbouring bends never overlap; 6 rings per 90°); the existing sweep renders the arcs. `generate_bar_mesh` gained a `bend_radius` param (0 = sharp miters). The **stored path keeps sharp vertices** (design intent — segment lengths/bending shapes for §J/§M.4); the radius is render geometry only, resolved in `engine/bar-geometry.ts` from the catalog with an optional override param keeping the post-POC property control door open. The draft preview line stays sharp (centerline intent); the placed mesh shows the true bend. Cover clamping unchanged — rounded bends bulge *less* past a corner vertex than the old miters did, so the all-faces cover guarantee still holds. Tests: Rust 5 → 9 (arc tangent pullback, arc midpoint radius, zero-radius passthrough, short-segment radius shrink, ring counts); TS 58 → 61 (catalog mandrel table + radius helper). WASM: 27.8 → 31.1 kB raw / 13.8 kB gzip. `pnpm wasm:build` re-run (pkg regenerated).

**Review fix #4 (2026-08-09, author screenshot) — surface kink at bends:** the bend arcs exposed a latent mesh bug — `ring_basis` picked its reference axis PER RING and flipped it when the path direction crossed the 0.9 Y-component threshold, which happens mid-arc on vertical→horizontal bends; the cross-section twisted ~90° between two adjacent rings, shearing the surface into a visible pinch. Fixed with **parallel-transported ring frames** (`ring_frames`/`transport_basis` in mesh.rs): heuristic basis only for the first ring, each subsequent frame is the previous one minimally rotated to the new direction (Rodrigues) — no reference flips, no twist, anywhere on the path. Rust test added (`ring_frames_do_not_twist_across_a_vertical_bend`: consecutive frame dot > 0.9 across a vertical bend). Rust 10/10, TS 61/61, WASM 32.7 kB / 14.7 kB gzip.

## Change Log

| Date | Change |
| --- | --- |
| 2026-08-08 | Plan written and approved (Q1-b, Q2-yes, Q3-no-plugins) |
| 2026-08-08 | T1 implemented; task tracker created |
| 2026-08-08 | T1 committed (`bc11f9b`); T2 implemented, awaiting review |
| 2026-08-08 | T2 committed (`71ecca2`) |
| 2026-08-08 | T3 implemented, awaiting review |
| 2026-08-08 | T3 committed (`0a279e1`) — visual confirmed by author |
| 2026-08-08 | T4 implemented + approved by author |
| 2026-08-08 | T5 implemented + approved by author, committed (`a7934d2`) |
| 2026-08-08 | T6 implemented; author visual pass — two review fixes (sticky ring contrast, focus-visible token) |
| 2026-08-08 | T6 committed (`20fe9b6`) — visual confirmed by author |
| 2026-08-08 | T7 implemented, awaiting author review |
| 2026-08-08 | pnpm 11 supply-chain policies fixed (`pnpm-workspace.yaml`: browserslist pin + core-js allowBuilds) — `pnpm dev` unblocked |
| 2026-08-08 | T7 review feedback: crosshair markers + chained placement (spec §B.6 rule 1 revised) |
| 2026-08-08 | T7 committed (`41fe548`) — pushed to `A_MVP_Scope_M0` |
| 2026-08-08 | T8 implemented (chained Place Bar, spec §B.6 Place Bar row updated), awaiting author review |
| 2026-08-08 | T8 review feedback: chained bar placement = ONE bar with bending places (`extendBar` command), not N separate bars — spec §B.6 rule 1 updated |
| 2026-08-08 | T8 review feedback #2: concrete cover now kept from ALL wall faces (edges/start/end pull the bar inside — `applyConcreteCover` in engine/placement) |
| 2026-08-08 | T8 review feedback #3: bending radius at bends — catalog `mandrelDiameter` seed (DIN 1045-1 / EC2 Table 8.1: 4·Ø ≤ 16, 7·Ø > 16) + tangent-arc sweep in Rust mesh; stored path keeps sharp vertices |
| 2026-08-09 | T8 review fix #4: bend surface kink — per-ring frame reference flip replaced with parallel-transported ring frames (Rust mesh) |
| 2026-08-09 | T8 approved by author — visual pass confirmed (chaining, all-faces cover, smooth bends) |
