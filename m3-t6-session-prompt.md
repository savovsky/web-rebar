# ⚠️ TEMP session prompt — M3 T6 (collision check: parry3d gate + clash engine + Q8 surfacing)

> Point a fresh AI session at this file (or paste its content). **Delete this file once the session starts** — the durable record is the M3 tracker. Created 2026-08-22 after M3 T5 ✅ (group selection/edit UX: double-click → group select, Properties-panel rule edit; Shift+hover pre-selection; `moveBar` detach-on-move per Q6; **group move per author direction mid-review** — Shift+grab drags the whole group via `movePlacementGroup` region re-target; §B.5 dated revisions; scenarios M3-T13…T18).

I'm working on a browser-based reinforced concrete drawing app ("web-rebar").
Read C:\work\personal\projects\web-rebar\README.md first — it has session state
(M0 + M1 + M2 ✅ complete, M3 T1–T5 ✅ done, T6 next) and the Rules for
Implementation Sessions. Then read docs/implementation-plans-and-tasks/
m3-real-bar-placement.md — the approved plan; the Q1–Q8 decisions and the door
check are binding (deviations must be raised explicitly and recorded in the
tracker). T1's log records the data-model decisions; T2's the engine math;
T3's the command layer; T4's the G-tool gesture model; T5's the selection/move
UX (incl. the author-direction group move and the recorded "polish debt
accepted" review note).

Branch: `A_MVP_Scope_M3` (head = T5 task + tracker hash commits).

Implement **T6 only** — collision check: parry3d decision gate + clash engine
+ Q8 surfacing (plan section 6, Q2/Q8). T1–T5 are on disk: data model, engine
(`src/engine/placement-group.ts`), the §N commands (`placeBarGroup` /
`updatePlacementGroup` / `deletePlacementGroup` / `moveBar` /
`movePlacementGroup`), the G tool, and the selection/move UX.

## T6 scope (plan section 6)

1. **Spike-first decision gate (Q2, the M2 Q1 pattern):** add parry3d to
   `core/`; probe capsule/segment distance over polyline bars against an
   analytic segment-segment reference — 1e-6 mm corpus (straight + bent bars,
   parallel/crossing/skew). **Gate criteria (all three recorded in the task
   log):** (i) distances match the analytic reference within 1e-6 mm;
   (ii) WASM footprint delta reported (core.wasm was 38.2 kB raw after T2 —
   record the delta); (iii) 1,000-bar all-pairs-with-prefilter check runs
   within the T7 budget (T6 measures the shape; T7 arms the tripwire).
   **Pass → parry3d adopted; Fail → the documented pure-math fallback**
   (Rust segment-segment distance over polyline pairs with an AABB
   pre-filter) — same task boundary, escalate per the plan rule. Either way
   **doc 09 gets a dated verdict**.
2. **Clash engine (§D.2 — Rust/WASM):**
   `check_bar_collisions(bars: flat paths + radii) → clash pairs (ids, min
   distance)`. Bar PAIRS model-wide (NOT per-host — the M4 openings/junction
   door: bar-vs-opening slots in later without redesign). AABB pre-filter
   before exact distance (the 1,000-bar budget is T7's probe). TS
   orchestration module follows the `placement-group.ts` pattern.
3. **Command surfacing per Q8 (non-blocking, §K.4):** `placeBarGroup`,
   `moveBar`, `movePlacementGroup`, and regenerate (`updatePlacementGroup`)
   run the check over the affected bars and RETURN exact clash reports (pair
   ids + min distances in the command result) → status-bar warning + the
   minimal §K.4 highlight affordance. Nothing is blocked, nothing is
   auto-moved (auto-skip/auto-fit is §K "Fit to Code" territory — door stays
   closed). This is an engine probe + §K.4-style warnings, NOT the validator
   and NOT a §K auto-run (plan door check — raise explicitly if the
   implementation drifts toward validation semantics).
4. **Headless:** acceptance sentence 4 — a group placed over pre-existing
   individual bars (and/or a second overlapping group) flags EXACTLY the
   clashing bar pairs (centerline distance < r₁ + r₂) with exact pair ids +
   distances, plus a clean control (no false positives). Placement stays
   non-blocking. Pin the no-openings scope line (bar-vs-bar only — nothing
   else exists to collide against until M4).
5. **Registry/probe maps:** T6 adds no new commands (clash reporting rides
   the existing commands' results) — if a command IS added, the registry
   tripwire + `command-undo-probes.test.ts` update in the same commit.
6. **Manual:** author places a group over existing individual bars → clash
   warnings surface (status bar + highlight), placement still succeeds;
   moving a bar into a clash warns; undo restores. Task report ends with the
   manual test list (rule 7); after author approval append to
   `docs/test-scenarios/m3-real-bar-placement.md` (M3-T19…).

## Explicitly NOT T6

No performance probes (T7 — T6 only reports the 1,000-bar shape for gate
criterion iii), no acceptance pass (T8), no §K validation integration
(on-demand stays), no bar-vs-openings (M4 — nothing to collide against), no
auto-resolve/auto-skip (§K.4 "Fit to Code" door closed), no host-cascade for
groups (T3/T5-recorded open door — T8 candidate). Engine math (T2) and the
group commands (T3/T5) are on disk — extend them for clash REPORTS only, do
not re-open their placement/regenerate semantics.

## Rules

- Doors stay open — re-read the plan's door check before any structural
  choice. The collision check is a placement-time engine probe with §K.4-style
  non-blocking warnings — never the validator, never blocking.
- **Rust gate REQUIRED this task** (T6 touches `core/`): `cd core &&
  cargo fmt -- --check && cargo clippy --all-targets -- -D warnings &&
  cargo test` green ONCE before review (auto-applied via
  `core/.cargo/config.toml`), plus `pnpm lint` + `pnpm test` + `pnpm build`
  green ONCE.
- Clash reports in command results must be exact (pair ids + min distances)
  and deterministic (stable pair ordering).
- Task report ends with the manual test list (rule 7).

## Closing checklist (Rule 9 — on author approval)

1. Gates green ONCE (no re-running) — including the Rust cargo gate.
2. Task commit — the tracker's T6 `Commit:` cell stays `—`.
3. `Tracker: record T6 hash (<hash>)` commit (fills the hash; the
   `m3-t7-session-prompt.md` file lands in this hash commit too).
4. Push. NEVER amend.
