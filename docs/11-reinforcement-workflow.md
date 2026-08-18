# 11 — Reinforcement Authoring Workflow (Domain Knowledge)

> **Back to:** [README.md](../README.md) · [Architecture Spec](./08-architecture-spec.md)
> **Source:** Author's professional workflow (former Allplan power user), captured 2026-08-09.
> **Status:** Reference knowledge for future milestone planning — **not** a locked decision. The locked consequences land in [§Architecture Spec](./08-architecture-spec.md) when the relevant topics are discussed (Layer Model — deferred, before M4; storeys — M4).

---

## How reinforcement drawings are actually produced

### 1. The structure comes from imported backgrounds

The building structure (walls, beams, columns, slabs, foundations, sections, …) is modeled **using external imported DXF/IFC files as background layers** — the drafter traces/dimensions over the architect's plans rather than starting from a blank canvas.

**Connections:** §C import adapters (IFC/DXF) · M2 adapters round-trip (IFC + DXF — §A revised 2026-08-09: DXF import as 2D reference background is in M2 scope) · the *Sketch Underlay* deferred topic (image/PDF underlay at scale — the same "work over a background" pattern).

### 2. Reinforcement is authored element-by-element, floor-by-floor

Reinforcement is created and placed **structure item by structure item, then storey by storey** (elevation layer by elevation layer). While detailing one element, the drafter is focused on **that element and its immediate neighbors only** — e.g. a column or beam on floor 3 is detailed with floor 3's context visible, nothing else.

### 3. Layers are the focus mechanism (and a performance contract)

Once layers exist, the user controls what is on screen: turn off other structure elements and other floors' reinforcement while working. **Hidden entities should not be re-rendered or recalculated** — visibility is not just cosmetic, it is the user's tool for keeping the working set small.

---

## Architectural implications (for the Layer Model discussion, before M4)

- **Effective working set ≠ project size.** The M1 T5 performance probe showed pain thresholds scale with the *processed* entity count (dispatch, selector scans, draw calls). Layer visibility scoping means those thresholds apply to the **visible working set** (one storey + one discipline), not the whole building — a 50K-bar building detailed floor-by-floor behaves like many ~2–5K-bar projects.
- **Compute scoping, not just render scoping.** Today `selectSectionPrimitives` scans *all* reinforcement and every bar is a draw call. The Layer Model design should carry a visibility bit through: mesh layers skip hidden entities, selectors filter by visible/target sets, instanced pools (§L) are built per visible layer.
- **Building tree UI is already reserved** (§B.2: "Building" tab — storeys, layers, tree) and the data model has `storeys: Storey[]` (§H.1). This workflow is the *reason* for both: storey = the natural focus boundary.
- **Undo stays global** (§E project-state snapshots — T5 measured ~8 KiB/level at reference scale, so no per-layer undo complexity is needed); **picking/selection must skip hidden entities** (a bar on a hidden layer is not clickable).
- **Discipline split:** structure (concrete) and reinforcement are separate toggleable groups per storey — matching how sections already treat them (concrete outlines vs. cut bars, §G).

> **When needed:** read this doc before the Layer Model discussion (deferred topic, before M4) and before M4 storey/planning work.
