// Scene/world constants for the 3D viewport (millimetres unless noted).
// These are world-space geometry values, not styling — UI styling tokens live
// in tokens.css (doc 10), element appearance in src/data/appearance.ts.

// eslint-disable-next-line @typescript-eslint/no-magic-numbers -- world-space [x,y,z] triple; the const name carries the meaning
export const CAMERA_POSITION: [number, number, number] = [15000, -15000, 12000];
export const CAMERA_FOV = 50;
export const CAMERA_NEAR_MM = 10;
export const CAMERA_FAR_MM = 500000;
export const AMBIENT_INTENSITY = 0.7;
export const DIRECTIONAL_INTENSITY = 1.5;
// eslint-disable-next-line @typescript-eslint/no-magic-numbers -- world-space [x,y,z] triple; the const name carries the meaning
export const DIRECTIONAL_POSITION: [number, number, number] = [20000, 10000, 30000];

/** Finite hit plane for tool clicks/cursor tracking (the visual grid is infinite). */
export const GROUND_PLANE_SIZE_MM = 400000;
/** Grid plane sits 1 mm below z=0 to avoid z-fighting with wall bottom faces. */
export const GRID_Z_OFFSET_MM = -1;
/** Major grid line every N cells (10 × 100 mm default = 1 m). */
export const GRID_SECTION_EVERY_CELLS = 10;
export const GRID_FADE_DISTANCE_MM = 150000;

/** Pointer travel (px) between down/up that disqualifies a click (drag end). */
export const CLICK_DRAG_TOLERANCE_PX = 5;

/** Shorter drafts render no preview box (zero-length axis guard). */
export const MIN_PREVIEW_LENGTH_MM = 1;
export const PREVIEW_OPACITY = 0.35;

/** Grab-fill opacity of the ACTIVE section wireframe volume (inactive volumes
 *  keep an invisible fill so they stay clickable). */
export const SECTION_VOLUME_FILL_OPACITY = 0.08;

/** Render opacity reduction for IFC reference solids (M2 T6.5, plan Q7 —
 *  "IFC colors at reduced opacity"): ghosted context, never visually
 *  competing with the model. Baked into per-vertex alpha by the engine merge. */
export const REFERENCE_SOLID_OPACITY = 0.65;
/** Corner handle size (mm) on the active section wireframe volume. */
export const SECTION_HANDLE_SIZE_MM = 150;
