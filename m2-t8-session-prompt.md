# ⚠️ TEMP session prompt — M2 T8 (M2 acceptance pass — the LAST M2 task)

> Point a fresh AI session at this file (or paste its content). **Delete this file once the T8 session has started** — the durable record is the M2 tracker. Created 2026-08-18 after **M2 T7** (DXF export of the active section view ✅ — 344 tests green, shell 1,294.54 kB, dxf chunk 37.05 kB lazy incl. the writer, web-ifc chunks lazy; commit recorded per Rule 9). Branch `A_MVP_Scope_M2`.

I'm working on a browser-based reinforced concrete drawing app ("web-rebar").
Read C:\work\personal\projects\web-rebar\README.md first — it has session state
(M0 + M1 ✅; M2 T1/T2/T2.5/T3/T4/T5/T6/T6.5/T7 ✅ — all 2026-08-18; IFC
round-trip proven headless AND in the browser; DXF backgrounds render + snap;
foreign IFC imports as render-only reference solids; DXF section views export
at true 1:1 mm; model space is Z-up right-handed mm, identical to IFC/DXF;
branch A_MVP_Scope_M2) and the Rules for Implementation Sessions. Then read
docs/08-architecture-spec.md and the approved plan
docs/implementation-plans-and-tasks/m2-adapters-round-trip.md — including ALL
task logs (T1–T7) and plan §8 (the T8 task definition).

⚠️ FIXTURE CHECK FIRST: `docs/test-fixtures/dxf/` (the author's 8 real AutoCAD
exports, gitignored) and `docs/test-fixtures/ifc/` (the Advance Steel export +
the T1/T2 artifacts, gitignored) must be present — T8's acceptance sentences
re-run the real-file probes. ✅ Confirmed available 2026-08-18, but VERIFY.
If missing → STOP and ask the author.

Task: implement the next ⬜ Pending task from the M2 tracker — **T8: M2
acceptance pass** (plan §8; mirrors M0 T11 / M1 T6):

- `src/commands/m2-acceptance.test.ts` — the four §A acceptance sentences:
  (1) the IFC round-trip identical-model sentence (from T3, restated as the
  durable milestone test incl. a bent-bar case and the undo behavior of
  import); (2) DXF import of a synthetic fixture (built to mimic real-file
  features: cm units, nested blocks, bulges) → expected `ReferenceDocument`;
  (3) DXF export exactness (the T7 test's first case — restate, don't
  reinvent); (4) the Q7 reference-solids sentence (foreign file → ONE
  reference document with solids + zero editable entities + one undo level;
  our own export → NO reference document — from T6.5's import-ifc tests).
- Rule-by-rule audit against the root README Review Checklist (verdict table
  in the task log) — incl. the undo-per-command row for the M2 commands.
- Docs sweep (assigned to T8 by every prior task log): §D.4 verdict (T1:
  web-ifc writes; fallback NOT executed) + §H.1 `referenceDocuments` + §B.3
  snap rows revisions are already in the spec — VERIFY they're dated and
  accurate; doc 09 library table (web-ifc usage verdict, dxf-parser adopted,
  DXF writer custom, DXF export writer custom); **root README session state**
  (deliberately not updated per task since T1 — T8 owns it: M2 ✅ COMPLETE
  summary + the For-AI-Sessions prompt refresh); plans index
  (docs/implementation-plans-and-tasks/README.md); scenario file
  docs/test-scenarios/m2-adapters-round-trip.md — every approved manual
  scenario through T7 is persisted (M2-S01…S12 — VERIFY completeness, rule 7).
- Bundle tripwire: defend shell **1,294.54 kB** (T7), dxf chunk 37.05 kB lazy
  (incl. the writer), web-ifc chunks lazy, no INEFFECTIVE_DYNAMIC_IMPORT.
- Task log + tracker row (commit `—` until the author commits).

Work on branch A_MVP_Scope_M2, one task at a time: pnpm lint + pnpm test +
pnpm build green → changes + manual test list → I review and commit.
Do NOT commit anything yourself.

Manual: a final full-app regression pass (the M2 scenario set: IFC round-trip
in the browser, DXF background tracing, foreign-IFC solids, section DXF export
measured in real CAD) — the milestone-closing smoke run.

---

## 📌 Closing procedure (Rule 9)

When the author approves T8:

1. Gates green ONCE (pnpm lint + test + build — no re-running after approval edits).
2. Task commit with the tracker cell `Commit: —` (a commit CANNOT contain its
   own hash — self-reference is mathematically impossible).
3. Follow-up commit `Tracker: record T8 hash (<hash>)` filling the hash in.
4. **NEVER amend** the task commit after the hash exists (typo fixes before
   the hash is recorded are the only allowed amendments).
5. Push `origin A_MVP_Scope_M2`; the NEXT milestone's session prompt (M3
   planning — NOT a task prompt; M3 has no approved plan yet) lands in the
   hash-commit too if the author asks for one.
6. **Hard stop:** the same git/sed/check cycle twice without converging →
   STOP, state the invariant, use the two-commit pattern.
