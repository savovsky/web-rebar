// Collision Check button (§B.2 top bar; M3 T6 review amendment, author
// direction 2026-08-22): the §K.1 ON-DEMAND entry point — one click runs the
// §N checkBarClashes command over the active detailing scope (ALL model bars
// until the Layer Model lands — the command's scopeBarIds seam takes the
// future active layer) and surfaces the exact report (status-bar hint +
// §K.4 danger highlight; "no clashes" feedback on a clean run). Read-only
// and non-blocking — zero undo levels, always enabled. Dumb component
// (rules 1/2): dispatch only; styling tokens only (rule 6).
import { checkBarClashes } from '@/commands';
import { useAppDispatch } from '@/stores/hooks';
import { MENU_TRIGGER_CLASS } from './menu-styles';

export function CollisionCheckButton() {
  const dispatch = useAppDispatch();
  return (
    <button type='button' className={MENU_TRIGGER_CLASS} onClick={() => dispatch(checkBarClashes())}>
      Collision Check
    </button>
  );
}
