// Undo slice — session-only undo history (§E: 30 levels, project state only;
// §H.2: never persisted, never part of ProjectModel). Snapshots are frozen
// Immer state references (M1 Q2-a): Immer never mutates in place, so a stored
// reference IS the snapshot and unchanged entities are structurally shared,
// not copied — near-zero memory per level (measured against the §E estimate
// in M1 T5). Written by the undo listener middleware (recordSnapshot) and the
// undo/redo commands (shift*) only — never by UI components (§N).
import { type PayloadAction, createSlice } from '@reduxjs/toolkit';
import type { ProjectState } from './project-slice';

/** §E undo depth — the oldest level is trimmed beyond this. */
const MAX_UNDO_LEVELS = 30;

interface UndoState {
  /** Pre-command snapshots, oldest first; the top is the next undo target. */
  past: ProjectState[];
  /** Snapshots undone away, oldest first; the top is the next redo target. */
  future: ProjectState[];
}

const initialState: UndoState = { past: [], future: [] };

const undoSlice = createSlice({
  name: 'undo',
  initialState,
  reducers: {
    /** Push a pre-command snapshot (called by the undo listener middleware).
     *  A new action forks history, so the future stack clears; the §E cap
     *  trims the oldest level. */
    recordSnapshot(state, action: PayloadAction<ProjectState>) {
      state.past.push(action.payload);
      state.future = [];
      if (state.past.length > MAX_UNDO_LEVELS) state.past.shift();
    },
    /** undo step: drop the past top (the command restores it); park the
     *  current project state (payload) on future for redo. */
    shiftToPast(state, action: PayloadAction<ProjectState>) {
      const previous = state.past.pop();
      if (previous !== undefined) state.future.push(action.payload);
    },
    /** redo step: drop the future top (the command restores it); park the
     *  current project state (payload) back on past for the next undo. */
    shiftToFuture(state, action: PayloadAction<ProjectState>) {
      const next = state.future.pop();
      if (next !== undefined) state.past.push(action.payload);
    },
    /** Drop all history (future newProject/loadProject commands — §H.3). */
    clearHistory() {
      return initialState;
    },
  },
});

export const { clearHistory, recordSnapshot, shiftToFuture, shiftToPast } = undoSlice.actions;
export default undoSlice.reducer;
