# 05 — Module Architecture Reference

> **Back to:** [README.md](../README.md)  
> **Related:** [Allplan Analysis](./02-allplan-analysis.md) | [Reinforcement Data Model](./04-reinforcement-data-model.md)

---

## How Allplan Organizes Reinforcement

This map was derived from the DLL names in `C:\Program Files\Allplan\Allplan\2022\Prg\`. It reveals the logical structure of a production reinforcement system — useful as a reference architecture for our own module design.

---

## Complete Reinforcement Module Map

```
REINFORCEMENT SYSTEM
│
├── 🔴 CORE SOLVER (Native C++)
│   ├── Bew2000.dll              ← General reinforcement kernel
│   ├── BewNormFC.dll            ← Code compliance checks (cover, spacing, anchorage)
│   ├── Bew2000FC.dll            ← Factory/catalog variant
│   ├── Bew2000BautFC.dll        ← Construction element variant
│   ├── NBewGen11.exe            ← .NET wrapper → Reinforcement generation (calls C++)
│   └── NemIng_ReinfGen10.dll    ← Native reinforcement generation
│
├── 🔴 SHAPE CATALOGS (Native C++)  
│   │  One DLL per shape variant — ~50 DLLs total
│   │
│   ├── WALL REINFORCEMENT (25 variants: BewWandZulag1-24.dll)
│   │   └── Each encodes a specific wall bar shape/arrangement
│   │
│   ├── STAIR REINFORCEMENT (10 variants)
│   │   ├── BewTreppe1-5.dll     ← 5 main stair types
│   │   ├── BewTreppeEin*.dll    ← Stair entry bar ends
│   │   └── BewTreppeAus*.dll    ← Stair exit bar ends
│   │
│   ├── EDGE REINFORCEMENT
│   │   └── BewRandeinf.dll      ← Edge reinforcement shapes
│   │
│   └── GENERAL SHAPES
│       ├── BewZulag2000.dll     ← General reinforcement supplement
│       └── Bew2000_eng.dll      ← English localization
│
├── 🟡 DATA MODEL (.NET Framework)
│   ├── NemReinforcement.dll     ← 212 types: ALL shared data classes, enums, converters
│   │   ├── PG_Data/             ← PropertyGrid data classes (core domain model)
│   │   │   ├── PG_ReinforcementBaseInfo
│   │   │   ├── PG_Reinforcement3DPlacement
│   │   │   ├── PG_Bending_Data
│   │   │   ├── PG_ConcreteCover_Data
│   │   │   ├── PG_AnchoringLength_Data
│   │   │   ├── PG_UeberGreifLanR_Data
│   │   │   ├── PG_VerAnkLanR_Data
│   │   │   ├── PG_BewRandEinf_Data
│   │   │   ├── PG_GlobalSetzen_Data
│   │   │   ├── PG_GlobalErsetzen_Data
│   │   │   └── Hoehenbezug_Data
│   │   ├── Converters/          ← 50+ type converters (validation, formatting)
│   │   ├── Editors/             ← 20+ UITypeEditors (custom property editing)
│   │   ├── Forms/               ← 10+ dialog forms (complex parameter editing)
│   │   ├── UserControls/        ← Reusable controls (bending list, stirrup list)
│   │   └── StringTables/        ← Help strings
│   │
│   └── NemReinforcement.XmlSerializers.dll  ← XML serialization
│
├── 🟡 PLACEMENT (.NET Framework / WPF)
│   ├── NP_ReinfPlacement.dll    ← Bar placement UI palette
│   ├── NP_CircularAreaReinf.dll ← Circular section reinforcement placement
│   ├── NP_FreeRebar_UC.dll      ← Free/manual bar placement user control
│   ├── NP_ExtrudedRebar.dll     ← Bar along path (extruded)
│   └── NP_SweptRebar.dll        ← Swept bar profile placement
│
├── 🟡 GROUPING & LABELING (.NET Framework)
│   ├── NP_ReinfGroup.dll        ← Bar grouping into reinforcement cages
│   ├── NP_ReinfLabeling.dll     ← Position numbers, bar labels
│   └── NP_MeshLabel.dll         ← Mesh reinforcement labeling
│
├── 🟡 ADVANCED REINFORCEMENT (.NET Framework / C++)
│   ├── NP_BewRandEinf (BewRandeinf) ← Edge reinforcement advanced
│   ├── NP_FFBew2000.dll         ← Precast element reinforcement
│   ├── NP_Overrules.dll         ← Reinforcement overrides/rules
│   ├── NP_KoFeRaster.dll        ← Coordinate reinforcement grid
│   └── NP_VerlegedarstModif.dll ← Placement modification tools
│
├── 🟢 OUTPUT
│   ├── NemIng_BVBS.dll (C++)    ← BVBS bending machine format export
│   ├── NemIng_BVBS_eng.dll      ← English localization
│   └── NemDlt_ShearReport10.dll ← Shear reinforcement report
│
├── 🟢 PRECAST CONCRETE SPECIFIC
│   ├── NP_PrefabConnection.dll  ← Connection reinforcement
│   ├── NP_PrecastElementation.dll ← Precast element splitting
│   └── NP_Satteldach.dll        ← Roof reinforcement
│
└── 🟢 PYTHON API
    ├── NemAll_Python_Reinforcement.pyd  ← Python bindings for reinforcement
    ├── NemAll_Python_BaseElements.pyd   ← Base element access
    └── NemAll_Python_ArchElements.pyd   ← Architectural elements
```

---

## Our Module Design (Mapped from Allplan)

We should organize our code similarly but with modern patterns:

```
src/
├── core/                      ← WASM (Rust)
│   ├── geometry/              ← Bar shape generation, CSG, sectioning
│   ├── solver/                ← Placement algorithms, cover checks, anchorage calc
│   ├── bvbs/                  ← BVBS export
│   └── ifc/                   ← IFC read/write (or use web-ifc)
│
├── data/                      ← TypeScript (mirrors NemReinforcement.dll)
│   ├── models/                ← Data interfaces (see 04-reinforcement-data-model.md)
│   │   ├── reinforcement-base-info.ts
│   │   ├── bending-data.ts
│   │   ├── concrete-cover.ts
│   │   ├── anchorage-length.ts
│   │   └── ...
│   └── validation/            ← Input validation rules
│
├── placement/                 ← Bar placement logic (TypeScript, calls WASM)
│   ├── face-placement.ts      ← Place bars on element faces
│   ├── circular-placement.ts  ← Circular/column reinforcement
│   └── pattern-placement.ts   ← Repeating patterns
│
├── ui/                        ← React (mirrors NP_* UI modules)
│   ├── viewport/              ← 3D viewport (React Three Fiber)
│   ├── plan-view/             ← 2D plan/section view
│   ├── panels/                ← Property panels, tool palettes
│   ├── dialogs/               ← Bending form editor, cover dialog, etc.
│   └── tree/                  ← Building structure tree
│
├── labeling/                  ← Bar annotation (mirrors NP_ReinfLabeling)
│   ├── position-numbers.ts
│   ├── dimension-lines.ts
│   └── leader-lines.ts
│
└── blocks/                    ← Parametric reinforcement blocks (mirrors PythonParts)
    ├── wall-reinforcement.ts
    ├── stair-reinforcement.ts
    ├── column-reinforcement.ts
    └── ...
```

---

## Key Architectural Patterns from Allplan

### 1. Separate Shape Catalogs from Placement

Allplan has **one DLL per shape** (BewWandZulag1-24). We should have **one parametric engine + JSON shape definitions**:

```typescript
// shapes/wall-reinforcement.json
{
  "id": "wall-basic",
  "params": [
    { "name": "length", "type": "number", "default": 3000 },
    { "name": "height", "type": "number", "default": 2800 },
    { "name": "barDiameter", "type": "number", "default": 12 }
  ],
  "placementRule": "uniform-face",
  "bendingForm": "straight-bar" // reference to bending shape catalog
}
```

### 2. Shared Data Model (.NET → TypeScript)

Allplan's `NemReinforcement.dll` is the single source of truth for reinforcement data types. Our equivalent is `src/data/models/`.

### 3. Observer Pattern for Updates

Allplan uses observers to trigger view updates when reinforcement changes. Our equivalent is RTK (Redux Toolkit) with memoized selectors, or a dependency graph.

### 4. Separate Placement from Labeling

`NP_ReinfPlacement.dll` handles geometry. `NP_ReinfLabeling.dll` handles annotation. Same separation: `src/placement/` vs `src/labeling/`.

### 5. Global Set/Replace Operations

`PG_GlobalSetzen_Data` and `PG_GlobalErsetzen_Data` are batch operations on reinforcement groups. This is essential — users don't edit bars one at a time.

---

## What We DON'T Need from Allplan's Architecture

| Allplan module | Why we skip |
|---|---|
| ACIS kernel (61 DLLs) | Overkill — CSG + distance fields suffice for rebar |
| ODA DWG kernel (63 modules) | DXF is sufficient, DXF → IFC bridge if needed |
| Cineware renderer | Three.js for visualization |
| MFC + OCX UI runtime | Browser-native |
| WibuKey licensing | SaaS/account model |
| C++/CLI interop layer | Pure WASM interop |
| One DLL per rebar shape | One parametric engine + JSON |
| Road/Bridge/Civil modules | Not our domain |
| BIM+ cloud sync | OPFS + IFC export |

---

## Dependency Graph (Simplified)

```
User Action (UI)
    │
    ▼
React Component (e.g., WallReinforcementPanel)
    │
    ▼
RTK Store (e.g., reinforcementSlice)
    │
    ▼
WASM Solver (Rust)
    ├── BarGenerator::generate(param)
    ├── CoverValidator::validate(bar, element)
    └── CollisionDetector::check_conflicts(bars)
    │
    ▼
WASM Geometry Engine
    ├── BarMeshBuilder::build(shape, diameter)
    └── SectionGenerator::clip(plane, elements)
    │
    ▼
Three.js Scene
    ├── Bar meshes → viewport
    └── Section lines → plan view
    │
    ▼
IFC Serializer
    └── IfcReinforcingBar → IFC-SPF text
```