// Edit menu (§B.2 top bar, M1): Undo / Redo / Delete with shortcut labels and
// disabled states (empty stacks / nothing deletable) — discoverability for
// mouse-first users; the same commands are bound to the keyboard in
// use-tool-shortcuts. Items dispatch §N commands only (rule 1); styling is
// design tokens only (rule 6).
import { Content, Item, Portal, Root, Separator, Trigger } from '@radix-ui/react-dropdown-menu';
import { deleteSelection, redo, undo } from '@/commands';
import { useAppDispatch, useAppSelector } from '@/stores/hooks';
import {
  MENU_CONTENT_CLASS,
  MENU_ITEM_CLASS,
  MENU_SEPARATOR_CLASS,
  MENU_SHORTCUT_CLASS,
  MENU_TRIGGER_CLASS,
} from './menu-styles';

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
      <Trigger className={MENU_TRIGGER_CLASS}>Edit</Trigger>
      <Portal>
        <Content align='start' className={MENU_CONTENT_CLASS}>
          <Item disabled={!canUndo} onSelect={() => dispatch(undo())} className={MENU_ITEM_CLASS}>
            Undo <span className={MENU_SHORTCUT_CLASS}>Ctrl+Z</span>
          </Item>
          <Item disabled={!canRedo} onSelect={() => dispatch(redo())} className={MENU_ITEM_CLASS}>
            Redo <span className={MENU_SHORTCUT_CLASS}>Ctrl+Shift+Z</span>
          </Item>
          <Separator className={MENU_SEPARATOR_CLASS} />
          <Item
            disabled={!canDelete}
            onSelect={() => dispatch(deleteSelection())}
            className={MENU_ITEM_CLASS}
          >
            Delete <span className={MENU_SHORTCUT_CLASS}>Del</span>
          </Item>
        </Content>
      </Portal>
    </Root>
  );
}
