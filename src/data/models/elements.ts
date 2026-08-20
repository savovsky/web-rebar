/**
 * Concrete element model (§C — internal model, IFC is import/export only).
 * Elements are parametric: a section through them is a data query, not a mesh
 * slice (§G.1 Tier 1). Dimensions in millimetres.
 */
import type { Vec3 } from './geometry';

/** Union grows at M3/M4: 'slab' | 'beam' | 'column'. */
export type ElementKind = 'wall';

/**
 * Straight wall defined by its axis in plan (X/Y) plus cross-section params.
 * Derived (never stored): length = |endPoint - startPoint|, axis direction,
 * cross-section profile = thickness × height rectangle.
 */
export interface WallElement {
  id: string;
  kind: 'wall';
  /** Axis start point in plan; z is ignored (see baseElevation). */
  startPoint: Vec3;
  /** Axis end point in plan; z is ignored (see baseElevation). */
  endPoint: Vec3;
  /** Wall thickness (mm) — cross-section width perpendicular to the axis. */
  thickness: number;
  /** Wall height (mm) — cross-section height along +Z from baseElevation. */
  height: number;
  /** Bottom-of-wall elevation (mm). Storey reference arrives with M4. */
  baseElevation: number;
}

export type ConcreteElement = WallElement;
