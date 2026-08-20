// File menu (§B.2 top bar, M2 T4 + T6 + T7): Import IFC… / Import DXF… /
// Import DXF with units… / Export IFC / Export Section DXF. The component is
// dumb glue (rule 2): it only owns the file inputs and dispatches through
// the runners in file-transfers.ts; the §N commands are the doorways and the
// pure hint modules format the status-bar copy. web-ifc and dxf-parser
// lazy-load inside the commands on first use; the status hint covers the
// wait. ALL entries disable while a transfer runs: the undo-scope middleware
// has a single scope slot and assumes serial command dispatch (T3 finding
// #3), so concurrent import/export commands are not allowed. Export Section
// DXF (T7) enables only while a section is active. Styling: shared menu
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
import { useAppDispatch, useAppSelector } from '@/stores/hooks';
import {
  type TransferContext,
  runDxfImport,
  runDxfSectionExport,
  runIfcExport,
  runIfcImport,
} from './file-transfers';
import { MENU_CONTENT_CLASS, MENU_ITEM_CLASS, MENU_SEPARATOR_CLASS, MENU_TRIGGER_CLASS } from './menu-styles';

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

export function FileMenu() {
  const dispatch = useAppDispatch();
  const ifcInputRef = useRef<HTMLInputElement>(null);
  const dxfInputRef = useRef<HTMLInputElement>(null);
  const [isTransferring, setIsTransferring] = useState(false);
  // Set by the units submenu right before the DXF picker opens; consumed and
  // reset by the change handler (a cancelled picker leaves it stale — the next
  // menu click always re-sets it, so no wrong override can leak).
  const [dxfInsunitsOverride, setDxfInsunitsOverride] = useState<number | undefined>(undefined);
  const activeSectionId = useAppSelector((state) => state.ui.activeSectionId);
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
            <Item
              disabled={isTransferring || activeSectionId === null}
              onSelect={() => {
                if (activeSectionId !== null) void runDxfSectionExport(transfer, activeSectionId);
              }}
              className={MENU_ITEM_CLASS}
            >
              Export Section DXF
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
