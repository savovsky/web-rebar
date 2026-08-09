// Shared design-token reader (doc 10): tokens store raw HSL channels; three.js
// and Canvas2D want a CSS color string, so the channels are re-joined with
// commas. Used by the 3D viewport and the 2D section view alike — neither may
// have its own hardcoded palette.
export function readHslToken(tokenName: string): string {
  const channels = getComputedStyle(document.documentElement).getPropertyValue(tokenName).trim();
  return `hsl(${channels.split(/\s+/).join(', ')})`;
}
