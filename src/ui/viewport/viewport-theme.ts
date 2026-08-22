// Viewport colors come from the design tokens (doc 10 — the 3D viewport must
// not have its own hardcoded palette).
import { useMemo } from 'react';
import { readHslToken } from '@/ui/read-hsl-token';

export interface ViewportTheme {
  gridCell: string;
  gridSection: string;
  selection: string;
  hover: string;
  /** §K.4 clash warning (M3 T6) — clashing bars render in the danger token. */
  danger: string;
  wireframe: string;
  snapTarget: string;
  preview: string;
  referenceLine: string;
  referenceSolid: string;
}

/** Resolved once per mount — live theme switching arrives with the settings UI. */
export function useViewportTheme(): ViewportTheme {
  return useMemo(
    () => ({
      gridCell: readHslToken('--guide-line'),
      gridSection: readHslToken('--primary'),
      selection: readHslToken('--selection'),
      hover: readHslToken('--hover'),
      danger: readHslToken('--danger'),
      wireframe: readHslToken('--wireframe'),
      snapTarget: readHslToken('--snap-target'),
      preview: readHslToken('--primary'),
      referenceLine: readHslToken('--reference-line'),
      referenceSolid: readHslToken('--reference-solid'),
    }),
    [],
  );
}
