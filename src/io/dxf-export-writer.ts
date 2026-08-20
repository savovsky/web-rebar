/**
 * M2 T7 (iteration 2) — low-level DXF writer machinery shared by the section
 * exporter: the emitter, group codes, value formatting, the handle allocator
 * and the fixed well-known handle constants for the R2000 ownership graph.
 * Split from dxf-export.ts under the 400-line cap (the T5 precedent). Pure,
 * no dxf-parser dependency.
 */

/** DXF group codes used by the writer (the R2000/AC1015 subset). A const
 *  object + derived union type — enums are banned by erasableSyntaxOnly. */
export const Gc = {
  MARKER: 0,
  TEXT_VALUE: 1,
  NAME: 2,
  DESCRIPTION: 3,
  BIGFONT: 4,
  HANDLE: 5,
  LINETYPE_REF: 6,
  TEXTSTYLE_REF: 7,
  LAYER_REF: 8,
  HEADER_VAR: 9,
  X: 10,
  X2: 11,
  Y: 20,
  Y2: 21,
  Z: 30,
  Z2: 31,
  RADIUS_OR_LENGTH: 40,
  WIDTH_FACTOR: 41,
  LAST_HEIGHT: 42,
  CONSTANT_WIDTH: 43,
  PAPER_WIDTH_MM: 44,
  PAPER_HEIGHT_MM: 45,
  PLOT_MARGIN_LEFT: 46,
  PLOT_MARGIN_BOTTOM: 47,
  PLOT_MARGIN_RIGHT: 48,
  PLOT_MARGIN_TOP: 49,
  DASH_VALUE: 49,
  OBLIQUE_ANGLE: 50,
  COLOR_ACI: 62,
  PAPER_SPACE: 67,
  FLAGS: 70,
  TAB_ORDER: 71,
  TEXT_FLAGS: 71,
  PLOT_FLAGS: 72,
  ALIGNMENT: 72,
  PAPER_SIZE_ORIGIN: 73,
  DASH_ELEMENT_COUNT: 73,
  ROTATION_TYPE: 74,
  DASH_ELEMENT_TYPE: 74,
  PLOT_STYLE_TYPE: 75,
  ORTHO_TYPE: 76,
  VERTEX_COUNT: 90,
  SUBCLASS: 100,
  PAPER_IMAGE_ORIGIN_X: 140,
  PAPER_IMAGE_ORIGIN_Y: 141,
  PRINT_SCALE_NUMERATOR: 142,
  PRINT_SCALE_DENOMINATOR: 143,
  CUSTOM_SCALE_NUMERATOR: 147,
  CUSTOM_SCALE_DENOMINATOR: 148,
  UNIT_FACTOR: 149,
  EXPLODABLE: 280,
  DUPLICATED_CLONING: 281,
  OWNER: 330,
  LAYOUT_OWNER: 340,
  HARD_POINTER: 340,
  DICTIONARY_ENTRY: 350,
  LINEWEIGHT: 370,
  PLOT_STYLE: 390,
} as const;
export type Gc = (typeof Gc)[keyof typeof Gc];

/** Codes used once (layout coordinate fields 12–37) — emitted raw. */
export const LAYOUT_CODES = {
  insertionBaseX: 14,
  insertionBaseY: 24,
  insertionBaseZ: 34,
  extMinX: 15,
  extMinY: 25,
  extMinZ: 35,
  elevation: 146,
  ucsOriginX: 13,
  ucsOriginY: 23,
  ucsOriginZ: 33,
  ucsXX: 16,
  ucsXY: 26,
  ucsXZ: 36,
  ucsYX: 17,
  ucsYY: 27,
  ucsYZ: 37,
} as const;

/** Group-code formatting ranges (the no-magic-numbers rule wants these named). */
const FLOAT_CODE_MAX = 60; // codes < 60 are floats/text
const HANDLE_CODE_MIN = 330; // 330–369 are handle refs (raw hex)
const LINEWEIGHT_CODE_MIN = 370; // 370–399 integer (lineweight/plot-style)
const PLOT_STYLE_CODE_MAX = 400;
const DEFAULT_LINEWEIGHT_SENTINEL = -3; // group 370: -3 = default (ByLayer)
/** Integer groups are right-justified to this width (AutoCAD). */
const INTEGER_VALUE_WIDTH = 6;

/** AutoCAD value conventions: floats ALWAYS carry a decimal point (shortest
 *  round-trip repr otherwise — coordinates parse back to the exact doubles);
 *  integer groups right-justified; handle refs raw hex. */
export function formatGroupValue(code: Gc, value: string | number): string {
  if (typeof value === 'string') return value;
  const isIntegerCode =
    (code >= FLOAT_CODE_MAX && code < HANDLE_CODE_MIN) ||
    (code >= LINEWEIGHT_CODE_MIN && code < PLOT_STYLE_CODE_MAX);
  if (Number.isInteger(value) && isIntegerCode) {
    return String(value).padStart(INTEGER_VALUE_WIDTH, ' ');
  }
  const repr = String(value);
  return repr.includes('.') || repr.includes('e') || repr.includes('E') ? repr : `${repr}.0`;
}

/** Group 370 value for a layer's lineweight: -3 (default) when undefined. */
export function lineweightGroupValue(mm: number | undefined): number {
  return mm === undefined ? DEFAULT_LINEWEIGHT_SENTINEL : dxfLineweight100thsMm(mm);
}

/** The R2000 lineweight enum (100ths of mm) — group 370 accepts only these. */
const VALID_DXF_LINEWEIGHT_100THS_MM: Record<number, true> = {
  0: true,
  5: true,
  9: true,
  13: true,
  15: true,
  18: true,
  20: true,
  25: true,
  30: true,
  35: true,
  40: true,
  50: true,
  53: true,
  60: true,
  70: true,
  80: true,
  90: true,
  100: true,
  106: true,
  120: true,
  140: true,
  158: true,
  200: true,
  211: true,
};

/** Plot mm → the DXF lineweight enum; throws on a value real CAD cannot store
 *  (the plot seed becomes project settings post-M0 — fail loudly, not silently
 *  on a misconfigured pen table). */
export function dxfLineweight100thsMm(lineweightMm: number): number {
  const hundredths = Math.round(lineweightMm * 100);
  if (!VALID_DXF_LINEWEIGHT_100THS_MM[hundredths]) {
    throw new Error(`dxf-export: ${lineweightMm} mm is not a valid DXF lineweight`);
  }
  return hundredths;
}

/** A DXF group-pair emitter: `group(code, value)` appends two lines — the
 *  right-justified code + the formatted value. `raw` takes a literal code for
 *  the one-off layout coordinate fields. The closure keeps the emitters under
 *  the max-params rule without threading an output array. */
export interface DxfEmitter {
  lines: string[];
  group: (code: Gc, value: string | number) => void;
  raw: (code: number, value: string | number) => void;
}

export function createDxfEmitter(): DxfEmitter {
  const lines: string[] = [];
  const push = (code: number, value: string | number): void => {
    lines.push(String(code).padStart(3, ' '), formatGroupValue(code as Gc, value));
  };
  return { lines, group: push, raw: push };
}

// ---------------------------------------------------------------------------
// Fixed well-known handles (the R2000 ownership graph) + the entity allocator
// ---------------------------------------------------------------------------

export const HANDLE_BLOCK_RECORD_TABLE = '1';
export const HANDLE_LAYER_TABLE = '2';
export const HANDLE_STYLE_TABLE = '3';
export const HANDLE_LTYPE_TABLE = '5';
export const HANDLE_ROOT_DICTIONARY = 'C';
export const HANDLE_GROUP_DICTIONARY = 'D';
export const HANDLE_PLOTSTYLENAME_DICTIONARY = 'E';
export const HANDLE_PLOTSTYLE_PLACEHOLDER = 'F';
export const HANDLE_LAYER_ZERO = '10';
export const HANDLE_STYLE_STANDARD = '11';
export const HANDLE_PLOTSETTINGS_DICTIONARY = '19';
export const HANDLE_LAYOUT_DICTIONARY = '1A';
export const HANDLE_MODEL_BLOCK_RECORD = '1F';
export const HANDLE_MODEL_BLOCK_BEGIN = '20';
export const HANDLE_MODEL_BLOCK_END = '21';
export const HANDLE_MODEL_LAYOUT = '22';
export const HANDLE_PAPER_LAYOUT = '24';
export const HANDLE_PAPER_BLOCK_RECORD = 'D6';
export const HANDLE_PAPER_BLOCK_BEGIN = 'D8';
export const HANDLE_PAPER_BLOCK_END = 'D9';
export const HANDLE_LTYPE_BYBLOCK = '14';
export const HANDLE_LTYPE_BYLAYER = '15';
export const HANDLE_LTYPE_CONTINUOUS = '16';
export const HANDLE_LTYPE_DASHED = '17';
export const HANDLE_PLOTSETTINGS_MODEL = '23';

/** First entity handle; entities count up from here (0x100…). */
const FIRST_ENTITY_HANDLE = 0x100;

export interface HandleAllocator {
  next: () => string;
  seed: () => string;
}

const HEX_RADIX = 16;

export function createHandleAllocator(): HandleAllocator {
  let current = FIRST_ENTITY_HANDLE;
  return {
    next: () => {
      const handle = current.toString(HEX_RADIX).toUpperCase();
      current += 1;
      return handle;
    },
    seed: () => current.toString(HEX_RADIX).toUpperCase(),
  };
}
