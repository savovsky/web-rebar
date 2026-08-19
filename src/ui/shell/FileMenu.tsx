// File menu (§B.2 top bar, M2 T4): Import IFC… / Export IFC. The component is
// dumb glue (rule 2): it only reads/writes FILES and dispatches the §N
// commands — exportIfc/importIfcModel are the doorways; web-ifc and the
// mapping modules are never touched from UI (the non-SPF-bytes WASM-abort
// guard lives inside importIfcModel, T3 finding #2). web-ifc lazy-loads
// inside the commands on first use; the status hint covers the wait. Both
// entries disable while a transfer runs: the undo-scope middleware has a
// single scope slot and assumes serial command dispatch (T3 finding #3), so
// concurrent IFC commands are not allowed. Styling: shared menu tokens only
// (rule 6).
import { useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import { Content, Item, Portal, Root, Trigger } from '@radix-ui/react-dropdown-menu';
import { exportIfc, importIfcModel } from '@/commands';
import { useAppDispatch } from '@/stores/hooks';
import { setCursorHint } from '@/stores/ui-slice';
import {
  IFC_EXPORTING_HINT,
  IFC_IMPORTING_HINT,
  formatExportError,
  formatImportError,
  formatImportSummary,
} from './ifc-status-hints';
import { MENU_CONTENT_CLASS, MENU_ITEM_CLASS, MENU_TRIGGER_CLASS } from './menu-styles';

/** IFC-SPF = ISO-10303-21 STEP physical file. */
const IFC_MIME_TYPE = 'application/x-step';
const IFC_FILE_ACCEPT = '.ifc';

/** Blob + object URL + anchor click — the download half of the round-trip. */
function downloadIfcFile(bytes: Uint8Array, fileName: string): void {
  // Fresh copy: the result is typed Uint8Array<ArrayBufferLike>, BlobPart
  // wants ArrayBuffer-backed views.
  const url = URL.createObjectURL(new Blob([new Uint8Array(bytes)], { type: IFC_MIME_TYPE }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function FileMenu() {
  const dispatch = useAppDispatch();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isTransferring, setIsTransferring] = useState(false);

  const runExport = async () => {
    setIsTransferring(true);
    dispatch(setCursorHint(IFC_EXPORTING_HINT));
    try {
      const { bytes, fileName } = await dispatch(exportIfc());
      downloadIfcFile(bytes, fileName);
      dispatch(setCursorHint(`Exported ${fileName}`));
    } catch (error) {
      dispatch(setCursorHint(formatExportError(error)));
    } finally {
      setIsTransferring(false);
    }
  };

  const runImport = async (file: File) => {
    setIsTransferring(true);
    dispatch(setCursorHint(IFC_IMPORTING_HINT));
    try {
      const buffer = new Uint8Array(await file.arrayBuffer());
      const summary = await dispatch(importIfcModel({ buffer }));
      dispatch(setCursorHint(formatImportSummary(summary)));
    } catch (error) {
      dispatch(setCursorHint(formatImportError(error)));
    } finally {
      setIsTransferring(false);
    }
  };

  const onFilePicked = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    // Reset so re-picking the SAME file fires change again.
    event.target.value = '';
    if (file !== undefined) void runImport(file);
  };

  return (
    <>
      <Root>
        <Trigger className={MENU_TRIGGER_CLASS}>File</Trigger>
        <Portal>
          <Content align='start' className={MENU_CONTENT_CLASS}>
            <Item
              disabled={isTransferring}
              onSelect={() => fileInputRef.current?.click()}
              className={MENU_ITEM_CLASS}
            >
              Import IFC…
            </Item>
            <Item disabled={isTransferring} onSelect={() => void runExport()} className={MENU_ITEM_CLASS}>
              Export IFC
            </Item>
          </Content>
        </Portal>
      </Root>
      <input
        ref={fileInputRef}
        type='file'
        accept={IFC_FILE_ACCEPT}
        tabIndex={-1}
        aria-hidden='true'
        className='hidden'
        onChange={onFilePicked}
      />
    </>
  );
}
