// File-transfer glue for the File menu (M2 T4 + T6; T7 added the section
// export): the async runner functions behind every menu entry. Extracted
// from FileMenu.tsx so the component stays dumb JSX glue under the TSX line
// cap (the menu-styles.ts extraction precedent). These are still dumb glue
// (rule 2): they read/write FILES, dispatch the §N commands (the only
// doorways — web-ifc, dxf-parser and the mapping modules are never touched
// from UI code, so the non-SPF-bytes WASM-abort guard stays command-side,
// T3 finding #2), and format status-bar hints via the pure hint modules.
import { exportIfc, exportSectionDxf, importIfcModel, importReferenceDocument } from '@/commands';
import type { AppDispatch } from '@/stores';
import { setCursorHint } from '@/stores/ui-slice';
import {
  DXF_IMPORTING_HINT,
  DXF_SECTION_EXPORTING_HINT,
  formatDxfExportError,
  formatDxfImportError,
  formatDxfImportSummary,
} from './dxf-status-hints';
import {
  IFC_EXPORTING_HINT,
  IFC_IMPORTING_HINT,
  formatExportError,
  formatImportError,
  formatImportSummary,
} from './ifc-status-hints';

/** IFC-SPF = ISO-10303-21 STEP physical file. */
const IFC_MIME_TYPE = 'application/x-step';
const DXF_MIME_TYPE = 'application/dxf';

export interface TransferContext {
  dispatch: AppDispatch;
  setIsTransferring: (isTransferring: boolean) => void;
}

/** Blob + object URL + anchor click — the download half of the round-trip. */
function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

export async function runIfcExport({ dispatch, setIsTransferring }: TransferContext): Promise<void> {
  setIsTransferring(true);
  dispatch(setCursorHint(IFC_EXPORTING_HINT));
  try {
    const { bytes, fileName } = await dispatch(exportIfc());
    // Fresh copy: the result is typed Uint8Array<ArrayBufferLike>, BlobPart
    // wants ArrayBuffer-backed views.
    downloadBlob(new Blob([new Uint8Array(bytes)], { type: IFC_MIME_TYPE }), fileName);
    dispatch(setCursorHint(`Exported ${fileName}`));
  } catch (error) {
    dispatch(setCursorHint(formatExportError(error)));
  } finally {
    setIsTransferring(false);
  }
}

export async function runIfcImport(context: TransferContext, file: File): Promise<void> {
  const { dispatch, setIsTransferring } = context;
  setIsTransferring(true);
  dispatch(setCursorHint(IFC_IMPORTING_HINT));
  try {
    const buffer = new Uint8Array(await file.arrayBuffer());
    // fileName feeds the reference document's display name/provenance when a
    // foreign file imports as solids (T6.5/Q7).
    const summary = await dispatch(importIfcModel({ buffer, fileName: file.name }));
    dispatch(setCursorHint(formatImportSummary(summary)));
  } catch (error) {
    dispatch(setCursorHint(formatImportError(error)));
  } finally {
    setIsTransferring(false);
  }
}

export interface DxfImportContext extends TransferContext {
  insunitsOverride: number | undefined;
}

export async function runDxfImport(context: DxfImportContext, file: File): Promise<void> {
  const { dispatch, setIsTransferring, insunitsOverride } = context;
  setIsTransferring(true);
  dispatch(setCursorHint(DXF_IMPORTING_HINT));
  try {
    const text = await file.text();
    const summary = await dispatch(importReferenceDocument({ text, fileName: file.name, insunitsOverride }));
    dispatch(setCursorHint(formatDxfImportSummary(summary)));
  } catch (error) {
    dispatch(setCursorHint(formatDxfImportError(error)));
  } finally {
    setIsTransferring(false);
  }
}

/** T7: export the ACTIVE section view to DXF (Q5 true 1:1 mm). The command is
 *  pure (no undo level); a stale activeSectionId (deleted section) is the
 *  NOT_FOUND branch of formatDxfExportError. */
export async function runDxfSectionExport(
  { dispatch, setIsTransferring }: TransferContext,
  sectionId: string,
): Promise<void> {
  setIsTransferring(true);
  dispatch(setCursorHint(DXF_SECTION_EXPORTING_HINT));
  try {
    const { text, fileName } = await dispatch(exportSectionDxf({ sectionId }));
    downloadBlob(new Blob([text], { type: DXF_MIME_TYPE }), fileName);
    dispatch(setCursorHint(`Exported ${fileName}`));
  } catch (error) {
    dispatch(setCursorHint(formatDxfExportError(error)));
  } finally {
    setIsTransferring(false);
  }
}
