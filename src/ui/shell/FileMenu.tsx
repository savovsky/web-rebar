// File menu (§B.2 top bar, M2 T4 + T6): Import IFC… / Import DXF… /
// Import DXF with units… / Export IFC. The component is dumb glue (rule 2):
// it only reads/writes FILES and dispatches the §N commands — importIfcModel/
// importReferenceDocument/exportIfc are the doorways; web-ifc, dxf-parser and
// the mapping modules are never touched from UI (the non-SPF-bytes WASM-abort
// guard lives inside importIfcModel, T3 finding #2). web-ifc and dxf-parser
// lazy-load inside the commands on first use; the status hint covers the
// wait. ALL entries disable while a transfer runs: the undo-scope middleware
// has a single scope slot and assumes serial command dispatch (T3 finding #3),
// so concurrent import/export commands are not allowed. Styling: shared menu
// tokens only (rule 6).
import { useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import {
  Content,
  Item,
  Portal,
  Root,
  Separator,
  Sub,
  SubContent,
  SubTrigger,
  Trigger,
} from '@radix-ui/react-dropdown-menu';
import { exportIfc, importIfcModel, importReferenceDocument } from '@/commands';
import type { AppDispatch } from '@/stores';
import { useAppDispatch } from '@/stores/hooks';
import { setCursorHint } from '@/stores/ui-slice';
import { DXF_IMPORTING_HINT, formatDxfImportError, formatDxfImportSummary } from './dxf-status-hints';
import {
  IFC_EXPORTING_HINT,
  IFC_IMPORTING_HINT,
  formatExportError,
  formatImportError,
  formatImportSummary,
} from './ifc-status-hints';
import { MENU_CONTENT_CLASS, MENU_ITEM_CLASS, MENU_SEPARATOR_CLASS, MENU_TRIGGER_CLASS } from './menu-styles';

/** IFC-SPF = ISO-10303-21 STEP physical file. */
const IFC_MIME_TYPE = 'application/x-step';
const IFC_FILE_ACCEPT = '.ifc';
const DXF_FILE_ACCEPT = '.dxf';

/** The Q4 units-override choice (the import flow owns this UX, T5 finding #1):
 *  a submenu offering the units a real building plan can be drawn in; the
 *  picked $INSUNITS code becomes importReferenceDocument's insunitsOverride. */
const DXF_UNITS_CHOICES: { label: string; insunits: number }[] = [
  { label: 'Millimetres (mm)', insunits: 4 },
  { label: 'Centimetres (cm)', insunits: 5 },
  { label: 'Metres (m)', insunits: 6 },
  { label: 'Inches (in)', insunits: 1 },
  { label: 'Feet (ft)', insunits: 2 },
];

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

interface TransferContext {
  dispatch: AppDispatch;
  setIsTransferring: (isTransferring: boolean) => void;
}

async function runIfcExport({ dispatch, setIsTransferring }: TransferContext): Promise<void> {
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
}

async function runIfcImport(context: TransferContext, file: File): Promise<void> {
  const { dispatch, setIsTransferring } = context;
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
}

interface DxfImportContext extends TransferContext {
  insunitsOverride: number | undefined;
}

async function runDxfImport(context: DxfImportContext, file: File): Promise<void> {
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

export function FileMenu() {
  const dispatch = useAppDispatch();
  const ifcInputRef = useRef<HTMLInputElement>(null);
  const dxfInputRef = useRef<HTMLInputElement>(null);
  const [isTransferring, setIsTransferring] = useState(false);
  // Set by the units submenu right before the DXF picker opens; consumed and
  // reset by the change handler (a cancelled picker leaves it stale — the next
  // menu click always re-sets it, so no wrong override can leak).
  const [dxfInsunitsOverride, setDxfInsunitsOverride] = useState<number | undefined>(undefined);
  const transfer: TransferContext = { dispatch, setIsTransferring };

  const onIfcFilePicked = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    // Reset so re-picking the SAME file fires change again.
    event.target.value = '';
    if (file !== undefined) void runIfcImport(transfer, file);
  };

  const onDxfFilePicked = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    const override = dxfInsunitsOverride;
    setDxfInsunitsOverride(undefined);
    if (file !== undefined) void runDxfImport({ ...transfer, insunitsOverride: override }, file);
  };

  const openDxfPicker = (insunitsOverride: number | undefined) => {
    setDxfInsunitsOverride(insunitsOverride);
    dxfInputRef.current?.click();
  };

  return (
    <>
      <Root>
        <Trigger className={MENU_TRIGGER_CLASS}>File</Trigger>
        <Portal>
          <Content align='start' className={MENU_CONTENT_CLASS}>
            <Item
              disabled={isTransferring}
              onSelect={() => ifcInputRef.current?.click()}
              className={MENU_ITEM_CLASS}
            >
              Import IFC…
            </Item>
            <Item
              disabled={isTransferring}
              onSelect={() => openDxfPicker(undefined)}
              className={MENU_ITEM_CLASS}
            >
              Import DXF…
            </Item>
            <Sub>
              <SubTrigger disabled={isTransferring} className={MENU_ITEM_CLASS}>
                Import DXF with units… <span aria-hidden='true'>▸</span>
              </SubTrigger>
              <Portal>
                <SubContent className={MENU_CONTENT_CLASS}>
                  {DXF_UNITS_CHOICES.map((choice) => (
                    <Item
                      key={choice.insunits}
                      onSelect={() => openDxfPicker(choice.insunits)}
                      className={MENU_ITEM_CLASS}
                    >
                      {choice.label}
                    </Item>
                  ))}
                </SubContent>
              </Portal>
            </Sub>
            <Separator className={MENU_SEPARATOR_CLASS} />
            <Item
              disabled={isTransferring}
              onSelect={() => void runIfcExport(transfer)}
              className={MENU_ITEM_CLASS}
            >
              Export IFC
            </Item>
          </Content>
        </Portal>
      </Root>
      <input
        ref={ifcInputRef}
        type='file'
        accept={IFC_FILE_ACCEPT}
        tabIndex={-1}
        aria-hidden='true'
        className='hidden'
        onChange={onIfcFilePicked}
      />
      <input
        ref={dxfInputRef}
        type='file'
        accept={DXF_FILE_ACCEPT}
        tabIndex={-1}
        aria-hidden='true'
        className='hidden'
        onChange={onDxfFilePicked}
      />
    </>
  );
}
