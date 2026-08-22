// T5 group-move projection tests (author direction 2026-08-22 — the Shift+
// drag group move): worldToFaceLocalDelta maps a world drag onto the face
// frame so the group's host-local REGION can shift (movePlacementGroup).
// Extracted from placement-group.test.ts when that file hit the 400-line
// lint ceiling. No WASM needed — the projection is pure face-frame math.
import { describe, expect, it } from 'vitest';
import type { WallElement } from '@/data/models';
import { worldToFaceLocalDelta } from './placement-group';

const WALL: WallElement = {
  id: 'wall-1',
  kind: 'wall',
  startPoint: { x: 0, y: 0, z: 0 },
  endPoint: { x: 4000, y: 0, z: 0 },
  thickness: 200,
  height: 2800,
  baseElevation: 0,
};

// mm tolerance matching the engine's own (1e-6) — see placement-group.test.ts.
function expectClose(actual: number, expected: number): void {
  expect(Math.abs(actual - expected)).toBeLessThan(1e-6);
}

describe('worldToFaceLocalDelta (M3 T5 group move)', () => {
  it('projects a plan drag onto a vertical side face: the in-plane component maps, the rest drops', () => {
    // posThickness: u = −X (u = cross(+Z, normal)), v = +Z. A plan delta
    // along the wall chord maps to −u; the cross-chord component has no
    // face-plane projection on a vertical face — and z=0 drags give dv = 0.
    expect(
      worldToFaceLocalDelta({ host: WALL, faceKey: 'face:posThickness', delta: { x: 500, y: 300, z: 0 } }),
    ).toEqual({ du: -500, dv: 0 });
  });

  it('maps along the thickness direction on the length end faces', () => {
    // posLength: normal = +X, u = +Y, v = +Z.
    expect(
      worldToFaceLocalDelta({ host: WALL, faceKey: 'face:posLength', delta: { x: 200, y: 300, z: 0 } }),
    ).toEqual({ du: 300, dv: 0 });
    // The face-normal component drops entirely: no face-plane component here.
    expect(
      worldToFaceLocalDelta({ host: WALL, faceKey: 'face:posLength', delta: { x: 200, y: 0, z: 0 } }),
    ).toEqual({ du: 0, dv: 0 });
  });

  it('an explicit z delta reaches the v axis (only the TOOL is plan-locked)', () => {
    expect(
      worldToFaceLocalDelta({ host: WALL, faceKey: 'face:posThickness', delta: { x: 500, y: 300, z: 400 } }),
    ).toEqual({ du: -500, dv: 400 });
  });

  it('a yawed host rotates the projection (the M0 Z-rotation math)', () => {
    // posThickness of a 30°-yawed wall: u = (−cos30, −sin30, 0).
    const cos30 = Math.cos(Math.PI / 6);
    const sin30 = Math.sin(Math.PI / 6);
    const yawedWall: WallElement = {
      ...WALL,
      startPoint: { x: 1000, y: 2000, z: 0 },
      endPoint: { x: 1000 + 4000 * cos30, y: 2000 + 4000 * sin30, z: 0 },
    };
    const { du, dv } = worldToFaceLocalDelta({
      host: yawedWall,
      faceKey: 'face:posThickness',
      delta: { x: 1000, y: 0, z: 0 },
    });
    expectClose(du, -1000 * cos30);
    expectClose(dv, 0);
  });

  it('maps a plan drag fully on the horizontal top face (magnitude preserved)', () => {
    const { du, dv } = worldToFaceLocalDelta({
      host: WALL,
      faceKey: 'face:top',
      delta: { x: 500, y: -300, z: 0 },
    });
    expectClose(Math.hypot(du, dv), Math.hypot(500, -300));
  });
});
