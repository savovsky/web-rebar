# M1 — Edit + Reactivity: Plan & Task Tracker

> **Back to:** [Implementation Plans & Tasks](./README.md) · [Root README](../../README.md) · [Architecture Spec](../08-architecture-spec.md)
> **Plan approved:** 2026-08-09 — author accepted the recommendations for Q1/Q2/Q4; Q3 decided as **dedicated Move tool (M)**; §E revised to **host-follow** (move/copy element → hosted bars follow, same command transaction).

---

## ▶️ Current State (read this first in a fresh session)

- **M1: ✅ PLAN APPROVED (2026-08-09)** — Q1–Q4 answered (see below); §E revised to host-follow. M0 is ✅ complete ([tracker](./m0-one-wall-one-bar.md)); branch `A_MVP_Scope_M1`. **T1 ✅ complete** (undo core, 2026-08-09); **T2 ✅ complete** (edit commands + reactivity proofs, 2026-08-09 — see task log); **T3 is next**.
- **Workflow (same as M0):** implement one task → `pnpm lint` + `pnpm test` + `pnpm build` green → present changes + manual test list → **author reviews and commits (all working-tree changes, rule 8)** → next task.
- **Manual test scenarios:** `docs/test-scenarios/m1-edit-and-reactivity.md` (created in T3; M1-S01… — root README rule 7).
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
| T3 | Edit UI: Delete / Ctrl+Z / Ctrl+Shift+Z keybindings + Edit menu (TopBar) + status hints; scenario file started | manual: keyboard + menu drive undo/redo/delete; guards in editable fields | ⬜ Pending | — |
| T4 | Move tool (M) (Q3-b): toolbar + shortcut, transient drag, ghost preview, grid snap, Esc cancel, single-shot auto-return, `commitElementDrag` → `moveElement` | manual: M + drag wall → wall+bars move in 3D, open 2D section updates on drop; undo reverts all; Select never moves | ⬜ Pending | — |
| T5 | Performance probes: full-recompute benchmark + undo-stack memory measurement (§A risks) | numbers reported in task log; assertions green | ⬜ Pending | — |
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
