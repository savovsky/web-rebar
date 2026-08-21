# ⚠️ TEMP session prompt — M3 T4 (Place Bar Group tool G — the placement-UX probe)

> Point a fresh AI session at this file (or paste its content). **Delete this file once the session starts** — the durable record is the M3 tracker. Created 2026-08-21 after M3 T3 ✅ (§N group commands: `placeBarGroup` / `updatePlacementGroup` / `deletePlacementGroup` + registry tripwires; probe suite now lives in `src/commands/command-undo-probes.test.ts`).

I'm working on a browser-based reinforced concrete drawing app ("web-rebar").
Read C:\work\personal\projects\web-rebar\README.md first — it has session state
(M0 + M1 + M2 ✅ complete, M3 T1 + T2 + T3 ✅ done, T4 next) and the Rules for
Implementation Sessions. Then read docs/implementation-plans-and-tasks/
m3-real-bar-placement.md — the approved plan; the Q1–Q8 decisions and the door
check are binding (deviations must be raised explicitly and recorded in the
tracker). T1's log records the data-model decisions; T2's log the engine-math
decisions; T3's log the command-layer decisions (incl. the `detachBars`
reducer = the Q6 detach primitive, regenerate keeps the group's `barMark`,
host-deletion guard + open door, and the probe-suite move to
`command-undo-probes.test.ts` — the single exhaustive `Record<CommandName>`
tripwire).

Branch: `A_MVP_Scope_M3` (head = T3 task + tracker hash commits).

Implement **T4 only** — the Place Bar Group tool (G), plan section 4. T1's data
model, T2's orchestration (`src/engine/placement-group.ts`), and T3's commands
(`src/commands/place-bar-group.ts` etc.) are on disk.

## T4 scope (plan section 4)

1. **§B.6 activation:** `ToolId` + `G` shortcut in shortcuts.json + toolbar
   icon (token-driven, 24×24 SVG per the palette rules). No palette decision —
   the G slot is reserved and locked; M3 just activates it.
2. **Face capture** reuses the Place Bar mechanism (first click sets face +
   cover side); **region = two-corner drag** (or click-click) on the captured
   face through the existing draft pipeline (face projection, grid snap,
   §B.3-revised reference endpoint/midpoint snaps — tracing a region off the
   architect's DXF works out of the box). **Default shortcut: whole-face** —
   committing without dragging fills the captured face minus edge distances
   (the exact gesture is decided in-task and recorded, per plan Q4-a).
3. **Live translucent preview** of the generated bars during the drag — the
   BarDraftPreview / element-drag transient-store pattern (60 FPS updates stay
   out of Redux, §E). Preview math calls T2's `generateBarGroupPaths` (or the
   WASM layout directly) — dumb components: no domain math in components
   (rule 2); all math in `src/engine/`.
4. **Properties panel params** (cover, Ø, spacing, edge distances,
   orientation) with catalog defaults (§B.4), editable before commit; commit
   on pointer-up → `placeBarGroup` (T3). Esc cancels; single-shot auto-return,
   double-click sticky (§B.6 rules).
5. **§B.6 dated revision note** (G row: behavior locked → implemented) — spec
   + tokens only (rule 6: no literal colors/px outside `tokens.css`; domain
   styling from project settings).
6. **Manual (the UX risk probe):** the author places a group over a real wall
   traced from a DXF background — one-click whole-face AND dragged-region
   variants; previews track the drag; params edit pre-commit. Task report ends
   with the manual test list (rule 7); after author approval append to
   `docs/test-scenarios/m3-real-bar-placement.md`.

## Explicitly NOT T4

No group selection/edit UX, no double-click-bar-selects-group, no `moveBar`,
no detach UX (all T5), no collision surfacing (T6), no performance work (T7).
The engine math (T2) and commands (T3) are on disk — do not re-open them.
Headless vitest coverage for the tool's draft-state math where it lands in
`src/engine/`; the UX itself is the manual probe.

## Rules

- Data model first — T1/T2/T3 landed; build against them (rule 4 done).
- Doors stay open — re-read the plan's door check before any structural
  choice. Groups are placement rules, never visibility scopes; region stays
  face-local (Q3) so a polygon can extend the rectangle later (M4 door).
- Undo per command — the tool dispatches `placeBarGroup` only (T3 already
  proves ONE undo level); transient draft state never enters Redux.
- Gates green ONCE before review: `pnpm lint` + `pnpm test` + `pnpm build` —
  T4 touches no Rust unless the preview math proves it necessary (record it
  if so; the T2 cargo gate stands otherwise).
- Task report ends with the manual test list (rule 7); after author approval
  append to `docs/test-scenarios/m3-real-bar-placement.md`.

## Closing checklist (Rule 9 — on author approval)

1. Gates green ONCE (no re-running).
2. Task commit — the tracker's T4 `Commit:` cell stays `—`.
3. `Tracker: record T4 hash (<hash>)` commit (fills the hash; the
   `m3-t5-session-prompt.md` file lands in this hash commit too).
4. Push. NEVER amend.
