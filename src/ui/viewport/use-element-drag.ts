// React side of the Move tool drag (§B.6, M1 Q3-b): the lifecycle hook used
// by WallMesh — the only draggable entity in M1 (bars resolve to null in
// resolveMoveTarget: bar-relative moves are M3 scope, and a drag starting on
// a bar does NOTHING — "highlighted = what will move") — plus the per-entity
// offset subscription that drives the live-offset render of the wall AND its
// hosted bars. All math and the commit path live in element-drag.ts
// (React-free); its transient offset store mirrors hover-target.ts (§E — no
// 60 FPS Redux dispatches).
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
import { pickPointerWinner, setHoverTarget } from './hover-target';

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
  /** The wall this handler drags: a wall's own id, or a bar's hostElementId. */
  elementId: string;
  isMoveTool: boolean;
}

/**
 * Move-drag lifecycle (mirrors useSectionDrag in SectionVolumesLayer):
 * pointer-down on the §B.5 pick winner begins a potential drag with pointer
 * capture; pointer moves write the grid-snapped plan delta (Shift disables
 * snap, §B.3) to the transient offset store — the wall and its hosted bars
 * follow live; pointer-up commits once via commitElementDrag (click-vs-drag
 * threshold on screen travel, CLICK_DRAG_TOLERANCE_PX). Esc cancels mid-drag
 * (the global Escape shortcut's return-to-Select runs alongside harmlessly);
 * switching tools mid-drag cancels without committing.
 */
export function useElementMoveDrag(options: UseElementMoveDragOptions) {
  const { elementId, isMoveTool } = options;
  const dispatch = useAppDispatch();
  const isSticky = useAppSelector((state) => state.ui.sticky);
  const isSnapEnabled = useAppSelector((state) => state.ui.snapEnabled);
  const gridSpacingMm = useAppSelector((state) => state.ui.gridSpacingMm);
  const [startGround, setStartGround] = useState<Vec3 | null>(null);
  const downScreenRef = useRef<{ x: number; y: number } | null>(null);
  const isDragging = startGround !== null;

  // Esc cancels mid-drag (§B.6). Setters/module functions are stable, so the
  // effect needs only the flag.
  useEffect(() => {
    if (!isDragging) return undefined;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      downScreenRef.current = null;
      setStartGround(null);
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
    // Only the mesh whose wall WON the pick starts the drag — other hit
    // meshes along the ray see the same resolution and pass.
    const target = resolveMoveTarget(event.intersections);
    if (target === null || target.id !== elementId) return;
    const ground = groundFromEvent(event);
    if (ground === null) return;
    event.stopPropagation();
    (event.target as Element).setPointerCapture(event.nativeEvent.pointerId);
    downScreenRef.current = { x: event.nativeEvent.clientX, y: event.nativeEvent.clientY };
    setStartGround(ground);
    setElementDragOffset({ elementId, delta: { x: 0, y: 0, z: 0 } });
    // Hover is left as-is: it already shows the §B.5 pick winner (like
    // Select), and it stays pinned to the grabbed entity for the gesture.
  };

  const handlePointerMove = (event: ThreeEvent<PointerEvent>): void => {
    if (!isMoveTool) return;
    if (startGround === null) {
      // Hover is IDENTICAL to the Select tool (§B.5 revised 2026-08-09): the
      // pick winner highlights as itself. A bar winner highlights as a bar —
      // and resolveMoveTarget resolves it to null, so no drag can start on it
      // (bar moves are M3 scope; the host wall must NOT move either).
      setHoverTarget(pickPointerWinner(event.intersections));
      return;
    }
    const ground = groundFromEvent(event);
    if (ground === null) return;
    setElementDragOffset({ elementId, delta: planDragDelta({ startGround, currentGround: ground }) });
  };

  const handlePointerUp = (event: ThreeEvent<PointerEvent>): void => {
    if (startGround === null) return;
    const target = event.target as Element;
    if (target.hasPointerCapture(event.nativeEvent.pointerId)) {
      target.releasePointerCapture(event.nativeEvent.pointerId);
    }
    const downScreen = downScreenRef.current;
    const ground = groundFromEvent(event);
    downScreenRef.current = null;
    setStartGround(null);
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
      elementId,
      delta: planDragDelta({ startGround, currentGround: ground }),
      isSticky,
    });
  };

  return { handlePointerDown, handlePointerMove, handlePointerUp, isDragging };
}
