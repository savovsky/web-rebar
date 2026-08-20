/**
 * M2 T5 — DXF adapter: the parser seam (dxf-parser, plan Q6) + the $INSUNITS
 * units table (Q4) + the public mapping assembly. The entity-level mapping
 * machinery (entity filter with skip counts, bulge → arc, BLOCK/INSERT
 * explosion, OCS conversion, plan projection) lives in dxf-mapping.ts; the 3D
 * affine math in dxf-affine.ts. The DXF EXPORT writer (plan §7, task T7)
 * lives in dxf-export.ts and is re-exported below (the module seam stays one
 * doorway): the exportSectionDxf command reaches it through the same dynamic
 * import as the importer, so the whole DXF stack stays in the one lazy chunk.
 *
 * ⚠️ This module imports dxf-parser STATICALLY: app code may only reach it
 * through a dynamic import (the importReferenceDocument command does — the
 * exportIfc/importIfcModel precedent); a static import anywhere in the shell
 * graph would put dxf-parser into the shell bundle (the Q1 lazy-loading
 * contract). Tests may import it statically.
 *
 * Q6 keeps ALL domain decisions in OUR code so the library stays swappable:
 * the documented fallback (a minimal custom reader for the Q4 entity subset)
 * replaces exactly the parse step in importDxfReference.
 */
import DxfParser from 'dxf-parser';
import { scaleAffine } from './dxf-affine';
import { type DxfDocumentLike, type DxfImportSkips, createEmptySkips, mapEntities } from './dxf-mapping';
import type { DxfImportOptions, DxfImportResult } from './dxf-mapping';

// ---------------------------------------------------------------------------
// $INSUNITS → mm (Q4; AutoCAD's units codes, complete through 21 so every real
// header resolves; codes outside the table = unknown → assumed mm + warning)
// ---------------------------------------------------------------------------

const MILLIMETRES_INSUNITS = 4;
const HEADER_INSUNITS = '$INSUNITS';
const MM_PER_INSUNIT: Record<number, number> = {
  1: 25.4, // inches
  2: 304.8, // feet
  3: 1_609_344, // miles
  4: 1, // millimetres
  5: 10, // centimetres
  6: 1000, // metres
  7: 1_000_000, // kilometres
  8: 0.000_025_4, // microinches
  9: 0.0254, // mils
  10: 914.4, // yards
  11: 1e-7, // angstroms
  12: 1e-6, // nanometres
  13: 0.001, // microns
  14: 100, // decimetres
  15: 10_000, // decametres
  16: 100_000, // hectometres
  17: 1e12, // gigametres
  // 18–20 (astronomical units / light years / parsecs) are deliberately NOT
  // honored: they never legitimately describe a building plan, so the file
  // gets the unknown-code path (assume mm + warning; the override can fix it).
  21: 304.800_609_6, // US survey feet
};

interface ResolvedUnits {
  headerInsunits: number | undefined;
  appliedInsunits: number;
  scaleToMm: number;
  isAssumed: boolean;
}

function resolveUnits(headerValue: unknown, override: number | undefined): ResolvedUnits {
  const headerInsunits =
    typeof headerValue === 'number' && Number.isInteger(headerValue) ? headerValue : undefined;
  if (override !== undefined) {
    const scaleToMm = MM_PER_INSUNIT[override];
    if (scaleToMm === undefined) {
      throw new Error(`dxf-adapter: unknown $INSUNITS override code ${override}`);
    }
    return { headerInsunits, appliedInsunits: override, scaleToMm, isAssumed: false };
  }
  if (headerInsunits === undefined) {
    // Missing or non-numeric header → assume mm, the summary warns (Q4).
    return { headerInsunits, appliedInsunits: MILLIMETRES_INSUNITS, scaleToMm: 1, isAssumed: true };
  }
  const scaleToMm = MM_PER_INSUNIT[headerInsunits];
  if (scaleToMm === undefined) {
    // Unitless (0) or unknown code → assume mm, the summary warns (Q4).
    return { headerInsunits, appliedInsunits: MILLIMETRES_INSUNITS, scaleToMm: 1, isAssumed: true };
  }
  return { headerInsunits, appliedInsunits: headerInsunits, scaleToMm, isAssumed: false };
}

// ---------------------------------------------------------------------------
// Public assembly
// ---------------------------------------------------------------------------

/**
 * The pure mapping entry (Q4/Q6): library-neutral parsed DXF → reference
 * primitives in model mm + the full skip report. Tests feed synthetic
 * documents here directly (no parser involved).
 */
export function mapDxfToReferencePrimitives(
  dxf: DxfDocumentLike,
  options: DxfImportOptions = {},
): DxfImportResult {
  const units = resolveUnits(dxf.header?.[HEADER_INSUNITS], options.insunitsOverride);
  const skipped: DxfImportSkips = createEmptySkips();
  const primitives = mapEntities({
    entities: dxf.entities ?? [],
    blocks: dxf.blocks ?? {},
    skipped,
    frame: {
      affine: scaleAffine(units.scaleToMm),
      inheritLayer: undefined,
      depth: 0,
      blockPath: new Set<string>(),
    },
  });
  return {
    primitives,
    headerInsunits: units.headerInsunits,
    appliedInsunits: units.appliedInsunits,
    scaleToMm: units.scaleToMm,
    unitsAssumed: units.isAssumed,
    skipped,
  };
}

// ---------------------------------------------------------------------------
// Parser seat for entity types dxf-parser 1.x drops without any trace: Q4's
// skip list must be COUNTED ("nothing silently lost"), so these get a minimal
// handler that consumes the entity's groups and emits a bare marker for the
// mapping layer to count. (HATCH — ubiquitous area fills in the author
// fixtures; 3DSOLID/BODY — the 3D-View export's solid content.)
// ---------------------------------------------------------------------------

const SKIP_COUNTED_ENTITY_TYPES = ['HATCH', '3DSOLID', 'BODY'] as const;

interface ScannerGroup {
  code: number;
  value: string | number;
}
interface EntityGroupScanner {
  next(): ScannerGroup;
  isEOF(): boolean;
}

/** dxf-parser handler protocol: consume groups until the next code-0 group
 *  (the scanner's lastReadGroup stays on it for the outer entity loop). */
const createSkipCountingHandler = (entityType: string) =>
  class {
    readonly ForEntityName = entityType;
    parseEntity(scanner: EntityGroupScanner, _curr: ScannerGroup): { type: string } {
      let group = scanner.next();
      while (!scanner.isEOF() && group.code !== 0) group = scanner.next();
      return { type: entityType };
    }
  };

type EntityHandlerConstructor = Parameters<DxfParser['registerEntityHandler']>[0];

/**
 * Parse DXF text (dxf-parser — the library is swappable per Q6; the swap
 * replaces exactly this function) and run the pure mapping layer. Throws on
 * unparseable content (dxf-parser throws 'Empty file' on non-DXF input;
 * a parseable-but-empty file maps to a valid empty result).
 */
export function importDxfReference(text: string, options: DxfImportOptions = {}): DxfImportResult {
  const parser = new DxfParser();
  for (const entityType of SKIP_COUNTED_ENTITY_TYPES) {
    // Cast through unknown: dxf-parser's IGeometry union predates these entity
    // types; the class satisfies the runtime protocol (verified in tests).
    parser.registerEntityHandler(
      createSkipCountingHandler(entityType) as unknown as EntityHandlerConstructor,
    );
  }
  const dxf = parser.parseSync(text);
  if (dxf === null) throw new Error('dxf-adapter: not a DXF file (parser returned null)');
  return mapDxfToReferencePrimitives(dxf, options);
}

// Public mapping types re-exported so the module seam stays one doorway
// (commands + tests import from dxf-adapter only).
export type {
  DxfBlockLike,
  DxfDocumentLike,
  DxfEntityLike,
  DxfImportOptions,
  DxfImportResult,
  DxfImportSkips,
} from './dxf-mapping';

// The DXF section EXPORT writer (plan §7, task T7) lives in dxf-export.ts —
// split out at T7 iteration 1 (the Allplan convention fixes would have pushed
// this module past the 400-line cap; the T5 sibling-split precedent). It has
// NO dxf-parser dependency, but re-exporting it here keeps the module seam
// one doorway: the exportSectionDxf command dynamic-imports this module, so
// the whole DXF stack (parser + mapping + writer) stays in the one lazy chunk.
export { DXF_LAYER_BACKGROUND, DXF_LAYER_CONCRETE, DXF_LAYER_REBAR, exportDxfSection } from './dxf-export';
