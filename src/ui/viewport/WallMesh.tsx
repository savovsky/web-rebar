// One wall = one box mesh from its parametric transform (engine/wall-geometry).
// Click selects only under the Select tool (§B.5); under other tools the click
// falls through to the ground plane. Fill color is a domain token
// (src/data/appearance.ts), the selection highlight a UI token (doc 10).
import type { ThreeEvent } from '@react-three/fiber';
import { DEFAULT_ELEMENT_APPEARANCE } from '@/data/appearance';
import type { WallElement } from '@/data/models';
import { getWallTransform } from '@/engine/wall-geometry';
import { useAppDispatch, useAppSelector } from '@/stores/hooks';
import { setSelection } from '@/stores/ui-slice';
import { CLICK_DRAG_TOLERANCE_PX } from './constants';
import { useViewportTheme } from './viewport-theme';

export function WallMesh({ wall, isSelected }: { wall: WallElement; isSelected: boolean }) {
  const dispatch = useAppDispatch();
  const theme = useViewportTheme();
  const isSelectActive = useAppSelector((state) => state.ui.activeTool === 'select');
  const transform = getWallTransform(wall);

  const handleClick = (event: ThreeEvent<MouseEvent>) => {
    if (!isSelectActive || event.delta > CLICK_DRAG_TOLERANCE_PX) return;
    event.stopPropagation(); // keep the ground plane from clearing this selection
    dispatch(setSelection({ elementIds: [wall.id], barIds: [] }));
  };

  return (
    <mesh
      position={[transform.center.x, transform.center.y, transform.center.z]}
      rotation-y={transform.rotationY}
      onClick={handleClick}
    >
      <boxGeometry args={[transform.lengthMm, wall.height, wall.thickness]} />
      <meshStandardMaterial color={isSelected ? theme.selection : DEFAULT_ELEMENT_APPEARANCE.concreteColor} />
    </mesh>
  );
}
