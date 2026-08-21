/**
 * M2 T3 — IFC import mapping tests (plan §3). The T2 export fixture (built
 * through the §N commands) is exported via buildIfcModel and parsed back via
 * parseIfcModel with a FRESH IfcAPI instance each time — file-level
 * persistence, never in-memory reuse. Coordinates are verbatim Z-up mm (T2.5:
 * no transform), doubles round-trip EXACTLY (T1) → toEqual, not closeTo.
 */
import { describe, expect, it } from 'vitest';
import { placeBar, placeWall } from '@/commands';
import { sortedBarMarks, stripBarMarks } from '@/commands/test-utils';
import type { ProjectModel } from '@/data/models';
import { createAppStore } from '@/stores';
import {
  type FlatLocalPlacement,
  applyTransformPoint,
  parseIfcModel,
  resolvePlacementTransform,
} from './ifc-import';
import { buildIfcModel } from './ifc-mapping';
import { addForeignEntities, buildFallbackIdWallBytes } from './ifc-test-fixtures';
import { createIfcApi } from './web-ifc-loader';

/** Same shape as the T2 export fixture: two crossing walls (one elevated)
 *  plus a straight and a bent bar on wall A — ids are real command UUIDs. */
const WALL_A = {
  startPoint: { x: 0, y: 0, z: 0 },
  endPoint: { x: 4000, y: 0, z: 0 },
  thickness: 200,
  height: 2800,
};
const WALL_B = {
  startPoint: { x: 1000, y: 2000, z: 0 },
  endPoint: { x: 1000, y: 6000, z: 0 },
  thickness: 300,
  height: 2800,
  baseElevation: 3000,
};
const STRAIGHT_BAR_PATH = [
  { x: 500, y: 87, z: 700 },
  { x: 3500, y: 87, z: 700 },
];
const BENT_BAR_PATH = [
  { x: 500, y: 87, z: 1500 },
  { x: 3500, y: 87, z: 1500 },
  { x: 3500, y: 87, z: 2400 },
];

function buildFixtureModel(): ProjectModel {
  const store = createAppStore();
  const wallAId = store.dispatch(placeWall(WALL_A));
  store.dispatch(placeWall(WALL_B));
  store.dispatch(placeBar({ hostElementId: wallAId, diameter: 12, path: STRAIGHT_BAR_PATH }));
  store.dispatch(placeBar({ hostElementId: wallAId, diameter: 16, path: BENT_BAR_PATH }));
  return store.getState().project;
}

const byId = <T extends { id: string }>(entities: T[]): Record<string, T> =>
  Object.fromEntries(entities.map((entity) => [entity.id, entity]));

describe('IFC import mapping — IFC4 → internal models (M2 T3)', () => {
  it('round-trips walls + bars EXACTLY (verbatim Z-up coordinates, exact doubles — T1)', async () => {
    const source = buildFixtureModel();
    const writer = await createIfcApi();
    const { modelID, bytes } = buildIfcModel(writer, source);
    writer.CloseModel(modelID);

    const reader = await createIfcApi();
    const result = parseIfcModel(reader, bytes);
    expect(result.skipped.missingIntentPset).toBe(0);
    expect(result.skipped.unsupportedElements).toBe(0);
    // Same ids (GlobalId decode — T2 finding #4), params and paths verbatim.
    // barMark is parse-local identity bookkeeping (M3 T1 — it never enters
    // IFC per the plan row), normalized out like metadata/sections; the
    // parse-level 1..n assignment itself is asserted separately below.
    expect(byId(result.walls)).toEqual(source.elements);
    expect(stripBarMarks(byId(result.bars))).toEqual(stripBarMarks(source.reinforcement));
    expect(sortedBarMarks(byId(result.bars))).toEqual([1, 2]);
  });

  it('skips foreign entities with a reported count (Q2): pset-less wall + non-wall/bar element', async () => {
    const writer = await createIfcApi();
    const { modelID, bytes: initialBytes } = buildIfcModel(writer, buildFixtureModel());
    // Contaminate the export with a pset-less wall + one unsupported element.
    addForeignEntities(writer, modelID);
    const bytes = writer.SaveModel(modelID);
    writer.CloseModel(modelID);
    expect(new TextDecoder().decode(bytes)).toContain('IFCBUILDINGELEMENTPROXY');
    expect(new TextDecoder().decode(initialBytes)).not.toContain('IFCBUILDINGELEMENTPROXY');

    const reader = await createIfcApi();
    const result = parseIfcModel(reader, bytes);
    expect(result.walls).toHaveLength(2);
    expect(result.bars).toHaveLength(2);
    expect(result.skipped.missingIntentPset).toBe(1);
    expect(result.skipped.unsupportedElements).toBe(1);
  });

  it('recovers the entity id from the pset WebRebarId when GlobalId is not decodable (belt-and-braces fallback)', async () => {
    const api = await createIfcApi();
    const { bytes, wallUuid } = buildFallbackIdWallBytes(api);
    const result = parseIfcModel(api, bytes);
    expect(result.walls).toHaveLength(1);
    expect(result.walls[0].id).toBe(wallUuid);
    expect(result.walls[0].thickness).toBe(200);
  });

  it('placement transform: composes the PlacementRelTo chain (parent translation ∘ local rotation)', () => {
    // Parent: translate (100, 50, 0). Local: translate (10, 0, 0) and rotate
    // so local +X points along world +Y (RefDirection (0,1,0), Axis +Z).
    const parent: FlatLocalPlacement = {
      PlacementRelTo: null,
      RelativePlacement: {
        Location: { Coordinates: [{ value: 100 }, { value: 50 }, { value: 0 }] },
        Axis: null,
        RefDirection: null,
      },
    };
    const local: FlatLocalPlacement = {
      PlacementRelTo: parent,
      RelativePlacement: {
        Location: { Coordinates: [{ value: 10 }, { value: 0 }, { value: 0 }] },
        Axis: { DirectionRatios: [{ value: 0 }, { value: 0 }, { value: 1 }] },
        RefDirection: { DirectionRatios: [{ value: 0 }, { value: 1 }, { value: 0 }] },
      },
    };
    const transform = resolvePlacementTransform(local);
    expect(transform.origin).toEqual({ x: 110, y: 50, z: 0 });
    expect(transform.xAxis).toEqual({ x: 0, y: 1, z: 0 });
    expect(applyTransformPoint(transform, { x: 5, y: 0, z: 0 })).toEqual({ x: 110, y: 55, z: 0 });
    // Null placement is the identity (bars in our exports).
    expect(resolvePlacementTransform(null)).toEqual({
      origin: { x: 0, y: 0, z: 0 },
      xAxis: { x: 1, y: 0, z: 0 },
      yAxis: { x: 0, y: 1, z: 0 },
      zAxis: { x: 0, y: 0, z: 1 },
    });
  });
});
