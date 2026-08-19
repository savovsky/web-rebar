// Section Cut flow (§B.6): pointer-down starts the line, pointer-up commits
// it, and a THIRD CLICK sets the view depth — the section looks toward that
// click. The cut then opens in the dockable 2D panel and the tool
// auto-returns to Select (single-shot, rule 1; sticky mode keeps it). Failed
// steps (zero-length line, no element crossed) keep the tool active and
// explain themselves in the status bar; a depth click on the line keeps the
// committed line so the user can re-click. Esc (global tool shortcut →
// setTool) cancels at any point.
import { CommandError } from '@/commands/command-error';
import { createSection, resolveNextSectionName } from '@/commands/create-section';
import { setActiveSection } from '@/commands/set-active-section';
import type { ConcreteElement, SectionDefinition, Vec3 } from '@/data/models';
import { findElementsCrossedByLine, sectionGeometryFromDepthPoint } from '@/engine/section-cut';
import type { AppDispatch } from '@/stores';
import { addDraftPoint, clearDraft, setCursorHint, setTool, startDraft } from '@/stores/ui-slice';

const HINT_DRAGGING = 'Drag across the element — release to commit the section line · Esc to cancel';
const HINT_DEPTH = 'Click away from the line to set the view depth — the section looks there · Esc to cancel';

interface BeginSectionCutOptions {
  dispatch: AppDispatch;
  /** Pointer-down point on the ground plane (already grid-snapped, §B.3). */
  point: Vec3;
}

/** Pointer-down: commit the section line start. */
export function beginSectionCut({ dispatch, point }: BeginSectionCutOptions): void {
  dispatch(startDraft({ kind: 'section' }));
  dispatch(addDraftPoint(point));
  dispatch(setCursorHint(HINT_DRAGGING));
}

/** A failed step: explain in the status bar, drop the draft, keep the tool. */
function rejectSectionCut(dispatch: AppDispatch, message: string): void {
  dispatch(setCursorHint(message));
  dispatch(clearDraft());
}

interface AdvanceSectionCutOptions {
  dispatch: AppDispatch;
  elements: Record<string, ConcreteElement>;
  /** The committed line start (pointer-down point). */
  startPoint: Vec3;
  /** Pointer-up point on the ground plane (already grid-snapped, §B.3). */
  endPoint: Vec3;
}

/** Pointer-up: commit the section line — it must cross at least one element. */
export function advanceSectionCut(options: AdvanceSectionCutOptions): void {
  const { dispatch, elements, startPoint, endPoint } = options;
  const targetElementIds = findElementsCrossedByLine({ lineStart: startPoint, lineEnd: endPoint, elements });
  if (targetElementIds.length === 0) {
    const isZeroLength = startPoint.x === endPoint.x && startPoint.y === endPoint.y;
    rejectSectionCut(
      dispatch,
      isZeroLength
        ? 'Section line is zero-length — drag across the element'
        : 'The section line must cross an element',
    );
    return;
  }
  dispatch(addDraftPoint(endPoint));
  dispatch(setCursorHint(HINT_DEPTH));
}

interface FinishSectionCutOptions {
  dispatch: AppDispatch;
  elements: Record<string, ConcreteElement>;
  sections: Record<string, SectionDefinition>;
  /** The committed section line. */
  lineStart: Vec3;
  lineEnd: Vec3;
  /** The third click (already grid-snapped, §B.3). */
  depthPoint: Vec3;
  /** Sticky (double-click-locked) tools stay active after a successful cut. */
  isSticky: boolean;
}

/** Third click: set the view depth, create the section, open the 2D panel. */
export function finishSectionCut(options: FinishSectionCutOptions): void {
  const { dispatch, elements, sections, lineStart, lineEnd, depthPoint, isSticky } = options;
  if (sectionGeometryFromDepthPoint({ lineStart, lineEnd, depthPoint }) === null) {
    // Depth click on the line: keep the committed line, let the user re-click.
    dispatch(setCursorHint(HINT_DEPTH));
    return;
  }
  try {
    const sectionId = dispatch(
      createSection({
        name: resolveNextSectionName(sections),
        lineStart,
        lineEnd,
        depthPoint,
        targetElementIds: findElementsCrossedByLine({ lineStart, lineEnd, elements }),
      }),
    );
    dispatch(setActiveSection({ sectionId }));
  } catch (error) {
    if (!(error instanceof CommandError)) throw error;
    rejectSectionCut(dispatch, error.message);
    return;
  }
  // Single-shot tool (§B.6 rule 1): auto-return to Select unless sticky.
  // setTool already resets the draft and the hint.
  if (isSticky) {
    dispatch(clearDraft());
    dispatch(setCursorHint(''));
    return;
  }
  dispatch(setTool({ tool: 'select' }));
}
