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
