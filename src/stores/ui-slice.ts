// UI slice — interaction state only. No domain data lives here (§E).
// Transient 60 FPS pointer positions stay in component refs; only
// click-committed points land in placementDraft.
import { type PayloadAction, createSlice } from '@reduxjs/toolkit';
import type { ElementFaceKey, Vec3 } from '@/data/models';

export type ToolId =
  'select' | 'move' | 'placeWall' | 'placeBar' | 'placeBarGroup' | 'sectionCut' | 'pan' | 'orbit';

interface SelectionState {
  elementIds: string[];
  barIds: string[];
}

/**
 * In-progress placement tool input (§B.6). M0 deviation from the plan:
 * `faceId` became `hostElementId` + `faceNormal` — wall faces were not
 * first-class entities until face sampling arrived. **Revised 2026-08-21
 * (M3 T4):** face sampling IS here — a 'barGroup' draft additionally carries
 * the stable host-local `faceKey` (§F.2 revised, Q3-a); it uses no
 * committedPoints (the region drag anchor is transient, §E).
 * A 'section' draft carries only the Section Cut drag start in
 * committedPoints[0] (single-shot pointer-down → pointer-up gesture, §B.6).
 */
export interface PlacementDraft {
  kind: 'wall' | 'bar' | 'barGroup' | 'section' | null;
  committedPoints: Vec3[];
  hostElementId: string | null;
  /** Outward normal of the clicked wall face — defines the cover offset direction. */
  faceNormal: Vec3 | null;
  /** Stable host-local face key of the captured face (bar-group drafts only). */
  faceKey: ElementFaceKey | null;
  /** The bar the chained flow keeps extending (§B.6) — null until the 2nd path
   *  click creates it. One draft chain = ONE bar with bending places. */
  barId: string | null;
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
  faceKey: null,
  barId: null,
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
      action: PayloadAction<{
        kind: 'wall' | 'bar' | 'barGroup' | 'section';
        hostElementId?: string;
        faceNormal?: Vec3;
        faceKey?: ElementFaceKey;
      }>,
    ) {
      state.placementDraft = {
        kind: action.payload.kind,
        committedPoints: [],
        hostElementId: action.payload.hostElementId ?? null,
        faceNormal: action.payload.faceNormal ?? null,
        faceKey: action.payload.faceKey ?? null,
        barId: null,
      };
      state.isInProgress = true;
    },
    setDraftBarId(state, action: PayloadAction<string>) {
      state.placementDraft.barId = action.payload;
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
  setDraftBarId,
  setInProgress,
  setSelection,
  setTool,
  startDraft,
  toggleSnap,
} = uiSlice.actions;
export default uiSlice.reducer;
