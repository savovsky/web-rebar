// Domain appearance defaults (doc 10 §5) — the seed for per-project settings.
// Element/rebar/pen styling is drawing semantics, NOT UI theme: it must never
// live in tokens.css. Becomes user-editable project settings post-M0.
// Colors are CSS strings (three.js Color.setStyle parses them directly).

export const DEFAULT_ELEMENT_APPEARANCE = {
  /** Concrete element fill in the 3D viewport (theme-independent domain gray). */
  concreteColor: 'hsl(210, 14%, 55%)',
  /** Concrete opacity (§L.2): reinforcement must stay visible inside elements. */
  concreteOpacity: 0.35,
  /** Reinforcement bar fill in the 3D viewport (classic rebar orange). */
  rebarColor: 'hsl(24, 95%, 53%)',
} as const;

/**
 * §M.4 pen table seed for 2D section views — line weights and dash patterns
 * are DRAWING semantics (domain styling), never UI theme. Screen-space px at
 * M0's auto-fit zoom; true mm plot weights arrive with the layout/PDF
 * pipeline (§I). Becomes per-project settings post-M0.
 */
const BACKGROUND_DASH_ON_PX = 6;
const BACKGROUND_DASH_OFF_PX = 4;

export const DEFAULT_SECTION_PEN_TABLE: {
  concreteOutlineWidthPx: number;
  backgroundLineWidthPx: number;
  backgroundDashPx: number[];
} = {
  concreteOutlineWidthPx: 2,
  backgroundLineWidthPx: 1,
  backgroundDashPx: [BACKGROUND_DASH_ON_PX, BACKGROUND_DASH_OFF_PX],
};
