# 04 — Reinforcement Data Model Reference

> **Back to:** [README.md](../README.md)  
> **Related:** [Allplan Analysis](./02-allplan-analysis.md) | [Module Architecture](./05-module-architecture.md)
> **Extracted from:** `C:\Program Files\Allplan\Allplan\2022\Prg\NemReinforcement.dll`  
> **Source:** Decompiled via .NET reflection (Windows PowerShell 5.1 / .NET Framework 4.7.1)  
> **Date:** 2026-07-20  
> **Type count:** 212 exported types

---

## Purpose of This Document

This document catalogs the complete reinforcement data model from Allplan 2022's shared reinforcement library (`NemReinforcement.dll`). It serves as a **domain reference** — not source code to copy, but a proven specification of what concepts, parameters, options, and relationships a production-grade reinforcement BIM tool needs to model.

## Why This Is Useful

Nemetschek has spent 30+ years refining this data model with thousands of engineering offices across Europe. The type system encodes:

- **Real engineering requirements** validated by structural engineers and building codes (EC2/DIN)
- **Edge cases discovered over decades** — parameters you might not think of until a user complains
- **The complete parameterization** needed for every reinforcement concept: bars, meshes, stirrups, anchorage, lap splices, concrete cover, bending forms, labels, and more

Instead of guessing what properties a "bending form definition" needs, this document tells you: lengths a through g, hook definitions, bending direction, mirroring, rounding rules, diameter constraints, and the full set of valid values for each.

## When to Use This Document

| Scenario | Use this document |
| --- | --- |
| Designing your data model / TypeScript interfaces | ✅ Reference the properties for each concept |
| Building parameter dialogs / property grids | ✅ Enum values define dropdown options |
| Validating user input | ✅ Check validation rules and constraints |
| Writing reinforcement algorithms | ✅ Understand what parameters the algorithm receives |
| Implementing IFC export for rebar | ✅ Map to `IfcReinforcingBar` / `IfcReinforcingMesh` properties |
| Avoiding missing edge cases | ✅ Scan properties you might not have considered |

**Do NOT use this for:** copying code verbatim (copyright), learning C++ algorithms (this is the .NET data layer), or replacing engineering judgment (standards compliance is your responsibility).

---

## Data Model Overview

The `NemReinforcement.dll` assembly is organized into these functional areas:

```text
Nemetschek.NemReinforcement
├── PG_Data/          ← PropertyGrid data classes (the core data model)
├── Converters/       ← Type converters for UI binding (string ↔ value)
├── Editors/          ← UITypeEditors for PropertyGrid custom editing
├── Forms/            ← Windows Forms dialogs for complex parameter editing
├── UserControls/     ← Reusable controls (bending type list, stirrup list, etc.)
├── StringTables/     ← Help strings for property descriptions
└── Descriptor/       ← DynamicTypeDescriptors for PropertyGrid metadata
```

**Key insight:** The `PG_Data.*` classes define **what parameters exist**. The `Converters.*` classes define **what values are valid**. The `Editors.*` classes define **how users pick values**. The `Forms.*` classes are **specialized dialogs** for complex multi-parameter editing.

---

## Core Data Classes (PG_Data)

### PG_ReinforcementBaseInfo

**Purpose:** Fundamental reinforcement bar properties

```typescript
// TypeScript representation based on decompiled types
interface ReinforcementBaseInfo {
  positionNumber: number;               // Int32 - Bar mark/position number
  steelGrade: number;                   // UInt32 - Steel grade (B500, etc.)
  bendingFormDisplay: BiegFormDarstTyp; // How bending form is displayed
  mirrorBendingForm: boolean;           // Mirror the bending form
  presetName: string;                   // "Bew_Voreinstell" - preset configuration name
}
```

**Enum: BiegFormDarstTyp** — Bending form display type (exact values in C++ resource DLL)

---

### PG_Reinforcement3DPlacement

**Purpose:** 3D bar placement parameters

```typescript
interface Reinforcement3DPlacement {
  placementFrom: number;          // Double - Start of placement zone
  placementTo: number;            // Double - End of placement zone  
  placementDirection: boolean;    // Direction flag
  reinforcementDescription: boolean; // Show description
  bendingFormDisplay3D: e3DPlacementTyp; // 3D bending form display type
}
```

**Enum: e3DPlacementTyp** — 3D placement display type

---

### PG_Bending_Data

**Purpose:** Complete bending form definition for reinforcement bars

```typescript
interface BendingData {
  isImmutable: boolean;       // Can this bending form be modified?
  type: NmBwBiegeformTyp;    // Bending form type (shape catalog index)
  
  // Segment lengths (a through g)
  length_a: number;           // Double
  length_a_modifiable: boolean; // Is this length editable?
  length_b: number;
  length_b_modifiable: boolean;
  length_c: number;
  length_c_modifiable: boolean;
  // ... lengths d, e, f, g with same pattern
  
  // Bar diameter
  diameter: number;           // Double
  
  // Hooks at bar ends
  hookStart: Hook;            // Hook definition (start)
  hookEnd: Hook;              // Hook definition (end)
}
```

---

### PG_ConcreteCover_Data

**Purpose:** Concrete cover specifications for bars and stirrups

```typescript
interface ConcreteCoverData {
  type: eConcreteCoverType;       // Cover type classification
  
  // Stirrup cover
  cc_StirrupEqual: boolean;        // All stirrup covers equal?
  cc_StirrupEqualValue: number;    // Single value if equal
  cc_Stirrup1: number;             // Individual stirrup cover values
  cc_Stirrup2: number;
  // ... up to cc_Stirrup11 (11 values total)
  
  // Bar cover
  cc_BarsEqual: boolean;           // All bar covers equal?
  cc_BarsEqualValue: number;       // Single value if equal
  cc_Bars1: number;                // Individual bar cover values
  // ... up to cc_Bars11 (11 values total)
}
```

**Enum: eConcreteCoverType** — Classification of concrete cover configuration

---

### PG_AnchoringLength_Data

**Purpose:** Anchorage length calculation parameters (per EC2/DIN)

```typescript
interface AnchoringLengthData {
  length: number;              // Double - Calculated/input anchorage length
  concreteStrength: number;    // Double - Concrete grade
  steelStrength: number;       // Double - Steel grade
  surface: number;             // Int32 - Bar surface condition (smooth/ribbed)
  lengthIsModifiable: boolean; // Can user override calculated length?
  isMesh: boolean;             // Mesh reinforcement flag
  meshArea: number;            // Double - Mesh cross section area
  barSpacing: number;          // Double - Bar spacing
}
```

---

### PG_UeberGreifLanR_Data

**Purpose:** Lap splice / overlap length calculation parameters

```typescript
interface OverlapLengthData {
  diameter: number;            // Double - Bar diameter
  steelGrade: number;          // UInt32 - Steel grade
  concreteGrade: number;       // UInt32 - Concrete grade
  isCompressionBar: boolean;   // Compression bar flag ("Druck_stab")
  bondCondition: ValVerbundbereich; // Bond condition (good/poor)
  areaRatio: number;           // Double - Steel area ratio (As,req/As,prov)
  rounding: ValRunden;         // Rounding rule
  offset: number;              // Double - Length offset ("Laengversatz")
  // ... +15 more properties
}
```

**Key concept:** EC2 §8.7.3 defines lap length = α1·α2·α3·α5·α6·lb,rqd ≥ l0,min. This class captures all parameters needed for that calculation.

---

### PG_VerAnkLanR_Data

**Purpose:** Anchorage length catalog data

```typescript
interface AnchorageLengthCatalogData {
  isImmutable: boolean;
  catalogType: TypOfCatalogueAL;   // Standard or user-defined catalog
  standard: REINFORCEMENT_STANDARD; // DIN, EC2, ÖNORM, etc.
  steelGrade: number;
  concreteGrade: number;
  steelGradeRoundBar: number;      // Separate grade for smooth bars
  concreteGradeRoundBar: number;   // Separate grade for smooth bars
  diameter: number;
  // ... +22 more properties
}
```

**Enum: TypOfCatalogueAL** — Anchorage length catalog type (standard/user)

---

### PG_BewRandEinf_Data

**Purpose:** Edge reinforcement data (the most complex entity — 60+ properties)

```typescript
interface EdgeReinforcementData {
  precastType: FertigteilType;     // Precast element type
  factory: number;                 // Factory/production ID
  standard: number;                // Reinforcement standard code
  isImmutable: boolean;
  type: EraTyp;                    // Edge reinforcement type
  concreteGradeCatalogAddress: number; // Catalog address for concrete grades
  steelGradeCatalogAddress: number;    // Catalog address for steel grades
  barDiameter: number;             // Main bar diameter
  
  // ERA upper reinforcement layer
  eraUpperForm: EraObereBewForms;  // Upper form type
  
  // ERA lower reinforcement layer
  eraLowerForm: EraUntereBewForms; // Lower form type
  
  // Stirrup
  stirrupType: BuegelTyp;          // Open/closed stirrup
  closedStirrupType: GeschlossenerBuegelTyp; // Closed stirrup variant
  
  // Spacing
  barSpacing: number;
  barCount: number;
  placementLength: number;
  
  // Concrete cover (inherited pattern)
  // ... +40 more properties covering edge cases
}
```

---

### PG_GlobalSetzen_Data

**Purpose:** "Global Set" — batch apply reinforcement properties to multiple bars

```typescript
interface GlobalSetData {
  switch: EB;              // On/off toggle per property
  diameter: number;
  barSpacing: number;
  barCount: number;
  placementLength: number;
  legLength: number;       // "Schenkellange" - stirrup leg length
  concreteCover: number;
}
```

---

### PG_GlobalErsetzen_Data

**Purpose:** "Global Replace" — batch replace properties on existing bars

```typescript
interface GlobalReplaceData {
  oldDiameter: number;
  newDiameter: number;
  oldSpacing: number;
  newSpacing: number;
  oldCount: number;
  newCount: number;
  oldPlacementLength: number;
  newPlacementLength: number;
  // ... +6 more old/new property pairs
}
```

---

### Hoehenbezug_Data (Height Reference)

**Purpose:** Vertical positioning reference for reinforcement layers

```typescript
interface HeightReferenceData {
  // Top layer
  topStandard: number;            // Standard top offset
  topType: Ober_Typs;             // Top reference type
  topSpacingType: AbstandTyps;    // Top spacing type (absolute/relative)
  topSpacing: number;             // Top spacing value
  
  // Bottom layer
  bottomStandard: number;
  bottomType: Unter_Typs;
  bottomSpacingType: AbstandTyps;
  bottomSpacing: number;
  
  // Layer mode and validation
  mode: Hoehenbezug_Mode;
  isFullUpdate: boolean;
  // ... +42 more methods for UI interaction and validation
}
```

**Enum: Hoehenbezug_Mode** — Height reference calculation mode  
**Enum: Ober_Typs** — Top reference types  
**Enum: Unter_Typs** — Bottom reference types  
**Enum: AbstandTyps** — Spacing type (absolute distance / relative ratio)

---

### Hook Definitions

```typescript
interface Hook {
  isTurnedOn: boolean;
  hookAngle: HookAngle;
  hookLength: HookLength;
}

interface HookAngle {
  angleType: HookAngleType;    // Predefined angle type
  angleValue: number;           // Custom angle value
}

interface HookLength {
  length: number;               // Manual length
  calculatedLength: number;     // Calculated length (per code)
}

enum HookAngleType {
  // Predefined angle presets (e.g., 90°, 135°, 180°)
}
```

---

### Reference Point Data

```typescript
interface RefPointData {
  coordX: number;           // X coordinate
  coordY: number;           // Y coordinate
  b: number;                // Width
  h: number;                // Height
  type: RefPointType;       // Reference point type
  isByCoordinates(): boolean;
}

enum RefPointType {
  // Point definition modes (by coordinates, by element edge, etc.)
}
```

---

### Mesh Reinforcement

```typescript
interface ReinforcingMesh {
  meshName: string;
  meshLength: number;
  meshWidth: number;
  diameterLongitudinal: number;    // Diameter in L direction
  diameterTransverse: number;      // Diameter in Q direction
  areaLongitudinal: number;        // Cross-section area L
  areaTransverse: number;          // Cross-section area Q
  barDistanceLongitudinal: number; // Bar spacing L
  barDistanceTransverse: number;   // Bar spacing Q
}
```

---

### Material & Supply Chain Data

```typescript
interface ExtendedElementData {
  isLfdm: boolean;                  // "Lfdm" flag
  lengthFactor: number;             // "LaengeFaktor"
  installationLocation: Einbauort;  // Where it's installed
  manufacturer: Hersteller;         // Manufacturer catalog
  supplier: Lieferant;              // Supplier catalog
  availability: Verfugbarkeit;      // Availability status
}
```

---

## Label & Annotation System

### Text Options

```typescript
interface TextOptions {
  font: number;           // Font ID
  fontName: string;       // Font name
  height: number;         // Text height
  width: number;          // Text width
  ratio: number;          // Width/height ratio
  fontAngle: number;      // Text rotation angle
  penThickness: number;   // Line thickness
  penColor: number;       // Line color
  // ... +2 more
}

interface MarkNumberTextOptions extends TextOptions {
  outlinePenThickness: number;
  outlinePenColorFromElement: boolean;
  outlinePenColor: number;
}
```

### Pointer Options

```typescript
interface PointerOptions {
  labelType: LabelTypForOptionsData; // Label type for options
  endSymbol: number;                 // Arrow/end symbol type
  endSymbolSize: number;             // Symbol size
  penThickness: number;
  penStroke: number;                 // Line stroke pattern
  penColor: number;
}
```

### Label Types

- **Bar Placement Label** (`PG_Label_BarPlacement_TextOptions_Data`): Text for placement lines
- **Mesh Label** (`PG_Label_Mesh_TextOptions_Data`): Text for mesh reinforcement
- **Mark Symbol Label** (`PG_Label_MarkSymbols_TextOptions_Data`): Position mark symbols

---

## Complete Enumeration Catalog

### Reinforcement Types

| Enum | German Name | English | Description |
| --- | --- | --- | --- |
| `EraTyp` | Randbewehrung Typ | Edge Reinforcement Type | ERA shape family |
| `EraObereBewForms` | ERA Obere Bewehrungsformen | ERA Upper Forms | Upper layer ERA styles |
| `EraUntereBewForms` | ERA Untere Bewehrungsformen | ERA Lower Forms | Lower layer ERA styles |
| `BuegelTyp` | Bügeltyp | Stirrup Type | Open/closed stirrup variants |
| `GeschlossenerBuegelTyp` | Geschlossener Bügeltyp | Closed Stirrup Type | Subtypes of closed stirrups |
| `BiegeFormTyp` | Biegeformtyp | Bending Form Type | Standard bending shape catalog |
| `EisenTyp` | Eisentyp | Bar Type | Bar classification |
| `FFBuegelForm` | FF Bügelform | Precast Stirrup Form | Stirrup form for precast elements |
| `SchBesch` | Schenkelbeschriftung? | Leg Label | Leg dimension label options |

### Anchorage & Connection

| Enum | German Name | Description |
| --- | --- | --- |
| `Verankerungsart` | Verankerungsart | Anchorage type (straight, bent, hook, loop) |
| `VerankerungsLage` | Verankerungslage | Anchorage position (top/bottom layer) |
| `HookType` | Hakentyp | Hook type (90°, 135°, 180°, custom) |
| `BRD_Typ` | Bewehrungsrand Typ? | Reinforcement edge type |
| `Anwendungsfall` | Anwendungsfall | Application case (for code-based rules) |
| `AngeschweissterQuerstab` | Angeschweißter Querstab | Welded transverse bar presence |
| `Biegerichtung` | Biegerichtung | Bending direction |

### Length & Measurement

| Enum | German Name | Description |
| --- | --- | --- |
| `Val_LaengeTyp` | Längentyp | Length type classification |
| `AbtreppTyp` | Abtreppungstyp | Stepping/staggering type |
| `ValRunden` | Rundungsregel | Rounding rule (up/down/nearest) |

### Positioning

| Enum | German Name | Description |
| --- | --- | --- |
| `EisenLage` | Eisenlage | Bar layer (top/bottom/middle) |
| `Einbauort` | Einbauort | Installation location |
| `EisLanBer` | Eisenlänge/bereich? | Bar length/range |
| `RefLineType` | Referenzlinientyp | Reference line type |
| `RefPointType` | Referenzpunkttyp | Reference point type |
| `OrientationOfDimensions` | Maßorientierung | Dimension orientation |
| `SymbolOfLayerLocation` | Lagesymbol | Layer location symbol |
| `MeshLabelAngleTyp` | Mattenbeschriftungswinkel | Mesh label angle type |

### Supply Chain

| Enum | German Name | Description |
| --- | --- | --- |
| `Hersteller` | Hersteller | Manufacturer catalog |
| `Lieferant` | Lieferant | Supplier catalog |
| `Verfugbarkeit` | Verfügbarkeit | Availability status |

### Validation

| Enum | German Name | Description |
| --- | --- | --- |
| `ValElBeziehung` | Elementbeziehung | Element relationship (for validation) |
| `ActivityType` | Aktivitätstyp | Activity type |

### UI Configuration

| Enum | German Name | Description |
| --- | --- | --- |
| `SchenkelBeschriftung` | Schenkelbeschriftung | Leg label configuration |
| `LabelTypForOptionsData` | Beschriftungstyp | Label type for options |
| `PointerTyp` | Zeigertyp | Pointer/leader type |
| `EB` | Ein/Aus? | On/off switch (for global set/replace) |

---

## Validation & Constraints

The data model includes built-in validation commands that enforce reinforcement rules:

| Validator | Validates |
| --- | --- |
| `ConcreteCover_Stirrup` converter | Stirrup cover values are valid (range, standard values) |
| `ConcreteCover_Bars` converter | Bar cover values are valid |
| `TextWidth_ValidationCommand` | Text width is within valid range |
| `HoehenbezugValidator` | Height reference values are consistent |
| `PG_IngBauAnchoringLength_Data_Validation` | Anchorage length data is valid per code |
| `Converter_Diameter` | Diameter exists in cross-section catalog |
| `Converter_ReinforcementDiameter` | Diameter valid for element type and factory |

---

## Data Flow Architecture

How the data classes relate to each other:

```
AllPG_Data (aggregate root)
├── PG_ReinforcementBaseInfo          ← Bar identity (position #, steel grade)
├── PG_Reinforcement3DPlacement       ← Where the bar goes (zone, direction)
├── PG_Bending_Data                   ← Bar shape (lengths a-g, hooks)
├── PG_ConcreteCover_Data             ← Cover requirements (10 values)
├── PG_AnchoringLength_Data           ← Anchorage calculation inputs
├── PG_UeberGreifLanR_Data            ← Lap splice calculation inputs
├── PG_VerAnkLanR_Data                ← Anchorage length catalog
├── PG_BewRandEinf_Data               ← Edge reinforcement (60+ properties)
├── Hoehenbezug_Data                  ← Height/offset reference
├── PG_PointerOptions_Data            ← How labels point to bars
├── PG_TextOptions_Data               ← Text formatting for labels
└── PG_Label_*_TextOptions_Data       ← Specialized label configs
```

**Write patterns:**

- `WriteDatFile()` — Serializes all reinforcement data to `.dat` files
- `WriteDatFile_All()` — Serializes with section and designation headers
- `PropertiesToSTW()` — Converts properties to STW (internal format)

**Serialization/Deserialization:**

- `Alloc_PG_Data()` — Allocates array for multiple bending forms/cover sets
- `Realloc_PG_Data(length)` — Resizes the data arrays
- `GetSerializedClass()` — Returns serializable version
- `UpdateAfterDeserialize()` — Post-deserialization fixup

---

## What This Tells You About Building a Reinforcement Tool

### 1. Concrete Cover Is Complex

Allplan models **11 separate cover values** for bars and stirrups, plus an "all equal" shortcut. If you only model one cover value, you'll hear from engineers on day one.

### 2. Bending Forms Need 7+ Segment Lengths

The bending form model (lengths a through g) captures every standard shape from DIN/ISO 3766 bar bending shapes.

### 3. Anchorage and Lap Splice Are Calculation-Heavy

These aren't simple input fields — they're calculation engines that take material grades, bar conditions, and area ratios as inputs, then compute code-compliant lengths.

### 4. Height References Need Layer Awareness

Top/bottom layers, absolute vs. relative spacing, and multiple reference types mean height positioning is more nuanced than a simple "cover" value.

### 5. Batch Operations Need Before/After Models

`GlobalSetzen` (global set) and `GlobalErsetzen` (global replace) are essential workflows. Users don't edit bars one at a time — they modify groups.

### 6. Labels Are a First-Class Feature

Four separate label configuration data classes (bar placement, mesh, mark symbols, pointer options) plus text formatting show that reinforcement annotation is as important as the bars themselves.

---

## Relationship to Other Modules

From the install directory structure:

| Module | Relationship to NemReinforcement.dll |
| --- | --- |
| `NP_ReinfPlacement.dll` | WPF UI that binds to these data classes |
| `NP_CircularAreaReinf.dll` | Circular section UI (also binds these classes) |
| `NP_ReinfGroup.dll` | Bar grouping — uses these data types |
| `NP_ReinfLabeling.dll` | Label placement — uses label data classes |
| `NP_BewRandEinf.dll` | Edge reinforcement — uses `PG_BewRandEinf_Data` |
| `Bew2000.dll` (C++) | Native solver that receives data from these classes |
| `NBewGen11.exe` | .NET wrapper calling Bew2000 with this data |
| `NemIng_BVBS.dll` (C++) | BVBS export — reads bending form data |
| `NemIng_ReinfGen10.dll` (C++) | Reinforcement generation — consumes placement data |

---

## Key Terminology (German ↔ English)

| Allplan German Term | English Translation | Notes |
| --- | --- | --- |
| Bewehrung | Reinforcement | General term for rebar |
| Eisen | Bar / Iron | Individual reinforcing bar |
| Bügel | Stirrup | Closed reinforcement in beams/columns |
| Matte | Mesh | Welded wire mesh |
| Betondeckung | Concrete Cover | Distance from bar surface to concrete surface |
| Verankerung | Anchorage | Bar end anchorage in concrete |
| Übergreifung | Lap Splice | Overlapping bars for continuity |
| Biegeform | Bending Form | Bar shape after bending |
| Schenkel | Leg | Segment of a bent bar or stirrup |
| Randbewehrung (ERA) | Edge Reinforcement | Reinforcement at element edges |
| Stahlgüte | Steel Grade | Steel quality class (e.g., B500) |
| Betongüte | Concrete Grade | Concrete quality class (e.g., C25/30) |
| Höhenbezug | Height Reference | Vertical positioning reference |
| Verlegeart | Placement Method | How bars are placed |
| Positionsnummer | Position Number | Bar mark/schedule number |
| Biegerolle | Bending Roller | Mandrel diameter for bending |
| Verbundbereich | Bond Condition | Good/poor bond conditions per EC2 |
| Haken | Hook | Bar end hook |

---

## Usage Guidelines for AI Sessions

When using this document as context in other AI sessions:

1. **Reference specific sections** — e.g., "See `PG_ConcreteCover_Data` in the Allplan reference for the 11-value cover model"
2. **Use enum names** — they're the terminology engineers expect
3. **Match the parameter hierarchy** — BaseInfo → 3DPlacement → Bending is the natural workflow
4. **Don't reinvent validation rules** — the converters and validation commands document what's considered valid

This document is a **domain model blueprint**, not implementation instructions. The algorithms that compute anchorage length, bar placement positions, or BVBS output must be built from engineering standards (EC2, DIN, ISO), not from this data model alone.
