# ⚠️ TEMP session prompt — M3 T2 (engine math: `generate_bar_group_layout` + TS orchestration)

> Point a fresh AI session at this file (or paste its content). **Delete this file once the session starts** — the durable record is the M3 tracker. Created 2026-08-21 after M3 T1 ✅ (data model + project-slice reducers).

I'm working on a browser-based reinforced concrete drawing app ("web-rebar").
Read C:\work\personal\projects\web-rebar\README.md first — it has session state
(M0 + M1 + M2 ✅ complete, M3 T1 ✅ done, T2 next) and the Rules for
Implementation Sessions. Then read docs/implementation-plans-and-tasks/
m3-real-bar-placement.md — the approved plan; the Q1–Q8 decisions and the door
check are binding (deviations must be raised explicitly and recorded in the
tracker). T1's Task Log entry records the in-task decisions you inherit:
the six-face `ElementFaceKey` enum, the `nextBarMark` counter home,
mark-assignment semantics, and the round-trip normalization helpers.

Branch: `A_MVP_Scope_M3` (head = T1 task + tracker hash commits).

Implement **T2 only** — the engine-math task (plan section 2). The T1 data
model is on disk; T3's commands and T4's tool come later.

## T2 scope (plan section 2)

1. **Rust/WASM** per §D.2 ("face sampling, spacing math" → Rust):
   `generate_bar_group_layout(face frame + region + {cover, Ø, spacing,
   edges, orientation}) → flat f64 path array + count` — pure analytic
   arithmetic: positions = edge + k·spacing, endpoints inset by cover
   semantics, inward offset = cover + radius (exactly the
   `resolveBarCenterline`/`applyConcreteCover` semantics M0 proved in TS).
   Cargo tests for the analytic corpus: horizontal/vertical walls, both
   orientations, edge-exact fits; **spacing larger than region → single-bar /
   zero-bar behavior decided in-task and recorded in the task log** (plan
   openly defers this).
2. **TS orchestration** `src/engine/placement-group.ts` (the sectioning.ts
   pattern): host + `faceKey` → FaceFrame (reuses `getWallFaceFrame` via the
   T1 `ElementFaceKey`) → region rect → WASM call → typed bar paths.
   Insane params (cover > thickness, negative/zero spacing, edges past the
   region) throw here → T3 maps them to `CommandError` in the command
   doorway (plan door check: input validation, not §K code-compliance).
3. **vitest rule-exactness** on known walls: positions/count/cover from ALL
   faces; rotated-wall frames (the Z-rotation math M0 proved); face-local
   stability under host translation (Q3's acceptance core).

## Explicitly NOT T2

No §N commands (T3), no UI, no registry/probe-map changes. The WASM runs via
`initWasmFromDisk` in tests (the existing wasm-test-init pattern).

## Rules

- Data model first — T1 landed it; build against T1's types (rule 4 done).
- Doors stay open — re-read the plan's door check before any structural
  choice. Q1's parametric face-local sampling is locked: the mesh is derived
  data, never sampled.
- Gates green ONCE before review: `pnpm lint` + `pnpm test` + `pnpm build`
  + **the T2 Rust gate** — `cd core && cargo fmt -- --check && cargo clippy --all-targets -- -D warnings && cargo test` —
  (T2 touches the Rust crate; the `core/.cargo/config.toml` lints table is documented
  in docs/09-tech-libraries.md — do not lower pedantic or allow unsafe; the
  M3 T1 session landed 2 lint fixes + `#![forbid(unsafe_code)]` to make this gate real).
- Task report ends with the manual test list (rule 7); after author approval
  append to `docs/test-scenarios/m3-real-bar-placement.md`.

## Closing checklist (Rule 9 — on author approval)

1. Gates green ONCE (no re-running).
2. Task commit — the tracker's T2 `Commit:` cell stays `—`.
3. `Tracker: record T2 hash (<hash>)` commit (fills the hash; the
   `m3-t3-session-prompt.md` file lands in this hash commit too).
4. Push. NEVER amend.
