# ⚠️ TEMP session prompt — M2 T3 (IFC import adapter + round-trip probe)

> Point a fresh AI session at this file (or paste its content). **Delete this file once the T3 session has started** — the durable record is the M2 tracker. Created 2026-08-18 after M2 T2 (commit on branch `A_MVP_Scope_M2`).

---

I'm working on a browser-based reinforced concrete drawing app ("web-rebar").
Read C:\work\personal\projects\web-rebar\README.md first — it has session state
(M0 + M1 ✅ complete; M2 T1 ✅ 2026-08-18, T2 ✅ 2026-08-18, branch
A_MVP_Scope_M2) and the Rules for Implementation Sessions. Then read
docs/08-architecture-spec.md (especially §A revised, §C, §D.4 revised
2026-08-18, §E, §G.1, §N) and the approved plan
docs/implementation-plans-and-tasks/m2-adapters-round-trip.md — including the
T1 task log (the three Allplan exporter conventions + Q1 gate verdict) AND the
T2 task log, which records four findings T3 MUST consume (listed below).

Task: implement the next ⬜ Pending task from the M2 tracker — T3: IFC import
adapter + `importIfcModel` command + the round-trip identical-model probe
(plan §3): web-ifc read → walk IfcWallStandardCase + IfcReinforcingBar →
internal models; design intent from the Q2 psets (import prefers psets;
foreign files without them are OUT of M2 scope — skip with a reported count);
ids from GlobalId decompression; §N command dispatches per-entity add reducers
inside one command scope → exactly ONE undo level; the §A acceptance probe
headless: a model built through the §N commands (wall + bent bar at 25 mm
cover) → exportIfc → importIfcModel into a fresh store → identical model —
same entity ids, wall params and bar paths equal within 1e-6 mm, design
intent (coverDistance, hostElementId, steelGrade, diameter) exactly equal.
Project metadata and sections are excluded from "identical" (plan §Milestone
acceptance). Update the m1-acceptance.test.ts registry-completeness probe map
in the same change (importIfcModel mutates → it belongs in the mutating-commands
probe list with a one-undo-level exact-restore assertion).

Work on branch A_MVP_Scope_M2, one task at a time: pnpm lint + pnpm test +
pnpm build green → changes + manual test list → I review and commit.
Do NOT commit anything yourself.

Note: the T5/T6 DXF fixture hard gate is ✅ SATISFIED (8 real AutoCAD exports
in docs/test-fixtures/dxf/, gitignored) — no gate check needed for T3/T4.

## T2 findings T3 MUST consume (from the T2 task log — read it in full)

1. **Coordinate inverse.** Export maps model (Y-up mm) → IFC (Z-up mm) as
   `(x, y, z)model → (x, −z, y)ifc` (proper rotation, reflection-free).
   Import MUST apply the exact inverse `(x, z, −y)`. Wall export shape: local
   placement origin = (startPoint.x, −startPoint.z, baseElevation), X along
   the axis, Z up; body = length × thickness IfcRectangleProfileDef extruded
   +Z by height; the Axis/Curve2D rep is the reference line (placement +
   profile are authoritative — the Axis rep is a cross-check). Bars: swept
   disk directrix = the converted full centerline path incl. bending places.
2. **IFC4 naming.** IfcRelContainedInSpatialStructure's product list attribute
   is `RelatedElements` in IFC4 (IFC2X3's `RelatedObjects` was renamed);
   web-ifc's flattened lines follow IFC4 naming. IfcRelDefinesByProperties
   still uses `RelatedObjects`.
3. **The undo scope middleware is synchronous** (src/stores/undo-middleware.ts):
   the command scope closes when the thunk function RETURNS, so an async
   command that dispatches project reducers after an `await` escapes the scope
   and records one undo level PER REDUCER. importIfcModel must await web-ifc,
   so T3 must either make undoScopeMiddleware await promise-returning thunks
   before closing the scope (recommended — preserves the per-entity action log
   AND one undo level per import, Q4-a; this touches M1 machinery — flag it
   explicitly in the T3 task log) or collect the parsed delta into ONE reducer
   (loses the per-entity log). Prove it with a failing-then-passing
   undo-count test.
4. **Identity.** Internal ids round-trip through IfcRoot.GlobalId —
   `decompressIfcGuidToUuid` (src/io/ifc-guid.ts); the same id is duplicated
   in Tag and the pset `WebRebarId` property (belt-and-braces). Because the
   SAME UUIDs come back, imported bars' `hostElementId` just works — the
   acceptance's "same entity ids" holds by construction. Boilerplate
   (project/site/building/storey) and rel GUIDs are synthetic per-export —
   they carry no identity; do not try to map them back.

## Reuse / conventions

- `src/io/web-ifc-loader.ts`: `createIfcApi()` (isolated instance — tests,
  round-trip) vs `loadIfcApi()` (app singleton). The §N command layer runs
  headless in vitest (node build of web-ifc self-locates its WASM).
- Lazy-loading contract (Q1): the import mapping module will statically import
  web-ifc's IFC4 namespace (builder/reader pattern) — app code may only reach
  it via a dynamic import from the command (the exportIfc precedent in
  src/commands/export-ifc.ts). The build's INEFFECTIVE_DYNAMIC_IMPORT warning
  and a shell-bundle size jump past the 1,272 kB baseline are the tripwires.
  Tests may import the mapping module statically.
- Read-side narrowing pattern (flattened GetLine interfaces, lineIds,
  getFlattened, psetProps): copy from src/io/ifc-mapping.test.ts.
- web-ifc class-based API: IFC4 namespace constructors + WriteLine cascade on
  the write side (src/io/ifc-mapping.ts); GetLineIDsWithType + GetLine on the
  read side.
- Reopen/round-trip assertions always use a FRESH IfcAPI instance (own WASM
  heap) so tests prove file-level persistence, not in-memory reuse.
- Lint constraints that bit in T2: bigint literals (0n/1n) trip
  no-magic-numbers (use BigInt(0)/BigInt(2) ** …), .ts files max 400 non-blank
  non-comment lines, max-params 2 (options objects), prettier import order.
- Rule 8: the author may edit files in parallel; the task commit includes all
  working-tree changes. Manual test list ends the task report (rule 7).

## Definition of done for T3 (from the plan)

- importIfc mapping + importIfcModel §N command; non-wall/bar entities skipped
  with a reported count (foreign-file mapping stays M4 scope, Q2).
- The §A round-trip probe green: identical ids, geometry ≤ 1e-6 mm (T1 proved
  SPF doubles round-trip EXACTLY — assert `toBe`/`toEqual` where possible),
  intent exactly equal; a bent-bar case included.
- Exactly ONE undo level per import; undo restores the exact pre-import
  reference; redo re-applies.
- m1-acceptance registry probe map updated (importIfcModel in the mutating
  list); command-registry.test.ts list updated (15 commands).
- pnpm lint + pnpm test + pnpm build green; T3 task log entry + tracker row in
  docs/implementation-plans-and-tasks/m2-adapters-round-trip.md (mark commit
  `—`; the author records the hash after committing).
- Manual test list for the author (T4 wires the File menu; T3 itself is
  headless — the browser round-trip manual test is T4's).
