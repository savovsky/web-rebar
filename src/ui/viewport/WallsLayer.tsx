// Renders every concrete element in the project (M0: walls only).
import { shallowEqual } from 'react-redux';
import { useAppSelector } from '@/stores/hooks';
import { WallMesh } from './WallMesh';

export function WallsLayer() {
  const walls = useAppSelector((state) => Object.values(state.project.elements), shallowEqual);
  const selectedIds = useAppSelector((state) => state.ui.selection.elementIds, shallowEqual);
  return (
    <>
      {walls.map((wall) => (
        <WallMesh key={wall.id} wall={wall} isSelected={selectedIds.includes(wall.id)} />
      ))}
    </>
  );
}
