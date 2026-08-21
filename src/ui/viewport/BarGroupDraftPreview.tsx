// Place Bar Group draft feedback (§B.6 / §F.2, M3 T4) — the BarDraftPreview
// pattern: a face-oriented crosshair at the cursor plus an always-on-top
// line-segment preview of the GENERATED bars (centerlines — in-task decision,
// same visual language as the single-bar preview). The preview math calls the
// T2 engine (generateBarGroupPaths) every frame: the live corner (drag anchor
// or click-click corner A) against the cursor, else the last defined region,
// else the whole-face default (Q4-a) — drags AND Properties-panel edits both
// regenerate at frame rate; the Enter/Space key commits (author decision
// 2026-08-21). Invalid mid-edit params hide the preview (the commit explains
// itself via the status hint). Preallocated buffer + drawRange — never React
// state (§E).
import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { BufferGeometry, Float32BufferAttribute, type LineSegments } from 'three';
import type { ElementFaceKey, Vec3, WallElement } from '@/data/models';
import { generateBarGroupPaths, resolveGroupRegion } from '@/engine/placement-group';
import { useAppSelector } from '@/stores/hooks';
import { getBarGroupParams } from './bar-group-params';
import { getCursorRawPoint } from './cursor-position';
import { CROSSHAIR_RENDER_ORDER, createCrosshairGeometry, faceOrientation } from './draft-crosshair';
import { getDefinedRegion, getPendingCorner, getRegionAnchor } from './place-bar-group-draft';
import { useViewportTheme } from './viewport-theme';

/** Preview cap (bars) — drawRange truncates beyond it; the commit is unaffected. */
const MAX_PREVIEW_BARS = 1024;
const COMPONENTS_PER_POINT = 3;
const ENDPOINTS_PER_BAR = 2;

/** Preallocated line-segment buffer — one segment (2 vertices) per bar. */
function createBarsGeometry(): BufferGeometry {
  const geometry = new BufferGeometry();
  geometry.setAttribute(
    'position',
    new Float32BufferAttribute(
      new Float32Array(MAX_PREVIEW_BARS * ENDPOINTS_PER_BAR * COMPONENTS_PER_POINT),
      3,
    ),
  );
  return geometry;
}

interface CrosshairFrameOptions {
  marker: LineSegments | null;
  isActive: boolean;
  faceNormal: Vec3 | null;
  cursor: Vec3 | null;
}

function applyCrosshairFrame({ marker, isActive, faceNormal, cursor }: CrosshairFrameOptions): void {
  if (!marker) return;
  marker.visible = isActive && cursor !== null;
  if (cursor && faceNormal) {
    marker.position.set(cursor.x, cursor.y, cursor.z);
    marker.quaternion.copy(faceOrientation(faceNormal));
  }
}

/** Current draft region + rule → generated centerlines; null when the
 *  mid-edit params are insane (engine validation — the commit reports the
 *  same message in the status bar, the T3 CommandError mapping). Region
 *  priority: the live corner (drag anchor / click-click corner A) against
 *  the cursor; then the last defined region; else the whole face (Q4-a). */
function previewPaths(options: {
  host: WallElement;
  faceKey: ElementFaceKey;
  cursor: Vec3 | null;
}): Vec3[][] | null {
  const { host, faceKey, cursor } = options;
  const liveCorner = getRegionAnchor() ?? getPendingCorner();
  const region =
    liveCorner !== null
      ? resolveGroupRegion({ host, faceKey, cornerA: liveCorner, cornerB: cursor ?? liveCorner })
      : (getDefinedRegion() ?? resolveGroupRegion({ host, faceKey, cornerA: null, cornerB: null }));
  try {
    return generateBarGroupPaths({ host, faceKey, region, ...getBarGroupParams() });
  } catch {
    return null;
  }
}

/** Writes the generated centerlines into the preallocated segment buffer. */
function writeBarsFrame(lines: LineSegments, paths: Vec3[][]): void {
  const attribute = lines.geometry.getAttribute('position') as Float32BufferAttribute | undefined;
  if (!attribute) return;
  const barCount = Math.min(paths.length, MAX_PREVIEW_BARS);
  for (let bar = 0; bar < barCount; bar++) {
    const [start, end] = paths[bar] as [Vec3, Vec3];
    attribute.setXYZ(bar * ENDPOINTS_PER_BAR, start.x, start.y, start.z);
    attribute.setXYZ(bar * ENDPOINTS_PER_BAR + 1, end.x, end.y, end.z);
  }
  attribute.needsUpdate = true;
  lines.geometry.setDrawRange(0, barCount * ENDPOINTS_PER_BAR);
  lines.visible = barCount > 0;
}

interface PreviewTargets {
  marker: LineSegments | null;
  lines: LineSegments | null;
  isToolActive: boolean;
  isDraftActive: boolean;
  faceKey: ElementFaceKey | null;
  faceNormal: Vec3 | null;
  host: WallElement | null;
}

function applyBarGroupDraftFrame(targets: PreviewTargets): void {
  const { marker, lines, isToolActive, isDraftActive, faceKey, faceNormal, host } = targets;
  const cursor = getCursorRawPoint();
  applyCrosshairFrame({ marker, isActive: isToolActive && isDraftActive, faceNormal, cursor });
  if (!lines) return;
  const paths =
    isToolActive && isDraftActive && faceKey !== null && host !== null
      ? previewPaths({ host, faceKey, cursor })
      : null;
  if (paths === null) {
    lines.visible = false;
    return;
  }
  writeBarsFrame(lines, paths);
}

export function BarGroupDraftPreview() {
  const theme = useViewportTheme();
  const markerRef = useRef<LineSegments>(null);
  const linesRef = useRef<LineSegments>(null);
  const isToolActive = useAppSelector((state) => state.ui.activeTool === 'placeBarGroup');
  const draft = useAppSelector((state) => state.ui.placementDraft);
  const host = useAppSelector((state) =>
    draft.hostElementId ? (state.project.elements[draft.hostElementId] ?? null) : null,
  );
  const gridSpacingMm = useAppSelector((state) => state.ui.gridSpacingMm);
  const crosshairGeometry = useMemo(() => createCrosshairGeometry(), []);
  const barsGeometry = useMemo(() => createBarsGeometry(), []);
  useEffect(() => () => crosshairGeometry.dispose(), [crosshairGeometry]);
  useEffect(() => () => barsGeometry.dispose(), [barsGeometry]);

  const isDraftActive = draft.kind === 'barGroup';
  const faceKey = isDraftActive ? draft.faceKey : null;
  const faceNormal = isDraftActive ? draft.faceNormal : null;

  useFrame(() => {
    applyBarGroupDraftFrame({
      marker: markerRef.current,
      lines: linesRef.current,
      isToolActive,
      isDraftActive,
      faceKey,
      faceNormal,
      host,
    });
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
      {/* Generated bars preview — depthTest off so it reads through the concrete. */}
      <lineSegments
        ref={linesRef}
        geometry={barsGeometry}
        renderOrder={CROSSHAIR_RENDER_ORDER}
        visible={false}
      >
        <lineBasicMaterial color={theme.preview} depthTest={false} />
      </lineSegments>
    </>
  );
}
