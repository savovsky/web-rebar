import { describe, expect, it } from 'vitest';
import { CommandError } from '@/commands';
import type { ImportReferenceDocumentSummary } from '@/commands';
import {
  DXF_SECTION_EXPORTING_HINT,
  formatDxfExportError,
  formatDxfImportError,
  formatDxfImportSummary,
} from './dxf-status-hints';

function makeSummary(
  overrides: Partial<ImportReferenceDocumentSummary> = {},
): ImportReferenceDocumentSummary {
  return {
    documentId: 'doc-1',
    name: 'IP04-04.dxf',
    primitiveCount: 2442,
    appliedInsunits: 4,
    scaleToMm: 1,
    unitsAssumed: false,
    skipped: {
      unsupportedEntities: {},
      paperSpaceEntities: 0,
      unresolvedInserts: 0,
      cyclicInserts: 0,
      depthCappedInserts: 0,
      cappedArrayInserts: 0,
      nonUniformScaledCurves: 0,
      tiltedCurves: 0,
      degenerateSegments: 0,
    },
    ...overrides,
  };
}

describe('formatDxfImportSummary', () => {
  it('summarizes a clean mm import without units or skip notes', () => {
    expect(formatDxfImportSummary(makeSummary())).toBe('Imported "IP04-04.dxf" — 2442 primitives');
  });

  it('pluralizes a single primitive', () => {
    expect(formatDxfImportSummary(makeSummary({ primitiveCount: 1 }))).toContain('— 1 primitive');
  });

  it('reports declared non-mm units with the applied scale', () => {
    expect(formatDxfImportSummary(makeSummary({ appliedInsunits: 5, scaleToMm: 10 }))).toContain(
      'units: cm (×10 to mm)',
    );
  });

  it('warns when units were assumed and points at the override flow (Q4)', () => {
    const hint = formatDxfImportSummary(makeSummary({ unitsAssumed: true }));
    expect(hint).toContain('units not declared — mm assumed');
    expect(hint).toContain('Import DXF with units');
  });

  it('counts skips as OCCURRENCES (exploded instances), biggest classes first', () => {
    const summary = makeSummary({
      skipped: {
        unsupportedEntities: { HATCH: 567, TEXT: 753, SPLINE: 125 },
        paperSpaceEntities: 5,
        unresolvedInserts: 0,
        cyclicInserts: 0,
        depthCappedInserts: 0,
        cappedArrayInserts: 0,
        nonUniformScaledCurves: 0,
        tiltedCurves: 0,
        degenerateSegments: 0,
      },
    });
    expect(formatDxfImportSummary(summary)).toContain(
      'skipped 1450 occurrences: 753 TEXT + 567 HATCH + 125 SPLINE + 5 paper-space',
    );
  });

  it('treats a zero-primitive import as legitimate, not an error', () => {
    const summary = makeSummary({
      name: 'notes.dxf',
      primitiveCount: 0,
      skipped: {
        unsupportedEntities: { TEXT: 3 },
        paperSpaceEntities: 0,
        unresolvedInserts: 0,
        cyclicInserts: 0,
        depthCappedInserts: 0,
        cappedArrayInserts: 0,
        nonUniformScaledCurves: 0,
        tiltedCurves: 0,
        degenerateSegments: 0,
      },
    });
    const hint = formatDxfImportSummary(summary);
    expect(hint).toBe('Imported "notes.dxf" — 0 primitives · skipped 3 occurrences: 3 TEXT');
    expect(hint).not.toContain('rejected');
  });

  it('joins units and skip notes with the · separator', () => {
    const summary = makeSummary({
      appliedInsunits: 1,
      scaleToMm: 25.4,
      skipped: {
        unsupportedEntities: { DIMENSION: 22 },
        paperSpaceEntities: 0,
        unresolvedInserts: 0,
        cyclicInserts: 0,
        depthCappedInserts: 0,
        cappedArrayInserts: 0,
        nonUniformScaledCurves: 0,
        tiltedCurves: 0,
        degenerateSegments: 0,
      },
    });
    expect(formatDxfImportSummary(summary)).toBe(
      'Imported "IP04-04.dxf" — 2442 primitives · units: inches (×25.4 to mm) · skipped 22 occurrences: 22 DIMENSION',
    );
  });
});

describe('formatDxfImportError', () => {
  it('formats INVALID_PARAMS as a rejection with the command message', () => {
    const error = new CommandError('INVALID_PARAMS', 'importReferenceDocument: empty DXF content');
    expect(formatDxfImportError(error)).toBe('Import rejected: importReferenceDocument: empty DXF content');
  });

  it('formats NOT_FOUND as a rejection too', () => {
    const error = new CommandError('NOT_FOUND', 'gone');
    expect(formatDxfImportError(error)).toBe('Import rejected: gone');
  });

  it('falls back to a generic hint for non-command errors', () => {
    expect(formatDxfImportError(new Error('boom'))).toBe('Import failed: unexpected error (see console)');
  });
});

describe('formatDxfExportError (M2 T7 — exportSectionDxf)', () => {
  it('covers the lazy-load wait with a first-use hint', () => {
    expect(DXF_SECTION_EXPORTING_HINT).toBe('Exporting section DXF… (the DXF module loads on first use)');
  });

  it('formats NOT_FOUND as an unknown-section rejection with the command message', () => {
    const error = new CommandError('NOT_FOUND', 'exportSectionDxf: section not found: abc');
    expect(formatDxfExportError(error)).toBe(
      'Export rejected (unknown section): exportSectionDxf: section not found: abc',
    );
  });

  it('formats INVALID_PARAMS as a rejection with the command message', () => {
    const error = new CommandError('INVALID_PARAMS', 'bad params');
    expect(formatDxfExportError(error)).toBe('Export rejected: bad params');
  });

  it('falls back to a generic hint for non-command errors', () => {
    expect(formatDxfExportError(new Error('boom'))).toBe('Export failed: unexpected error (see console)');
  });
});
