// Project slice — the persisted domain model (§H.1 subset).
// §N: these reducers are called by command thunks (src/commands/) ONLY —
// never imported by UI components. Deletion cascades are explicit: a command
// dispatches removeBar per hosted bar, so the action log shows every change
// (matters for undo (§E) and the future MCP door (§N.2)).
import { type PayloadAction, createSlice } from '@reduxjs/toolkit';
import type { ConcreteElement, ProjectModel, ReinforcementBar, SectionDefinition } from '@/data/models';

/** Project state IS the persisted model. Meshes and section primitives are
 *  derived via selectors and never stored (§E, §H.2). */
type ProjectState = ProjectModel;

const initialState: ProjectState = {
  version: '0.1.0',
  metadata: {
    name: 'Untitled Project',
    // Set by the future newProject command; persistence arrives post-M0 (§H.3).
    createdAt: '',
    lastModified: '',
    appVersion: '0.0.0',
  },
  elements: {},
  reinforcement: {},
  sections: {},
};

const projectSlice = createSlice({
  name: 'project',
  initialState,
  reducers: {
    addElement(state, action: PayloadAction<ConcreteElement>) {
      state.elements[action.payload.id] = action.payload;
    },
    removeElement(state, action: PayloadAction<{ id: string }>) {
      delete state.elements[action.payload.id];
    },
    addBar(state, action: PayloadAction<ReinforcementBar>) {
      state.reinforcement[action.payload.id] = action.payload;
    },
    removeBar(state, action: PayloadAction<{ id: string }>) {
      delete state.reinforcement[action.payload.id];
    },
    addSection(state, action: PayloadAction<SectionDefinition>) {
      state.sections[action.payload.id] = action.payload;
    },
    removeSection(state, action: PayloadAction<{ id: string }>) {
      delete state.sections[action.payload.id];
    },
    resetProject() {
      return initialState;
    },
  },
});

export const { addBar, addElement, addSection, removeBar, removeElement, removeSection, resetProject } =
  projectSlice.actions;
export default projectSlice.reducer;
