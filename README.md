# Rebar Web App — Project Documentation

> **Goal:** A fast, browser-based tool for 3D reinforced concrete formwork and reinforcement plan creation.  
> **Target market:** Structural engineering offices that find Allplan/Revit/Tekla too heavy and expensive.  
> **Author:** Experienced React developer (10y) + former Allplan power user (10y).

---

## Session State

> **Last session:** 2026-08-09 — M0 implementation on branch `A_MVP_Scope_M0`: T1 Rust/WASM `core/` crate + bridge round-trip (windows-gnu toolchain, wasm-pack 0.15); T2 data models + DIN/EC2 steel catalog seed; T3 `generate_bar_mesh` (swept cylinder, Float32/Uint32 typed arrays) + R3F smoke scene (visual confirmed); T4 RTK store (project-slice = ProjectModel, ui-slice + draft/selection state, typed hooks, Provider wired); T5 §N command layer (6 command thunks + registry + `CommandError`) + vitest (23 headless tests); T6 §B.2 app shell (top bar, tool palette with shortcuts + sticky mode, Building/Properties tabs, status bar) + doc 10 token system live (`tokens.css` → Tailwind v4 `@theme`, dark default); T7 Viewport3D (R3F canvas, §B.6 mouse mapping, token-driven grid, live status-bar coordinates) + Place Wall tool (chained click-click placement, Esc exits → `placeWall`, crosshair snap markers + translucent draft preview); T8 Place Bar tool (click a wall face → chained clicks build ONE bar with bending places — `placeBar` + `extendBar`, cover/diameter from the DIN/EC2 catalog seed, on-face grid snapping, cover kept from ALL wall faces — edges/start/end included, bends rendered with the DIN/EC2 mandrel radius per diameter (parallel-transported ring frames — no surface twist), WASM bar meshes visible through §L.2-transparent concrete); T9 section intersection + §G.1 Tier 1 sectioning orchestration (headless): Rust `plane_polyline_intersection` (0..n crossings per bar, on-plane vertices counted once) + `src/engine/sectioning.ts` — parametric wall outline at the cut plane (chord × height, not a mesh slice), cut-bar dots with true diameters (§M.4), convention-based background within viewDepth (§G.2.3), memoized `selectSectionPrimitives` selector — 83 vitest + 19 cargo tests green; T10 Section Cut tool (S — drag the line across an element, third click sets view depth/look direction, §B.6 single-shot auto-return) + resizable dockable SectionView panel (§B.2 bottom-right, opens at ¼ viewport): Canvas2D render of `selectSectionPrimitives` with a pure engine auto-fit transform (mm→px, Y-flip), dashed convention-based background, cut-bar dots at true relative diameters (§M.4), ink from design tokens + domain pen-table seed; sections show in 3D as interactive wireframe volumes (move body, stretch corner handles → `reshapeSection` command recomputes plane/depth/targets) — 127 vitest green; T11 acceptance pass against the root README review checklist — every rule verified ✅ across T1–T10 (verdict table in the M0 tracker), the §A acceptance sentence captured as a headless command-layer test (`m0-acceptance.test.ts`), findings F1/F2 report-only — **M0 ✅ COMPLETE** (128 vitest + 19 cargo green). **M1 T1 (branch `A_MVP_Scope_M1`):** undo core per §E/Q1-a/Q2-a — `undo-slice` (past/future frozen-reference snapshots, 30-level cap, session-only), RTK listener middleware recording pre-action project-state snapshots (command-scope middleware collapses cascades → one undo level per command, Q4-a), `restoreProjectSnapshot` reducer, `undo`/`redo` §N commands (registry now 10) — 140 vitest green; **M1 T2:** edit commands per §E revised host-follow — `moveElement` (`translateElement` for the wall + explicit per-bar `translateBar` cascade → one undo level restores wall+bars exactly), `deleteSection` (clears `activeSectionId` when the 2D panel showed it) — registry now 12; headless §A dependency-graph probe (`m1-reactivity.test.ts`): memoized `selectSectionPrimitives` re-derives after every edit class (move → outline follows the wall, dot keeps its 31 mm cover offset; move fully off-plane → outline/dot set empties; `deleteElement` → section drops the wall; `deleteBar` → dot gone) — 154 vitest green; **M1 T3 ✅:** edit UI entry points — `deleteSelection` command (single Delete entry point: explicit element/bar selection first, then the ACTIVE section, else status hint), Delete/Backspace + Ctrl+Z / Ctrl+Shift+Z keybindings in `use-tool-shortcuts` (same `isEditableTarget` guard; Delete inert mid-draft), Edit menu in TopBar (Radix DropdownMenu: Undo/Redo/Delete with shortcut labels + disabled states, tokens-only), undo scope middleware now joins nested command thunks into the outer scope (one undo level per composite command); review additions: hover picking (`hover-target.ts` transient store + `pickPointerWinner` shared by hover AND click — bar > wall > section volume, §B.5 revised; bars clickable through concrete AND section wireframes, `--hover` token) — 167 vitest green; scenario file `m1-edit-and-reactivity.md` started (M1-S01…S09); **M1 T4 ✅:** Move tool (M) — first §B.6 Modify-category tool (Q3-b): ToolId/shortcut/toolbar icon, live-offset drag (decided in task — the real wall + hosted bar meshes render at the transient offset, snap back on Esc; offset in a hover-target-style module store, §E), move-target picking reuses pickPointerWinner ("highlighted = what will move": wall winner → wall+bars highlight and move together; bar winner → bar alone highlights and a drag from it does NOTHING — bar-relative moves are M3 scope; §B.5 Move-hover row), grid snap on the delta (Shift disables), Esc/tool-switch cancel, click-vs-drag threshold, `commitElementDrag` → `moveElement` (host-follow, one undo level), single-shot auto-return (sticky locks); review fixes: "highlighted = what will move" picking + §G.1 revised — section content bounded by the drawn cut line segment (outlines/dots/background clipped at the line ends, matching the 3D wireframe volume; fixes the author's two-wall sideways-move probe); scenarios M1-S10…S16 persisted — 181 vitest green; **M1 T5 ✅:** performance probes (§A risks, headless) — `reference-project.ts` fixture (50 walls 5×10 grid × 20 L-bars = 1,000 bars + 5 column sections, built entirely through §N commands with the Place Bar tool's placement math; reusable by T6), `performance-probes.ts` (`createBenchmarkStore` — production middleware set; the dev-only RTK serializable/immutable invariant checks cost ~170 ms/dispatch at reference scale and are OFF in production builds; `measureRetainedBytes` — identity-deduped retained-graph walk with documented V8 estimates), `m1-performance.test.ts` (3 tests, medians over 12 runs after 3 warm-ups — regression tripwires) — **§5 full-recompute probe PASSES:** open-section recompute + 20 changed-bar meshes = 3.51 ms median (max 5.65) vs the 16 ms budget, all-5-sections bound 9.28 ms; **undo memory Q2-a CONFIRMED:** mean 8.3 KiB/level (max 14.5) vs the §E 5–10 MiB/level estimate (~600–1,200× under), whole app state + 30-level history < 1 MiB at reference scale; **F3 ESCALATED (author decision pending):** `moveElement` dispatch = 37 ms median at reference scale (20 sequential per-bar Immer produces, each O(record size)) — 100 ms regression tripwire asserted, the 16 ms budget NOT weakened; batch-cascade-into-one-produce is the candidate fix (touches T2's explicit-per-bar design) — 184 vitest green; **doc 11** (author's reinforcement authoring workflow: imported DXF/IFC backgrounds, element-by-element / floor-by-floor detailing, layer focus isolation = compute AND render scoping) added, Layer Model deferred topic cross-referenced; **M1 T6 ✅:** milestone acceptance pass — `src/commands/m1-acceptance.test.ts` (7 tests: the §A sentence end-to-end through the §N commands — place wall → two bars → cut+open section → moveElement → wall AND hosted bars update (host-follow) + the open 2D view re-derives → ONE undo restores the exact pre-move reference → redo re-applies; the same sentence at the T5 reference scale; the 30-level cap; a registry-completeness probe proving every M0+M1 command undoable — a future command fails the test until its undo behavior is decided), rule-by-rule checklist audit green on every row INCLUDING the undo-per-command row that was N/A in M0 (verdict table in the M1 tracker), scenario M1-S17 persisted; **F3 RESOLVED (author decision): (b) accepted at M1 scale + (c) revisit with the M3/M4 edit-workflow scope — the 100 ms tripwire stays armed** — **M1 ✅ COMPLETE** (191 vitest green)
> **Tooling (2026-08-08):** ESLint/Prettier stack adopted from doxeek — type-checked `typescript-eslint`, custom ruleset (max-params 2 → options objects, naming conventions, complexity limits); Prettier options live in `.prettierrc.json` (shared CLI + IDE), enforced via the `prettier/prettier` lint rule; `pnpm lint` and `pnpm build` both clean
> **Current phase:** **M1 ✅ complete** (2026-08-09, branch `A_MVP_Scope_M1`) — [m1-edit-and-reactivity.md](./docs/implementation-plans-and-tasks/m1-edit-and-reactivity.md): Q1 listener-middleware undo recording, Q2 frozen-reference snapshots, Q3 dedicated Move tool (M), Q4 one undo level per command; **§E revised 2026-08-09 to host-follow** (move/copy element → hosted bars follow in the same command). M0 ✅ complete (T1–T11, 2026-08-09); **M1 ✅ complete (T1–T6, 2026-08-09 — undo/redo per §E with Q1-a listener-middleware recording + Q2-a frozen-reference snapshots, host-follow move per §E revised, Move tool, performance probes, acceptance pass; F3 resolved: accepted at M1 scale, revisit at M3/M4)**. **§A revised 2026-08-09: M2 scope widened from IFC-only to IFC + DXF adapters (author decision — find DXF tech walls early in the POC).** Task tracker: [docs/implementation-plans-and-tasks/](./docs/implementation-plans-and-tasks/README.md)
> **Next session:** **M2 planning (Architecture Spec §A — Adapters Round-Trip, revised 2026-08-09 from IFC-only to IFC + DXF):** model wall+bar → export IFC → reload → identical model; PLUS DXF import as 2D reference background linework (the doc-11 tracing workflow) + DXF export of a section view. Explicitly out: DXF→3D model mapping, DWG. Key open question: where imported reference linework lives WITHOUT preempting the deferred Layer Model topic. A new milestone plan file, author-approved before coding (same workflow as M0/M1: review the Deferred Topics table + §N before planning) — ready-made session prompt in "For AI Sessions" below. M1 ✅ complete (2026-08-09, T1–T6; F3 resolved — accepted at M1 scale).

**Where we left off:** 14 architectural topics (A–N) are decided and locked. Both §G.2 open questions are **resolved** (2026-07-29). The **[Architecture Spec](./docs/08-architecture-spec.md)** captures every decision. The project has **M0 and M1 behind it** — the stack below is proven end to end:

**Repository:** `git@github.com:savovsky/web-rebar.git`

| What | Details |
| ------ | --------- |
| **Build** | Vite 8.2 + TypeScript 6.0 — `pnpm dev` / `pnpm build` |
| **UI** | React 19.2 + Tailwind v4 + Radix primitives |
| **State** | Redux Toolkit 2.12 (thunks = §N command layer) |
| **3D** | Three.js 0.185 + React Three Fiber 9.7 + Drei 10.7 |
| **PDF** | jsPDF 4.2 |
| **Structure** | `src/stores/` (project + ui + undo slices, typed hooks), `src/engine/` (WASM bridge + placement/sectioning/section-cut/transform math), `src/io/` (stubs), `src/commands/` (13 §N commands + registry), `src/ui/` (shell, toolbar, viewport, section-view, panels), `src/data/` (models + DIN/EC2 catalog seed + domain appearance) |

M0 (One Wall, One Bar) is **✅ complete** — all milestone risks probed: WASM bundle is 34.9 kB raw / 15.6 kB gzip, the §G.1 Tier 1 section algorithm is correct (dot at u = 31 mm for Ø12 @ 25 mm cover), Rust↔TS data passing runs on flat typed arrays end to end.

### Tool Palette Design

> **✅ Locked 2026-07-29** — canonical definition: [Architecture Spec §B.6](./docs/08-architecture-spec.md#b--user-interaction-model). Do not duplicate the tables here; update the spec.

Summary: single vertical toolbar (left edge of viewport). Figma-style auto-return to Select after single-use tools; double-click a tool to lock it (sticky mode). Keyboard shortcuts are user-editable (JSON config, in-app editor post-M0). Status bar shows active tool and snap state.

**M0 tool set:** Select (V), Place Wall (W), Place Bar (B), Section Cut (S), Pan (H), Orbit (right/middle-drag, scroll = zoom).

---

## Quick Start (for AI sessions)

**Read this first if you're an AI assistant helping with this project.**

1. Start with **[Architecture Spec](./docs/08-architecture-spec.md)** — **THIS IS THE CURRENT STATE.** All locked decisions.
2. Then read **[Project Vision](./docs/01-project-vision.md)** — what we're building and why
3. For domain knowledge: **[Reinforcement Data Model](./docs/04-reinforcement-data-model.md)** and **[Module Architecture](./docs/05-module-architecture.md)**
4. For research data: **[Allplan Analysis](./docs/02-allplan-analysis.md)**, **[Reference Data](./docs/06-reference-data.md)**, **[Browser Feasibility](./docs/07-browser-feasibility.md)**
5. For tech stack: **[Tech Stack](./docs/03-tech-stack.md)** and **[Tech Libraries](./docs/09-tech-libraries.md)** (all chosen dependencies)

---

## Document Map

```text
README.md                              ← YOU ARE HERE — session state & project overview
├── docs/
│   ├── 08-architecture-spec.md        ← 🔴 CURRENT — all locked architecture decisions
│   ├── 01-project-vision.md           ← The idea, scope, target users, must-have features
│   ├── 02-allplan-analysis.md         ← Findings from analyzing Allplan 2022 installation
│   ├── 03-tech-stack.md               ← Recommended technologies & hardware requirements
│   ├── 04-reinforcement-data-model.md ← Extracted from NemReinforcement.dll (212 types)
│   ├── 05-module-architecture.md      ← How Allplan organizes reinforcement modules
│   ├── 06-reference-data.md           ← Extracted reference data (steel grades, country DB)
│   ├── 07-browser-feasibility.md      ← Can each requirement run in the browser?
│   ├── 09-tech-libraries.md           ← All chosen libraries & dependencies (future package.json content)
│   ├── 10-design-system.md            ← Design tokens & one-place-change styling rules
│   ├── 11-reinforcement-workflow.md   ← Author's domain workflow: imported backgrounds, element-by-element / floor-by-floor authoring, layer focus isolation
│   ├── implementation-plans-and-tasks/ ← 🔵 LIVE — approved milestone plans + task state (M0 active)
│   ├── test-scenarios/                ← 🟢 LIVE — behavioral test scenarios per milestone (manual now, Playwright post-POC)
│   └── author_notebook.md             ← ⛔ AUTHOR'S PRIVATE notes — AI sessions must NOT read or use it (raw future UI/UX ideas)
```

---

## Project Summary

### The Problem

Allplan 2022 requires:

- Expensive workstation (€2,000+)
- Annual subscription (€3,000+/year)
- Windows-only
- 3.3 GB installation with 1,400+ DLLs
- Steep learning curve for the UI

Yet 80% of what structural engineering drafters actually do is:

- Model concrete formwork (walls, slabs, beams, columns)
- Place reinforcement bars according to code
- Generate sections, views, and bending schedules
- Export plans to PDF/DXF/IFC

### The Solution

A **browser-based web application** that:

- Runs on any modern laptop (€400-700, integrated GPU)
- Focuses ONLY on reinforced concrete drawings
- Has a modern, fast React UI
- Uses WASM/WebGPU for geometry computation
- Works offline (browser storage)
- Is dramatically cheaper than Allplan

### Core Features (Phase 1 PoC)

1. 3D concrete element modeling (walls, slabs, beams, columns)
2. Automated sections and views from 3D model
3. Basic edit tools (copy, mirror, move, array)
4. Dimension and elevation lines
5. 3D reinforcement bar placement
6. Automated updates across all views
7. Building structure (floors)
8. Import: IFC, DXF
9. Export: PDF, DXF, IFC
10. Parametric reinforcement blocks (like PythonParts)

---

## Source of Domain Knowledge

All findings in this documentation are derived from analysis of:

```text
C:\Program Files\Allplan\Allplan\2022\
    Prg/    — 3.3 GB of binaries, 1,393 DLLs, 84 EXEs
    New/    — Project templates, reinforcement standards for 30+ countries
    Schemas/ — 85 schema files
```

The reinforcement data model in [04-reinforcement-data-model.md](./docs/04-reinforcement-data-model.md) was extracted by decompiling `NemReinforcement.dll` (212 .NET types) using PowerShell reflection.

**If more analysis of the Allplan installation is needed**, start a new session with access to `C:\Program Files\Allplan\Allplan\2022\`. The decompilation script is at `scripts/decompile-allplan-dll.ps1` — extracts all types/methods from a .NET DLL using PowerShell reflection.

---

## Key Decisions Made (Architecture Locked)

| # | Decision | Rationale | Spec |
| --- | --- | --- | --- |
| A | M0-M4 milestone sequence (One Wall → Full Building); M2 scope revised 2026-08-09: IFC Round-Trip → **Adapters Round-Trip (IFC + DXF)** | Validate architecture before building features; find DXF tech walls early in the POC | [§A](./docs/08-architecture-spec.md#a--mvp-scope--milestone-sequence) |
| B | "Figma for concrete" — direct-manipulation-first UI | 10x faster than Allplan's property-grid workflow | [§B](./docs/08-architecture-spec.md#b--user-interaction-model) |
| C | Internal data model + IFC/DXF adapters (not IFC-native) | IFC stores results, not design intent | [§C](./docs/08-architecture-spec.md#c--internal-data-model) |
| D | Stateless Rust/WASM functions, flat arrays across boundary | Simple, testable, undo-safe | [§D](./docs/08-architecture-spec.md#d--wasm--typescript-boundary) |
| E | RTK (Redux Toolkit) + Immer snapshots for undo (30 levels) (revised 2026-07-28) | Simple, correct; thunks map natively onto §N command layer | [§E](./docs/08-architecture-spec.md#e--state-management--undoredo) |
| F | Individual + group bar placement with stored params | Both ad-hoc and rule-based workflows | [§F](./docs/08-architecture-spec.md#f--reinforcement-placement) |
| G | Two-tier sections: parametric query first, mesh plane-intersection fallback (revised 2026-07-28) | Standard elements need no mesh slicing; no BREP kernel | [§G](./docs/08-architecture-spec.md#g--section--view-generation) |
| H | project.json in OPFS + IndexedDB for app state; cloud deferred (revised 2026-07-28) | Simple, sufficient; single-file projects make cloud trivial later | [§H](./docs/08-architecture-spec.md#h--project-file-structure) |
| I | Canvas2D + SVG overlay for 2D, jsPDF for vector PDF | Performance + editability + scale-accurate plot | [§I](./docs/08-architecture-spec.md#i--2d-drawing--pdf-pipeline) |
| J | Live-updating bar schedule when visible on screen | Matches Allplan, always correct for deliverable | [§J](./docs/08-architecture-spec.md#j--bar-bending-schedule) |
| K | On-demand validation, edit-mode layers, DIN/EC2 first | User controls when, extensible via JSON rules | [§K](./docs/08-architecture-spec.md#k--validation--code-compliance) |
| L | InstancedMesh per diameter, transparency support | 50K bars at 20-40 FPS on integrated GPU | [§L](./docs/08-architecture-spec.md#l--performance--rendering-strategy) |
| M | Annotation is the differentiator: layered auto-placement + parametric manual overrides (added 2026-07-28) | >50% of drafting time is labeling; 2D-only, prototyped early | [§M](./docs/08-architecture-spec.md#m--annotation--labeling-strategy) |
| N | All model mutations via UI-free named command functions (added 2026-07-28) | Doors open for MCP server, natural-language input, scripting — zero core changes later | [§N](./docs/08-architecture-spec.md#n--command-layer--ai-extensibility) |

**These decisions are locked.** To revisit one, update §Architecture Spec with new rationale and revision date.

---

## Deferred Topics (Not Yet Discussed)

These topics need dedicated discussion sessions before implementation reaches them.

**⚠️ Implementation planning rule:** Every milestone plan (M0+) must review this table and Architecture Spec §N before writing code. No implementation decision may silently close a door listed here — if a conflict is discovered, raise it explicitly and update the spec.

| # | Topic | When Needed | Depends On |
| --- | --- | --- | --- |
| **Layer Model** | On/off, freeze/thaw, lock/unlock, active layer per storey. User-defined layer names. **Domain input (2026-08-09):** visibility = focus isolation while detailing — hidden entities should not be re-rendered/recalculated ([doc 11](./docs/11-reinforcement-workflow.md)). **Door watch (2026-08-09):** M2's DXF background import (§A revised) needs a reference-linework storage decision that must NOT preempt this topic — to be resolved explicitly in the M2 plan. | Before M4 (multi-element building) | B (interaction model) |
| **Tool Palette Design** | Exact tool list, icons, shortcuts, workflow sequences. User-editable keyboard shortcuts. | **✅ LOCKED 2026-07-29** — M0 tool set defined (§B.6) | B |
| **Drawing Layouts & Title Blocks** | A0-A4 + custom sheets. Predefined and custom title blocks, borders, scale settings. | Before I (2D drawing pipeline) is complete | I |
| **Dimension & Annotation System** | Associative dimensions, elevation markers, leader lines, bar labels. Strategy locked in §M — remains: detailed design + implementation. Prototype early (2D-only, no 3D stack needed). | Early — it is the differentiator; after the first 2D view exists | G, J, M |
| **BVBS Export** | Export bar schedule to BVBS format for bending machines. | After J (schedule) works | J |
| **Parametric Reinforcement Blocks** | JSON-defined parametric objects (like Allplan PythonParts). Custom block editor. | Phase 2 | F |
| **Multi-Country Steel Catalogs** | Extract and load country-specific steel grade files from Allplan data. | After K (validation) with DIN/EC2 working | K, [06](./docs/06-reference-data.md) |
| **DWG Import** | Native DWG support. Currently DXF-only as workaround. | When user demand requires it | C (IO adapters) |
| **Junction Section Handling** | Beam-column-slab joints: view-composition rules vs. CSG union of touching solids. | **✅ RESOLVED 2026-07-29** — 2D polygon union (§G.2.2); impl at M4 | G |
| **Cloud Storage & Accounts** | BaaS (Backend as a Service) for project sync. v1 = upload/download of project.json (Supabase-leaning, §H.4). Only after product value is proven. | Phase 2 | H |
| **MCP (Model Context Protocol) Server** | External AI (Artificial Intelligence) agents drive the app via the command layer exposed as MCP tools. Core engine packaged for Node.js; MCP server = thin wrapper (a browser app cannot host a server — separate companion process; remote MCP endpoint possible once backend exists, §H.4). **Bring-your-own-AI model (2026-07-28):** users drive the app with their OWN AI subscription (Claude Desktop etc.) — zero inference cost for the product, no API-key management, strong privacy story. Direction validated by FreeCAD+Claude Desktop MCP integrations. | Phase 2+, after the tool is proven | N |
| **Natural-Language Detailing Input** | LLM (Large Language Model) translates text ("Beam 30×60, 2 spans, stirrups Ø8/15") → command params → validate against catalog/code rules → user confirms → engine executes. LLM gives intent, never geometry (§N.2). **Note (2026-07-28):** an external AI via MCP may serve as the FIRST natural-language front-end (bring-your-own-AI) — an in-app assistant becomes optional/complementary rather than a prerequisite. | Phase 2, after schemas stabilize | N, F, K |
| **Sketch Underlay + Freehand-to-Rebar** | Image/PDF (Portable Document Format) underlay placed at scale (standard CAD (Computer-Aided Design) feature); freehand stroke with mouse/stylus snaps into a proper parametric rebar path. Stage A of sketch input — deterministic, no AI risk. | Phase 2 | B, G |
| **AI Vision Sketch Recognition** | Recognize hand-sketched reinforcement on scanned printouts (Stage B of sketch input). Human-in-the-loop confirmation mandatory — reinforcement documentation tolerates zero misreads. **Note (2026-07-28):** via MCP, the user's own multimodal AI (e.g., Claude Desktop with a photo of the sketch) can do the vision interpretation and drive commands — outsourcing the riskiest part to the user's AI subscription; the app only validates + asks for confirmation. Research-grade; test against many real hand sketches. | Phase 3 experiment | Sketch underlay, N |

---

## Rules for Implementation Sessions (M0+)

> **Non-negotiable coding rules.** The code-writing AI must follow them; the author reviews against them. When starting an implementation session, tell the model: *"Read README → Rules for Implementation Sessions and Architecture Spec §N before writing any code."*

1. **Command layer (§N):** Every mutation of the project model goes through a named command function in `src/commands/`. UI (User Interface) event handlers contain **no business logic** and **never touch the store directly**.
2. **Dumb components:** React components render and dispatch commands only. No domain math, no validation, no geometry logic inside components.
3. **Stateless WASM (§D):** Rust/WASM (WebAssembly) functions are pure — no state held across calls; geometry crosses the boundary as flat arrays.
4. **Data model first:** TypeScript interfaces in `src/data/models/` are defined before UI code that consumes them.
5. **Doors stay open:** Before any structural decision, check the Deferred Topics table above and §N.
6. **Design tokens only ([doc 10](./docs/10-design-system.md)):** No literal colors, pixel sizes, or font sizes in components — semantic tokens from `tokens.css` only. Domain styling (pen table, rebar colors) comes from project settings, not the UI theme.
7. **Manual test list (added 2026-08-09):** Every task report ends with a list of what the author must test manually. After the author approves the task, the list is persisted as structured scenarios in [docs/test-scenarios/](./docs/test-scenarios/README.md) — behavior-focused Given/When/Then, stable IDs, updated in the same commit whenever behavior changes.
8. **Author works in parallel — commit everything on approval (added 2026-08-09):** The author may edit any file (including `docs/author_notebook.md`) while a task is in progress; avoiding collisions is the author's responsibility. When the author approves a task, the task commit includes ALL working-tree changes, not just the session's files. If an exact-match edit fails because of a parallel edit, re-read the file and adapt — never revert the author's changes.

### Review Checklist (for the author)

- [ ] `pnpm lint` and `pnpm build` pass (lint includes Prettier formatting + type-checked rules)
- [ ] Search component files (`src/ui/`) for direct store mutation calls — expected result: **zero** (only command invocations)
- [ ] Component files contain no domain math, validation, or geometry computation
- [ ] Every new user action has a corresponding named command with a plain params object
- [ ] WASM functions hold no state between calls; only flat arrays cross the boundary
- [ ] Undo/redo (§E) works for every newly added command
- [ ] Nothing in the change silently blocks a Deferred Topics entry
- [ ] No literal style values in `src/ui/` (hex/px/font-size) outside `tokens.css` ([doc 10](./docs/10-design-system.md))

---

## For AI Sessions

When starting a new AI session, provide this README as context. It contains session state, links to all docs, and deferred topics.

**⛔ Do NOT read `docs/author_notebook.md`** — it is the author's private scratchpad with raw, unstructured future UI/UX ideas. It is not project documentation and must not be used as context for any decision.

Start with:

```text
I'm working on a browser-based reinforced concrete drawing app ("web-rebar").
Read C:\work\personal\projects\web-rebar\README.md first — it has session state.
Then read docs/08-architecture-spec.md — it has all locked architecture decisions.
```

**To start M2 planning (current), use this:**

```text
I'm working on a browser-based reinforced concrete drawing app ("web-rebar").
Read C:\work\personal\projects\web-rebar\README.md first — it has session state
(M0 + M1 ✅ complete) and the Rules for Implementation Sessions.
Then read docs/08-architecture-spec.md — especially §A (milestone table; M2
revised 2026-08-09 from IFC-only to IFC + DXF adapters), §C (internal model +
adapters, design intent vs results), §D.4 (web-ifc + its documented
write-capability fallback risk), §G.1 (section primitives — the DXF export
source) and §N — plus docs/07-browser-feasibility.md (DXF notes: import via
dxf-parser or custom, export = custom writer, "IFC for 3D, DXF for 2D
reference drawings") and docs/11-reinforcement-workflow.md (the author's
DXF-background tracing workflow), and the completed trackers in
docs/implementation-plans-and-tasks/ (M0 + M1 — patterns to reuse).

Task: write the M2 plan (§A revised — Adapters Round-Trip: (1) model wall+bar
→ export IFC → reload → identical model; (2) DXF import as 2D reference
background linework; (3) DXF export of a section view) as
docs/implementation-plans-and-tasks/m2-*.md following the M0/M1 plan structure
(open questions with recommendations FIRST, then the task breakdown). Explicit
open questions to address: web-ifc write capability vs the §D.4 custom-writer
fallback; IFC property-set strategy for design intent (cover, hostElementId)
vs re-derivation on import; where imported DXF reference linework lives
WITHOUT preempting the deferred Layer Model topic (door watch in the root
README Deferred Topics table); DXF units/scale ($INSUNITS) and real-world
block/insert handling; DXF export scale accuracy. Per the root README planning
rule, review the Deferred Topics table + §N before planning — no plan decision
may silently close a deferred door. Explicitly out of M2 scope: DXF→3D model
mapping, DWG. Do NOT write implementation code — the plan needs my approval
first.
```

**Session type guide:**

| What you want to do | Read these docs |
| --- | --- |
| Continue architecture discussion (deferred topics) | README → [08-architecture-spec](./docs/08-architecture-spec.md) → deferred topic list above |
| Start implementing the next milestone (M0 + M1 ✅ done — M2 next) | README → [08-architecture-spec](./docs/08-architecture-spec.md) → [03-tech-stack](./docs/03-tech-stack.md) → [M0](./docs/implementation-plans-and-tasks/m0-one-wall-one-bar.md) + [M1](./docs/implementation-plans-and-tasks/m1-edit-and-reactivity.md) trackers (patterns to reuse) |
| Design data model / TypeScript interfaces | [08-architecture-spec §C+D](./docs/08-architecture-spec.md) → [04-reinforcement-data-model](./docs/04-reinforcement-data-model.md) |
| Work on reinforcement algorithms | [08-architecture-spec §F+K](./docs/08-architecture-spec.md) → [04-reinforcement-data-model](./docs/04-reinforcement-data-model.md) → [06-reference-data](./docs/06-reference-data.md) |
| Understand Allplan for comparison | [02-allplan-analysis](./docs/02-allplan-analysis.md) → [05-module-architecture](./docs/05-module-architecture.md) |
