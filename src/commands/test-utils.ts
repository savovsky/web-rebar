import { expect } from 'vitest';
import { CommandError, type CommandErrorCode, exportIfc, placeBar, placeWall } from '@/commands';
import type { ReinforcementBar } from '@/data/models';
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
/** Minimal valid DXF text (mm units, one LINE on layer '0') for the
 *  registry-completeness probe's reference-document commands (m1-acceptance). */
export const MINIMAL_REFERENCE_DXF = [
  '  0',
  'SECTION',
  '  2',
  'HEADER',
  '  9',
  '$INSUNITS',
  ' 70',
  '     4',
  '  0',
  'ENDSEC',
  '  0',
  'SECTION',
  '  2',
  'ENTITIES',
  '  0',
  'LINE',
  '  8',
  '0',
  ' 10',
  '0.0',
  ' 20',
  '0.0',
  ' 11',
  '100.0',
  ' 21',
  '0.0',
  '  0',
  'ENDSEC',
  '  0',
  'EOF',
  '',
].join('\n');

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

/**
 * M3 T1 (plan Q7): `barMark` is assigned IDENTITY bookkeeping, not design
 * intent — it never enters the IFC adapter (plan IFC row), so the M2-era
 * round-trip "identical model" checks normalize marks away exactly like
 * metadata/sections are excluded, and assert the assignment separately (a
 * bijection over the bars — never a scrambled/partial set). §J user-editing
 * of marks may later migrate the helper; the exclusion note stays dated here.
 */
export const stripBarMarks = (
  reinforcement: Record<string, ReinforcementBar>,
): Record<string, Omit<ReinforcementBar, 'barMark'>> =>
  Object.fromEntries(
    Object.entries(reinforcement).map(([id, bar]) => {
      const rest = { ...bar };
      delete (rest as Partial<ReinforcementBar>).barMark;
      return [id, rest];
    }),
  );

/** Sorted mark multiset — compare against a full assignment, e.g. [1, 2, 3]. */
export const sortedBarMarks = (reinforcement: Record<string, ReinforcementBar>): number[] =>
  Object.values(reinforcement)
    .map((bar) => bar.barMark)
    .sort((a, b) => a - b);
