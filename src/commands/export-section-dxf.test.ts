// M2 T7 — exportSectionDxf command contract (plan §7, Q5): the §N command
// reads selectSectionPrimitives, hands them to the writer, and returns text
// + file name — PURE (no mutation, no undo level — the exportIfc precedent).
// The reimport-fidelity probe runs at command level too: the exported file,
// read back through the T5 importer, matches the selector's primitives.
import { beforeAll, describe, expect, it } from 'vitest';
import { CommandError, createSection, exportSectionDxf, placeBar, placeWall } from '@/commands';
import { selectSectionPrimitives } from '@/engine/sectioning';
import { initWasmFromDisk } from '@/engine/wasm-test-init';
import { importDxfReference } from '@/io/dxf-adapter';
import { createAppStore } from '@/stores';

beforeAll(initWasmFromDisk);

const WALL = {
  startPoint: { x: 0, y: 0, z: 0 },
  endPoint: { x: 4000, y: 0, z: 0 },
  thickness: 200,
  height: 2800,
};
const BAR_DIAMETER_MM = 12;
/** Straight Ø12 bar along the wall at 25 mm cover from +Y (centerline y=87). */
const BAR_PATH = [
  { x: 0, y: 87, z: 700 },
  { x: 4000, y: 87, z: 700 },
];
/** Perpendicular cut at x=2000 looking +X (u runs along −y). */
const SECTION = (wallId: string) => ({
  name: 'S-1',
  lineStart: { x: 2000, y: -500, z: 0 },
  lineEnd: { x: 2000, y: 500, z: 0 },
  depthPoint: { x: 4500, y: 0, z: 0 },
  targetElementIds: [wallId],
});

function buildStore() {
  const store = createAppStore();
  const wallId = store.dispatch(placeWall(WALL));
  store.dispatch(placeBar({ hostElementId: wallId, diameter: BAR_DIAMETER_MM, path: BAR_PATH }));
  const sectionId = store.dispatch(createSection(SECTION(wallId)));
  return { store, sectionId };
}

describe('exportSectionDxf', () => {
  it('exports the active section: outline coords == selectSectionPrimitives output, circle radius == Ø/2 (reimport probe)', async () => {
    const { store, sectionId } = buildStore();
    const expected = selectSectionPrimitives(store.getState(), sectionId);
    if (expected === null) throw new Error('expected primitives for a known section');

    const { text, fileName } = await store.dispatch(exportSectionDxf({ sectionId }));
    expect(fileName).toBe('Untitled Project-S-1.dxf');

    const result = importDxfReference(text);
    expect(result.unitsAssumed).toBe(false);
    const polylines = result.primitives.filter((primitive) => primitive.kind === 'polyline');
    const circles = result.primitives.filter((primitive) => primitive.kind === 'circle');
    const lines = result.primitives.filter((primitive) => primitive.kind === 'line');

    // One 200-thick × 2800-high wall outline — exact coordinates, no flip.
    expect(polylines).toHaveLength(expected.concreteOutlines.length);
    expected.concreteOutlines.forEach((outline, index) => {
      const reimported = polylines[index];
      if (reimported.kind !== 'polyline') throw new Error('unreachable');
      outline.forEach((point, pointIndex) => {
        expect(reimported.points[pointIndex].x).toBeCloseTo(point.u, 9);
        expect(reimported.points[pointIndex].y).toBeCloseTo(point.v, 9);
      });
    });
    const outline = polylines[0];
    if (outline.kind !== 'polyline') throw new Error('unreachable');
    const xs = outline.points.map((point) => point.x);
    const ys = outline.points.map((point) => point.y);
    expect(Math.max(...xs) - Math.min(...xs)).toBeCloseTo(200); // true thickness
    expect(Math.max(...ys) - Math.min(...ys)).toBeCloseTo(2800); // true height

    // One cut dot: Ø12 → 12 mm circle at u = −87 (cover side), v = 700.
    expect(circles).toHaveLength(expected.cutBars.length);
    expect(expected.cutBars).toHaveLength(1);
    const dot = circles[0];
    if (dot.kind !== 'circle') throw new Error('unreachable');
    expect(dot.radius).toBeCloseTo(BAR_DIAMETER_MM / 2, 9);
    expect(dot.center.x).toBeCloseTo(expected.cutBars[0].center.u, 9);
    expect(dot.center.y).toBeCloseTo(expected.cutBars[0].center.v, 9);

    expect(lines).toHaveLength(expected.backgroundLines.length);
  });

  it('is PURE — no mutation, no undo level (the exportIfc/setActiveSection precedent)', async () => {
    const { store, sectionId } = buildStore();
    const projectBefore = store.getState().project;
    const depthBefore = store.getState().undo.past.length;

    await store.dispatch(exportSectionDxf({ sectionId }));

    expect(store.getState().project).toBe(projectBefore);
    expect(store.getState().undo.past).toHaveLength(depthBefore);
  });

  it('rejects an unknown section with NOT_FOUND and outputs nothing', async () => {
    const { store } = buildStore();
    const projectBefore = store.getState().project;
    await expect(store.dispatch(exportSectionDxf({ sectionId: 'no-such-section' }))).rejects.toSatisfy(
      (error: unknown) => error instanceof CommandError && error.code === 'NOT_FOUND',
    );
    expect(store.getState().project).toBe(projectBefore);
  });

  it('sanitizes filesystem-unsafe characters from the file name', async () => {
    const store = createAppStore();
    const wallId = store.dispatch(placeWall(WALL));
    const sectionId = store.dispatch(createSection({ ...SECTION(wallId), name: 'S/1:a' }));
    const { fileName } = await store.dispatch(exportSectionDxf({ sectionId }));
    expect(fileName).toBe('Untitled Project-S-1-a.dxf');
  });
});
