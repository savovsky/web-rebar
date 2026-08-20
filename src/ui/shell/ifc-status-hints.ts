// Status-bar copy for the File menu's IFC import/export flows (M2 T4). Pure
// formatting — the ONLY new logic T4 adds, kept out of the FileMenu component
// so it stays dumb (rule 2) and this stays headless-testable. Import failures
// branch on CommandError.code, never on message text (§N; T3 finding #1) —
// the code picks the user-facing lead-in, the message carries the detail.
import { CommandError } from '@/commands';
import type { ImportIfcModelSummary } from '@/commands';

/** Shown while an IFC command runs — the first dispatch pays the lazy
 *  web-ifc WASM load (loadIfcApi singleton inside the command). */
export const IFC_IMPORTING_HINT = 'Importing IFC… (the IFC module loads on first use)';
export const IFC_EXPORTING_HINT = 'Exporting IFC… (the IFC module loads on first use)';

function plural(count: number, singular: string): string {
  return `${count} ${singular}${count === 1 ? '' : 's'}`;
}

/**
 * The import summary for the status bar, built from ImportIfcModelSummary:
 * "Imported 2 walls + 1 bar" plus the Q7 reference outcome when foreign
 * products became render-only solids (T6.5 — "· 2242 reference solids
 * (128284 triangles)"), plus the skip reasons for what became nothing
 * (no design-intent data and no geometry / unsupported element types).
 */
export function formatImportSummary(summary: ImportIfcModelSummary): string {
  const headline = `Imported ${plural(summary.importedWalls, 'wall')} + ${plural(summary.importedBars, 'bar')}`;
  const segments: string[] = [headline];
  if (summary.reference !== null) {
    const { products, triangles, lengthUnitAssumed: isLengthUnitAssumed } = summary.reference;
    const unitsNote = isLengthUnitAssumed ? ' · units not declared — mm assumed' : '';
    segments.push(`${plural(products, 'reference solid')} (${plural(triangles, 'triangle')})${unitsNote}`);
  }
  const { missingIntentPset, unsupportedElements } = summary.skipped;
  const skippedTotal = missingIntentPset + unsupportedElements;
  if (skippedTotal > 0) {
    const reasons: string[] = [];
    if (missingIntentPset > 0)
      reasons.push(`${plural(missingIntentPset, 'element')} without design-intent data`);
    if (unsupportedElements > 0) reasons.push(plural(unsupportedElements, 'unsupported element'));
    segments.push(`skipped ${skippedTotal}: ${reasons.join(' + ')}`);
  }
  return segments.join(' · ');
}

/** importIfcModel rejections: INVALID_PARAMS = not an IFC file / double
 *  import / corrupt intent-carrying entity; NOT_FOUND = a bar's host wall is
 *  missing from both the file and the project (T3 finding #1). */
export function formatImportError(error: unknown): string {
  if (error instanceof CommandError) {
    switch (error.code) {
      case 'INVALID_PARAMS':
        return `Import rejected: ${error.message}`;
      case 'NOT_FOUND':
        return `Import rejected (unresolved host): ${error.message}`;
    }
  }
  return 'Import failed: unexpected error (see console)';
}

/** exportIfc is pure and never throws CommandError today, but branch by the
 *  same contract so a future validation error formats consistently. */
export function formatExportError(error: unknown): string {
  if (error instanceof CommandError) return `Export rejected: ${error.message}`;
  return 'Export failed: unexpected error (see console)';
}
