/**
 * Shared geometry primitives for the data model.
 * Model space is millimetres, Z-up right-handed (the engineering convention:
 * plan in X–Y, elevation in Z — identical to IFC/DXF, so the §C adapters carry
 * no rotation). All coordinates are plain numbers — no class instances — so
 * the model stays JSON-serializable (§H.1).
 */

/** 3D point or direction vector in model space (mm). */
export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

/** 2D point in the plan (X–Y) plane of model space (mm) — e.g. reference
 *  linework, which lives at a document elevation instead of carrying z. */
export interface Vec2 {
  x: number;
  y: number;
}

/**
 * Plane in model space: a point on the plane + its unit normal.
 * M0 sections use vertical planes only (normal.z === 0).
 */
export interface Plane {
  origin: Vec3;
  normal: Vec3;
}
