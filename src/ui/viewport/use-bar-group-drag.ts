// React side of the Place Bar Group gesture (§B.6, M3 T4) — the lifecycle
// hook used by WallMesh, mirroring use-element-drag.ts: pointer capture on
// the wall mesh, click-vs-drag threshold on screen travel, Esc/tool-switch
// cancel. The gesture DEFINES the region only — the commit is the Enter/Space
// key (use-bar-group-commit.ts; author decision 2026-08-21). All region/rule
// math lives in engine/placement-group.ts and the flow in
// place-bar-group-draft.ts (React-free); point resolution shares
// on-face-point.ts with the Place Bar flow.
import { useEffect, useRef, useState } from 'react';
import type { ThreeEvent } from '@react-three/fiber';
import type { Vec3, WallElement } from '@/data/models';
import { getWallFaceFrame, rayFacePlanePoint, wallLocalNormalToWorld } from '@/engine/placement';
import { faceKeyForLocalNormal, faceRegionFromCorners } from '@/engine/placement-group';
import type { ReferenceSnapTarget } from '@/engine/reference-snapping';
import { useAppDispatch, useAppSelector } from '@/stores/hooks';
import { setCursorHint } from '@/stores/ui-slice';
import { CLICK_DRAG_TOLERANCE_PX } from './constants';
import { setCursorPoint } from './cursor-position';
import { resolveOnFacePoint } from './on-face-point';
import {
  HINT_REGION_DEFINED,
  captureBarGroupFace,
  clearRegionState,
  getPendingCorner,
  getRegionAnchor,
  setDefinedRegion,
  setPendingCorner,
  setRegionAnchor,
} from './place-bar-group-draft';
import { useReferenceSnapTargets } from './reference-snap-targets';

const LEFT_MOUSE_BUTTON = 0;

interface FacePointSources {
  wall: WallElement;
  isSnapEnabled: boolean;
  gridSpacingMm: number;
  referenceTargets: ReferenceSnapTarget[];
}

const snapActive = (sources: FacePointSources, event: ThreeEvent<PointerEvent>): boolean =>
  sources.isSnapEnabled && !event.nativeEvent.shiftKey; // Shift disables ALL snapping (§B.3)

interface ResolveEventPointOptions {
  sources: FacePointSources;
  event: ThreeEvent<PointerEvent>;
  faceNormal: Vec3;
}

/** Mesh-hit point (pointer-down, hover) → snapped on-face point. */
function resolveHitPoint(options: ResolveEventPointOptions): Vec3 {
  const { sources, event, faceNormal } = options;
  return resolveOnFacePoint({
    wall: sources.wall,
    faceNormal,
    worldPoint: { x: event.point.x, y: event.point.y, z: event.point.z },
    isSnapActive: snapActive(sources, event),
    referenceTargets: sources.referenceTargets,
    gridSpacingMm: sources.gridSpacingMm,
  });
}

/** Ray ∩ face plane (captured drag — the cursor may have left the mesh
 *  surface; pointer capture keeps events flowing, only the ray is reliable). */
function resolveRayPoint(options: ResolveEventPointOptions): Vec3 | null {
  const { sources, event, faceNormal } = options;
  const raw = rayFacePlanePoint({
    frame: getWallFaceFrame(sources.wall, faceNormal),
    rayOrigin: { x: event.ray.origin.x, y: event.ray.origin.y, z: event.ray.origin.z },
    rayDirection: { x: event.ray.direction.x, y: event.ray.direction.y, z: event.ray.direction.z },
  });
  if (raw === null) return null;
  return resolveOnFacePoint({
    wall: sources.wall,
    faceNormal,
    worldPoint: raw,
    isSnapActive: snapActive(sources, event),
    referenceTargets: sources.referenceTargets,
    gridSpacingMm: sources.gridSpacingMm,
  });
}

interface UseBarGroupDragOptions {
  wall: WallElement;
  isGroupTool: boolean;
}

/**
 * Region-definition lifecycle: the FIRST press on an uncaptured face only
 * captures it (the Place Bar mechanism). Presses on the captured face anchor
 * a corner: a drag DEFINES the region on release; a click sets click-click
 * corner A (the next click completes corner B). Nothing commits here — the
 * Enter/Space key does (use-bar-group-commit.ts).
 */
export function useBarGroupDrag(options: UseBarGroupDragOptions) {
  const { wall, isGroupTool } = options;
  const dispatch = useAppDispatch();
  const isSnapEnabled = useAppSelector((state) => state.ui.snapEnabled);
  const gridSpacingMm = useAppSelector((state) => state.ui.gridSpacingMm);
  const draft = useAppSelector((state) => state.ui.placementDraft);
  const referenceTargets = useReferenceSnapTargets();
  const [isDragging, setIsDragging] = useState(false);
  const downScreenRef = useRef<{ x: number; y: number } | null>(null);

  const isDraftHost =
    draft.kind === 'barGroup' &&
    draft.hostElementId === wall.id &&
    draft.faceNormal !== null &&
    draft.faceKey !== null;
  const sources: FacePointSources = { wall, isSnapEnabled, gridSpacingMm, referenceTargets };

  // Esc cancels mid-gesture (§B.6); the global Escape shortcut's return-to-
  // Select runs alongside and clears the draft — the pointer-up then unwinds
  // without defining anything (the isGroupTool/draft guards below).
  useEffect(() => {
    if (!isDragging && draft.kind !== 'barGroup') return undefined;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      downScreenRef.current = null;
      setIsDragging(false);
      clearRegionState();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isDragging, draft.kind]);

  const handlePointerDown = (event: ThreeEvent<PointerEvent>): void => {
    if (!isGroupTool || event.nativeEvent.button !== LEFT_MOUSE_BUTTON) return;
    const local = event.face?.normal;
    if (!local) return;
    // Mid-draft gestures on OTHER walls are ignored (the placeBar pattern).
    if (draft.kind === 'barGroup' && draft.hostElementId !== wall.id) return;
    const localNormal: Vec3 = { x: local.x, y: local.y, z: local.z };
    const faceKey = faceKeyForLocalNormal(localNormal);
    const faceNormal = wallLocalNormalToWorld(wall, localNormal);
    if (!(isDraftHost && draft.faceKey === faceKey)) {
      // First press on the face: capture only — the corner gesture starts on
      // the NEXT press, so a capture click never doubles as a region corner.
      captureBarGroupFace({ dispatch, hostElementId: wall.id, faceKey, faceNormal });
      return;
    }
    // Own the gesture: moves/ups keep flowing even off the mesh surface.
    event.stopPropagation();
    (event.target as Element).setPointerCapture(event.nativeEvent.pointerId);
    downScreenRef.current = { x: event.nativeEvent.clientX, y: event.nativeEvent.clientY };
    setRegionAnchor(resolveHitPoint({ sources, event, faceNormal }));
    setIsDragging(true);
  };

  const handlePointerMove = (event: ThreeEvent<PointerEvent>): void => {
    if (!isGroupTool) return;
    if (isDragging) {
      // The press on THIS mesh captured the draft — draft.faceNormal is set.
      const point = draft.faceNormal
        ? resolveRayPoint({ sources, event, faceNormal: draft.faceNormal })
        : null;
      if (point) setCursorPoint(point);
      return;
    }
    if (!isDraftHost || !draft.faceNormal) return;
    event.stopPropagation(); // the on-face cursor wins over the ground-plane cursor
    setCursorPoint(resolveHitPoint({ sources, event, faceNormal: draft.faceNormal }));
  };

  const handlePointerUp = (event: ThreeEvent<PointerEvent>): void => {
    if (!isDragging) return;
    const target = event.target as Element;
    if (target.hasPointerCapture(event.nativeEvent.pointerId)) {
      target.releasePointerCapture(event.nativeEvent.pointerId);
    }
    const downScreen = downScreenRef.current;
    downScreenRef.current = null;
    setIsDragging(false);
    const anchor = getRegionAnchor();
    setRegionAnchor(null);
    // A tool switch mid-drag (Esc/letter) cancels silently: pointer capture
    // guarantees this event, so the gesture always unwinds without defining.
    if (!isGroupTool || !isDraftHost || !draft.faceNormal || !draft.faceKey || !downScreen) return;
    const end = resolveRayPoint({ sources, event, faceNormal: draft.faceNormal });
    if (!anchor || !end) return;
    const frame = getWallFaceFrame(wall, draft.faceNormal);
    const travelPx = Math.hypot(
      event.nativeEvent.clientX - downScreen.x,
      event.nativeEvent.clientY - downScreen.y,
    );
    if (travelPx > CLICK_DRAG_TOLERANCE_PX) {
      // Drag release: the two-corner region is DEFINED (Enter commits it).
      setDefinedRegion(faceRegionFromCorners({ frame, cornerA: anchor, cornerB: end }));
      setPendingCorner(null);
      dispatch(setCursorHint(HINT_REGION_DEFINED));
      return;
    }
    // Click: click-click corner definition — first click = corner A, second
    // click = corner B → the region is defined.
    const pending = getPendingCorner();
    if (pending === null) {
      setPendingCorner(anchor);
      return;
    }
    setDefinedRegion(faceRegionFromCorners({ frame, cornerA: pending, cornerB: anchor }));
    setPendingCorner(null);
    dispatch(setCursorHint(HINT_REGION_DEFINED));
  };

  return { handlePointerDown, handlePointerMove, handlePointerUp, isDragging, isDraftHost };
}
