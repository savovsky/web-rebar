/**
 * M2 T7 (iteration 2) — the static DXF R2000 scaffold for the section export:
 * HEADER, BLOCKS and OBJECTS sections. These are content-independent (the only
 * model data is the computed drawing extents) and identical for every export,
 * so they live apart from the content-dependent TABLES/ENTITIES sections in
 * dxf-export.ts (the 400-line split). Pure; shares the low-level machinery
 * from dxf-export-writer.ts.
 */
import type { SectionPrimitives } from '@/engine/sectioning';
import {
  type DxfEmitter,
  Gc,
  HANDLE_GROUP_DICTIONARY,
  HANDLE_LAYOUT_DICTIONARY,
  HANDLE_MODEL_BLOCK_BEGIN,
  HANDLE_MODEL_BLOCK_END,
  HANDLE_MODEL_BLOCK_RECORD,
  HANDLE_MODEL_LAYOUT,
  HANDLE_PAPER_BLOCK_BEGIN,
  HANDLE_PAPER_BLOCK_END,
  HANDLE_PAPER_BLOCK_RECORD,
  HANDLE_PAPER_LAYOUT,
  HANDLE_PLOTSETTINGS_DICTIONARY,
  HANDLE_PLOTSETTINGS_MODEL,
  HANDLE_PLOTSTYLENAME_DICTIONARY,
  HANDLE_PLOTSTYLE_PLACEHOLDER,
  HANDLE_ROOT_DICTIONARY,
  LAYOUT_CODES,
} from './dxf-export-writer';

const DXF_VERSION_R2000 = 'AC1015';
const DXF_INSUNITS_MILLIMETRES = 4;
const DXF_LAYER_ZERO = '0';
const DXF_CODEPAGE = 'ANSI_1252';
const STANDARD_TEXT_STYLE = 'Standard';
const MODEL_LAYOUT_NAME = 'Model';
const PAPER_LAYOUT_NAME = 'Layout1';
const NO_DEVICE = 'none_device';

const SUBCLASS_ENTITY = 'AcDbEntity';
const SUBCLASS_BLOCK_BEGIN = 'AcDbBlockBegin';
const SUBCLASS_BLOCK_END = 'AcDbBlockEnd';
const SUBCLASS_DICTIONARY = 'AcDbDictionary';
const SUBCLASS_DICTIONARY_WITH_DEFAULT = 'AcDbDictionaryWithDefault';
const SUBCLASS_PLOT_SETTINGS = 'AcDbPlotSettings';
const SUBCLASS_LAYOUT = 'AcDbLayout';

const PLOT_SETTINGS_FLAGS = 1712;
const ROTATE_PLOT_90 = 5;
const PLOT_STYLE_TYPE_SHADED = 16;

// ---------------------------------------------------------------------------
// HEADER
// ---------------------------------------------------------------------------

export interface DxfExtents {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export function computeDxfExtents(primitives: SectionPrimitives): DxfExtents | null {
  let extents: DxfExtents | null = null;
  const grow = (x: number, y: number): void => {
    if (extents === null) {
      extents = { minX: x, minY: y, maxX: x, maxY: y };
      return;
    }
    extents.minX = Math.min(extents.minX, x);
    extents.minY = Math.min(extents.minY, y);
    extents.maxX = Math.max(extents.maxX, x);
    extents.maxY = Math.max(extents.maxY, y);
  };
  for (const outline of primitives.concreteOutlines) {
    for (const point of outline) grow(point.u, point.v);
  }
  for (const dot of primitives.cutBars) {
    const radius = dot.diameterMm / 2;
    grow(dot.center.u - radius, dot.center.v - radius);
    grow(dot.center.u + radius, dot.center.v + radius);
  }
  for (const line of primitives.backgroundLines) {
    for (const point of line) grow(point.u, point.v);
  }
  return extents;
}

interface PointXY {
  x: number;
  y: number;
  includeZ: boolean;
}

export function writeDxfPoint2D(emitter: DxfEmitter, point: PointXY): void {
  emitter.group(Gc.X, point.x);
  emitter.group(Gc.Y, point.y);
  if (point.includeZ) emitter.group(Gc.Z, 0);
}

export interface HeaderContext {
  extents: DxfExtents | null;
  handSeed: string;
}

export function writeDxfHeaderSection(emitter: DxfEmitter, context: HeaderContext): void {
  const min = { x: context.extents?.minX ?? 0, y: context.extents?.minY ?? 0 };
  const max = { x: context.extents?.maxX ?? 0, y: context.extents?.maxY ?? 0 };
  emitter.group(Gc.MARKER, 'SECTION');
  emitter.group(Gc.NAME, 'HEADER');
  emitter.group(Gc.HEADER_VAR, '$ACADVER');
  emitter.group(Gc.TEXT_VALUE, DXF_VERSION_R2000);
  emitter.group(Gc.HEADER_VAR, '$DWGCODEPAGE');
  emitter.group(Gc.DESCRIPTION, DXF_CODEPAGE);
  emitter.group(Gc.HEADER_VAR, '$INSBASE');
  writeDxfPoint2D(emitter, { x: 0, y: 0, includeZ: true });
  emitter.group(Gc.HEADER_VAR, '$EXTMIN');
  writeDxfPoint2D(emitter, { ...min, includeZ: true });
  emitter.group(Gc.HEADER_VAR, '$EXTMAX');
  writeDxfPoint2D(emitter, { ...max, includeZ: true });
  emitter.group(Gc.HEADER_VAR, '$LIMMIN');
  writeDxfPoint2D(emitter, { ...min, includeZ: false });
  emitter.group(Gc.HEADER_VAR, '$LIMMAX');
  writeDxfPoint2D(emitter, { ...max, includeZ: false });
  emitter.group(Gc.HEADER_VAR, '$INSUNITS');
  emitter.group(Gc.FLAGS, DXF_INSUNITS_MILLIMETRES);
  emitter.group(Gc.HEADER_VAR, '$LTSCALE');
  emitter.group(Gc.RADIUS_OR_LENGTH, 1);
  emitter.group(Gc.HEADER_VAR, '$CLAYER');
  emitter.group(Gc.LAYER_REF, DXF_LAYER_ZERO);
  emitter.group(Gc.HEADER_VAR, '$TEXTSTYLE');
  emitter.group(Gc.TEXTSTYLE_REF, STANDARD_TEXT_STYLE);
  emitter.group(Gc.HEADER_VAR, '$HANDSEED');
  emitter.group(Gc.HANDLE, context.handSeed);
  emitter.group(Gc.MARKER, 'ENDSEC');
}

// ---------------------------------------------------------------------------
// BLOCKS — one BLOCK/ENDBLK pair per BLOCK_RECORD (model + paper)
// ---------------------------------------------------------------------------

interface BlockSectionEntry {
  recordHandle: string;
  name: string;
  beginHandle: string;
  endHandle: string;
  isPaper: boolean;
}

function writeBlockPair(emitter: DxfEmitter, entry: BlockSectionEntry): void {
  emitter.group(Gc.MARKER, 'BLOCK');
  emitter.group(Gc.HANDLE, entry.beginHandle);
  emitter.group(Gc.OWNER, entry.recordHandle);
  emitter.group(Gc.SUBCLASS, SUBCLASS_ENTITY);
  if (entry.isPaper) emitter.group(Gc.PAPER_SPACE, 1);
  emitter.group(Gc.LAYER_REF, DXF_LAYER_ZERO);
  emitter.group(Gc.SUBCLASS, SUBCLASS_BLOCK_BEGIN);
  emitter.group(Gc.NAME, entry.name);
  emitter.group(Gc.FLAGS, 0);
  writeDxfPoint2D(emitter, { x: 0, y: 0, includeZ: true });
  emitter.group(Gc.DESCRIPTION, entry.name);
  emitter.group(Gc.TEXT_VALUE, '');
  emitter.group(Gc.MARKER, 'ENDBLK');
  emitter.group(Gc.HANDLE, entry.endHandle);
  emitter.group(Gc.OWNER, entry.recordHandle);
  emitter.group(Gc.SUBCLASS, SUBCLASS_ENTITY);
  if (entry.isPaper) emitter.group(Gc.PAPER_SPACE, 1);
  emitter.group(Gc.LAYER_REF, DXF_LAYER_ZERO);
  emitter.group(Gc.SUBCLASS, SUBCLASS_BLOCK_END);
}

export function writeDxfBlocksSection(emitter: DxfEmitter): void {
  emitter.group(Gc.MARKER, 'SECTION');
  emitter.group(Gc.NAME, 'BLOCKS');
  writeBlockPair(emitter, {
    recordHandle: HANDLE_MODEL_BLOCK_RECORD,
    name: '*Model_Space',
    beginHandle: HANDLE_MODEL_BLOCK_BEGIN,
    endHandle: HANDLE_MODEL_BLOCK_END,
    isPaper: false,
  });
  writeBlockPair(emitter, {
    recordHandle: HANDLE_PAPER_BLOCK_RECORD,
    name: '*Paper_Space',
    beginHandle: HANDLE_PAPER_BLOCK_BEGIN,
    endHandle: HANDLE_PAPER_BLOCK_END,
    isPaper: true,
  });
  emitter.group(Gc.MARKER, 'ENDSEC');
}

// ---------------------------------------------------------------------------
// OBJECTS — the root dictionary + named-object dictionaries + layouts
// ---------------------------------------------------------------------------

interface DictionaryEntryRef {
  name: string;
  softPointer: string;
}

interface DictionaryDef {
  handle: string;
  owner: string;
  entries: DictionaryEntryRef[];
}

function writeDictionary(emitter: DxfEmitter, dict: DictionaryDef): void {
  emitter.group(Gc.MARKER, 'DICTIONARY');
  emitter.group(Gc.HANDLE, dict.handle);
  emitter.group(Gc.OWNER, dict.owner);
  emitter.group(Gc.SUBCLASS, SUBCLASS_DICTIONARY);
  emitter.group(Gc.DUPLICATED_CLONING, 1);
  for (const entry of dict.entries) {
    emitter.group(Gc.DESCRIPTION, entry.name);
    emitter.group(Gc.DICTIONARY_ENTRY, entry.softPointer);
  }
}

interface LayoutDef {
  handle: string;
  name: string;
  tabOrder: number;
  blockRecord: string;
}

function writeLayout(emitter: DxfEmitter, layout: LayoutDef): void {
  emitter.group(Gc.MARKER, 'LAYOUT');
  emitter.group(Gc.HANDLE, layout.handle);
  emitter.group(Gc.OWNER, HANDLE_LAYOUT_DICTIONARY);
  emitter.group(Gc.SUBCLASS, SUBCLASS_PLOT_SETTINGS);
  emitter.group(Gc.TEXT_VALUE, ''); // page setup name
  emitter.group(Gc.NAME, NO_DEVICE); // printer/plotter
  emitter.group(Gc.BIGFONT, ''); // paper size
  emitter.group(Gc.LINETYPE_REF, ''); // plot view name
  emitter.group(Gc.RADIUS_OR_LENGTH, 0); // plot offset x
  emitter.group(Gc.PAPER_WIDTH_MM, 0);
  emitter.group(Gc.PAPER_HEIGHT_MM, 0);
  emitter.group(Gc.PLOT_MARGIN_LEFT, 0);
  emitter.group(Gc.PLOT_MARGIN_BOTTOM, 0);
  emitter.group(Gc.PLOT_MARGIN_RIGHT, 0);
  emitter.group(Gc.PLOT_MARGIN_TOP, 0);
  emitter.group(Gc.PAPER_IMAGE_ORIGIN_X, 0);
  emitter.group(Gc.PAPER_IMAGE_ORIGIN_Y, 0);
  emitter.group(Gc.PRINT_SCALE_NUMERATOR, 1);
  emitter.group(Gc.PRINT_SCALE_DENOMINATOR, 1);
  emitter.group(Gc.FLAGS, PLOT_SETTINGS_FLAGS);
  emitter.group(Gc.PLOT_FLAGS, 0);
  emitter.group(Gc.PAPER_SIZE_ORIGIN, 0);
  emitter.group(Gc.ROTATION_TYPE, ROTATE_PLOT_90);
  emitter.group(Gc.TEXTSTYLE_REF, ''); // shade-plot setup name
  emitter.group(Gc.PLOT_STYLE_TYPE, PLOT_STYLE_TYPE_SHADED);
  emitter.group(Gc.CUSTOM_SCALE_NUMERATOR, 1);
  emitter.group(Gc.CUSTOM_SCALE_DENOMINATOR, 0);
  emitter.group(Gc.UNIT_FACTOR, 0);
  emitter.group(Gc.SUBCLASS, SUBCLASS_LAYOUT);
  emitter.group(Gc.TEXT_VALUE, layout.name);
  emitter.group(Gc.FLAGS, 1);
  emitter.group(Gc.TAB_ORDER, layout.tabOrder);
  emitter.group(Gc.X, 0); // limmin
  emitter.group(Gc.Y, 0);
  emitter.group(Gc.X2, 0); // limmax
  emitter.group(Gc.Y2, 0);
  emitter.raw(LAYOUT_CODES.insertionBaseX, 0);
  emitter.raw(LAYOUT_CODES.insertionBaseY, 0);
  emitter.raw(LAYOUT_CODES.insertionBaseZ, 0);
  emitter.raw(LAYOUT_CODES.extMinX, 0);
  emitter.raw(LAYOUT_CODES.extMinY, 0);
  emitter.raw(LAYOUT_CODES.extMinZ, 0);
  emitter.raw(LAYOUT_CODES.elevation, 0);
  emitter.raw(LAYOUT_CODES.ucsOriginX, 0);
  emitter.raw(LAYOUT_CODES.ucsOriginY, 0);
  emitter.raw(LAYOUT_CODES.ucsOriginZ, 0);
  emitter.raw(LAYOUT_CODES.ucsXX, 1);
  emitter.raw(LAYOUT_CODES.ucsXY, 0);
  emitter.raw(LAYOUT_CODES.ucsXZ, 0);
  emitter.raw(LAYOUT_CODES.ucsYX, 0);
  emitter.raw(LAYOUT_CODES.ucsYY, 1);
  emitter.raw(LAYOUT_CODES.ucsYZ, 0);
  emitter.group(Gc.ORTHO_TYPE, 0);
  emitter.group(Gc.OWNER, layout.blockRecord);
}

export function writeDxfObjectsSection(emitter: DxfEmitter): void {
  emitter.group(Gc.MARKER, 'SECTION');
  emitter.group(Gc.NAME, 'OBJECTS');
  writeDictionary(emitter, {
    handle: HANDLE_ROOT_DICTIONARY,
    owner: '0',
    entries: [
      { name: 'ACAD_GROUP', softPointer: HANDLE_GROUP_DICTIONARY },
      { name: 'ACAD_LAYOUT', softPointer: HANDLE_LAYOUT_DICTIONARY },
      { name: 'ACAD_PLOTSETTINGS', softPointer: HANDLE_PLOTSETTINGS_DICTIONARY },
      { name: 'ACAD_PLOTSTYLENAME', softPointer: HANDLE_PLOTSTYLENAME_DICTIONARY },
    ],
  });
  writeDictionary(emitter, { handle: HANDLE_GROUP_DICTIONARY, owner: HANDLE_ROOT_DICTIONARY, entries: [] });
  // ACAD_PLOTSTYLENAME: a dictionary-with-default pointing at the placeholder.
  emitter.group(Gc.MARKER, 'ACDBDICTIONARYWDFLT');
  emitter.group(Gc.HANDLE, HANDLE_PLOTSTYLENAME_DICTIONARY);
  emitter.group(Gc.OWNER, HANDLE_ROOT_DICTIONARY);
  emitter.group(Gc.SUBCLASS, SUBCLASS_DICTIONARY);
  emitter.group(Gc.DUPLICATED_CLONING, 1);
  emitter.group(Gc.DESCRIPTION, 'Normal');
  emitter.group(Gc.DICTIONARY_ENTRY, HANDLE_PLOTSTYLE_PLACEHOLDER);
  emitter.group(Gc.SUBCLASS, SUBCLASS_DICTIONARY_WITH_DEFAULT);
  emitter.group(Gc.HARD_POINTER, HANDLE_PLOTSTYLE_PLACEHOLDER);
  emitter.group(Gc.MARKER, 'ACDBPLACEHOLDER');
  emitter.group(Gc.HANDLE, HANDLE_PLOTSTYLE_PLACEHOLDER);
  emitter.group(Gc.OWNER, HANDLE_PLOTSTYLENAME_DICTIONARY);
  writeDictionary(emitter, {
    handle: HANDLE_LAYOUT_DICTIONARY,
    owner: HANDLE_ROOT_DICTIONARY,
    entries: [
      { name: MODEL_LAYOUT_NAME, softPointer: HANDLE_MODEL_LAYOUT },
      { name: PAPER_LAYOUT_NAME, softPointer: HANDLE_PAPER_LAYOUT },
    ],
  });
  writeDictionary(emitter, {
    handle: HANDLE_PLOTSETTINGS_DICTIONARY,
    owner: HANDLE_ROOT_DICTIONARY,
    entries: [{ name: MODEL_LAYOUT_NAME, softPointer: HANDLE_PLOTSETTINGS_MODEL }],
  });
  writeLayout(emitter, {
    handle: HANDLE_MODEL_LAYOUT,
    name: MODEL_LAYOUT_NAME,
    tabOrder: 1,
    blockRecord: HANDLE_MODEL_BLOCK_RECORD,
  });
  writeLayout(emitter, {
    handle: HANDLE_PAPER_LAYOUT,
    name: PAPER_LAYOUT_NAME,
    tabOrder: 2,
    blockRecord: HANDLE_PAPER_BLOCK_RECORD,
  });
  emitter.group(Gc.MARKER, 'ENDSEC');
}
