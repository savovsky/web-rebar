# 12 — Product Positioning & Ideas

> **Back to:** [README.md](../README.md) · [Architecture Spec](./08-architecture-spec.md)
> **Created:** 2026-08-18 (M2 T6 session — split out of an author/AI discussion about 3D-DXF files)
> **Status:** 🟡 Live idea log — **not** locked decisions. Entries that turn into architecture land in the [Architecture Spec](./08-architecture-spec.md) with a revision date; entries that turn into milestone scope land in the [implementation plans](./implementation-plans-and-tasks/README.md). Everything else stays here as positioning/communication material.

**Purpose:** one place for the product-level sentences and ideas that emerge from design sessions and real-file findings — how we talk about the app, what we promise (and deliberately don't), workflow guidance for users. The goal of the app is to make reinforcement detailing a **joy, not a pain** — this document collects the small decisions that keep it that way.

**⛔ Distinct from `author_notebook.md`:** the notebook is the author's private raw scratchpad (AI sessions must not read it). This document is shared, curated project documentation — entries here are discussed and agreed.

---

## Import philosophy: the right format for the job

> **Bring your 3D models as IFC, your 2D plans as DXF.**

**Origin:** 2026-08-18, M2 T5/T6 real-file findings. The author's `2507_KOMO - 3D View.dxf` (46 MB) turned out to be a genuine 3D AutoCAD export whose entire 3D content is **ACIS BREP solids** (1,047 `3DSOLID` + 16 `BODY` entities — proprietary kernel data, no `3DFACE`/`MESH` tessellation). Rendering those would require a BREP kernel (OpenCASCADE.js ~30 MB WASM — §G.2's documented last resort). Allplan 2022 crashes importing the file — the 3D-DXF path is a dead end even between the incumbent tools.

**Why this is good advice, not our limitation:**

- Every BIM/structural authoring tool (Allplan, Revit, Tekla, Advance Steel, ArchiCAD) exports IFC natively for 3D; DXF is the universal 2D plan exchange. Users change nothing about how they already work.
- IFC is *better* 3D reference content: real object structure, per-part colors, proper units — vs. anonymous ACIS blobs in a DXF.
- This is exactly what doc 07 assessed and §A locked for M2 ("IFC for 3D, DXF for 2D reference drawings") — the real file validated the split with evidence.

**Anticipated follow-up questions (pre-answered):**

- *"I have a DWG, not DXF"* → Export to DXF from your CAD first (native DWG import is a deferred topic — licensing/format reality).
- *"My DXF is a 3D export"* → That file carries ACIS solids, not readable 3D geometry — ask the source tool for an IFC export instead.
- *"Why doesn't the imported DXF show text/colors/hatches?"* → The DXF background is a **tracing reference, not a CAD drawing replica**: linework only, rendered muted on purpose so it never competes with your model (M2 plan Q3/Q4). Skipped content is always counted and reported in the import summary — nothing is silently lost.

**Door kept open (build nothing now):** if a real future file brings 3D content as *pre-tessellated* mesh entities (`3DFACE`, `MESH`, polyface `POLYLINE`), absorbing those triangles into reference documents is a moderate, kernel-free extension — worth doing only when a real file demands it.

---

## Future entries

Add new ideas as `##` sections above this line — one entry per idea, with a date and the discussion/finding that motivated it.
