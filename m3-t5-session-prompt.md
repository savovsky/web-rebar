# ⚠️ TEMP session prompt — M3 T5 (group selection/edit UX + moveBar + detach)

> Point a fresh AI session at this file (or paste its content). **Delete this file once the session starts** — the durable record is the M3 tracker. Created 2026-08-21 after M3 T4 ✅ (Place Bar Group tool G: capture → whole-face/region → **Enter/Space commits** per the mid-review author decision; §B.6 G-row note dated).

I'm working on a browser-based reinforced concrete drawing app ("web-rebar").
Read C:\work\personal\projects\web-rebar\README.md first — it has session state
(M0 + M1 + M2 ✅ complete, M3 T1–T4 ✅ done, T5 next) and the Rules for
Implementation Sessions. Then read docs/implementation-plans-and-tasks/
m3-real-bar-placement.md — the approved plan; the Q1–Q8 decisions and the door
check are binding (deviations must be raised explicitly and recorded in the
tracker). T1's log records the data-model decisions; T2's the engine math;
T3's the command layer; T4's the G-tool gesture model (Enter/Space commit,
two actions A whole-face / B region — drag or click-click) and the T4-recorded
author direction for THIS task (below).

Branch: `A_MVP_Scope_M3` (head = T4 task + tracker hash commits).

Implement **T5 only** — group selection/edit UX + bar moves & detach (plan
section 5, Q6; §B.5 revisions). T1–T4 are on disk: data model, engine
(`src/engine/placement-group.ts`), commands (`placeBarGroup` /
`updatePlacementGroup` / `deletePlacementGroup`, the `detachBars` reducer),
the G tool.

## T5 scope (plan section 5)

1. **Group selection (§B.5 row's first real target):** double-click a group
   bar → select the parent group (derived state: bar → `placementGroupId`;
   no new entity TYPE in the picking order — the parked §B.5 hover-table work
   stays parked). Properties panel shows the group's rule → edits dispatch
   `updatePlacementGroup` (regenerate live; T3 command unchanged).
2. **Author direction recorded in the T4 log (2026-08-21 — NEW affordance,
   lands here, NOT silently):** **Shift+hover** over a group member highlights
   the ENTIRE group (pre-selection so the whole group can be moved/deleted
   together); when the whole group is selected, the Properties panel re-opens
   the rule params for editing (→ `updatePlacementGroup`). This is a §B.5
   selection-model addition → dated §B.5 revision note (tokens only, rule 6).
   Decide in-task and record: how whole-group move/delete dispatch (existing
   commands: `deletePlacementGroup` for delete; group MOVE has no command —
   the §E answer is move the host, so a group-move gesture may be out of
   scope; raise it explicitly if the author direction implies more).
3. **`moveBar({ barId, delta })` command** (the `moveElement` shape):
   individual bar → `translateBar`; group member → DETACH first (Q6 — leaves
   `group.bars`, clears `placementGroupId`, keeps mark/position) via T3's
   `detachBars` reducer, then translate — ONE undo level restores membership
   + position exactly. Move tool (M) gains the bar branch: the §B.5 hover row
   activates ("highlighted = what will move" — a bar winner now DRAGS);
   live-offset drag, grid snap on the delta, Esc cancel, click-vs-drag
   threshold — all inherited from `use-element-drag`.
4. **§B.5 dated revision:** the "a drag from it does NOTHING" row resolves.
5. **Headless:** acceptance sentence 3 (host-follow + detach; regenerate
   refills the vacated slot per Q6-a); undo exact-restore of membership;
   registry + probe map (`command-undo-probes.test.ts` — the single
   exhaustive `Record<CommandName>` tripwire) updated for `moveBar` in the
   same commit.
6. **Manual:** author moves individual + group bars, edits the group's
   spacing after detaching one bar (the Q6 refill behavior), undoes through
   the sequence; Shift+hover group highlight; group param edit from the
   Properties panel. Task report ends with the manual test list (rule 7);
   after author approval append to `docs/test-scenarios/m3-real-bar-placement.md`.

## Explicitly NOT T5

No collision work (T6), no performance work (T7), no acceptance pass (T8),
no group re-capture/re-face UX, no bar reshape/re-bend editing (post-M3).
Engine math (T2) and the three group commands (T3) are on disk — do not
re-open them. The T3-recorded open door: host deletion vs groups
(`deleteElement` leaves orphan group records; `updatePlacementGroup` guards
with NOT_FOUND) — a host-cascade for groups is an OPEN author decision that
may land here or at T8.

## Rules

- Doors stay open — re-read the plan's door check before any structural
  choice. Groups are placement rules, never visibility scopes.
- Undo per command — `moveBar` and the group edits dispatch through the
  registry; ONE undo level each (the T3 `detachBars` primitive exists for
  exactly this). Transient drag state never enters Redux (§E).
- Gates green ONCE before review: `pnpm lint` + `pnpm test` + `pnpm build` —
  T5 touches no Rust (the T2 cargo gate stands).
- Task report ends with the manual test list (rule 7).

## Closing checklist (Rule 9 — on author approval)

1. Gates green ONCE (no re-running).
2. Task commit — the tracker's T5 `Commit:` cell stays `—`.
3. `Tracker: record T5 hash (<hash>)` commit (fills the hash; the
   `m3-t6-session-prompt.md` file lands in this hash commit too).
4. Push. NEVER amend.
