// Place Bar draft feedback (§B.6) — mirrors WallDraftPreview: a crosshair
// marker at the cursor (oriented onto the captured face plane once a face is
// captured) plus an always-on-top preview line showing the future bar
// centerline (offset inward from the face by cover + bar radius). Live cursor
// motion is applied via refs in useFrame — it never touches React state or
// the store (§E).
import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { BufferGeometry, Float32BufferAttribute, type LineSegments, Quaternion, Vector3 } from 'three';
import { DEFAULT_BAR_DIAMETER_MM, resolveDefaultCover } from '@/commands/place-bar';
import type { Vec3, WallElement } from '@/data/models';
import { getWallFaceFrame, resolveBarCenterline } from '@/engine/placement';
import { useAppSelector } from '@/stores/hooks';
import type { PlacementDraft } from '@/stores/ui-slice';
import { getCursorRawPoint } from './cursor-position';
import { CROSSHAIR_RENDER_ORDER, createCrosshairGeometry } from './draft-crosshair';
import { useViewportTheme } from './viewport-theme';

const PREVIEW_LINE_POINTS = 2;
const UP_VECTOR = new Vector3(0, 1, 0);
const scratchNormal = new Vector3();
const scratchQuaternion = new Quaternion();

/** Two-vertex line — endpoints are written imperatively from useFrame. */
function createPreviewLineGeometry(): BufferGeometry {
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(new Float32Array(PREVIEW_LINE_POINTS * 3), 3));
  return geometry;
}

/** Quaternion rotating the ground-plane crosshair onto the face plane. */
function faceOrientation(faceNormal: Vec3): Quaternion {
  scratchNormal.set(faceNormal.x, faceNormal.y, faceNormal.z);
  return scratchQuaternion.setFromUnitVectors(UP_VECTOR, scratchNormal);
}

interface PreviewTargets {
  marker: LineSegments | null;
  line: LineSegments | null;
  isToolActive: boolean;
  draft: PlacementDraft;
  host: WallElement | null;
}

function applyBarDraftFrame({ marker, line, isToolActive, draft, host }: PreviewTargets): void {
  const cursor = getCursorRawPoint();
  const faceNormal = draft.kind === 'bar' ? draft.faceNormal : null;
  if (marker) {
    marker.visible = isToolActive && cursor !== null;
    if (cursor) {
      marker.position.set(cursor.x, cursor.y, cursor.z);
      marker.quaternion.copy(faceNormal ? faceOrientation(faceNormal) : scratchQuaternion.identity());
    }
  }
  if (!line) return;
  const startPoint = draft.committedPoints[draft.committedPoints.length - 1] as Vec3 | undefined;
  const endPoint = cursor ?? undefined;
  if (!isToolActive || !faceNormal || !host || !startPoint || !endPoint) {
    line.visible = false;
    return;
  }
  // Same centerline resolution as the committed path — preview = what you get.
  const [start, end] = resolveBarCenterline({
    facePoints: [startPoint, endPoint],
    frame: getWallFaceFrame(host, faceNormal),
    wall: host,
    coverMm: resolveDefaultCover(host.kind),
    radiusMm: DEFAULT_BAR_DIAMETER_MM / 2,
  }) as [Vec3, Vec3];
  const attribute = line.geometry.getAttribute('position') as Float32BufferAttribute | undefined;
  if (!attribute) return;
  attribute.setXYZ(0, start.x, start.y, start.z);
  attribute.setXYZ(1, end.x, end.y, end.z);
  attribute.needsUpdate = true;
  line.visible = true;
}

interface FaceCrosshairProps {
  geometry: BufferGeometry;
  point: Vec3;
  faceNormal: Vec3 | null;
  gridSpacingMm: number;
  color: string;
}

/** Static crosshair at a committed point, oriented onto the face plane. */
function FaceCrosshair({ geometry, point, faceNormal, gridSpacingMm, color }: FaceCrosshairProps) {
  const ref = useRef<LineSegments>(null);
  useEffect(() => {
    const object = ref.current;
    if (!object) return;
    object.position.set(point.x, point.y, point.z);
    if (faceNormal) object.quaternion.copy(faceOrientation(faceNormal));
  }, [point, faceNormal]);
  return (
    <lineSegments
      ref={ref}
      geometry={geometry}
      scale={[gridSpacingMm, 1, gridSpacingMm]}
      renderOrder={CROSSHAIR_RENDER_ORDER}
    >
      <lineBasicMaterial color={color} depthTest={false} />
    </lineSegments>
  );
}

export function BarDraftPreview() {
  const theme = useViewportTheme();
  const markerRef = useRef<LineSegments>(null);
  const lineRef = useRef<LineSegments>(null);
  const isToolActive = useAppSelector((state) => state.ui.activeTool === 'placeBar');
  const draft = useAppSelector((state) => state.ui.placementDraft);
  const host = useAppSelector((state) =>
    draft.hostElementId ? (state.project.elements[draft.hostElementId] ?? null) : null,
  );
  const gridSpacingMm = useAppSelector((state) => state.ui.gridSpacingMm);
  const crosshairGeometry = useMemo(() => createCrosshairGeometry(), []);
  const previewGeometry = useMemo(() => createPreviewLineGeometry(), []);
  useEffect(() => () => crosshairGeometry.dispose(), [crosshairGeometry]);
  useEffect(() => () => previewGeometry.dispose(), [previewGeometry]);

  useFrame(() => {
    applyBarDraftFrame({
      marker: markerRef.current,
      line: lineRef.current,
      isToolActive,
      draft,
      host,
    });
  });

  return (
    <>
      {/* Cursor crosshair — depthTest off so it reads as a CAD-style overlay. */}
      <lineSegments
        ref={markerRef}
        geometry={crosshairGeometry}
        scale={[gridSpacingMm, 1, gridSpacingMm]}
        renderOrder={CROSSHAIR_RENDER_ORDER}
        visible={false}
      >
        <lineBasicMaterial color={theme.snapTarget} depthTest={false} />
      </lineSegments>
      {/* Centerline preview — depthTest off so it reads through the translucent concrete. */}
      <lineSegments
        ref={lineRef}
        geometry={previewGeometry}
        renderOrder={CROSSHAIR_RENDER_ORDER}
        visible={false}
      >
        <lineBasicMaterial color={theme.preview} depthTest={false} />
      </lineSegments>
      {draft.kind === 'bar' &&
        draft.committedPoints.map((point, index) => (
          <FaceCrosshair
            key={index}
            geometry={crosshairGeometry}
            point={point}
            faceNormal={draft.faceNormal}
            gridSpacingMm={gridSpacingMm}
            color={theme.snapTarget}
          />
        ))}
    </>
  );
}
