// Invisible ground hit-plane (y = 0): tracks the cursor for the status bar and
// draft previews, and routes clicks per active tool. Snapping (§B.3) resolves
// here — Shift disables it while held. 60 FPS pointer data flows into the
// cursor module, never the store (§E). The Section Cut tool drags here:
// pointer-down commits the line start, pointer-up finishes the cut (§B.6).
import type { ThreeEvent } from '@react-three/fiber';
import type { Vec3 } from '@/data/models';
import { snapPointToGrid } from '@/engine/snapping';
import { useAppDispatch, useAppSelector } from '@/stores/hooks';
import { clearSelection } from '@/stores/ui-slice';
import { CLICK_DRAG_TOLERANCE_PX, GROUND_PLANE_SIZE_MM } from './constants';
import { setCursorPoint } from './cursor-position';
import { pickPointerWinner, setHoverTarget } from './hover-target';
import { advanceWallDraft } from './place-wall-draft';
import { advanceSectionCut, beginSectionCut, finishSectionCut } from './section-cut-draft';

const LEFT_MOUSE_BUTTON = 0;

export function GroundPlane() {
  const dispatch = useAppDispatch();
  const activeTool = useAppSelector((state) => state.ui.activeTool);
  const isSnapEnabled = useAppSelector((state) => state.ui.snapEnabled);
  const gridSpacingMm = useAppSelector((state) => state.ui.gridSpacingMm);
  const committedPoints = useAppSelector((state) => state.ui.placementDraft.committedPoints);
  const draftKind = useAppSelector((state) => state.ui.placementDraft.kind);
  const isSticky = useAppSelector((state) => state.ui.sticky);
  const elements = useAppSelector((state) => state.project.elements);
  const sections = useAppSelector((state) => state.project.sections);

  const resolvePoint = (event: ThreeEvent<PointerEvent | MouseEvent>): Vec3 => {
    const raw: Vec3 = { x: event.point.x, y: event.point.y, z: event.point.z };
    if (isSnapEnabled && !event.nativeEvent.shiftKey) return snapPointToGrid(raw, gridSpacingMm);
    return raw;
  };

  const handlePointerMove = (event: ThreeEvent<PointerEvent>) => {
    // While a bar draft runs, the cursor lives on the captured wall face
    // (tracked by WallMesh), not on the ground.
    if (draftKind === 'bar') return;
    // Hover picking (§B.5): every Select-tool move handler resolves the same
    // winner from the same intersection list — idempotent writes, so event
    // order is irrelevant; empty ground resolves to null and clears the hover.
    if (activeTool === 'select') setHoverTarget(pickPointerWinner(event.intersections));
    setCursorPoint(resolvePoint(event));
  };

  const handlePointerDown = (event: ThreeEvent<PointerEvent>) => {
    // A section draft in progress means the line is committed and the tool
    // awaits the depth click — do not start a new drag over it.
    if (activeTool !== 'sectionCut' || draftKind === 'section') return;
    if (event.nativeEvent.button !== LEFT_MOUSE_BUTTON) return;
    // Own the drag: moves/ups keep flowing to this plane even over walls — the
    // ground intersection supplies the plan coordinates for the cut line.
    (event.target as Element).setPointerCapture(event.nativeEvent.pointerId);
    beginSectionCut({ dispatch, point: resolvePoint(event) });
  };

  const handlePointerUp = (event: ThreeEvent<PointerEvent>) => {
    if (activeTool !== 'sectionCut' || draftKind !== 'section') return;
    const startPoint = committedPoints[0] as Vec3 | undefined;
    const hasOnlyLineStart = committedPoints.length === 1;
    if (!startPoint || !hasOnlyLineStart) return;
    const target = event.target as Element;
    if (target.hasPointerCapture(event.nativeEvent.pointerId)) {
      target.releasePointerCapture(event.nativeEvent.pointerId);
    }
    advanceSectionCut({ dispatch, elements, startPoint, endPoint: resolvePoint(event) });
  };

  const handleSectionDepthClick = (event: ThreeEvent<MouseEvent>) => {
    const lineStart = committedPoints[0] as Vec3 | undefined;
    const lineEnd = committedPoints[1] as Vec3 | undefined;
    if (!lineStart || !lineEnd) return;
    finishSectionCut({
      dispatch,
      elements,
      sections,
      lineStart,
      lineEnd,
      depthPoint: resolvePoint(event),
      isSticky,
    });
  };

  const handleClick = (event: ThreeEvent<MouseEvent>) => {
    if (event.delta > CLICK_DRAG_TOLERANCE_PX) return; // a drag ended here, not a click
    if (activeTool === 'select') {
      dispatch(clearSelection()); // §B.5: clicking empty ground deselects
      return;
    }
    if (activeTool === 'sectionCut') {
      // The third click: set the view depth (a drag end never reaches here —
      // the delta guard above filters it).
      handleSectionDepthClick(event);
      return;
    }
    if (activeTool !== 'placeWall') return;
    advanceWallDraft({ dispatch, committedPoints, point: resolvePoint(event) });
  };

  return (
    <mesh
      rotation-x={-Math.PI / 2}
      onClick={handleClick}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={() => {
        // Keep the cursor (and the preview line endpoint) alive mid-drag.
        if (draftKind !== 'section') setCursorPoint(null);
      }}
    >
      <planeGeometry args={[GROUND_PLANE_SIZE_MM, GROUND_PLANE_SIZE_MM]} />
      {/* Opacity-0 material: raycastable hit area with zero visual output. */}
      <meshBasicMaterial transparent opacity={0} depthWrite={false} />
    </mesh>
  );
}
