// Place Wall draft feedback (§B.6): crosshair markers (one grid cell per arm)
// at the cursor and at committed points, plus a translucent preview box
// spanning from the draft start to the cursor. Live cursor motion is applied
// via refs in useFrame — it never touches React state or the store (§E).
import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { Group, LineSegments } from 'three';
import { DEFAULT_WALL_DIMENSIONS } from '@/commands/place-wall';
import type { Vec3 } from '@/data/models';
import { getWallTransform } from '@/engine/wall-geometry';
import { useAppSelector } from '@/stores/hooks';
import { MIN_PREVIEW_LENGTH_MM, PREVIEW_OPACITY } from './constants';
import { getCursorRawPoint } from './cursor-position';
import { CROSSHAIR_RENDER_ORDER, createCrosshairGeometry } from './draft-crosshair';
import { useViewportTheme } from './viewport-theme';

interface PreviewTargets {
  preview: Group | null;
  marker: LineSegments | null;
  isToolActive: boolean;
  committedPoints: Vec3[];
}

function applyDraftFrame({ preview, marker, isToolActive, committedPoints }: PreviewTargets): void {
  const cursor = getCursorRawPoint();
  if (marker) {
    marker.visible = isToolActive && cursor !== null;
    if (cursor) marker.position.set(cursor.x, 0, cursor.z);
  }
  if (!preview) return;
  const startPoint = committedPoints[0] as Vec3 | undefined;
  const endPoint = (committedPoints[1] as Vec3 | undefined) ?? cursor ?? undefined;
  if (!isToolActive || !startPoint || !endPoint) {
    preview.visible = false;
    return;
  }
  const transform = getWallTransform({ startPoint, endPoint, ...DEFAULT_WALL_DIMENSIONS, baseElevation: 0 });
  preview.visible = transform.lengthMm >= MIN_PREVIEW_LENGTH_MM;
  if (!preview.visible) return;
  preview.position.set(transform.center.x, transform.center.y, transform.center.z);
  preview.rotation.set(0, transform.rotationY, 0);
  preview.scale.set(transform.lengthMm, DEFAULT_WALL_DIMENSIONS.height, DEFAULT_WALL_DIMENSIONS.thickness);
}

export function WallDraftPreview() {
  const theme = useViewportTheme();
  const previewRef = useRef<Group>(null);
  const markerRef = useRef<LineSegments>(null);
  const isToolActive = useAppSelector((state) => state.ui.activeTool === 'placeWall');
  const committedPoints = useAppSelector((state) => state.ui.placementDraft.committedPoints);
  const gridSpacingMm = useAppSelector((state) => state.ui.gridSpacingMm);
  const crosshairGeometry = useMemo(() => createCrosshairGeometry(), []);
  useEffect(() => () => crosshairGeometry.dispose(), [crosshairGeometry]);

  useFrame(() => {
    applyDraftFrame({
      preview: previewRef.current,
      marker: markerRef.current,
      isToolActive,
      committedPoints,
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
      <group ref={previewRef} visible={false}>
        <mesh>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial
            color={theme.preview}
            transparent
            opacity={PREVIEW_OPACITY}
            depthWrite={false}
          />
        </mesh>
      </group>
      {committedPoints.map((point, index) => (
        <lineSegments
          key={index}
          geometry={crosshairGeometry}
          position={[point.x, 0, point.z]}
          scale={[gridSpacingMm, 1, gridSpacingMm]}
          renderOrder={CROSSHAIR_RENDER_ORDER}
        >
          <lineBasicMaterial color={theme.snapTarget} depthTest={false} />
        </lineSegments>
      ))}
    </>
  );
}
