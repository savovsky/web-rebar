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
