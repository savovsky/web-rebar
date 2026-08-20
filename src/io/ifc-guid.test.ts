/**
 * M2 T2 — IFC GlobalId ↔ UUID codec tests (plan Q2: internal ids round-trip
 * through IfcRoot.GlobalId via the standard compressed-GUID encoding).
 * Bijectivity is proven structurally (compress ∘ decompress = identity over a
 * fixed UUID set incl. the 0 / 2^128−1 extremes) plus the format invariants
 * (22 chars, IFC charset, leading digit 0–3); Allplan reading the T2 artifact
 * (manual test) proves acceptance by a real IFC consumer.
 */
import { describe, expect, it } from 'vitest';
import { compressUuidToIfcGuid, decompressIfcGuidToUuid } from './ifc-guid';

const FIXED_UUIDS = [
  '00000000-0000-0000-0000-000000000000', // all zero
  'ffffffff-ffff-ffff-ffff-ffffffffffff', // all ones (2^128 − 1)
  '3f6f9a42-1c6b-4d2e-9a71-0c5b8e2f4a66', // version-4 shape
  'c70e0e1a-5b5d-11ee-8c99-0242ac120002', // version-1 shape
  '12345678-9abc-def0-1234-56789abcdef0',
  'a1a2a3a4-b1b2-c1c2-d1d2-e1e2e3e4e5e6',
] as const;

const IFC_GUID_CHARSET = /^[0-9A-Za-z_$]{22}$/;

describe('compressUuidToIfcGuid', () => {
  it('produces a 22-char IFC-charset string whose leading digit spans only 0-3', () => {
    for (const uuid of FIXED_UUIDS) {
      const guid = compressUuidToIfcGuid(uuid);
      expect(guid).toMatch(IFC_GUID_CHARSET);
      expect('0123').toContain(guid[0]);
    }
  });

  it('encodes the 128-bit extremes to their known compressed forms', () => {
    expect(compressUuidToIfcGuid('00000000-0000-0000-0000-000000000000')).toBe('0'.repeat(22));
    // 2^128 − 1 → leading digit 3 (2 bits), then 21 digits of 63 = '$'.
    expect(compressUuidToIfcGuid('ffffffff-ffff-ffff-ffff-ffffffffffff')).toBe(`3${'$'.repeat(21)}`);
  });

  it('is deterministic — the same UUID always compresses to the same GUID', () => {
    const uuid = '3f6f9a42-1c6b-4d2e-9a71-0c5b8e2f4a66';
    expect(compressUuidToIfcGuid(uuid)).toBe(compressUuidToIfcGuid(uuid));
  });

  it('rejects non-UUID input (ids are UUIDs by construction — a violation is a bug, not data)', () => {
    expect(() => compressUuidToIfcGuid('wall-1')).toThrow('ifc-guid');
    expect(() => compressUuidToIfcGuid('3f6f9a421c6b4d2e9a710c5b8e2f4a66')).toThrow('ifc-guid'); // no dashes
    expect(() => compressUuidToIfcGuid('')).toThrow('ifc-guid');
  });
});

describe('decompressIfcGuidToUuid', () => {
  it('is the exact inverse of compress over the fixed UUID set (Q2 round-trip)', () => {
    for (const uuid of FIXED_UUIDS) {
      expect(decompressIfcGuidToUuid(compressUuidToIfcGuid(uuid))).toBe(uuid);
    }
  });

  it('round-trips freshly generated UUIDs (the crypto.randomUUID shape commands issue)', () => {
    for (let index = 0; index < 50; index += 1) {
      const uuid = crypto.randomUUID();
      expect(decompressIfcGuidToUuid(compressUuidToIfcGuid(uuid))).toBe(uuid);
    }
  });

  it('rejects malformed GUIDs (length, charset, >128-bit value)', () => {
    expect(() => decompressIfcGuidToUuid('abc')).toThrow('ifc-guid');
    expect(() => decompressIfcGuidToUuid('0'.repeat(23))).toThrow('ifc-guid');
    expect(() => decompressIfcGuidToUuid(`${'0'.repeat(21)}!0`)).toThrow('ifc-guid');
    // Leading digit 4 would need 129+ bits — outside the 128-bit GUID space.
    expect(() => decompressIfcGuidToUuid(`4${'0'.repeat(21)}`)).toThrow('ifc-guid');
  });
});
