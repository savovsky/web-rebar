// Edit menu (§B.2 top bar, M1): Undo / Redo / Delete with shortcut labels and
// disabled states (empty stacks / nothing deletable) — discoverability for
// mouse-first users; the same commands are bound to the keyboard in
// use-tool-shortcuts. Items dispatch §N commands only (rule 1); styling is
// design tokens only (rule 6).
import { Content, Item, Portal, Root, Separator, Trigger } from '@radix-ui/react-dropdown-menu';
import { deleteSelection, redo, undo } from '@/commands';
import { useAppDispatch, useAppSelector } from '@/stores/hooks';

const TRIGGER_CLASS =
  'rounded-sm px-panel py-0.5 text-sm text-muted-foreground hover:bg-accent hover:text-foreground ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring ' +
  'data-[state=open]:bg-accent data-[state=open]:text-foreground';
const CONTENT_CLASS = 'z-50 min-w-44 rounded-md border border-border bg-panel p-1 shadow-md';
const ITEM_CLASS =
  'flex cursor-default select-none items-center justify-between gap-panel rounded-sm px-panel py-1 ' +
  'text-xs text-foreground outline-none data-[highlighted]:bg-accent ' +
  'data-[disabled]:pointer-events-none data-[disabled]:text-muted-foreground';
const SHORTCUT_CLASS = 'ml-4 font-mono text-muted-foreground';
const SEPARATOR_CLASS = 'my-1 h-px bg-border';

export function EditMenu() {
  const dispatch = useAppDispatch();
  const canUndo = useAppSelector((state) => state.undo.past.length > 0);
  const canRedo = useAppSelector((state) => state.undo.future.length > 0);
  // Mirrors the keyboard guard: Delete is inert while a placement draft runs.
  const canDelete = useAppSelector(
    (state) =>
      !state.ui.isInProgress &&
      (state.ui.selection.elementIds.length > 0 ||
        state.ui.selection.barIds.length > 0 ||
        state.ui.activeSectionId !== null),
  );
  return (
    <Root>
      <Trigger className={TRIGGER_CLASS}>Edit</Trigger>
      <Portal>
        <Content align='start' className={CONTENT_CLASS}>
          <Item disabled={!canUndo} onSelect={() => dispatch(undo())} className={ITEM_CLASS}>
            Undo <span className={SHORTCUT_CLASS}>Ctrl+Z</span>
          </Item>
          <Item disabled={!canRedo} onSelect={() => dispatch(redo())} className={ITEM_CLASS}>
            Redo <span className={SHORTCUT_CLASS}>Ctrl+Shift+Z</span>
          </Item>
          <Separator className={SEPARATOR_CLASS} />
          <Item disabled={!canDelete} onSelect={() => dispatch(deleteSelection())} className={ITEM_CLASS}>
            Delete <span className={SHORTCUT_CLASS}>Del</span>
          </Item>
        </Content>
      </Portal>
    </Root>
  );
}
