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
import { type Middleware, createListenerMiddleware, isAnyOf } from '@reduxjs/toolkit';
import {
  addBar,
  addElement,
  addSection,
  appendBarPoint,
  removeBar,
  removeElement,
  removeSection,
  resetProject,
  updateSectionGeometry,
} from './project-slice';
import type { ProjectState } from './project-slice';
import { recordSnapshot } from './undo-slice';

interface CommandScope {
  /** Set once the command's first project mutation has been recorded. */
  recorded: boolean;
}

/** Redux dispatch is synchronous and single-threaded, so one module-level
 *  slot is safe; nested thunk invocations save/restore the outer scope. */
let activeScope: CommandScope | null = null;

/**
 * Wraps every thunk (function action) in a fresh command scope for undo
 * recording. Plain-object actions pass through untouched; a project action
 * dispatched outside any thunk (forbidden by §N) is recorded as its own
 * level — the safe default.
 */
export const undoScopeMiddleware: Middleware = () => (next) => (action) => {
  if (typeof action !== 'function') return next(action);
  const outerScope = activeScope;
  activeScope = { recorded: false };
  try {
    return next(action);
  } finally {
    activeScope = outerScope;
  }
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
    addElement,
    addSection,
    appendBarPoint,
    removeBar,
    removeElement,
    removeSection,
    resetProject,
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
