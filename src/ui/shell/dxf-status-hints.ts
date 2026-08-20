// Status-bar copy for the File menu's DXF import flow (M2 T6 — the T4
// ifc-status-hints pattern). Pure formatting — kept out of the FileMenu
// component so it stays dumb (rule 2) and this stays headless-testable.
// Import failures branch on CommandError.code, never on message text (§N).
// Wording contract (T5 findings): skip counts count EXPLODED instances, so
// the summary says "occurrences" (a HATCH inside a 10×-inserted block is 10
// missing fills on screen); an import with ZERO primitives is legitimate
// (a text-only sheet) and must not read as an error.
import { CommandError } from '@/commands';
import type { ImportReferenceDocumentSummary } from '@/commands';
import type { DxfImportSkips } from '@/io/dxf-adapter';

/** Shown while the import runs — the first dispatch pays the lazy dxf-parser
 *  chunk load (dynamic import inside the importReferenceDocument command). */
export const DXF_IMPORTING_HINT = 'Importing DXF… (the DXF module loads on first use)';

const MILLIMETRES_INSUNITS = 4;

/** Display names for the units a real building plan can declare (the import
 *  flow's override submenu offers exactly the first five). */
const INSUNITS_DISPLAY_NAMES: Record<number, string> = {
  1: 'inches',
  2: 'feet',
  [MILLIMETRES_INSUNITS]: 'mm',
  5: 'cm',
  6: 'm',
};

function plural(count: number, singular: string): string {
  return `${count} ${singular}${count === 1 ? '' : 's'}`;
}

interface SkipEntry {
  count: number;
  label: string;
}

/** The structural (non-entity-type) skip counters, in stable display order. */
function structuralSkipEntries(skipped: DxfImportSkips): SkipEntry[] {
  return [
    { count: skipped.paperSpaceEntities, label: 'paper-space' },
    { count: skipped.unresolvedInserts, label: 'unresolved insert' },
    { count: skipped.cyclicInserts, label: 'cyclic insert' },
    { count: skipped.depthCappedInserts, label: 'depth-capped insert' },
    { count: skipped.cappedArrayInserts, label: 'capped array insert' },
    { count: skipped.nonUniformScaledCurves, label: 'non-uniformly scaled curve' },
    { count: skipped.tiltedCurves, label: 'tilted 3D curve' },
    { count: skipped.degenerateSegments, label: 'degenerate segment' },
  ].filter((entry) => entry.count > 0);
}

/** "skipped N occurrences: 753 TEXT + 680 DIMENSION + 5 paper-space + …" —
 *  biggest entity classes first, structural counters after; '' when clean. */
function formatSkips(skipped: DxfImportSkips): string {
  const entityEntries: SkipEntry[] = Object.entries(skipped.unsupportedEntities)
    .map(([type, count]) => ({ count, label: type }))
    .filter((entry) => entry.count > 0)
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
  const structuralEntries = structuralSkipEntries(skipped);
  const all = [...entityEntries, ...structuralEntries];
  if (all.length === 0) return '';
  const total = all.reduce((sum, entry) => sum + entry.count, 0);
  return `skipped ${plural(total, 'occurrence')}: ${all.map((entry) => `${entry.count} ${entry.label}`).join(' + ')}`;
}

/**
 * The import summary for the status bar, built from
 * ImportReferenceDocumentSummary. Zero primitives is NOT an error (T5 finding:
 * a text-only sheet is legitimate — the skip report tells the story). The Q4
 * units-assumed warning keys off `unitsAssumed` and points at the override
 * flow (File → Import DXF with units…).
 */
export function formatDxfImportSummary(summary: ImportReferenceDocumentSummary): string {
  const parts = [`Imported "${summary.name}" — ${plural(summary.primitiveCount, 'primitive')}`];
  if (summary.unitsAssumed) {
    parts.push(
      'units not declared — mm assumed (if mis-scaled: remove the background and re-import via File → Import DXF with units…)',
    );
  } else if (summary.appliedInsunits !== MILLIMETRES_INSUNITS) {
    const unitsName =
      INSUNITS_DISPLAY_NAMES[summary.appliedInsunits] ?? `$INSUNITS ${summary.appliedInsunits}`;
    parts.push(`units: ${unitsName} (×${summary.scaleToMm} to mm)`);
  }
  const skips = formatSkips(summary.skipped);
  if (skips !== '') parts.push(skips);
  return parts.join(' · ');
}

/** importReferenceDocument rejections are always INVALID_PARAMS today (empty
 *  content / empty file name / unparseable DXF / unknown units-override code);
 *  the switch keeps the branch-by-code contract for future codes. */
export function formatDxfImportError(error: unknown): string {
  if (error instanceof CommandError) {
    switch (error.code) {
      case 'INVALID_PARAMS':
        return `Import rejected: ${error.message}`;
      case 'NOT_FOUND':
        return `Import rejected: ${error.message}`;
    }
  }
  return 'Import failed: unexpected error (see console)';
}
