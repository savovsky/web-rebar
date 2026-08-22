# ⚠️ TEMP session prompt — M3 T8 (milestone acceptance pass: `m3-acceptance.test.ts` + checklist audit + docs/scenarios sweep)

> Point a fresh AI session at this file (or paste its content). **Delete this file once the session starts** — the durable record is the M3 tracker. Created 2026-08-22 after M3 T7 ✅ (performance probes at reference scale with groups — **F3 revisit RESOLVED, author-approved**: group regenerate dispatch median 20.40 ms vs the armed 100 ms tripwire — the T1 batch reducers collapse the 20-bar regenerate into 3 reducers, the F3 per-bar-produce class NOT reproduced even with the ~12.5 ms Q8 prospective clash check riding inside; the only remaining F3-class cost is the unchanged M1 `moveElement` per-bar cascade (32.64 ms — M1-accepted, revisit with M4 scope); collision-check tripwires armed @ 1,000 bars (engine 12.52 ms / §K.1 on-demand `checkBarClashes` command 14.69 ms medians vs 100 ms); §5 full-recompute re-run with group bars PASSES (2.64 ms / 6.16 ms bound vs 16 ms); §L.1 evidence recorded report-only — 1,000 per-bar meshes = 1,000 draw calls → ~50,000 at the 50K-bar target (InstancedMesh ≈ 10), ~1.2–2.7 s CPU/full rebuild, feeds M4 planning; pre-existing suite contention fixed with author approval — `vitest maxWorkers '25%'` + four `{timeout: 120_000}` bumps per the M1 T5 precedent; 478 vitest green, shell 1,322.57 kB; scenario M3-T27 + index catch-up M3-T04…T26).

I'm working on a browser-based reinforced concrete drawing app ("web-rebar").
Read C:\work\personal\projects\web-rebar\README.md first — it has session state
(M0 + M1 + M2 ✅ complete, M3 T1–T7 ✅ done, T8 next — the final M3 task) and
the Rules for Implementation Sessions. Then read docs/implementation-plans-and-tasks/
m3-real-bar-placement.md — the approved plan; the Q1–Q8 decisions and the door
check are binding (deviations must be raised explicitly and recorded in the
tracker). T7's log records the F3 revisit conclusion (author-approved) and the
probe table that feeds M4 planning.

Branch: `A_MVP_Scope_M3` (head = T7 task + tracker hash commits).

Implement **T8 only** — the milestone acceptance pass (plan section 8, mirrors
M0 T11 / M1 T6 / M2 T8). T1–T7 are on disk: data model, engine, commands,
tools, clash engine, probes.

## T8 scope (plan section 8)

1. **`src/commands/m3-acceptance.test.ts`** — the five §A acceptance sentences
   durable headless: sentences 1–4 restated as the milestone test (group
   placement rule-exact + ONE undo level; group edit/regenerate exact-restore;
   host-follow + detach; collision probe exact + non-blocking — the T3/T5/T6
   tests are the sources; sentence 5 is the manual UX probe, not headless).
2. **Rule-by-rule audit** against the root README Review Checklist (verdict
   table in the task log) — incl. the undo-per-command row for the new M3
   commands (the `command-undo-probes.test.ts` registry tripwire already
   covers them — cite it).
3. **Docs sweep (all dated):**
   - §F.2 finalized model revision + §B.5 bar-move row + §B.6 G row + §H.1 /
     `project.ts` notes (already landed in T1–T5 — verify, fill gaps only);
   - the `BarMesh.tsx` InstancedMesh comment — the scope line says T8's sweep
     updates it (the dated "arrives at M3" comment is superseded: M3
     *measured*; post-M3 optimizes — T7's §L.1 evidence is the record);
   - doc 09 parry3d verdict (landed in T6 — verify);
   - root README session state; plans index;
   - scenario file `docs/test-scenarios/m3-real-bar-placement.md` (rule 7 —
     the M3-S01… acceptance sentence(s) if the audit surfaces a gap; M3-T27
     already covers T7).
4. **Milestone acceptance verdict table** in the task log (the M0/M1/M2
   pattern); findings either fixed in-task (small) or escalated to the author.

## Open items recorded for T8 (from T6/T7 logs — author's decision needed)

- `moveElement` / `placeBar` are NOT clash-reporting (T6 scope lists; adding
  `placeBar` is a one-line engine call + result-type change — raise again in
  the audit).
- cargo audit/deny deferred (windows-gnu install failure on the T6 host) —
  the RustSec/licence run belongs to a CI/MSVC host; record the deferral.
- User-editable clash criteria in a settings panel — recorded future
  requirement (author: "not now"); make sure it's captured (README deferred
  topics or §K).
- The `{timeout: 120_000}` pattern now spans 4 files — candidate for one line
  in the README testing conventions (raised during T7 review; author
  accepted the bumps as-is).

## Explicitly NOT T8

No new features/commands, no optimization (§L stays watch-only), no M4
planning beyond feeding it the T7 table. M3 closes with this task.

## Rules

- Doors stay open — re-read the plan's door check before any structural choice.
- **Rust gate** (`cd core && cargo fmt -- --check && cargo clippy --all-targets
  -- -D warnings && cargo test`) green ONCE before review **only if `core/` is
  touched** (T8 shouldn't be — docs/test sweep).
- `pnpm lint` + `pnpm test` + `pnpm build` green ONCE before review.
- Task report ends with the manual test list (rule 7).

## Closing checklist (Rule 9 — on author approval)

1. Gates green ONCE (no re-running).
2. Task commit — the tracker's T8 `Commit:` cell stays `—`.
3. `Tracker: record T8 hash (<hash>)` commit (fills the hash; the
   milestone-complete README state update lands here too).
4. Push. NEVER amend.
