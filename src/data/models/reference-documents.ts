/**
 * Reference document model (M2 plan Q3 — imported background linework for the
 * doc-11 tracing workflow; extended at T6.5 with Q7 IFC reference solids). A
 * reference document is INERT by design: it is never edited, picked,
 * sectioned, or fed to any computation (sections, meshes, snapping,
 * validation never read it), and it is deliberately NOT the deferred Layer
 * Model — no freeze/lock/active-layer semantics, no storey binding, no
 * per-entity classification, no compute scoping. The only control is a
 * document-level render-only `visible` flag. Source CAD layer names survive
 * as inert per-primitive tags (information preservation — a future Layer
 * Model MAY group by them).
 *
 * Two content variants, discriminated by `content` (the narrowing keeps
 * solids OUT of every linework consumer at compile time — the T6 finding
 * that snap targets key on ReferencePrimitive kinds becomes a static
 * guarantee):
 * - 'linework': exploded 2D plan primitives (X–Y, model mm) from a DXF file.
 *   Source z is dropped at import; `elevationMm` positions the whole document
 *   when rendered. Only primitives are stored, never the raw source file.
 * - 'solids' (Q7, T6.5): triangulated render-only dummy solids from a foreign
 *   IFC file — typed-array meshes (Float32 positions+normals / Uint32
 *   indices) in world-space model mm + IFC per-part colors. The typed arrays
 *   are a deliberate, dated bend of the §H.1 JSON-clean contract (Q7-a spec
 *   note): they live in ProjectModel so undo snapshots stay
 *   frozen-reference-cheap (the M1 T5 finding); serialization or migration to
 *   OPFS-binary sidecars is decided WITH the §H persistence task.
 */
import type { Vec2 } from './geometry';

/** Where the document came from. Tagged union (M2 plan Q3): the Q3 'dxf'
 *  variant; `{ kind: 'ifc', fileName }` joined at T6.5 (Q7). `content` and
 *  `source.kind` are deliberately independent — the T6 3D-DXF door (DXF
 *  3DFACE/MESH meshes as a solids document) stays open. */
export interface DxfReferenceSource {
  kind: 'dxf';
  /** Original file name (display + provenance). */
  fileName: string;
  /** The $INSUNITS code actually applied at import (override-resolved; 4 = mm). */
  insunits: number;
}

export interface IfcReferenceSource {
  kind: 'ifc';
  /** Original file name (display + provenance). */
  fileName: string;
}

export type ReferenceDocumentSource = DxfReferenceSource | IfcReferenceSource;

interface PrimitiveBase {
  /** Inert source-layer tag (Q3 — information preservation, zero semantics). */
  sourceLayer?: string;
}

export interface ReferenceLinePrimitive extends PrimitiveBase {
  kind: 'line';
  start: Vec2;
  end: Vec2;
}

/** A run of straight segments (bulged DXF segments decompose to arcs instead —
 *  see the dxf-adapter mapping layer). */
export interface ReferencePolylinePrimitive extends PrimitiveBase {
  kind: 'polyline';
  points: Vec2[];
  closed: boolean;
}

/** Circular arc, always normalized to a COUNTERCLOCKWISE sweep from
 *  startAngle to endAngle (possibly wrapping past 2π); angles in radians from
 *  +X. Direction has no meaning for a reference background. */
export interface ReferenceArcPrimitive extends PrimitiveBase {
  kind: 'arc';
  center: Vec2;
  radius: number;
  startAngle: number;
  endAngle: number;
}

export interface ReferenceCirclePrimitive extends PrimitiveBase {
  kind: 'circle';
  center: Vec2;
  radius: number;
}

export type ReferencePrimitive =
  ReferenceLinePrimitive | ReferencePolylinePrimitive | ReferenceArcPrimitive | ReferenceCirclePrimitive;

/** IFC per-part surface color (0..1 RGBA). `null` = the source carried no
 *  presentation style — the renderer falls back to the --reference-solid
 *  design token (Q7: "IFC colors at reduced opacity (token fallback)"). */
export interface ReferenceSolidColor {
  r: number;
  g: number;
  b: number;
  a: number;
}

/** One triangulated part of a foreign IFC product (a product can yield
 *  several parts — one per material/styled item in web-ifc's FlatMesh). All
 *  arrays are world-space, model mm, and shared by REFERENCE into undo
 *  snapshots (never mutated after creation). */
export interface ReferenceSolidPart {
  /** Flat xyz vertex positions (3 per vertex), world space, model mm. */
  positions: Float32Array;
  /** Flat xyz unit normals (3 per vertex), world space. */
  normals: Float32Array;
  /** Triangle indices (3 per triangle) into positions/normals. */
  indices: Uint32Array;
  color: ReferenceSolidColor | null;
}

interface ReferenceDocumentBase {
  id: string;
  /** Display name — defaults to the source file name. */
  name: string;
  source: ReferenceDocumentSource;
  /** Document-level render-only flag (Q3) — stored in the project model, so
   *  it is undoable like every other project mutation. */
  visible: boolean;
}

export interface LineworkReferenceDocument extends ReferenceDocumentBase {
  content: 'linework';
  /** Plan elevation (mm) at which the linework renders (default 0 = ground). */
  elevationMm: number;
  /** Exploded plan linework in model mm. */
  primitives: ReferencePrimitive[];
}

export interface SolidsReferenceDocument extends ReferenceDocumentBase {
  content: 'solids';
  /** Triangulated foreign-product meshes (world-space model mm). */
  solids: ReferenceSolidPart[];
}

/** One imported file = one document = one undoable command (Q3/Q7). */
export type ReferenceDocument = LineworkReferenceDocument | SolidsReferenceDocument;
