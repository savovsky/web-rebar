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
import { buildDanglingHostBarBytes } from '@/io/ifc-test-fixtures';
import { createIfcApi } from '@/io/web-ifc-loader';
import { createAppStore } from '@/stores';
import type { CommandErrorCode } from './command-error';

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
    // geometry verbatim (exact doubles), intent exactly equal.
    const imported = target.getState().project;
    expect(imported.elements).toEqual(sourceProject.elements);
    expect(imported.reinforcement).toEqual(sourceProject.reinforcement);
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
    target.dispatch(
      placeWall({
        startPoint: { x: 10000, y: 10000, z: 0 },
        endPoint: { x: 14000, y: 10000, z: 0 },
        thickness: 200,
        height: 2800,
      }),
    );
    const preImport = target.getState().project;
    expect(target.getState().undo.past).toHaveLength(1);

    const summary = await target.dispatch(importIfcModel({ buffer: bytes }));
    expect(summary.importedWalls).toBe(2);
    expect(Object.keys(target.getState().project.elements)).toHaveLength(3);
    expect(target.getState().undo.past).toHaveLength(2);

    target.dispatch(undo());
    expect(target.getState().project).toBe(preImport);
    expect(Object.keys(target.getState().project.elements)).toHaveLength(1);
    target.dispatch(redo());
    expect(Object.keys(target.getState().project.elements)).toHaveLength(3);
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
});
