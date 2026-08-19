# ⚠️ TEMP session prompt — M2 T4 (File menu + IFC import/export UI wiring)

> Point a fresh AI session at this file (or paste its content). **Delete this file once the T4 session has started** — the durable record is the M2 tracker. Created 2026-08-18 after **M2 T3** (IFC import adapter + `importIfcModel` command + the §A round-trip identical-model probe ✅ — export → import → identical model, exactly ONE undo level per import). Branch `A_MVP_Scope_M2`.

---

I'm working on a browser-based reinforced concrete drawing app ("web-rebar").
Read C:\work\personal\projects\web-rebar\README.md first — it has session state
(M0 + M1 ✅ complete; M2 T1 ✅, T2 ✅, T2.5 ✅, T3 ✅ — all 2026-08-18; IFC
round-trip proven headless; model space is Z-up right-handed mm, identical to
IFC; branch A_MVP_Scope_M2) and the Rules for Implementation Sessions. Then
read docs/08-architecture-spec.md (especially §B.2, §B.5, §C, §D.4 revised
2026-08-18, §E, §N) and the approved plan
docs/implementation-plans-and-tasks/m2-adapters-round-trip.md — including the
T1 task log (the three Allplan exporter conventions), the T2/T2.5 logs, AND
the **T3 task log** (import adapter + the async undo-scope middleware change +
the findings for T4 listed below).

Task: implement the next ⬜ Pending task from the M2 tracker — **T4: File menu
+ IFC UI wiring** (plan §4): TopBar File menu (Radix DropdownMenu — the M1 T3
TopBar comment reserves it: src/ui/shell/TopBar.tsx, "arrive with persistence
and view options (M2+)"; follow the existing Edit menu pattern) with Import
IFC… / Export IFC entries. Open via `<input type=file>`, save via blob-anchor
download (`exportIfc` already returns `{ bytes, fileName }`). Status-bar hints
+ skip-count summaries from the import result. Components stay DUMB (rule 2):
they read/write files and dispatch commands; parsing/mapping lives in
src/io/. Lazy-load web-ifc on first menu use (status hint/spinner while
loading — loadIfcApi() is the app singleton). Manual test list ends the task
report (rule 7): the BROWSER round-trip manual test is THIS task's (T3 was
headless-only) — build a wall + bent bar in the viewport, File → Export IFC,
File → Import IFC into the app, verify the re-imported model appears and ONE
Ctrl+Z removes the whole import; author opens the exported .ifc in Allplan
2022.

Work on branch A_MVP_Scope_M2, one task at a time: pnpm lint + pnpm test +
pnpm build green → changes + manual test list → I review and commit.
Do NOT commit anything yourself.

Note: the T5/T6 DXF fixture hard gate is ✅ SATISFIED (8 real AutoCAD exports
in docs/test-fixtures/dxf/, gitignored) — no gate check needed for T4.

## T3 findings T4 MUST consume (from the T3 task log — read it in full)

1. **Import results + errors are UI-ready.** `importIfcModel({ buffer })`
   returns `ImportIfcModelSummary { importedWalls, importedBars, skipped:
   { missingIntentPset, unsupportedElements } }` — build the status-bar
   summary from it ("imported 2 walls + 2 bars, skipped 1 foreign element").
   Rejections are `CommandError` with codes: `INVALID_PARAMS` (not an IFC
   file / duplicate ids = double import / corrupt intent-carrying entity) and
   `NOT_FOUND` (bar host missing) — branch on `code`, never on message text.
2. **web-ifc WASM ABORTS on non-SPF bytes** (`RuntimeError: memory access out
   of bounds` — not a catchable parse error). `parseIfcModel` already guards
   with the `ISO-10303-21;` magic check, so UI code never feeds garbage to
   web-ifc as long as it goes through the `importIfcModel` command — never
   call web-ifc or the mapping modules directly from components.
3. **Async undo scope is now safe.** `undoScopeMiddleware` holds the command
   scope open until an async thunk settles (T2 finding #3, fixed in T3 with
   the failing-then-passing proof) — `importIfcModel`'s per-entity dispatches
   record exactly ONE undo level. Known limit (recorded in the middleware):
   serial command dispatch assumed; don't fire concurrent IFC commands
   (disable menu entries while an import/export is in flight).
4. **Bundle tripwires become LIVE in T4.** Until now the app graph
   tree-shook the whole IFC stack (no UI importer), so the production build
   never emitted it: shell baseline 1,272 kB. From T4 on, the File menu
   reaches `exportIfc`/`importIfcModel` — verify the production build: web-ifc
   API (~3.5 MB) + WASM (~1.3 MB) must stay in LAZY chunks/assets, the shell
   bundle must stay at ~1,272 kB, and any INEFFECTIVE_DYNAMIC_IMPORT warning
   is a tripwire (the T2 log documents the exact scratch-entry probe pattern
   and expected chunk sizes). ui-slice/status-hint patterns: see how existing
   tools set cursorHint (e.g. use-tool-shortcuts, delete-selection).

## Reuse / conventions

- `src/commands/export-ifc.ts` / `import-ifc.ts` are the §N doorways — the
  File menu dispatches them and nothing else (no domain logic in components).
- `loadIfcApi()` (src/io/web-ifc-loader.ts) = app singleton — the command
  layer already handles the lazy load; the UI only needs a "loading IFC
  module…" style status hint around the dispatch (first call pays the WASM
  init).
- The Edit menu in TopBar (M1 T3) is the Radix DropdownMenu + tokens-only
  precedent to mirror (rule 6: design tokens only, no literal styles).
- File-open: hidden `<input type="file" accept=".ifc">` triggered from the
  menu item; read with `file.arrayBuffer()` → `Uint8Array`. File-save:
  `Blob` + object URL + anchor download with the command's `fileName`.
- Tests: command-layer behavior is already covered headlessly (T3); T4 tests
  are for any NEW logic (menu enabled/disabled states, file-name handling) —
  keep file I/O glue thin enough to not need tests.
- Lint constraints that bit in T2/T3: .ts files max 400 non-blank
  non-comment lines (200 for .tsx), max-params 2 (options objects),
  no-magic-numbers (tests exempt), prettier import order, `0n`-style bigint
  literals forbidden.
- Rule 8: the author may edit files in parallel; the task commit includes all
  working-tree changes. Manual test list ends the task report (rule 7).

## Definition of done for T4 (from the plan)

- TopBar File menu with Import IFC… / Export IFC; open via file input, save
  via blob download; status-bar hints + import skip-count summary; lazy
  web-ifc load with a loading indication.
- Components stay dumb (zero direct store mutations / domain logic in
  src/ui/ — the review checklist row).
- Manual: browser round-trip (build wall + bar → export → import → model
  re-appears, ONE undo removes it) + author opens the exported .ifc in
  Allplan 2022 (T1/T2 artifacts precedent).
- pnpm lint + pnpm test + pnpm build green with the IFC stack in LAZY chunks
  (shell ~1,272 kB) — T4 is the first task where the production bundle report
  is the standing tripwire.
- T4 task log entry + tracker row in
  docs/implementation-plans-and-tasks/m2-adapters-round-trip.md (mark commit
  `—`; the author records the hash after committing); scenario file
  docs/test-scenarios/m2-adapters-round-trip.md extended with the T4 manual
  checks (M2-S05…) after author approval.
