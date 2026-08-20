// M2 T5 — dxf-adapter end-to-end tests (the dxf-parser integration incl. the
// skip-counting parser seats) + the real-file risk probes against the author's
// AutoCAD exports. The fixtures are gitignored (docs/test-fixtures/dxf/): the
// probes SKIP gracefully when absent, but MUST run when present (the T5 hard
// gate — Q4's units/blocks risks cannot pass on synthetic fixtures alone).
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { type DxfImportResult, importDxfReference } from './dxf-adapter';
import { END_TO_END_DXF, expectArc } from './dxf-test-fixtures';

describe('importDxfReference (end-to-end through dxf-parser)', () => {
  it('parses and maps a full little file — units, bulge, blocks, skip counts (Q4/Q6)', () => {
    const result = importDxfReference(END_TO_END_DXF);
    expect(result.appliedInsunits).toBe(5); // cm
    expect(result.scaleToMm).toBe(10);
    expect(result.unitsAssumed).toBe(false);
    expect(result.headerInsunits).toBe(5);

    expect(result.primitives).toHaveLength(4);
    expect(result.primitives[0]).toMatchObject({
      kind: 'line',
      start: { x: 10, y: 10 },
      end: { x: 20, y: 10 },
      sourceLayer: 'WALLS',
    });
    expect(result.primitives[1]).toMatchObject({ kind: 'circle', center: { x: 50, y: 50 }, radius: 25 });
    // Bulge 1 from (0,0) to (2,0): lower semicircle, center (1,0) r 1 → ×10.
    const arc = expectArc(result.primitives[2]);
    expect(arc.center.x).toBeCloseTo(10);
    expect(arc.center.y).toBeCloseTo(0);
    expect(arc.radius).toBeCloseTo(10);
    expect(arc.startAngle).toBeCloseTo(Math.PI);
    expect(arc.endAngle).toBeCloseTo(0);
    // The SYM insert at (100,0): block line (0,0)-(1,0) → (100,0)-(101,0) → ×10.
    expect(result.primitives[3]).toMatchObject({ start: { x: 1000, y: 0 }, end: { x: 1010, y: 0 } });

    // TEXT is counted by the mapping layer; HATCH by the parser-seat marker.
    expect(result.skipped.unsupportedEntities.TEXT).toBe(1);
    expect(result.skipped.unsupportedEntities.HATCH).toBe(1);
  });

  it('throws on non-DXF content', () => {
    expect(() => importDxfReference('this is not a dxf file')).toThrow();
  });
});

// --------------------------------------------------------------------------
// Real-file risk probes (Q4 units/blocks) — the author's 8 AutoCAD exports.
// --------------------------------------------------------------------------

const FIXTURE_DIR = 'docs/test-fixtures/dxf'; // vitest cwd = project root
const fixtureFiles = existsSync(FIXTURE_DIR)
  ? readdirSync(FIXTURE_DIR)
      .filter((file) => file.endsWith('.dxf'))
      .sort()
  : [];
const hasFixtures = fixtureFiles.length > 0;

interface FixtureProbe {
  file: string;
  ms: number;
  result: DxfImportResult;
}

/** Every emitted coordinate must be finite — a NaN anywhere means a mapping bug. */
const expectFinitePrimitives = (file: string, result: DxfImportResult): void => {
  for (const primitive of result.primitives) {
    if (primitive.kind === 'polyline') {
      expect(
        primitive.points.every((p) => Number.isFinite(p.x) && Number.isFinite(p.y)),
        file,
      ).toBe(true);
    } else if (primitive.kind === 'line') {
      expect(
        Number.isFinite(primitive.start.x) &&
          Number.isFinite(primitive.end.x) &&
          Number.isFinite(primitive.end.y),
        file,
      ).toBe(true);
    } else {
      expect(Number.isFinite(primitive.center.x) && Number.isFinite(primitive.radius), file).toBe(true);
    }
  }
};

describe.skipIf(!hasFixtures)('author fixture probes — the real-file Q4 risk probe', () => {
  // ~80 MB across 8 files — parse+map ONCE for all probe tests (the generous
  // timeout covers the whole set; individual assertions stay at the default).
  let probes: FixtureProbe[] = [];
  beforeAll(() => {
    probes = fixtureFiles.map((file) => {
      const text = readFileSync(join(FIXTURE_DIR, file), 'utf8');
      const start = performance.now();
      const result = importDxfReference(text);
      return { file, ms: performance.now() - start, result };
    });
  }, 300_000);

  it('the full fixture set is present (the T5/T6 hard gate: 8 real AutoCAD exports)', () => {
    expect(fixtureFiles.length).toBeGreaterThanOrEqual(8);
  });

  it('every file parses, maps to primitives, and honors its declared units', () => {
    for (const { file, ms, result } of probes) {
      // Census (2026-08-18): all 2507_KOMO files declare cm (5), the Sarafovo file mm (4).
      expect(result.unitsAssumed, file).toBe(false);
      expect([4, 5], file).toContain(result.headerInsunits);
      expect(result.appliedInsunits, file).toBe(result.headerInsunits);
      expect([1, 10], file).toContain(result.scaleToMm);
      // Block explosion is load-bearing: every file's INSERTs multiply block content.
      expect(result.primitives.length, file).toBeGreaterThan(1000);
      // Guard rails stayed silent on real data.
      expect(result.skipped.unresolvedInserts, file).toBe(0);
      expect(result.skipped.cyclicInserts, file).toBe(0);
      expect(result.skipped.depthCappedInserts, file).toBe(0);
      expectFinitePrimitives(file, result);
      console.info(
        `[fixture] ${file}: ${ms.toFixed(0)} ms → ${result.primitives.length} primitives; skips`,
        result.skipped,
      );
    }
  });

  it('the units risk probe covers BOTH directions: cm files scale ×10, the mm file ×1', () => {
    const scales = new Set(probes.map(({ result }) => result.scaleToMm));
    expect(scales.has(10)).toBe(true); // the 2507_KOMO set (cm) — a missed table entry lands ×10 off
    expect(scales.has(1)).toBe(true); // the Sarafovo file (mm)
  });

  it('parser-dropped types are counted via the registered markers (HATCH fills, 3DSOLID/BODY)', () => {
    const totals = new Map<string, number>();
    for (const { result } of probes) {
      for (const [type, count] of Object.entries(result.skipped.unsupportedEntities)) {
        totals.set(type, (totals.get(type) ?? 0) + count);
      }
    }
    // Census (2026-08-18): HATCH in every KOMO plan file (54–358), 3DSOLID/BODY in the 3D-View export.
    expect(totals.get('HATCH') ?? 0).toBeGreaterThan(0);
    expect(totals.get('3DSOLID') ?? 0).toBeGreaterThan(0);
    console.info('[fixture] unsupported-entity totals:', Object.fromEntries(totals));
  });
});
