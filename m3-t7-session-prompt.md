# ⚠️ TEMP session prompt — M3 T7 (performance probes at reference scale with groups — the scheduled F3 revisit + §L.1 evidence)

> Point a fresh AI session at this file (or paste its content). **Delete this file once the session starts** — the durable record is the M3 tracker. Created 2026-08-22 after M3 T6 ✅ (collision check: **parry3d-f64 0.30.2 ADOPTED** — Q2 gate PASSED on all three criteria: 1e-6 mm corpus agreement vs the analytic reference, core.wasm 38.2 → 46.3 kB raw, 1,000-bar all-pairs-with-prefilter ~4.4 ms native / ~24 ms through the WASM/TS boundary; `check_bar_collisions` engine (model-wide bar pairs, bar+segment AABB pre-filters) + Q8 non-blocking surfacing: exact clash reports ride the `placeBarGroup` / `moveBar` / `movePlacementGroup` / `updatePlacementGroup` results → `ui.clashWarning` + status-bar hint + `--danger` bar highlight; acceptance sentence 4 headless; scenarios M3-T19…; **review amendment (author direction): the §K.1 on-demand `checkBarClashes` command + Collision Check top-bar button** (read-only, zero undo levels, scopeBarIds seam = the future active-layer door; user-editable criteria = recorded future requirement); recorded open items for the author: moveElement/placeBar are NOT clash-reporting (T6 scope lists), cargo audit/deny deferred (windows-gnu install failure)).

I'm working on a browser-based reinforced concrete drawing app ("web-rebar").
Read C:\work\personal\projects\web-rebar\README.md first — it has session state
(M0 + M1 + M2 ✅ complete, M3 T1–T6 ✅ done, T7 next) and the Rules for
Implementation Sessions. Then read docs/implementation-plans-and-tasks/
m3-real-bar-placement.md — the approved plan; the Q1–Q8 decisions and the door
check are binding (deviations must be raised explicitly and recorded in the
tracker). T6's log records the parry3d gate verdict, the clash-engine
semantics, and the Q8 surfacing decisions (prospective-model pre-dispatch
checks, color precedence, warning-layer lifetime).

Branch: `A_MVP_Scope_M3` (head = T6 task + tracker hash commits).

Implement **T7 only** — performance probes (plan section 7, the M1 T5 pattern,
with groups — the scheduled F3 revisit). T1–T6 are on disk: data model,
engine, commands, tools, clash engine.

## T7 scope (plan section 7)

1. **Extend `reference-project.ts`** (M1 T5's 50-wall × 20-bar command-built
   fixture, 1,000 bars + 5 column sections) with **group-built variants**
   (e.g. 50 walls × 1 group × 20 bars = the same 1,000 bars, group-owned).
2. **Probes** (medians over N runs after warm-ups, regression tripwires
   asserted, the `m1-performance.test.ts` shape):
   (i) **group regenerate dispatch** at reference scale — the F3 cost class
   revisited with the T1 batch reducers; the 100 ms tripwire stays armed;
   (ii) **collision check** all-pairs-with-prefilter at 1,000 bars — the T6
   gate shape (~4.4 ms native / ~24 ms boundary, recorded in the T6 log) gets
   its armed tripwire here (probe BOTH the engine call AND the §K.1 on-demand
   `checkBarClashes` command dispatch — M3 T6 review amendment);
   (iii) **section recompute** with group bars (the §5 full-recompute probe
   re-run at reference+groups);
   (iv) **per-bar-mesh render cost** — the §L.1 InstancedMesh door's evidence
   task: measure and REPORT (NO optimization — the scope line: M3 measures, a
   budget breach escalates to the author, the F3 loop).
3. **Results table in the task log**; findings feed the M4 planning session.
   F3 revisit conclusion recorded explicitly (accept / candidate fix / defer
   to M4 scope) — the author decides if a breach appears.

## Explicitly NOT T7

No optimization itself (§L stays watch-only — InstancedMesh/LOD/workers are
post-M3), no new commands, no acceptance pass (T8), no docs sweep (T8). T6's
clash check rides inside the commands — measure it as part of the command
dispatch cost AND standalone; do not change its semantics.

## Rules

- Doors stay open — re-read the plan's door check before any structural choice.
- **Rust gate NOT expected** (T7 should not touch `core/`); if it does:
  `cd core && cargo fmt -- --check && cargo clippy --all-targets -- -D warnings
  && cargo test` green ONCE before review.
- `pnpm lint` + `pnpm test` + `pnpm build` green ONCE before review.
- Probe assertions are regression tripwires at measured-safe margins (the M1
  T5 pattern: median over 12 runs after 3 warm-ups), never tightened budgets.
- Task report ends with the manual test list (rule 7).

## Closing checklist (Rule 9 — on author approval)

1. Gates green ONCE (no re-running).
2. Task commit — the tracker's T7 `Commit:` cell stays `—`.
3. `Tracker: record T7 hash (<hash>)` commit (fills the hash; the
   `m3-t8-session-prompt.md` file lands in this hash commit too).
4. Push. NEVER amend.
