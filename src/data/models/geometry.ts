/**
 * Shared geometry primitives for the data model.
 * Model space is millimetres, Y-up (Three.js convention). All coordinates are
 * plain numbers — no class instances — so the model stays JSON-serializable (§H.1).
 */

/** 3D point or direction vector in model space (mm). */
export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

/**
 * Plane in model space: a point on the plane + its unit normal.
 * M0 sections use vertical planes only (normal.y === 0).
 */
export interface Plane {
  origin: Vec3;
  normal: Vec3;
}
