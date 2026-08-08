# 07 — Browser Feasibility Analysis

> **Back to:** [README.md](../README.md)  
> **Related:** [Project Vision](./01-project-vision.md) | [Tech Stack](./03-tech-stack.md)

---

## Can Each Core Feature Run in the Browser?

### 1. 3D Concrete Element Modeling ✅ Feasible

| Aspect | Approach | Risk |
|---|---|---|
| Wall/column/beam creation | Three.js + CSG (extrusion + Boolean subtract) | Low |
| Slab modeling | Planar polygon with thickness | Low |
| Opening creation | CSG subtract (box from solid) | Low |
| Editing (move, resize) | Three.js transform controls + CSG recompute | Low |
| Visual quality | MeshPhongMaterial with concrete texture | Low |

**What we DON'T need:** Full BREP kernel, NURBS surfaces, freeform modeling

**Library options:**
- `three-csg` or `@jscad/csg` — lightweight CSG
- OpenCASCADE.js — full BREP, but 30MB+ WASM, overkill for PoC

---

### 2. Automated Sections and Views ✅ Feasible (hardest feature)

> **Updated 2026-07-28** — Standard elements don't need mesh slicing: see the two-tier strategy in Architecture Spec §G. **Tier 1** (parametric query: profile lookup at position X + plane-polyline bar intersection + depth-window projection) covers native walls/slabs/beams/columns with pure math — no BREP kernel, no watertightness dependency. The mesh-plane algorithm below applies to **Tier 2** (imported/irregular geometry) only.

| Aspect | Approach | Risk |
|---|---|---|
| Clipping plane intersection | Plane-mesh intersection in WASM | Medium |
| 2D projection | Orthographic projection to SVG/Canvas | Low |
| Concrete hatch patterns | SVG pattern fills (ISO/DIN standard patterns) | Low |
| Hidden lines | Depth-testing + dashed line rendering | Medium |
| Section markers in 3D | Three.js plane visualization | Low |

**Algorithm outline:**
```
1. Define clipping plane (position + normal)
2. For each concrete element:
   a. Compute intersection polygon(s) of plane with 3D mesh
   b. Classify faces (cut, visible, hidden)
3. For each reinforcement bar:
   a. Compute intersection point with plane
   b. Determine visibility (in front / behind)
4. Render:
   a. Cut concrete → hatch pattern fill, thick outline
   b. Visible rebar → solid circle at intersection point
   c. Hidden rebar → dashed circle
   d. Visible edges → solid lines
   e. Hidden edges → dashed lines
```

**This is computationally straightforward** — it's linear plane intersection with triangles and polylines. For 200 elements and 20,000 bars, a WASM implementation should complete in under 1 second.

---

### 3. Basic Edit Tools ✅ Straightforward

| Tool | Implementation | Risk |
|---|---|---|
| Copy | Clone geometry tree + offset matrix | Low |
| Mirror | Reflect matrix × geometry | Low |
| Move | Apply translation matrix | Low |
| Rotate | Apply rotation matrix | Low |
| Array (linear/polar) | Loop + progressive transform | Low |
| Offset | Expand/contract polygon (computational geometry) | Low |

All are **affine transforms** on geometry. React state + Three.js matrices handle this directly.

---

### 4. Dimension and Elevation Lines ✅ Medium

| Aspect | Approach | Risk |
|---|---|---|
| Linear dimensions | SVG lines + text in 2D views | Low |
| Elevation symbols | SVG markers (arrowheads, ticks) | Low |
| Associative updates | Reference geometry edge IDs → recompute on change | Medium |
| Dimension styles | CSS-configurable (lines, text, arrows) | Low |

**Key challenge:** Associative dimensions need to track which geometry they reference. Solution: each geometry edge gets a stable ID. When geometry changes, dimensions subscribe and recompute.

---

### 5. 3D Reinforcement ✅✅ Best Browser Candidate

| Aspect | Approach | Risk |
|---|---|---|
| Bar geometry generation | WASM: polyline path → cylinder mesh | Low |
| Placement on faces | WASM: face sampling + bar pattern | Medium |
| Collision detection | parry3d (spatial hash + distance checks) | Low |
| Visual rendering | Three.js instanced meshes (1 draw call per diameter) | Low |
| Bar selection | Three.js raycaster | Low |

**Why this is ideal for browser:**
- Bar geometry is simple (swept circle = cylinder chain)
- No Boolean operations needed (bars are independent meshes)
- Can be GPU-instanced for massive bar counts
- Collision is distance checks, not ACIS Boolean subtracts

**Performance projection (10,000 bars):**
- Bar mesh generation: ~50ms (WASM)
- Instanced rendering: ~2ms draw call (GPU instancing)
- Collision detection: ~100ms (spatial hash)
- Total: near-instantaneous

---

### 6. Automated Updates Across Views ✅ Medium

| Aspect | Approach | Risk |
|---|---|---|
| Dependency tracking | RTK + memoized selectors | Medium |
| Change propagation | Full recompute on change (simple, correct) | Low |
| Incremental update | Partial recompute (optimize later) | High (complex) |

**Strategy for PoC: recompute everything on change.**

```
User edits wall geometry
    ↓
Wall store updates
    ↓
All dependent views re-render:
    - 3D viewport (instant — just re-render Three.js)
    - Plan view (WASM section recompute, <200ms)
    - Section A (WASM recompute, <200ms)
    - Section B (WASM recompute, <200ms)
    - Rebar schedule table (react re-render)
    - Dimension lines (recompute from geometry)
```

This is the brute-force approach but works fine at PoC scale. Optimize to partial updates when needed.

---

### 7. Building Structure (Floors) ✅ Trivial

| Aspect | Approach | Risk |
|---|---|---|
| Tree model | React tree view + RTK store | Low |
| Floor assignment | Element has `storeyId` reference | Low |
| Elevation management | Storey has `elevation` value | Low |
| Visibility control | Show/hide by storey | Low |

```typescript
interface Building {
  name: string;
  storeys: Storey[];
}

interface Storey {
  id: string;
  name: string;
  elevation: number;     // meters above reference
  height: number;         // floor-to-floor
  elements: ElementId[];  // references to concrete elements
}
```

---

### 8. Import IFC, DXF

| Format | Feasibility | Library | Risk |
|---|---|---|---|
| **IFC** | ✅ | `web-ifc` (WASM IFC parser, production-ready) | Low |
| **DXF** | ✅ | `dxf-parser` (npm) or custom — ASCII text format | Low |
| **DWG** | ⚠️ | No good open-source option. Use DXF as workaround. | High |

**IFC notes:**
- `web-ifc` handles IFC2x3 and IFC4
- Extract geometry as Three.js BufferGeometry
- Map `IfcReinforcingBar`, `IfcWall`, `IfcSlab` to our internal model
- ~2-10 second parse time for typical files (in Web Worker)

**DXF notes:**
- DXF is a text format (can write a parser in a day)
- Limited to 2D linework — 3D solids are complex in DXF
- Recommendation: IFC for 3D, DXF for 2D reference drawings

---

### 9. Export PDF, DXF, IFC

| Format | Feasibility | Library | Risk |
|---|---|---|---|
| **PDF** | ✅ | `jsPDF` for vector output, or canvas→PDF | Low |
| **DXF** | ✅ | Custom writer — just text formatting | Low |
| **IFC** | ✅ | `web-ifc` write support, or custom STEP writer | Low |
| **BVBS** | ✅ | Custom text writer (DIN standard format) | Low |

---

### 10. Parametric Reinforcement Blocks ✅ Feasible

| Aspect | Approach | Risk |
|---|---|---|
| Block definitions | JSON schema + WASM evaluator | Low |
| Block editor UI | React form (generated from JSON schema) | Low |
| Preview | Three.js preview with live updates | Low |
| Placement | Click on element face → generate bars | Low |

```typescript
// Block definition
interface ReinforcementBlock {
  id: string;
  name: string;
  category: "wall" | "slab" | "beam" | "column" | "stair" | "foundation";
  parameters: BlockParameter[];
  generator: (params: Record<string, number>, geometry: ElementGeometry) => BarGroup[];
}

interface BlockParameter {
  name: string;
  type: "number" | "select";
  label: string;
  default: number;
  min?: number;
  max?: number;
  options?: { label: string; value: number }[];
  unit?: string;  // "mm", "°", "pcs"
}
```

**Implementation:**
- Block catalog is a JSON file (replace 50 C++ DLLs with ~30 JSON definitions)
- Generator function runs in WASM for performance
- UI auto-generates from parameter schema
- Users can create custom blocks → saved as JSON in project

---

## Overall Feasibility Scorecard

| Feature | Feasibility | Complexity | Performance Risk |
|---|---|---|---|
| 3D modeling | ✅ | Medium | Low |
| Sections/Views | ✅ | 🔴 High | Medium |
| Edit tools | ✅ | Low | Low |
| Dimensions | ✅ | Medium | Low |
| 3D reinforcement | ✅ | Medium | Low (best case) |
| Auto-updates | ✅ | Medium | Medium |
| Building structure | ✅ | Low | Low |
| IFC import | ✅ | Low | Low |
| DXF import | ✅ | Low | Low |
| DWG import | ⚠️ | High | — |
| PDF export | ✅ | Low | Low |
| DXF export | ✅ | Low | Low |
| IFC export | ✅ | Low | Low |
| Parametric blocks | ✅ | Medium | Low |

---

## Browser API Requirements

| API | Chrome | Edge | Firefox | Safari | Required for |
|---|---|---|---|---|---|
| WebGL 2.0 | ✅ 56+ | ✅ 79+ | ✅ 51+ | ✅ 15+ | 3D viewport |
| WebGPU | ✅ 113+ | ✅ 113+ | ❌ | ❌ (experimental) | Large models (optional fallback) |
| WASM | ✅ 57+ | ✅ 79+ | ✅ 52+ | ✅ 11+ | Geometry engine |
| OPFS | ✅ 102+ | ✅ 102+ | ✅ 111+ | ✅ 15.2+ | Project storage |
| Web Workers | ✅ 4+ | ✅ 12+ | ✅ 3.5+ | ✅ 4+ | Heavy computation off main thread |
| SharedArrayBuffer | ✅ 68+ | ✅ 79+ | ✅ 79+ | ✅ 15.2+ | WASM ↔ main thread data sharing |

**Minimum browser target:** Chrome 100+ (covers ~85% of engineering offices)

---

## What CANNOT Run in the Browser (Yet)

| Limitation | Mitigation |
|---|---|
| DWG native import | DXF as bridge format; ODA Web SDK if budget allows |
| Multi-GB project files | Lazy loading, spatial partitioning, OPFS chunking |
| Print to physical plotter at exact scale | PDF export at scale → local printing |
| OS-level file system access | OPFS + File System Access API (Chrome) for import/export |
| GPU ray tracing for realistic rendering | Not needed — Three.js real-time is sufficient for working views |

---

## Offline Strategy

As a PWA (Progressive Web App):
- All code (React + WASM) is Service-Worker-cached
- Project data lives in OPFS (persistent, private to origin)
- IFC import/export via `<input type="file">` and download
- No server required after initial load
- Updates via Service Worker (like any PWA)

This eliminates cloud dependency — a key concern for engineering firms with NDAs and data security requirements.