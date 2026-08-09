// Commit path for section wireframe drags (§B.6 — move/stretch the section in
// the 3D viewport). React-free like the other draft modules: the component
// tracks the live drag locally (§E component-local state) and hands the final
// geometry here on pointer-up; this dispatches the §N reshapeSection command.
import { CommandError } from '@/commands/command-error';
import { reshapeSection } from '@/commands/reshape-section';
import { type SectionPlanGeometry, depthPointOf, isSameSectionGeometry } from '@/engine/section-cut';
import type { AppDispatch } from '@/stores';
import { setCursorHint } from '@/stores/ui-slice';

interface CommitSectionDragOptions {
  dispatch: AppDispatch;
  sectionId: string;
  base: SectionPlanGeometry;
  /** The dragged result; null = degenerate drag (collapsed line). */
  next: SectionPlanGeometry | null;
}

export function commitSectionDrag(options: CommitSectionDragOptions): void {
  const { dispatch, sectionId, base, next } = options;
  if (next === null) {
    dispatch(setCursorHint('Section needs a non-zero line and depth — drag not applied'));
    return;
  }
  if (isSameSectionGeometry(base, next)) return; // a click, not a drag — nothing to commit
  try {
    dispatch(
      reshapeSection({
        sectionId,
        lineStart: next.lineStart,
        lineEnd: next.lineEnd,
        depthPoint: depthPointOf(next),
      }),
    );
  } catch (error) {
    if (!(error instanceof CommandError)) throw error;
    dispatch(setCursorHint(error.message));
  }
}
