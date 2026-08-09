# ⏳ SESSION HANDOFF — M0 done, T11 awaiting commit → next: M1 planning

> **TEMPORARY FILE — delete it after the next session has consumed it** (it duplicates
> the permanent records in the [M0 tracker](./docs/implementation-plans-and-tasks/m0-one-wall-one-bar.md)
> and [README session state](./README.md); keeping it would create a second source of truth).
>
> Written: 2026-08-09 (T11 session). Branch: `A_MVP_Scope_M0`.

---

## 1. Where things stand RIGHT NOW (read this first)

**M0 (One Wall, One Bar) is functionally complete.** All 11 tasks are implemented;
T11 (the acceptance pass) is **implemented and verified but NOT yet committed** —
the working tree holds uncommitted changes waiting for your review and commit
(rule 8: the approval commit sweeps ALL working-tree changes).

**Uncommitted working-tree changes (T11):**

- `src/commands/m0-acceptance.test.ts` (new) — the M0 acceptance sentence as a headless test
- `README.md` — session state → M0 ✅ complete; deferred-topics table moved to its section; structure table updated; next-session prompt now targets M1 planning
- `docs/10-design-system.md` — stale placeholder note removed
- `docs/implementation-plans-and-tasks/README.md` — M0 row → ✅ Complete
- `docs/implementation-plans-and-tasks/m0-one-wall-one-bar.md` — T11 task log + tracker updates
- `docs/test-scenarios/m0-one-wall-one-bar.md` — M0-S13 headless counterpart noted

**Your pending action before anything else:** review the changes (the report in §2
below is the review basis), run the manual regression pass (§4), then commit.
After committing, **add the commit hash to the T11 row** in the M0 tracker
(Current State list + tracker table — marked "author adds hash on commit" / "—"),
same as you did with the `Tracker: record T<n> hash` commits.

If you reject anything in the T11 changes, the permanent docs (README session
state, tracker) already describe the post-approval state — adjust them together
with the code fix so docs and reality never diverge.

---

## 2. T11 task report (acceptance pass — the review basis)

Not a feature task: a rule-by-rule audit of T1–T10 against the root README
"Rules for Implementation Sessions" + Review Checklist, plus the M0 acceptance
sentence captured as a durable headless test.

**Verification run:** `pnpm lint` ✅ · `pnpm test` 128/128 ✅ (127 + 1 new) ·
`pnpm build` ✅ · `cargo test` 19/19 ✅ · `pnpm-workspace.yaml` supply-chain
policies untouched (browserslist pin + `allowBuilds` exactly as fixed in T7) ✅.

### Checklist verdict (rule → status → evidence)

| Rule | Status | Evidence |
| --- | --- | --- |
| 1 — Command layer (§N) | ✅ | Zero `project-slice` imports in `src/ui/` (grep); the only UI dispatches are the 8 registry commands + ui-slice actions (`setTool`/`toggleSnap`/selection/draft lifecycle) — the §B.6-sanctioned UI-state exception, applied consistently |
| 2 — Dumb components | ✅ | No `Math.*` beyond `Math.PI`/rounding in `src/ui/`; all geometry/projection math lives in `src/engine/` (wall-geometry, placement, snapping, sectioning, section-cut, section-view-transform). Spot-checked: Viewport3D, WallMesh, GroundPlane, SectionVolumesLayer, SectionView, section-canvas-renderer |
| 3 — Stateless WASM (§D) | ✅ | No `static`/`OnceCell`/`RefCell`/`Mutex`/`thread_local` in `core/src/`; flat slices in (`&[f64]`), flat arrays out (`Vec<f64>` / `MeshData` Float32+Uint32 getters per Q1-b) |
| 4 — Data model first | ✅ | T2 models + catalog seed landed two tasks before the first UI (T6) |
| 5 — Doors stay open | ✅ | Command registry = MCP/scripting door (§N.2); plain-JSON project state = cloud door (§H.4); JSON-shaped catalog = multi-country door (§K.5); pen table seed in `src/data/` (§M.4). No Deferred Topics entry blocked |
| 6 — Design tokens only | ✅ | Zero hex/arbitrary-value literals in `src/ui/` outside `tokens.css` (doc 10 rule-5 greps). The two `*_PX` constants are behavior parameters, not styles (R3F `event.delta` px threshold; canvas fit margin); `px-panel`/`py-1.5`-style hits are Tailwind scale utilities. Domain styling (concrete/rebar colors, pen table) in `src/data/appearance.ts` |
| 7 — Manual test list per task | ✅ | Every task report T6–T10 ended with one; persisted as M0-S01…S18, all ✅ manual |
| 8 — Parallel edits / commit sweep | ✅ | Working tree was clean at session start; exact-match edits only |
| Checklist — undo/redo per command | N/A (M1) | Undo itself is M1; verified the M0 half of §E: reducers operate on plain JSON, no derived data stored (meshes/section primitives are memoized-selector derivations, §H.2) — every reducer is snapshot-safe |

### Durable artifact

`src/commands/m0-acceptance.test.ts` — the §A acceptance sentence end-to-end
through the §N commands and the real WASM boundary: `placeWall` → tool-identical
face-click resolution (`resolveBarCenterline`, the same call the Place Bar draft
makes) → `placeBar` at 25 mm cover → `createSection` (line + depth-click form) →
`setActiveSection` → `selectSectionPrimitives`: one 200×2800 outline + one Ø12
dot at **u = 31 mm** from the covered side, v = bar height, empty background for
the perpendicular mid-wall cut.

### Findings (report-only, deliberately NOT implemented)

- **F1** — `deleteElement`/`deleteBar` have no UI entry point in M0 (no delete
  tool/keybinding). By design (M0 scope table: edit tools arrive in M1); the
  commands exist and are unit-tested, so M1 edit work starts from a ready base.
- **F2** — `SectionVolumesLayer` imports `DEFAULT_WALL_DIMENSIONS` from the
  command module as the fallback wireframe height. Not a rule violation
  (read-only constant; command-owned default seeds are the established T8
  pattern). If a second consumer ever appears, move the seed to `src/data/`.

### Small doc fixes made in place (uncontroversial, documented in the task log)

- Root README: the Deferred Topics table sat under the Review Checklist heading
  while the ⚠️ planning rule references "the table **above**" — moved into its
  own section. Structure table updated (commands/ui/data populated since T5–T8;
  `src/io/` stubs remain). Session state → M0 ✅ complete, next: M1 planning.
- Doc 10 File Layout: dropped the stale "currently src/index.css placeholder"
  note (`src/ui/styles/globals.css` is live since T6).
- Plans index: M0 row → ✅ complete. Scenario M0-S13: headless counterpart noted.

---

## 3. What is coming next: M1 — Edit + Reactivity

Per Architecture Spec §A:

| Milestone | Deliverable | Risk It Probes |
| --- | --- | --- |
| **M1: Edit + Reactivity** | Move wall → section updates. Undo/redo. | Dependency graph correctness; full recompute performance; undo stack memory |

What M1 will likely involve (the next session's planning session turns this into
an approved plan — nothing here is decided yet):

- **Undo/redo per §E** — RTK + Immer snapshots, 30 levels, meshes excluded
  (regenerated on restore). T11 confirmed all M0 reducers are already
  snapshot-safe (plain JSON, no derived data stored).
- **Edit commands** — e.g. `moveWall` (reinforcement does NOT auto-follow
  element moves, §E), UI entry points for the existing `deleteElement`/`deleteBar`
  (F1), keyboard bindings (Delete key), possibly drag-to-move in the viewport.
- **Reactivity proof** — move a wall that a section cuts → the 2D view updates
  (the memoized `selectSectionPrimitives` selector already re-derives; M1 proves
  this end-to-end and measures full-recompute performance).
- **Deferred Topics to review while planning (root README rule 5):** Layer Model
  (before M4, but keep the door open), Dimension & Annotation System (the
  differentiator — "prototype early, 2D-only, after the first 2D view exists" —
  the first 2D view now exists), MCP server / NL input (§N.2 doors — already open
  via the registry; planning must not close them).

**Planning workflow (same as M0):** the plan is written as
`docs/implementation-plans-and-tasks/m1-*.md` and approved by you BEFORE any code;
task states live in that file; every task ends with `pnpm lint`/`test`/`build`
green + a manual test list (rule 7); you commit each task (rule 8).

---

## 4. Manual regression pass before committing T11 (rule 7)

Fast re-run of the persisted scenarios — all previously verified:
[M0-S01…S18](./docs/test-scenarios/m0-one-wall-one-bar.md), ending with the
milestone acceptance sentence (§A):

> **Place wall → place bar at 25 mm cover → cut section → 2D view shows the
> wall outline + bar dot at the correct offset (31 mm centerline from the
> covered face).**

(`pnpm dev` → W: click-click a wall · B: click a face, click two points · S:
drag a line across the wall, third click sets the depth — the docked 2D panel
shows the outline + dot; the 3D wireframe volume is movable/stretchable.)

---

## 5. How to start the next (fresh) session

If T11 is committed by then (expected):

```text
I'm working on a browser-based reinforced concrete drawing app ("web-rebar").
Read C:\work\personal\projects\web-rebar\README.md first — it has session state (M0 is ✅ complete).
Then read docs/08-architecture-spec.md (all locked decisions) and
docs/implementation-plans-and-tasks/m0-one-wall-one-bar.md (M0 tracker — patterns to reuse).
There is a temp handoff file SESSION-HANDOFF-M0-DONE.md in the repo root — read it,
then DELETE it as your first action (its content is now duplicated in the permanent docs).
Task: draft the M1 implementation plan (Architecture Spec §A — Edit + Reactivity:
move wall → section updates, undo/redo per §E) as
docs/implementation-plans-and-tasks/m1-*.md for my approval.
Review the Deferred Topics table (README) and §N before planning — no plan item may
silently close a door. Do not commit — I review and commit myself.
```

If T11 is somehow still uncommitted when you start the session, say instead:
*"T11's working-tree changes are still uncommitted — walk me through reviewing
them (report: SESSION-HANDOFF-M0-DONE.md §2), then I commit, then we plan M1."*
