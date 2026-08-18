# M1 Test Scenarios — Edit + Reactivity

> **Back to:** [Test Scenarios](./README.md) · [M1 tracker](../implementation-plans-and-tasks/m1-edit-and-reactivity.md)
> Created 2026-08-09 (T3) — persists the approved T1+T2 manual test lists (M1-S01…S03) and the T3 edit-UI + hover-picking checks (M1-S04…S09). Extended 2026-08-09 (T4) with the Move tool + bounded-section checks (M1-S10…S16).

---

### M1-S01 — M0 workflows unchanged with the undo core live

**Covers:** T1 + T2 · **Status:** ✅ manual 2026-08-09

- **Given:** the app is running (`pnpm dev`)
- **When:** walking the full M0 flow — place walls (W, chained), place bars (B, chained bends), cut a section (S, drag + depth click), reshape the section via its 3D wireframe volume, watch the 2D section panel update
- **Then:** everything behaves exactly as at M0 — no UI regressions anywhere (T1/T2 add the undo core and edit commands but wire no UI)

### M1-S02 — One undo level per command, cascades included

**Covers:** T1 · **Status:** ✅ manual 2026-08-09

- **Given:** Redux DevTools open on the action log
- **When:** placing a wall, then deleting a wall that hosts bars
- **Then:** each command produces exactly ONE `undo/recordSnapshot` action — the delete cascade (wall + its bars) is a single snapshot, so one undo restores the whole gesture; `project/restoreProjectSnapshot` itself never triggers a recording

### M1-S03 — No silent translate dispatches before the Move tool

**Covers:** T2 · **Status:** ✅ manual 2026-08-09 · **Headless counterpart:** `src/commands/m1-reactivity.test.ts` (4 probes — the memoized section selector re-derives after every edit class)

- **Given:** Redux DevTools open on the action log
- **When:** placing walls and bars and editing sections as usual
- **Then:** the log shows NO `project/translateElement`/`project/translateBar` actions anywhere (no silent dispatches — only the T4 Move tool will emit them), and each `undo/recordSnapshot` still corresponds to exactly one command

### M1-S04 — Delete key deletes the current selection

**Covers:** T3 · **Status:** ✅ manual 2026-08-09 · **Headless counterpart:** `src/commands/delete-selection.test.ts`

- **Given:** a wall with hosted bars, a section cut through the wall (wireframe volume visible), and the Select tool active
- **When:** (a) clicking the wall, then pressing Delete (or Backspace); (b) clicking a bar THROUGH the transparent concrete — including through the section wireframe volume — then pressing Delete
- **Then:** (a) the wall AND all its hosted bars disappear in one step (they highlight in the selection color beforehand); (b) the bar highlights on hover, the click selects the bar (not the wall, not the section), and Delete removes only it — the host wall and the section stay; the selection highlight is gone afterwards

### M1-S09 — Hover highlight previews the click winner

**Covers:** T3 (author-requested review addition) · **Status:** ✅ manual 2026-08-09 · **Headless counterpart:** `src/ui/viewport/hover-target.test.ts`

- **Given:** the Select tool active over a scene with a wall, hosted bars, and a section wireframe volume
- **When:** moving the cursor (without clicking) over a bar through the concrete, over bare wall, over empty volume area, and out to empty ground; then repeating in the other theme
- **Then:** the entity under the cursor highlights in the hover color — bar beats its own host wall, wall beats the wireframe, the wireframe (white ink on the dark viewport, dark ink on the light one) highlights only over empty volume area, and the highlight clears over empty ground; clicking always selects exactly the highlighted entity; on walls/bars the selection highlight outranks hover, while the section wireframe answers hover even when it is the ACTIVE one (blue); no hover highlight appears while a placement tool is active

### M1-S05 — Delete falls back to the active section; hint when nothing to delete

**Covers:** T3 · **Status:** ✅ manual 2026-08-09 · **Headless counterpart:** `src/commands/delete-selection.test.ts`

- **Given:** (a) a section open in the 2D panel with nothing selected in the 3D viewport; (b) nothing selected and no section open
- **When:** pressing Delete in each situation
- **Then:** (a) the active section is deleted — its 2D panel closes and its 3D wireframe volume disappears, while walls and bars stay untouched; (b) nothing changes and the status bar shows "Nothing to delete"; an explicit element/bar selection always wins over an open section panel

### M1-S06 — Ctrl+Z undoes, Ctrl+Shift+Z redoes

**Covers:** T3 · **Status:** ✅ manual 2026-08-09 · **Headless counterpart:** `src/commands/undo.test.ts`

- **Given:** a sequence of edits — walls placed, a bar chained with bends, a wall deleted
- **When:** pressing Ctrl+Z repeatedly, then Ctrl+Shift+Z repeatedly
- **Then:** each Ctrl+Z reverts exactly one command (a chained bar loses its last bend point first, then the previous ones, then the bar; a deleted wall returns WITH its bars in one step), each Ctrl+Shift+Z re-applies one step, and after a NEW edit the redo path is gone; undo history survives 30+ edits with the oldest levels dropped

### M1-S07 — Edit menu entries, shortcut labels and disabled states

**Covers:** T3 · **Status:** ✅ manual 2026-08-09

- **Given:** the app has loaded (empty project)
- **When:** opening the Edit menu in the top bar before any edit, after placing a wall, after an undo, and with/without a selection
- **Then:** the menu shows Undo (Ctrl+Z), Redo (Ctrl+Shift+Z), Delete (Del) with the shortcut labels right-aligned; Undo/Redo are disabled when their stacks are empty and enable/disable live as edits happen; Delete is disabled when nothing is selected and no section is open; every enabled item performs the same action as its keyboard shortcut; all styling follows the theme (no hard-coded colors — verify in both themes)

### M1-S08 — Edit shortcuts guard editable fields and in-progress drafts

**Covers:** T3 · **Status:** ✅ manual 2026-08-09

- **Given:** (a) a text input focused (e.g. the section name field / any editable field); (b) the Place Wall or Place Bar tool mid-draft (chaining)
- **When:** pressing Delete, Backspace, Ctrl+Z, Ctrl+Shift+Z, and the tool letters
- **Then:** (a) every shortcut is ignored while typing — the field keeps its text, no undo/delete/tool-switch fires; (b) Delete/Backspace do nothing mid-draft (Esc remains the cancel path) — the in-progress wall/bar chain continues normally

### M1-S10 — Move tool drags the wall with its bars; section updates on drop; one undo level

**Covers:** T4 · **Status:** ✅ manual 2026-08-09 · **Headless counterpart:** `src/ui/viewport/element-drag.test.ts`

- **Given:** a wall with a hosted bar, a section cut through the wall with the 2D panel open, and the Move tool (M) active
- **When:** dragging the wall to a new position and releasing
- **Then:** the wall AND its bar follow the cursor live during the drag (live-offset render, grid-snapped), both stay at the new position on release, the 3D section wireframe is untouched, and the 2D section view updates on the drop (outline follows the wall; the bar dot keeps its cover offset while the wall crosses the cut); Ctrl+Z restores wall+bar in ONE step, Ctrl+Shift+Z re-applies

### M1-S11 — Grid snapping applies to the drag delta; Shift disables it

**Covers:** T4 · **Status:** ✅ manual 2026-08-09

- **Given:** the Move tool active, snap ON (status bar)
- **When:** dragging a wall, holding Shift mid-drag, and toggling snap off via the status bar
- **Then:** with snap ON the drop lands on grid multiples (the delta snaps); Shift held → the wall follows the cursor freely off-grid; snap off → free movement without Shift

### M1-S12 — Esc / tool switch cancels mid-drag; click is not a drag

**Covers:** T4 · **Status:** ✅ manual 2026-08-09

- **Given:** the Move tool active, mid-drag on a wall
- **When:** (a) pressing Esc mid-drag; (b) pressing W or V mid-drag, then releasing the mouse; (c) clicking a wall without moving the mouse (or a sub-threshold wobble)
- **Then:** (a) wall+bar snap back to the original position, nothing commits, the tool returns to Select; (b) nothing commits, the wall snaps back, the newly chosen tool is active; (c) nothing happens — no move, no selection change, the tool stays Move

### M1-S13 — Move is single-shot; double-click locks it sticky

**Covers:** T4 · **Status:** ✅ manual 2026-08-09 · **Headless counterpart:** `src/ui/viewport/element-drag.test.ts`

- **Given:** the Move tool active (single), then double-clicked in the toolbar (sticky ring visible)
- **When:** completing one drag in each mode
- **Then:** single mode auto-returns to Select after the drop; sticky mode stays active for further drags until Esc (or another tool)

### M1-S14 — Move picking: highlighted = what will move

**Covers:** T4 (author review correction) · **Status:** ✅ manual 2026-08-09 · **Headless counterpart:** `src/ui/viewport/element-drag.test.ts` (resolveMoveTarget)

- **Given:** the Move tool active over a wall with hosted bars (section wireframe nearby)
- **When:** hovering bare wall, then a bar through the transparent concrete, then empty ground; and click-dragging from a highlighted bar
- **Then:** hovering the wall highlights the wall AND its hosted bars (the moving set); hovering a bar highlights the bar ALONE — and a drag from it does NOTHING (no bar move, no wall move — bar-relative moves are M3 scope); empty ground clears the highlight; the Select tool (V) never moves anything

### M1-S15 — Move shortcut guards

**Covers:** T4 · **Status:** ✅ manual 2026-08-09

- **Given:** a text field focused
- **When:** pressing M (and the other shortcuts)
- **Then:** M is ignored while typing (same isEditableTarget guard as all shortcuts); undo/redo/Delete behave exactly as in M1-S04…S08 after any completed move

### M1-S16 — Section content is bounded by the cut line

**Covers:** T4 (author review fix — §G.1 revised 2026-08-09) · **Status:** ✅ manual 2026-08-09 · **Headless counterpart:** `src/engine/sectioning.test.ts` (bounded-line block) + `src/commands/m1-reactivity.test.ts` (sideways probe)

- **Given:** two parallel walls with a bar each, one section cut across both, 2D panel open
- **When:** moving the second wall SIDEWAYS out of the section wireframe volume, then the first; then undoing; separately, dragging a wall only partway past the cut line end
- **Then:** each wall's outline and dot DISAPPEAR from the 2D view as it leaves the wireframe box (not merely shift); after the second move the panel immediately shows "No geometry in this view" (no reshape needed); undo restores both step by step; a partial crossing shows the outline clipped exactly at the cut line end
