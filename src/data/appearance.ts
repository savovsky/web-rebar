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
