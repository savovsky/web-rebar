/**
 * M2 T6.5 (plan Q7) — ifc-solids extraction tests. The synthetic fixture
 * (ifc-test-fixtures.ts buildForeignSolidsBytes) pins the two web-ifc
 * geometry-pipeline conventions with ASYMMETRIC placements (the
 * silent-mirroring class §C warns about): the Y-up→Z-up frame conversion and
 * the meters→mm unit normalization. The real-file probe (the author's
 * Advance Steel export, 4,008 products — gitignored, skips gracefully when
 * absent) is the Q7 perf tripwire at the milestone's probe scale.
 */
import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { FOREIGN_SOLIDS, buildForeignSolidsBytes } from '@/io/ifc-test-fixtures';
import { createIfcApi } from '@/io/web-ifc-loader';
import { extractIfcReferenceSolids } from './ifc-solids';

const REAL_FILE = 'docs/test-fixtures/ifc/2026.07.12 BE TP APP.ifc';
/** Q7 perf tripwire (the M1 T5 probe pattern): generous ceiling, the ACTUAL
 *  numbers are recorded in the task log from the [fixture] output. */
const REAL_FILE_EXTRACTION_BUDGET_MS = 30000;

interface Box {
  min: { x: number; y: number; z: number };
  max: { x: number; y: number; z: number };
}

function boundingBox(positions: Float32Array): Box {
  const min = { x: Infinity, y: Infinity, z: Infinity };
  const max = { x: -Infinity, y: -Infinity, z: -Infinity };
  for (let index = 0; index < positions.length; index += 3) {
    min.x = Math.min(min.x, positions[index]);
    min.y = Math.min(min.y, positions[index + 1]);
    min.z = Math.min(min.z, positions[index + 2]);
    max.x = Math.max(max.x, positions[index]);
    max.y = Math.max(max.y, positions[index + 1]);
    max.z = Math.max(max.z, positions[index + 2]);
  }
  return { min, max };
}

describe('extractIfcReferenceSolids (M2 T6.5, Q7)', () => {
  it('extracts geometry-carrying foreign products as world-space model-mm parts; openings and intent-carriers are excluded', async () => {
    const api = await createIfcApi();
    const { bytes, wallExpressId, proxyExpressId, openingExpressId } = buildForeignSolidsBytes(api);
    const modelID = api.OpenModel(bytes);
    try {
      // The intent-carrying exclusion path: pretend the foreign wall carries
      // intent → only the proxy may remain (the opening is always excluded).
      const extraction = extractIfcReferenceSolids({
        api,
        modelID,
        excludeExpressIds: new Set([wallExpressId]),
      });
      expect(extraction.products).toBe(1);
      expect(extraction.solidExpressIds.has(proxyExpressId)).toBe(true);
      expect(extraction.solidExpressIds.has(wallExpressId)).toBe(false);
      expect(extraction.solidExpressIds.has(openingExpressId)).toBe(false);
      expect(extraction.parts).toHaveLength(1);
      expect(extraction.triangles).toBe(FOREIGN_SOLIDS.trianglesPerBox);
    } finally {
      api.CloseModel(modelID);
    }
  });

  it('applies the frame conversion (Y-up web → Z-up model) and the mm unit scale, pinned by an asymmetric placement', async () => {
    const api = await createIfcApi();
    const { bytes } = buildForeignSolidsBytes(api);
    const modelID = api.OpenModel(bytes);
    try {
      const extraction = extractIfcReferenceSolids({ api, modelID, excludeExpressIds: new Set() });
      // mm declared (MILLI.METRE) → web-ifc normalized to meters → ×1000 back.
      expect(extraction.scaleToMm).toBe(1000);
      expect(extraction.lengthUnitAssumed).toBe(false);
      expect(extraction.products).toBe(2); // wall + proxy; the opening is excluded
      expect(extraction.triangles).toBe(FOREIGN_SOLIDS.trianglesPerBox * 2);

      const { wall } = FOREIGN_SOLIDS;
      const wallPart = extraction.parts.find((part) => part.color === null);
      expect(wallPart).toBeDefined();
      const box = boundingBox(wallPart!.positions);
      // Z-up model mm: the wall's 2800 depth rises in +Z from the placement
      // elevation, the 2000×200 profile is centered on the placement in plan.
      const expected = {
        min: { x: wall.at.x - wall.length / 2, y: wall.at.y - wall.width / 2, z: wall.at.z },
        max: { x: wall.at.x + wall.length / 2, y: wall.at.y + wall.width / 2, z: wall.at.z + wall.depth },
      };
      for (const axis of ['x', 'y', 'z'] as const) {
        expect(box.min[axis]).toBeCloseTo(expected.min[axis], 3);
        expect(box.max[axis]).toBeCloseTo(expected.max[axis], 3);
      }
      // Normals survive the frame flip: the top face normal is +Z in model space.
      const hasUpNormal = Array.from({ length: wallPart!.normals.length / 3 }, (_, vertex) => {
        const base = vertex * 3;
        return (
          Math.abs(wallPart!.normals[base]) < 1e-6 &&
          Math.abs(wallPart!.normals[base + 1]) < 1e-6 &&
          wallPart!.normals[base + 2] > 1 - 1e-6
        );
      }).some(Boolean);
      expect(hasUpNormal).toBe(true);
    } finally {
      api.CloseModel(modelID);
    }
  });

  it('unstyled geometry (web-ifc default white) falls back to null — the token fallback (the styled-color path is unreachable through web-ifc 0.0.77 synthetics, T6.5 finding)', async () => {
    const api = await createIfcApi();
    const { bytes } = buildForeignSolidsBytes(api);
    const modelID = api.OpenModel(bytes);
    try {
      const extraction = extractIfcReferenceSolids({ api, modelID, excludeExpressIds: new Set() });
      expect(extraction.parts).toHaveLength(2);
      expect(extraction.parts.every((part) => part.color === null)).toBe(true);
    } finally {
      api.CloseModel(modelID);
    }
  });

  it('flags the assumed-mm path when the file declares no length unit', async () => {
    const api = await createIfcApi();
    // The T3 fixture builders declare no units (CreateModel without a project).
    const { buildFallbackIdWallBytes } = await import('./ifc-test-fixtures');
    const { bytes } = buildFallbackIdWallBytes(api);
    const modelID = api.OpenModel(bytes);
    try {
      const extraction = extractIfcReferenceSolids({ api, modelID, excludeExpressIds: new Set() });
      expect(extraction.lengthUnitAssumed).toBe(true);
      expect(extraction.scaleToMm).toBe(1);
      // Raw values pass through unscaled: the 2000 mm wall stays 2000 long.
      const box = boundingBox(extraction.parts[0].positions);
      expect(box.max.x - box.min.x).toBeCloseTo(2000, 3);
    } finally {
      api.CloseModel(modelID);
    }
  });

  it("real-file probe: the author's Advance Steel export (4,008 products) extracts within the budget", async (context) => {
    if (!existsSync(REAL_FILE)) {
      context.skip('author fixture not present (gitignored) — the hard gate requires it for the perf probe');
      return;
    }
    const api = await createIfcApi();
    const started = performance.now();
    const modelID = api.OpenModel(new Uint8Array(readFileSync(REAL_FILE)));
    try {
      const extraction = extractIfcReferenceSolids({ api, modelID, excludeExpressIds: new Set() });
      const elapsedMs = performance.now() - started;
      let vertices = 0;
      for (const part of extraction.parts) vertices += part.positions.length / 3;
      console.info(
        `[fixture] Advance Steel extraction: ${elapsedMs.toFixed(0)} ms (open + LoadAllGeometry + walk) · ` +
          `${extraction.products} products · ${extraction.parts.length} parts · ${vertices} vertices · ` +
          `${extraction.triangles} triangles · scaleToMm ${extraction.scaleToMm} (assumed: ${extraction.lengthUnitAssumed})`,
      );
      expect(elapsedMs).toBeLessThan(REAL_FILE_EXTRACTION_BUDGET_MS);
      // Sanity at the probe scale (the Q7 trigger file: 1,598 plates + 455
      // beams + 124 accessories + 60 members + 5 columns = 2,242 steel
      // products; 1,766 openings yield no geometry).
      expect(extraction.products).toBe(2242);
      expect(extraction.triangles).toBeGreaterThan(100000);
      expect(extraction.scaleToMm).toBe(1000);
      expect(extraction.lengthUnitAssumed).toBe(false);

      // Render budget half of the tripwire: the merged-BufferGeometry build
      // (what ReferenceSolidsLayer memoizes per document) + retained bytes.
      const { buildReferenceSolidBuffers } = await import('@/engine/reference-geometry');
      const mergeStarted = performance.now();
      const buffers = buildReferenceSolidBuffers({
        solids: extraction.parts,
        fallbackColor: { r: 0.6, g: 0.6, b: 0.6 },
        opacity: 0.65,
      });
      const mergeMs = performance.now() - mergeStarted;
      const retainedBytes =
        buffers.positions.byteLength +
        buffers.normals.byteLength +
        buffers.colors.byteLength +
        buffers.indices.byteLength;
      console.info(
        `[fixture] merged render buffers: ${mergeMs.toFixed(1)} ms · ${buffers.indices.length / 3} triangles · ` +
          `${(retainedBytes / 1024 / 1024).toFixed(1)} MB GPU-side (ONE draw call per document)`,
      );
      expect(mergeMs).toBeLessThan(1000);
      expect(buffers.indices.length / 3).toBe(extraction.triangles);
    } finally {
      api.CloseModel(modelID);
    }
  }, 120000);
});
