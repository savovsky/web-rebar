import type { ReferenceDocument } from '@/data/models';
import type { DxfImportResult, DxfImportSkips } from '@/io/dxf-adapter';
import type { AppThunk } from '@/stores';
import { addReferenceDocument } from '@/stores/project-slice';
import { CommandError } from './command-error';

export interface ImportReferenceDocumentParams {
  /** DXF file content as text (the File menu reads the file; the command stays
   *  headless — T6 wires the UI). */
  text: string;
  /** Original file name — becomes the document's display name + provenance tag. */
  fileName: string;
  /** Q4 units-override: wins over the file's $INSUNITS (the import flow's
   *  units-override choice for unitless or mis-declared files). */
  insunitsOverride?: number;
}

/** What the status bar summarizes after an import (the T4 ifc-status-hints
 *  pattern lands for DXF at T6). */
export interface ImportReferenceDocumentSummary {
  documentId: string;
  name: string;
  primitiveCount: number;
  /** The units code actually applied (override-resolved; 4 = mm). */
  appliedInsunits: number;
  /** mm per drawing unit applied. */
  scaleToMm: number;
  /** The Q4 warning case: unitless/missing/unknown $INSUNITS and no override. */
  unitsAssumed: boolean;
  skipped: DxfImportSkips;
}

/**
 * §N command: import a DXF file as ONE reference document (M2 plan T5, Q3 —
 * background linework for the doc-11 tracing workflow). Parses + maps via the
 * dxf-adapter module — DYNAMICALLY imported, because it imports dxf-parser
 * statically (the exportIfc/importIfcModel precedent: the parser must stay
 * out of the shell bundle). The whole document is built first, then added by
 * ONE reducer → exactly ONE undo level per import (the plan's F3 door-check
 * note — no per-entity cascade for DXF). A failed import mutates nothing and
 * records no undo level. An import producing zero primitives is NOT an error
 * (a text-only sheet is a legitimate file) — the skip report in the summary
 * tells the story.
 */
export const importReferenceDocument =
  (params: ImportReferenceDocumentParams): AppThunk<Promise<ImportReferenceDocumentSummary>> =>
  async (dispatch) => {
    if (params.text.trim() === '') {
      throw new CommandError('INVALID_PARAMS', 'importReferenceDocument: empty DXF content');
    }
    if (params.fileName.trim() === '') {
      throw new CommandError('INVALID_PARAMS', 'importReferenceDocument: fileName must not be empty');
    }
    const { importDxfReference } = await import('@/io/dxf-adapter');
    let result: DxfImportResult;
    try {
      result = importDxfReference(params.text, { insunitsOverride: params.insunitsOverride });
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      throw new CommandError('INVALID_PARAMS', `importReferenceDocument: failed to parse DXF — ${detail}`);
    }
    const document: ReferenceDocument = {
      id: crypto.randomUUID(),
      name: params.fileName,
      source: { kind: 'dxf', fileName: params.fileName, insunits: result.appliedInsunits },
      elevationMm: 0,
      visible: true,
      primitives: result.primitives,
    };
    dispatch(addReferenceDocument(document));
    return {
      documentId: document.id,
      name: document.name,
      primitiveCount: result.primitives.length,
      appliedInsunits: result.appliedInsunits,
      scaleToMm: result.scaleToMm,
      unitsAssumed: result.unitsAssumed,
      skipped: result.skipped,
    };
  };
