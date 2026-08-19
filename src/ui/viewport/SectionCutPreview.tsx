// Section Cut feedback (§B.6): a cursor crosshair, the section line while
// dragging, and — once the line is committed — a live depth-slab rectangle
// from the line to the cursor (the third click's preview). Drawn as an
// always-on-top overlay like the other draft previews; live cursor motion is
// applied via refs in useFrame — it never touches React state or the store (§E).
import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { BufferGeometry, Float32BufferAttribute, type LineSegments } from 'three';
import type { Vec3 } from '@/data/models';
import { planNormalFromLine, sectionPlanRectangle } from '@/engine/section-cut';
import { useAppSelector } from '@/stores/hooks';
import { getCursorRawPoint } from './cursor-position';
import { CROSSHAIR_RENDER_ORDER, createCrosshairGeometry } from './draft-crosshair';
import { useViewportTheme } from './viewport-theme';

const LINE_VERTICES = 2;
const SLAB_VERTICES = 8; // 4 rectangle edges × 2 endpoints
const COMPONENTS_PER_VERTEX = 3;

function createLineGeometry(vertexCount: number): BufferGeometry {
  const geometry = new BufferGeometry();
  geometry.setAttribute(
    'position',
    new Float32BufferAttribute(new Float32Array(vertexCount * COMPONENTS_PER_VERTEX), COMPONENTS_PER_VERTEX),
  );
  return geometry;
}

interface SetVertexOptions {
  attribute: Float32BufferAttribute;
  index: number;
  point: Vec3;
}

const setVertex = ({ attribute, index, point }: SetVertexOptions): void => {
  attribute.setXYZ(index, point.x, point.y, point.z);
  attribute.needsUpdate = true;
};

interface FrameTarget {
  object: LineSegments | null;
  isToolActive: boolean;
}

/** Cursor crosshair follows the raw cursor (ground plane, z = 0). */
function applyMarkerFrame({ object, isToolActive }: FrameTarget): void {
  if (!object) return;
  const cursor = getCursorRawPoint();
  object.visible = isToolActive && cursor !== null;
  if (cursor) object.position.set(cursor.x, cursor.y, 0);
}

interface LineFrameOptions extends FrameTarget {
  committedPoints: Vec3[];
}

/** Section line: drag start → cursor while dragging, then the committed line. */
function applyLineFrame({ object, isToolActive, committedPoints }: LineFrameOptions): void {
  if (!object) return;
  const attribute = object.geometry.getAttribute('position') as Float32BufferAttribute | undefined;
  const lineStart = committedPoints[0] as Vec3 | undefined;
  const lineEnd = (committedPoints[1] as Vec3 | undefined) ?? getCursorRawPoint() ?? undefined;
  const hasLine = isToolActive && attribute !== undefined && lineStart !== undefined && lineEnd !== undefined;
  object.visible = hasLine;
  if (!hasLine || !attribute) return;
  setVertex({ attribute, index: 0, point: lineStart });
  setVertex({ attribute, index: 1, point: lineEnd });
}

/** Depth-slab preview: only once the line is committed (2 points) — the
 *  rectangle stretches from the line to the cursor, flipping sides live. */
function applySlabFrame({ object, isToolActive, committedPoints }: LineFrameOptions): void {
  if (!object) return;
  const attribute = object.geometry.getAttribute('position') as Float32BufferAttribute | undefined;
  const lineStart = committedPoints[0] as Vec3 | undefined;
  const lineEnd = committedPoints[1] as Vec3 | undefined;
  const cursor = getCursorRawPoint();
  const normal = lineStart && lineEnd ? planNormalFromLine(lineStart, lineEnd) : null;
  const hasSlab =
    isToolActive &&
    attribute !== undefined &&
    lineStart !== undefined &&
    lineEnd !== undefined &&
    cursor !== null &&
    normal !== null;
  object.visible = hasSlab;
  if (!hasSlab || !attribute) return;
  const signedDepthMm = (cursor.x - lineStart.x) * normal.x + (cursor.y - lineStart.y) * normal.y;
  const corners = sectionPlanRectangle({ lineStart, lineEnd, normal, viewDepthMm: signedDepthMm });
  for (let edge = 0; edge < corners.length; edge++) {
    setVertex({ attribute, index: edge * 2, point: corners[edge] });
    setVertex({ attribute, index: edge * 2 + 1, point: corners[(edge + 1) % corners.length] });
  }
}

/** Stable empty selection — a fresh [] per call would re-render on every store change. */
const NO_POINTS: Vec3[] = [];

export function SectionCutPreview() {
  const theme = useViewportTheme();
  const markerRef = useRef<LineSegments>(null);
  const lineRef = useRef<LineSegments>(null);
  const slabRef = useRef<LineSegments>(null);
  const isToolActive = useAppSelector((state) => state.ui.activeTool === 'sectionCut');
  const committedPoints = useAppSelector((state) =>
    state.ui.placementDraft.kind === 'section' ? state.ui.placementDraft.committedPoints : NO_POINTS,
  );
  const gridSpacingMm = useAppSelector((state) => state.ui.gridSpacingMm);
  const crosshairGeometry = useMemo(() => createCrosshairGeometry(), []);
  const lineGeometry = useMemo(() => createLineGeometry(LINE_VERTICES), []);
  const slabGeometry = useMemo(() => createLineGeometry(SLAB_VERTICES), []);
  useEffect(() => () => crosshairGeometry.dispose(), [crosshairGeometry]);
  useEffect(() => () => lineGeometry.dispose(), [lineGeometry]);
  useEffect(() => () => slabGeometry.dispose(), [slabGeometry]);

  useFrame(() => {
    applyMarkerFrame({ object: markerRef.current, isToolActive });
    applyLineFrame({ object: lineRef.current, isToolActive, committedPoints });
    applySlabFrame({ object: slabRef.current, isToolActive, committedPoints });
  });

  return (
    <>
      {/* Cursor crosshair — depthTest off so it reads as a CAD-style overlay. */}
      <lineSegments
        ref={markerRef}
        geometry={crosshairGeometry}
        scale={[gridSpacingMm, gridSpacingMm, 1]}
        renderOrder={CROSSHAIR_RENDER_ORDER}
        visible={false}
      >
        <lineBasicMaterial color={theme.snapTarget} depthTest={false} />
      </lineSegments>
      {/* Section line: drag start → cursor, then the committed line. */}
      <lineSegments
        ref={lineRef}
        geometry={lineGeometry}
        renderOrder={CROSSHAIR_RENDER_ORDER}
        visible={false}
      >
        <lineBasicMaterial color={theme.preview} depthTest={false} />
      </lineSegments>
      {/* Depth slab awaiting the third click. */}
      <lineSegments
        ref={slabRef}
        geometry={slabGeometry}
        renderOrder={CROSSHAIR_RENDER_ORDER}
        visible={false}
      >
        <lineBasicMaterial color={theme.preview} depthTest={false} />
      </lineSegments>
    </>
  );
}
