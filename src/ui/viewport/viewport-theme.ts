// Viewport colors come from the design tokens (doc 10 — the 3D viewport must
// not have its own hardcoded palette).
import { useMemo } from 'react';
import { readHslToken } from '@/ui/read-hsl-token';

export interface ViewportTheme {
  gridCell: string;
  gridSection: string;
  selection: string;
  hover: string;
  wireframe: string;
  snapTarget: string;
  preview: string;
  referenceLine: string;
}

/** Resolved once per mount — live theme switching arrives with the settings UI. */
export function useViewportTheme(): ViewportTheme {
  return useMemo(
    () => ({
      gridCell: readHslToken('--guide-line'),
      gridSection: readHslToken('--primary'),
      selection: readHslToken('--selection'),
      hover: readHslToken('--hover'),
      wireframe: readHslToken('--wireframe'),
      snapTarget: readHslToken('--snap-target'),
      preview: readHslToken('--primary'),
      referenceLine: readHslToken('--reference-line'),
    }),
    [],
  );
}
