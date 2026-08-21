# ⚠️ TEMP session prompt — M3 T3 (§N group commands + registry tripwires)

> Point a fresh AI session at this file (or paste its content). **Delete this file once the session starts** — the durable record is the M3 tracker. Created 2026-08-21 after M3 T2 ✅ (engine math: `generate_bar_group_layout` + TS orchestration).

I'm working on a browser-based reinforced concrete drawing app ("web-rebar").
Read C:\work\personal\projects\web-rebar\README.md first — it has session state
(M0 + M1 + M2 ✅ complete, M3 T1 + T2 ✅ done, T3 next) and the Rules for
Implementation Sessions. Then read docs/implementation-plans-and-tasks/
m3-real-bar-placement.md — the approved plan; the Q1–Q8 decisions and the door
check are binding (deviations must be raised explicitly and recorded in the
tracker). T1's log records the data-model decisions (six-face `ElementFaceKey`,
`nextBarMark` counter, mark semantics, normalization helpers); T2's log
records the engine-math decisions (spacing-fallback = single bar, endpoint
inset = cover, validation bounds, all-six face keys, TS-side clamp).

Branch: `A_MVP_Scope_M3` (head = T2 task + tracker hash commits).

Implement **T3 only** — the §N command task (plan section 3). T1's data model
and T2's orchestration (`src/engine/placement-group.ts`) are on disk.

## T3 scope (plan section 3)

1. **`placeBarGroup(params) → { groupId, barIds }`**: validates — host exists,
   face key valid (the T1 `ELEMENT_FACE_KEYS` runtime list), Ø in the DIN/EC2
   catalog, spacing/edges sane — the `CommandError` pattern; calls T2's
   `generateBarGroupPaths` (its `Error` throws map to
   `CommandError('INVALID_PARAMS')`); stamps ONE `barMark` from
   `project.nextBarMark` (+ `setNextBarMark` bump) per Q7; dispatches the T1
   batch `addBars` + group reducer → **ONE undo level** (exactly ONE level
   removes group + bars; redo re-applies — acceptance sentence 1).
2. **`updatePlacementGroup({ groupId, patch })`**: param edit → regenerate via
   T2's orchestration — old group bars removed + new bars added rule-exactly
   in ONE batch dispatch → ONE undo level restores the pre-edit group AND its
   previous bars (exact-reference restore, the M1 pattern — acceptance
   sentence 2). Re-run REGENERATE validates like placement (partial-patch
   handling is command-side per T1's full-replacement reducer).
3. **`deletePlacementGroup({ groupId, removeBars? })`**: default removes group
   + its bars (the deleteElement cascade precedent); `removeBars: false`
   detaches all bars to individuals (in-task recording for the default).
4. **Registry tripwires (the M1 T6 contract):** registry updated AND
   `command-registry.test.ts` AND BOTH acceptance probe maps
   (`m1-acceptance` / `m2-acceptance`) updated in the SAME commit. Undo
   matchers for the three commands.
5. **Headless:** acceptance sentences 1 + 2 green at command level; undo/redo
   exact-reference both ways; one-undo-level proofs.

## Explicitly NOT T3

No tool/UI (T4/T5), no collision check (T6), no performance work (T7). The
engine math is T2 on disk — do not re-open it.

## Rules

- Data model first — T1/T2 landed; build against them (rule 4 done).
- Doors stay open — re-read the plan's door check before any structural
  choice. Groups are placement rules, never visibility scopes.
- Undo per command — the M1 listener middleware collapses composite dispatches
  into ONE level (entry + `setNextBarMark` bump + batch add) — T1 precedent
  from `placeBar` applies.
- Gates green ONCE before review: `pnpm lint` + `pnpm test` + `pnpm build` —
  T3 touches no Rust, so no cargo gate re-run needed (the T2 gate stands).
- Task report ends with the manual test list (rule 7); after author approval
  append to `docs/test-scenarios/m3-real-bar-placement.md`.

## Closing checklist (Rule 9 — on author approval)

1. Gates green ONCE (no re-running).
2. Task commit — the tracker's T3 `Commit:` cell stays `—`.
3. `Tracker: record T3 hash (<hash>)` commit (fills the hash; the
   `m3-t4-session-prompt.md` file lands in this hash commit too).
4. Push. NEVER amend.
