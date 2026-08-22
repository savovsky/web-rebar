// Move tool (M) drag support — React-free (mirrors section-volume-drag.ts).
// Render approach decided in T4 (approved plan §4 left it open): LIVE-OFFSET —
// the REAL wall mesh and its hosted bar meshes render at the dragged offset
// during the gesture and snap back on Esc, exactly like T10's section
// wireframe volumes; no duplicate ghost render path. The transient offset
// lives in a module store (§E — no 60 FPS Redux dispatches; same pattern as
// hover-target.ts). On pointer-up, commitElementDrag fires the §N command
// once — moveElement for a wall target (host-follow — one undo level for
// wall + bars), moveBar for a bar target (M3 T5, Q6: the §B.5 hover row's
// bar branch — an individual bar translates, a group member DETACHES first
// and then translates, ONE undo level restores membership + position) — and
// the single-shot tool auto-returns to Select (§B.6 rule 1; sticky stays,
// rule 2).
import type { Intersection } from 'three';
import { CommandError } from '@/commands/command-error';
import { moveBar } from '@/commands/move-bar';
import { moveElement } from '@/commands/move-element';
import { movePlacementGroup } from '@/commands/move-placement-group';
import type { Vec3 } from '@/data/models';
import type { BarClash } from '@/engine/collision';
import type { AppDispatch } from '@/stores';
import { setCursorHint, setTool } from '@/stores/ui-slice';
import { surfaceClashReport } from '@/ui/clash-surfacing';
import { type HoverTarget, pickPointerWinner, setHoverPinned } from './hover-target';

/** mm — a shorter final delta commits nothing (a click, not a drag). */
const DRAG_DELTA_TOLERANCE_MM = 1e-3;

// --- move-target picking (the §B.5 pick resolution applied to the Move tool) ---

/**
 * The entity the Move tool DRAGS (the author's rule: "highlighted = what will
 * move"). A WALL winner moves with its hosted bars (host-follow §E revised);
 * a BAR winner moves ALONE (M3 T5 — the §B.5 bar branch: an individual bar
 * translates, a group member detaches per Q6) — UNLESS the §B.5 Shift+hover
 * group pre-selection is active at the grab (Shift held): then the WHOLE
 * GROUP is the drag target (author direction 2026-08-22 — the group move
 * re-targets its face-local region via movePlacementGroup). Section volumes
 * are not move targets (their own Select-tool drag reshapes them).
 */
export function resolveMoveTarget(intersections: Intersection[], shiftKey = false): HoverTarget | null {
  const winner = pickPointerWinner(intersections);
  if (winner === null) return null;
  if (winner.entityType === 'bar' && shiftKey && winner.placementGroupId !== undefined) {
    return { entityType: 'barGroup', id: winner.placementGroupId };
  }
  if (winner.entityType !== 'wall' && winner.entityType !== 'bar') return null;
  return winner;
}

// --- drag delta ---

interface PlanDragDeltaOptions {
  startGround: Vec3;
  currentGround: Vec3;
}

/** Plan drag delta between two ground points; z stays 0 — the Move tool drags
 *  in plan (see the T2 task-log note on vertical deltas). */
export function planDragDelta(options: PlanDragDeltaOptions): Vec3 {
  const { startGround, currentGround } = options;
  return { x: currentGround.x - startGround.x, y: currentGround.y - startGround.y, z: 0 };
}

// --- transient live offset (§E) ---

export interface ElementDragOffset {
  elementId: string;
  /** Snapped plan delta from the drag start (z = 0). */
  delta: Vec3;
}

let activeOffset: ElementDragOffset | null = null;
const listeners = new Set<() => void>();

export function getElementDragOffset(): ElementDragOffset | null {
  return activeOffset;
}

export function setElementDragOffset(next: ElementDragOffset): void {
  activeOffset = next;
  // Pin the hover for the gesture: Shift mid-drag is the §B.3 snap toggle and
  // must not flip the pinned hover into a group highlight (M3 T5).
  setHoverPinned(true);
  listeners.forEach((emit) => emit());
}

export function clearElementDragOffset(): void {
  setHoverPinned(false);
  if (activeOffset === null) return;
  activeOffset = null;
  listeners.forEach((emit) => emit());
}

export function subscribeElementDragOffset(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

// --- commit ---

interface CommitElementDragOptions {
  dispatch: AppDispatch;
  /** The drag target: a wall (host-follow moveElement) or a bar (moveBar —
   *  M3 T5; a group member detaches per Q6 inside the command). */
  target: HoverTarget;
  /** Final snapped plan delta (z = 0). */
  delta: Vec3;
  /** Sticky (double-click-locked) tools stay active after a completed move. */
  isSticky: boolean;
}

/**
 * Pointer-up: fire the §N command once — moveElement for a wall (host-follow
 * moves the wall AND its hosted bars in one command transaction), moveBar for
 * a bar (detach-then-translate for a group member) — so one undo level
 * restores all of it exactly (Q4-a). A below-tolerance delta is a click, not
 * a drag: nothing commits and the tool stays active. After a completed move
 * the single-shot tool auto-returns to Select (§B.6 rule 1) unless sticky
 * (rule 2). Command rejections surface as a status hint and keep the tool.
 */
export function commitElementDrag(options: CommitElementDragOptions): void {
  const { dispatch, target, delta, isSticky } = options;
  if (Math.hypot(delta.x, delta.y) < DRAG_DELTA_TOLERANCE_MM) return;
  // Q8 surfacing (§K.4, M3 T6): the bar/group-move commands return exact
  // clash reports — surfaced AFTER the tool transition below so the warning
  // hint survives setTool's hint reset. moveElement is not clash-reporting
  // (T6 scope line; recorded in the task log).
  let clashes: BarClash[] | null = null;
  try {
    if (target.entityType === 'bar') {
      clashes = dispatch(moveBar({ barId: target.id, delta })).clashes;
    } else if (target.entityType === 'barGroup') {
      // Group move (M3 T5, author direction): region re-target + rule-exact
      // regenerate inside one movePlacementGroup command.
      clashes = dispatch(movePlacementGroup({ groupId: target.id, delta })).clashes;
    } else {
      dispatch(moveElement({ elementId: target.id, delta }));
    }
  } catch (error) {
    if (!(error instanceof CommandError)) throw error;
    dispatch(setCursorHint(error.message));
    return;
  }
  if (!isSticky) dispatch(setTool({ tool: 'select' }));
  if (clashes !== null) surfaceClashReport(dispatch, clashes);
}
