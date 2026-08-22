// React side of the Move tool drag (§B.6, M1 Q3-b): the lifecycle hook used
// by WallMesh (drag target = the wall, host-follow) and BarMesh (drag target
// = the bar itself, M3 T5 — an individual bar translates, a group member
// detaches per Q6 inside the moveBar command) — plus the per-entity offset
// subscription that drives the live-offset render of the dragged entity (and
// its hosted bars for a wall). All math and the commit path live in
// element-drag.ts (React-free); its transient offset store mirrors
// hover-target.ts (§E — no 60 FPS Redux dispatches).
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import type { ThreeEvent } from '@react-three/fiber';
import type { Vec3 } from '@/data/models';
import { groundPointFromRay } from '@/engine/section-cut';
import { snapPointToGrid } from '@/engine/snapping';
import { useAppDispatch, useAppSelector } from '@/stores/hooks';
import { CLICK_DRAG_TOLERANCE_PX } from './constants';
import {
  clearElementDragOffset,
  commitElementDrag,
  getElementDragOffset,
  planDragDelta,
  resolveMoveTarget,
  setElementDragOffset,
  subscribeElementDragOffset,
} from './element-drag';
import { type HoverTarget, pickPointerWinner, setHoverFromPick } from './hover-target';

const LEFT_MOUSE_BUTTON = 0;

/** Live drag delta of one element; null while it is not being dragged. The
 *  per-entity snapshot keeps non-dragged meshes from re-rendering at pointer
 *  rate (same boolean-snapshot trick as useIsHoverTarget). */
export function useElementDragOffset(elementId: string): Vec3 | null {
  return useSyncExternalStore(subscribeElementDragOffset, () => {
    const offset = getElementDragOffset();
    return offset !== null && offset.elementId === elementId ? offset.delta : null;
  });
}

interface UseElementMoveDragOptions {
  /** What this handler drags: a WALL (moves with its hosted bars, §E
   *  host-follow) or a single BAR (M3 T5 — moves alone; a group member
   *  detaches per Q6). */
  target: HoverTarget;
  /** Bars only: the parent placement group — a SHIFT grab resolves to the
   *  whole group (M3 T5, author direction 2026-08-22 — the group move). */
  groupId?: string;
  isMoveTool: boolean;
}

/**
 * Move-drag lifecycle (mirrors useSectionDrag in SectionVolumesLayer):
 * pointer-down on the §B.5 pick winner begins a potential drag with pointer
 * capture — Shift AT THE GRAB decides bar-vs-group on group members (bar
 * detaches, group moves); pointer moves write the grid-snapped plan delta
 * (Shift toggles snap independently, §B.3) to the transient offset store —
 * the dragged entity (and a wall's hosted bars, or a group's member bars)
 * follow live; pointer-up commits once via commitElementDrag (click-vs-drag
 * threshold on screen travel, CLICK_DRAG_TOLERANCE_PX). Esc cancels mid-drag
 * (the global Escape shortcut's return-to-Select runs alongside harmlessly);
 * switching tools mid-drag cancels without committing.
 */
export function useElementMoveDrag(options: UseElementMoveDragOptions) {
  const { target: dragTarget, groupId, isMoveTool } = options;
  const dispatch = useAppDispatch();
  const isSticky = useAppSelector((state) => state.ui.sticky);
  const isSnapEnabled = useAppSelector((state) => state.ui.snapEnabled);
  const gridSpacingMm = useAppSelector((state) => state.ui.gridSpacingMm);
  /** The resolved drag target (bar/group/wall) + the snapped start point —
   *  remembered at pointer-down so releasing Shift mid-drag still commits
   *  the group move a Shift-grab started. */
  const [activeDrag, setActiveDrag] = useState<{ target: HoverTarget; startGround: Vec3 } | null>(null);
  const downScreenRef = useRef<{ x: number; y: number } | null>(null);
  const isDragging = activeDrag !== null;

  // Esc cancels mid-drag (§B.6). Setters/module functions are stable, so the
  // effect needs only the flag.
  useEffect(() => {
    if (!isDragging) return undefined;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      downScreenRef.current = null;
      setActiveDrag(null);
      clearElementDragOffset();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isDragging]);

  /** Pointer event → snapped plan point via the y=0 ground plane. */
  const groundFromEvent = (event: ThreeEvent<PointerEvent>): Vec3 | null => {
    const raw = groundPointFromRay(
      { x: event.ray.origin.x, y: event.ray.origin.y, z: event.ray.origin.z },
      { x: event.ray.direction.x, y: event.ray.direction.y, z: event.ray.direction.z },
    );
    if (raw === null) return null;
    return isSnapEnabled && !event.nativeEvent.shiftKey ? snapPointToGrid(raw, gridSpacingMm) : raw;
  };

  const handlePointerDown = (event: ThreeEvent<PointerEvent>): void => {
    if (!isMoveTool || event.nativeEvent.button !== LEFT_MOUSE_BUTTON) return;
    // Only the mesh whose entity WON the pick starts the drag — other hit
    // meshes along the ray see the same resolution and pass. Shift at the
    // grab resolves a group member to its whole group (author direction).
    const target = resolveMoveTarget(event.intersections, event.nativeEvent.shiftKey);
    if (target === null) return;
    const isOwnDrag = target.entityType === dragTarget.entityType && target.id === dragTarget.id;
    const isGroupDrag = groupId !== undefined && target.entityType === 'barGroup' && target.id === groupId;
    if (!isOwnDrag && !isGroupDrag) return;
    const ground = groundFromEvent(event);
    if (ground === null) return;
    event.stopPropagation();
    (event.target as Element).setPointerCapture(event.nativeEvent.pointerId);
    downScreenRef.current = { x: event.nativeEvent.clientX, y: event.nativeEvent.clientY };
    setActiveDrag({ target, startGround: ground });
    setElementDragOffset({ elementId: target.id, delta: { x: 0, y: 0, z: 0 } });
    // Hover is left as-is: it already shows the §B.5 pick winner (bar or,
    // under Shift, its whole group), and it stays pinned for the gesture.
  };

  const handlePointerMove = (event: ThreeEvent<PointerEvent>): void => {
    if (!isMoveTool) return;
    if (activeDrag === null) {
      // Hover is IDENTICAL to the Select tool (§B.5 revised 2026-08-09): the
      // pick winner highlights as itself — "highlighted = what will move".
      // Shift+hover over a group member pre-highlights its whole group (§B.5
      // revised 2026-08-22, M3 T5).
      setHoverFromPick(pickPointerWinner(event.intersections), event.nativeEvent.shiftKey);
      return;
    }
    const ground = groundFromEvent(event);
    if (ground === null) return;
    setElementDragOffset({
      elementId: activeDrag.target.id,
      delta: planDragDelta({ startGround: activeDrag.startGround, currentGround: ground }),
    });
  };

  const handlePointerUp = (event: ThreeEvent<PointerEvent>): void => {
    if (activeDrag === null) return;
    const target = event.target as Element;
    if (target.hasPointerCapture(event.nativeEvent.pointerId)) {
      target.releasePointerCapture(event.nativeEvent.pointerId);
    }
    const downScreen = downScreenRef.current;
    const ground = groundFromEvent(event);
    downScreenRef.current = null;
    setActiveDrag(null);
    clearElementDragOffset();
    // A tool switch mid-drag (letter shortcut — Esc routes here too via the
    // global handler) cancels silently: pointer capture guarantees this up
    // event, so the live offset always unwinds. Never commit under a new tool.
    if (!isMoveTool) return;
    if (downScreen === null || ground === null) return;
    const travelPx = Math.hypot(
      event.nativeEvent.clientX - downScreen.x,
      event.nativeEvent.clientY - downScreen.y,
    );
    if (travelPx <= CLICK_DRAG_TOLERANCE_PX) return; // a click, not a drag
    commitElementDrag({
      dispatch,
      target: activeDrag.target,
      delta: planDragDelta({ startGround: activeDrag.startGround, currentGround: ground }),
      isSticky,
    });
  };

  return { handlePointerDown, handlePointerMove, handlePointerUp, isDragging };
}
