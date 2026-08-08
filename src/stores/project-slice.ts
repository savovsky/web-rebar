import { createSlice } from '@reduxjs/toolkit';

interface ProjectState {
  elements: Record<string, unknown>;
  bars: Record<string, unknown>;
  placementGroups: Record<string, unknown>;
  undoStack: string[];
}

const initialState: ProjectState = {
  elements: {},
  bars: {},
  placementGroups: {},
  undoStack: [],
};

const projectSlice = createSlice({
  name: 'project',
  initialState,
  reducers: {
    // §N: slice reducers are called by command thunks only — never from UI directly
    resetProject() {
      return initialState;
    },
  },
});

export const { resetProject } = projectSlice.actions;
export default projectSlice.reducer;
