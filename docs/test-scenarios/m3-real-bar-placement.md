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

Status: ⬜ pending author confirmation

## M3-T05 — Regression after §N group-commands task (M3 T3)

**Given** the app at M3 T3 (`placeBarGroup` / `updatePlacementGroup` / `deletePlacementGroup` landed — headless task, no UI touch by design)
**When** the author launches the app and works the existing tools: Place Wall (W), Place Bar (B) incl. chained bends, Move (M), Delete, undo/redo through the sequence
**Then** all existing workflows behave exactly as before: individuals place fire-and-forget with cover kept from all faces; every edit is one undo step; the group commands are command-layer only (no UI yet — T4/T5)

Status: ⬜ pending author confirmation

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
