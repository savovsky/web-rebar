/**
 * M2 T6.5 (plan Q7) — IFC reference-solid extraction: web-ifc's triangulated
 * geometry API (LoadAllGeometry → flat vertex/index arrays, §D.4 revised) →
 * per-part ReferenceSolidPart meshes for every geometry-carrying product that
 * is NOT an intent-carrying wall/bar (those stay editable via the T3 path —
 * no duplication). Pure mapping (rule 2: no React, no store; the web-ifc API
 * instance is injected and the caller owns the model handle — the §N
 * importIfcModel command orchestrates). ⚠️ Same static-import contract as
 * ifc-import.ts: app code may only reach this module through the command's
 * dynamic import (the Q1 lazy-loading contract).
 *
 * Two NON-OBVIOUS web-ifc geometry-pipeline conventions, both pinned by
 * asymmetric-fixture tests (the silent-mirroring class §C warns about):
 *
 * 1. FRAME: LoadAllGeometry composes into a Y-up viewer frame — (x, y, z)web
 *    = (x, z, −y)ifc (verified empirically against web-ifc 0.0.77: an IFC
 *    Z-up 4000×200×2800 wall comes out spanning y 0..2800, z ∓100). Model
 *    space is Z-up right-handed mm (§C), so extraction converts back:
 *    (x, y, z)model = (x, −z, y)web — a proper rotation (det +1), winding and
 *    normals survive intact.
 * 2. UNITS: web-ifc normalizes geometry to METERS using the file's declared
 *    length unit (a MILLI.METRE file's 4000 mm wall comes out 4 long; a file
 *    with NO declared length unit is NOT scaled). Extraction reads the
 *    project's IfcSIUnit LENGTHUNIT itself: declared → ×1000 back to model
 *    mm; undeclared (or non-SI) → raw values pass through ASSUMED mm, flagged
 *    via `lengthUnitAssumed` (a unitless file is ambiguous by definition).
 *
 * Products without geometry (openings, spatial structure) never appear in
 * LoadAllGeometry's output — ignored, not counted (plan Q7). Meshes with an
 * empty geometry list are skipped the same way (observed: 3 such products in
 * the author's Advance Steel export). IfcOpeningElement products are excluded
 * explicitly (belt-and-braces — voids are never reference context).
 *
 * Colors: web-ifc reports per-part surface colors; its DEFAULT for unstyled
 * geometry is pure white (1,1,1,1) — indistinguishable from genuinely styled
 * white, so pure white is treated as "no style" → color null → the renderer
 * falls back to the --reference-solid token (Q7's "token fallback"; the
 * author's 4,008-product Advance Steel export carries zero presentation
 * styles, so this path is the rule, not the exception).
 */
import type { IfcAPI } from 'web-ifc';
import { IFCOPENINGELEMENT, IFCSIUNIT } from 'web-ifc';
import type { ReferenceSolidColor, ReferenceSolidPart } from '@/data/models';

export interface IfcSolidsExtraction {
  /** One entry per (product × styled part), world-space model mm. */
  parts: ReferenceSolidPart[];
  /** Distinct products that yielded ≥1 part (the summary's solids count). */
  products: number;
  /** Total triangle count across all parts (the summary's render load). */
  triangles: number;
  /** The mm scale actually applied to web-ifc's output (1000 when the file
   *  declared a length unit; 1 when assumed — see the module header). */
  scaleToMm: number;
  /** True when the file declared no usable length unit (raw = assumed mm). */
  lengthUnitAssumed: boolean;
  /** expressIDs of the products that became solids — the import mapping
   *  reclassifies its skip counts against this set. */
  solidExpressIds: ReadonlySet<number>;
}

export interface ExtractIfcSolidsRequest {
  api: IfcAPI;
  modelID: number;
  /** Products that must NOT become solids: the intent-carrying (editable)
   *  walls/bars. Openings are excluded internally on top of this. */
  excludeExpressIds: ReadonlySet<number>;
}

/** web-ifc's per-vertex stride: position xyz + normal xyz interleaved. */
const WEBIFC_VERTEX_STRIDE = 6;
/** web-ifc's color for geometry with no presentation style — treated as
 *  "unstyled" (the token-fallback trigger; see the module header). */
const WEBIFC_DEFAULT_COLOR: ReferenceSolidColor = { r: 1, g: 1, b: 1, a: 1 };
/** Declared length unit → web-ifc normalizes to meters → ×1000 = model mm. */
const METERS_TO_MM = 1000;
/** Undeclared length unit → web-ifc does not scale → raw values assumed mm. */
const ASSUMED_MM_SCALE = 1;

interface FlatSiUnit {
  UnitType: { value: string };
  Prefix: { value: string } | null;
  Name: { value: string };
}

/** web-ifc normalizes geometry to meters when (and only when) the file
 *  declares an SI length unit (MILLI./CENTI./$ .METRE. — any prefix, the
 *  normalization already covers it). Returns the mm scale + assumed flag. */
function resolveLengthUnitScale(
  api: IfcAPI,
  modelID: number,
): Pick<IfcSolidsExtraction, 'scaleToMm' | 'lengthUnitAssumed'> {
  const unitIds = api.GetLineIDsWithType(modelID, IFCSIUNIT, false);
  for (let index = 0; index < unitIds.size(); index += 1) {
    const unit = api.GetLine(modelID, unitIds.get(index), true) as FlatSiUnit;
    if (unit.UnitType.value === 'LENGTHUNIT' && unit.Name.value === 'METRE') {
      return { scaleToMm: METERS_TO_MM, lengthUnitAssumed: false };
    }
  }
  return { scaleToMm: ASSUMED_MM_SCALE, lengthUnitAssumed: true };
}

const isDefaultColor = (color: ReferenceSolidColor): boolean =>
  color.r === WEBIFC_DEFAULT_COLOR.r &&
  color.g === WEBIFC_DEFAULT_COLOR.g &&
  color.b === WEBIFC_DEFAULT_COLOR.b &&
  color.a === WEBIFC_DEFAULT_COLOR.a;

/**
 * Runs the extraction (see the module header for the frame/unit contracts).
 * The caller owns the model handle's lifecycle. Frees every intermediate
 * web-ifc geometry object; the returned arrays are plain JS heap copies
 * (web-ifc's GetVertexArray/GetIndexArray already slice out of the WASM heap,
 * and positions/normals are freshly computed here).
 */
export function extractIfcReferenceSolids(req: ExtractIfcSolidsRequest): IfcSolidsExtraction {
  const { api, modelID } = req;
  const { scaleToMm, lengthUnitAssumed: isLengthUnitAssumed } = resolveLengthUnitScale(api, modelID);
  const excluded = new Set(req.excludeExpressIds);
  const openingIds = api.GetLineIDsWithType(modelID, IFCOPENINGELEMENT, true);
  for (let index = 0; index < openingIds.size(); index += 1) excluded.add(openingIds.get(index));

  const parts: ReferenceSolidPart[] = [];
  const solidExpressIds = new Set<number>();
  let triangles = 0;

  const flatMeshes = api.LoadAllGeometry(modelID);
  for (let meshIndex = 0; meshIndex < flatMeshes.size(); meshIndex += 1) {
    const flatMesh = flatMeshes.get(meshIndex);
    if (excluded.has(flatMesh.expressID) || flatMesh.geometries.size() === 0) continue;
    solidExpressIds.add(flatMesh.expressID);
    for (let partIndex = 0; partIndex < flatMesh.geometries.size(); partIndex += 1) {
      const placed = flatMesh.geometries.get(partIndex);
      const geometry = api.GetGeometry(modelID, placed.geometryExpressID);
      const vertexData = api.GetVertexArray(geometry.GetVertexData(), geometry.GetVertexDataSize());
      const indexData = api.GetIndexArray(geometry.GetIndexData(), geometry.GetIndexDataSize());
      geometry.delete();

      // Column-major 4x4: world = M · local (rotation + translation).
      const m = placed.flatTransformation;
      const vertexCount = vertexData.length / WEBIFC_VERTEX_STRIDE;
      const positions = new Float32Array(vertexCount * 3);
      const normals = new Float32Array(vertexCount * 3);
      for (let vertex = 0; vertex < vertexCount; vertex += 1) {
        const read = vertex * WEBIFC_VERTEX_STRIDE;
        const write = vertex * 3;
        const lx = vertexData[read];
        const ly = vertexData[read + 1];
        const lz = vertexData[read + 2];
        // web (Y-up) world, then the frame conversion (x, −z, y) → model mm.
        const wx = m[0] * lx + m[4] * ly + m[8] * lz + m[12];
        const wy = m[1] * lx + m[5] * ly + m[9] * lz + m[13];
        const wz = m[2] * lx + m[6] * ly + m[10] * lz + m[14];
        positions[write] = wx * scaleToMm;
        positions[write + 1] = -wz * scaleToMm;
        positions[write + 2] = wy * scaleToMm;
        // Normals: rotation only (no translation), same frame flip.
        const nx = m[0] * vertexData[read + 3] + m[4] * vertexData[read + 4] + m[8] * vertexData[read + 5];
        const ny = m[1] * vertexData[read + 3] + m[5] * vertexData[read + 4] + m[9] * vertexData[read + 5];
        const nz = m[2] * vertexData[read + 3] + m[6] * vertexData[read + 4] + m[10] * vertexData[read + 5];
        const length = Math.hypot(nx, ny, nz) || 1;
        normals[write] = nx / length;
        normals[write + 1] = -nz / length;
        normals[write + 2] = ny / length;
      }
      const color: ReferenceSolidColor = {
        r: placed.color.x,
        g: placed.color.y,
        b: placed.color.z,
        a: placed.color.w,
      };
      parts.push({
        positions,
        normals,
        indices: new Uint32Array(indexData),
        color: isDefaultColor(color) ? null : color,
      });
      triangles += indexData.length / 3;
    }
  }

  return {
    parts,
    products: solidExpressIds.size,
    triangles,
    scaleToMm,
    lengthUnitAssumed: isLengthUnitAssumed,
    solidExpressIds,
  };
}
