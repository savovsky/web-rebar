# M0 Test Scenarios — One Wall, One Bar

> **Back to:** [Test Scenarios](./README.md) · [M0 tracker](../implementation-plans-and-tasks/m0-one-wall-one-bar.md)
> Backfilled 2026-08-09 from the M0 tracker task logs (T1–T9). Statuses reflect the author's visual confirmations recorded there.

---

### M0-S01 — App boots with WASM loaded

**Covers:** T1 · **Status:** ✅ manual 2026-08-08

- **Given:** the dev server is running (`pnpm dev`; `pnpm wasm:build` has run)
- **When:** the app is opened in the browser
- **Then:** the shell renders, the console shows the WASM self-test (crate version + flat-array probes) and no errors; the Rust/WASM core is live before any tool is used

### M0-S02 — App shell layout per §B.2

**Covers:** T6 · **Status:** ✅ manual 2026-08-08

- **Given:** the app has loaded
- **When:** inspecting the screen
- **Then:** tool bar on the left, viewport in the center, Building/Properties tabs on the right, status bar at the bottom; dark theme is the default; all styling comes from design tokens (no literal values)

### M0-S03 — Tool activation via click and shortcut

**Covers:** T6 · **Status:** ✅ manual 2026-08-08

- **Given:** the app has loaded
- **When:** a tool is clicked in the tool bar, or its shortcut is pressed (V / W / B / S / H)
- **Then:** the tool becomes active (visually highlighted) and the status bar shows the tool name and its context hint; shortcuts are ignored while typing in editable fields

### M0-S04 — Sticky mode and Esc return to Select

**Covers:** T6 · **Status:** ✅ manual 2026-08-08

- **Given:** any tool is active
- **When:** the tool is double-clicked (sticky lock), then Esc is pressed
- **Then:** double-click shows the sticky indicator (visible ring in both themes); Esc cancels any draft, deselects, and returns to the Select tool; the previously active button keeps a visible keyboard-focus ring until the next click

### M0-S05 — Viewport mouse mapping and grid

**Covers:** T7 · **Status:** ✅ manual 2026-08-08

- **Given:** the 3D viewport is visible
- **When:** right-dragging, middle-dragging, and scrolling
- **Then:** right-drag orbits, middle-drag pans, scroll zooms (§B.6); the grid renders at the status-bar spacing (default 100 mm)

### M0-S06 — Live coordinates and grid snapping

**Covers:** T7 · **Status:** ✅ manual 2026-08-08

- **Given:** a placement tool is active
- **When:** moving the cursor over the ground plane, holding Shift, toggling snap in the status bar
- **Then:** the status bar shows live plan X/Z coordinates; the crosshair marker (one grid cell per arm) snaps to grid intersections; holding Shift or toggling snap off disables snapping — preview and commit use the same snapped position (what you see is what you get)

### M0-S07 — Chained wall placement

**Covers:** T7 · **Status:** ✅ manual 2026-08-08 (chaining revised same day)

- **Given:** the Place Wall tool is active (W)
- **When:** clicking a start point, then an end point, then more points, then Esc
- **Then:** the second click creates a 200×2800 mm wall AND immediately chains the next wall from that point (no Enter); Esc exits the tool; a zero-length click keeps the draft and explains the error in the status bar; the draft preview is translucent with crosshair markers at committed points

### M0-S08 — Wall selection under the Select tool

**Covers:** T7 · **Status:** ✅ manual 2026-08-08

- **Given:** at least one wall exists and the Select tool is active
- **When:** clicking a wall, then Esc
- **Then:** the wall is highlighted in the selection color; Esc deselects; clicking walls while a placement tool is active does NOT select (placement stays unambiguous)

### M0-S09 — Chained bar placement creates ONE bar

**Covers:** T8 · **Status:** ✅ manual 2026-08-09

- **Given:** a wall exists and the Place Bar tool is active (B)
- **When:** clicking a wall face (sets the cover side), then 4 path points, then Esc
- **Then:** exactly ONE bar exists with 4 path points — intermediate clicks are bending places of a single bar (one position for the schedule, one entry in bar counts); the new bar is selected; starting a NEW bar on the same face = Esc, then B and a face click again

### M0-S10 — Cover kept from ALL wall faces

**Covers:** T8 · **Status:** ✅ manual 2026-08-09

- **Given:** the Place Bar tool is active with a captured face (default Ø12, 25 mm cover)
- **When:** clicking path points at or near wall edges, the wall top, and the wall ends
- **Then:** the bar centerline is pulled inside so the bar keeps its cover from EVERY face — 31 mm (cover + radius) from the captured face, ≥ 25 mm from edges, top, and the end faces it terminates at; bent corners near an edge get the larger inset automatically

### M0-S11 — Rounded bends with code mandrel radius

**Covers:** T8 · **Status:** ✅ manual 2026-08-09

- **Given:** a chained bar with at least one bend
- **When:** inspecting the bend up close (orbit/zoom)
- **Then:** the bend renders rounded with the DIN/EC2 mandrel radius for the diameter (Ø12 → 30 mm centerline radius), the surface is smooth with no kink or twist, and the bar still keeps its cover at the bend; the stored path keeps sharp vertices (bend radius is render geometry only)

### M0-S12 — Bar preview, visibility and draft guards

**Covers:** T8 · **Status:** ✅ manual 2026-08-09

- **Given:** the Place Bar tool is mid-draft (face captured)
- **When:** moving the cursor, clicking a different wall, clicking the ground
- **Then:** the preview line and face-oriented crosshair track the cursor snapped to the grid ON THE CAPTURED FACE; bars render in rebar orange, visible through the translucent concrete; clicks on a different wall or the ground mid-draft are ignored; a zero-length path click keeps the draft and explains the error in the status bar

### M0-S13 — Perpendicular section shows bar dot at correct offset

**Covers:** T9 + T10 · **Status:** ✅ manual 2026-08-09 · **Headless counterpart:** `src/commands/m0-acceptance.test.ts` (T11 — the same flow driven through the §N command layer + real WASM boundary)

- **Given:** a wall with a bar placed at 25 mm cover (Ø12)
- **When:** the Section Cut tool (S) is used — drag a line perpendicular to the wall axis through the bar, then a third click sets the view depth on the side the view should look toward
- **Then:** the 2D section view opens showing the concrete outline as the thickness × height rectangle, and the bar appears as a dot at u = cover + radius (31 mm) from the corresponding outline side and v = bar height — the M0 acceptance check; the tool auto-returns to Select after the depth click

### M0-S14 — Section dots keep true relative diameters

**Covers:** T9 + T10 · **Status:** ✅ manual 2026-08-09

- **Given:** a section cutting bars (M0 places Ø12 by default)
- **When:** the 2D section view is open
- **Then:** dots render at true relative diameters (§M.4) — the dot's size reads against the concrete outline thickness (Ø12 dot = 6% of a 200 mm outline width); a Ø20 dot would be visibly larger than a Ø8 dot

### M0-S15 — Oblique cut, background and view depth

**Covers:** T9 + T10 · **Status:** ✅ manual 2026-08-09

- **Given:** (a) a section cut oblique to the wall axis near its end, (b) a bar continuing behind the cut plane, (c) a wall fully behind the plane within view depth
- **When:** the 2D section view is open
- **Then:** (a) the outline is wider than the thickness and the genuine end edge appears as a background line; (b) the behind-plane continuation is drawn dashed and clipped at the view depth; (c) the far wall shows as dashed elevation edges with no filled outline

### M0-S16 — Section view panel sizing, resize and close

**Covers:** T10 · **Status:** ✅ manual 2026-08-09

- **Given:** a section has been cut
- **When:** the 2D section view panel is open and its bottom-right corner grip is dragged
- **Then:** the panel opens at roughly a quarter of the viewport area (half width × half height), resizes smoothly via the grip (down to a sensible minimum), and the drawing re-fits to the new size; the ✕ button closes the panel; the Building tab shows only Elements and Bars counts (no section counter)

### M0-S17 — Section wireframe volume in the 3D viewport

**Covers:** T10 · **Status:** ✅ manual 2026-08-09

- **Given:** at least one section exists
- **When:** inspecting the 3D viewport with the Select tool active
- **Then:** every section shows as a wireframe box (cut line × view depth × target height) — the active one highlighted with a subtle fill, inactive ones faint; clicking a wireframe opens its 2D panel; dragging the active volume's body moves the section (the 2D view updates); dragging any of the 8 corner handles stretches the shape — front handles re-form the line, back handles slide the line end and change the depth, dragging a back handle past the cut line flips the view side; moving the section off all elements shows the panel's empty state until it is moved back; handles respond only under the Select tool

### M0-S18 — Section Cut guards and sticky mode

**Covers:** T10 · **Status:** ✅ manual 2026-08-09

- **Given:** the Section Cut tool is active (S)
- **When:** (a) dragging a zero-length line, (b) dragging a line that crosses no element, (c) clicking the depth point exactly on the committed line, (d) pressing Esc at any stage, (e) cutting with the tool sticky-locked, (f) cutting a second section
- **Then:** (a) and (b) reject with a status-bar explanation and keep the tool active; (c) keeps the committed line and waits for a valid depth click; (d) cancels the draft; (e) the tool stays active after the cut; (f) sections are named sequentially (S-1, S-2, …)
