// Undo recording (§E; M1 Q1-a/Q2-a/Q4-a). An RTK listener middleware records
// the PRE-action project state (getOriginalState) for every project-slice
// mutation EXCEPT restoreProjectSnapshot (the undo/redo restore path —
// recording it would pollute history). Snapshots are the frozen Immer state
// references themselves (Q2-a) — near-zero memory via structural sharing.
//
// One undo level per COMMAND (Q4-a): commands like deleteElement (and T2's
// host-follow moveElement) dispatch a cascade of slice actions, and one undo
// step must restore the whole cascade. Middleware cannot tell a cascade from
// sequential commands — the action streams are identical — so
// undoScopeMiddleware wraps every thunk invocation (all §N commands ARE
// thunks) in a command scope and the listener records only the scope's first
// project mutation. This stays fully command-agnostic: future commands are
// covered automatically with zero undo code (the Q1-b failure mode —
// remembering a snapshot call per command — does not exist).
//
// ASYNC commands (M2 T3's importIfcModel awaits web-ifc, then dispatches
// per-entity add reducers): the scope stays open until the thunk's promise
// SETTLES — closing it when the thunk function returned (the M2 T2 finding)
// let post-await reducers escape the scope and record one undo level PER
// REDUCER. Holding the scope across the promise preserves both the
// per-entity action log AND one undo level per command (Q4-a). Known limit:
// the single scope slot assumes serial command dispatch (the UI dispatch
// loop); two overlapping async commands would share one scope — acceptable
// at M2 scale, revisit if concurrent commands ever appear.
import { type Middleware, createListenerMiddleware, isAnyOf } from '@reduxjs/toolkit';
import {
  addBar,
  addBars,
  addElement,
  addPlacementGroup,
  addReferenceDocument,
  addSection,
  appendBarPoint,
  detachBars,
  removeBar,
  removeBars,
  removeElement,
  removePlacementGroup,
  removeReferenceDocument,
  removeSection,
  resetProject,
  setNextBarMark,
  setReferenceDocumentVisibility,
  translateBar,
  translateElement,
  updatePlacementGroup,
  updateSectionGeometry,
} from './project-slice';
import type { ProjectState } from './project-slice';
import { recordSnapshot } from './undo-slice';

interface CommandScope {
  /** Set once the command's first project mutation has been recorded. */
  recorded: boolean;
}

/** Redux dispatch is synchronous and single-threaded, so one module-level
 *  slot is safe. */
let activeScope: CommandScope | null = null;

/**
 * Wraps every thunk (function action) in a command scope for undo recording.
 * A thunk dispatched INSIDE another command (e.g. T3's deleteSelection
 * dispatching deleteElement/deleteBar per selection contents) joins the outer
 * scope — one undo level per command DISPATCH (Q4-a), even for a composite
 * command. Plain-object actions pass through untouched; a project action
 * dispatched outside any thunk (forbidden by §N) is recorded as its own
 * level — the safe default.
 */
export const undoScopeMiddleware: Middleware = () => (next) => (action) => {
  if (typeof action !== 'function') return next(action);
  if (activeScope !== null) return next(action); // nested command joins the outer scope
  activeScope = { recorded: false };
  let result: unknown;
  try {
    result = next(action);
  } catch (error) {
    activeScope = null; // a command rejecting synchronously still closes its scope
    throw error;
  }
  if (result instanceof Promise) {
    // Async command: hold the scope until the thunk settles, so reducers
    // dispatched after an await still join this command's ONE undo level.
    return result.finally(() => {
      activeScope = null;
    });
  }
  activeScope = null;
  return result;
};

/** Minimal shape the listener needs — avoids a type cycle with the store. */
interface UndoListenerState {
  project: ProjectState;
}

export const undoListenerMiddleware = createListenerMiddleware();

undoListenerMiddleware.startListening({
  // Every project-slice mutating action except restoreProjectSnapshot.
  matcher: isAnyOf(
    addBar,
    addBars,
    addElement,
    addPlacementGroup,
    addReferenceDocument,
    addSection,
    appendBarPoint,
    detachBars,
    removeBar,
    removeBars,
    removeElement,
    removePlacementGroup,
    removeReferenceDocument,
    removeSection,
    resetProject,
    setNextBarMark,
    setReferenceDocumentVisibility,
    translateBar,
    translateElement,
    updatePlacementGroup,
    updateSectionGeometry,
  ),
  effect: (_action, listenerApi) => {
    const previousProject = (listenerApi.getOriginalState() as UndoListenerState).project;
    const currentProject = (listenerApi.getState() as UndoListenerState).project;
    if (previousProject === currentProject) return; // no-op reducer run — no undo level
    if (activeScope?.recorded === true) return; // cascade continuation (Q4-a)
    if (activeScope !== null) activeScope.recorded = true;
    listenerApi.dispatch(recordSnapshot(previousProject));
  },
});
