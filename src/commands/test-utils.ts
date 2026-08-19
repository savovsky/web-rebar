import { expect } from 'vitest';
import { CommandError, type CommandErrorCode, exportIfc, placeBar, placeWall } from '@/commands';
import { createAppStore } from '@/stores';

/** Assert that fn throws a CommandError with the given code; returns it for message checks. */
export const expectCommandError = (fn: () => unknown, code: CommandErrorCode): CommandError => {
  try {
    fn();
  } catch (error) {
    expect(error).toBeInstanceOf(CommandError);
    expect((error as CommandError).code).toBe(code);
    return error as CommandError;
  }
  throw new Error(`Expected CommandError (${code}) but nothing was thrown`);
};

const PROBE_WALL_LENGTH_MM = 3000;
const PROBE_WALL_THICKNESS_MM = 200;
const PROBE_WALL_HEIGHT_MM = 2800;
const PROBE_BAR_DIAMETER_MM = 12;
const PROBE_BAR_Y_MM = 87;
const PROBE_BAR_Z_MM = 700;

/** IFC bytes for the registry-completeness probe's importIfcModel entry
 *  (m1-acceptance.test.ts): a one-wall + one-bar model exported through the
 *  §N exportIfc command — memoized per test file run; the imported ids are
 *  random per run and never collide with the probe fixture's (also random). */
let importProbeBytes: Promise<Uint8Array> | null = null;
export const getImportProbeBytes = (): Promise<Uint8Array> => {
  importProbeBytes ??= (async () => {
    const source = createAppStore();
    const wallId = source.dispatch(
      placeWall({
        startPoint: { x: 0, y: 0, z: 0 },
        endPoint: { x: PROBE_WALL_LENGTH_MM, y: 0, z: 0 },
        thickness: PROBE_WALL_THICKNESS_MM,
        height: PROBE_WALL_HEIGHT_MM,
      }),
    );
    source.dispatch(
      placeBar({
        hostElementId: wallId,
        diameter: PROBE_BAR_DIAMETER_MM,
        path: [
          { x: 0, y: PROBE_BAR_Y_MM, z: PROBE_BAR_Z_MM },
          { x: PROBE_WALL_LENGTH_MM, y: PROBE_BAR_Y_MM, z: PROBE_BAR_Z_MM },
        ],
      }),
    );
    const { bytes } = await source.dispatch(exportIfc());
    return bytes;
  })();
  return importProbeBytes;
};
