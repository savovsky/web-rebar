import type { AppThunk } from '@/stores';
import { setCursorHint } from '@/stores/ui-slice';
import { deleteBar } from './delete-bar';
import { deleteElement } from './delete-element';
import { deletePlacementGroup } from './delete-placement-group';
import { deleteSection } from './delete-section';

/**
 * §N command: delete whatever is currently selected — the single Delete entry
 * point for keyboard (Delete/Backspace) and the Edit menu, so UI handlers
 * never branch into business logic (rules 1+2). Selection contents decide the
 * matching per-entity command: elements (with the hosted-bar cascade), bars,
 * placement groups (M3 T5 — the whole group goes with its bars, the
 * deletePlacementGroup default cascade; decided in-task: deleting a selected
 * group deletes its bars like deleting a wall deletes its hosted bars — the
 * detach-all alternative stays available to scripting/MCP via
 * removeBars: false), sections. Sections are not part of the selection state
 * (§B.5 — clicking a section volume ACTIVATES it in the 2D panel), so the
 * active section is the section-level target when nothing is explicitly
 * selected; an explicit element/bar/group selection always wins over the
 * active section.
 *
 * Nested delete commands join this command's undo scope (undo-middleware), so
 * the whole gesture is ONE undo level (Q4-a) even for a mixed selection.
 * Dangling selection ids (possible after undo — selection is not restored,
 * §E) are skipped. Empty selection + no active section: no-op + status hint.
 */
export const deleteSelection = (): AppThunk => (dispatch, getState) => {
  const state = getState();
  const { selection, activeSectionId } = state.ui;
  const elementIds = selection.elementIds.filter((id) => state.project.elements[id] !== undefined);
  const barIds = selection.barIds.filter((id) => state.project.reinforcement[id] !== undefined);
  const groupIds = selection.placementGroupIds.filter(
    (id) => state.project.placementGroups[id] !== undefined,
  );

  for (const elementId of elementIds) {
    dispatch(deleteElement({ id: elementId }));
  }
  for (const barId of barIds) {
    // Re-check: a selected bar may already be cascade-deleted with its host above.
    if (getState().project.reinforcement[barId] !== undefined) {
      dispatch(deleteBar({ id: barId }));
    }
  }
  for (const groupId of groupIds) {
    // Re-check: a selected group's record may be gone (it survives a host
    // deletion above — the T3 sections precedent — so this is defensive).
    if (getState().project.placementGroups[groupId] !== undefined) {
      dispatch(deletePlacementGroup({ groupId }));
    }
  }
  if (elementIds.length > 0 || barIds.length > 0 || groupIds.length > 0) return;

  if (activeSectionId !== null && state.project.sections[activeSectionId] !== undefined) {
    dispatch(deleteSection({ sectionId: activeSectionId }));
    return;
  }
  dispatch(setCursorHint('Nothing to delete'));
};
