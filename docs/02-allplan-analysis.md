# 02 — Allplan 2022 Installation Analysis

> **Back to:** [README.md](../README.md)  
> **Related:** [Module Architecture](./05-module-architecture.md) | [Reinforcement Data Model](./04-reinforcement-data-model.md) | [Reference Data](./06-reference-data.md)

---

## Source

```
C:\Program Files\Allplan\Allplan\2022\
```

**Total size:** 3.3 GB in `Prg/` alone  
**Binaries:** ~1,393 DLLs, ~84 EXEs  
**Framework:** .NET Framework 4.7.1 (WPF UI) + Native C++ (geometry/solver core)

---

## Directory Structure

| Directory | Purpose | Useful? |
|---|---|---|
| `Prg/` | Main binaries — all DLLs and EXEs | ✅ Architecture insights |
| `New/` | Project templates, steel catalogs, fonts | ✅ Steel grade data, country standards |
| `Usr/` | User-specific data (`Local/` only) | ❌ Empty/minimal |
| `Cod/` | Code/config resources | ❌ Not explored |
| `Schemas/` | 85 `.s_t` schema files (ASCII) | ❌ Character set definitions only |
| `Hlp/` | Help system (`.hm` compiled help) | ❌ |
| `Hot/` | TeamViewerQS.exe (remote support) | ❌ |
| `Menu/`, `Icons/`, `ToolTip/` | UI resources | ❌ |
| `Adobe 10.0/` | Adobe PDF engine (embedded) | ❌ |

---

## What's Useful — By Category

### ✅ HIGH VALUE: .NET Assemblies (Decompilable)

These can be decompiled to readable C# using ILSpy/dnSpy or .NET reflection:

| Assembly | Types | Content | Value |
|---|---|---|---|
| `NemReinforcement.dll` | **212 types** | Complete reinforcement data model, enums, converters, validation | 🔴 **Essential reference** — see [Reinforcement Data Model](./04-reinforcement-data-model.md) |
| `NBewGen11.exe` | 5 types | Thin .NET wrapper (colors, attributes, GUIDs) | 🟢 Low — mostly calls C++ |
| `NP_ReinfPlacement.dll` | 17 types | WPF UI layer (views, dialog event handlers) | 🟡 Medium — reveals UI workflow |
| `NP_CircularAreaReinf.dll` | 7 types | UI interfaces only | 🟢 Low |
| `NemReinforcement.XmlSerializers.dll` | N/A | XML serialization helpers | 🟡 Medium — reveals serialization format |

**Key finding:** The .NET layer is the **data model and UI**, not the algorithms. Real solvers are in C++.

### ✅ HIGH VALUE: Reference Data Files

| File | Content | Value |
|---|---|---|
| `New/Ing/adeuqusr.txt` | Steel grade catalog — B500, diameters 4.0-50mm, weights, areas | 🔴 Directly usable |
| `New/Ing/a???qusr.txt` | 30+ country variants (aeng=UK, afra=France, aaus=Australia, etc.) | 🔴 Full international steel database |
| `New/Ing/abelqusr.txt` | Belgian standard | 🟡 |
| `New/femmat.dat` | FEA material data | 🟢 |

See [Reference Data Catalog](./06-reference-data.md) for extracted data.

### ✅ HIGH VALUE: Module Architecture

From DLL names alone, we can map Allplan's reinforcement module organization. See [Module Architecture](./05-module-architecture.md) for complete map.

### ✅ MEDIUM VALUE: Configuration Files

| File | Content |
|---|---|
| `Prg/Plugins/applicationSettings.xml` | Plugin loader, observer pattern configuration, module registration |
| `Prg/startup_PythonParts.xml` | PythonParts module registration |
| `Prg/startup_SmartParts.xml` | SmartParts module registration |
| `Prg/Allplan_2022.exe.config` | .NET binding redirects, supported runtime version |

**Key finding:** Allplan uses an **observer pattern** for reactivity (`OBSERVER_LOAD`, `OBSERVER_DELETEOBJECT`, `OBSERVER_UNDOREDO`, `OBSERVER_SAVE`).

### ❌ LOW/NO VALUE

| Item | Why not useful |
|---|---|
| `Bew2000.dll` + ~50 `Bew*.dll` | Native C++ binaries — need disassembler (IDA Pro), not practical |
| `SPA*` / `SPAX*` (61 DLLs) | ACIS/Spatial geometry kernel — proprietary, no source |
| `TD_*` / `TB_*` (63 modules) | ODA/Teigha DWG kernel — proprietary |
| `Cineware/` | Cinema 4D renderer — irrelevant to rebar |
| `Python/DLLs/` | Standard Python 3.8 — not Allplan-specific |
| `.pyd` files | Compiled C Python extensions — not readable |
| `Schemas/*.s_t` | Font/character set definitions |
| `Hlp/*.hm` | Compiled help files |

---

## Key Technical Insights

### 1. The Split Architecture

Allplan is a **two-layer cake**:
- **Bottom:** Native C++ for geometry, solvers, rendering (ACIS, ODA, Bew2000, Cineware)
- **Top:** .NET Framework + WPF for UI, data binding, dialogs (NemReinforcement, property grids)

The .NET layer doesn't contain algorithms — it's a data model and UI shell over the C++ core.

### 2. The 2000 Naming Legacy

DLLs with `*2000` in their name (`Bew2000.dll`, `KonstAstron2000.dll`, `Mod3D2000.dll`) are from the Allplan 2000 generation and still in use 22+ years later. These are the ones causing the performance and maintenance burden.

### 3. Reinforcement Specifically

The reinforcement system is split across three layers:
- **C++ solvers:** ~50 `Bew*.dll` (one DLL per shape variant), `BewNormFC.dll` (code checks), `NBewGen11.exe` (generation)
- **.NET data model:** `NemReinforcement.dll` (212 types — shared data definitions)
- **.NET UI:** `NP_ReinfPlacement.dll`, `NP_ReinfGroup.dll`, `NP_ReinfLabeling.dll` (WPF palettes)

### 4. What We Would Do Differently

| Allplan approach | Our approach | Why |
|---|---|---|
| One DLL per reinforcement shape (25 wall variants + 5 stair variants) | One parametric shape engine with JSON definitions | 30 DLLs → 1 function + 30 JSON files |
| ACIS for all solid modeling | Simplified CSG + distance-field collision | 61 DLLs → 1 Rust crate |
| Proprietary binary format (`ztg000.000`) | IFC as native format | Open standard, web-compatible |
| WPF + MFC mixed UI | React + Three.js in browser | Modern, cross-platform |
| Single-threaded C++ | Parallel WASM + WebGPU compute | Scale with cores |
| C++/CLI interop overhead | Pure TypeScript/Rust via WASM | No interop, no GC overhead |

---

## Decompilation Capability

With access to the Allplan folder, .NET assemblies can be decompiled using:

```powershell
# Windows PowerShell 5.1 (not pwsh 7 — needs .NET Framework)
$asm = [System.Reflection.Assembly]::LoadFrom('C:\Program Files\Allplan\Allplan\2022\Prg\NemReinforcement.dll')
$asm.GetExportedTypes() | ForEach-Object { $_.FullName }
```

The decompilation script is at `scripts/decompile-allplan-dll.ps1`.

**Note:** PowerShell 7 (pwsh) runs on .NET Core and cannot load .NET Framework assemblies. Use `powershell` (v5.1) instead.

---

## What We Still Don't Know

| Gap | How to fill |
|---|---|
| Exact bar shape definitions (segment lengths, bend angles) | Would need C++ reverse engineering — not worth it. Use DIN/ISO 3766 shape catalog instead. |
| Reinforcement placement algorithm (spacing on faces) | Would need C++ reverse engineering. Implement from EC2/DIN rules instead. |
| BVBS export format details | BVBS is an open DIN standard. No reverse engineering needed. |
| IFC export mapping for reinforcement | IFC schema is public. Map from our data model to IfcReinforcingBar. |