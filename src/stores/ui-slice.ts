// UI slice — interaction state only. No domain data lives here (§E).
// Transient 60 FPS pointer positions stay in component refs; only
// click-committed points land in placementDraft.
import { type PayloadAction, createSlice } from '@reduxjs/toolkit';
import type { Vec3 } from '@/data/models';

export type ToolId = 'select' | 'placeWall' | 'placeBar' | 'sectionCut' | 'pan' | 'orbit';

interface SelectionState {
  elementIds: string[];
  barIds: string[];
}

/**
 * In-progress placement tool input (§B.6). M0 deviation from the plan:
 * `faceId` became `hostElementId` + `faceNormal` — wall faces are not
 * first-class entities until face sampling arrives (M3).
 */
interface PlacementDraft {
  kind: 'wall' | 'bar' | null;
  committedPoints: Vec3[];
  hostElementId: string | null;
  /** Outward normal of the clicked wall face — defines the cover offset direction. */
  faceNormal: Vec3 | null;
}

interface UiState {
  activeTool: ToolId;
  sticky: boolean;
  cursorHint: string;
  isInProgress: boolean;
  selection: SelectionState;
  placementDraft: PlacementDraft;
  /** Which section the dockable 2D panel shows (§B.2). */
  activeSectionId: string | null;
  /** Grid snapping (§B.3) — status-bar toggle, consumed by viewport tools from T7. */
  snapEnabled: boolean;
  /** Grid spacing in mm (§B.3 default 100). */
  gridSpacingMm: number;
}

const emptyDraft: PlacementDraft = {
  kind: null,
  committedPoints: [],
  hostElementId: null,
  faceNormal: null,
};

const initialState: UiState = {
  activeTool: 'select',
  sticky: false,
  cursorHint: '',
  isInProgress: false,
  selection: { elementIds: [], barIds: [] },
  placementDraft: emptyDraft,
  activeSectionId: null,
  snapEnabled: true,
  gridSpacingMm: 100,
};

const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    setTool(state, action: PayloadAction<{ tool: ToolId; sticky?: boolean }>) {
      state.activeTool = action.payload.tool;
      state.sticky = action.payload.sticky ?? false;
      state.cursorHint = '';
      state.isInProgress = false;
      state.placementDraft = emptyDraft;
    },
    setCursorHint(state, action: PayloadAction<string>) {
      state.cursorHint = action.payload;
    },
    setInProgress(state, action: PayloadAction<boolean>) {
      state.isInProgress = action.payload;
    },
    setSelection(state, action: PayloadAction<SelectionState>) {
      state.selection = action.payload;
    },
    clearSelection(state) {
      state.selection = { elementIds: [], barIds: [] };
    },
    startDraft(
      state,
      action: PayloadAction<{ kind: 'wall' | 'bar'; hostElementId?: string; faceNormal?: Vec3 }>,
    ) {
      state.placementDraft = {
        kind: action.payload.kind,
        committedPoints: [],
        hostElementId: action.payload.hostElementId ?? null,
        faceNormal: action.payload.faceNormal ?? null,
      };
      state.isInProgress = true;
    },
    addDraftPoint(state, action: PayloadAction<Vec3>) {
      state.placementDraft.committedPoints.push(action.payload);
    },
    clearDraft(state) {
      state.placementDraft = emptyDraft;
      state.isInProgress = false;
    },
    setActiveSection(state, action: PayloadAction<string | null>) {
      state.activeSectionId = action.payload;
    },
    toggleSnap(state) {
      state.snapEnabled = !state.snapEnabled;
    },
  },
});

export const {
  addDraftPoint,
  clearDraft,
  clearSelection,
  setActiveSection,
  setCursorHint,
  setInProgress,
  setSelection,
  setTool,
  startDraft,
  toggleSnap,
} = uiSlice.actions;
export default uiSlice.reducer;
