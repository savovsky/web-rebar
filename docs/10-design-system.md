# 10 — Design System Approach

> **Back to:** [README.md](../README.md)  
> **Related:** [Tech Stack](./03-tech-stack.md) | [Tech Libraries](./09-tech-libraries.md) | [Architecture Spec §B](./08-architecture-spec.md#b--user-interaction-model)  
> **Created:** 2026-07-28  
> **Status:** Locked approach — implementation details finalized at M0

---

## The Golden Rule

**No component ever contains a literal style value.** No hex codes, no ad-hoc pixel sizes, no hardcoded font sizes in component files. Everything comes from design tokens defined in ONE place. If the author wants to change something, it changes in one file — never by hunting through components.

---

## Token Flow Architecture

```
src/ui/styles/tokens.css          ← THE single source of truth (CSS custom properties)
        │
        ▼  mapped into
tailwind.config.ts                ← tokens become Tailwind utilities (bg-primary, text-sm, h-control...)
        │
        ▼  consumed by
src/ui/components/ (shadcn/ui, vendored) + all custom components
        │
        ▼  variants declared with
cva (class-variance-authority)    ← component variants (size, state) in the component's single file
```

Changing any token in `tokens.css` propagates everywhere automatically. This is the standard shadcn/ui mechanism — we keep it and extend it with CAD-specific tokens.

---

## Token Categories

### 1. Color Tokens — Semantic, Never Literal

Defined as HSL (Hue, Saturation, Lightness) CSS (Cascading Style Sheets) variables. Components reference meaning, not color:

```css
/* src/ui/styles/tokens.css */
:root {
  /* Surfaces */
  --background: 0 0% 100%;
  --panel: 0 0% 98%;
  --viewport: 0 0% 100%;

  /* Foreground / text */
  --foreground: 222 47% 11%;
  --muted-foreground: 215 16% 47%;

  /* Brand / interaction */
  --primary: 221 83% 53%;
  --primary-foreground: 0 0% 100%;

  /* Semantic states */
  --danger: 0 72% 51%;       /* validation violations (§K) */
  --warning: 38 92% 50%;
  --success: 142 71% 45%;

  /* Selection & snapping (CAD-specific) */
  --selection: 221 83% 53%;
  --snap-target: 142 71% 45%;
  --guide-line: 221 83% 63%;

  --radius: 0.375rem;
}

.dark {
  --background: 222 47% 8%;
  --panel: 222 47% 11%;
  --viewport: 220 20% 12%;
  --foreground: 210 40% 96%;
  /* ... all tokens redefined for dark theme ... */
}
```

**Wrong:** `<div className="bg-[#3b82f6]">` or `color: "#64748b"`  
**Right:** `<div className="bg-primary">` / `text-muted-foreground`

### 2. Typography Tokens

One scale, defined once: font family (UI font vs. monospace for coordinates/dimensions), sizes (`--text-xs` … `--text-lg`), weights, line heights. Monospace token is mandatory — dimension values, coordinates, and schedule numbers must align.

### 3. Spacing & Density Tokens

CAD UI is **compact by default**. Density is controlled in one place:

```css
:root {
  --control-height: 28px;    /* buttons, inputs — dense CAD default */
  --control-height-lg: 36px;
  --panel-padding: 8px;
  --toolbar-icon: 20px;
  --panel-width-right: 280px;
  --panel-width-left: 48px;
}
```

Want the whole UI airier for a touch device later? Change `--control-height` and `--panel-padding` — not 40 components.

### 4. Component Variants — cva in the Vendored File

shadcn/ui components declare variants with cva (class-variance-authority) inside their single vendored file:

```ts
// src/ui/components/button.tsx — the ONE place "button sizes" exist
const buttonVariants = cva("...", {
  variants: {
    size: {
      sm: "h-[var(--control-height)] px-2 text-xs",
      lg: "h-[var(--control-height-lg)] px-4",
    },
  },
});
```

### 5. Domain Tokens (Separate Family — NOT UI Theme)

These belong to the project/drawing domain, live in the project model or project settings (not `tokens.css`), and are user-editable per project:

| Domain token family | Examples | Reference |
|---|---|---|
| **Pen table** (line weights) | Concrete outline 0.5mm, rebar main 0.35mm, stirrups 0.25mm | [§M.4](./08-architecture-spec.md#m--annotation--labeling-strategy) |
| **Rebar colors** | Per diameter or per layer (3D view) | [§L](./08-architecture-spec.md#l--performance--rendering-strategy) |
| **Hatch patterns** | Concrete, earth, insulation (ISO (International Organization for Standardization)/DIN (Deutsches Institut für Normung) patterns) | [07](./07-browser-feasibility.md) |
| **Viewport colors** | Grid lines, axes, section plane indicator | [§B.2](./08-architecture-spec.md#b--user-interaction-model) |
| **Label templates** | Per country/company standard | [§M.3](./08-architecture-spec.md#m--annotation--labeling-strategy) |

Mixing domain tokens into the UI theme file is a classic mess — keep the families apart.

---

## Theming

- Dark and light themes are the same token names defined twice (`:root` / `.dark`). Theme switch = one class on the root element.
- The 3D viewport reads its colors from tokens too (passed to Three.js materials) — the viewport must not have its own hardcoded palette.

---

## File Layout

```
src/ui/
├── styles/
│   ├── tokens.css           ← ALL UI design tokens (single source of truth)
│   └── globals.css          ← base resets, font imports, Tailwind directives
├── components/              ← shadcn/ui vendored components (variants via cva)
├── panels/                  ← app panels (consume tokens only)
└── viewport/                ← 3D viewport (reads tokens for materials)
tailwind.config.ts           ← maps tokens → Tailwind utilities
```

---

## Enforcement Rules (for implementation sessions & review)

1. **Zero literal values:** no hex colors, no raw pixel sizes, no raw font sizes in any file under `src/ui/` except `tokens.css` and `tailwind.config.ts`. (Tailwind arbitrary values like `h-[342px]` count as literals — forbidden outside token definitions.)
2. **Semantic names only:** `bg-primary`, `text-muted-foreground`, `h-control` — never `bg-blue-500`.
3. **Variants in one file:** component variants live in the component's vendored file via cva — not scattered as conditional class strings across usage sites.
4. **Domain ≠ theme:** drawing/pen-table/rebar styling comes from project settings (domain tokens), never from `tokens.css`.
5. **Review check:** searching `src/ui/` for `#[0-9a-fA-F]{3,6}` and `-\[[0-9]` should return hits only in `tokens.css` / `tailwind.config.ts`.
