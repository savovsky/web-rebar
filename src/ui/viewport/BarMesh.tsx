// One bar = one swept-cylinder mesh from the WASM core (engine/bar-geometry,
// Q1-b typed arrays). Geometry is derived data — memoized per bar object and
// disposed on change/unmount, never stored (§E/§H.2). Plain meshes in M0;
// InstancedMesh per diameter arrives at M3 (§L.1). Click selects only under
// the Select tool (§B.5); a bar inside transparent concrete (§L.2) is directly
// clickable: ALL Select clicks/hovers resolve through pickPointerWinner
// (hover-target.ts — smallest entity wins, a bar beats its own host wall), so
// the hover highlight previews exactly what the click selects. Under the
// Move tool a bar highlights as itself when it wins the pick (§B.5) — and
// because bar-relative moves are M3 scope, a drag starting on a bar does
// NOTHING ("highlighted = what will move"; resolveMoveTarget in
// element-drag.ts resolves bars to null). When the HOST WALL wins the pick,
// the bar highlights WITH it — wall + hosted bars are the moving set. The
// live-offset render shifts the bar mesh with its host during a drag
// (use-element-drag.ts). Shift+scroll cycling through overlaps remains
// post-M0 (§B.5).
import { useEffect, useMemo } from 'react';
import type { ThreeEvent } from '@react-three/fiber';
import { DEFAULT_ELEMENT_APPEARANCE } from '@/data/appearance';
import type { ReinforcementBar, Vec3 } from '@/data/models';
import { createBarGeometry } from '@/engine/bar-geometry';
import { useAppDispatch, useAppSelector } from '@/stores/hooks';
import { setSelection } from '@/stores/ui-slice';
import { CLICK_DRAG_TOLERANCE_PX } from './constants';
import { clearHoverTarget, pickPointerWinner, setHoverTarget, useIsHoverTarget } from './hover-target';
import { useElementDragOffset } from './use-element-drag';
import { useViewportTheme } from './viewport-theme';

/** No drag in flight: the mesh sits at its committed position. */
const NO_OFFSET: Vec3 = { x: 0, y: 0, z: 0 };

export function BarMesh({ bar, isSelected }: { bar: ReinforcementBar; isSelected: boolean }) {
  const dispatch = useAppDispatch();
  const theme = useViewportTheme();
  const isSelectActive = useAppSelector((state) => state.ui.activeTool === 'select');
  const isMoveTool = useAppSelector((state) => state.ui.activeTool === 'move');
  const dragOffset = useElementDragOffset(bar.hostElementId) ?? NO_OFFSET;
  const isHovered = useIsHoverTarget('bar', bar.id);
  const isHostHovered = useIsHoverTarget('wall', bar.hostElementId);
  // The host wall won the pick under the Move tool → the bar is part of the
  // moving set and highlights with it ("highlighted = what will move").
  const isMoveHovered = isMoveTool && isHostHovered;
  // The bar object identity changes on any model edit (Immer) → geometry
  // rebuilds exactly then; GPU buffers are released with the old geometry.
  const geometry = useMemo(() => createBarGeometry({ path: bar.path, diameter: bar.diameter }), [bar]);
  useEffect(() => () => geometry.dispose(), [geometry]);

  const handleClick = (event: ThreeEvent<MouseEvent>) => {
    if (!isSelectActive || event.delta > CLICK_DRAG_TOLERANCE_PX) return;
    const winner = pickPointerWinner(event.intersections);
    if (winner?.entityType !== 'bar' || winner.id !== bar.id) return; // yield (§B.5)
    event.stopPropagation(); // keep the ground plane from clearing this selection
    dispatch(setSelection({ elementIds: [], barIds: [bar.id] }));
  };

  const handlePointerMove = (event: ThreeEvent<PointerEvent>) => {
    // Move hover = Select hover (§B.5): the pick winner highlights as itself.
    if (isSelectActive || isMoveTool) setHoverTarget(pickPointerWinner(event.intersections));
  };

  const handlePointerOut = () => {
    if (isSelectActive || isMoveTool) clearHoverTarget({ entityType: 'bar', id: bar.id });
  };

  // Selection outranks hover; both outrank the domain rebar color.
  let color: string = DEFAULT_ELEMENT_APPEARANCE.rebarColor;
  if (isHovered || isMoveHovered) color = theme.hover;
  if (isSelected) color = theme.selection;

  return (
    // userData tags feed pickPointerWinner (hover + click share the resolution).
    // Live-offset render (T4): the transient host-drag delta shifts the mesh.
    <mesh
      geometry={geometry}
      position={[dragOffset.x, dragOffset.y, dragOffset.z]}
      onClick={handleClick}
      onPointerMove={handlePointerMove}
      onPointerOut={handlePointerOut}
      userData={{ entityType: 'bar', entityId: bar.id, hostElementId: bar.hostElementId }}
    >
      <meshStandardMaterial color={color} />
    </mesh>
  );
}
