// One wall = one box mesh from its parametric transform (engine/wall-geometry).
// Click routing per active tool: Select → select (§B.5); Place Bar → face
// capture, then bar-path clicks resolved onto the captured face (the raycast
// hit supplies the local face normal and the world point; engine/placement
// does the math); Place Bar Group (M3 T4) → the first press captures the
// face; presses on the captured face define the region (drag or click-click
// corners — use-bar-group-drag.ts); Enter/Space commits via the §N
// placeBarGroup command (use-bar-group-commit.ts);
// Move → pointer-down begins a live-offset drag of the wall
// AND its hosted bars (use-element-drag.ts; the offset is transient, the §N
// moveElement command fires once on pointer-up). Under other tools the click
// falls through to the ground plane. Concrete is transparent so bars stay visible inside (§L.2) — fill and
// opacity are domain tokens (src/data/appearance.ts), the selection highlight
// a UI token (doc 10). Selection priority (§B.5 — smallest entity wins): the
// wall face is always closer to the camera than a hosted bar, so Select clicks
// and hovers resolve through pickPointerWinner (hover-target.ts) — the wall
// YIELDS when one of its own bars wins the ray (no stopPropagation, the event
// continues down the R3F intersection list to the bar's handler), and the
// hover highlight previews exactly what a click would select.
import type { ThreeEvent } from '@react-three/fiber';
import { DEFAULT_ELEMENT_APPEARANCE } from '@/data/appearance';
import type { Vec3, WallElement } from '@/data/models';
import { getWallTransform } from '@/engine/wall-geometry';
import type { AppDispatch } from '@/stores';
import { useAppDispatch, useAppSelector } from '@/stores/hooks';
import { type PlacementDraft, type ToolId, setSelection } from '@/stores/ui-slice';
import { CLICK_DRAG_TOLERANCE_PX } from './constants';
import { setCursorPoint } from './cursor-position';
import { clearHoverTarget, pickPointerWinner, setHoverFromPick, useIsHoverTarget } from './hover-target';
import { resolveOnFacePoint } from './on-face-point';
import { advanceBarDraft, captureBarFace } from './place-bar-draft';
import { useReferenceSnapTargets } from './reference-snap-targets';
import { useBarGroupDrag } from './use-bar-group-drag';
import { useElementDragOffset, useElementMoveDrag } from './use-element-drag';
import { type ViewportTheme, useViewportTheme } from './viewport-theme';

/** No drag in flight: the mesh sits at its committed transform. */
const NO_OFFSET: Vec3 = { x: 0, y: 0, z: 0 };

interface FillColorOptions {
  isHovered: boolean;
  isSelected: boolean;
  theme: ViewportTheme;
}

/** Selection outranks hover; both outrank the domain concrete color. */
function resolveFillColor({ isHovered, isSelected, theme }: FillColorOptions): string {
  if (isSelected) return theme.selection;
  if (isHovered) return theme.hover;
  return DEFAULT_ELEMENT_APPEARANCE.concreteColor;
}

interface WallClickOptions {
  dispatch: AppDispatch;
  event: ThreeEvent<MouseEvent>;
  activeTool: ToolId;
  wall: WallElement;
  draft: PlacementDraft;
  isDraftHost: boolean;
  resolveOnFace: (event: ThreeEvent<PointerEvent | MouseEvent>) => Vec3 | null;
}

/** Click routing per active tool (§B.5/§B.6): Select resolves the pick winner
 *  (smallest entity wins — the wall YIELDS to its own bars); Place Bar
 *  captures the face, then extends the bar chain onto it. */
function handleWallClick(options: WallClickOptions): void {
  const { dispatch, event, activeTool, wall, draft, isDraftHost, resolveOnFace } = options;
  if (activeTool === 'select') {
    // §B.5: smallest entity wins — yield when a hosted bar wins this ray (the
    // bar sits behind the transparent wall face); a bar hosted by a wall
    // BEHIND this one never steals the wall's click (pickPointerWinner).
    const winner = pickPointerWinner(event.intersections);
    if (winner?.entityType !== 'wall' || winner.id !== wall.id) return;
    event.stopPropagation(); // keep the ground plane from clearing this selection
    dispatch(setSelection({ elementIds: [wall.id], barIds: [], placementGroupIds: [] }));
    return;
  }
  if (activeTool !== 'placeBar') return;
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
}

export function WallMesh({ wall, isSelected }: { wall: WallElement; isSelected: boolean }) {
  const dispatch = useAppDispatch();
  const theme = useViewportTheme();
  const activeTool = useAppSelector((state) => state.ui.activeTool);
  const draft = useAppSelector((state) => state.ui.placementDraft);
  const isSnapEnabled = useAppSelector((state) => state.ui.snapEnabled);
  const gridSpacingMm = useAppSelector((state) => state.ui.gridSpacingMm);
  const referenceTargets = useReferenceSnapTargets();
  const transform = getWallTransform(wall);

  const isMoveTool = activeTool === 'move';
  const moveDrag = useElementMoveDrag({ target: { entityType: 'wall', id: wall.id }, isMoveTool });
  const isGroupTool = activeTool === 'placeBarGroup';
  const groupDrag = useBarGroupDrag({ wall, isGroupTool });
  const dragOffset = useElementDragOffset(wall.id) ?? NO_OFFSET;

  const isHovered = useIsHoverTarget('wall', wall.id);
  const isDraftHost = draft.kind === 'bar' && draft.hostElementId === wall.id && draft.faceNormal !== null;
  const fillColor = resolveFillColor({ isHovered, isSelected, theme });

  const resolveOnFace = (event: ThreeEvent<PointerEvent | MouseEvent>): Vec3 | null => {
    if (!draft.faceNormal) return null;
    return resolveOnFacePoint({
      wall,
      faceNormal: draft.faceNormal,
      worldPoint: { x: event.point.x, y: event.point.y, z: event.point.z },
      isSnapActive: isSnapEnabled && !event.nativeEvent.shiftKey, // Shift disables ALL snapping (§B.3)
      referenceTargets,
      gridSpacingMm,
    });
  };

  const handleClick = (event: ThreeEvent<MouseEvent>) => {
    if (event.delta > CLICK_DRAG_TOLERANCE_PX) return; // a drag ended here, not a click
    handleWallClick({ dispatch, event, activeTool, wall, draft, isDraftHost, resolveOnFace });
  };

  const handlePointerMove = (event: ThreeEvent<PointerEvent>) => {
    if (activeTool === 'select') {
      setHoverFromPick(pickPointerWinner(event.intersections), event.nativeEvent.shiftKey);
      return;
    }
    if (isMoveTool) {
      moveDrag.handlePointerMove(event);
      return;
    }
    if (isGroupTool) {
      groupDrag.handlePointerMove(event);
      return;
    }
    if (activeTool !== 'placeBar' || !isDraftHost) return;
    event.stopPropagation(); // the on-face cursor wins over the ground-plane cursor
    setCursorPoint(resolveOnFace(event));
  };

  const handlePointerLeave = () => {
    if (activeTool === 'placeBar' && isDraftHost) setCursorPoint(null);
    if (isGroupTool && groupDrag.isDraftHost && !groupDrag.isDragging) setCursorPoint(null);
  };

  const handlePointerOut = () => {
    // Mid-drag the hover stays pinned to the grabbed entity; otherwise the
    // Move tool clears the highlight exactly like Select (§B.5 revised).
    const isHoverTool = activeTool === 'select' || isMoveTool;
    if (isHoverTool && !moveDrag.isDragging) clearHoverTarget({ entityType: 'wall', id: wall.id });
  };

  return (
    // Live-offset render (T4): the transient drag delta shifts the real mesh.
    <mesh
      position={[
        transform.center.x + dragOffset.x,
        transform.center.y + dragOffset.y,
        transform.center.z + dragOffset.z,
      ]}
      rotation-z={transform.rotationZ}
      onClick={handleClick}
      onPointerDown={(event) => {
        moveDrag.handlePointerDown(event);
        groupDrag.handlePointerDown(event);
      }}
      onPointerMove={handlePointerMove}
      onPointerUp={(event) => {
        moveDrag.handlePointerUp(event);
        groupDrag.handlePointerUp(event);
      }}
      onPointerOut={handlePointerOut}
      onPointerLeave={handlePointerLeave}
      userData={{ entityType: 'wall', entityId: wall.id }}
    >
      <boxGeometry args={[transform.lengthMm, wall.thickness, wall.height]} />
      {/* §L.2: transparent concrete with no depth writes — bars inside stay visible. */}
      <meshStandardMaterial
        color={fillColor}
        transparent
        opacity={DEFAULT_ELEMENT_APPEARANCE.concreteOpacity}
        depthWrite={false}
      />
    </mesh>
  );
}
