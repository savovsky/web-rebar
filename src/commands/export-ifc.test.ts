// M2 T2 — exportIfc §N command: pure export thunk (no mutation, no undo
// level — the setActiveSection precedent). Runs headless (node): web-ifc
// lazy-loads its node build via loadIfcApi. The entity-graph assertions live
// in src/io/ifc-mapping.test.ts; here the command contract only.
import { describe, expect, it } from 'vitest';
import { exportIfc, placeBar, placeWall } from '@/commands';
import { createAppStore } from '@/stores';

const WALL = {
  startPoint: { x: 0, y: 0, z: 0 },
  endPoint: { x: 4000, y: 0, z: 0 },
  thickness: 200,
  height: 2800,
};
const BAR_PATH = [
  { x: 500, y: 700, z: 87 },
  { x: 3500, y: 700, z: 87 },
];

describe('exportIfc command (§N — M2 T2)', () => {
  it('returns the IFC-SPF bytes and a sanitized <project name>.ifc file name', async () => {
    const store = createAppStore();
    const wallId = store.dispatch(placeWall(WALL));
    store.dispatch(placeBar({ hostElementId: wallId, diameter: 12, path: BAR_PATH }));

    const result = await store.dispatch(exportIfc());

    expect(result.fileName).toBe('Untitled Project.ifc');
    const text = new TextDecoder().decode(result.bytes);
    expect(text.startsWith('ISO-10303-21;')).toBe(true);
    expect(text).toContain('IFCWALLSTANDARDCASE');
    expect(text).toContain('IFCREINFORCINGBAR');
  });

  it('is PURE: no project mutation, no undo level (§E — export is interop output, not an edit)', async () => {
    const store = createAppStore();
    const wallId = store.dispatch(placeWall(WALL));
    store.dispatch(placeBar({ hostElementId: wallId, diameter: 12, path: BAR_PATH }));
    const projectBefore = store.getState().project;
    const depthBefore = store.getState().undo.past.length;

    await store.dispatch(exportIfc());

    expect(store.getState().project).toBe(projectBefore);
    expect(store.getState().undo.past).toHaveLength(depthBefore);
  });

  it('exports an empty model as valid IFC4 boilerplate (no products, no containment)', async () => {
    const store = createAppStore();

    const result = await store.dispatch(exportIfc());

    const text = new TextDecoder().decode(result.bytes);
    expect(text).toContain('IFCPROJECT');
    expect(text).not.toContain('IFCWALLSTANDARDCASE');
  });
});
