# M1 — Edit + Reactivity: Plan & Task Tracker

> **Back to:** [Implementation Plans & Tasks](./README.md) · [Root README](../../README.md) · [Architecture Spec](../08-architecture-spec.md)
> **Plan approved:** 2026-08-09 — author accepted the recommendations for Q1/Q2/Q4; Q3 decided as **dedicated Move tool (M)**; §E revised to **host-follow** (move/copy element → hosted bars follow, same command transaction).

---

## ▶️ Current State (read this first in a fresh session)

- **M1: ✅ PLAN APPROVED (2026-08-09)** — Q1–Q4 answered (see below); §E revised to host-follow. M0 is ✅ complete ([tracker](./m0-one-wall-one-bar.md)); branch `A_MVP_Scope_M1`. **T1 ✅ complete** (undo core, 2026-08-09); **T2 ✅ complete** (edit commands + reactivity proofs, 2026-08-09 — see task log); **T3 ✅ complete** (edit UI: keyboard + Edit menu + hover picking — see task log); **T4 ✅ complete** (Move tool + §G.1 bounded-section revision — see task log; render approach decided: **live-offset**); **T5 ✅ complete** (performance probes, approved 2026-08-09 — the §5 recompute probe passes at ~3.5 ms median; **finding F3 stays OPEN: the `moveElement` dispatch itself exceeds the 16 ms frame budget at reference scale (~37 ms median) — author's decision pending, candidates in the T5 task log**); **T6 is next**.
- **Workflow (same as M0):** implement one task → `pnpm lint` + `pnpm test` + `pnpm build` green → present changes + manual test list → **author reviews and commits (all working-tree changes, rule 8)** → next task.
- **Manual test scenarios:** `docs/test-scenarios/m1-edit-and-reactivity.md` (created in T3; M1-S01…S09 — root README rule 7).
- **Known console warning (report-only, 2026-08-09):** `THREE.Clock: This module has been deprecated. Please use THREE.Timer instead.` fires once on app load. Source: R3F 9.7.0's internal root store (`clock: new THREE.Clock()` in its dist) × three r183+ deprecation — not our code (no `Clock`/`state.clock` usage anywhere in `src/`; Drei clean). Harmless; R3F v10 (alpha) has already removed `state.clock` entirely, so the warning disappears with the future R3F 10 upgrade. No action — do NOT patch R3F (Timer's API differs; a naive swap would break frame deltas) and do NOT downgrade three for a cosmetic warning.

## M1 Goal (Architecture Spec §A)

> **Move wall → section updates. Undo/redo.**
> **Risks probed:** dependency graph correctness · full recompute performance · undo stack memory.

**Milestone acceptance:** place wall → place bar → cut section → **move the wall → the wall AND its hosted bars update in 3D (host-follow, §E revised 2026-08-09) and the open 2D section view updates immediately** → **undo restores wall+bars to the pre-move state exactly in one step, redo re-applies it**; 30 undo levels, every M0+M1 command undoable.

### Scope

| In scope | Explicitly out (and why) |
| --- | --- |
| Undo/redo per §E (30 levels, session-only, project state only) | Persisted undo (§H.2 — undo stack is never persisted) |
| `moveElement` command (walls; hosted bars follow — §E revised) + dedicated **Move tool (M)** — first §B.6 Modify-category tool | Bar-relative-to-host move/edit tools (M3 edit workflows); Copy/Mirror/Array (§B.6 Modify category — post-M1; Copy inherits host-follow when it lands) |
| Delete UI for elements, bars, sections (F1 from M0 T11) + `deleteSection` command | Multi-select marquee, Ctrl+Click toggle (§B.5 — arrives with edit-heavy M3) |
| Keyboard: Delete, Ctrl+Z / Ctrl+Shift+Z; Edit menu in TopBar | User-editable shortcuts in-app (§B.6 rule 3 — post-M0 already, still deferred) |
| Reactivity + performance probes (headless benchmarks) | Incremental dependency graph (§E chose full recompute — M1 *measures* it, does not replace it) |

**Door check (§N + deferred topics — root README planning rule):**

- **MCP / scripting / NL input (§N.2):** undo, redo, move, delete are registered commands like any other — an external agent can drive editing through the same registry. The undo recording mechanism (Q1) is command-agnostic: any *future* command is automatically undoable with zero extra code. Door widened, not closed.
- **Layer Model (deferred, before M4):** move/delete/undo touch no layer concept; selection state stays id-based and layer-agnostic. Door open.
- **Dimension & Annotation System (deferred — "prototype early, 2D-only, after the first 2D view exists"):** the first 2D view exists since M0 T10. M1 does not build annotation, but its reactivity proof keeps `selectSectionPrimitives` as the clean 2D-primitive substrate annotation will draw on. Door open — candidate for an early prototype session in parallel with M2/M3.
- **§E/§H.2:** snapshots live in a separate slice, never in `ProjectModel`; meshes/section primitives stay derived-only (the undo restore naturally regenerates them via selectors). Door open.
- **F2 (M0 T11 finding):** if a second consumer of `DEFAULT_WALL_DIMENSIONS` appears during M1, move the seed to `src/data/` in the same task.

### Decisions (Q1–Q4 — answered by the author 2026-08-09; recommendations marked ⭐)

| Q | Question | Options |
| --- | --- | --- |
| **Q1** ✅ (a) | **Undo recording mechanism.** §E locks *what* (full snapshots, 30 levels, meshes excluded); this is the *how*. | **(a) ⭐ APPROVED — RTK listener middleware** on `project-slice` mutations: records the pre-action project state (`getOriginalState()`) onto a `past` stack in a new `undo-slice`, clears `future`, caps at 30. Automatic for every current AND future command — nothing to remember, headless-testable through the store factory. The restore action itself is excluded from recording. **(b)** Explicit snapshot call inside each command thunk — equally simple today (8 commands) but every future command must remember it; silent undo gaps are the likely failure mode. |
| **Q2** ✅ (a) | **Snapshot representation.** §E estimates 5–10 MB per snapshot × 30. | **(a) ⭐ APPROVED — frozen state references (Immer structural sharing):** Immer never mutates in place, so storing the pre-action `ProjectState` reference *is* a correct snapshot at near-zero cost — unchanged entities are shared, not copied. Actual memory measured in T5 against the §E estimate. **(b)** Deep-copy/JSON snapshots — matches the §E estimate literally, wastes memory, no correctness benefit under Immer. |
| **Q3** ✅ (b) | **Move interaction.** | **(b) AUTHOR'S CHOICE — dedicated Move tool (M)**, the first §B.6 Modify-category tool: with Move active, drag a wall → transient drag (live offset in component refs, ghost preview, grid snap per §B.3, Shift disables snap, Esc cancels); `moveElement` dispatches on pointer-up only (§E transient-state rule — same pattern as the T10 section-volume drag). Single-shot per §B.6 rule 1: the tool auto-returns to Select after one move (double-click locks it sticky, §B.6 rule 2). The Select tool does NOT move elements — one way to move, no ambiguity. (Rejected: (a) Figma-style Select-drag.) |
| **Q4** ✅ (a) | **Undo granularity for chained placement.** Place Wall chains separate walls (one command each — naturally one undo level per wall). Place Bar chains `extendBar` clicks onto ONE bar. | **(a) ⭐ One undo level per command dispatch:** undoing a 4-point bar removes the last bend point, then the previous, …, then the bar itself. Matches the action log exactly, zero special cases. **(b)** Coalesce a whole chain (creation + appends) into one undo level — nicer for long chains, but requires session-boundary logic in the recording mechanism (M1 complexity for M3-scale ergonomics). |

---

## Approved Plan (summary — sections become tasks below)

### 1. Undo/redo core (§E) — `src/stores/undo-slice.ts` + middleware + commands

- `undo-slice.ts`: `{ past: ProjectState[]; future: ProjectState[] }` — session-only, outside `ProjectModel` (§H.2). Reducers: `recordSnapshot`, `shiftToFuture`, `shiftToPast`, `clearHistory` (called by the middleware and the undo/redo commands only, per §N).
- Listener middleware (Q1-a) registered in `createAppStore` — headless stores get undo automatically (command tests, future MCP door). Matches all project-slice mutating actions **except** `restoreProjectSnapshot`; pushes pre-state, clears `future`, trims to 30.
- `project-slice`: new `restoreProjectSnapshot(state, action)` reducer — wholesale replace (the M0 T11 audit already verified every reducer keeps the state plain JSON, so any historical snapshot restores cleanly).
- New §N commands: `undo`, `redo` (registry entries — scriptable like everything else). Guard: no-op with status hint when the respective stack is empty. Undo/redo are NOT themselves recorded.
- Undo covers **project state only**; selection is not restored (dangling ids are harmless — render layers tolerate missing entities).

### 2. Edit commands (§N) — `moveElement`, `deleteSection`

- `moveElement({ elementId, delta: Vec3 })` — validates the element exists and the delta is finite/non-zero; dispatches a new `translateElement` reducer (walls: translates `startPoint`/`endPoint`; `baseElevation`, `thickness`, `height` untouched) **plus `translateBar` for every bar whose `hostElementId` matches (host-follow, §E revised 2026-08-09)** — explicit per-bar dispatches in the same command, like the `deleteElement` cascade, so the action log shows every change and one undo snapshot restores wall+bars exactly.
- `deleteSection({ sectionId })` — completes the delete family (`removeSection` reducer has existed since M0 without a command); clears `activeSectionId` if it pointed at the deleted section.
- Reactivity proven headlessly here (before any UI): place wall+bar+section → `moveElement` → `selectSectionPrimitives` re-derives (outline follows the wall; the cut-bar dot keeps its 31 mm offset from the covered face because the bar follows its host); move the wall fully off the cut plane → outline/dot set updates correctly; `deleteElement` → section drops the wall; `deleteBar` → dot gone. This is the §A "dependency graph correctness" probe: the memoized-selector graph (project state → bar meshes / section primitives) re-derives correctly after every edit class.

### 3. Edit UI entry points — keyboard + Edit menu

- Keyboard (extends `use-tool-shortcuts`, same `isEditableTarget` guard): **Delete/Backspace** → delete current selection (element/bar/section — dispatches the matching command per selection contents); **Ctrl+Z** → `undo`, **Ctrl+Shift+Z** (Figma convention) → `redo`.
- **Edit menu in TopBar** (the M0 TopBar comment already reserves this: "File/Edit/View menus arrive with … edit commands (M1+)"): Undo / Redo / Delete entries with shortcut labels and disabled states (empty stacks / empty selection). Discoverability for mouse-first users; tokens-only styling (rule 6).
- Status-bar hints on empty undo/redo and on delete of nothing.

### 4. Move tool (M) — first §B.6 Modify-category tool (Q3-b)

- New `ToolId` `'move'` + `shortcuts.json` entry (`m`) + toolbar icon (§B.6 rule 5: SVG, 24×24, token-colored). With Move active: pointer-down on a wall begins a potential drag (click-vs-drag threshold as in T10 section volumes); live drag state in component refs (§E — no 60 FPS dispatches); the wall AND its hosted bars render at the dragged offset locally (ghost or live-offset render, decided in task); grid snapping applies to the delta (§B.3; Shift disables); Esc cancels mid-drag.
- Pointer-up → `commitElementDrag` module (React-free, mirroring `section-volume-drag.ts`) → `moveElement` command → one undo level per drag (wall + hosted bars together, host-follow).
- Single-shot (§B.6 rule 1): after one completed move the tool auto-returns to Select; double-click locks it sticky (rule 2). The Select tool never moves elements (Q3-b — one way to move).
- The 2D section (if open) updates on commit via the memoized selector.

### 5. Reactivity + performance probes (§A risks, headless)

- **Full-recompute performance:** benchmark test at a reference scale (e.g. 50 walls × 20 bars = 1,000 bars + sections): time `selectSectionPrimitives` recompute + bar-mesh selector regeneration after a `moveElement`. Report actual ms in the task log; assert under a generous frame budget (16 ms) or escalate if exceeded.
- **Undo stack memory:** build the same reference project, record 30 edits, measure retained size of the undo slice (Q2-a structural sharing vs the §E 5–10 MB/level estimate). Report actuals in the task log.

### 6. Milestone acceptance (mirrors M0 T11)

- `src/commands/m1-acceptance.test.ts` — the M1 acceptance sentence end-to-end through the §N commands.
- Rule-by-rule audit against the root README Review Checklist — including the **"Undo/redo (§E) works for every newly added command"** row that was N/A in M0.
- Docs sweep: README session state, plans index, scenario file M1-S01… persisted (rule 7).

---

## Task Tracker

| # | Task | Verify by | State | Commit |
| --- | --- | --- | --- | --- |
| T1 | Undo core: undo-slice + listener middleware + `restoreProjectSnapshot` + `undo`/`redo` commands (Q1/Q2) | headless tests: all 8 M0 commands undo/redo, cap 30, future cleared, delete-cascade restores, memory-light snapshots | ✅ Done | `491c5f3` |
| T2 | Edit commands: `moveElement` (+ `translateElement`/`translateBar` reducers, host-follow per §E revised), `deleteSection`; headless reactivity proofs (§A dependency-graph probe) | unit tests: move → wall+bars translate, section primitives re-derive; one undo restores all; deletes propagate | ✅ Done | `fa5ed7c` |
| T3 | Edit UI: Delete / Ctrl+Z / Ctrl+Shift+Z keybindings + Edit menu (TopBar) + status hints; hover picking (author review addition); scenario file started | manual: keyboard + menu drive undo/redo/delete; guards in editable fields; hover previews click winner | ✅ Done | `ece79bf` |
| T4 | Move tool (M) (Q3-b): toolbar + shortcut, transient drag, live-offset render (decided in task), grid snap, Esc cancel, single-shot auto-return, `commitElementDrag` → `moveElement`; review fixes: "highlighted = what will move" picking + §G.1 bounded cut line | manual: M + drag wall → wall+bars move in 3D, open 2D section updates on drop; undo reverts all; Select never moves; bar grab moves nothing | ✅ Done | `8a2233a` |
| T5 | Performance probes: full-recompute benchmark + undo-stack memory measurement (§A risks) | numbers reported in task log; assertions green | ✅ Done | this commit |
| T6 | M1 acceptance pass: `m1-acceptance.test.ts` + checklist audit (incl. undo-per-command row) + docs/scenarios sweep | checklist verdict table green; lint/test/build green | ⬜ Pending | — |

---

## Task Log

### T1 — Undo core: undo-slice + listener middleware + `restoreProjectSnapshot` + `undo`/`redo` ✅ (2026-08-09, committed `491c5f3`)

**Files added:** `src/stores/undo-slice.ts` (`{ past, future }` frozen-reference snapshots, §E 30-level cap with oldest-trim, session-only per §H.2; reducers `recordSnapshot` / `shiftToPast` / `shiftToFuture` / `clearHistory` — called by the middleware and the undo/redo commands only, per §N), `src/stores/undo-middleware.ts` (Q1-a listener middleware + command-scope middleware, see design note), `src/commands/undo.ts`, `src/commands/redo.ts` (guards: no-op + status hint via `cursorHint` on empty stacks; never themselves recorded), `src/commands/undo.test.ts` (12 tests).

**Files changed:** `src/stores/project-slice.ts` (`restoreProjectSnapshot` wholesale-replace reducer; `ProjectState` type exported), `src/stores/index.ts` (undo reducer + middleware chain wired into `createAppStore` — headless stores record automatically, which is also the MCP/scripting door §N.2), `src/commands/index.ts` (registry: `undo`, `redo` — 10 commands), `src/commands/command-registry.test.ts` (expected list updated).

**Design note — one level per command (Q4-a) vs. cascades:** pure per-action recording would give `deleteElement` one level per cascade action (wall + 2 bars = 3 levels), contradicting the approved "cascade restores in one step" and T2's host-follow "one undo snapshot restores wall+bars". A cascade and two sequential commands are *observationally identical* at the action level, so a tiny `undoScopeMiddleware` wraps every thunk invocation (all §N commands ARE thunks) in a command scope; the listener records only the scope's first project mutation. Fully command-agnostic — future commands need zero undo code, so the Q1-b failure mode (remembering a snapshot call per command) stays rejected. Guards: no-op actions (pre-state === post-state reference) record nothing; `restoreProjectSnapshot` is excluded from the matcher. Verified by tests: sequential commands are NOT over-coalesced.

**Verification:** `pnpm lint` ✅ · `pnpm test` ✅ (140 vitest — 12 new: all 8 M0 commands undo/redo-able [setActiveSection records nothing by design — undo covers project state only], deleteElement cascade = one exact-reference restore, future clears on new action, cap 30 trims oldest, undo/redo never recorded, empty-stack guards + hints, frozen snapshots + structural sharing (Q2-a), sequential commands get separate levels) · `pnpm build` ✅ (chunk-size warning is the pre-existing three.js bundle, deferred to M4 performance work per M0 T3).

**Manual test list (rule 7) — ✅ approved by the author 2026-08-09** (scenario file `m1-edit-and-reactivity.md` is created in T3 per plan):

1. `pnpm dev` → the app loads and behaves exactly as at M0: place wall (W, chained), place bar (B, chained bends), section cut (S, drag + depth click), reshape the section via its 3D wireframe volume, delete nothing / delete via nothing — no UI regressions anywhere (T1 touches no UI; undo has no UI yet — keyboard + Edit menu arrive in T3).
2. Redux DevTools: place a wall → one `undo/recordSnapshot` action per command; delete a wall with bars → exactly ONE `recordSnapshot` for the whole cascade; `project/restoreProjectSnapshot` never triggers a recording (no UI trigger for undo/redo yet — optional check, the headless tests cover this).

### T2 — Edit commands: `moveElement` (host-follow) + `deleteSection` + headless reactivity proofs ✅ (2026-08-09, committed `fa5ed7c`)

**Files added:** `src/commands/move-element.ts` (§N command: validates element exists + delta finite/non-zero, then dispatches `translateElement` plus one explicit `translateBar` per hosted bar — host-follow per §E revised 2026-08-09, exactly like the deleteElement cascade; ids unchanged → no selection pruning), `src/commands/delete-section.ts` (completes the delete family; the `removeSection` reducer existed since M0 without a command — now wired; clears `activeSectionId` when the 2D panel showed the deleted section), `src/commands/move-element.test.ts` (6 tests), `src/commands/m1-reactivity.test.ts` (4 tests — the §A dependency-graph probe).

**Files changed:** `src/stores/project-slice.ts` (`translateElement` — walls: plan axis shifts, baseElevation/thickness/height untouched, grows with the element union at M3/M4 — and `translateBar` — every path point incl. bending places), `src/stores/undo-middleware.ts` (both reducers added to the recording matcher), `src/commands/index.ts` (registry: `moveElement`, `deleteSection` — 12 commands), `src/commands/command-registry.test.ts` (expected list updated), `src/commands/delete-commands.test.ts` (`deleteSection` describe block — the delete family now lives in one file: element, bar, section).

**Design notes:**
- **Vertical deltas:** `translateElement` moves the wall's plan axis only (the plan text: baseElevation/thickness/height untouched), while `translateBar` applies the full delta — a non-zero `delta.y` would shift hosted bar paths without lifting the parametric wall. The T4 Move tool drags in plan (`delta.y = 0`); the command accepts a full Vec3 for the scripting/MCP door (§N.2) and documents this. If a vertical element move becomes a real workflow (M4 storeys), that is the point to revisit.
- **Zero delta rejected:** a no-op move would otherwise pass the middleware's pre/post reference guard unrecorded but still spam the action log — `INVALID_PARAMS` keeps both clean.
- **`deleteSection` closes the panel via the ui-slice action directly** (like deleteElement dispatches slice actions, not other commands) — `activeSectionId` is ui state, so undo (project state only, §E) does not reopen the panel on restore; asserted by test.

**Reactivity proofs (§A dependency-graph probe, `m1-reactivity.test.ts` — M0 acceptance fixture: wall 4000×200×2800, Ø12 bar at 25 mm cover from +Z, perpendicular cut at x=2000 looking +X):**
1. Memoization baseline: repeated `selectSectionPrimitives` calls on unchanged state return the identical reference.
2. `moveElement` 1000 mm along +Z → new primitives reference (re-derived); outline u-range follows the wall exactly (+1000); the cut-bar dot moved +1000 and keeps its **31 mm offset from the covered face** (bar followed its host); `undo` restores the exact project reference → the memoized selector returns the baseline object itself.
3. `moveElement` fully off the cut plane (+10 000 mm X, beyond viewDepth) → outline/dot/background sets all empty, section survives; moving back re-derives the full picture.
4. `deleteElement` → section kept (deleteElement keeps sections by design) but drops outline + dot; undo restores the baseline reference exactly.
5. `deleteBar` → dot gone, outline (thickness × height) stays.

**Verification:** `pnpm lint` ✅ · `pnpm test` ✅ (154 vitest — 14 new: moveElement wall+bars translate / other hosts untouched / one undo level exact-reference restore + redo / NOT_FOUND / non-finite delta / zero delta; deleteSection removes + closes panel / other section keeps panel / undo-redo exact restore / NOT_FOUND; the 4 reactivity probes above) · `pnpm build` ✅ (chunk-size warning is the pre-existing three.js bundle, deferred per M0 T3).

**Manual test list (rule 7) — ✅ approved by the author 2026-08-09** (scenarios persist in T3's scenario file `m1-edit-and-reactivity.md` per plan):

1. `pnpm dev` → no UI regressions anywhere: place wall (W), place bar (B, chained bends), section cut (S), reshape the section volume, watch the 2D section panel update — T2 adds commands and reducers but touches no UI; nothing is wired to the keyboard/menus yet (that is T3/T4).
2. Redux DevTools (optional): place a wall with bars and edit sections as usual — the action log must show NO `project/translateElement`/`project/translateBar` actions anywhere (no silent dispatches; only the T4 Move tool will emit them later) and each `undo/recordSnapshot` still corresponds to exactly one command.
3. Headless spot-check (optional, mirrors the probe): `pnpm test m1-reactivity` — 4 green tests.

### T3 — Edit UI: keyboard + Edit menu + status hints + hover picking + scenario file ✅ (2026-08-09)

**Files added:** `src/commands/delete-selection.ts` (§N command — the single Delete entry point for keyboard AND menu, so UI handlers never branch into business logic, rules 1+2), `src/commands/delete-selection.test.ts` (7 tests), `src/ui/shell/EditMenu.tsx` (Radix DropdownMenu — `@radix-ui/react-dropdown-menu` added; the stack already ships Radix primitives), `docs/test-scenarios/m1-edit-and-reactivity.md` (M1-S01…S08 — persists the approved T1+T2 manual lists as M1-S01…S03 + the T3 checks, rule 7).

**Author-requested review addition (same day) — hover picking + click-through fixes (explicit deviation from plan §3, approved verbally in review):** hover-highlight the entity a click would select, for ALL viewport entities (bar, wall, section wireframe), and fix click-blocking by the section wireframe volumes. Implementation: new transient hover store `src/ui/viewport/hover-target.ts` (§E — mirrors cursor-position.ts, no Redux spam) with the pure `pickPointerWinner(intersections)` — ONE ray-resolution shared by hover AND click, so the highlight always previews the click result. Priority per §B.5 (spec revised 2026-08-09): bar > wall > section volume; a bar beats only its HOST wall (a bar hidden in a wall behind never wins); section fill boxes activate only when they truly win the ray — bars/walls inside a volume are clickable through it. New `--hover` design token (tokens.css, light+dark) + `theme.hover`; **review fix 2 (author, same day):** the first `--hover` value equaled `--guide-line`, so wireframe hover was invisible — the wireframe now has its own `--wireframe` ink token (white on the dark viewport, dark on light) and hover switches it to the hover color; **review fix 3 (author, same day):** the ACTIVE section's wireframe stayed blue and ignored hover because active outranked hover — precedence flipped for the wireframe only (hover wins), since the wireframe is the section's only 3D presence and must always answer the cursor; walls/bars keep selection-outranks-hover. Parked from review discussion (NOT built): an explicit hover-priority table for future entity types + Tab/Shift+scroll cycling through overlapping entities (§B.5 reserves Shift+scroll; `pickPointerWinner` already computes the ranked candidate list, so cycling = index into it later); hover is gated to the Select tool; hover store is cleared via per-entity pointer-out (id-checked, order-safe) and the ground plane's null-resolution. Headless tests: `hover-target.test.ts` (7 picking cases).

**Review fix (author, same day):** bars inside a wall were NOT clickable — R3F delivers clicks front-to-back, so the closer transparent wall face always won and the BarMesh `stopPropagation` "priority" never fired (the pre-existing M0 workaround note in BarMesh admitted it: "reached via the wall first"). `WallMesh.handleSelectClick` now checks `event.intersections` for a bar hosted by THAT wall (bars carry `userData` tags) and yields — no `stopPropagation`, so the event continues down the intersection list to the bar's handler (§B.5 smallest-entity-wins, now actually true). A click on the wall still selects the wall when the bars along the ray belong to a wall behind it.

**Files changed:** `src/ui/toolbar/use-tool-shortcuts.ts` (Delete/Backspace → `deleteSelection`, Ctrl+Z → `undo`, Ctrl+Shift+Z → `redo` Figma convention — Cmd works on macOS; same `isEditableTarget` guard now covers the edit keys too), `src/ui/shell/TopBar.tsx` (Edit menu wired in — the M0 comment reserved it; File/View remain M2+), `src/commands/index.ts` (registry: `deleteSelection` — 13 commands), `src/commands/command-registry.test.ts` (expected list), `src/stores/undo-middleware.ts` (see design note), `src/ui/viewport/WallMesh.tsx` + `src/ui/viewport/BarMesh.tsx` (review fix above), `src/ui/viewport/SectionVolumesLayer.tsx` + `src/ui/viewport/GroundPlane.tsx` (winner-resolved click/hover), `src/ui/viewport/viewport-theme.ts` + `src/ui/styles/tokens.css` (`--hover` token), `src/ui/viewport/hover-target.ts` + `.test.ts` (hover store + picking), `docs/08-architecture-spec.md` (§B.5 hover row + priority revision), `docs/test-scenarios/README.md` (index rows).

**Design notes (author attention):**
- **Delete target resolution:** the selection state holds element/bar ids only (§B.5 — clicking a section volume ACTIVATES it, it is never "selected"), so `deleteSelection` resolves: explicit element/bar selection first (elements cascade their hosted bars), then — when nothing is selected — the ACTIVE section (the one open in the 2D panel), else a "Nothing to delete" status hint. Dangling selection ids after undo (§E: selection is not restored) are skipped, so Delete after an undo hints instead of throwing.
- **One undo level per composite command:** `deleteSelection` dispatches the per-entity delete commands as nested thunks. T1's scope middleware gave every thunk a FRESH scope, which would have split a mixed selection (element + bar — post-M1 multi-select door, §B.5) into several undo levels. The middleware now lets a nested thunk JOIN the outer scope: one undo level per command dispatch (Q4-a), single-kind selections behave exactly as before, and no existing code nests thunks, so T1 semantics are untouched (all T1 tests green unmodified).
- **Delete is inert during a placement draft** (`isInProgress`): the in-progress bar is itself selected while chaining, so an unguarded Delete would delete the bar mid-chain and strand the draft's `barId`. Esc remains the cancel path (§B.6); the Edit menu's Delete disables in the same state. Undo/redo stay live during drafts (Q4-a: Ctrl+Z peels bend points off the chained bar).
- **Edit menu:** Undo / Redo / Delete with right-aligned shortcut labels (Ctrl+Z / Ctrl+Shift+Z / Del) and disabled states driven by `undo.past` / `undo.future` / selection+active-section emptiness. Tokens-only styling (rule 6), same class vocabulary as the existing tooltip/menus (`data-[highlighted]:bg-accent`, `data-[disabled]` muted).

**Verification:** `pnpm lint` ✅ · `pnpm test` ✅ (167 vitest — 14 new: 7 deleteSelection — element cascade one-level exact-restore undo/redo, bars keep host, mixed selection = ONE undo level + exact restore, active-section fallback + panel close, explicit selection wins over active section, empty → hint + no undo level, dangling ids skipped; 7 pickPointerWinner — priority matrix incl. host-wall rule and section click-through) · `pnpm build` ✅ (chunk-size warning is the pre-existing three.js bundle, deferred per M0 T3).

**Manual test list (rule 7) — ✅ approved by the author 2026-08-09, persisted as scenarios M1-S04…S09 (all verified during the review loop):**

1. Delete a selected wall (click it → Delete and Backspace): the wall AND its hosted bars disappear with the selection highlight gone; same for a selected bar — click the bar THROUGH the transparent concrete AND through the section wireframe volume, Delete removes only it (host wall and section stay) — **M1-S04**.
2. Delete with a section open in the 2D panel and nothing selected → the section is deleted (panel closes, wireframe volume disappears, model untouched); Delete with nothing selected and no section open → status bar shows "Nothing to delete"; with both a wall selected AND a section open, Delete removes the wall and keeps the section — **M1-S05**.
3. Ctrl+Z / Ctrl+Shift+Z through an edit sequence: one command per step, chained bars lose bend points one by one, a deleted wall returns with its bars in one step; a new edit kills the redo path — **M1-S06**.
4. Edit menu in the top bar: entries show shortcut labels; Undo/Redo disabled on empty stacks, Delete disabled with nothing deletable; menu items perform the same actions as the keys; check both themes — **M1-S07**.
5. Guards: with a text field focused, ALL shortcuts (Delete, Backspace, Ctrl+Z, tool letters) are ignored; mid-placement (W/B chaining) Delete/Backspace do nothing and Esc still cancels — **M1-S08**.
6. Hover picking (Select tool): moving the cursor highlights the click winner in the hover color — bar through its own wall's concrete, wall over the section wireframe, wireframe over empty volume area, highlight clears over empty ground; the click selects exactly the highlighted entity; selected entities keep the selection color; check both themes — **M1-S09**.

### T4 — Move tool (M): live-offset drag → `commitElementDrag` → `moveElement` ✅ (2026-08-09, committed `8a2233a`)

**Files added:** `src/ui/viewport/element-drag.ts` (React-free, mirrors `section-volume-drag.ts`: `resolveMoveTarget` — the §B.5 pick resolution mapped to the MOVABLE entity, `planDragDelta` — plan-only, y = 0, the transient drag-offset store — §E, same module-store pattern as `hover-target.ts`, and `commitElementDrag` — one `moveElement` per drag + single-shot auto-return), `src/ui/viewport/use-element-drag.ts` (React half: `useElementDragOffset(elementId)` — per-entity snapshot so non-dragged meshes never re-render at pointer rate, and the `useElementMoveDrag` lifecycle hook shared by WallMesh and BarMesh, mirroring T10's `useSectionDrag`: pointer capture, click-vs-drag via `CLICK_DRAG_TOLERANCE_PX` on screen travel, ground-plane ray → grid-snapped point (Shift disables, §B.3), Esc cancel), `src/ui/viewport/element-drag.test.ts` (11 tests).

**Files changed:** `src/stores/ui-slice.ts` (`ToolId` += `'move'`), `src/ui/toolbar/shortcuts.json` (`m`), `src/ui/toolbar/tools.ts` + `icons.tsx` (Move definition between Select and Place Wall; `IconMove` — four-arrow cross, SVG 24×24, token-colored per §B.6 rule 5), `src/ui/viewport/WallMesh.tsx` (move-drag wiring + live-offset position + Move-tool hover), `src/ui/viewport/BarMesh.tsx` (live-offset position via `hostElementId`, host-set hover highlight, pointer-down drag start for the bar-over-the-void ray), `src/ui/viewport/GroundPlane.tsx` (Move-tool hover resolves the movable wall; empty ground clears), `docs/08-architecture-spec.md` (§B.5 hover row revised — Move-tool hover highlights the movable wall / host-follow set).

**Design notes (author attention):**
- **Render approach decided: LIVE-OFFSET** (the plan's open flag, author's call this session): the REAL wall mesh and its hosted bar meshes render at the dragged offset during the gesture and snap back on Esc — exactly like T10's section wireframe volumes, no duplicate ghost render path. The offset lives in a transient module store (not component refs): the drag starts in one mesh's handler but must shift sibling components (the wall AND every hosted bar), which refs cannot reach — the `hover-target.ts`/`cursor-position.ts` external-store pattern is the established §E-compliant way here; per-entity snapshots keep all other meshes from re-rendering at pointer rate.
- **Move-target picking reuses the §B.5 winner** (`pickPointerWinner`) — no second picking path — but the author's rule is **"highlighted = what will move"** (author review correction, same day): only a WALL winner is a drag target (it moves with its hosted bars, host-follow §E); a BAR winner resolves to null — bar-relative moves are M3 scope, so a drag starting on a bar does NOTHING, not even move the wall behind it. Hover mirrors this exactly: a wall winner highlights the wall AND its hosted bars (the moving set); a bar winner highlights the bar alone. Section volumes are not move targets (their Select-tool drag reshapes them). Spec §B.5 got a Move-tool hover row.
- **Door note for M3 (author, same day):** once bar-relative moves exist, the same rule extends to placement groups (§F.2) — hovering a bar with SHIFT held should highlight the whole group (e.g. Mark X = 15 bars Ø10/15, all moving together). Not implemented now (groups don't exist yet; Shift currently means "disable snap", §B.3 — the group gesture needs its own decision at M3).
- **One drag, one starter:** every hit mesh along the ray runs the same resolution and only the resolved wall's own handler starts the drag (`stopPropagation`); the bar's handler covers only the bar-over-the-void ray where no wall is hit.
- **Esc / tool-switch mid-drag:** Esc cancels via a drag-scoped keydown listener (the global Escape → Select runs alongside harmlessly); a letter-shortcut tool switch mid-drag cancels on the guaranteed pointer-up (pointer capture) without committing — no commit ever fires under a different tool. The drag does NOT touch `isInProgress` (that is the placement-draft flag).
- **Click vs drag:** screen-travel threshold (`CLICK_DRAG_TOLERANCE_PX`, as in T10) plus a sub-tolerance-delta guard in the commit (a small drag that grid-snap rounds to zero is a click: no command, no undo level, tool kept). A plain click under Move is a no-op — selection stays the Select tool's job (Q3-b: one way to move, no ambiguity).
- **Single-shot:** after a completed move the tool auto-returns to Select (§B.6 rule 1); double-click-locked sticky stays (rule 2). The Select tool never moves elements.
- **2D section reactivity:** nothing new to build — the commit goes through `moveElement`, and T2's `m1-reactivity.test.ts` already proves the memoized `selectSectionPrimitives` re-derives (outline follows, dot keeps its cover offset).

**Review fix 2 (author, same day) — section content bounded by the cut line (§G.1 revised 2026-08-09):** the author's two-wall probe (2 parallel walls + bars, section across both, move each sideways out of the wireframe box) exposed that `computeSectionPrimitives` cut with an INFINITE plane — a wall moved sideways out of the box kept its outline/dot, and the auto-fit canvas masked the shift (first move "updated", second "did not respond"; only a reshape — which recomputes `targetElementIds` — forced the correct empty state). NOT a recalculation bug: the memoized selector re-derives on every project change (repro proved new references each step). Fix in `engine/sectioning.ts`: the view is now bounded by the drawn cut line segment (u-extent) × viewDepth, matching the 3D wireframe volume — outlines clipped at the line ends, cut-bar dots beyond the line ends dropped, background lines clipped (new `lineExtentOf` + `clipToURange`; boundary counts as inside, 1e-3 mm tolerance). Spec §G.1 revised; T2's reactivity test move changed 1000 → 300 mm (a +1000 mm Z move now correctly leaves the line extent); new regression tests: sectioning.test.ts bounded-line block (partial clip, full drop = the author scenario, background clip + on-the-line-end dot) and a sideways-move probe in m1-reactivity.test.ts.

**Verification:** `pnpm lint` ✅ · `pnpm test` ✅ (181 vitest — 11 T4 new + 3 bounded-line; resolveMoveTarget matrix incl. host-wall rule + section/null cases, planDragDelta y-lock, offset-store publish/clear semantics, commit: wall+bars move + one-level exact-reference undo, auto-return vs sticky, sub-tolerance click no-op, rejection → hint + tool kept) · `pnpm build` ✅ (chunk-size warning is the pre-existing three.js bundle, deferred per M0 T3).

**Manual test list (rule 7) — ✅ approved by the author 2026-08-09, persisted as scenarios M1-S10…S16:**

1. **Basic move:** place a wall with a bar (W, B), cut a section (S) and keep the 2D panel open → press M (or click the Move icon, four-arrow cross, second in the toolbar) → drag the wall: the wall AND its bar follow the cursor live, snapped to the grid; release → both stay at the new position, the 3D section wireframe is untouched, and the open 2D section updates (outline follows the wall; if the wall still crosses the plane, the bar dot keeps its cover offset) → Ctrl+Z restores wall+bar in ONE step, Ctrl+Shift+Z re-applies.
2. **Snap:** with snap ON the drop lands on grid multiples (delta snaps — status-bar coordinates while dragging); hold Shift mid-drag → the wall follows the cursor freely off-grid; toggle snap off via the status bar → same free behavior without Shift.
3. **Esc cancel:** M → start dragging → Esc mid-drag → wall+bar snap back to the original position, nothing is committed (Ctrl+Z does nothing new), the tool returns to Select.
4. **Click vs drag:** M → click a wall without moving the mouse → nothing happens (no move, no selection change, tool stays Move); a tiny wobble below the threshold → same.
5. **Single-shot vs sticky:** M → complete one drag → the tool returns to Select automatically; double-click the Move icon (sticky ring shows) → drag two walls in a row without re-activating → Esc returns to Select.
6. **Picking ("highlighted = what will move"):** M → hovering a WALL (not over a bar) highlights the wall AND its hosted bars together — dragging then moves exactly that set; hovering a BAR through the transparent concrete highlights the bar ALONE, and dragging from it does NOTHING (no bar move, no wall move — a click-drag on the bar leaves the model untouched); empty ground clears the highlight. The Select tool (V) still never moves anything: click-drag a wall under V → no motion.
7. **Tool switch mid-drag:** M → start dragging → press W (or V) mid-drag → release the mouse: nothing commits, the wall snaps back, the newly chosen tool is active.
8. **Guards:** with a text field focused, M is ignored (same `isEditableTarget` guard); undo/redo/Delete keep working exactly as in M1-S04…S08 after any move.
9. **Section bounded by the cut line (§G.1 revised):** the reported scenario — 2 parallel walls with a bar each, one section across both: move the second wall SIDEWAYS out of the section wireframe → its outline and dot DISAPPEAR from the 2D view (not just shift); move the first wall out the same way → the 2D view immediately shows "No geometry in this view" (no reshape needed); undo brings both back step by step. Also: drag a wall only PARTWAY past the line end → the 2D outline is clipped exactly at the line end.

### T5 — Performance probes: full-recompute benchmark + undo-stack memory (§A risks) ✅ (2026-08-09, approved by the author — commit hash in the tracker row)

**Files added:** `src/commands/reference-project.ts` (the §5 reference-scale fixture — 50 walls on a 5×10 grid × 20 bars = 1,000 bars + 5 sections (one per grid column, each cutting its 10 walls), built ENTIRELY through the §N commands `placeWall`/`placeBar`/`createSection` with the Place Bar tool's own placement math; bars are 3-point L-shapes so mesh regen exercises the swept-bend path; reusable by the T6 acceptance pass), `src/commands/performance-probes.ts` (`createBenchmarkStore` — see design note; `measureRetainedBytes` — structural-sharing-aware retained-size estimator; `timingStats`; `formatBytes`), `src/commands/m1-performance.test.ts` (3 tests: scale sanity, full-recompute benchmark, undo-stack memory). **No existing files changed — zero app-behavior impact.**

**Measured numbers (2026-08-09, author machine, production middleware set — medians over 12 timed runs after 3 warm-ups):**

*Full recompute @ 50 walls × 20 bars = 1,000 bars + 5 sections, one `moveElement` (wall + 20 hosted bars, host-follow):*

| Component | Median | Max |
| --- | --- | --- |
| `selectSectionPrimitives` — the ONE open section (10 outlines, 200 dots) | 2.33 ms | 4.52 ms |
| `selectSectionPrimitives` — all 5 sections (conservative bound) | 8.05 ms | 10.41 ms |
| `createBarGeometry` × 20 changed bars (WASM swept meshes) | 1.02 ms | 1.93 ms |
| **§5 probe (open section + meshes) — the plan's assertion** | **3.51 ms** | 5.65 ms |
| §5 probe bound (all 5 sections + meshes) | 9.28 ms | 11.79 ms |
| `moveElement` dispatch (reported, ESCALATED — see F3) | 37.43 ms | 49.62 ms |
| Full frame incl. dispatch (reported, ESCALATED — see F3) | 41.13 ms | 55.28 ms |

**§5 verdict: the full-recompute probe passes — 3.51 ms median (max 5.65 ms) vs the 16 ms budget, and even the all-5-sections bound fits (9.28 ms). §E's "no incremental dependency graph, full recompute" decision is validated for the derived-data graph at 5× the M1 acceptance scale.**

*Undo-stack memory @ reference scale (Q2-a frozen references + Immer structural sharing, measured by `measureRetainedBytes` — an identity-deduped graph walk with documented V8 layout estimates, NOT a profiler; 30 `moveElement` edits, one per wall, cap already full → steady-state):*

| Metric | Measured | §E estimate |
| --- | --- | --- |
| One full project snapshot (JSON.stringify) | 299.9 KiB (naive ×30 = 8.79 MiB) | — |
| Undo slice alone, before → after the 30 edits | 605.6 KiB → 842.0 KiB (depth stays 30) | — |
| Current project + undo slice, total after 30 edits | 856.6 KiB (growth 250.3 KiB) | — |
| **Incremental retained per edit level** | **mean 8.3 KiB, max 14.5 KiB** | **5–10 MiB/level** |

**Memory verdict: Q2-a confirmed decisively — ~600–1,200× under the §E per-level estimate. The ENTIRE app state at reference scale with a full 30-level history is under 1 MiB (vs the §E worst case of 150–300 MiB). Structural sharing works exactly as designed: each level retains only the changed wall/bar objects plus the new record shells (~8 KiB).**

**⚠️ F3 — ESCALATED FINDING (author decision needed, NOT fixed — one-task rule):** the `moveElement` DISPATCH itself costs ~37 ms median (max ~50 ms) at reference scale — over the 16 ms frame budget. Root cause measured: the host-follow cascade is 20 sequential `translateBar` actions, and each Immer produce copies the 1,000-entry `reinforcement` record — ~1.5–3.5 ms per bar action vs 0.14 ms for the 50-entry `elements` record (O(record size) per action × 20). This is production-real (Immer autofreeze is on in production), not a dev artifact. Candidate directions (deliberately NOT implemented in T5 — they touch T2's explicit-per-bar-cascade design decision): (a) batch the cascade into ONE produce (one record copy instead of 20 — e.g. a single `translateElements`/`translateBars` reducer; the action log would show one batched action instead of 20 per-bar actions); (b) accept at M1 scale — the reference project is 5× the acceptance scale and §L/M4 is the performance milestone; (c) decide with the M3/M4 edit-workflow scope when bigger cascades arrive. The test keeps a clearly-labeled 100 ms regression tripwire on the dispatch (catches regressions BEYOND the current architecture's cost; the 16 ms budget itself was NOT weakened — the §5 probe asserts it and passes, and the overage is escalated here rather than absorbed). Related dev-mode note (report-only): `pnpm dev` runs RTK's serializable+immutable invariant middleware (dev-only — `configureStore` omits them in production builds) — at reference scale that is ~170 ms per dispatch and ~44 s for the 1,055-command fixture build, so the benchmarks run on `createBenchmarkStore` (identical reducers + undo chain, production middleware set); the dev app keeps the checks. If F3(a) is ever acted on, the reference build gets proportionally faster too.

**Design notes:**
- **Benchmarks are regression tripwires, not micro-benchmarks:** warm-ups (3) + medians over 12 runs + generous thresholds; assertions use medians so a single GC pause lands in the reported max, not in a flaky failure. Measured numbers above; the tests print them via `console.info` (visible with `--disable-console-intercept` or on failure).
- **The §5 probe measures what the app re-derives per edit:** the memoized `selectSectionPrimitives` for the OPEN section (the app shows one 2D section view) + `createBarGeometry` per bar whose object identity changed (exactly what `BarMesh`'s `useMemo([bar])` rebuilds) — timed AFTER the `moveElement` dispatch, per the plan. The dispatch is timed and reported separately (→ F3).
- **Memory is measured at the `{ project, undo }` root, not the undo slice alone** — snapshots share structure with the LIVE state, so an isolated undo-slice walk would miscount (early probe iterations even produced negative deltas). The undo-slice-alone numbers are still reported for the record.
- **Fixture determinism:** geometry is fully deterministic (fixed grid, fixed bar shapes); only UUIDs vary and nothing performance-relevant depends on them. Sanity assertions guard the probe itself (10 outlines / 200 dots on the open section, 3-point bar paths, non-empty meshes, undo depth = 30, positive incremental retention).

**Verification:** `pnpm lint` ✅ · `pnpm test` ✅ (184 vitest — 3 new: reference-scale build sanity, full-recompute benchmark, undo-stack memory) · `pnpm build` ✅ (chunk-size warning is the pre-existing three.js bundle, deferred per M0 T3).

**Manual test list (rule 7):** this is a HEADLESS task — no UI was added or changed and no existing file was modified (three new files: fixture, probe helpers, benchmark test). Nothing new to test manually in the app; as a regression spot-check only:
1. `pnpm dev` → the app behaves exactly as at T4 (one wall + bar + section + Move-drag + undo sanity pass is sufficient).
2. Headless: `pnpm test m1-performance` → 3 green tests (~8 s); to see the measurement tables, run `pnpm vitest run src/commands/m1-performance.test.ts --disable-console-intercept`.
