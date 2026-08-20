// M2 T5 — BLOCK/INSERT explosion tests (Q4): transform composition, base
// points, nesting, cycle guard, depth cap, array grids, ByBlock layer
// inheritance, mirroring (exact arcs), non-uniform scales, unresolved blocks.
import { describe, expect, it } from 'vitest';
import type { DxfBlockLike, DxfEntityLike } from './dxf-adapter';
import { mapDxfToReferencePrimitives } from './dxf-adapter';
import { arcEntity, expectArc, expectLine, insertEntity, lineEntity, makeDxf } from './dxf-test-fixtures';

describe('BLOCK/INSERT explosion (Q4)', () => {
  it('applies translation + rotation + scale to block content', () => {
    const result = mapDxfToReferencePrimitives(
      makeDxf({
        blocks: { B1: { entities: [lineEntity({ from: [0, 0], to: [10, 0] })] } },
        entities: [insertEntity('B1', { position: { x: 100, y: 50 }, rotation: 90, xScale: 2, yScale: 2 })],
      }),
    );
    // Local (10,0) → scaled (20,0) → rotated 90° → (0,20) → + (100,50).
    expect(result.primitives).toHaveLength(1);
    const line = expectLine(result.primitives[0]);
    expect(line.start.x).toBeCloseTo(100);
    expect(line.start.y).toBeCloseTo(50);
    expect(line.end.x).toBeCloseTo(100);
    expect(line.end.y).toBeCloseTo(70);
  });

  it('subtracts the block base point before the insert transform', () => {
    const result = mapDxfToReferencePrimitives(
      makeDxf({
        blocks: { B1: { position: { x: 10, y: 0 }, entities: [lineEntity({ from: [0, 0], to: [1, 0] })] } },
        entities: [insertEntity('B1', { position: { x: 100, y: 0 } })],
      }),
    );
    expect(result.primitives[0]).toMatchObject({ start: { x: 90, y: 0 }, end: { x: 91, y: 0 } });
  });

  it('composes nested inserts (block containing an INSERT of another block)', () => {
    const result = mapDxfToReferencePrimitives(
      makeDxf({
        blocks: {
          INNER: { entities: [lineEntity({ from: [0, 0], to: [0, 2] })] },
          OUTER: { entities: [insertEntity('INNER', { position: { x: 1, y: 0 }, rotation: 90 })] },
        },
        entities: [insertEntity('OUTER', { position: { x: 10, y: 10 }, rotation: -90 })],
      }),
    );
    expect(result.primitives).toHaveLength(1);
    // Inner line in OUTER space: (0,0)→(1,0), (0,2)→(−1,0). World (rot −90 at (10,10)): (10,9) and (10,11).
    const line = expectLine(result.primitives[0]);
    expect(line.start.x).toBeCloseTo(10);
    expect(line.start.y).toBeCloseTo(9);
    expect(line.end.x).toBeCloseTo(10);
    expect(line.end.y).toBeCloseTo(11);
  });

  it('the cycle guard terminates A↔B block recursion and counts the blocked insert', () => {
    const result = mapDxfToReferencePrimitives(
      makeDxf({
        blocks: {
          A: { entities: [lineEntity({ from: [0, 0], to: [1, 0] }), insertEntity('B')] },
          B: { entities: [lineEntity({ from: [0, 0], to: [2, 0] }), insertEntity('A')] },
        },
        entities: [insertEntity('A')],
      }),
    );
    expect(result.primitives).toHaveLength(2); // A's line + B's line; B→A blocked
    expect(result.skipped.cyclicInserts).toBe(1);
  });

  it('the depth cap bounds non-cyclic chains', () => {
    const CHAIN_LENGTH = 40;
    const blocks: Record<string, DxfBlockLike> = {};
    for (let index = 0; index < CHAIN_LENGTH; index += 1) {
      blocks[`K${index}`] = {
        entities:
          index + 1 < CHAIN_LENGTH
            ? [lineEntity({ from: [0, 0], to: [1, 0] }), insertEntity(`K${index + 1}`)]
            : [lineEntity({ from: [0, 0], to: [1, 0] })],
      };
    }
    const result = mapDxfToReferencePrimitives(makeDxf({ blocks, entities: [insertEntity('K0')] }));
    expect(result.skipped.depthCappedInserts).toBe(1);
    expect(result.primitives).toHaveLength(32); // MAX_BLOCK_INSERT_DEPTH
  });

  it('expands array (MINSERT) grids — spacing steps inside rotation and scale', () => {
    const result = mapDxfToReferencePrimitives(
      makeDxf({
        blocks: { CELL: { entities: [lineEntity({ from: [0, 0], to: [1, 0] })] } },
        entities: [
          insertEntity('CELL', {
            position: { x: 100, y: 0 },
            columnCount: 2,
            rowCount: 2,
            columnSpacing: 10,
            rowSpacing: 20,
          }),
        ],
      }),
    );
    expect(result.primitives).toHaveLength(4);
    const starts = result.primitives.map((p) => `${expectLine(p).start.x},${expectLine(p).start.y}`).sort();
    expect(starts).toEqual(['100,0', '100,20', '110,0', '110,20']);
  });

  it('caps pathological array grids instead of exploding them', () => {
    const result = mapDxfToReferencePrimitives(
      makeDxf({
        blocks: { CELL: { entities: [lineEntity({ from: [0, 0], to: [1, 0] })] } },
        entities: [
          insertEntity('CELL', { columnCount: 100, rowCount: 100, columnSpacing: 1, rowSpacing: 1 }),
        ],
      }),
    );
    expect(result.primitives).toHaveLength(0);
    expect(result.skipped.cappedArrayInserts).toBe(1);
  });

  it("block content on layer '0' inherits the INSERT's layer (ByBlock convention)", () => {
    const result = mapDxfToReferencePrimitives(
      makeDxf({
        blocks: {
          B1: {
            entities: [
              lineEntity({ from: [0, 0], to: [1, 0], extra: { layer: '0' } }),
              lineEntity({ from: [0, 1], to: [1, 1], extra: { layer: 'TEXTS' } }),
            ],
          },
        },
        entities: [insertEntity('B1', { layer: 'A-WALL' })],
      }),
    );
    expect(result.primitives[0].sourceLayer).toBe('A-WALL');
    expect(result.primitives[1].sourceLayer).toBe('TEXTS');
  });

  it('a mirrored insert (negative scale) maps arcs EXACTLY (angles remapped, sweep renormalized)', () => {
    const result = mapDxfToReferencePrimitives(
      makeDxf({
        blocks: {
          DOOR: {
            entities: [
              arcEntity({ center: { x: 1, y: 0 }, radius: 1, startAngle: 0, endAngle: 90 }),
              { type: 'CIRCLE', layer: 'WALLS', center: { x: 2, y: 0 }, radius: 3 } as DxfEntityLike,
            ],
          },
        },
        entities: [insertEntity('DOOR', { xScale: -1 })],
      }),
    );
    const arc = expectArc(result.primitives[0]);
    expect(arc.center.x).toBeCloseTo(-1);
    expect(arc.radius).toBeCloseTo(1);
    // Mirrored: 0° → 180°, 90° stays — sweep renormalized to CCW by swapping.
    expect(arc.startAngle).toBeCloseTo(Math.PI / 2);
    expect(arc.endAngle).toBeCloseTo(Math.PI);
    expect(result.primitives[1]).toMatchObject({ kind: 'circle', center: { x: -2, y: 0 }, radius: 3 });
  });

  it('a non-uniformly scaled insert skips its curves (they become ellipses) but keeps its lines', () => {
    const result = mapDxfToReferencePrimitives(
      makeDxf({
        blocks: {
          MIX: {
            entities: [
              lineEntity({ from: [0, 0], to: [2, 0] }),
              { type: 'CIRCLE', layer: 'WALLS', center: { x: 0, y: 0 }, radius: 1 } as DxfEntityLike,
            ],
          },
        },
        entities: [insertEntity('MIX', { xScale: 2, yScale: 1 })],
      }),
    );
    expect(result.primitives).toHaveLength(1);
    expect(result.primitives[0]).toMatchObject({ kind: 'line', end: { x: 4, y: 0 } });
    expect(result.skipped.nonUniformScaledCurves).toBe(1);
  });

  it('counts inserts naming a missing block', () => {
    const result = mapDxfToReferencePrimitives(makeDxf({ entities: [insertEntity('GHOST')] }));
    expect(result.primitives).toHaveLength(0);
    expect(result.skipped.unresolvedInserts).toBe(1);
  });
});
