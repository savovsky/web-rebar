// Move tool (M) drag support — React-free (mirrors section-volume-drag.ts).
// Render approach decided in T4 (approved plan §4 left it open): LIVE-OFFSET —
// the REAL wall mesh and its hosted bar meshes render at the dragged offset
// during the gesture and snap back on Esc, exactly like T10's section
// wireframe volumes; no duplicate ghost render path. The transient offset
// lives in a module store (§E — no 60 FPS Redux dispatches; same pattern as
// hover-target.ts). On pointer-up, commitElementDrag fires the §N moveElement
// command once (host-follow — one undo level for wall + bars) and the
// single-shot tool auto-returns to Select (§B.6 rule 1; sticky stays, rule 2).
import type { Intersection } from 'three';
import { CommandError } from '@/commands/command-error';
import { moveElement } from '@/commands/move-element';
import type { Vec3 } from '@/data/models';
import type { AppDispatch } from '@/stores';
import { setCursorHint, setTool } from '@/stores/ui-slice';
import { type HoverTarget, pickPointerWinner } from './hover-target';

/** mm — a shorter final delta commits nothing (a click, not a drag). */
const DRAG_DELTA_TOLERANCE_MM = 1e-3;

// --- move-target picking (the §B.5 pick resolution applied to the Move tool) ---

/**
 * The entity the Move tool DRAGS (the author's rule: "highlighted = what will
 * move"). Only a WALL winner is a drag target — it moves with its hosted
 * bars (host-follow §E revised). A bar winner resolves to null: bar-relative
 * moves are M3 scope, so a drag starting on a bar must do NOTHING — not even
 * move the wall behind it (the hover shows the bar alone). Section volumes
 * are not move targets either (their own Select-tool drag reshapes them).
 */
export function resolveMoveTarget(intersections: Intersection[]): HoverTarget | null {
  const winner = pickPointerWinner(intersections);
  if (winner === null || winner.entityType !== 'wall') return null;
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
  listeners.forEach((emit) => emit());
}

export function clearElementDragOffset(): void {
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
  elementId: string;
  /** Final snapped plan delta (y = 0). */
  delta: Vec3;
  /** Sticky (double-click-locked) tools stay active after a completed move. */
  isSticky: boolean;
}

/**
 * Pointer-up: fire the §N moveElement command once — host-follow moves the
 * wall AND its hosted bars in one command transaction, so one undo level
 * restores all of it exactly (Q4-a). A below-tolerance delta is a click, not
 * a drag: nothing commits and the tool stays active. After a completed move
 * the single-shot tool auto-returns to Select (§B.6 rule 1) unless sticky
 * (rule 2). Command rejections surface as a status hint and keep the tool.
 */
export function commitElementDrag(options: CommitElementDragOptions): void {
  const { dispatch, elementId, delta, isSticky } = options;
  if (Math.hypot(delta.x, delta.y) < DRAG_DELTA_TOLERANCE_MM) return;
  try {
    dispatch(moveElement({ elementId, delta }));
  } catch (error) {
    if (!(error instanceof CommandError)) throw error;
    dispatch(setCursorHint(error.message));
    return;
  }
  if (!isSticky) dispatch(setTool({ tool: 'select' }));
}
