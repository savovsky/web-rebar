# Rebar Web App — Project Documentation

> **Goal:** A fast, browser-based tool for 3D reinforced concrete formwork and reinforcement plan creation.  
> **Target market:** Structural engineering offices that find Allplan/Revit/Tekla too heavy and expensive.  
> **Author:** Experienced React developer (10y) + former Allplan power user (10y).

---

## Session State

> **Last session:** 2026-08-08 — GitHub repo created (`git@github.com:savovsky/web-rebar.git`); Vite 8 + React 19 + TypeScript 6 scaffolded; M0 dependencies installed (RTK, Three.js, Tailwind v4, Radix, jsPDF); full `src/` folder structure created (stores, engine, io, ui stubs); build verified  
> **Tooling (2026-08-08):** ESLint/Prettier stack adopted from doxeek — type-checked `typescript-eslint`, custom ruleset (max-params 2 → options objects, naming conventions, complexity limits), Prettier as a lint rule with import sorting; `pnpm lint` and `pnpm build` both clean
> **Current phase:** Pre-development — project scaffold ready; ~2-month exploration gate (see [Project Vision → Project Strategy](./docs/01-project-vision.md))
> **Next session:** M0 implementation planning (One Wall, One Bar) — WASM function signatures, data model interfaces, RTK store shape, section-view component design, milestone task breakdown

**Where we left off:** 14 architectural topics (A–N) are decided and locked. Both §G.2 open questions are **resolved** (2026-07-29). The **[Architecture Spec](./docs/08-architecture-spec.md)** captures every decision. The project is now **scaffolded and ready for M0**:

**Repository:** `git@github.com:savovsky/web-rebar.git`

| What | Details |
|------|---------|
| **Build** | Vite 8.2 + TypeScript 6.0 — `pnpm dev` / `pnpm build` |
| **UI** | React 19.2 + Tailwind v4 + Radix primitives |
| **State** | Redux Toolkit 2.12 (thunks = §N command layer) |
| **3D** | Three.js 0.185 + React Three Fiber 9.7 + Drei 10.7 |
| **PDF** | jsPDF 4.2 |
| **Structure** | `src/stores/` (configured), `src/engine/` (stubs), `src/io/` (stubs), `src/commands/` (empty, ready for §N), `src/ui/` (empty dirs per feature), `src/data/` (dirs for models/catalog/validation) |

**Still needed (M0 session):** Rust `core/` crate (WASM), first TypeScript data model interfaces, first command thunks, 3D viewport component, section-view component.

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

```
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
│   └── 10-design-system.md            ← Design tokens & one-place-change styling rules
├── author_notebook.md                 ← ⛔ AUTHOR'S PRIVATE notes — AI sessions must NOT read or use it (contains raw, outdated ideas)
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
|---|---|---|---|
| A | M0-M4 milestone sequence (One Wall → Full Building) | Validate architecture before building features | [§A](./docs/08-architecture-spec.md#a--mvp-scope--milestone-sequence) |
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

---

## Rules for Implementation Sessions (M0+)

> **Non-negotiable coding rules.** The code-writing AI must follow them; the author reviews against them. When starting an implementation session, tell the model: *"Read README → Rules for Implementation Sessions and Architecture Spec §N before writing any code."*

1. **Command layer (§N):** Every mutation of the project model goes through a named command function in `src/commands/`. UI (User Interface) event handlers contain **no business logic** and **never touch the store directly**.
2. **Dumb components:** React components render and dispatch commands only. No domain math, no validation, no geometry logic inside components.
3. **Stateless WASM (§D):** Rust/WASM (WebAssembly) functions are pure — no state held across calls; geometry crosses the boundary as flat arrays.
4. **Data model first:** TypeScript interfaces in `src/data/models/` are defined before UI code that consumes them.
5. **Doors stay open:** Before any structural decision, check the Deferred Topics table above and §N.
6. **Design tokens only ([doc 10](./docs/10-design-system.md)):** No literal colors, pixel sizes, or font sizes in components — semantic tokens from `tokens.css` only. Domain styling (pen table, rebar colors) comes from project settings, not the UI theme.

### Review Checklist (for the author)

- [ ] `pnpm lint` and `pnpm build` pass (lint includes Prettier formatting + type-checked rules)
- [ ] Search component files (`src/ui/`) for direct store mutation calls — expected result: **zero** (only command invocations)
- [ ] Component files contain no domain math, validation, or geometry computation
- [ ] Every new user action has a corresponding named command with a plain params object
- [ ] WASM functions hold no state between calls; only flat arrays cross the boundary
- [ ] Undo/redo (§E) works for every newly added command
- [ ] Nothing in the change silently blocks a Deferred Topics entry
- [ ] No literal style values in `src/ui/` (hex/px/font-size) outside `tokens.css` ([doc 10](./docs/10-design-system.md))

| # | Topic | When Needed | Depends On |
|---|---|---|---|
| **Layer Model** | On/off, freeze/thaw, lock/unlock, active layer per storey. User-defined layer names. | Before M4 (multi-element building) | B (interaction model) |
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

## For AI Sessions

When starting a new AI session, provide this README as context. It contains session state, links to all docs, and deferred topics.

**⛔ Do NOT read `author_notebook.md`** — it is the author's private scratchpad with raw, outdated ideas. It is not project documentation and must not be used as context for any decision.

Start with:

```
I'm working on a browser-based reinforced concrete drawing app ("web-rebar").
Read C:\work\personal\projects\web-rebar\README.md first — it has session state.
Then read docs/08-architecture-spec.md — it has all locked architecture decisions.
```

**To resume M0 implementation planning (current), use this:**

```
Read C:\work\personal\projects\web-rebar\README.md and docs/08-architecture-spec.md.
Then let's plan M0: One Wall, One Bar — WASM function signatures, data model interfaces,
RTK store shape, command thunks, 3D viewport component, section-view component.
```

**Session type guide:**

| What you want to do | Read these docs |
|---|---|
| Continue architecture discussion (deferred topics) | README → [08-architecture-spec](./docs/08-architecture-spec.md) → deferred topic list above |
| Start implementing M0 | README → [08-architecture-spec](./docs/08-architecture-spec.md) → [03-tech-stack](./docs/03-tech-stack.md) |
| Design data model / TypeScript interfaces | [08-architecture-spec §C+D](./docs/08-architecture-spec.md) → [04-reinforcement-data-model](./docs/04-reinforcement-data-model.md) |
| Work on reinforcement algorithms | [08-architecture-spec §F+K](./docs/08-architecture-spec.md) → [04-reinforcement-data-model](./docs/04-reinforcement-data-model.md) → [06-reference-data](./docs/06-reference-data.md) |
| Understand Allplan for comparison | [02-allplan-analysis](./docs/02-allplan-analysis.md) → [05-module-architecture](./docs/05-module-architecture.md) |