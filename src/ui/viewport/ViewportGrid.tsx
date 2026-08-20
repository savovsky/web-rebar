// Plan grid (§B.3) — infinite shader grid at z≈0, spacing from the UI slice
// (status bar shows the same value). Colors come from tokens (doc 10).
// drei's Grid lies in the XZ plane by default — rotated once into the XY
// (ground) plane of the Z-up model space.
import { Grid } from '@react-three/drei';
import { useAppSelector } from '@/stores/hooks';
import { GRID_FADE_DISTANCE_MM, GRID_SECTION_EVERY_CELLS, GRID_Z_OFFSET_MM } from './constants';
import { useViewportTheme } from './viewport-theme';

export function ViewportGrid() {
  const theme = useViewportTheme();
  const gridSpacingMm = useAppSelector((state) => state.ui.gridSpacingMm);
  return (
    <Grid
      infiniteGrid
      rotation-x={Math.PI / 2}
      position={[0, 0, GRID_Z_OFFSET_MM]}
      cellSize={gridSpacingMm}
      sectionSize={gridSpacingMm * GRID_SECTION_EVERY_CELLS}
      cellColor={theme.gridCell}
      sectionColor={theme.gridSection}
      fadeDistance={GRID_FADE_DISTANCE_MM}
    />
  );
}
