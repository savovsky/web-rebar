/**
 * Steel catalog seed — DIN/EC2 (§K.2: DIN/EC2 first, other countries via JSON
 * rule files later, §K.5). Kept as plain data so a country pack can replace it
 * without code changes (see Deferred Topics: Multi-Country Steel Catalogs).
 *
 * Weights are nominal kg/m (d²/162 approximation of EN 10080 values) — needed
 * by the bar schedule (§J) from M3 onward, seeded now while the data is cheap.
 */

/** One available bar diameter in the catalog. */
export interface RebarDiameterSpec {
  /** Nominal diameter (mm). */
  diameter: number;
  /** Nominal weight (kg/m). */
  weightPerMeter: number;
  /**
   * Minimum mandrel (bending roller — Allplan "Biegerolle") diameter (mm).
   * Values follow DIN 1045-1 / EN 1992-1-1 Table 8.1 for B500B: 4·Ø for
   * Ø ≤ 16 mm, 7·Ø above. NOTE: not from the Allplan data extraction (the
   * retrieved docs carry only the glossary term, no values) — standard code
   * values; user-controllable per project post-POC.
   */
  mandrelDiameter: number;
}

/** One steel grade in the catalog. */
export interface SteelGradeSpec {
  /** Catalog key, e.g. 'B500B'. */
  name: string;
  /** Characteristic yield strength fyk (MPa). */
  yieldStrength: number;
  /** Ductility class per EN 10080. */
  ductilityClass: 'A' | 'B' | 'C';
}

/**
 * Default concrete cover per element kind (mm) — M0 seed values for interior
 * exposure (roughly EC2 XC1, c_nom). Real per-exposure-class tables arrive
 * with validation (§K) and country packs.
 */
export interface CoverDefaults {
  wall: number;
  slab: number;
  beam: number;
  column: number;
}

/** Country/standard-scoped catalog, JSON-shaped per §K.5. */
export interface SteelCatalog {
  country: string;
  standard: string;
  diameters: readonly RebarDiameterSpec[];
  grades: readonly SteelGradeSpec[];
  defaultGrade: string;
  defaultCover: CoverDefaults;
}

/** DIN/EC2 seed catalog — the only catalog in M0. */
export const DEFAULT_STEEL_CATALOG: SteelCatalog = {
  country: 'DE',
  standard: 'DIN 1045 / EC2',
  diameters: [
    { diameter: 6, weightPerMeter: 0.222, mandrelDiameter: 24 },
    { diameter: 8, weightPerMeter: 0.395, mandrelDiameter: 32 },
    { diameter: 10, weightPerMeter: 0.617, mandrelDiameter: 40 },
    { diameter: 12, weightPerMeter: 0.888, mandrelDiameter: 48 },
    { diameter: 14, weightPerMeter: 1.21, mandrelDiameter: 56 },
    { diameter: 16, weightPerMeter: 1.58, mandrelDiameter: 64 },
    { diameter: 20, weightPerMeter: 2.47, mandrelDiameter: 140 },
    { diameter: 25, weightPerMeter: 3.85, mandrelDiameter: 175 },
  ],
  grades: [{ name: 'B500B', yieldStrength: 500, ductilityClass: 'B' }],
  defaultGrade: 'B500B',
  defaultCover: {
    wall: 25,
    slab: 25,
    beam: 30,
    column: 30,
  },
};

/** Convenience: valid diameters (mm) of the default catalog, ascending. */
export const DEFAULT_DIAMETERS: readonly number[] = DEFAULT_STEEL_CATALOG.diameters.map(
  (spec) => spec.diameter,
);

/** Centerline bend radius (mm) for a catalog diameter: mandrel/2 + Ø/2
 *  (e.g. Ø12 → (48 + 12) / 2 = 30 mm). Falls back to the 4·Ø mandrel rule
 *  for diameters outside the catalog. */
export function resolveBendRadiusMm(diameter: number): number {
  const spec = DEFAULT_STEEL_CATALOG.diameters.find((entry) => entry.diameter === diameter);
  const mandrelDiameter = spec?.mandrelDiameter ?? 4 * diameter;
  return (mandrelDiameter + diameter) / 2;
}
