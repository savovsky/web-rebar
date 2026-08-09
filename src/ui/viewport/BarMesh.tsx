// One bar = one swept-cylinder mesh from the WASM core (engine/bar-geometry,
// Q1-b typed arrays). Geometry is derived data — memoized per bar object and
// disposed on change/unmount, never stored (§E/§H.2). Plain meshes in M0;
// InstancedMesh per diameter arrives at M3 (§L.1). Click selects only under
// the Select tool (§B.5); a bar inside transparent concrete (§L.2) is reached
// via the wall first — Shift+scroll cycling through overlaps is post-M0 (§B.5).
import { useEffect, useMemo } from 'react';
import type { ThreeEvent } from '@react-three/fiber';
import { DEFAULT_ELEMENT_APPEARANCE } from '@/data/appearance';
import type { ReinforcementBar } from '@/data/models';
import { createBarGeometry } from '@/engine/bar-geometry';
import { useAppDispatch, useAppSelector } from '@/stores/hooks';
import { setSelection } from '@/stores/ui-slice';
import { CLICK_DRAG_TOLERANCE_PX } from './constants';
import { useViewportTheme } from './viewport-theme';

export function BarMesh({ bar, isSelected }: { bar: ReinforcementBar; isSelected: boolean }) {
  const dispatch = useAppDispatch();
  const theme = useViewportTheme();
  const isSelectActive = useAppSelector((state) => state.ui.activeTool === 'select');
  // The bar object identity changes on any model edit (Immer) → geometry
  // rebuilds exactly then; GPU buffers are released with the old geometry.
  const geometry = useMemo(() => createBarGeometry({ path: bar.path, diameter: bar.diameter }), [bar]);
  useEffect(() => () => geometry.dispose(), [geometry]);

  const handleClick = (event: ThreeEvent<MouseEvent>) => {
    if (!isSelectActive || event.delta > CLICK_DRAG_TOLERANCE_PX) return;
    event.stopPropagation(); // selection priority: smallest entity wins (§B.5)
    dispatch(setSelection({ elementIds: [], barIds: [bar.id] }));
  };

  return (
    <mesh geometry={geometry} onClick={handleClick}>
      <meshStandardMaterial color={isSelected ? theme.selection : DEFAULT_ELEMENT_APPEARANCE.rebarColor} />
    </mesh>
  );
}
