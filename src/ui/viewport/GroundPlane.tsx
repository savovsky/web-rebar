// Invisible ground hit-plane (y = 0): tracks the cursor for the status bar and
// draft previews, and routes clicks per active tool. Snapping (§B.3) resolves
// here — Shift disables it while held. 60 FPS pointer data flows into the
// cursor module, never the store (§E).
import type { ThreeEvent } from '@react-three/fiber';
import type { Vec3 } from '@/data/models';
import { snapPointToGrid } from '@/engine/snapping';
import { useAppDispatch, useAppSelector } from '@/stores/hooks';
import { clearSelection } from '@/stores/ui-slice';
import { CLICK_DRAG_TOLERANCE_PX, GROUND_PLANE_SIZE_MM } from './constants';
import { setCursorPoint } from './cursor-position';
import { advanceWallDraft } from './place-wall-draft';

export function GroundPlane() {
  const dispatch = useAppDispatch();
  const activeTool = useAppSelector((state) => state.ui.activeTool);
  const isSnapEnabled = useAppSelector((state) => state.ui.snapEnabled);
  const gridSpacingMm = useAppSelector((state) => state.ui.gridSpacingMm);
  const committedPoints = useAppSelector((state) => state.ui.placementDraft.committedPoints);
  const draftKind = useAppSelector((state) => state.ui.placementDraft.kind);

  const resolvePoint = (event: ThreeEvent<PointerEvent | MouseEvent>): Vec3 => {
    const raw: Vec3 = { x: event.point.x, y: event.point.y, z: event.point.z };
    if (isSnapEnabled && !event.nativeEvent.shiftKey) return snapPointToGrid(raw, gridSpacingMm);
    return raw;
  };

  const handlePointerMove = (event: ThreeEvent<PointerEvent>) => {
    // While a bar draft runs, the cursor lives on the captured wall face
    // (tracked by WallMesh), not on the ground.
    if (draftKind === 'bar') return;
    setCursorPoint(resolvePoint(event));
  };

  const handleClick = (event: ThreeEvent<MouseEvent>) => {
    if (event.delta > CLICK_DRAG_TOLERANCE_PX) return; // a drag ended here, not a click
    if (activeTool === 'select') {
      dispatch(clearSelection()); // §B.5: clicking empty ground deselects
      return;
    }
    if (activeTool !== 'placeWall') return;
    advanceWallDraft({ dispatch, committedPoints, point: resolvePoint(event) });
  };

  return (
    <mesh
      rotation-x={-Math.PI / 2}
      onClick={handleClick}
      onPointerMove={handlePointerMove}
      onPointerLeave={() => setCursorPoint(null)}
    >
      <planeGeometry args={[GROUND_PLANE_SIZE_MM, GROUND_PLANE_SIZE_MM]} />
      {/* Opacity-0 material: raycastable hit area with zero visual output. */}
      <meshBasicMaterial transparent opacity={0} depthWrite={false} />
    </mesh>
  );
}
