# ⚠️ TEMP session prompt — M2 T7 (DXF export of the active section view — true 1:1 mm, Q5)

> Point a fresh AI session at this file (or paste its content). **Delete this file once the T7 session has started** — the durable record is the M2 tracker. Created 2026-08-18 after **M2 T6.5** (IFC reference solids ✅ — 326 tests green, shell 1,293.14 kB, dxf chunk 33.85 kB lazy, web-ifc chunks lazy; commit `737c322`). Branch `A_MVP_Scope_M2`.

I'm working on a browser-based reinforced concrete drawing app ("web-rebar").
Read C:\work\personal\projects\web-rebar\README.md first — it has session state
(M0 + M1 ✅; M2 T1/T2/T2.5/T3/T4/T5/T6/T6.5 ✅ — all 2026-08-18; IFC round-trip
proven headless AND in the browser; DXF backgrounds render + snap; foreign IFC
imports as render-only reference solids; model space is Z-up right-handed mm,
identical to IFC/DXF; branch A_MVP_Scope_M2) and the Rules for Implementation
Sessions. Then read docs/08-architecture-spec.md (especially §G.1, §G.2.3, §I,
§M.4, §N) and the approved plan
docs/implementation-plans-and-tasks/m2-adapters-round-trip.md — including ALL
task logs, especially T5 (dxf-adapter + mapping-layer split), T6 (the pen-table
seed consumer — section view), and the Q5 decision row (true 1:1 mm model-space
export, $INSUNITS=4, named layers, DASHED background, true-Ø dot circles, mm
plot-weight seed joins the px screen seed in src/data/appearance.ts).

⚠️ FIXTURE CHECK FIRST: `docs/test-fixtures/dxf/` (the author's 8 real AutoCAD
exports, gitignored) must be present — T7's reimport-fidelity probe re-uses the
T5 importer against its own export. ✅ Confirmed available 2026-08-18, but
VERIFY. If missing → STOP and ask the author.

Task: implement the next ⬜ Pending task from the M2 tracker — **T7: DXF export
of the active section view** (plan §7, Q5 approved 2026-08-10):

- Custom writer (doc 07/09: no library) — `exportDxfSection` in
  `src/io/dxf-adapter.ts` (or a sibling module if the 400-line lint cap forces
  it — the T5 split precedent): HEADER ($ACADVER AC1015 — R2000: LWPOLYLINE +
  lineweight support — and `$INSUNITS=4`), TABLES (DASHED linetype; the three
  Q5 layers WEBREBAR-CONCRETE / WEBREBAR-REBAR / WEBREBAR-BACKGROUND with mm
  lineweights from the new plot-weight seed in `src/data/appearance.ts`),
  ENTITIES (closed LWPOLYLINE concrete outlines; CIRCLE cut-bar dots at true
  Ø/2 — §M.4 true relative diameters; dashed LINE background per §G.2.3), EOF.
  Section (u,v) → DXF (x,y) DIRECTLY (no flip — v is up, y is up; true 1:1 mm,
  no plot scale — scale-on-sheet stays with the consumer's CAD paper space,
  the Drawing Layouts topic is NOT touched).
- §N command `exportSectionDxf({ sectionId }) → { text, fileName }` reading
  `selectSectionPrimitives` (pure, no mutation, no undo level — the
  exportIfc/setActiveSection precedent; async thunk NOT needed unless the
  writer is dynamic-imported for bundle reasons — check and record).
  File menu entry (T4 pattern — enabled when a section is active; dumb glue:
  command → blob-anchor download; `formatExportError`-style pure hints).
- Headless tests: exact-coordinate assertions (outline coords ==
  `selectSectionPrimitives` output; circle radius == Ø/2), layer/linetype/
  INSUNITS assertions, **reimport-through-our-own-importer geometry-fidelity
  probe** (the T5 importer reads the T7 export back — the round-trip class
  that caught real bugs in T2/T3); `command-registry.test.ts` +
  `m1-acceptance.test.ts` registry probe map updated in the same commit (the
  tripwire works as designed).
- Bundle tripwire: defend shell **1,293.14 kB** (T6.5), dxf chunk 33.85 kB
  lazy (it grows with the writer — record the new size), web-ifc chunks lazy,
  no INEFFECTIVE_DYNAMIC_IMPORT. If the writer joins the DXF lazy chunk, the
  File menu must reach it through the command like Import DXF… does.
- Task log + tracker row (commit `—` until the author commits); scenario file
  docs/test-scenarios/m2-adapters-round-trip.md gains the T7 scenario(s) in
  the same commit (rule 7 — M2-S12 next id).

Work on branch A_MVP_Scope_M2, one task at a time: pnpm lint + pnpm test +
pnpm build green → changes + manual test list → I review and commit.
Do NOT commit anything yourself.

Manual (the T7 acceptance probe — Q5's author-measures-in-real-CAD check):
build wall + bar → Section Cut → File → Export Section DXF → open the file in
real CAD (Allplan 2022 / AutoCAD) → measure: the wall outline is true
thickness × height, the Ø12 dot is a 12 mm circle, the background is dashed,
and 1 drawing unit = 1 mm ($INSUNITS=4).

---

## 📌 Closing procedure (Rule 9 — added 2026-08-18 after the T6.5 closing loop)

When the author approves T7:

1. Gates green ONCE (pnpm lint + test + build — no re-running after approval edits).
2. Task commit with the tracker cell `Commit: —` (a commit CANNOT contain its
   own hash — self-reference is mathematically impossible).
3. Follow-up commit `Tracker: record T7 hash (<hash>)` filling the hash in.
4. **NEVER amend** the task commit after the hash exists (typo fixes before
   the hash is recorded are the only allowed amendments).
5. Push `origin A_MVP_Scope_M2`; the NEXT session prompt (T8) lands in the
   hash-commit too.
6. **Hard stop:** the same git/sed/check cycle twice without converging →
   STOP, state the invariant, use the two-commit pattern.
