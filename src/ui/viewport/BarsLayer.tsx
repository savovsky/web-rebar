// Renders every reinforcement bar in the project.
import { shallowEqual } from 'react-redux';
import { useAppSelector } from '@/stores/hooks';
import { BarMesh } from './BarMesh';

export function BarsLayer() {
  const bars = useAppSelector((state) => Object.values(state.project.reinforcement), shallowEqual);
  const selectedIds = useAppSelector((state) => state.ui.selection.barIds, shallowEqual);
  return (
    <>
      {bars.map((bar) => (
        <BarMesh key={bar.id} bar={bar} isSelected={selectedIds.includes(bar.id)} />
      ))}
    </>
  );
}
