// Section wireframe volumes (§B.6): every section shows in the 3D viewport as
// a wireframe box spanning cut line × view depth × target height. Clicking a
// volume under the Select tool opens it in the 2D panel (setActiveSection);
// the ACTIVE volume is interactive — drag the body to move the section, drag
// any corner handle to stretch its line/depth. Live drags stay in component
// state (§E); the §N reshapeSection command fires once on pointer-up. All
// geometry math lives in engine/section-cut (rule 2).
import { useEffect, useMemo, useState } from 'react';
import type { ThreeEvent } from '@react-three/fiber';
import { BufferGeometry, Float32BufferAttribute } from 'three';
import { DEFAULT_WALL_DIMENSIONS } from '@/commands/place-wall';
import { setActiveSection } from '@/commands/set-active-section';
import type { SectionDefinition, Vec3 } from '@/data/models';
import {
  SECTION_PLAN_CORNERS,
  SECTION_VOLUME_EDGE_INDICES,
  type SectionCorner,
  type SectionDragState,
  type SectionPlanGeometry,
  applySectionDrag,
  groundPointFromRay,
  sectionPlanGeometry,
  sectionVolumeCorners,
  sectionVolumeHeightMm,
  sectionVolumeTransform,
} from '@/engine/section-cut';
import { snapPointToGrid } from '@/engine/snapping';
import { useAppDispatch, useAppSelector } from '@/stores/hooks';
import { CLICK_DRAG_TOLERANCE_PX, SECTION_HANDLE_SIZE_MM, SECTION_VOLUME_FILL_OPACITY } from './constants';
import { CROSSHAIR_RENDER_ORDER } from './draft-crosshair';
import { commitSectionDrag } from './section-volume-drag';
import { useViewportTheme } from './viewport-theme';

const COMPONENTS_PER_VERTEX = 3;

interface UseSectionDragOptions {
  sectionId: string;
  baseGeometry: SectionPlanGeometry;
  isSelectTool: boolean;
  isSnapEnabled: boolean;
  gridSpacingMm: number;
}

interface StartDragOptions {
  event: ThreeEvent<PointerEvent>;
  kind: SectionDragState['kind'];
  corner?: SectionCorner;
}

/** Wireframe drag lifecycle: local live geometry (§E) + one command on pointer-up. */
function useSectionDrag(options: UseSectionDragOptions) {
  const { sectionId, baseGeometry, isSelectTool, isSnapEnabled, gridSpacingMm } = options;
  const dispatch = useAppDispatch();
  const [drag, setDrag] = useState<SectionDragState | null>(null);

  /** Pointer event → snapped plan point via the y=0 ground plane. */
  const groundFromEvent = (event: ThreeEvent<PointerEvent>): Vec3 | null => {
    const raw = groundPointFromRay(
      { x: event.ray.origin.x, y: event.ray.origin.y, z: event.ray.origin.z },
      { x: event.ray.direction.x, y: event.ray.direction.y, z: event.ray.direction.z },
    );
    if (raw === null) return null;
    return isSnapEnabled && !event.nativeEvent.shiftKey ? snapPointToGrid(raw, gridSpacingMm) : raw;
  };

  const startDrag = ({ event, kind, corner }: StartDragOptions): void => {
    if (!isSelectTool) return;
    event.stopPropagation();
    const ground = groundFromEvent(event);
    if (!ground) return;
    (event.target as Element).setPointerCapture(event.nativeEvent.pointerId);
    setDrag({ kind, corner, startGround: ground, currentGround: ground });
  };

  const updateDrag = (event: ThreeEvent<PointerEvent>): void => {
    if (!drag) return;
    const ground = groundFromEvent(event);
    if (ground) setDrag({ ...drag, currentGround: ground });
  };

  const finishDrag = (event: ThreeEvent<PointerEvent>): void => {
    if (!drag) return;
    const target = event.target as Element;
    if (target.hasPointerCapture(event.nativeEvent.pointerId)) {
      target.releasePointerCapture(event.nativeEvent.pointerId);
    }
    const next = applySectionDrag({ geometry: baseGeometry, drag });
    setDrag(null);
    commitSectionDrag({ dispatch, sectionId, base: baseGeometry, next });
  };

  const geometry = (drag && applySectionDrag({ geometry: baseGeometry, drag })) || baseGeometry;
  return { geometry, startDrag, updateDrag, finishDrag };
}

function SectionVolume({ section }: { section: SectionDefinition }) {
  const dispatch = useAppDispatch();
  const theme = useViewportTheme();
  const elements = useAppSelector((state) => state.project.elements);
  const isActive = useAppSelector((state) => state.ui.activeSectionId === section.id);
  const isSelectTool = useAppSelector((state) => state.ui.activeTool === 'select');
  const isSnapEnabled = useAppSelector((state) => state.ui.snapEnabled);
  const gridSpacingMm = useAppSelector((state) => state.ui.gridSpacingMm);
  const baseGeometry = sectionPlanGeometry(section);
  const { geometry, startDrag, updateDrag, finishDrag } = useSectionDrag({
    sectionId: section.id,
    baseGeometry,
    isSelectTool,
    isSnapEnabled,
    gridSpacingMm,
  });
  const heightMm = sectionVolumeHeightMm({ section, elements, fallbackMm: DEFAULT_WALL_DIMENSIONS.height });
  const corners = sectionVolumeCorners({ geometry, heightMm });
  const volumeTransform = sectionVolumeTransform({ geometry, heightMm });

  const edgeGeometry = useMemo(() => {
    const positions = new Float32Array(SECTION_VOLUME_EDGE_INDICES.length * 2 * COMPONENTS_PER_VERTEX);
    SECTION_VOLUME_EDGE_INDICES.forEach(([from, to], edgeIndex) => {
      positions.set(
        [corners[from].x, corners[from].y, corners[from].z],
        edgeIndex * 2 * COMPONENTS_PER_VERTEX,
      );
      positions.set(
        [corners[to].x, corners[to].y, corners[to].z],
        (edgeIndex * 2 + 1) * COMPONENTS_PER_VERTEX,
      );
    });
    const buffer = new BufferGeometry();
    buffer.setAttribute('position', new Float32BufferAttribute(positions, COMPONENTS_PER_VERTEX));
    return buffer;
  }, [corners]);
  useEffect(() => () => edgeGeometry.dispose(), [edgeGeometry]);

  const handleActivateClick = (event: ThreeEvent<MouseEvent>): void => {
    if (!isSelectTool || event.delta > CLICK_DRAG_TOLERANCE_PX) return;
    event.stopPropagation(); // keep the ground plane from clearing the selection
    dispatch(setActiveSection({ sectionId: section.id }));
  };

  return (
    <group>
      <lineSegments geometry={edgeGeometry} renderOrder={CROSSHAIR_RENDER_ORDER}>
        <lineBasicMaterial color={isActive ? theme.preview : theme.gridCell} depthTest={false} />
      </lineSegments>
      {/* Grab/activate fill — invisible for inactive volumes, subtle when active. */}
      <mesh
        position={[volumeTransform.center.x, volumeTransform.center.y, volumeTransform.center.z]}
        rotation-y={volumeTransform.rotationY}
        scale={[volumeTransform.lengthMm, volumeTransform.heightMm, volumeTransform.depthMm]}
        onClick={handleActivateClick}
        onPointerDown={(event) => startDrag({ event, kind: 'move' })}
        onPointerMove={updateDrag}
        onPointerUp={finishDrag}
      >
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial
          color={theme.preview}
          transparent
          opacity={isActive ? SECTION_VOLUME_FILL_OPACITY : 0}
          depthWrite={false}
        />
      </mesh>
      {isActive &&
        isSelectTool &&
        corners.map((point, index) => (
          <mesh
            key={index}
            position={[point.x, point.y, point.z]}
            onPointerDown={(event) =>
              startDrag({
                event,
                kind: 'corner',
                corner: SECTION_PLAN_CORNERS[index % SECTION_PLAN_CORNERS.length],
              })
            }
            onPointerMove={updateDrag}
            onPointerUp={finishDrag}
          >
            <boxGeometry args={[SECTION_HANDLE_SIZE_MM, SECTION_HANDLE_SIZE_MM, SECTION_HANDLE_SIZE_MM]} />
            <meshBasicMaterial color={theme.snapTarget} depthTest={false} />
          </mesh>
        ))}
    </group>
  );
}

export function SectionVolumesLayer() {
  const sections = useAppSelector((state) => state.project.sections);
  return (
    <>
      {Object.values(sections).map((section) => (
        <SectionVolume key={section.id} section={section} />
      ))}
    </>
  );
}
