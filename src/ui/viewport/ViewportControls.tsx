// Camera controls (§B.6): right-drag orbits, middle-drag pans, scroll zooms.
// The left button belongs to the active tool — except when the Pan tool itself
// is active, then left-drag pans too.
import { useMemo } from 'react';
import { OrbitControls } from '@react-three/drei';
import { MOUSE } from 'three';
import { useAppSelector } from '@/stores/hooks';

export function ViewportControls() {
  const isPanActive = useAppSelector((state) => state.ui.activeTool === 'pan');
  const mouseButtons = useMemo(
    () => ({
      LEFT: isPanActive ? MOUSE.PAN : undefined, // undefined → OrbitControls ignores the button
      MIDDLE: MOUSE.PAN,
      RIGHT: MOUSE.ROTATE,
    }),
    [isPanActive],
  );
  return <OrbitControls makeDefault mouseButtons={mouseButtons} />;
}
