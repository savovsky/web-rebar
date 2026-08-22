// The M1 T6 registry-completeness tripwire (the §E undo-per-command review
// row), extracted from m1-acceptance.test.ts at M3 T3 when that file hit the
// lint line ceiling — the probe map grows with every command-adding task and
// M3 adds more (T3's three group commands, T5's moveBar). EVERY
// registry command is probed: a new command fails the probes-cover test until
// its undo behavior is decided (the tripwire working as designed, the M2
// pattern). Project-mutating commands must record exactly ONE undo level with
// exact frozen-reference restore both ways (Q2-a/Q4-a); pure read/file-output
// commands (setActiveSection, exportIfc, exportSectionDxf) record none. Async
// commands (exportIfc/importIfcModel — lazy web-ifc; importReferenceDocument —
// lazy dxf-adapter) are awaited. Crosses the real WASM boundary
// (initWasmFromDisk — group placement and the IFC probes need it).
import { beforeAll, describe, expect, it } from 'vitest';
import {
  type CommandName,
  commandRegistry,
  createSection,
  deleteBar,
  deleteElement,
  deletePlacementGroup,
  deleteSection,
  deleteSelection,
  exportIfc,
  exportSectionDxf,
  extendBar,
  importIfcModel,
  importReferenceDocument,
  moveBar,
  moveElement,
  movePlacementGroup,
  placeBar,
  placeBarGroup,
  placeWall,
  redo,
  removeReferenceDocument,
  reshapeSection,
  setActiveSection,
  setReferenceDocumentVisibility,
  undo,
  updatePlacementGroup,
} from '@/commands';
import { DEFAULT_BAR_DIAMETER_MM } from '@/commands/place-bar';
import { MINIMAL_REFERENCE_DXF, getImportProbeBytes } from '@/commands/test-utils';
import { initWasmFromDisk } from '@/engine/wasm-test-init';
import { createAppStore } from '@/stores';
import { setSelection } from '@/stores/ui-slice';

beforeAll(initWasmFromDisk);

/** One wall: 4000 × 200 × 2800 (the M0 acceptance dimensions). */
const WALL_PARAMS = {
  startPoint: { x: 0, y: 0, z: 0 },
  endPoint: { x: 4000, y: 0, z: 0 },
  thickness: 200,
  height: 2800,
};
const WALL_LENGTH_MM = 4000;
const MOVE_DELTA = { x: 0, y: 300, z: 0 } as const;

const sectionParams = (wallId: string) => ({
  name: 'S-1',
  lineStart: { x: 2000, y: -500, z: 0 },
  lineEnd: { x: 2000, y: 500, z: 0 },
  depthPoint: { x: 4500, y: 0, z: 0 },
  targetElementIds: [wallId],
});

const STRAIGHT_BAR_PATH = [
  { x: 0, y: 87, z: 500 },
  { x: WALL_LENGTH_MM, y: 87, z: 500 },
];

/** Group probe params (M3 T3): the full posThickness face of the probe wall,
 *  horizontal Ø12 @ 150 — the T2-verified rule corpus. */
const groupProbeParams = (wallId: string) => ({
  hostElementId: wallId,
  faceKey: 'face:posThickness' as const,
  region: { uMin: -2000, uMax: 2000, vMin: -1400, vMax: 1400 },
  diameter: 12,
  barSpacing: 150,
  edgeDistanceStart: 60,
  edgeDistanceEnd: 60,
  orientation: 'horizontal' as const,
});

interface ProbeFixture {
  store: ReturnType<typeof createAppStore>;
  wallId: string;
  barId: string;
  sectionId: string;
  referenceDocumentId: string;
  groupId: string;
}

/** Fresh wall + bar + section + reference document + placement group per
 *  probe — five recorded levels of history. Async: importReferenceDocument
 *  dynamically loads the dxf-adapter module (the M2 lazy-loading contract). */
const createProbeFixture = async (): Promise<ProbeFixture> => {
  const store = createAppStore();
  const wallId = store.dispatch(placeWall(WALL_PARAMS));
  const barId = store.dispatch(
    placeBar({ hostElementId: wallId, diameter: DEFAULT_BAR_DIAMETER_MM, path: STRAIGHT_BAR_PATH }),
  );
  const sectionId = store.dispatch(createSection(sectionParams(wallId)));
  const { documentId } = await store.dispatch(
    importReferenceDocument({ text: MINIMAL_REFERENCE_DXF, fileName: 'probe.dxf' }),
  );
  const { groupId } = store.dispatch(placeBarGroup(groupProbeParams(wallId)));
  return { store, wallId, barId, sectionId, referenceDocumentId: documentId, groupId };
};

/** One dispatch per registry command against the probe fixture. Async
 *  commands (exportIfc/importIfcModel — lazy web-ifc; importReferenceDocument
 *  — lazy dxf-adapter) return the dispatch promise. */
const commandProbes: Record<CommandName, (fixture: ProbeFixture) => void | Promise<void>> = {
  placeWall: ({ store }) => {
    store.dispatch(placeWall({ ...WALL_PARAMS, baseElevation: 3000 }));
  },
  placeBar: ({ store, wallId }) => {
    store.dispatch(placeBar({ hostElementId: wallId, diameter: 16, path: STRAIGHT_BAR_PATH }));
  },
  placeBarGroup: ({ store, wallId }) => {
    store.dispatch(placeBarGroup({ ...groupProbeParams(wallId), barSpacing: 300 }));
  },
  updatePlacementGroup: ({ store, groupId }) => {
    store.dispatch(updatePlacementGroup({ groupId, patch: { barSpacing: 250 } }));
  },
  deletePlacementGroup: ({ store, groupId }) => {
    store.dispatch(deletePlacementGroup({ groupId }));
  },
  extendBar: ({ store, barId }) => {
    store.dispatch(extendBar({ barId, point: { x: WALL_LENGTH_MM, y: 87, z: 1500 } }));
  },
  createSection: ({ store, wallId }) => {
    store.dispatch(
      createSection({
        name: 'S-2',
        lineStart: { x: 1000, y: -500, z: 0 },
        lineEnd: { x: 1000, y: 500, z: 0 },
        depthPoint: { x: 3500, y: 0, z: 0 },
        targetElementIds: [wallId],
      }),
    );
  },
  reshapeSection: ({ store, sectionId }) => {
    store.dispatch(
      reshapeSection({
        sectionId,
        lineStart: { x: 1000, y: -500, z: 0 },
        lineEnd: { x: 1000, y: 500, z: 0 },
        depthPoint: { x: 3500, y: 0, z: 0 },
      }),
    );
  },
  setActiveSection: ({ store, sectionId }) => {
    store.dispatch(setActiveSection({ sectionId }));
  },
  exportIfc: async ({ store }) => {
    await store.dispatch(exportIfc());
  },
  exportSectionDxf: async ({ store, sectionId }) => {
    await store.dispatch(exportSectionDxf({ sectionId }));
  },
  importIfcModel: async ({ store }) => {
    await store.dispatch(importIfcModel({ buffer: await getImportProbeBytes() }));
  },
  importReferenceDocument: async ({ store }) => {
    await store.dispatch(importReferenceDocument({ text: MINIMAL_REFERENCE_DXF, fileName: 'probe-2.dxf' }));
  },
  removeReferenceDocument: ({ store, referenceDocumentId }) => {
    store.dispatch(removeReferenceDocument({ documentId: referenceDocumentId }));
  },
  setReferenceDocumentVisibility: ({ store, referenceDocumentId }) => {
    store.dispatch(setReferenceDocumentVisibility({ documentId: referenceDocumentId, visible: false }));
  },
  moveElement: ({ store, wallId }) => {
    store.dispatch(moveElement({ elementId: wallId, delta: MOVE_DELTA }));
  },
  moveBar: ({ store, barId }) => {
    store.dispatch(moveBar({ barId, delta: MOVE_DELTA }));
  },
  movePlacementGroup: ({ store, groupId }) => {
    // posThickness face frame: u = −X (u = cross(+Z, normal)) — an
    // along-chord plan delta projects to du; the cross-chord component does
    // not reach a vertical side face.
    store.dispatch(movePlacementGroup({ groupId, delta: { x: 300, y: 0, z: 0 } }));
  },
  deleteBar: ({ store, barId }) => {
    store.dispatch(deleteBar({ id: barId }));
  },
  deleteElement: ({ store, wallId }) => {
    store.dispatch(deleteElement({ id: wallId }));
  },
  deleteSection: ({ store, sectionId }) => {
    store.dispatch(deleteSection({ sectionId }));
  },
  deleteSelection: ({ store, wallId }) => {
    store.dispatch(setSelection({ elementIds: [wallId], barIds: [], placementGroupIds: [] }));
    store.dispatch(deleteSelection());
  },
  undo: ({ store }) => {
    store.dispatch(undo());
  },
  redo: ({ store }) => {
    store.dispatch(redo());
  },
};

describe('every registered command is undoable (§E — the M1 T6 registry-completeness tripwire)', () => {
  it('probes cover EVERY registry command — a future command fails here until its undo behavior is decided', () => {
    expect(Object.keys(commandProbes).sort()).toEqual(Object.keys(commandRegistry).sort());
  });

  it('each project-mutating command records exactly ONE undo level and restores the exact pre-command reference on undo/redo', async () => {
    const mutating: CommandName[] = [
      'placeWall',
      'placeBar',
      'placeBarGroup',
      'updatePlacementGroup',
      'deletePlacementGroup',
      'extendBar',
      'createSection',
      'reshapeSection',
      'moveElement',
      'moveBar',
      'movePlacementGroup',
      'deleteBar',
      'deleteElement',
      'deleteSection',
      'deleteSelection',
      'importIfcModel',
      'importReferenceDocument',
      'removeReferenceDocument',
      'setReferenceDocumentVisibility',
    ];
    for (const name of mutating) {
      const fixture = await createProbeFixture();
      const before = fixture.store.getState().project;
      const depthBefore = fixture.store.getState().undo.past.length;

      // Awaiting is type-neutral: sync probes return void, async ones
      // (exportIfc/importIfcModel — lazy web-ifc load) a promise.
      await commandProbes[name](fixture);

      const after = fixture.store.getState().project;
      expect(after, name).not.toBe(before);
      expect(fixture.store.getState().undo.past, name).toHaveLength(depthBefore + 1);

      fixture.store.dispatch(undo());
      expect(fixture.store.getState().project, name).toBe(before); // exact frozen reference
      fixture.store.dispatch(redo());
      expect(fixture.store.getState().project, name).toBe(after);
    }
  });

  it('setActiveSection records no undo level — undo covers project state only (§E)', async () => {
    const fixture = await createProbeFixture();
    const depthBefore = fixture.store.getState().undo.past.length;
    const projectBefore = fixture.store.getState().project;

    void commandProbes.setActiveSection(fixture);

    expect(fixture.store.getState().undo.past).toHaveLength(depthBefore);
    expect(fixture.store.getState().project).toBe(projectBefore);
    expect(fixture.store.getState().ui.activeSectionId).toBe(fixture.sectionId);
  });

  it('exportIfc records no undo level and mutates nothing — pure read + file output (M2 T2, same precedent as setActiveSection)', async () => {
    const fixture = await createProbeFixture();
    const depthBefore = fixture.store.getState().undo.past.length;
    const projectBefore = fixture.store.getState().project;

    await commandProbes.exportIfc(fixture);

    expect(fixture.store.getState().undo.past).toHaveLength(depthBefore);
    expect(fixture.store.getState().project).toBe(projectBefore);
  });

  it('exportSectionDxf records no undo level and mutates nothing — pure read + file output (M2 T7, same precedent as exportIfc)', async () => {
    const fixture = await createProbeFixture();
    const depthBefore = fixture.store.getState().undo.past.length;
    const projectBefore = fixture.store.getState().project;

    await commandProbes.exportSectionDxf(fixture);

    expect(fixture.store.getState().undo.past).toHaveLength(depthBefore);
    expect(fixture.store.getState().project).toBe(projectBefore);
  });

  it('undo/redo themselves are never recorded', async () => {
    const fixture = await createProbeFixture();
    const depthBefore = fixture.store.getState().undo.past.length;
    const projectBefore = fixture.store.getState().project;

    void commandProbes.undo(fixture);
    expect(fixture.store.getState().undo.past).toHaveLength(depthBefore - 1);
    expect(fixture.store.getState().undo.future).toHaveLength(1);

    void commandProbes.redo(fixture);
    expect(fixture.store.getState().undo.past).toHaveLength(depthBefore);
    expect(fixture.store.getState().undo.future).toHaveLength(0);
    expect(fixture.store.getState().project).toBe(projectBefore);
  });
});
