# 06 — Reference Data Catalog

> **Back to:** [README.md](../README.md)  
> **Related:** [Allplan Analysis](./02-allplan-analysis.md) | [Reinforcement Data Model](./04-reinforcement-data-model.md)

---

## Source

```
C:\Program Files\Allplan\Allplan\2022\New\Ing\
```

Contains 30+ country-specific reinforcement standard files. Format: `a[3-letter country code]qusr.txt`

---

## File Encoding

Files are **UTF-16LE** with a BOM. Standard `cat` or `head` shows null bytes between ASCII characters. Need to convert or use proper Unicode reader.

---

## Structure of Steel Grade Files

Each file is an INI-like format with sections:

```ini
[Steel0001]
CrossSectionName=Mattenquerschnitte    # "Mesh cross-sections" (or "Stabstahl" for bar steel)
SteelName=B500
ShortName=B500
SteelIndex=0
SteelStrength=500

[Steel0001Diameter0001]
Name=4.0
Value=4          # mm
Weight=0.099     # kg/m
Area=0.126       # cm²

[Steel0001Diameter0002]
Name=4.5
Value=4.5
Weight=0.125
Area=0.159

... (continues through all diameters for this steel grade)

[Steel0002]
CrossSectionName=Stabstahlquer...
SteelName=B500B
...
```

**German terminology in files:**
- `Mattenquerschnitte` = Mesh cross-sections
- `Stabstahl` = Bar steel
- `Stabstahlquerschnitte` = Bar steel cross-sections

---

## Country Code Map

| File | Country | Standard |
|---|---|---|
| `adeuqusr.txt` | Germany | DIN 488 / EC2 |
| `aengqusr.txt` | United Kingdom | BS 4449 |
| `afraqusr.txt` | France | NF A35-080 |
| `aitaqusr.txt` | Italy | DM 2018 |
| `apolqusr.txt` | Poland | PN-H-93220 |
| `aausqusr.txt` | Austria | ÖNORM B 4707 |
| `abelqusr.txt` | Belgium | NBN |
| `achnqusr.txt` | China | GB 50010 |
| `aswiqusr.txt` | Switzerland | SIA 262 |
| `arusqusr.txt` | Russia | GOST |
| `ausaqusr.txt` | USA | ASTM A615 |
| `asvnqusr.txt` | Slovenia | SIST |
| `atrkqusr.txt` | Turkey | TS 708 |
| `anorqusr.txt` | Norway | NS 3576 |
| `aslkqusr.txt` | Slovakia | STN |
| `aholqusr.txt` | Netherlands | NEN 6008 |
| `ahrvqusr.txt` | Croatia | HRN |
| `aindqusr.txt` | India | IS 1786 |
| `akorqusr.txt` | Korea | KS |
| `arumqusr.txt` | Romania | STAS |
| `azafqusr.txt` | South Africa | SANS 920 |
| `aautqusr.txt` | — | — |
| `abraqusr.txt` | — | — |
| `abulqusr.txt` | — | — |
| `acanqusr.txt` | — | — |
| `adeuqusr.txt` (mod variants) | — | Modified/custom variants |

---

## Typical Diameters Found in Steel Catalogs

From `adeuqusr.txt` (Germany, B500):

| Ø (mm) | Weight (kg/m) | Area (cm²) |
|---|---|---|
| 4.0 | 0.099 | 0.126 |
| 4.5 | 0.125 | 0.159 |
| 5.0 | 0.154 | 0.196 |
| 5.5 | 0.187 | 0.238 |
| 6.0 | 0.222 | 0.283 |
| 6.5 | 0.260 | 0.332 |
| 7.0 | 0.302 | 0.385 |
| 7.5 | 0.347 | 0.442 |
| 8.0 | 0.395 | 0.503 |
| 10.0 | 0.617 | 0.785 |
| 12.0 | 0.888 | 1.131 |
| 14.0 | 1.208 | 1.539 |
| 16.0 | 1.578 | 2.011 |
| 20.0 | 2.466 | 3.142 |
| 25.0 | 3.853 | 4.909 |
| 28.0 | 4.834 | 6.158 |
| 32.0 | 6.313 | 8.042 |
| 40.0 | 9.865 | 12.566 |
| 50.0 | 15.413 | 19.635 |

**Formula:** Weight (kg/m) = π × (d/1000)² / 4 × 7850 (steel density)  
**Formula:** Area (cm²) = π × (d/10)² / 4

---

## How to Use This Data

### For Our Application

```typescript
// steel-catalog.ts — JSON format derived from Allplan data files
interface SteelGrade {
  id: string;
  name: string;          // e.g., "B500B"
  shortName: string;     // e.g., "B500"
  standard: string;      // e.g., "DIN 488", "EC2"
  strength: number;      // MPa, e.g., 500
  crossSectionType: "bar" | "mesh";
  diameters: SteelDiameter[];
}

interface SteelDiameter {
  name: string;          // e.g., "12.0"
  value: number;         // mm
  weight: number;        // kg/m
  area: number;          // cm²
}

interface SteelCatalog {
  countryCode: string;   // e.g., "DEU"
  countryName: string;   // e.g., "Germany"
  grades: SteelGrade[];
}
```

### Recommended Defaults

For the PoC, ship with:
- **Germany (DIN/EC2):** B500B bar steel + B500A mesh steel
- **UK (BS):** B500B
- **France (NF):** B500B

Other country catalogs can be loaded on demand or added later.

---

## Other Useful Data Files

| File | Location | Content | Value |
|---|---|---|---|
| `femmat.dat` | `New/femmat.dat` | FEM material data | 🟢 Low — analysis, not drawing |
| `femmat.deu` | `New/femmat.deu` | German localization of materials | 🟢 Low |
| `ztg000.000` | `New/ztg000.000` | Empty project template (binary) | 🟡 Medium — reveals blank project structure |
| `Viewer.ubx` | `New/Viewer.ubx` | Viewer configuration | 🟢 Low |

---

## What's Missing (Need External Sources)

| Data | Source |
|---|---|
| EC2/DIN reinforcement rules (cover, spacing, anchorage formulas) | Eurocode 2 (EN 1992-1-1), DIN 1045 |
| Bar bending shapes (DIN/ISO 3766) | Public standard — available online |
| BVBS format specification | BVBS standard (German rebar bending) |
| IFC schema for reinforcement | buildingsmart IFC4/IFC4.3 documentation |
| Concrete grade properties (C20/25, C25/30, etc.) | Eurocode 2 / national annexes |

---

## Extraction Status

| File | Status | Next step |
|---|---|---|
| `adeuqusr.txt` | ✅ Analyzed, structure understood | Full extraction to JSON |
| `aengqusr.txt` | ⬜ Not extracted | Extract to JSON |
| `afraqusr.txt` | ⬜ Not extracted | Extract to JSON |
| Other country files | ⬜ Not extracted | Extract on demand |

**Extraction script** (to be run in a session with access to the Allplan folder):

```powershell
# powershell - extract Allplan steel catalog to JSON
$files = Get-ChildItem "C:\Program Files\Allplan\Allplan\2022\New\Ing\a???qusr.txt"
foreach ($f in $files) {
    $content = Get-Content $f.FullName -Encoding Unicode
    # Parse [Section] headers and Key=Value pairs
    # Output as JSON
}
```