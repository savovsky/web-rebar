# ⚠️ TEMP session prompt — M2 T5 (DXF import core + ReferenceDocument model)

> Point a fresh AI session at this file (or paste its content). **Delete this file once the T5 session has started** — the durable record is the M2 tracker. Created 2026-08-18 after **M2 T4** (File menu + IFC UI wiring ✅ — browser round-trip verified manually by the author; IFC stack confirmed in lazy chunks, shell 1,278 kB). Branch `A_MVP_Scope_M2`.

---

I'm working on a browser-based reinforced concrete drawing app ("web-rebar").
Read C:\work\personal\projects\web-rebar\README.md first — it has session state
(M0 + M1 ✅; M2 T1/T2/T2.5/T3/T4 ✅ — all 2026-08-18; IFC round-trip proven
headless AND in the browser; model space is Z-up right-handed mm, identical to
IFC/DXF; branch A_MVP_Scope_M2) and the Rules for Implementation Sessions.
Then read docs/08-architecture-spec.md (especially §B.2, §C incl. the Q7
revision, §H.1 incl. the Q7-a note, §N) and the approved plan
docs/implementation-plans-and-tasks/m2-adapters-round-trip.md — including ALL
task logs (T1 exporter conventions, T2 bundle/lazy-loading contract, T3 import
adapter + async undo scope, T4 File menu + findings below).

⚠️ HARD GATE CHECK FIRST (author gate, ✅ satisfied 2026-08-18 but VERIFY):
`docs/test-fixtures/dxf/` must still contain the author's 8 real AutoCAD
exports (gitignored — invisible to git status). If missing → STOP and ask the
author. T5's unit tests must skip gracefully when fixtures are absent, but the
real-file risk probes (Q4 units/blocks) must run against the real files.

Task: implement the next ⬜ Pending task from the M2 tracker — **T5: DXF
import core + ReferenceDocument model (Q3/Q4/Q6)** (plan §5):

- Data model first (rule 4): `src/data/models/reference-documents.ts`
  (`ReferenceDocument`, `ReferencePrimitive` — line/arc/circle/polyline, model
  mm, inert `sourceLayer` tag) + `project.ts` extension. Keep Q3's tagged
  union `source: { kind: 'dxf', ... }` EXACTLY as designed — `{ kind: 'ifc' }`
  joins it at T6.5 (Q7, approved 2026-08-18): do NOT build the ifc variant,
  but do NOT close the door either.
- `src/io/dxf-adapter.ts` — parse (`dxf-parser`, Q6 — add the dependency) +
  OUR pure mapping layer: $INSUNITS → mm factor (Q4 table + override param),
  entity filter with skip counts, bulge → arc, BLOCK/INSERT explosion
  (bounded recursion + cycle guard).
- §N commands: `importReferenceDocument` (ONE reducer → exactly ONE undo
  level — the F3 door-check note), `removeReferenceDocument`,
  `setReferenceDocumentVisibility`. Registry + the m1-acceptance
  registry-completeness probe updated IN THE SAME COMMIT (the tripwire fails
  otherwise).
- Unit tests: units table (mm/cm/m/in/unitless), bulge math vs known arcs,
  block nesting + cycle guard, skip-count reporting, undo/redo exact-restore.
- No rendering/UI in T5 (that is T6) — but the File menu's Import DXF… entry
  also lands in T6. T5 is headless + real-file probes.

Work on branch A_MVP_Scope_M2, one task at a time: pnpm lint + pnpm test +
pnpm build green → changes + manual test list → I review and commit.
Do NOT commit anything yourself.

## T4 findings T5 MUST consume (from the T4 task log — read it in full)

1. **The bundle tripwire is LIVE.** The File menu made the IFC stack reachable
   from the app graph; the production build report is now the standing
   tripwire: shell 1,277.66 kB, web-ifc-api 3,538 kB + web-ifc.wasm 1,304 kB
   in LAZY chunks/assets, no INEFFECTIVE_DYNAMIC_IMPORT warning. dxf-parser is
   small, but follow the exportIfc/importIfcModel precedent (command
   dynamically imports the mapping module) unless you record a reasoned
   deviation in the task log — the shell baseline to defend is ~1,278 kB.
2. **Serial command dispatch assumed** (single undo-scope slot — the T3
   middleware change). UI disables entries while a transfer is in flight;
   T6's Import DXF menu entry must follow the FileMenu pattern.
3. **Status-bar UX pattern from T4:** pure formatting module
   (`src/ui/shell/ifc-status-hints.ts` — CommandError.code branching, summary
   strings) + dumb component glue. T6's DXF import reuses it
   (skip-count summary from the mapping layer's result).
4. **Q7 is recorded, not built** — it lands at T6.5 (depends on T5's model +
   T6's Backgrounds panel). T5 only keeps the tagged-union door open.
5. Rule 8: the author may edit files in parallel; the task commit includes all
   working-tree changes. Manual test list ends the task report (rule 7).

## Definition of done for T5 (from the plan)

- ReferenceDocument model + 3 §N commands + dxf-adapter mapping layer as
  above; registry probe updated; tests green incl. real-fixture probes (skip
  gracefully when absent); lint + test + build green with the shell tripwire
  holding; T5 task log entry + tracker row (commit `—`); scenario file
  extended after author approval.
