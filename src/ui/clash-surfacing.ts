// Q8 clash surfacing (§K.4 minimal, M3 T6 — NON-BLOCKING): the clash-reporting
// commands (placeBarGroup / moveBar / movePlacementGroup / regenerate) return
// exact BarClash reports in their results; the UI call sites hand them here.
// A non-empty report sets the transient warning layer (clashing bars render
// in the danger token color — the §K.4 "red highlight on bar in 3D" row's M3
// minimum) plus a status-bar warning; a clean report CLEARS the layer (the
// last move/placement fixed it). Nothing is blocked, nothing is auto-moved —
// this is a warning surface, never the validator (plan door check).
// React-free (the draft-module pattern) so every call site shares one logic.
import { type BarClash, formatClashHint } from '@/engine/collision';
import type { AppDispatch } from '@/stores';
import { setClashWarning, setCursorHint } from '@/stores/ui-slice';

// The hint copy lives in engine/collision.ts (shared with the on-demand
// checkBarClashes command — commands never import from src/ui/).
export { formatClashHint };

/** Surfacing entry point for every clash-REPORTING placement/move command
 *  result (the on-demand checkBarClashes command surfaces itself — its result
 *  IS the surfacing, including the "no clashes" feedback). */
export function surfaceClashReport(dispatch: AppDispatch, clashes: readonly BarClash[]): void {
  if (clashes.length === 0) {
    dispatch(setClashWarning(null));
    return;
  }
  dispatch(setClashWarning({ pairs: [...clashes] }));
  dispatch(setCursorHint(formatClashHint(clashes)));
}
