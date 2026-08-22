// §N command: ON-DEMAND bar clash check (§K.1 "user controls when" — the
// first §K on-demand entry point; M3 T6 review amendment, author direction
// 2026-08-22: "Collision check" button). Runs the T6 engine over the ACTIVE
// DETAILING SCOPE and SURFACES the exact report itself (the transient
// ui.clashWarning layer + a status-bar hint — its result IS the surfacing,
// including the "no clashes" feedback; the placement-time commands instead
// RETURN their reports and let the interaction layer surface them).
//
// Scope door (author direction, same review): "only the bars in the currently
// active layer are checked" — multiple switchable layers (vertical
// reinforcement, horizontal reinforcement, …) arrive with the Layer Model
// (deferred topic, before M4). Until then there is ONE implicit active layer
// = all model bars; `scopeBarIds` is the seam the layer model will feed —
// no visibility/freeze/layer semantics are built here (door check honored).
// Criteria values (today: clash = centerline distance < r₁ + r₂ exactly)
// stay fixed — user-editable criteria in a settings panel are the author's
// recorded future requirement, not this task.
//
// NON-BLOCKING and read-only (§K.4): the project model is never touched,
// zero undo levels; nothing is auto-moved (the §K "Fit to Code" door stays
// closed). Bar-vs-bar only — nothing else exists to collide against until
// M4 openings (the T6 scope line).
import type { ReinforcementBar } from '@/data/models';
import { type BarClash, findBarClashes, formatClashHint } from '@/engine/collision';
import type { AppThunk } from '@/stores';
import { setClashWarning, setCursorHint } from '@/stores/ui-slice';

export interface CheckBarClashesParams {
  /** The active detailing scope's bar ids (the future active layer). Omitted
   *  = ALL model bars — the single implicit active layer until the Layer
   *  Model lands. Unknown ids are skipped silently (a stale scope is not an
   *  error for a read-only check). */
  scopeBarIds?: string[];
}

export interface CheckBarClashesResult {
  /** Exact clash pairs within the scope (ids + min distances, sorted by id). */
  clashes: BarClash[];
  /** How many bars were checked (for the status feedback). */
  checkedCount: number;
}

export const checkBarClashes =
  (params: CheckBarClashesParams = {}): AppThunk<CheckBarClashesResult> =>
  (dispatch, getState) => {
    const reinforcement = getState().project.reinforcement;
    const scopeIds = params.scopeBarIds ?? Object.keys(reinforcement);
    const bars: ReinforcementBar[] = [];
    for (const id of scopeIds) {
      const bar = reinforcement[id];
      if (bar !== undefined) bars.push(bar);
    }
    const clashes = findBarClashes({
      bars,
      involvingIds: bars.map((bar) => bar.id),
    });
    if (clashes.length === 0) {
      dispatch(setClashWarning(null));
      dispatch(setCursorHint(`Collision check: no clashes (${bars.length} bars checked)`));
    } else {
      dispatch(setClashWarning({ pairs: clashes }));
      dispatch(setCursorHint(formatClashHint(clashes)));
    }
    return { clashes, checkedCount: bars.length };
  };
