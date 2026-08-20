/**
 * IFC GlobalId ↔ UUID codec (M2 T2, plan Q2). IfcGloballyUniqueId is the
 * standard 22-character compressed GUID: the GUID's 128 bits as ONE
 * big-endian integer written in base-64 over the IFC charset (0-9A-Za-z_$).
 * 22 digits × 6 bits = 132 bits, so the leading digit only ever spans 0–3
 * for a 128-bit value. The codec is bijective and deterministic — internal
 * UUIDs round-trip through IfcRoot.GlobalId losslessly (design-intent ids
 * travel as proper IFC citizenship, not as pset strings). T3's import decodes
 * with decompressIfcGuidToUuid; foreign GUIDs it cannot map back to a known
 * entity are M4 scope (Q2).
 */

const IFC_GUID_LENGTH = 22;
const BASE64_RADIX = 64n;
const HEX_RADIX = 16;
const UUID_HEX_DIGITS = 32;
const GUID_BIT_COUNT = 128n;
/** 2^128 — values at/above it need >22 IFC digits' worth of GUID space. */
const GUID_VALUE_LIMIT = BigInt(2) ** GUID_BIT_COUNT;
/** buildingSMART's IFC base-64 alphabet — the order is part of the encoding. */
const IFC_GUID_CHARSET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz_$';
/** Canonical UUID text: five hex groups 8-4-4-4-12 separated by dashes. */
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const UUID_GROUPING = /^(.{8})(.{4})(.{4})(.{4})(.{12})$/;

/** UUID (canonical dashed hex) → 22-character IfcGloballyUniqueId string. */
export function compressUuidToIfcGuid(uuid: string): string {
  if (!UUID_PATTERN.test(uuid)) {
    throw new Error(`ifc-guid: not a canonical UUID: ${uuid}`);
  }
  let value = BigInt(`0x${uuid.replaceAll('-', '')}`);
  const digits: string[] = [];
  for (let index = 0; index < IFC_GUID_LENGTH; index += 1) {
    digits.unshift(IFC_GUID_CHARSET[Number(value % BASE64_RADIX)]);
    value /= BASE64_RADIX;
  }
  return digits.join('');
}

/** 22-character IfcGloballyUniqueId string → UUID (lowercase canonical hex). */
export function decompressIfcGuidToUuid(guid: string): string {
  if (guid.length !== IFC_GUID_LENGTH) {
    throw new Error(`ifc-guid: expected ${IFC_GUID_LENGTH} characters, got ${guid.length}: ${guid}`);
  }
  let value = BigInt(0);
  for (const character of guid) {
    const digit = IFC_GUID_CHARSET.indexOf(character);
    if (digit === -1) {
      throw new Error(`ifc-guid: character outside the IFC charset: ${character}`);
    }
    value = value * BASE64_RADIX + BigInt(digit);
  }
  if (value >= GUID_VALUE_LIMIT) {
    throw new Error(`ifc-guid: value exceeds 128 bits (leading digit must be 0-3): ${guid}`);
  }
  const hex = value.toString(HEX_RADIX).padStart(UUID_HEX_DIGITS, '0');
  return hex.replace(UUID_GROUPING, '$1-$2-$3-$4-$5');
}
