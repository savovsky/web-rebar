/**
 * M2 T7 — DXF section EXPORT writer (plan §7, Q5) — custom writer, no library
 * (doc 07/09). Split out of dxf-adapter.ts (the T5 400-line-cap precedent);
 * dxf-adapter re-exports it so the module seam stays one doorway, and the
 * exportSectionDxf command reaches it through the same dynamic import as the
 * importer — the whole DXF stack stays in the one lazy chunk. The low-level
 * group/emitter/handle machinery lives in dxf-export-writer.ts; the static
 * HEADER/BLOCKS/OBJECTS scaffold in dxf-export-scaffold.ts.
 *
 * True 1:1 mm MODEL-SPACE export: section (u,v) → DXF (x,y) DIRECTLY (v is
 * up, y is up — no flip); $ACADVER AC1015 (R2000: LWPOLYLINE + lineweight
 * support) and $INSUNITS=4 (mm) in the HEADER. Scale-on-sheet stays with the
 * consumer's CAD paper space — the Drawing Layouts topic is NOT touched.
 * Cut-bar dots are true-diameter CIRCLEs (§M.4 true relative diameters;
 * filled rendering is cosmetic and deferred).
 *
 * Allplan 2022's "Import AutoCAD Data" runs on the ODA (Open Design Alliance,
 * "Teigha") DWG/DXF kernel (Allplan 2022 ships TG_DwgDb_21.4). That reader is
 * far stricter than dxf-parser: it requires the full R2000 ownership/handle
 * graph. Iteration history (author checks):
 *  - iteration 0 (schema-minimal: HEADER+TABLES+ENTITIES+EOF, LF) — REJECTED.
 *  - iteration 1 (+ CRLF, subclass markers, ByBlock/ByLayer/layer "0"/STYLE
 *    Standard, header extents, decimal-point floats) — REJECTED.
 *  - iteration 2 (this file): the COMPLETE AutoCAD R2000 ownership graph —
 *    handles (group 5) with 330 owner refs, BLOCK_RECORD table (*Model_Space
 *    + *Paper_Space) with LAYOUT refs, a BLOCKS section with matching BLOCK/
 *    ENDBLK pairs, an OBJECTS section with the root DICTIONARY + ACAD_GROUP /
 *    ACAD_LAYOUT / ACAD_PLOTSETTINGS / ACAD_PLOTSTYLENAME named dictionaries
 *    and Model/Layout1 LAYOUT objects, $HANDSEED/$CLAYER/$TEXTSTYLE/$LTSCALE
 *    header vars, and LWPOLYLINE group 43. Verified structurally against the
 *    author's 8 real AutoCAD exports in docs/test-fixtures/dxf/.
 */
import { DEFAULT_SECTION_PLOT_PEN_TABLE } from '@/data/appearance';
import type { SectionPoint, SectionPrimitives } from '@/engine/sectioning';
import {
  computeDxfExtents,
  writeDxfBlocksSection,
  writeDxfHeaderSection,
  writeDxfObjectsSection,
} from './dxf-export-scaffold';
import {
  type DxfEmitter,
  Gc,
  HANDLE_BLOCK_RECORD_TABLE,
  HANDLE_LAYER_TABLE,
  HANDLE_LAYER_ZERO,
  HANDLE_LTYPE_BYBLOCK,
  HANDLE_LTYPE_BYLAYER,
  HANDLE_LTYPE_CONTINUOUS,
  HANDLE_LTYPE_DASHED,
  HANDLE_LTYPE_TABLE,
  HANDLE_MODEL_BLOCK_END,
  HANDLE_MODEL_BLOCK_RECORD,
  HANDLE_MODEL_LAYOUT,
  HANDLE_PAPER_BLOCK_RECORD,
  HANDLE_PAPER_LAYOUT,
  HANDLE_PLOTSTYLE_PLACEHOLDER,
  HANDLE_STYLE_STANDARD,
  HANDLE_STYLE_TABLE,
  type HandleAllocator,
  createDxfEmitter,
  createHandleAllocator,
  lineweightGroupValue,
} from './dxf-export-writer';

/** The three Q5 named layers. */
export const DXF_LAYER_CONCRETE = 'WEBREBAR-CONCRETE';
export const DXF_LAYER_REBAR = 'WEBREBAR-REBAR';
export const DXF_LAYER_BACKGROUND = 'WEBREBAR-BACKGROUND';

const DXF_LTYPE_BYBLOCK = 'ByBlock';
const DXF_LTYPE_BYLAYER = 'ByLayer';
const DXF_LTYPE_CONTINUOUS = 'Continuous';
const DXF_LTYPE_DASHED = 'DASHED';
/** The mandatory default layer (every real DXF carries it). */
const DXF_LAYER_ZERO = '0';
const STANDARD_TEXT_STYLE = 'Standard';
const STANDARD_TEXT_FONT = 'txt';
/** STYLE "Standard" last-height-used (group 42) — the metric DXF default. */
const STANDARD_LAST_HEIGHT_MM = 2.5;

/** AutoCAD Color Index: white/black (default layer + concrete outlines),
 *  orange (rebar — the 3D viewport's rebar color family), gray (§G.2.3
 *  background). */
const ACI_DEFAULT = 7;
const ACI_REBAR = 30;
const ACI_BACKGROUND = 8;

/** Group-100 subclass markers (R2000 convention). */
const SUBCLASS_SYMBOL_TABLE = 'AcDbSymbolTable';
const SUBCLASS_SYMBOL_TABLE_RECORD = 'AcDbSymbolTableRecord';
const SUBCLASS_LTYPE_RECORD = 'AcDbLinetypeTableRecord';
const SUBCLASS_LAYER_RECORD = 'AcDbLayerTableRecord';
const SUBCLASS_STYLE_RECORD = 'AcDbTextStyleTableRecord';
const SUBCLASS_BLOCK_RECORD = 'AcDbBlockTableRecord';
const SUBCLASS_ENTITY = 'AcDbEntity';
const SUBCLASS_POLYLINE = 'AcDbPolyline';
const SUBCLASS_CIRCLE = 'AcDbCircle';
const SUBCLASS_LINE = 'AcDbLine';

/** Linetype alignment code 65 = 'A' (AutoCAD's complex-linetype alignment). */
const LTYPE_ALIGNMENT_A = 65;

// ---------------------------------------------------------------------------
// TABLES (LTYPE + LAYER + STYLE + BLOCK_RECORD) — each with handles + owners
// ---------------------------------------------------------------------------

interface TableStart {
  name: string;
  handle: string;
  entryCount: number;
}

function writeTableStart(emitter: DxfEmitter, table: TableStart): void {
  emitter.group(Gc.MARKER, 'TABLE');
  emitter.group(Gc.NAME, table.name);
  emitter.group(Gc.HANDLE, table.handle);
  emitter.group(Gc.OWNER, '0');
  emitter.group(Gc.SUBCLASS, SUBCLASS_SYMBOL_TABLE);
  emitter.group(Gc.FLAGS, table.entryCount);
}

interface LtypeEntry {
  name: string;
  handle: string;
  description: string;
}

function writeLtypeEntry(emitter: DxfEmitter, entry: LtypeEntry): void {
  emitter.group(Gc.MARKER, 'LTYPE');
  emitter.group(Gc.HANDLE, entry.handle);
  emitter.group(Gc.OWNER, HANDLE_LTYPE_TABLE);
  emitter.group(Gc.SUBCLASS, SUBCLASS_SYMBOL_TABLE_RECORD);
  emitter.group(Gc.SUBCLASS, SUBCLASS_LTYPE_RECORD);
  emitter.group(Gc.NAME, entry.name);
  emitter.group(Gc.FLAGS, 0);
  emitter.group(Gc.DESCRIPTION, entry.description);
  emitter.group(Gc.ALIGNMENT, LTYPE_ALIGNMENT_A);
  emitter.group(Gc.DASH_ELEMENT_COUNT, 0);
  emitter.group(Gc.RADIUS_OR_LENGTH, 0); // pattern length 0
}

function writeLtypeTable(emitter: DxfEmitter): void {
  const [dashOnMm, dashOffMm] = DEFAULT_SECTION_PLOT_PEN_TABLE.backgroundDashMm;
  writeTableStart(emitter, { name: 'LTYPE', handle: HANDLE_LTYPE_TABLE, entryCount: 4 });
  writeLtypeEntry(emitter, { name: DXF_LTYPE_BYBLOCK, handle: HANDLE_LTYPE_BYBLOCK, description: '' });
  writeLtypeEntry(emitter, { name: DXF_LTYPE_BYLAYER, handle: HANDLE_LTYPE_BYLAYER, description: '' });
  writeLtypeEntry(emitter, {
    name: DXF_LTYPE_CONTINUOUS,
    handle: HANDLE_LTYPE_CONTINUOUS,
    description: 'Solid line',
  });
  emitter.group(Gc.MARKER, 'LTYPE');
  emitter.group(Gc.HANDLE, HANDLE_LTYPE_DASHED);
  emitter.group(Gc.OWNER, HANDLE_LTYPE_TABLE);
  emitter.group(Gc.SUBCLASS, SUBCLASS_SYMBOL_TABLE_RECORD);
  emitter.group(Gc.SUBCLASS, SUBCLASS_LTYPE_RECORD);
  emitter.group(Gc.NAME, DXF_LTYPE_DASHED);
  emitter.group(Gc.FLAGS, 0);
  emitter.group(Gc.DESCRIPTION, 'Dashed __ __');
  emitter.group(Gc.ALIGNMENT, LTYPE_ALIGNMENT_A);
  emitter.group(Gc.DASH_ELEMENT_COUNT, 2);
  emitter.group(Gc.RADIUS_OR_LENGTH, dashOnMm + dashOffMm); // pattern length (mm)
  emitter.group(Gc.DASH_VALUE, dashOnMm);
  emitter.group(Gc.DASH_ELEMENT_TYPE, 0);
  emitter.group(Gc.DASH_VALUE, -dashOffMm); // negative = pen-up gap
  emitter.group(Gc.DASH_ELEMENT_TYPE, 0);
  emitter.group(Gc.MARKER, 'ENDTAB');
}

interface LayerEntry {
  name: string;
  handle: string;
  aci: number;
  linetype: string;
  /** mm plot weight; undefined = default lineweight (-3 — layer "0"). */
  lineweightMm: number | undefined;
}

function writeLayerEntry(emitter: DxfEmitter, entry: LayerEntry): void {
  emitter.group(Gc.MARKER, 'LAYER');
  emitter.group(Gc.HANDLE, entry.handle);
  emitter.group(Gc.OWNER, HANDLE_LAYER_TABLE);
  emitter.group(Gc.SUBCLASS, SUBCLASS_SYMBOL_TABLE_RECORD);
  emitter.group(Gc.SUBCLASS, SUBCLASS_LAYER_RECORD);
  emitter.group(Gc.NAME, entry.name);
  emitter.group(Gc.FLAGS, 0); // not frozen/locked
  emitter.group(Gc.COLOR_ACI, entry.aci);
  emitter.group(Gc.LINETYPE_REF, entry.linetype);
  emitter.group(Gc.LINEWEIGHT, lineweightGroupValue(entry.lineweightMm));
  // 390 = plot-style handle; the placeholder lives in ACAD_PLOTSTYLENAME.
  emitter.group(Gc.PLOT_STYLE, HANDLE_PLOTSTYLE_PLACEHOLDER);
}

interface LayerHandles {
  concrete: string;
  rebar: string;
  background: string;
}

function writeLayerTable(emitter: DxfEmitter, handles: LayerHandles): void {
  const pen = DEFAULT_SECTION_PLOT_PEN_TABLE;
  writeTableStart(emitter, { name: 'LAYER', handle: HANDLE_LAYER_TABLE, entryCount: 4 });
  writeLayerEntry(emitter, {
    name: DXF_LAYER_ZERO,
    handle: HANDLE_LAYER_ZERO,
    aci: ACI_DEFAULT,
    linetype: DXF_LTYPE_CONTINUOUS,
    lineweightMm: undefined,
  });
  writeLayerEntry(emitter, {
    name: DXF_LAYER_CONCRETE,
    handle: handles.concrete,
    aci: ACI_DEFAULT,
    linetype: DXF_LTYPE_CONTINUOUS,
    lineweightMm: pen.concreteOutlineLineweightMm,
  });
  writeLayerEntry(emitter, {
    name: DXF_LAYER_REBAR,
    handle: handles.rebar,
    aci: ACI_REBAR,
    linetype: DXF_LTYPE_CONTINUOUS,
    lineweightMm: pen.rebarLineweightMm,
  });
  writeLayerEntry(emitter, {
    name: DXF_LAYER_BACKGROUND,
    handle: handles.background,
    aci: ACI_BACKGROUND,
    linetype: DXF_LTYPE_DASHED, // §G.2.3 background draws dashed (ByLayer)
    lineweightMm: pen.backgroundLineweightMm,
  });
  emitter.group(Gc.MARKER, 'ENDTAB');
}

function writeStyleTable(emitter: DxfEmitter): void {
  writeTableStart(emitter, { name: 'STYLE', handle: HANDLE_STYLE_TABLE, entryCount: 1 });
  emitter.group(Gc.MARKER, 'STYLE');
  emitter.group(Gc.HANDLE, HANDLE_STYLE_STANDARD);
  emitter.group(Gc.OWNER, HANDLE_STYLE_TABLE);
  emitter.group(Gc.SUBCLASS, SUBCLASS_SYMBOL_TABLE_RECORD);
  emitter.group(Gc.SUBCLASS, SUBCLASS_STYLE_RECORD);
  emitter.group(Gc.NAME, STANDARD_TEXT_STYLE);
  emitter.group(Gc.FLAGS, 0);
  emitter.group(Gc.RADIUS_OR_LENGTH, 0); // fixed text height: 0 = not fixed
  emitter.group(Gc.WIDTH_FACTOR, 1);
  emitter.group(Gc.OBLIQUE_ANGLE, 0);
  emitter.group(Gc.TEXT_FLAGS, 0);
  emitter.group(Gc.LAST_HEIGHT, STANDARD_LAST_HEIGHT_MM);
  emitter.group(Gc.DESCRIPTION, STANDARD_TEXT_FONT);
  emitter.group(Gc.BIGFONT, '');
  emitter.group(Gc.MARKER, 'ENDTAB');
}

interface BlockRecordEntry {
  name: string;
  handle: string;
  layoutHandle: string;
  isPaper: boolean;
}

function writeBlockRecordEntry(emitter: DxfEmitter, entry: BlockRecordEntry): void {
  emitter.group(Gc.MARKER, 'BLOCK_RECORD');
  emitter.group(Gc.HANDLE, entry.handle);
  emitter.group(Gc.OWNER, HANDLE_BLOCK_RECORD_TABLE);
  emitter.group(Gc.SUBCLASS, SUBCLASS_SYMBOL_TABLE_RECORD);
  emitter.group(Gc.SUBCLASS, SUBCLASS_BLOCK_RECORD);
  emitter.group(Gc.NAME, entry.name);
  emitter.group(Gc.LAYOUT_OWNER, entry.layoutHandle);
  if (entry.isPaper) emitter.group(Gc.PAPER_SPACE, 1);
  emitter.group(Gc.FLAGS, 0);
  emitter.group(Gc.EXPLODABLE, 1); // explodable
  emitter.group(Gc.DUPLICATED_CLONING, 0); // block layout flag: 0
}

function writeBlockRecordTable(emitter: DxfEmitter): void {
  writeTableStart(emitter, { name: 'BLOCK_RECORD', handle: HANDLE_BLOCK_RECORD_TABLE, entryCount: 2 });
  writeBlockRecordEntry(emitter, {
    name: '*Model_Space',
    handle: HANDLE_MODEL_BLOCK_RECORD,
    layoutHandle: HANDLE_MODEL_LAYOUT,
    isPaper: false,
  });
  writeBlockRecordEntry(emitter, {
    name: '*Paper_Space',
    handle: HANDLE_PAPER_BLOCK_RECORD,
    layoutHandle: HANDLE_PAPER_LAYOUT,
    isPaper: true,
  });
  emitter.group(Gc.MARKER, 'ENDTAB');
}

function writeTablesSection(emitter: DxfEmitter, layerHandles: LayerHandles): void {
  emitter.group(Gc.MARKER, 'SECTION');
  emitter.group(Gc.NAME, 'TABLES');
  writeLtypeTable(emitter);
  writeLayerTable(emitter, layerHandles);
  writeStyleTable(emitter);
  writeBlockRecordTable(emitter);
  emitter.group(Gc.MARKER, 'ENDSEC');
}

// ---------------------------------------------------------------------------
// ENTITIES — section (u,v) → DXF (x,y) directly (no flip); owned by *Model_Space
// ---------------------------------------------------------------------------

interface PolylineEntity {
  layer: string;
  points: SectionPoint[];
  closed: boolean;
  handle: string;
}

function writePolylineEntity(emitter: DxfEmitter, entity: PolylineEntity): void {
  emitter.group(Gc.MARKER, 'LWPOLYLINE');
  emitter.group(Gc.HANDLE, entity.handle);
  emitter.group(Gc.OWNER, HANDLE_MODEL_BLOCK_RECORD);
  emitter.group(Gc.SUBCLASS, SUBCLASS_ENTITY);
  emitter.group(Gc.LAYER_REF, entity.layer);
  emitter.group(Gc.SUBCLASS, SUBCLASS_POLYLINE);
  emitter.group(Gc.VERTEX_COUNT, entity.points.length);
  emitter.group(Gc.FLAGS, entity.closed ? 1 : 0); // bit 1 = closed
  emitter.group(Gc.CONSTANT_WIDTH, 0);
  for (const point of entity.points) {
    emitter.group(Gc.X, point.u);
    emitter.group(Gc.Y, point.v);
  }
}

interface EntitiesContext {
  primitives: SectionPrimitives;
  handles: HandleAllocator;
}

function writeEntitiesSection(emitter: DxfEmitter, context: EntitiesContext): void {
  const { primitives, handles } = context;
  emitter.group(Gc.MARKER, 'SECTION');
  emitter.group(Gc.NAME, 'ENTITIES');
  for (const outline of primitives.concreteOutlines) {
    if (outline.length >= 2) {
      writePolylineEntity(emitter, {
        layer: DXF_LAYER_CONCRETE,
        points: outline,
        closed: true,
        handle: handles.next(),
      });
    }
  }
  for (const dot of primitives.cutBars) {
    emitter.group(Gc.MARKER, 'CIRCLE');
    emitter.group(Gc.HANDLE, handles.next());
    emitter.group(Gc.OWNER, HANDLE_MODEL_BLOCK_RECORD);
    emitter.group(Gc.SUBCLASS, SUBCLASS_ENTITY);
    emitter.group(Gc.LAYER_REF, DXF_LAYER_REBAR);
    emitter.group(Gc.SUBCLASS, SUBCLASS_CIRCLE);
    emitter.group(Gc.X, dot.center.u);
    emitter.group(Gc.Y, dot.center.v);
    emitter.group(Gc.Z, 0);
    emitter.group(Gc.RADIUS_OR_LENGTH, dot.diameterMm / 2); // true Ø/2 (§M.4)
  }
  for (const line of primitives.backgroundLines) {
    if (line.length < 2) continue;
    if (line.length > 2) {
      writePolylineEntity(emitter, {
        layer: DXF_LAYER_BACKGROUND,
        points: line,
        closed: false,
        handle: handles.next(),
      });
      continue;
    }
    emitter.group(Gc.MARKER, 'LINE');
    emitter.group(Gc.HANDLE, handles.next());
    emitter.group(Gc.OWNER, HANDLE_MODEL_BLOCK_RECORD);
    emitter.group(Gc.SUBCLASS, SUBCLASS_ENTITY);
    emitter.group(Gc.LAYER_REF, DXF_LAYER_BACKGROUND);
    emitter.group(Gc.SUBCLASS, SUBCLASS_LINE);
    emitter.group(Gc.X, line[0].u);
    emitter.group(Gc.Y, line[0].v);
    emitter.group(Gc.Z, 0);
    emitter.group(Gc.X2, line[1].u);
    emitter.group(Gc.Y2, line[1].v);
    emitter.group(Gc.Z2, 0);
  }
  emitter.group(Gc.MARKER, 'ENDSEC');
}

/**
 * §G.1 section primitives → a complete DXF file (R2000, true 1:1 mm, Q5).
 * CRLF line endings (the DXF terminator); coordinates written with the
 * shortest-round-trip float formatting (a decimal point always present), so
 * the file parses back to the exact same doubles (the reimport-fidelity probe
 * asserts this through our own importer). Lineweights and the dash pattern
 * come from the mm plot pen-table seed in src/data/appearance.ts.
 */
export function exportDxfSection(primitives: SectionPrimitives): string {
  const emitter = createDxfEmitter();
  const handles = createHandleAllocator();
  // Layer handles are allocated BEFORE entities (tables precede ENTITIES).
  const layerHandles: LayerHandles = {
    concrete: handles.next(),
    rebar: handles.next(),
    background: handles.next(),
  };
  writeDxfHeaderSection(emitter, {
    extents: computeDxfExtents(primitives),
    handSeed: HANDLE_MODEL_BLOCK_END,
  });
  writeTablesSection(emitter, layerHandles);
  writeDxfBlocksSection(emitter);
  writeEntitiesSection(emitter, { primitives, handles });
  writeDxfObjectsSection(emitter);
  emitter.group(Gc.MARKER, 'EOF');
  return `${emitter.lines.join('\r\n')}\r\n`;
}
