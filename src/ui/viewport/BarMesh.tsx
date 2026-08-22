// One bar = one swept-cylinder mesh from the WASM core (engine/bar-geometry,
// Q1-b typed arrays). Geometry is derived data — memoized per bar object and
// disposed on change/unmount, never stored (§E/§H.2). Plain meshes in M0;
// InstancedMesh per diameter arrives at M3 (§L.1 — superseded scope line: M3
// measures, post-M3 optimizes). Click selects only under the Select tool
// (§B.5); a bar inside transparent concrete (§L.2) is directly clickable:
// ALL Select clicks/hovers resolve through pickPointerWinner
// (hover-target.ts — smallest entity wins, a bar beats its own host wall), so
// the hover highlight previews exactly what the click selects.
// DOUBLE-CLICK a group bar selects its parent placement group (§B.5 row, M3
// T5) — the group's bars all highlight and the Properties panel re-opens the
// rule params. SHIFT+HOVER over a group member pre-highlights the ENTIRE
// group (§B.5 revised 2026-08-22). Under the Move tool a bar winner is a
// DRAG TARGET (M3 T5, Q6 — "highlighted = what will move"): an individual
// bar translates; a group member detaches first (inside the moveBar
// command) — UNLESS the grab holds Shift: then the ENTIRE group drags
// (author direction 2026-08-22 — the group move re-targets the face-local
// region via movePlacementGroup, rule-exact regenerate, ONE undo level).
// When the HOST WALL wins the pick, the bar highlights WITH it —
// wall + hosted bars are the moving set. The live-offset render shifts the
// bar mesh with its own, its group's, or its host's drag (use-element-drag.ts).
// Shift+scroll cycling through overlaps remains post-M0 (§B.5).
import { useEffect, useMemo } from 'react';
import type { ThreeEvent } from '@react-three/fiber';
import { DEFAULT_ELEMENT_APPEARANCE } from '@/data/appearance';
import type { ReinforcementBar, Vec3 } from '@/data/models';
import { createBarGeometry } from '@/engine/bar-geometry';
import { useAppDispatch, useAppSelector } from '@/stores/hooks';
import { setSelection } from '@/stores/ui-slice';
import { CLICK_DRAG_TOLERANCE_PX } from './constants';
import { clearHoverTarget, pickPointerWinner, setHoverFromPick, useIsHoverTarget } from './hover-target';
import { useElementDragOffset, useElementMoveDrag } from './use-element-drag';
import { useViewportTheme } from './viewport-theme';

/** No drag in flight: the mesh sits at its committed position. */
const NO_OFFSET: Vec3 = { x: 0, y: 0, z: 0 };
/** Sentinel for useIsHoverTarget when the bar has no group (never a real id). */
const NO_GROUP = '';

interface BarMeshProps {
  bar: ReinforcementBar;
  isSelected: boolean;
  /** The bar's parent group is selected (§B.5 double-click, M3 T5). */
  isGroupSelected: boolean;
  /** The bar is in the §K.4 clash warning layer (M3 T6 — danger color). */
  isClashing: boolean;
}

export function BarMesh({ bar, isSelected, isGroupSelected, isClashing }: BarMeshProps) {
  const dispatch = useAppDispatch();
  const theme = useViewportTheme();
  const isSelectActive = useAppSelector((state) => state.ui.activeTool === 'select');
  const isMoveTool = useAppSelector((state) => state.ui.activeTool === 'move');
  // A bar is itself a Move drag target (M3 T5) — and a SHIFT grab on a group
  // member starts the WHOLE-GROUP drag (author direction). It still follows
  // its host wall's drag too; the three offset sources are mutually
  // exclusive (one drag at a time).
  const moveDrag = useElementMoveDrag({
    target: { entityType: 'bar', id: bar.id },
    groupId: bar.placementGroupId,
    isMoveTool,
  });
  const ownDragOffset = useElementDragOffset(bar.id);
  const groupDragOffset = useElementDragOffset(bar.placementGroupId ?? NO_GROUP);
  const hostDragOffset = useElementDragOffset(bar.hostElementId);
  const dragOffset = ownDragOffset ?? groupDragOffset ?? hostDragOffset ?? NO_OFFSET;
  const isHovered = useIsHoverTarget('bar', bar.id);
  // Shift+hover group pre-selection: the whole group highlights (§B.5, M3 T5).
  const isGroupHovered = useIsHoverTarget('barGroup', bar.placementGroupId ?? NO_GROUP);
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
    dispatch(setSelection({ elementIds: [], barIds: [bar.id], placementGroupIds: [] }));
  };

  /** §B.5 row (M3 T5): double-click a group bar → select its parent group
   *  (the Properties panel re-opens the rule params). Group-less bars: no-op. */
  const handleDoubleClick = (event: ThreeEvent<MouseEvent>) => {
    if (!isSelectActive || bar.placementGroupId === undefined) return;
    const winner = pickPointerWinner(event.intersections);
    if (winner?.entityType !== 'bar' || winner.id !== bar.id) return;
    event.stopPropagation();
    dispatch(setSelection({ elementIds: [], barIds: [], placementGroupIds: [bar.placementGroupId] }));
  };

  const handlePointerMove = (event: ThreeEvent<PointerEvent>) => {
    // Move hover = Select hover (§B.5): the pick winner highlights as itself;
    // the drag hook also owns the mid-drag offset updates.
    if (isMoveTool) {
      moveDrag.handlePointerMove(event);
      return;
    }
    if (isSelectActive) {
      setHoverFromPick(pickPointerWinner(event.intersections), event.nativeEvent.shiftKey);
    }
  };

  const handlePointerOut = () => {
    // Mid-drag the hover stays pinned to the grabbed entity (the WallMesh
    // pattern); otherwise Select/Move clear the highlight (§B.5).
    if (!(isSelectActive || isMoveTool) || moveDrag.isDragging) return;
    clearHoverTarget({ entityType: 'bar', id: bar.id });
    if (bar.placementGroupId !== undefined) {
      clearHoverTarget({ entityType: 'barGroup', id: bar.placementGroupId });
    }
  };

  // Selection (own or whole-group) outranks hover; hover outranks the §K.4
  // clash warning (interaction feedback wins over the warning — recorded in
  // the M3 T6 task log); the warning outranks the domain rebar color.
  let color: string = DEFAULT_ELEMENT_APPEARANCE.rebarColor;
  if (isClashing) color = theme.danger;
  if (isHovered || isMoveHovered || isGroupHovered) color = theme.hover;
  if (isSelected || isGroupSelected) color = theme.selection;

  return (
    // userData tags feed pickPointerWinner (hover + click share the
    // resolution); placementGroupId is the Shift+hover group handle. The
    // transient drag delta shifts the mesh (live-offset render).
    <mesh
      geometry={geometry}
      position={[dragOffset.x, dragOffset.y, dragOffset.z]}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      onPointerDown={moveDrag.handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={moveDrag.handlePointerUp}
      onPointerOut={handlePointerOut}
      userData={{
        entityType: 'bar',
        entityId: bar.id,
        hostElementId: bar.hostElementId,
        placementGroupId: bar.placementGroupId,
      }}
    >
      <meshStandardMaterial color={color} />
    </mesh>
  );
}
