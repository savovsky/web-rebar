// Viewport colors come from the design tokens (doc 10 — the 3D viewport must
// not have its own hardcoded palette). Tokens store raw HSL channels; three.js
// wants a CSS color string, so the channels are re-joined with commas.
import { useMemo } from 'react';

export interface ViewportTheme {
  gridCell: string;
  gridSection: string;
  selection: string;
  snapTarget: string;
  preview: string;
}

function readHslToken(tokenName: string): string {
  const channels = getComputedStyle(document.documentElement).getPropertyValue(tokenName).trim();
  return `hsl(${channels.split(/\s+/).join(', ')})`;
}

/** Resolved once per mount — live theme switching arrives with the settings UI. */
export function useViewportTheme(): ViewportTheme {
  return useMemo(
    () => ({
      gridCell: readHslToken('--guide-line'),
      gridSection: readHslToken('--primary'),
      selection: readHslToken('--selection'),
      snapTarget: readHslToken('--snap-target'),
      preview: readHslToken('--primary'),
    }),
    [],
  );
}
