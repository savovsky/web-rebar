/**
 * M2 T5 — reference-primitive emission for the DXF mapping layer: the shared
 * emit context, the arc/circle representability verdict (a curve survives a
 * general transform only as a plan-preserving similarity — exact for
 * rotation/translation/uniform scale plus the (0,0,-1) mirror), the bulge →
 * arc math (Q4), and the polyline emitter with straight-run coalescing.
 * Entity-level dispatch lives in dxf-mapping.ts (this module's DxfImportSkips
 * import is TYPE-only — erased, so the runtime graph stays affine ←
 * primitives ← mapping ← adapter).
 */
import type { ReferencePrimitive, Vec2, Vec3 } from '@/data/models';
import { type Affine3, applyAffinePoint } from './dxf-affine';
import type { DxfImportSkips } from './dxf-mapping';

/** Shared emit context: the sink for primitives and the skip counters. */
export interface EmitContext {
  out: ReferencePrimitive[];
  skipped: DxfImportSkips;
}

export const bumpUnsupported = (skipped: DxfImportSkips, key: string): void => {
  skipped.unsupportedEntities[key] = (skipped.unsupportedEntities[key] ?? 0) + 1;
};

export const point3 = (p: { x?: number; y?: number; z?: number }): Vec3 => ({
  x: p.x ?? 0,
  y: p.y ?? 0,
  z: p.z ?? 0,
});

export const planPoint = (affine: Affine3, local: Vec3): Vec2 => {
  const world = applyAffinePoint(affine, local);
  return { x: world.x, y: world.y };
};

const DEFAULT_LAYER_NAME = '0';

/** Layer '0' on block content inherits the INSERT's layer (DXF ByBlock
 *  convention — otherwise most real block linework would tag as '0'). */
export function resolveSourceLayer(
  entityLayer: string | undefined,
  inheritLayer: string | undefined,
): string | undefined {
  if (entityLayer === undefined || entityLayer === DEFAULT_LAYER_NAME) return inheritLayer ?? entityLayer;
  return entityLayer;
}

export const withSourceLayer = (layer: string | undefined): { sourceLayer?: string } =>
  layer === undefined ? {} : { sourceLayer: layer };

export const isZeroLength = (from: Vec3, to: Vec3): boolean =>
  from.x === to.x && from.y === to.y && from.z === to.z;

// ---------------------------------------------------------------------------
// Curve representability: circular only when the composed map is a
// plan-preserving similarity (uniform |scale|, orthogonal columns, horizontal
// plane).
// ---------------------------------------------------------------------------

/** Relative tolerances for the arc/circle representability checks. */
const CURVE_TILT_TOLERANCE = 1e-6;
const SIMILARITY_TOLERANCE = 1e-6;

interface CurveBasisVerdict {
  isRepresentable: boolean;
  isTilted: boolean;
  /** Plan length of the first basis column (the radius scale). */
  planScale: number;
  colX: Vec3;
  colY: Vec3;
}

function checkCurveBasis(affine: Affine3): CurveBasisVerdict {
  const colX = affine.xAxis;
  const colY = affine.yAxis;
  const planX = Math.hypot(colX.x, colX.y);
  const planY = Math.hypot(colY.x, colY.y);
  const planScale = Math.max(planX, planY);
  if (planScale === 0) return { isRepresentable: false, isTilted: false, planScale, colX, colY };
  const tilt = Math.hypot(colX.z, colY.z);
  if (tilt > CURVE_TILT_TOLERANCE * planScale) {
    return { isRepresentable: false, isTilted: true, planScale, colX, colY };
  }
  const dot = colX.x * colY.x + colX.y * colY.y;
  const isSimilar =
    Math.abs(planX - planY) <= SIMILARITY_TOLERANCE * planScale &&
    Math.abs(dot) <= SIMILARITY_TOLERANCE * planX * planY;
  return { isRepresentable: isSimilar, isTilted: false, planScale, colX, colY };
}

/** The plan angle of the image of the local direction (cos α, sin α). */
const mapAngle = ({ colX, colY, alpha }: { colX: Vec3; colY: Vec3; alpha: number }): number =>
  Math.atan2(
    Math.cos(alpha) * colX.y + Math.sin(alpha) * colY.y,
    Math.cos(alpha) * colX.x + Math.sin(alpha) * colY.x,
  );

/** A local circular arc; also the emit shape for circles (angles unused). */
export interface LocalCurve {
  /** Local center (z = plane elevation). */
  center: Vec3;
  radius: number;
  /** Radians, CCW, local frame — arcs only. */
  startAngle: number;
  endAngle: number;
  layer: string | undefined;
}

interface CurveEmitRequest {
  context: EmitContext;
  affine: Affine3;
  curve: LocalCurve;
}

const countCurveSkip = (skipped: DxfImportSkips, verdict: CurveBasisVerdict): void => {
  if (verdict.isTilted) skipped.tiltedCurves += 1;
  else skipped.nonUniformScaledCurves += 1;
};

export function emitArc({ context, affine, curve }: CurveEmitRequest): void {
  const verdict = checkCurveBasis(affine);
  if (!verdict.isRepresentable) {
    countCurveSkip(context.skipped, verdict);
    return;
  }
  const center = applyAffinePoint(affine, curve.center);
  const startAngle = mapAngle({ colX: verdict.colX, colY: verdict.colY, alpha: curve.startAngle });
  const endAngle = mapAngle({ colX: verdict.colX, colY: verdict.colY, alpha: curve.endAngle });
  // A mirrored basis (determinant < 0) turns the CCW sweep clockwise —
  // renormalize to the CCW-stored convention by swapping the endpoints.
  const isMirrored = verdict.colX.x * verdict.colY.y - verdict.colX.y * verdict.colY.x < 0;
  context.out.push({
    kind: 'arc',
    center: { x: center.x, y: center.y },
    radius: curve.radius * verdict.planScale,
    startAngle: isMirrored ? endAngle : startAngle,
    endAngle: isMirrored ? startAngle : endAngle,
    ...withSourceLayer(curve.layer),
  });
}

export function emitCircle({ context, affine, curve }: CurveEmitRequest): void {
  const verdict = checkCurveBasis(affine);
  if (!verdict.isRepresentable) {
    countCurveSkip(context.skipped, verdict);
    return;
  }
  const center = applyAffinePoint(affine, curve.center);
  context.out.push({
    kind: 'circle',
    center: { x: center.x, y: center.y },
    radius: curve.radius * verdict.planScale,
    ...withSourceLayer(curve.layer),
  });
}

// ---------------------------------------------------------------------------
// Bulge → arc (Q4): bulge b = tan(θ/4) with θ the signed included angle
// (b > 0 ⇔ CCW from start to end). For b > 0 the center sits LEFT of the
// directed chord at distance r − s (sagitta s = |b|·c/2, radius
// r = c·(1+b²)/(4|b|)); b < 0 mirrors that and swaps the stored angles to
// keep the CCW convention.
// ---------------------------------------------------------------------------

/** Bulges below this are numerically indistinguishable from a straight segment. */
const BULGE_EPSILON = 1e-12;

interface BulgeArcResult {
  center: Vec2;
  radius: number;
  startAngle: number;
  endAngle: number;
}

function bulgeToArc({ from, to, bulge }: { from: Vec3; to: Vec3; bulge: number }): BulgeArcResult {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const chord = Math.hypot(dx, dy);
  const sagitta = (Math.abs(bulge) * chord) / 2;
  const radius = (chord * (1 + bulge * bulge)) / (4 * Math.abs(bulge));
  const centerDistance = radius - sagitta;
  const sign = bulge > 0 ? 1 : -1;
  const center = {
    x: (from.x + to.x) / 2 + (sign * -dy * centerDistance) / chord,
    y: (from.y + to.y) / 2 + (sign * dx * centerDistance) / chord,
  };
  const angleAt = (p: Vec3): number => Math.atan2(p.y - center.y, p.x - center.x);
  return {
    center,
    radius,
    startAngle: bulge > 0 ? angleAt(from) : angleAt(to),
    endAngle: bulge > 0 ? angleAt(to) : angleAt(from),
  };
}

// ---------------------------------------------------------------------------
// Polylines: no bulges → ONE polyline primitive (the common case, exact);
// bulged → segment decomposition with straight runs re-coalescing.
// ---------------------------------------------------------------------------

export interface LocalPolylineVertex extends Vec3 {
  bulge: number;
}

interface PolylineEmitRequest {
  context: EmitContext;
  affine: Affine3;
  vertices: LocalPolylineVertex[];
  closed: boolean;
  layer: string | undefined;
  /** DXF type name for the degenerate-skip count key. */
  typeName: string;
}

export function emitPolyline({
  context,
  affine,
  vertices,
  closed,
  layer,
  typeName,
}: PolylineEmitRequest): void {
  if (vertices.length < 2) {
    bumpUnsupported(context.skipped, `${typeName} (degenerate)`);
    return;
  }
  const hasBulge = vertices.some((vertex) => Math.abs(vertex.bulge) >= BULGE_EPSILON);
  if (!hasBulge) {
    context.out.push({
      kind: 'polyline',
      points: vertices.map((vertex) => planPoint(affine, vertex)),
      closed,
      ...withSourceLayer(layer),
    });
    return;
  }
  let run: Vec2[] = [];
  const flushRun = (): void => {
    if (run.length === 2) {
      context.out.push({ kind: 'line', start: run[0], end: run[1], ...withSourceLayer(layer) });
    } else if (run.length > 2) {
      context.out.push({ kind: 'polyline', points: run, closed: false, ...withSourceLayer(layer) });
    }
    run = [];
  };
  const segmentCount = closed ? vertices.length : vertices.length - 1;
  for (let index = 0; index < segmentCount; index += 1) {
    const from = vertices[index];
    const to = vertices[(index + 1) % vertices.length];
    if (isZeroLength(from, to)) {
      context.skipped.degenerateSegments += 1;
      continue;
    }
    if (Math.abs(from.bulge) < BULGE_EPSILON) {
      if (run.length === 0) run.push(planPoint(affine, from));
      run.push(planPoint(affine, to));
    } else {
      flushRun();
      const arc = bulgeToArc({ from, to, bulge: from.bulge });
      emitArc({
        context,
        affine,
        curve: {
          center: { x: arc.center.x, y: arc.center.y, z: from.z },
          radius: arc.radius,
          startAngle: arc.startAngle,
          endAngle: arc.endAngle,
          layer,
        },
      });
    }
  }
  flushRun();
}
