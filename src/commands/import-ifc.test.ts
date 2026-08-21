/**
 * M2 T3 — importIfcModel command tests + the §A round-trip acceptance probe
 * (plan §3): a model built through the §N commands (wall + bent bar at 25 mm
 * cover) → exportIfc → importIfcModel into a FRESH store → identical model —
 * same entity ids, wall params and bar paths EXACTLY equal (T1 proved SPF
 * doubles round-trip exactly; 1e-6 mm is the outer bound, toEqual is tighter),
 * design intent (coverDistance, hostElementId, steelGrade, diameter) exactly
 * equal. Project metadata and sections are excluded from "identical".
 * Undo behavior: exactly ONE undo level per import (Q4-a — async command
 * scope), undo restores the exact pre-import reference, redo re-applies.
 */
import { describe, expect, it } from 'vitest';
import { CommandError, exportIfc, importIfcModel, placeBar, placeWall, redo, undo } from '@/commands';
import type { ProjectModel } from '@/data/models';
import { FOREIGN_SOLIDS, buildDanglingHostBarBytes, buildForeignSolidsBytes } from '@/io/ifc-test-fixtures';
import { createIfcApi } from '@/io/web-ifc-loader';
import { createAppStore } from '@/stores';
import type { CommandErrorCode } from './command-error';
import { sortedBarMarks, stripBarMarks } from './test-utils';

/** The §A fixture: one wall + one bent bar at the 25 mm catalog cover. */
const WALL_PARAMS = {
  startPoint: { x: 0, y: 0, z: 0 },
  endPoint: { x: 4000, y: 0, z: 0 },
  thickness: 200,
  height: 2800,
};
const BENT_BAR_PATH = [
  { x: 500, y: 87, z: 700 },
  { x: 3500, y: 87, z: 700 },
  { x: 3500, y: 87, z: 1400 },
];
const UPSTREAM_WALL = { ...WALL_PARAMS, baseElevation: 3000 };

/** Exports the §A fixture (wall in plan + elevated wall + bent bar + straight
 *  bar) through the §N commands — the same doorway the acceptance uses. */
async function buildAcceptanceBytes(): Promise<{ bytes: Uint8Array; project: ProjectModel }> {
  const source = createAppStore();
  const wallId = source.dispatch(placeWall(WALL_PARAMS));
  source.dispatch(placeWall(UPSTREAM_WALL));
  source.dispatch(placeBar({ hostElementId: wallId, diameter: 12, path: BENT_BAR_PATH }));
  source.dispatch(placeBar({ hostElementId: wallId, diameter: 16, path: BENT_BAR_PATH.slice(0, 2) }));
  const { bytes } = await source.dispatch(exportIfc());
  return { bytes, project: source.getState().project };
}

async function expectCommandErrorCode(promise: Promise<unknown>, code: CommandErrorCode): Promise<void> {
  const error = await promise.catch((caught: unknown) => caught);
  expect(error).toBeInstanceOf(CommandError);
  expect((error as CommandError).code).toBe(code);
}

describe('importIfcModel command + §A round-trip acceptance (M2 T3)', () => {
  it('§A probe: export → import into a fresh store → identical model (ids, params/paths EXACT, intent exactly equal)', async () => {
    const { bytes, project: sourceProject } = await buildAcceptanceBytes();

    const target = createAppStore();
    const summary = await target.dispatch(importIfcModel({ buffer: bytes }));

    expect(summary.importedWalls).toBe(2);
    expect(summary.importedBars).toBe(2);
    expect(summary.skipped).toEqual({ missingIntentPset: 0, unsupportedElements: 0 });
    // Identical model (metadata/sections excluded per the §A definition): the
    // imported entity records EQUAL the source's — ids via GlobalId decode,
    // geometry verbatim (exact doubles), intent exactly equal. barMark is
    // assigned identity bookkeeping (M3 T1, plan Q7 — never in IFC), so it is
    // normalized out of the comparison like metadata; its assignment is
    // asserted separately as a complete bijection.
    const imported = target.getState().project;
    expect(imported.elements).toEqual(sourceProject.elements);
    expect(stripBarMarks(imported.reinforcement)).toEqual(stripBarMarks(sourceProject.reinforcement));
    expect(sortedBarMarks(imported.reinforcement)).toEqual([1, 2]);
    // Q7/T6.5: our own export yields NO reference document — every
    // geometry-carrying product carries intent and stays editable (no
    // duplication as solids).
    expect(summary.reference).toBeNull();
    expect(imported.referenceDocuments).toEqual({});
  });

  it('exactly ONE undo level per import (Q4-a); undo restores the exact pre-import reference; redo re-applies', async () => {
    const { bytes } = await buildAcceptanceBytes();
    const target = createAppStore();
    const preImport = target.getState().project;
    expect(target.getState().undo.past).toHaveLength(0);

    await target.dispatch(importIfcModel({ buffer: bytes }));
    const postImport = target.getState().project;
    expect(postImport).not.toBe(preImport);
    // 2 walls + 2 bars dispatched as per-entity add reducers, ONE level (Q4-a).
    expect(target.getState().undo.past).toHaveLength(1);

    target.dispatch(undo());
    expect(target.getState().project).toBe(preImport);
    target.dispatch(redo());
    expect(target.getState().project).toBe(postImport);
  });

  it('merges into a non-empty project: import adds entities, one undo level restores the pre-import state exactly', async () => {
    const { bytes } = await buildAcceptanceBytes();
    const target = createAppStore();
    const hostId = target.dispatch(
      placeWall({
        startPoint: { x: 10000, y: 10000, z: 0 },
        endPoint: { x: 14000, y: 10000, z: 0 },
        thickness: 200,
        height: 2800,
      }),
    );
    // M3 T1 / Q7-a: one pre-existing individual bar (mark 1) — the import
    // must re-base its bars onto the project counter (marks 2, 3) instead of
    // re-issuing the parse-local 1..n, so merge-imports keep marks unique.
    const existingBarId = target.dispatch(
      placeBar({
        hostElementId: hostId,
        diameter: 12,
        path: [
          { x: 10000, y: 10087, z: 700 },
          { x: 14000, y: 10087, z: 700 },
        ],
      }),
    );
    const preImport = target.getState().project;
    expect(target.getState().undo.past).toHaveLength(2);

    const summary = await target.dispatch(importIfcModel({ buffer: bytes }));
    expect(summary.importedWalls).toBe(2);
    expect(summary.importedBars).toBe(2);
    expect(Object.keys(target.getState().project.elements)).toHaveLength(3);
    expect(target.getState().undo.past).toHaveLength(3);
    const bars = Object.values(target.getState().project.reinforcement);
    expect(bars).toHaveLength(3);
    expect(bars.find((bar) => bar.id === existingBarId)?.barMark).toBe(1);
    // The re-base continues from the project counter (1 taken) — the imported
    // marks form the full assignment {2, 3} (the parse-local order is
    // normalized away; which imported bar gets 2 vs 3 is not intent).
    expect(sortedBarMarks(target.getState().project.reinforcement)).toEqual([1, 2, 3]);
    expect(target.getState().project.nextBarMark).toBe(4);

    target.dispatch(undo());
    expect(target.getState().project).toBe(preImport);
    expect(Object.keys(target.getState().project.elements)).toHaveLength(1);
    target.dispatch(redo());
    expect(Object.keys(target.getState().project.elements)).toHaveLength(3);
    expect(target.getState().project.nextBarMark).toBe(4); // redo re-applies the counter bump too
  });

  it('rejects an empty model import cleanly: no entities, no undo level, project reference unchanged', async () => {
    const source = createAppStore(); // empty model → valid IFC4 boilerplate only
    const { bytes } = await source.dispatch(exportIfc());
    const target = createAppStore();
    const preImport = target.getState().project;

    const summary = await target.dispatch(importIfcModel({ buffer: bytes }));
    expect(summary.importedWalls).toBe(0);
    expect(summary.importedBars).toBe(0);
    expect(target.getState().project).toBe(preImport);
    expect(target.getState().undo.past).toHaveLength(0);
  });

  it('rejects a double import (duplicate ids → INVALID_PARAMS) before mutating anything', async () => {
    const { bytes } = await buildAcceptanceBytes();
    const target = createAppStore();
    await target.dispatch(importIfcModel({ buffer: bytes }));
    const unchanged = target.getState().project;
    const depth = target.getState().undo.past.length;

    await expectCommandErrorCode(target.dispatch(importIfcModel({ buffer: bytes })), 'INVALID_PARAMS');
    expect(target.getState().project).toBe(unchanged);
    expect(target.getState().undo.past).toHaveLength(depth);
  });

  it('rejects a bar whose host resolves to nothing (NOT_FOUND) before mutating anything', async () => {
    const api = await createIfcApi();
    const bytes = buildDanglingHostBarBytes(api);
    const target = createAppStore();
    const unchanged = target.getState().project;

    await expectCommandErrorCode(target.dispatch(importIfcModel({ buffer: bytes })), 'NOT_FOUND');
    expect(target.getState().project).toBe(unchanged);
    expect(target.getState().undo.past).toHaveLength(0);
  });

  it('rejects non-IFC bytes with INVALID_PARAMS (parse failure is a parse failure, not unsupported)', async () => {
    const target = createAppStore();
    await expectCommandErrorCode(
      target.dispatch(importIfcModel({ buffer: new TextEncoder().encode('not an IFC file') })),
      'INVALID_PARAMS',
    );
    expect(target.getState().undo.past).toHaveLength(0);
  });

  it('Q7/T6.5: a foreign file (geometry, no intent psets) imports as ONE render-only reference document + zero editable entities, exactly ONE undo level', async () => {
    const api = await createIfcApi();
    const { bytes } = buildForeignSolidsBytes(api);
    const target = createAppStore();
    const preImport = target.getState().project;

    const summary = await target.dispatch(importIfcModel({ buffer: bytes, fileName: 'foreign-steel.ifc' }));

    expect(summary.importedWalls).toBe(0);
    expect(summary.importedBars).toBe(0);
    expect(summary.reference).not.toBeNull();
    expect(summary.reference?.products).toBe(2); // wall + proxy; the opening is excluded
    expect(summary.reference?.parts).toBe(2);
    expect(summary.reference?.triangles).toBe(FOREIGN_SOLIDS.trianglesPerBox * 2);
    expect(summary.reference?.lengthUnitAssumed).toBe(false);
    // The opening (geometry-carrying but deliberately excluded) is the only
    // skip — the pset-less wall/proxy folded into the solids.
    expect(summary.skipped).toEqual({ missingIntentPset: 0, unsupportedElements: 1 });

    const documents = Object.values(target.getState().project.referenceDocuments);
    expect(documents).toHaveLength(1);
    const document = documents[0];
    expect(document.id).toBe(summary.reference?.documentId);
    expect(document.name).toBe('foreign-steel.ifc');
    expect(document.source).toEqual({ kind: 'ifc', fileName: 'foreign-steel.ifc' });
    expect(document.visible).toBe(true);
    expect(document.content).toBe('solids');
    if (document.content !== 'solids') throw new Error('expected a solids document');
    expect(document.solids).toHaveLength(2);
    expect(document.solids[0].positions).toBeInstanceOf(Float32Array);
    expect(document.solids[0].indices).toBeInstanceOf(Uint32Array);
    // The wall part sits at its placement in world-space model mm.
    const wallPart = document.solids.find((part) => part.positions.length / 3 > 8) ?? document.solids[0];
    expect(Math.max(...wallPart.positions.filter((_, i) => i % 3 === 2))).toBeCloseTo(
      FOREIGN_SOLIDS.wall.at.z + FOREIGN_SOLIDS.wall.depth,
      3,
    );

    // ONE undo level for the whole import; undo restores the exact pre-import
    // reference; redo re-applies (typed arrays shared by reference).
    expect(target.getState().undo.past).toHaveLength(1);
    target.dispatch(undo());
    expect(target.getState().project).toBe(preImport);
    target.dispatch(redo());
    expect(Object.keys(target.getState().project.referenceDocuments)).toHaveLength(1);
  });

  it('Q7/T6.5: an import with neither editable entities nor solids dispatches nothing (no undo level)', async () => {
    const source = createAppStore(); // empty model → valid IFC4 boilerplate only
    const { bytes } = await source.dispatch(exportIfc());
    const target = createAppStore();
    const preImport = target.getState().project;

    const summary = await target.dispatch(importIfcModel({ buffer: bytes }));
    expect(summary.reference).toBeNull();
    expect(target.getState().project).toBe(preImport);
    expect(target.getState().undo.past).toHaveLength(0);
  });
});
