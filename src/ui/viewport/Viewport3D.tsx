// 3D viewport (§B.2 main canvas) — R3F Canvas over a millimetre, Z-up
// right-handed model space (the engineering convention — plan in X–Y,
// elevation in Z; the camera's up axis is set to +Z once, here). Scene config
// lives in ./constants; colors come from design tokens via
// useViewportTheme (doc 10). The transparent canvas lets the bg-viewport token
// surface through from the shell.
import { Canvas } from '@react-three/fiber';
import { BarDraftPreview } from './BarDraftPreview';
import { BarGroupDraftPreview } from './BarGroupDraftPreview';
import { BarsLayer } from './BarsLayer';
import { GroundPlane } from './GroundPlane';
import { ReferenceLayer } from './ReferenceLayer';
import { ReferenceSolidsLayer } from './ReferenceSolidsLayer';
import { SectionCutPreview } from './SectionCutPreview';
import { SectionVolumesLayer } from './SectionVolumesLayer';
import { ViewportControls } from './ViewportControls';
import { ViewportGrid } from './ViewportGrid';
import { WallDraftPreview } from './WallDraftPreview';
import { WallsLayer } from './WallsLayer';
import {
  AMBIENT_INTENSITY,
  CAMERA_FAR_MM,
  CAMERA_FOV,
  CAMERA_NEAR_MM,
  CAMERA_POSITION,
  DIRECTIONAL_INTENSITY,
  DIRECTIONAL_POSITION,
} from './constants';

export function Viewport3D() {
  return (
    <div
      className='h-full w-full'
      onContextMenu={(event) => {
        // Right-drag orbits (§B.6) — suppress the browser context menu.
        event.preventDefault();
      }}
    >
      <Canvas
        camera={{
          position: CAMERA_POSITION,
          up: [0, 0, 1],
          fov: CAMERA_FOV,
          near: CAMERA_NEAR_MM,
          far: CAMERA_FAR_MM,
        }}
      >
        <ambientLight intensity={AMBIENT_INTENSITY} />
        <directionalLight position={DIRECTIONAL_POSITION} intensity={DIRECTIONAL_INTENSITY} />
        <ViewportGrid />
        <ViewportControls />
        <GroundPlane />
        <ReferenceLayer />
        <ReferenceSolidsLayer />
        <WallsLayer />
        <BarsLayer />
        <WallDraftPreview />
        <BarDraftPreview />
        <BarGroupDraftPreview />
        <SectionCutPreview />
        <SectionVolumesLayer />
      </Canvas>
    </div>
  );
}
