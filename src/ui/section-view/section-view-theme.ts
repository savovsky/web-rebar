// The 2D section view reads its ink colors from design tokens (doc 10), like
// the 3D viewport does. Line weights and dash patterns are domain pen-table
// styling (§M.4) and come from src/data/appearance.ts — never from the theme.
import { useMemo } from 'react';
import { readHslToken } from '@/ui/read-hsl-token';

export interface SectionViewTheme {
  /** Primary drawing ink (cut concrete outlines, cut-bar dots). */
  ink: string;
  /** Muted ink for background lines within the view depth (§G.2.3). */
  backgroundInk: string;
}

/** Resolved once per mount — live theme switching arrives with the settings UI. */
export function useSectionViewTheme(): SectionViewTheme {
  return useMemo(
    () => ({
      ink: readHslToken('--foreground'),
      backgroundInk: readHslToken('--muted-foreground'),
    }),
    [],
  );
}
