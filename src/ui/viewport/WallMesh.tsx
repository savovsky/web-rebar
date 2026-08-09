// One wall = one box mesh from its parametric transform (engine/wall-geometry).
// Click routing per active tool: Select → select (§B.5); Place Bar → face
// capture, then bar-path clicks resolved onto the captured face (the raycast
// hit supplies the local face normal and the world point; engine/placement
// does the math). Under other tools the click falls through to the ground
// plane. Concrete is transparent so bars stay visible inside (§L.2) — fill and
// opacity are domain tokens (src/data/appearance.ts), the selection highlight
// a UI token (doc 10).
import type { ThreeEvent } from '@react-three/fiber';
import { DEFAULT_ELEMENT_APPEARANCE } from '@/data/appearance';
import type { Vec3, WallElement } from '@/data/models';
import { getWallFaceFrame, resolveFacePoint } from '@/engine/placement';
import { getWallTransform } from '@/engine/wall-geometry';
import { useAppDispatch, useAppSelector } from '@/stores/hooks';
import { setSelection } from '@/stores/ui-slice';
import { CLICK_DRAG_TOLERANCE_PX } from './constants';
import { setCursorPoint } from './cursor-position';
import { advanceBarDraft, captureBarFace } from './place-bar-draft';
import { useViewportTheme } from './viewport-theme';

export function WallMesh({ wall, isSelected }: { wall: WallElement; isSelected: boolean }) {
  const dispatch = useAppDispatch();
  const theme = useViewportTheme();
  const activeTool = useAppSelector((state) => state.ui.activeTool);
  const draft = useAppSelector((state) => state.ui.placementDraft);
  const isSnapEnabled = useAppSelector((state) => state.ui.snapEnabled);
  const gridSpacingMm = useAppSelector((state) => state.ui.gridSpacingMm);
  const transform = getWallTransform(wall);

  const isDraftHost = draft.kind === 'bar' && draft.hostElementId === wall.id && draft.faceNormal !== null;

  /** Raycast hit → point on the captured face plane (projected + grid-snapped). */
  const resolveOnFace = (event: ThreeEvent<PointerEvent | MouseEvent>): Vec3 | null => {
    if (!draft.faceNormal) return null;
    return resolveFacePoint({
      frame: getWallFaceFrame(wall, draft.faceNormal),
      worldPoint: { x: event.point.x, y: event.point.y, z: event.point.z },
      gridSpacingMm,
      isSnapEnabled: isSnapEnabled && !event.nativeEvent.shiftKey,
    });
  };

  const handleSelectClick = (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation(); // keep the ground plane from clearing this selection
    dispatch(setSelection({ elementIds: [wall.id], barIds: [] }));
  };

  const handlePlaceBarClick = (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation();
    if (isDraftHost) {
      const point = resolveOnFace(event);
      if (point) advanceBarDraft({ dispatch, host: wall, draft, point });
      return;
    }
    // Face capture: only before any path point exists — mid-draft clicks on a
    // different wall are ignored (Esc is the cancel mechanism, §B.6).
    if (draft.committedPoints.length > 0 || !event.face) return;
    const local = event.face.normal;
    captureBarFace({ dispatch, wall, localNormal: { x: local.x, y: local.y, z: local.z } });
  };

  const handleClick = (event: ThreeEvent<MouseEvent>) => {
    if (event.delta > CLICK_DRAG_TOLERANCE_PX) return; // a drag ended here, not a click
    if (activeTool === 'select') handleSelectClick(event);
    if (activeTool === 'placeBar') handlePlaceBarClick(event);
  };

  const handlePointerMove = (event: ThreeEvent<PointerEvent>) => {
    if (activeTool !== 'placeBar' || !isDraftHost) return;
    event.stopPropagation(); // the on-face cursor wins over the ground-plane cursor
    setCursorPoint(resolveOnFace(event));
  };

  const handlePointerLeave = () => {
    if (activeTool === 'placeBar' && isDraftHost) setCursorPoint(null);
  };

  return (
    <mesh
      position={[transform.center.x, transform.center.y, transform.center.z]}
      rotation-y={transform.rotationY}
      onClick={handleClick}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
    >
      <boxGeometry args={[transform.lengthMm, wall.height, wall.thickness]} />
      {/* §L.2: transparent concrete with no depth writes — bars inside stay visible. */}
      <meshStandardMaterial
        color={isSelected ? theme.selection : DEFAULT_ELEMENT_APPEARANCE.concreteColor}
        transparent
        opacity={DEFAULT_ELEMENT_APPEARANCE.concreteOpacity}
        depthWrite={false}
      />
    </mesh>
  );
}
