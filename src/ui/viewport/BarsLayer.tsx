// Renders every reinforcement bar in the project.
import { useMemo } from 'react';
import { shallowEqual } from 'react-redux';
import { useAppSelector } from '@/stores/hooks';
import { BarMesh } from './BarMesh';

export function BarsLayer() {
  const bars = useAppSelector((state) => Object.values(state.project.reinforcement), shallowEqual);
  const selectedIds = useAppSelector((state) => state.ui.selection.barIds, shallowEqual);
  const selectedGroupIds = useAppSelector((state) => state.ui.selection.placementGroupIds, shallowEqual);
  // The minimal §K.4 clash affordance (M3 T6): the warning layer's pairs → a
  // membership Set (one pass, not a per-bar scan of the pair list).
  const clashPairs = useAppSelector((state) => state.ui.clashWarning?.pairs);
  const clashingIds = useMemo(() => {
    const ids = new Set<string>();
    for (const pair of clashPairs ?? []) {
      ids.add(pair.barIdA);
      ids.add(pair.barIdB);
    }
    return ids;
  }, [clashPairs]);
  return (
    <>
      {bars.map((bar) => (
        <BarMesh
          key={bar.id}
          bar={bar}
          isSelected={selectedIds.includes(bar.id)}
          isGroupSelected={
            bar.placementGroupId !== undefined && selectedGroupIds.includes(bar.placementGroupId)
          }
          isClashing={clashingIds.has(bar.id)}
        />
      ))}
    </>
  );
}
