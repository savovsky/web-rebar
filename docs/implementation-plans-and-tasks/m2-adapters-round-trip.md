# M2 — Adapters Round-Trip (IFC + DXF): Plan & Task Tracker

> **Back to:** [Implementation Plans & Tasks](./README.md) · [Root README](../../README.md) · [Architecture Spec](../08-architecture-spec.md)
> **Plan approved:** ✅ **2026-08-10** — author approved Q1–Q6 exactly as recommended (the ⭐ options). **Author addition at approval — HARD GATE for T5/T6:** if no author-supplied real DXF files exist in `test-fixtures/dxf/` when an implementation session reaches T5, STOP execution and ask the author for them (5–6 AutoCAD-exported arch/formwork plans promised). **✅ SATISFIED 2026-08-18 — the author delivered 8 real AutoCAD exports; actual location: `docs/test-fixtures/dxf/`** (the gitignored `test-fixtures` pattern covers it; all gate references below mean this path).

---

## ▶️ Current State (read this first in a fresh session)

- **M2: ✅ PLAN APPROVED (2026-08-10)**; branch `A_MVP_Scope_M2`. M0 ✅ and M1 ✅ complete ([trackers](./README.md)). **T1 ✅** (web-ifc lazy integration + write-capability spike — Q1 gate PASSED incl. the author's Allplan 2022 check after 3 convention-fix iterations). T2 is next.
- **M2 scope (§A revised 2026-08-09):** (1) model wall+bar → export IFC → reload → identical model; (2) DXF import as 2D reference background linework (the doc-11 tracing workflow); (3) DXF export of a section view. **Explicitly out:** DXF→3D model mapping, DWG (stays a Deferred Topic).
- **Author dependency — HARD GATE for T5/T6 (author, added at approval):** M2's DXF tasks require **5–6 real-world AutoCAD-exported DXF files (architectural + formwork plans, author-provided)** dropped in `test-fixtures/dxf/` (gitignored — client confidentiality; tests that need them skip gracefully when absent). **✅ DELIVERED 2026-08-18 — 8 files (7× 2507_KOMO arch/formwork plans incl. a 3D-View export, 1× BE Sarafovo TD-FW) in `docs/test-fixtures/dxf/` (author's chosen location — the gitignored `test-fixtures` pattern matches at any depth).** **Implementation-session rule (prepend to every M2 session prompt): when a session reaches T5 (DXF import core) and no such files exist, STOP execution and explicitly ask the author for them — do not proceed on synthetic fixtures alone** (synthetic fixtures still cover unit logic, but the milestone's real-file risk probe — Q4 units/blocks — cannot pass without real files, and T6's tracing-workflow probe is meaningless without them).
- **Workflow (same as M0/M1):** implement one task → `pnpm lint` + `pnpm test` + `pnpm build` green → present changes + manual test list → **author reviews and commits (all working-tree changes, rule 8)** → next task.

## M2 Goal (Architecture Spec §A, revised 2026-08-09)

> **Model wall+bar → export IFC → reload → identical model. DXF: import 2D linework as a reference background (the doc-11 tracing workflow); export a section view to DXF.**
> **Risks probed:** IFC schema fit · web-ifc write capability (§D.4 documented fallback risk) · lossless round-trip · DXF units/blocks/real-file handling · reference-background storage (Layer Model door watch).

**Milestone acceptance:**

1. **IFC round-trip (headless):** a model built through the §N commands (wall + bent bar at 25 mm cover) → `exportIfc` → `importIfc` → the reloaded model is **identical** — same entity ids, wall params and bar paths equal within 1e-6 mm, design intent (coverDistance, hostElementId, steelGrade, diameter) exactly equal. Project metadata (timestamps, name) and sections are excluded from "identical" (IFC is interop, §C — `project.json` per §H is the native full-fidelity persistence and arrives with OPFS; sections are stored queries, not IFC content, in M2).
2. **DXF import:** a real architect DXF file imports as 2D reference background linework at true mm scale, renders in the 3D viewport plan, and a wall can be traced over it via endpoint/midpoint snapping.
3. **DXF export:** the active section view exports to DXF at true 1:1 mm — verified by exact-geometry headless assertions AND by the author opening the file in real CAD and measuring (Ø12 dot = 12 mm circle; wall outline = true thickness × height).

### Scope

| In scope | Explicitly out (and why) |
| --- | --- |
| IFC export + import of the M0/M1 model subset (walls, bars) incl. design-intent property sets (Q2) | Foreign-IFC import mapping (non-wall elements, missing intent psets → re-derivation — the door stays open, Q2; M4 scope) |
| web-ifc integration (lazy-loaded) + write-capability spike with the §D.4 custom-writer fallback gate (Q1) | IFC export of sections/annotations/layouts (M2 exports geometry + intent only) |
| DXF import → **reference background linework** (Q3 storage), units/$INSUNITS (Q4), block/insert explosion, bulge→arc — **⚠️ T5/T6 gated on author DXF fixtures** | **DXF→3D model mapping** (§A — DXF carries no 3D design intent, doc 07); TEXT/MTEXT/SPLINE/HATCH/DIMENSION entities (skip-and-report, Q4) |
| Background rendering in the 3D viewport + endpoint/midpoint snapping for tracing (doc-11 workflow probe) | Background linework in 2D section views; image/PDF underlay (deferred Sketch Underlay topic — door kept, see door check) |
| DXF export of the active §G.1 section view (Q5) — custom writer, true 1:1 mm | Sheet layouts/title blocks in DXF (deferred Drawing Layouts topic — export is model-space 1:1, not a sheet); DWG (Deferred Topic) |
| File menu in TopBar (the M1 T3 TopBar comment reserves it for M2+) | OPFS/`project.json` persistence (§H — separate milestone; M2 is session-state + file download/upload) |

### Door check (§N + deferred topics — root README planning rule)

- **Layer Model (deferred, before M4 — the explicit door watch):** resolved in **Q3**. The imported background lives in a new `referenceDocuments` collection that is deliberately NOT a layer: no freeze/lock/active-layer semantics, no storey binding, no per-entity classification, no compute-scoping decisions. Source DXF layer names are kept as inert string tags (information preservation only — zero semantics). The future Layer Model discussion can absorb reference documents as a special class OR keep them separate — both doors open. The only visibility control is a per-document show/hide flag that affects rendering only; doc 11's compute-scoping contract ("hidden entities are not recalculated") is untouched because reference linework feeds no computation (sections, meshes, validation never read it).
- **Sketch Underlay + Freehand-to-Rebar (deferred):** doc 11 names the same "work over a background" pattern. `ReferenceDocument.source` is a tagged union (`{ kind: 'dxf', ... }`) so an image/PDF underlay can become a second source kind later without restructuring — door widened, nothing built for it.
- **DWG Import (deferred):** untouched — DXF-only, exactly as the deferred topic prescribes.
- **Drawing Layouts & Title Blocks (deferred):** DXF export is model-space 1:1 mm with no sheet/paper-space concept — no layout decision taken.
- **Dimension & Annotation System (deferred, §M):** DXF export uses only layer names + linetypes + lineweights; no text/dimension entities — no annotation-model decision taken. `selectSectionPrimitives` stays the clean 2D substrate (M1 door note holds).
- **MCP / scripting / NL input (§N.2):** import/export run through the §N registry like everything else. Export commands are pure (no project mutation → record no undo level, same precedent as `setActiveSection`); import commands mutate → exactly ONE undo level per import (the T1 scope middleware gives per-command scoping for free). The M1 T6 registry-completeness probe in `m1-acceptance.test.ts` will fail the moment a new command registers — each command-adding task updates the probe map in the same commit (the tripwire working as designed).
- **§H persistence / cloud:** `referenceDocuments` lives in `ProjectModel` → it will persist when OPFS arrives. Only exploded primitives are stored (never the raw DXF text), keeping the document JSON-clean per §H.1. Large backgrounds make undo snapshots retain them once (structural sharing — unchanged docs are shared references across levels, the M1 T5 finding); no new mechanism.
- **F3 watch (M1, resolved as accept-at-scale/revisit M3/M4):** an import command dispatches one reducer per imported entity (IFC import) — the same sequential-produce cost class as F3's cascade. At M2 acceptance scale (one wall + one bar; one DXF document added in ONE reducer) this is a non-issue; noted so the M3/M4 revisit sees it.
- **BVBS / Multi-Country Catalogs / Parametric Blocks:** untouched.

### Open Questions (recommendations ⭐ — pending author approval)

| Q | Question | Options |
| --- | --- | --- |
| **Q1** | **web-ifc write capability vs the §D.4 custom-writer fallback.** §D.4 documents web-ifc write support as a known risk. M2's IFC acceptance is a *round-trip*, so the write side must be settled first, explicitly. | **(a) ⭐ RECOMMENDED — spike-first with a documented decision gate (T1).** T1 integrates web-ifc (lazy-loaded, dynamic import — its WASM is multi-MB and must not bloat the shell bundle) and writes a minimal IfcWallStandardCase + IfcReinforcingBar file with our property sets, then reads it back. **Gate criteria:** (i) all entities + properties survive web-ifc's own save/load; (ii) doubles survive within 1e-6 mm; (iii) the file opens in an external IFC viewer (author check). Pass → web-ifc writes (§D.4 decision stands as-is). Fail → **custom IFC-SPF writer in `src/io/` (TypeScript)** for our fixed entity subset — this executes the §D.4 documented fallback, it is not a new decision; the fallback sits in TS next to the adapter (§D.2 puts IFC I/O in TS; `core/` stays IFC-free per §C; STEP-SPF for a fixed template set is text formatting of the same class as the DXF writer doc 07 rates low-effort). Either way §D.4 gets a dated revision recording the verdict. (b) Custom writer from day one without spiking web-ifc — discards a maintained library untested, and we'd never know if the §D.4 risk was real. |
| **Q2** | **IFC property-set strategy for design intent (cover, hostElementId, steelGrade) vs re-derivation on import.** §C: IFC stores results, not intent — but OUR round-trip must restore intent. | **(a) ⭐ RECOMMENDED — custom property sets + results geometry; import prefers psets; re-derivation explicitly deferred.** Export writes standard results geometry (extruded wall, swept-disk bar) PLUS `Pset_WebRebar_Wall` / `Pset_WebRebar_ReinforcingBar` (`WebRebarId`, `HostElementId`, `CoverDistance`, `SteelGrade`) via `IfcPropertySingleValue`/`IfcPropertySet`. Internal ids round-trip through `IfcRoot.GlobalId` (the standard 22-char compressed-GUID encoding of our UUIDs — deterministic, reversible, proper IFC citizenship). Import restores intent from the psets; bars/elements WITHOUT our psets (foreign files) are **out of M2 scope** — the door for foreign-IFC import (geometric host containment + cover re-derivation or catalog defaults) stays open for M4. (b) Results-only IFC + geometric re-derivation on import — real import complexity (nearest-face cover math, containment tests) spent to support foreign files nobody has asked for yet, and it silently drops §C's intent-preservation principle for our own files. (c) Both now — M2 scope creep. |
| **Q3** | **Where imported DXF reference linework lives — WITHOUT preempting the deferred Layer Model.** | **(a) ⭐ RECOMMENDED — a new top-level `referenceDocuments` record in `ProjectModel`** (§H.1 gets a dated revision note): `ReferenceDocument { id, name, source: { kind:'dxf', fileName, insunits }, elevationMm, visible, primitives: ReferencePrimitive[] }` where primitives are plain 2D line/arc/circle/polyline objects already converted to model mm. One imported file = one document = one undoable command (`importReferenceDocument`), with `removeReferenceDocument` / `setReferenceDocumentVisibility` commands. **Recorded non-decisions (the Layer Model stays fully open):** no per-entity layers, no freeze/lock/active-layer, no storey binding, no discipline split, no compute scoping; the source DXF layer name is stored per primitive as an inert `sourceLayer?: string` tag (information preservation — a future Layer Model MAY group by it); `visible` is a document-level render flag only. (b) Session-only storage outside `ProjectModel` (§H.2-style) — maximally non-committal, but re-importing the architect's plan every session makes the doc-11 workflow probe meaningless and §H persistence would need a migration anyway. (c) Layers-lite now (named layers with on/off) — exactly the silent preemption the door watch forbids. |
| **Q4** | **DXF units/scale ($INSUNITS) and real-world block/insert handling.** | **(a) ⭐ RECOMMENDED — honor `$INSUNITS` with a conversion table to mm** (4=mm, 5=cm, 6=m, 1=in, 2=ft, …); unitless (0) or missing → **assume mm + status-bar warning + a units-override choice in the import flow** (real architect files are sloppy; silent mis-scaling is the actual tech wall §A wants found). **Blocks/inserts: explode at import** — BLOCK table + INSERT resolution (translation/rotation/scale, bounded recursion for nesting, cycle guard) into world-space primitives, because the background is a tracing reference, not a CAD model to edit. **Entities kept:** LINE, LWPOLYLINE, POLYLINE (incl. **bulge → arc conversion** — ubiquitous in real files), ARC, CIRCLE. **Skipped with a reported count** (import summary in the status bar): TEXT/MTEXT, SPLINE, ELLIPSE, HATCH, SOLID, DIMENSION, 3DFACE — nothing silently lost. (b) Assume mm always — breaks on the first cm/m file; misses the milestone's risk-probing point. (c) Preserve block structure — CAD fidelity we don't need; doubles the internal model for a background. |
| **Q5** | **DXF export scale accuracy.** The section view must measure true in real CAD (§I.3's scale-accuracy requirement, here for DXF). | **(a) ⭐ RECOMMENDED — true 1:1 mm model-space export:** section (u,v) coordinates become DXF (x,y) directly (no flip — v is up, y is up), `$INSUNITS=4` (mm) in the HEADER, entities on named layers (`WEBREBAR-CONCRETE`, `WEBREBAR-REBAR`, `WEBREBAR-BACKGROUND`) with a DASHED linetype for §G.2.3 background and layer lineweights mapped from the pen-table seed (§M.4 — a mm plot-weight seed joins the px screen seed in `src/data/appearance.ts`); cut-bar dots as **true-diameter CIRCLE entities** (§M.4 true relative diameters; filled rendering is cosmetic and deferred). **Verification:** exact-coordinate string/parse assertions headlessly (outline coords == `selectSectionPrimitives` output, circle radius == Ø/2), a reimport-through-our-own-importer geometry-fidelity probe, and the author measuring the file in real CAD (manual test). Scale-on-sheet stays with the consumer's CAD paper space — the Drawing Layouts topic is not touched. (b) Export pre-scaled to a plot scale (1:50) — sheet-ready but wrong for the real delivery convention (structural DXF exchanges are 1:1 model space) and conflates the deferred layouts topic into M2. |
| **Q6** | **DXF import parser: `dxf-parser` library vs custom.** Doc 07 rates both feasible ("dxf-parser or custom… can write a parser in a day"); doc 09 already lists dxf-parser for this milestone. | **(a) ⭐ RECOMMENDED — adopt `dxf-parser` (npm, MIT)** behind our own pure mapping layer: the library produces a neutral entity JSON; ALL domain decisions (units, bulge→arc, block explosion, entity filtering, layer tagging) live in OUR pure, unit-tested mapping code, so the library is swappable and the risky logic is ours. **Documented fallback:** if real files (the author's fixtures) break dxf-parser, a minimal custom reader for the Q4 entity subset replaces exactly the parse step — same class of low-risk text work as the export writer. Verdict recorded in doc 09. (b) Custom parser from day one — throws away a mature parser for the format's boring 90% (group codes, tables) to gain control we already have in the mapping layer. |

---

## Approved Plan (summary — sections become tasks below)

### 1. web-ifc integration + write-capability spike (Q1)

- Add `web-ifc`; **lazy-loaded** via dynamic import on first IFC action (bundle/asset sizes reported in the task log — M0's WASM-bundle-size probe pattern).
- Probe (headless, `src/io/ifc-write-spike.test.ts`): build IfcProject → IfcSite → IfcBuilding → IfcBuildingStorey → one IfcWallStandardCase (extruded rectangle) + one IfcReinforcingBar (swept disk over a 3-point polyline) + the Q2 property sets → save → reopen with web-ifc → verify entities, psets, and double precision against the gate criteria.
- **Decision gate outcome recorded in the task log + §D.4 revision.** If failed: the fallback custom TS IFC-SPF writer becomes part of T2 (same task boundary, escalated to the author first).

### 2. IFC export adapter (`src/io/ifc-adapter.ts` + `src/io/ifc-mapping.ts`)

- Pure mapping module (rule 2 — no React): `ProjectModel` → IFC entity graph. IfcProject with mm SI units; one IfcSite/IfcBuilding/IfcBuildingStorey boilerplate (storey assignment arrives M4); walls → IfcWallStandardCase + IfcExtrudedAreaSolid (thickness × height) placed along the wall axis at baseElevation; bars → IfcReinforcingBar + IfcSweptDiskSolid (Radius = Ø/2, Directrix = polyline of the full path incl. bending places); containment via IfcRelContainedInSpatialStructure; **design-intent psets per Q2**; GlobalId = compressed UUID.
- §N command `exportIfc({ }) → { bytes, fileName }` (pure, no mutation, no undo level; async thunk — commands are thunks). Headless entity-graph tests.

### 3. IFC import adapter + the round-trip probe

- `importIfc(buffer) → { model delta }`: web-ifc read → walk IfcWallStandardCase + IfcReinforcingBar → internal models; intent from psets (Q2); ids from GlobalId decompression. Non-wall/bar entities: skip with a reported count (foreign-file mapping is M4 scope, Q2).
- §N command `importIfcModel({ buffer })` — dispatches per-entity add reducers inside one command scope → ONE undo level.
- **The §A acceptance probe (headless):** command-built model (wall + bent bar at 25 mm cover) → export → import into a fresh store → identical-model assertion per the acceptance definition (ids equal; geometry ≤ 1e-6 mm; intent exactly equal).
- `m1-acceptance.test.ts` registry probe map updated in the same commit.

### 4. File menu + IFC UI wiring

- TopBar File menu (Radix, reserved since M1 T3): Import IFC… / Export IFC. Open via `<input type=file>`, save via blob-anchor download; status-bar hints + skip-count summaries. Components stay dumb (rule 2): they read/write files and dispatch; parsing/mapping lives in `src/io/`.
- Lazy-load web-ifc on first menu use (spinner/status hint while loading).
- Manual: the browser round-trip + author opens the exported .ifc in an external viewer (gate criterion iii).

### 5. DXF import core + ReferenceDocument model (Q3/Q4/Q6)

- **⚠️ HARD GATE — ✅ SATISFIED 2026-08-18:** the author's 8 real AutoCAD exports are in `docs/test-fixtures/dxf/` (kept: check they are still present FIRST — tests skip gracefully when absent, and the real-file risk probes must not run on synthetic fixtures alone).
- Data model first (rule 4): `src/data/models/reference-documents.ts` (`ReferenceDocument`, `ReferencePrimitive` — line/arc/circle/polyline, model mm, inert `sourceLayer` tag) + `project.ts` extension + §H.1 revision note.
- `src/io/dxf-adapter.ts` — parse (`dxf-parser`, Q6) + **our pure mapping layer**: $INSUNITS → mm factor (Q4 table + override param), entity filter with skip counts, bulge → arc, BLOCK/INSERT explosion (bounded recursion + cycle guard).
- §N commands: `importReferenceDocument` (one undo level), `removeReferenceDocument`, `setReferenceDocumentVisibility`. Registry probe updated.
- Unit tests: units table (mm/cm/m/in/unitless), bulge math vs known arcs, block nesting + cycle guard, skip-count reporting, command undo/redo exact-restore.

### 6. Background rendering + tracing snaps (the doc-11 workflow probe)

- **⚠️ Same hard gate as T5** — the author's real files are the probe's subject.
- `ReferenceLayer` in Viewport3D: line segments rendered at the document's `elevationMm` (default 0, plan ground), muted token color (tokens.css, rule 6), per-document visibility; **excluded from `pickPointerWinner`** (backgrounds are never selected/moved — reference, not model).
- Snapping (§B.3 — Endpoint/Midpoint rows get their first real target): placement draft point resolution (Place Wall / Place Bar) considers reference-linework endpoints/midpoints within snap tolerance, with the existing snap-marker feedback; Shift still disables (§B.3).
- "Backgrounds" section in the Building panel tab (§B.2 reserves this panel): document list with visibility toggle + remove (dispatches the T5 commands).
- File menu: Import DXF… (with the Q4 units-override choice + skip-count summary).
- §B.3 spec revision note (reference endpoint/midpoint snap targets).
- Manual (the workflow probe): author imports a real architect DXF → sees it at true scale on the plan → traces a wall over it via snaps → hides/removes the background.

### 7. DXF export of the active section view (Q5)

- Custom writer (doc 07/09: no library) `src/io/dxf-adapter.ts` `exportDxfSection`: HEADER ($ACADVER AC1015 — R2000: LWPOLYLINE + lineweight support — and `$INSUNITS=4`), TABLES (DASHED linetype; the three Q5 layers with mm lineweights from the new plot-weight seed in `src/data/appearance.ts`), ENTITIES (closed LWPOLYLINE concrete outlines; CIRCLE cut-bar dots at true Ø/2; dashed LINE background), EOF.
- §N command `exportSectionDxf({ sectionId }) → { text, fileName }` reading `selectSectionPrimitives` (pure, no undo level); File menu entry (enabled when a section is active).
- Headless: exact-coordinate assertions (Q5), layer/linetype/INSUNITS assertions, reimport-fidelity probe; registry probe updated.
- Manual: author opens the exported DXF in real CAD and measures (wall outline = thickness × height; Ø12 dot = 12 mm; background dashed).

### 8. M2 acceptance pass (mirrors M0 T11 / M1 T6)

- `src/commands/m2-acceptance.test.ts` — the three §A acceptance sentences: (1) the IFC round-trip identical-model sentence (from T3, restated as the durable milestone test incl. a bent-bar case and the undo behavior of import); (2) DXF import of a synthetic fixture (built to mimic real-file features: cm units, nested blocks, bulges) → expected `ReferenceDocument`; (3) DXF export exactness.
- Rule-by-rule audit against the root README Review Checklist (verdict table in the task log) — incl. the undo-per-command row for the new commands.
- Docs sweep: §D.4 verdict + §H.1 `referenceDocuments` + §B.3 snap rows revisions (dated); doc 09 library table (web-ifc usage verdict, dxf-parser adopted, DXF writer custom); root README session state; plans index; scenario file `docs/test-scenarios/m2-adapters-round-trip.md` (rule 7).

---

## Task Tracker

| # | Task | Verify by | State | Commit |
| --- | --- | --- | --- | --- |
| T1 | web-ifc integration (lazy-loaded) + write-capability spike (Q1) + decision gate | spike test green against gate criteria; verdict + §D.4 revision recorded | ✅ Done | — |
| T2 | IFC export adapter: mapping module + `exportIfc` command (Q2 psets, GlobalId ids) | headless entity-graph tests; registry probe updated | ⬜ Pending | — |
| T3 | IFC import adapter + `importIfcModel` command + round-trip identical-model probe | the §A round-trip test green (ids, 1e-6 mm, intent) | ⬜ Pending | — |
| T4 | File menu + IFC import/export UI wiring (lazy web-ifc, downloads, status hints) | manual: browser round-trip; author opens .ifc in external viewer | ⬜ Pending | — |
| T5 | ⚠️ **Fixture gate — check first.** DXF import core: dxf-parser + mapping layer (units, bulge, blocks), ReferenceDocument model (Q3), 3 commands | unit tests: units table, bulge, block explosion, undo | ⬜ Pending | — |
| T6 | ⚠️ **Fixture gate — check first.** Background rendering + endpoint/midpoint tracing snaps + Backgrounds panel section + Import DXF menu | manual: real-file import at true scale; wall traced over it | ⬜ Pending | — |
| T7 | DXF export of section view: custom writer + `exportSectionDxf` command (Q5) | exact-coordinate headless tests; author measures file in real CAD | ⬜ Pending | — |
| T8 | M2 acceptance pass: `m2-acceptance.test.ts` + checklist audit + spec/docs/scenarios sweep | verdict table green; lint/test/build green | ⬜ Pending | — |

---

## Task Log

### T1 — web-ifc lazy integration + write-capability spike (Q1 decision gate) ✅ Done (2026-08-18)

**Built:**

- `web-ifc@0.0.77` added as a runtime dependency.
- `src/io/web-ifc-loader.ts` — lazy integration: dynamic `import('web-ifc')` on first use. Browser: the WASM is a Vite `?url` content-hashed asset handed to web-ifc through a custom `locateFile` handler (`SetWasmPath` only takes a directory prefix and cannot express a hashed file name). Node/vitest: the package's node build self-locates its WASM from disk. `createIfcApi()` = isolated instance (own WASM heap — tests, future round-trip), `loadIfcApi()` = app-wide singleton.
- `src/io/ifc-write-spike.ts` — param-driven builder for the minimal IFC4 file: IfcProject → IfcSite → IfcBuilding → IfcBuildingStorey boilerplate, mm SI units, one IfcWallStandardCase (length × thickness rectangle extruded +Z by height, placed at the axis start with X along the axis), one IfcReinforcingBar (IfcSweptDiskSolid radius Ø/2 over the full polyline directrix incl. bending places), aggregation + containment rels, and the Q2 intent psets (`Pset_WebRebar_Wall` / `Pset_WebRebar_ReinforcingBar` with `WebRebarId`, `HostElementId`, `CoverDistance`, `SteelGrade`). web-ifc's WriteLine nested-cascade emits the whole graph from the top-level rels.
- `src/io/ifc-write-spike.test.ts` — the decision-gate probe (5 tests). The reopen side always uses a FRESH IfcAPI instance, so the probe proves file-level persistence, not in-memory reuse.

**Gate verdict: ✅ PASS** (criteria i + ii headless; iii = author manual check)

1. **(i) entities + properties survive web-ifc's own save/load** — asserted: schema IFC4, exactly 1 wall / 1 bar / 2 psets / 2 rel-defines / 1 containment; wall tag, bar steel grade, both psets with exact values (incl. `CoverDistance` 25, `HostElementId`), rel → bar linkage.
2. **(ii) doubles survive within 1e-6 mm** — in fact EXACT: a separate probe round-tripped π·36, 1/3 and 123456789.123456789 with zero diff (17-significant-digit SPF output). All spike geometry asserted with `toBe` equality.
3. **(iii) external IFC viewer** — artifact at `docs/test-fixtures/ifc/m2-t1-spike.ifc` (3.8 kB); author opens it in a real viewer (manual test below).

**§D.4 revised 2026-08-18** — verdict recorded; the fallback is refined to a custom **TypeScript** IFC-SPF writer in `src/io/` (per approved plan Q1; §D.2 puts IFC I/O in TS, `core/` stays IFC-free per §C) and is NOT executed.

**Asset/bundle sizes (the M0 WASM-probe pattern):** `web-ifc-api.js` = 3,538 kB raw / 391 kB gzip and `web-ifc.wasm` = 1,304 kB raw / 483 kB gzip — both verified via a scratch-entry build to be **lazy-only** (separate chunk + hashed asset; the shell bundle is unchanged at 1,272 kB; the >500 kB chunk warning pre-exists M2 — three.js/R3F). The spike IFC file itself is 3.8 kB.

**Decisions taken in-task (no plan deviations):**

- **Schema IFC4** for the spike file (the plan did not fix a schema; IFC4 is the current buildingSMART standard and Allplan 2022 reads it). T2 confirms the final export schema against the author's criterion-iii viewer check.
- web-ifc's **class-based write API** (IFC4 namespace constructors + WriteLine cascade) over raw line objects — typed, and the cascade keeps the whole graph in one write call. T2's mapping module inherits this pattern.
- Root README session state intentionally NOT updated per task — the plan assigns the README/docs sweep to T8.

**Manual test list (author):**

1. Open `docs/test-fixtures/ifc/m2-t1-spike.ifc` in an external IFC viewer (Allplan 2022 / BIMvision / Solibri): expect one 4000 × 300 × 2800 mm wall starting at (1000, 500, 0) and one Ø12 two-segment bar (B500B), plus the two `Pset_WebRebar_*` property sets if the viewer shows property data. File must import without errors — this is gate criterion (iii).
2. Nothing else is user-visible in T1 (no UI wiring — that is T4).

**Iteration 1 (2026-08-18, author criterion-iii check in Allplan 2022):** the bar imported; the wall FAILED — `IFCWALLSTANDARDCASE creation failed: Building material layer set usage failed!` (Allplan derives wall material/thickness from the material layer set and rejects IfcWallStandardCase without one). **Fix:** the wall now carries the full `IfcMaterial('Concrete') → IfcMaterialLayer(300) → IfcMaterialLayerSet → IfcMaterialLayerSetUsage(.AXIS2., .POSITIVE., offset −t/2 — centers the layer on the wall's reference plane) → IfcRelAssociatesMaterial` chain; headless assertions extended (usage + rel counts, layer thickness == wall thickness, rel → wall linkage). Artifact regenerated — author re-check pending. **Recorded for T2:** the export adapter must emit a material layer set usage for every IfcWallStandardCase (foreign-tool interop is stricter than the IFC schema's own cardinality — exactly the class of finding this spike exists for).

**Iteration 2 (2026-08-18, author Allplan re-check):** material error gone; next Allplan requirement surfaced — `IFCWALLSTANDARDCASE creation failed: No axis shape representation available!` (the bar again imported fine — the L-shaped solid the author saw IS the two-segment bar). **Fix:** the wall now carries TWO shape representations per the IfcWallStandardCase convention — `'Axis'`/`'Curve2D'` (IfcPolyline of the reference line, local (0,0,0) → (length,0,0)) plus the existing `'Body'`/`'SweptSolid'`; headless assertions extended (both identifiers present, axis polyline endpoints, Body found by identifier not index). Artifact regenerated — author re-check pending. **Recorded for T2:** every exported wall needs the Axis representation alongside Body (same lesson class as iteration 1: exporter conventions, not schema minimums).

**Iteration 4 / FINAL (2026-08-18, author Allplan re-check):** the iteration-3 fixes kept the import fully successful and the bare `edmiImportStepFile (11108)` line persists with NO TraceInfo, NO failing entity, ALL objects created, zero ignored/defective. **Verdict: criterion (iii) ✅ PASSED — the file opens and imports completely in Allplan 2022; the residual line is accepted as a non-blocking Allplan STEP-reader notice** (it appears in the import modal even when nothing failed; likely Allplan boilerplate for any file not produced by a certified exporter — optional confirmation: the author's own Advance-Steel IFC2X3 fixture would show whether the line appears for every import). **Q1 DECISION GATE: ✅ PASS on all three criteria — web-ifc writes our IFC files (§D.4 decision stands; the custom-writer fallback is NOT executed).**

**Iteration 3 (2026-08-18, author Allplan re-check):** ✅ **both entities import — Wall: 1, Reinforcement: 1, Elements ignored: 0, no defective elements; geometry confirmed visually** (4 m wall + L-shaped Ø12 bar inside, vertical leg at the far end). One residual line remained: the generic `edmiImportStepFile (11108) Error/warning during STEP File read operation` with NO TraceInfo and no failing entity. Two convention mismatches found and fixed headlessly: (a) web-ifc's default `FILE_DESCRIPTION` is the **IFC2X3** MVD name `ViewDefinition [CoordinationView]` even for IFC4 files (hardcoded default in `CreateModel`) — overridable via `CreateModel({ description })`, now `ViewDefinition [ReferenceView]`; (b) the `'Axis'`/`'Curve2D'` polyline carried 3D points — now genuine 2D points per the Curve2D convention. Artifact regenerated; author re-check pending. **Recorded for T2:** the export adapter must pass `description: ['ViewDefinition [ReferenceView]']` for IFC4 (or choose IFC2X3, where web-ifc's default header is correct — schema decision recorded at T2 with this probe's evidence: the author's real-file ecosystem fixture is IFC2X3). If the bare 11108 line persists after these fixes with all objects created, it is accepted as a non-blocking reader notice and documented as such.

**Green:** `pnpm lint` ✅ · `pnpm test` ✅ 196 tests / 26 files (191 → +5) · `pnpm build` ✅
