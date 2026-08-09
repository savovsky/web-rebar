// Headless test of the Section Cut flow (the draft module is React-free):
// drag the line across an element, then a THIRD CLICK sets the view depth —
// the section looks toward that click. A successful cut creates the section,
// opens it in the 2D panel, and auto-returns to Select (§B.6 rule 1); failed
// steps keep the tool and explain themselves in the status bar.
import { describe, expect, it } from 'vitest';
import { placeWall } from '@/commands';
import type { Vec3 } from '@/data/models';
import { createAppStore } from '@/stores';
import { setTool } from '@/stores/ui-slice';
import { advanceSectionCut, beginSectionCut, finishSectionCut } from './section-cut-draft';

// Local alias keeps the arrange lines terse (the ui action is not a §N command).
const setToolSectionCut = () => setTool({ tool: 'sectionCut' });

/** Wall along +X: 4000 long, 200 thick → plan footprint z ∈ [-100, 100]. */
const createStoreWithWall = () => {
  const store = createAppStore();
  store.dispatch(setToolSectionCut());
  const wallId = store.dispatch(
    placeWall({
      startPoint: { x: 0, y: 0, z: 0 },
      endPoint: { x: 4000, y: 0, z: 0 },
      thickness: 200,
      height: 2800,
    }),
  );
  return { store, wallId };
};

const LINE_START: Vec3 = { x: 2000, y: 0, z: -500 };
const LINE_END: Vec3 = { x: 2000, y: 0, z: 500 };
/** 2500 mm perpendicular to the +Z-running line → the view looks along +X. */
const DEPTH_CLICK: Vec3 = { x: 4500, y: 0, z: 0 };

interface CutOptions {
  store: ReturnType<typeof createAppStore>;
  end?: Vec3;
  depth?: Vec3;
  isSticky?: boolean;
}

/** Feeds pointer-down → pointer-up → depth click through the draft flow. */
const performSectionCut = ({ store, end = LINE_END, depth = DEPTH_CLICK, isSticky = false }: CutOptions) => {
  beginSectionCut({ dispatch: store.dispatch, point: LINE_START });
  advanceSectionCut({
    dispatch: store.dispatch,
    elements: store.getState().project.elements,
    startPoint: LINE_START,
    endPoint: end,
  });
  const draft = store.getState().ui.placementDraft;
  const [lineStart, lineEnd] = draft.committedPoints;
  if (draft.kind !== 'section' || !lineStart || !lineEnd) return; // a rejected line ends here
  finishSectionCut({
    dispatch: store.dispatch,
    elements: store.getState().project.elements,
    sections: store.getState().project.sections,
    lineStart,
    lineEnd,
    depthPoint: depth,
    isSticky,
  });
};

describe('Section Cut flow', () => {
  it('line drag + depth click creates the section, opens the panel, auto-returns to Select', () => {
    const { store, wallId } = createStoreWithWall();
    performSectionCut({ store });

    const state = store.getState();
    const sections = Object.values(state.project.sections);
    expect(sections).toHaveLength(1);
    expect(sections[0].name).toBe('S-1');
    expect(sections[0].targetElementIds).toEqual([wallId]);
    expect(sections[0].lineStart).toEqual(LINE_START);
    expect(sections[0].lineEnd).toEqual(LINE_END);
    expect(sections[0].plane.normal).toEqual({ x: 1, y: 0, z: 0 }); // looks toward the depth click
    expect(sections[0].viewDepth).toBeCloseTo(2500);
    expect(state.ui.activeSectionId).toBe(sections[0].id);
    expect(state.ui.activeTool).toBe('select'); // single-shot auto-return (§B.6 rule 1)
    expect(state.ui.placementDraft.kind).toBeNull();
  });

  it('commits the line on pointer-up and waits for the depth click', () => {
    const { store } = createStoreWithWall();
    beginSectionCut({ dispatch: store.dispatch, point: LINE_START });
    advanceSectionCut({
      dispatch: store.dispatch,
      elements: store.getState().project.elements,
      startPoint: LINE_START,
      endPoint: LINE_END,
    });

    const state = store.getState();
    expect(state.ui.placementDraft.kind).toBe('section');
    expect(state.ui.placementDraft.committedPoints).toEqual([LINE_START, LINE_END]);
    expect(state.ui.cursorHint).toContain('view depth');
    expect(Object.values(state.project.sections)).toHaveLength(0); // not yet
  });

  it('rejects a depth click on the line but keeps the committed line', () => {
    const { store } = createStoreWithWall();
    performSectionCut({ store, depth: { x: 2000, y: 0, z: 0 } }); // ON the line

    const state = store.getState();
    expect(Object.values(state.project.sections)).toHaveLength(0);
    expect(state.ui.activeTool).toBe('sectionCut');
    expect(state.ui.placementDraft.committedPoints).toEqual([LINE_START, LINE_END]);
    expect(state.ui.cursorHint).toContain('view depth');
  });

  it('rejects a zero-length drag and keeps the tool active', () => {
    const { store } = createStoreWithWall();
    performSectionCut({ store, end: LINE_START });

    const state = store.getState();
    expect(Object.values(state.project.sections)).toHaveLength(0);
    expect(state.ui.activeTool).toBe('sectionCut');
    expect(state.ui.placementDraft.kind).toBeNull();
    expect(state.ui.cursorHint).toContain('zero-length');
  });

  it('rejects a line that crosses no element and keeps the tool active', () => {
    const { store } = createStoreWithWall();
    performSectionCut({ store, end: { x: 2000, y: 0, z: -200 } }); // stops short of the wall (z ≥ -100)

    const state = store.getState();
    expect(Object.values(state.project.sections)).toHaveLength(0);
    expect(state.ui.activeTool).toBe('sectionCut');
    expect(state.ui.placementDraft.kind).toBeNull();
    expect(state.ui.cursorHint).toContain('must cross an element');
  });

  it('keeps the tool active after a successful cut in sticky mode', () => {
    const { store } = createStoreWithWall();
    performSectionCut({ store, isSticky: true });

    const state = store.getState();
    expect(Object.values(state.project.sections)).toHaveLength(1);
    expect(state.ui.activeTool).toBe('sectionCut');
    expect(state.ui.placementDraft.kind).toBeNull(); // ready for the next cut
  });

  it('numbers sections sequentially (S-1, S-2, …)', () => {
    const { store } = createStoreWithWall();
    performSectionCut({ store });
    store.dispatch(setToolSectionCut());
    performSectionCut({ store });
    const names = Object.values(store.getState().project.sections).map((section) => section.name);
    expect(names).toEqual(['S-1', 'S-2']);
  });
});
