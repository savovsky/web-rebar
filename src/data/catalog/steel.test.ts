// Bend radius seed: mandrel (Biegerolle) values per DIN 1045-1 / EN 1992-1-1
// Table 8.1 for B500B — 4·Ø up to Ø16, 7·Ø above. Centerline radius =
// mandrel/2 + Ø/2. Guards the table the Place Bar mesh generation relies on.
import { describe, expect, it } from 'vitest';
import { DEFAULT_STEEL_CATALOG, resolveBendRadiusMm } from './steel';

describe('steel catalog mandrel diameters', () => {
  it('follows the 4·Ø / 7·Ø rule', () => {
    for (const spec of DEFAULT_STEEL_CATALOG.diameters) {
      const expected = spec.diameter <= 16 ? 4 * spec.diameter : 7 * spec.diameter;
      expect(spec.mandrelDiameter).toBe(expected);
    }
  });
});

describe('resolveBendRadiusMm', () => {
  it('returns the centerline radius for catalog diameters', () => {
    expect(resolveBendRadiusMm(12)).toBe(30); // (48 + 12) / 2
    expect(resolveBendRadiusMm(16)).toBe(40); // (64 + 16) / 2
    expect(resolveBendRadiusMm(20)).toBe(80); // (140 + 20) / 2
    expect(resolveBendRadiusMm(25)).toBe(100); // (175 + 25) / 2
  });

  it('falls back to the 4·Ø mandrel rule for unknown diameters', () => {
    expect(resolveBendRadiusMm(15)).toBe((4 * 15 + 15) / 2); // 37.5
  });
});
