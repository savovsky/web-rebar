// Tests for the File menu's status-bar copy (M2 T4) — the only new logic in
// T4; the menu component itself is dumb file-I/O glue (rule 2).
import { describe, expect, it } from 'vitest';
import { CommandError } from '@/commands';
import type { ImportIfcModelSummary } from '@/commands';
import { formatExportError, formatImportError, formatImportSummary } from './ifc-status-hints';

function summary(partial: Partial<ImportIfcModelSummary>): ImportIfcModelSummary {
  return {
    importedWalls: 0,
    importedBars: 0,
    skipped: { missingIntentPset: 0, unsupportedElements: 0 },
    reference: null,
    ...partial,
  };
}

describe('formatImportSummary', () => {
  it('reports imported counts without a skip part when nothing was skipped', () => {
    expect(formatImportSummary(summary({ importedWalls: 2, importedBars: 1 }))).toBe(
      'Imported 2 walls + 1 bar',
    );
  });

  it('pluralizes singular counts', () => {
    expect(formatImportSummary(summary({ importedWalls: 1, importedBars: 0 }))).toBe(
      'Imported 1 wall + 0 bars',
    );
  });

  it('appends both skip reasons with their counts', () => {
    expect(
      formatImportSummary(
        summary({
          importedWalls: 1,
          importedBars: 2,
          skipped: { missingIntentPset: 2, unsupportedElements: 1 },
        }),
      ),
    ).toBe(
      'Imported 1 wall + 2 bars · skipped 3: 2 elements without design-intent data + 1 unsupported element',
    );
  });

  it('omits a skip reason when its count is zero', () => {
    expect(formatImportSummary(summary({ skipped: { missingIntentPset: 0, unsupportedElements: 2 } }))).toBe(
      'Imported 0 walls + 0 bars · skipped 2: 2 unsupported elements',
    );
  });

  it('reports the Q7 reference outcome (T6.5) between the headline and the skips', () => {
    expect(
      formatImportSummary(
        summary({
          reference: {
            documentId: 'doc-1',
            products: 2242,
            parts: 2242,
            triangles: 128284,
            lengthUnitAssumed: false,
          },
          skipped: { missingIntentPset: 0, unsupportedElements: 1766 },
        }),
      ),
    ).toBe(
      'Imported 0 walls + 0 bars · 2242 reference solids (128284 triangles) · skipped 1766: 1766 unsupported elements',
    );
  });

  it('singularizes a single reference solid and flags assumed units', () => {
    expect(
      formatImportSummary(
        summary({
          reference: { documentId: 'doc-1', products: 1, parts: 1, triangles: 12, lengthUnitAssumed: true },
        }),
      ),
    ).toBe('Imported 0 walls + 0 bars · 1 reference solid (12 triangles) · units not declared — mm assumed');
  });
});

describe('formatImportError', () => {
  it('branches on CommandError.code (INVALID_PARAMS), carrying the detail message', () => {
    const error = new CommandError('INVALID_PARAMS', 'not an IFC-SPF file');
    expect(formatImportError(error)).toBe('Import rejected: not an IFC-SPF file');
  });

  it('branches on CommandError.code (NOT_FOUND) with a distinct lead-in', () => {
    const error = new CommandError('NOT_FOUND', 'bar b host missing');
    expect(formatImportError(error)).toBe('Import rejected (unresolved host): bar b host missing');
  });

  it('falls back to a generic hint for non-command errors', () => {
    expect(formatImportError(new Error('wasm exploded'))).toBe(
      'Import failed: unexpected error (see console)',
    );
  });
});

describe('formatExportError', () => {
  it('falls back to a generic hint for non-command errors', () => {
    expect(formatExportError(new Error('network'))).toBe('Export failed: unexpected error (see console)');
  });
});
