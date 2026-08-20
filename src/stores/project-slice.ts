// Project slice — the persisted domain model (§H.1 subset).
// §N: these reducers are called by command thunks (src/commands/) ONLY —
// never imported by UI components. Deletion cascades are explicit: a command
// dispatches removeBar per hosted bar, so the action log shows every change
// (matters for undo (§E) and the future MCP door (§N.2)).
import { type PayloadAction, createSlice } from '@reduxjs/toolkit';
import type {
  ConcreteElement,
  Plane,
  ProjectModel,
  ReferenceDocument,
  ReinforcementBar,
  SectionDefinition,
  Vec3,
} from '@/data/models';

/** Project state IS the persisted model. Meshes and section primitives are
 *  derived via selectors and never stored (§E, §H.2). */
export type ProjectState = ProjectModel;

/** Minimal Vec3 addition — the model stays plain JSON (§H.1), no classes. */
const addVec3 = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });

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
  referenceDocuments: {},
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
    /** Chained placement (§B.6): grow one bar's path — the bar stays a single
     *  position with bending places (see the extendBar command). */
    appendBarPoint(state, action: PayloadAction<{ id: string; point: Vec3 }>) {
      const bar = state.reinforcement[action.payload.id];
      if (bar) bar.path.push(action.payload.point);
    },
    /** Host-follow translation (§E revised 2026-08-09): the moveElement command
     *  dispatches this plus one translateBar per hosted bar — explicit per-entity
     *  actions like the deleteElement cascade, so the action log shows every
     *  change and one undo snapshot restores all of it (command scope, Q4-a).
     *  Walls: the plan axis shifts; baseElevation, thickness, and height are
     *  untouched. Grows with the element union (slabs/beams/columns, M3/M4). */
    translateElement(state, action: PayloadAction<{ id: string; delta: Vec3 }>) {
      const element = state.elements[action.payload.id];
      if (!element) return;
      element.startPoint = addVec3(element.startPoint, action.payload.delta);
      element.endPoint = addVec3(element.endPoint, action.payload.delta);
    },
    /** Translates every path point (bending places included) — one bar stays one
     *  position; dispatched by the moveElement command per hosted bar. */
    translateBar(state, action: PayloadAction<{ id: string; delta: Vec3 }>) {
      const bar = state.reinforcement[action.payload.id];
      if (!bar) return;
      bar.path = bar.path.map((point) => addVec3(point, action.payload.delta));
    },
    addSection(state, action: PayloadAction<SectionDefinition>) {
      state.sections[action.payload.id] = action.payload;
    },
    /** Wireframe move/stretch (§B.6) — the reshapeSection command recomputes
     *  plane/viewDepth/targets; this only applies them. */
    updateSectionGeometry(
      state,
      action: PayloadAction<{
        id: string;
        lineStart: Vec3;
        lineEnd: Vec3;
        plane: Plane;
        viewDepth: number;
        targetElementIds: string[];
      }>,
    ) {
      const section = state.sections[action.payload.id];
      if (!section) return;
      section.lineStart = action.payload.lineStart;
      section.lineEnd = action.payload.lineEnd;
      section.plane = action.payload.plane;
      section.viewDepth = action.payload.viewDepth;
      section.targetElementIds = action.payload.targetElementIds;
    },
    removeSection(state, action: PayloadAction<{ id: string }>) {
      delete state.sections[action.payload.id];
    },
    /** M2 plan Q3: one imported file = one document, added by ONE reducer so
     *  the importReferenceDocument command records exactly ONE undo level
     *  (the plan's F3 door-check note — no per-entity cascade for DXF). */
    addReferenceDocument(state, action: PayloadAction<ReferenceDocument>) {
      state.referenceDocuments[action.payload.id] = action.payload;
    },
    removeReferenceDocument(state, action: PayloadAction<{ id: string }>) {
      delete state.referenceDocuments[action.payload.id];
    },
    /** Document-level render-only flag (Q3 — no freeze/lock semantics). */
    setReferenceDocumentVisibility(state, action: PayloadAction<{ id: string; visible: boolean }>) {
      const document = state.referenceDocuments[action.payload.id];
      if (document) document.visible = action.payload.visible;
    },
    /** §E undo restore: wholesale replace with a recorded snapshot (a frozen
     *  Immer reference, Q2-a). Excluded from undo recording (undo-middleware
     *  matcher) — undo/redo are never themselves recorded. Every reducer above
     *  keeps the state plain JSON (M0 T11 audit), so any historical snapshot
     *  restores cleanly; meshes/section primitives re-derive via selectors and
     *  are never restored (§H.2). */
    restoreProjectSnapshot(_state, action: PayloadAction<ProjectState>) {
      return action.payload;
    },
    resetProject() {
      return initialState;
    },
  },
});

export const {
  addBar,
  addElement,
  addReferenceDocument,
  addSection,
  appendBarPoint,
  removeBar,
  removeElement,
  removeReferenceDocument,
  removeSection,
  resetProject,
  restoreProjectSnapshot,
  setReferenceDocumentVisibility,
  translateBar,
  translateElement,
  updateSectionGeometry,
} = projectSlice.actions;
export default projectSlice.reducer;
