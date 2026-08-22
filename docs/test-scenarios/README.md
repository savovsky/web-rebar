# Test Scenarios

> **Back to:** [README.md](../../README.md) · [Implementation Plans & Tasks](../implementation-plans-and-tasks/README.md)
> **Created:** 2026-08-09 · **Status:** Live — appended after every approved task

This folder collects **behavioral test scenarios**, captured session by session while the behavior is fresh. During the POC phase they are executed **manually** (each task report ends with a manual test list; after the author's approval the list is persisted here). After the POC, they become the specification for **Playwright** E2E tests — chosen over Cypress for its canvas/WebGL support; scenario IDs map 1:1 to future spec titles.

## Conventions

- **One file per milestone** for now (`m0-one-wall-one-bar.md`, `m1-edit-and-reactivity.md`, `m2-adapters-round-trip.md`, …) — mirrors [implementation-plans-and-tasks/](../implementation-plans-and-tasks/README.md) and keeps tasks aligned with their manual checks. Later the same records can be **regrouped by flows/features** — the scenario is the atomic unit, the file is just its current grouping.
- **Stable IDs:** `M0-S01`, `M0-S02`, … — assigned once, never reused or renumbered, so regrouping and automation keep traceability (task ↔ scenario ↔ future spec).
- **Given/When/Then**, phrased as **user-observable behavior**, never implementation details ("exactly 1 bar with 4 path points", not "appendBarPoint dispatched") — behavior-focused scenarios survive refactors.
- **Status per scenario:** `✅ manual YYYY-MM-DD` (author verified) · `⬜ manual pending` · `🤖 automated` (post-POC, with spec path).
- **No rot rule:** when a task changes existing behavior, the affected scenarios are updated **in the same commit** as the task.
- WebGL/Canvas2D reality (for the automation phase): scenarios mix visual checks with state assertions — Playwright can drive the §N command layer headlessly and inspect the RTK store, so many "visual" scenarios become deterministic store assertions plus a small set of screenshot comparisons.

## Scenario index

| ID | Scenario | Covers | Status |
| --- | --- | --- | --- |
| [M0-S01](./m0-one-wall-one-bar.md#m0-s01--app-boots-with-wasm-loaded) | App boots with WASM loaded | T1 | ✅ manual 2026-08-08 |
| [M0-S02](./m0-one-wall-one-bar.md#m0-s02--app-shell-layout-per-b2) | App shell layout per §B.2 | T6 | ✅ manual 2026-08-08 |
| [M0-S03](./m0-one-wall-one-bar.md#m0-s03--tool-activation-via-click-and-shortcut) | Tool activation via click and shortcut | T6 | ✅ manual 2026-08-08 |
| [M0-S04](./m0-one-wall-one-bar.md#m0-s04--sticky-mode-and-esc-return-to-select) | Sticky mode and Esc return to Select | T6 | ✅ manual 2026-08-08 |
| [M0-S05](./m0-one-wall-one-bar.md#m0-s05--viewport-mouse-mapping-and-grid) | Viewport mouse mapping and grid | T7 | ✅ manual 2026-08-08 |
| [M0-S06](./m0-one-wall-one-bar.md#m0-s06--live-coordinates-and-grid-snapping) | Live coordinates and grid snapping | T7 | ✅ manual 2026-08-08 |
| [M0-S07](./m0-one-wall-one-bar.md#m0-s07--chained-wall-placement) | Chained wall placement | T7 | ✅ manual 2026-08-08 |
| [M0-S08](./m0-one-wall-one-bar.md#m0-s08--wall-selection-under-the-select-tool) | Wall selection under the Select tool | T7 | ✅ manual 2026-08-08 |
| [M0-S09](./m0-one-wall-one-bar.md#m0-s09--chained-bar-placement-creates-one-bar) | Chained bar placement creates ONE bar | T8 | ✅ manual 2026-08-09 |
| [M0-S10](./m0-one-wall-one-bar.md#m0-s10--cover-kept-from-all-wall-faces) | Cover kept from ALL wall faces | T8 | ✅ manual 2026-08-09 |
| [M0-S11](./m0-one-wall-one-bar.md#m0-s11--rounded-bends-with-code-mandrel-radius) | Rounded bends with code mandrel radius | T8 | ✅ manual 2026-08-09 |
| [M0-S12](./m0-one-wall-one-bar.md#m0-s12--bar-preview-visibility-and-draft-guards) | Bar preview, visibility and draft guards | T8 | ✅ manual 2026-08-09 |
| [M0-S13](./m0-one-wall-one-bar.md#m0-s13--perpendicular-section-shows-bar-dot-at-correct-offset) | Perpendicular section shows bar dot at correct offset | T9+T10 | ✅ manual 2026-08-09 |
| [M0-S14](./m0-one-wall-one-bar.md#m0-s14--section-dots-keep-true-relative-diameters) | Section dots keep true relative diameters | T9+T10 | ✅ manual 2026-08-09 |
| [M0-S15](./m0-one-wall-one-bar.md#m0-s15--oblique-cut-background-and-view-depth) | Oblique cut, background and view depth | T9+T10 | ✅ manual 2026-08-09 |
| [M0-S16](./m0-one-wall-one-bar.md#m0-s16--section-view-panel-sizing-resize-and-close) | Section view panel sizing, resize and close | T10 | ✅ manual 2026-08-09 |
| [M0-S17](./m0-one-wall-one-bar.md#m0-s17--section-wireframe-volume-in-the-3d-viewport) | Section wireframe volume in the 3D viewport | T10 | ✅ manual 2026-08-09 |
| [M0-S18](./m0-one-wall-one-bar.md#m0-s18--section-cut-guards-and-sticky-mode) | Section Cut guards and sticky mode | T10 | ✅ manual 2026-08-09 |
| [M1-S01](./m1-edit-and-reactivity.md#m1-s01--m0-workflows-unchanged-with-the-undo-core-live) | M0 workflows unchanged with the undo core live | M1 T1+T2 | ✅ manual 2026-08-09 |
| [M1-S02](./m1-edit-and-reactivity.md#m1-s02--one-undo-level-per-command-cascades-included) | One undo level per command, cascades included | M1 T1 | ✅ manual 2026-08-09 |
| [M1-S03](./m1-edit-and-reactivity.md#m1-s03--no-silent-translate-dispatches-before-the-move-tool) | No silent translate dispatches before the Move tool | M1 T2 | ✅ manual 2026-08-09 |
| [M1-S04](./m1-edit-and-reactivity.md#m1-s04--delete-key-deletes-the-current-selection) | Delete key deletes the current selection | M1 T3 | ✅ manual 2026-08-09 |
| [M1-S05](./m1-edit-and-reactivity.md#m1-s05--delete-falls-back-to-the-active-section-hint-when-nothing-to-delete) | Delete falls back to the active section; hint when nothing to delete | M1 T3 | ✅ manual 2026-08-09 |
| [M1-S06](./m1-edit-and-reactivity.md#m1-s06--ctrlz-undoes-ctrlshiftz-redoes) | Ctrl+Z undoes, Ctrl+Shift+Z redoes | M1 T3 | ✅ manual 2026-08-09 |
| [M1-S07](./m1-edit-and-reactivity.md#m1-s07--edit-menu-entries-shortcut-labels-and-disabled-states) | Edit menu entries, shortcut labels and disabled states | M1 T3 | ✅ manual 2026-08-09 |
| [M1-S08](./m1-edit-and-reactivity.md#m1-s08--edit-shortcuts-guard-editable-fields-and-in-progress-drafts) | Edit shortcuts guard editable fields and in-progress drafts | M1 T3 | ✅ manual 2026-08-09 |
| [M1-S09](./m1-edit-and-reactivity.md#m1-s09--hover-highlight-previews-the-click-winner) | Hover highlight previews the click winner | M1 T3 | ✅ manual 2026-08-09 |
| [M1-S10](./m1-edit-and-reactivity.md#m1-s10--move-tool-drags-the-wall-with-its-bars-section-updates-on-drop-one-undo-level) | Move tool drags the wall with its bars; section updates on drop; one undo level | M1 T4 | ✅ manual 2026-08-09 |
| [M1-S11](./m1-edit-and-reactivity.md#m1-s11--grid-snapping-applies-to-the-drag-delta-shift-disables-it) | Grid snapping applies to the drag delta; Shift disables it | M1 T4 | ✅ manual 2026-08-09 |
| [M1-S12](./m1-edit-and-reactivity.md#m1-s12--esc--tool-switch-cancels-mid-drag-click-is-not-a-drag) | Esc / tool switch cancels mid-drag; click is not a drag | M1 T4 | ✅ manual 2026-08-09 |
| [M1-S13](./m1-edit-and-reactivity.md#m1-s13--move-is-single-shot-double-click-locks-it-sticky) | Move is single-shot; double-click locks it sticky | M1 T4 | ✅ manual 2026-08-09 |
| [M1-S14](./m1-edit-and-reactivity.md#m1-s14--move-picking-highlighted--what-will-move) | Move picking: highlighted = what will move | M1 T4 | ✅ manual 2026-08-09 |
| [M1-S15](./m1-edit-and-reactivity.md#m1-s15--move-shortcut-guards) | Move shortcut guards | M1 T4 | ✅ manual 2026-08-09 |
| [M1-S16](./m1-edit-and-reactivity.md#m1-s16--section-content-is-bounded-by-the-cut-line) | Section content is bounded by the cut line | M1 T4 | ✅ manual 2026-08-09 |
| [M1-S17](./m1-edit-and-reactivity.md#m1-s17--milestone-acceptance-move-wall--wallbars-update--section-updates--one-step-undoredo) | Milestone acceptance: move wall → wall+bars update → section updates → one-step undo/redo | M1 T6 | ✅ manual 2026-08-09 |
| [M2-S01](./m2-adapters-round-trip.md#m2-s01--spike-ifc-file-opens-in-an-external-viewer-web-ifc-write-gate) | Spike IFC file opens in an external viewer (web-ifc write gate) | M2 T1 | ✅ manual 2026-08-18 |
| [M2-S02](./m2-adapters-round-trip.md#m2-s02--exported-project-opens-in-allplan-with-correct-positions-and-elevations) | Exported project opens in Allplan with correct positions and elevations | M2 T2+T2.5 | ✅ manual 2026-08-18 |
| [M2-S03](./m2-adapters-round-trip.md#m2-s03--z-up-model-space-viewport-and-tools-behave-unchanged-after-the-migration) | Z-up model space: viewport and tools unchanged after the migration | M2 T2.5 | ✅ manual 2026-08-18 |
| [M2-S04](./m2-adapters-round-trip.md#m2-s04--ifc-round-trip-export--import-yields-an-identical-model) | IFC round-trip: export → import yields an identical model | M2 T3 | ✅ automated headless 2026-08-18 |
| [M2-S05](./m2-adapters-round-trip.md#m2-s05--browser-ifc-round-trip-via-the-file-menu) | Browser IFC round-trip via the File menu | M2 T4 | ✅ manual 2026-08-18 |
| [M2-S06](./m2-adapters-round-trip.md#m2-s06--foreign-ifc-file-imports-as-render-only-reference-solids-q7--the-t65-acceptance-probe) | Foreign IFC file imports as render-only reference solids (Q7) | M2 T6.5 | ⬜ pending manual |
| [M2-S07](./m2-adapters-round-trip.md#m2-s07--dxf-import-core-real-files-become-reference-documents-at-true-units-headless) | DXF import core: real files become reference documents at true units | M2 T5 | ✅ automated headless 2026-08-18 |
| [M2-S08](./m2-adapters-round-trip.md#m2-s08--dxf-import-via-the-file-menu-background-renders-at-true-scale-and-traces-the-doc-11-workflow-probe) | DXF import via the File menu: background renders at true scale and traces | M2 T6 | ✅ manual 2026-08-18 |
| [M2-S09](./m2-adapters-round-trip.md#m2-s09--tracing-snaps-place-wall--place-bar-resolve-to-background-endpoints-and-midpoints) | Tracing snaps: Place Wall / Place Bar resolve to background endpoints and midpoints | M2 T6 | ✅ manual 2026-08-18 |
| [M2-S10](./m2-adapters-round-trip.md#m2-s10--backgrounds-panel-per-document-visibility-and-remove-are-undoable) | Backgrounds panel: per-document visibility and remove are undoable | M2 T6 | ✅ manual 2026-08-18 |
| [M2-S11](./m2-adapters-round-trip.md#m2-s11--dxf-import-edge-cases-units-override-in-flight-guard-large-file-stress) | DXF import edge cases: units override, in-flight guard, large-file stress | M2 T6 | ✅ manual 2026-08-18 |
| [M2-S12](./m2-adapters-round-trip.md#m2-s12--dxf-section-export-the-file-measures-true-in-real-cad-the-t7-acceptance-probe) | DXF section export: the file measures true in real CAD | M2 T7 | ✅ manual 2026-08-18 |
| [M2-S13](./m2-adapters-round-trip.md#m2-s13--m2-acceptance-pass-the-full-regression-walkthrough-t8) | M2 acceptance pass: the full regression walkthrough | M2 T8 | ⬜ pending manual |
| [M3-T01](./m3-real-bar-placement.md#m3-t01--app-boots-place-wallplace-bar-unchanged-m3-t1) | App boots, Place Wall/Bar unchanged | M3 T1 | ✅ manual 2026-08-21 |
| [M3-T02](./m3-real-bar-placement.md#m3-t02--bar-removeredo-is-one-undo-step-m3-t1) | Bar remove/redo one undo step | M3 T1 | ✅ manual 2026-08-21 |
| [M3-T03](./m3-real-bar-placement.md#m3-t03--ifc-round-trip-and-foreign-ifc-solids-unchanged-m3-t1) | IFC round-trip + foreign-IFC solids | M3 T1 | ✅ manual 2026-08-21 |
| [M3-T04](./m3-real-bar-placement.md#m3-t04--regression-after-engine-math-task-m3-t2) | Regression after engine-math task | M3 T2 | ✅ closed w/o run 2026-08-22 (author — re-run cancelled) |
| [M3-T05](./m3-real-bar-placement.md#m3-t05--regression-after-n-group-commands-task-m3-t3) | Regression after §N group-commands task | M3 T3 | ✅ closed w/o run 2026-08-22 (author — re-run cancelled) |
| [M3-T06](./m3-real-bar-placement.md#m3-t06--whole-face-group-via-enter-m3-t4-action-a) | Whole-face group via Enter | M3 T4 | ✅ manual 2026-08-21 |
| [M3-T07](./m3-real-bar-placement.md#m3-t07--region-group-by-drag--enter-m3-t4-action-b) | Region group by drag + Enter | M3 T4 | ✅ manual 2026-08-21 |
| [M3-T08](./m3-real-bar-placement.md#m3-t08--region-group-by-click-click-m3-t4-action-b-variant) | Region group by click-click | M3 T4 | ✅ manual 2026-08-21 |
| [M3-T09](./m3-real-bar-placement.md#m3-t09--region-corners-snap-to-a-dxf-background-m3-t4-b3-revised) | Region corners snap to a DXF background | M3 T4 | ✅ manual 2026-08-21 |
| [M3-T10](./m3-real-bar-placement.md#m3-t10--rejection-keeps-face-and-region-m3-t4) | Rejection keeps face and region | M3 T4 | ✅ manual 2026-08-21 |
| [M3-T11](./m3-real-bar-placement.md#m3-t11--esc--sticky-behavior-m3-t4-b6-rules-12) | Esc / sticky behavior | M3 T4 | ✅ manual 2026-08-21 |
| [M3-T12](./m3-real-bar-placement.md#m3-t12--regression-existing-tools-unchanged-m3-t4) | Regression: existing tools unchanged | M3 T4 | ✅ manual 2026-08-21 |
| [M3-T13](./m3-real-bar-placement.md#m3-t13--move-an-individual-bar-m3-t5-move-tool-bar-branch) | Move an individual bar | M3 T5 | ✅ manual 2026-08-22 |
| [M3-T14](./m3-real-bar-placement.md#m3-t14--dragging-a-group-bar-detaches-it-m3-t5-q6) | Dragging a group bar detaches it | M3 T5 | ✅ manual 2026-08-22 |
| [M3-T15](./m3-real-bar-placement.md#m3-t15--regenerate-refills-the-vacated-slot-m3-t5-q6-a) | Regenerate refills the vacated slot | M3 T5 | ✅ manual 2026-08-22 |
| [M3-T16](./m3-real-bar-placement.md#m3-t16--group-selection--rule-edit-m3-t5-b5-double-click-row) | Group selection + rule edit | M3 T5 | ✅ manual 2026-08-22 |
| [M3-T17](./m3-real-bar-placement.md#m3-t17--shifthover-pre-selection-and-group-move-m3-t5-author-direction-2026-08-22) | Shift+hover pre-selection and group move | M3 T5 | ✅ manual 2026-08-22 |
| [M3-T18](./m3-real-bar-placement.md#m3-t18--group-delete--regression-m3-t5) | Group delete + regression | M3 T5 | ✅ manual 2026-08-22 |
| [M3-T19](./m3-real-bar-placement.md#m3-t19--placement-time-clash-warning-non-blocking-m3-t6-q8) | Placement-time clash warning, non-blocking | M3 T6 | ✅ manual 2026-08-22 |
| [M3-T20](./m3-real-bar-placement.md#m3-t20--moving-a-bar-into-and-out-of-a-clash-m3-t6) | Moving a bar into and out of a clash | M3 T6 | ✅ manual 2026-08-22 |
| [M3-T21](./m3-real-bar-placement.md#m3-t21--group-move-into-a-clash-m3-t6) | Group move into a clash | M3 T6 | ✅ manual 2026-08-22 |
| [M3-T22](./m3-real-bar-placement.md#m3-t22--group-rule-edit-into-a-clash-m3-t6) | Group rule edit into a clash | M3 T6 | ✅ manual 2026-08-22 |
| [M3-T23](./m3-real-bar-placement.md#m3-t23--collision-check-button-m3-t6-review-amendment-k1-on-demand) | Collision Check button (§K.1 on-demand) | M3 T6 | ✅ manual 2026-08-22 |
| [M3-T24](./m3-real-bar-placement.md#m3-t24--same-plane-perpendicular-mesh-m3-t6-review-amendment) | Same-plane perpendicular mesh | M3 T6 | ✅ manual 2026-08-22 |
| [M3-T25](./m3-real-bar-placement.md#m3-t25--esc-dismisses-the-clash-warning-m3-t6-review-amendment) | Esc dismisses the clash warning | M3 T6 | ✅ manual 2026-08-22 |
| [M3-T26](./m3-real-bar-placement.md#m3-t26--clash-color-precedence--regression-m3-t6) | Clash color precedence + regression | M3 T6 | ✅ manual 2026-08-22 |
| [M3-T27](./m3-real-bar-placement.md#m3-t27--full-test-suite-green-under-a-busy-machine-m3-t7) | Full test suite green under a busy machine | M3 T7 | ✅ manual 2026-08-22 |
| [M3-T28](./m3-real-bar-placement.md#m3-t28--m3-acceptance-pass-the-full-regression-walkthrough-m3-t8) | M3 acceptance pass: full regression walkthrough | M3 T8 | ✅ closed w/o run 2026-08-22 (author — the re-run was cancelled; UX/UI churn expected right after the POC's no-tech-walls verification) |
