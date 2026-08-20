# ⚠️ TEMP session prompt — M2 T6 (Background rendering + tracing snaps + Backgrounds panel + Import DXF menu)

> Point a fresh AI session at this file (or paste its content). **Delete this file once the T6 session has started** — the durable record is the M2 tracker. Created 2026-08-18 after **M2 T5** (DXF import core + ReferenceDocument model ✅ — 277 tests green, real-file probes RAN on the author's 8 fixtures, shell 1,278 kB, dxf chunk 34 kB lazy). Branch `A_MVP_Scope_M2`.

---

I'm working on a browser-based reinforced concrete drawing app ("web-rebar").
Read C:\work\personal\projects\web-rebar\README.md first — it has session state
(M0 + M1 ✅; M2 T1/T2/T2.5/T3/T4/T5 ✅ — all 2026-08-18; IFC round-trip proven
headless AND in the browser; DXF import core + ReferenceDocument model done
headless; model space is Z-up right-handed mm, identical to IFC/DXF; branch
A_MVP_Scope_M2) and the Rules for Implementation Sessions.
Then read docs/08-architecture-spec.md (especially §B.2, §B.3, §C, §H.1 incl.
the T5 `referenceDocuments` note, §N) and the approved plan
docs/implementation-plans-and-tasks/m2-adapters-round-trip.md — including ALL
task logs (T4's File-menu/status-hint/serial-dispatch findings, T5's DXF
mapping semantics + findings for T6 below).

⚠️ HARD GATE CHECK FIRST (author gate, ✅ satisfied 2026-08-18 but VERIFY):
`docs/test-fixtures/dxf/` must still contain the author's 8 real AutoCAD
exports (gitignored — invisible to git status). If missing → STOP and ask the
author. T6's tracing-workflow probe is meaningless without the real files.

Task: implement the next ⬜ Pending task from the M2 tracker — **T6:
Background rendering + endpoint/midpoint tracing snaps + Backgrounds panel +
Import DXF menu entry** (plan §6):

- `ReferenceLayer` in Viewport3D: linework rendered at the document's
  `elevationMm` (default 0, plan ground), muted token color (tokens.css,
  rule 6), per-document visibility; **excluded from `pickPointerWinner`**
  (backgrounds are never selected/moved — reference, not model). Mind the
  67k-primitive documents (the T5 probe): merged BufferGeometry, not
  per-primitive React elements. Arc sweeps are stored CCW start→end (radians,
  may wrap past 2π) — tessellation must follow the sweep, not the short way.
- Snapping (§B.3 — Endpoint/Midpoint rows get their first real target):
  placement draft point resolution (Place Wall / Place Bar) considers
  reference-linework endpoints/midpoints within snap tolerance, with the
  existing snap-marker feedback; Shift still disables (§B.3). §B.3 spec
  revision note lands in the same commit.
- "Backgrounds" section in the Building panel tab (§B.2 reserves this panel):
  document list with visibility toggle + remove (dispatches the T5 commands
  `setReferenceDocumentVisibility` / `removeReferenceDocument`).
- File menu: **Import DXF…** — the T4 pattern: `file.text()` →
  `importReferenceDocument({ text, fileName })`; in-flight disabling (serial
  command dispatch assumption); a pure status-hint formatter module (the
  `ifc-status-hints.ts` pattern) + headless tests.
- No DXF export in T6 (that is T7).

Work on branch A_MVP_Scope_M2, one task at a time: pnpm lint + pnpm test +
pnpm build green → changes + manual test list → I review and commit.
Do NOT commit anything yourself.

## T5 findings T6 MUST consume (from the T5 task log — read it in full)

1. **Units-override choice (Q4):** key off `ImportReferenceDocumentSummary.unitsAssumed`
   (unitless/missing/unknown $INSUNITS, no override). The command's
   `insunitsOverride` param is ready for a re-import-with-override flow or a
   pre-import chooser — the import flow owns the UX decision; record it in
   the task log.
2. **Skip counts count EXPLODED instances** (block content × insert
   multiplicity) — the summary strings should say "occurrences" (a HATCH
   inside a 10×-inserted block is 10 missing fills on screen).
3. **The bundle tripwire changes character at T6:** the File menu's Import
   DXF… makes the dxf-adapter chunk reachable from the app graph — the
   production build report covers the DXF path from T6 on. Baselines to
   defend: shell **1,278.03 kB** (T5 report), dxf chunk **34.38 kB / 10.70 kB
   gzip lazy** (T5 scratch-entry probe), no INEFFECTIVE_DYNAMIC_IMPORT.
4. **Memory/undo are quiet by construction:** undo snapshots retain imported
   documents once (frozen-reference structural sharing — the M1 T5 finding);
   no new mechanism needed even for 67k-primitive imports (~0.6 s parse+map
   on the author's largest file — the T4 in-flight disabling suffices, no
   progress UI).
5. **Empty-document imports are allowed** (a text-only sheet is legitimate;
   the skip report tells the story) — the status hint must not present an
   empty import as an error.
6. Rule 8: the author may edit files in parallel; the task commit includes all
   working-tree changes. Manual test list ends the task report (rule 7).

## Definition of done for T6 (from the plan)

- ReferenceLayer (elevation, muted tokens, per-doc visibility, not pickable) +
  endpoint/midpoint snaps into the placement drafts (Shift disables) +
  Backgrounds panel section (toggle/remove via the T5 commands) + Import DXF…
  menu entry (override flow + skip summary) + §B.3 revision note; lint + test
  + build green with the shell/dxf tripwires holding; T6 task log entry +
  tracker row (commit `—`); scenario file extended after author approval.
- **Manual (the doc-11 workflow probe):** the author imports a real architect
  DXF → sees it at true scale on the plan → traces a wall over it via
  endpoint/midpoint snaps → hides/removes the background.
