# 01 — Project Vision

> **Back to:** [README.md](../README.md)  
> **Related:** [Browser Feasibility](./07-browser-feasibility.md) | [Tech Stack](./03-tech-stack.md)

---

## The Idea

A **web-based, browser-native application** for creating 3D reinforced concrete formwork and reinforcement plans. Faster, lighter, and more affordable than traditional BIM desktop software.

## The Problem We're Solving

### Current State (Allplan 2022)

| Pain Point | Detail |
| --- | --- |
| **Cost** | €3,000+/year subscription per seat |
| **Hardware** | €2,000+ workstation required (discrete GPU, 32 GB RAM) |
| **Platform lock** | Windows-only (WPF + .NET Framework 4.7.1 + MFC) |
| **Complexity** | 1,400 DLLs, 3.3 GB install, 30 years of accumulated features |
| **UX** | WPF with MFC legacy mixed in, property-grid-heavy UI |
| **Speed** | Single-threaded C++ core from early 2000s naming |

### The 80/20 Reality

80% of what structural engineering drafters do is handled by **10% of Allplan's modules**:

- Model concrete formwork (walls, slabs, beams, columns, foundations)
- Place reinforcement bars per code
- Create sections and views
- Add dimensions and annotations
- Export bending schedules (BVBS)
- Print/export plans (PDF, DXF)

The remaining 90% of Allplan (roads, bridges, terrain, precast factories, facility management, Cineware rendering, BIM+ cloud) is irrelevant to this workflow — but users pay for all of it.

## Target Users

- Small to medium structural engineering offices
- Precast concrete detailers
- Rebar detailing specialists
- Engineers who currently use Allplan/Revit/Tekla but find them overkill

**Target scale:** Projects up to ~2,000 concrete elements and ~20,000 reinforcement bars (apartment buildings, small commercial, industrial halls).

## Core Features — Phase 1 PoC

| # | Feature | Priority | Notes |
| --- | --- | --- | --- |
| 1 | 3D concrete element modeling | P0 | Walls, slabs, beams, columns, foundations. Extrusion-based, not full BREP. |
| 2 | Automated sections and views | P0 | Clipping plane → 2D projection with concrete hatches, hidden lines |
| 3 | Basic edit tools | P0 | Copy, mirror, move, rotate, array, offset |
| 4 | Dimension and elevation lines | P1 | Associative dimensions that update with geometry changes |
| 5 | 3D reinforcement | P0 | Bar placement on faces, parametric shapes, stirrups, meshes |
| 6 | Automated updates across views | P1 | Change → recompute all dependent views and schedules |
| 7 | Building structure (floors) | P0 | Hierarchical: Building → Storey → Element |
| 8 | Import IFC, DXF | P1 | IFC via web-ifc, DXF via parser; DWG via DXF workaround |
| 9 | Export PDF, DXF, IFC | P1 | jsPDF for vector plans, custom DXF writer, web-ifc write |
| 10 | Parametric reinforcement blocks | P2 | JSON-schema-defined parametric objects (like PythonParts) |

## What We Explicitly Do NOT Build

- ❌ Full BIM authoring (no MEP, no structural analysis)
- ❌ Photorealistic rendering
- ❌ Terrain/site modeling
- ❌ Road/rail/bridge design
- ❌ Facility management
- ❌ Cloud collaboration (PoC — maybe later)
- ❌ Multi-user concurrent editing (PoC)
- ❌ Proprietary-only file format — internal model is native JSON; IFC (Industry Foundation Classes) is import/export via adapters (Architecture Spec §C)
- ❌ Freeform/general CAD (Computer-Aided Design) modeling (arbitrary 3D sculpting) — parametric structural elements only
- ❌ Curved, skewed, bridge/tunnel-class geometry — left to Allplan-class tools
- ❌ Custom BREP (Boundary Representation) geometry kernel — parametric profiles + lightweight mesh math (Architecture Spec §G)

## Success Criteria for PoC

1. A user can model a simple building (5 floors, 20 walls, 10 slabs) in under 30 minutes
2. Reinforcement can be placed on walls and slabs with code-compliant cover and spacing
3. Sections auto-update when the model changes
4. Everything runs smoothly on an 8 GB laptop with integrated graphics
5. The UX feels faster and more intuitive than Allplan

---

## Project Strategy (added 2026-07-28)

- **Exploration gate:** The initial phase is time-boxed (~2 months). Goal: a working detailer for 1–2 element types producing real drawings (views + sections with depth, true rebar shapes, smart labels, bar bending schedule) — good enough to show practicing engineers. If a technical wall or unsatisfying results appear, the project stops as a strong portfolio piece; if it delights, it continues toward SaaS (Software as a Service).
- **Workflow model — structure first, then reinforcement:** The user always creates a structural context first (even just a beam with two columns or a single foundation), then places reinforcement into it. Elements are parametric, not freeform.
- **The "middle path" scope:** 3D-capable without a heavy geometry engine — parametric elements + data-query sections + reactive state sync (Architecture Spec §E, §G). Layers/storeys with visibility control; click an element → 2D view with surrounding context and X/Y extent control; edits propagate to all views.
- **Annotation is the differentiator:** >50% of drawing time goes to labels/dimensions. MVP (Minimum Viable Product) ships manual tools with smart defaults; auto-labeling is the killer feature (Architecture Spec §M).
- **Docs as hedge:** Architecture decisions stay current in docs/08 so the project is resumable at any point — by the author, AI sessions, or future collaborators.

## Competitive Landscape

| Tool | Strengths | Weaknesses |
| --- | --- | --- |
| **Allplan** | Complete BIM, German market leader, proven | Heavy, expensive, Windows-only, old UX |
| **Revit + Dynamo** | Global ecosystem, parametric | Even heavier, subscription-only, reinforcement is an afterthought |
| **Tekla Structures** | Best-in-class for complex steel/concrete | Extremely expensive, steep learning curve |
| **Sofistik** | FEA integration, code compliance | Analysis-first, not drawing-first |
| **AutoCAD + rebar plugins** | Familiar, lightweight 2D | No BIM, no 3D-to-2D automation |
| **RebarPro AI** *(added 2026-07-28)* | AI-first positioning; browser/SaaS; new entrant like us | See analysis below — landing-page stage, no demonstrated editor or output |
| **Ours** | Browser-native, fast, affordable, focused; deterministic engine + optional AI | New entrant, limited features initially |

### RebarPro AI (rebarproai.com) — Analysis (2026-07-28, from landing page only)

New company (© 2026) claiming "AI-powered rebar shop drawings," BOM (Bill of Materials) checking, smart estimation, code Q&A, and RFI (Request for Information) copilot. Observations:

- 5 of 6 advertised features are LLM (Large Language Model) document wrappers (Q&A, RFI, estimation, BOM check) — not drawing authoring
- The core detailing claim ("shop drawings in minutes") has **no substantiation**: no product screenshots, no sample output, no editor shown, no formats (DXF/IFC/BVBS), no standards (EC/ACI/BS), no input workflow described
- Marketing claims (60% faster, 40% fewer errors) are unattributed; "thousands of users" with no named customers — landing page likely ahead of product
- "Watch Demo" requires signup; **no public demo, no videos, no screenshots of real output** — lead-capture-first pattern; engineering software with real output always shows it, so absence suggests product is not ready to show
- Their apparent model: AI generates → user hopes it's right. **Our model: deterministic engine generates → AI optionally assists → engineer confirms.** For load-bearing documentation, ours is the defensible one
- **Action:** sign up for the 14-day trial when convenient; verify whether a real editor and real drawing output exist; update this entry with first-hand findings
- **Counter-strategy for us:** no-signup interactive demo (PWA makes this free) + public progress/output videos from early on — engineers buy with their eyes

**Market gap:** There is no established browser-based reinforcement detailing tool. The web BIM space (ThatOpen, BIMData, xeokit) focuses on viewing/collaboration, not authoring. One new AI-positioned entrant (RebarPro AI) appeared in 2026 — monitor, but its landing page shows no demonstrated detailing editor.

---

## Development Philosophy

1. **Domain-driven design** — Use the Allplan data model as a reference for what parameters matter
2. **80/20 ruthlessly** — Ship the features that cover 80% of real projects, skip the edge cases
3. **Correct before clever** — Reinforcement must be code-compliant. Algorithms come from EC2/DIN, not imagination.
4. **DX beats UX initially** — Get the geometry and data model right before polishing the UI
5. **Open standards** — IFC as the open exchange format via adapters (internal JSON model is native), glTF for geometry exchange, BVBS (Bundesverband Bewehrungsstahl bending-machine format) for bending machines
