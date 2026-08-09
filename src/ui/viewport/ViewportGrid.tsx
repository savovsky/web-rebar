// Plan grid (§B.3) — infinite shader grid at y≈0, spacing from the UI slice
// (status bar shows the same value). Colors come from tokens (doc 10).
import { Grid } from '@react-three/drei';
import { useAppSelector } from '@/stores/hooks';
import { GRID_FADE_DISTANCE_MM, GRID_SECTION_EVERY_CELLS, GRID_Y_OFFSET_MM } from './constants';
import { useViewportTheme } from './viewport-theme';

export function ViewportGrid() {
  const theme = useViewportTheme();
  const gridSpacingMm = useAppSelector((state) => state.ui.gridSpacingMm);
  return (
    <Grid
      infiniteGrid
      position={[0, GRID_Y_OFFSET_MM, 0]}
      cellSize={gridSpacingMm}
      sectionSize={gridSpacingMm * GRID_SECTION_EVERY_CELLS}
      cellColor={theme.gridCell}
      sectionColor={theme.gridSection}
      fadeDistance={GRID_FADE_DISTANCE_MM}
    />
  );
}
