# M3 Test Scenarios — Real Bar Placement

> **Back to:** [Test Scenarios](./README.md)
> **Milestone plan:** [../implementation-plans-and-tasks/m3-real-bar-placement.md](../implementation-plans-and-tasks/m3-real-bar-placement.md)

Manual scenarios for M3 (Real Bar Placement). Scenario IDs `M3-T01…` are stable; appended per approved task.

## M3-T01 — App boots, Place Wall/Place Bar unchanged (M3 T1)

**Given** the app at M3 T1 (PlacementGroup data model landed — no UI change by design)
**When** the author launches the app and uses Place Wall (W) and Place Bar (B) exactly as on M1/M2
**Then** both tools behave exactly as before (marks are project-internal, invisible in UI by design)

Status: ✅ manual 2026-08-21

## M3-T02 — Bar remove/redo is one undo step (M3 T1)

**Given** a project with a placed bar
**When** the author presses Esc/Delete (or Ctrl+Z after placement) and then re-applies
**Then** the removal (and re-application after undo) is a single undo step; the bar disappears/reappears cleanly

Status: ✅ manual 2026-08-21

## M3-T03 — IFC round-trip and foreign-IFC solids unchanged (M3 T1)

**Given** a project exportable via File → Export IFC
**When** the author exports IFC, then imports the exported file (and optionally a foreign IFC such as an Advance Steel model)
**Then** the model round-trips identically (marks are not IFC data, so identity is preserved as geometry/intent); a foreign IFC still lands as reference solids

Status: ✅ manual 2026-08-21

## M3-T04 — Regression after engine-math task (M3 T2)

**Given** the app at M3 T2 (`generate_bar_group_layout` + orchestration landed — no UI touch by design)
**When** the author launches the app and uses Place Wall (W) and Place Bar (B)
**Then** both tools behave exactly as before; placed bars keep their cover from all faces; undo/redo clean

Status: ✅ closed without run (author decision 2026-08-22 — the M3 regression re-run was cancelled; T2 changed no UI by design; see M3-T28)

## M3-T05 — Regression after §N group-commands task (M3 T3)

**Given** the app at M3 T3 (`placeBarGroup` / `updatePlacementGroup` / `deletePlacementGroup` landed — headless task, no UI touch by design)
**When** the author launches the app and works the existing tools: Place Wall (W), Place Bar (B) incl. chained bends, Move (M), Delete, undo/redo through the sequence
**Then** all existing workflows behave exactly as before: individuals place fire-and-forget with cover kept from all faces; every edit is one undo step; the group commands are command-layer only (no UI yet — T4/T5)

Status: ✅ closed without run (author decision 2026-08-22 — same rationale as M3-T28; T3 changed no UI by design; the group commands are covered headless)

## M3-T06 — Whole-face group via Enter (M3 T4, action A)

**Given** a wall in the project and the Place Bar Group tool (G) active
**When** the author clicks a wall face (the preview shows the whole-face bar layout) and presses Enter (or Space)
**Then** the group commits: bars fill the captured face minus the panel edge distances; the group's bars are selected; the tool returns to Select; ONE Ctrl+Z removes group + bars

Status: ✅ manual 2026-08-21

## M3-T07 — Region group by drag + Enter (M3 T4, action B)

**Given** the Place Bar Group tool active with a captured face
**When** the author drags a rectangle on the face (the preview tracks the cursor live), releases (the region is defined, nothing placed), optionally edits spacing/Ø/cover/edges/orientation in the Properties panel (the preview regenerates), and presses Enter
**Then** exactly the dragged region is placed with the panel rule; corner points follow grid snap (Shift disables)

Status: ✅ manual 2026-08-21

## M3-T08 — Region group by click-click (M3 T4, action B variant)

**Given** the Place Bar Group tool active with a captured face
**When** the author clicks corner A, clicks corner B, and presses Enter
**Then** the two-corner region is placed; the capture click itself never doubles as a region corner

Status: ✅ manual 2026-08-21

## M3-T09 — Region corners snap to a DXF background (M3 T4, §B.3 revised)

**Given** an imported DXF background and a wall placed over it
**When** the author drags (or click-clicks) a group region near the DXF linework
**Then** corner points snap to the reference endpoints/midpoints within tolerance (object snap beats grid; Shift disables all snapping)

Status: ✅ manual 2026-08-21

## M3-T10 — Rejection keeps face and region (M3 T4)

**Given** a defined region the rule cannot fill (e.g. region narrower than edge start + edge end)
**When** the author presses Enter
**Then** the status bar explains the rejection; the captured face AND the region stay; fixing the params and pressing Enter again succeeds

Status: ✅ manual 2026-08-21

## M3-T11 — Esc / sticky behavior (M3 T4, §B.6 rules 1–2)

**Given** the Place Bar Group tool active
**When** the author presses Esc mid-drag or after capture, or double-clicks the G button (sticky) and places with Enter
**Then** Esc cancels cleanly (no commit, capture cleared); sticky places repeatedly without losing the tool; single-shot returns to Select after one placement

Status: ✅ manual 2026-08-21

## M3-T12 — Regression: existing tools unchanged (M3 T4)

**Given** the app at M3 T4
**When** the author works Place Wall (W), Place Bar (B), Section Cut (S), Move (M), Delete, undo/redo
**Then** all behave exactly as at T3

Status: ✅ manual 2026-08-21

## M3-T13 — Move an individual bar (M3 T5, Move tool bar branch)

**Given** a wall with an individually placed bar and the Move tool (M) active
**When** the author hovers the bar and drags it
**Then** the bar alone highlights and drags with live offset and grid snap (Shift disables snap); the host wall does not move; pointer-up commits; single-shot auto-returns to Select; ONE undo step restores the exact pre-move position

Status: ✅ manual 2026-08-22

## M3-T14 — Dragging a group bar detaches it (M3 T5, Q6)

**Given** a placement group on a wall face and the Move tool active
**When** the author drags one group member (no Shift)
**Then** only that bar moves — it leaves the group (detached per Q6); ONE undo step restores BOTH its membership AND its position exactly

Status: ✅ manual 2026-08-22

## M3-T15 — Regenerate refills the vacated slot (M3 T5, Q6-a)

**Given** a group with one detached (moved-out) member
**When** the author edits the group's rule (e.g. spacing) in the Properties panel
**Then** the group regenerates rule-exactly — the vacated slot is refilled — while the detached bar stays exactly where it was dropped, now an independent bar

Status: ✅ manual 2026-08-22

## M3-T16 — Group selection + rule edit (M3 T5, §B.5 double-click row)

**Given** a placement group on a wall face
**When** the author double-clicks a group bar and edits rule params (Ø, spacing, cover, edge distances, orientation) in the Properties panel
**Then** the whole group selects (all members highlight with the selection token); the panel shows the group's rule with mark and bar count; each edit regenerates the group's bars live as ONE undo step; an invalid value (e.g. spacing 0) surfaces a status hint and the field reverts, the group unchanged

Status: ✅ manual 2026-08-22

## M3-T17 — Shift+hover pre-selection and group move (M3 T5, author direction 2026-08-22)

**Given** a placement group and the Move tool active
**When** the author hovers a group bar, holds Shift, and drags
**Then** hover shows the single bar; Shift highlights the ENTIRE group; a drag started WITH Shift moves the whole group live along the face (grid snap on the delta) — the region re-targets and bars regenerate rule-exactly, host wall untouched, ONE undo level; releasing Shift mid-drag still commits the group move (Shift mid-drag only toggles snap); the same grab WITHOUT Shift detaches and moves the single bar (M3-T14); a cross-chord drag on a vertical side face is rejected with a status hint

Status: ✅ manual 2026-08-22

## M3-T18 — Group delete + regression (M3 T5)

**Given** a selected group (double-click) and the M3 T5 build
**When** the author presses Delete, and also works the existing tools (W, B, S, wall move, individual-bar delete, undo/redo)
**Then** Delete removes the group WITH its bars as ONE undo level (exact restore on undo); deleting a single group bar also removes it from the group's membership; everything else behaves exactly as at T4

Status: ✅ manual 2026-08-22

## M3-T19 — Placement-time clash warning, non-blocking (M3 T6, Q8)

**Given** a wall with individually placed bars (B tool)
**When** the author places a group (G) whose bars cross/overlap them
**Then** the placement SUCCEEDS (nothing blocked, nothing auto-moved); the status bar shows the clash warning (pair count + closest centerline distance); the clashing bars render in the danger (red) color

Status: ✅ manual 2026-08-22

## M3-T20 — Moving a bar into and out of a clash (M3 T6)

**Given** a placement group on a wall face and the Move tool (M) active
**When** the author drags an individual bar into a group bar, then back out
**Then** moving in: the move commits, the warning + red highlight appear; moving back out: the warning clears and the bars return to normal color

Status: ✅ manual 2026-08-22

## M3-T21 — Group move into a clash (M3 T6)

**Given** a placement group and a bar in its potential path
**When** the author Shift+drags the group into a clash with it
**Then** the group move commits (region re-target + rule-exact regenerate), the warning surfaces; ONE undo step restores the pre-move region and bars exactly

Status: ✅ manual 2026-08-22

## M3-T22 — Group rule edit into a clash (M3 T6)

**Given** a selected group (double-click a group bar)
**When** the author edits spacing/cover in the Properties panel so the regenerated bars clash, then edits back
**Then** the edit commits, the warning surfaces with exact pairs; editing back regenerates cleanly and clears the warning

Status: ✅ manual 2026-08-22

## M3-T23 — Collision Check button (M3 T6 review amendment, §K.1 on-demand)

**Given** clashing bars placed through ANY flow (including the B tool, which runs no placement-time check)
**When** the author clicks Collision Check in the top bar, then fixes the clash (move/delete) and clicks again
**Then** first click: status-bar warning + red highlight appear over the exact clashing bars; second click: "Collision check: no clashes (N bars checked)" hint and the red clears; the check is read-only (no undo level, nothing changes)

Status: ✅ manual 2026-08-22

## M3-T24 — Same-plane perpendicular mesh (M3 T6 review amendment)

**Given** a horizontal bar group on a wall face
**When** the author places a vertical group on the same face with the same cover (bars share one plane)
**Then** the placement warns with every crossing (e.g. 18 × 26 = 468 pairs at 0.0 mm); Collision Check re-reports the same pairs at any later time

Status: ✅ manual 2026-08-22

## M3-T25 — Esc dismisses the clash warning (M3 T6 review amendment)

**Given** clash-red bars showing (from a placement or the Collision Check button)
**When** the author presses Escape
**Then** the red highlight and the status-bar warning disappear (the selection also clears, per §B.5); a later Collision Check re-reports the clashes if they still exist

Status: ✅ manual 2026-08-22

## M3-T26 — Clash color precedence + regression (M3 T6)

**Given** clashing bars
**When** the author hovers/selects them, and also works all prior flows with NO clashes present
**Then** selection and hover colors outrank the red warning while interacting; with nothing clashing, every prior placement/edit flow behaves exactly as at T5 (no warnings, no red bars)

Status: ✅ manual 2026-08-22

## M3-T27 — Full test suite green under a busy machine (M3 T7)

**Given** the T7 build (`vitest.config.ts` caps workers at 25%, the timeout-bumped probe files) and the author's normal parallel load (browser/editor/dev servers running)
**When** the author runs `pnpm test`
**Then** all 478 tests pass (the previously flaky timeout/budget-class tests stay green under load), the run finishes FASTER than before (~40 s wall), and the console shows the four T7 probe tables (group regenerate, collision check, section recompute, per-bar-mesh)

Status: ✅ manual 2026-08-22

## M3-T28 — M3 acceptance pass: the full regression walkthrough (M3 T8)

**Given** the app running (`pnpm dev`) — headless counterpart: `src/commands/m3-acceptance.test.ts` (the §A sentences 1–4) + the registry-completeness probe in `src/commands/command-undo-probes.test.ts` (all 25 commands)
**When** the full M3 regression pass is run as one session: **M3-T04/T05** (the regression smoke — app boots, W/B/M/Delete/undo behave exactly as at M2; subsumes the two pending headless-task regressions) → **M3-T06…T12** (the Place Bar Group tool — whole-face and dragged/click-click regions over a traced DXF background, rejection/sticky/Esc behavior) → **M3-T13…T18** (bar moves, group-bar detach + regenerate refill, group selection + rule edit, Shift+hover group move, group delete) → **M3-T19…T26** (placement-time clash warnings non-blocking, the Collision Check button, the same-plane mesh case, Esc dismissal, color precedence)
**Then** every listed scenario behaves as persisted; the milestone is confirmed end-to-end in the browser; headless spot-check (optional): `pnpm test m3-acceptance` → 5 green tests

Status: ✅ closed WITHOUT run (author decision 2026-08-22): the milestone-closing regression re-run was cancelled — heavy UX/UI changes are expected as soon as the POC phase has verified everything can be built and run smoothly in the browser (no tech walls); the per-task manual walkthroughs (M3-T06…T26 ✅) plus the durable headless suites (`m3-acceptance.test.ts` + `command-undo-probes.test.ts` — 483 tests) are the milestone record. M3-T04/T05 (the subsumed regression smokes) closed the same way.
