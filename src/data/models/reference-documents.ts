/**
 * Reference document model (M2 plan Q3 — imported background linework for the
 * doc-11 tracing workflow). A reference document is INERT by design: it is
 * never edited, picked, sectioned, or fed to any computation (sections,
 * meshes, validation never read it), and it is deliberately NOT the deferred
 * Layer Model — no freeze/lock/active-layer semantics, no storey binding, no
 * per-entity classification, no compute scoping. The only control is a
 * document-level render-only `visible` flag. Source CAD layer names survive
 * as inert per-primitive tags (information preservation — a future Layer
 * Model MAY group by them).
 *
 * Geometry is plan linework (X–Y) in model millimetres, exploded and
 * unit-converted at import time — only primitives are stored, never the raw
 * source file, keeping the record JSON-clean (§H.1). Source z is dropped at
 * import; `elevationMm` positions the whole document when rendered (T6).
 */
import type { Vec2 } from './geometry';

/** Where the document came from. Tagged union (M2 plan Q3): the 'dxf' variant
 *  is built at T5; `{ kind: 'ifc', fileName }` joins it at T6.5 (Q7 — foreign
 *  IFC reference solids). */
export interface DxfReferenceSource {
  kind: 'dxf';
  /** Original file name (display + provenance). */
  fileName: string;
  /** The $INSUNITS code actually applied at import (override-resolved; 4 = mm). */
  insunits: number;
}

export type ReferenceDocumentSource = DxfReferenceSource;

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

/** One imported file = one document = one undoable command (Q3). */
export interface ReferenceDocument {
  id: string;
  /** Display name — defaults to the source file name. */
  name: string;
  source: ReferenceDocumentSource;
  /** Plan elevation (mm) at which the linework renders (default 0 = ground). */
  elevationMm: number;
  /** Document-level render-only flag (Q3) — stored in the project model, so
   *  it is undoable like every other project mutation. */
  visible: boolean;
  /** Exploded plan linework in model mm. */
  primitives: ReferencePrimitive[];
}
