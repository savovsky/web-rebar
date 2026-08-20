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

/**
 * §M.4 pen table seed — mm PLOT weights, the true-mm counterpart of the px
 * screen seed above (Q5, M2 T7: the mm seed joins the px seed). Consumed by
 * model-space vector exports at true 1:1 mm (the DXF section writer; the §I
 * PDF pipeline joins later). Lineweights are print mm and must resolve to a
 * valid DXF lineweight enum (100ths of mm, restricted set — the writer
 * validates); the dash pattern is model-mm (scale-on-sheet stays with the
 * consumer's CAD paper space — Drawing Layouts is not touched). Becomes
 * per-project settings post-M0.
 */
const BACKGROUND_DASH_ON_MM = 6;
const BACKGROUND_DASH_OFF_MM = 3;

export const DEFAULT_SECTION_PLOT_PEN_TABLE: {
  concreteOutlineLineweightMm: number;
  rebarLineweightMm: number;
  backgroundLineweightMm: number;
  backgroundDashMm: number[];
} = {
  concreteOutlineLineweightMm: 0.5,
  rebarLineweightMm: 0.35,
  backgroundLineweightMm: 0.18,
  backgroundDashMm: [BACKGROUND_DASH_ON_MM, BACKGROUND_DASH_OFF_MM],
};
