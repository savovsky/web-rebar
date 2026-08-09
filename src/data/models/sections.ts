/**
 * Section view definition (§G). A section is a stored query: the 2D primitives
 * are derived from it + the model on demand, never persisted (§H.2).
 */
import type { Plane, Vec3 } from './geometry';

export interface SectionDefinition {
  id: string;
  /** Display name, e.g. 'S-1'. */
  name: string;
  /**
   * The section line in plan (y ignored) — the stored design intent the 3D
   * wireframe volume and its corner handles edit (§B.6). Invariant:
   * plane.origin === lineStart; the plane normal points into the view depth.
   */
  lineStart: Vec3;
  lineEnd: Vec3;
  /** Cutting plane through the line. M0: vertical planes only (normal.y === 0). */
  plane: Plane;
  /**
   * View depth behind the plane (mm). Geometry within [plane, plane + depth]
   * is drawn as background per drafting convention (§G.2.3 convention-based
   * visibility — dashed lines, no occlusion computation in M0).
   */
  viewDepth: number;
  /** Elements contributing concrete outlines to this section. */
  targetElementIds: string[];
}
