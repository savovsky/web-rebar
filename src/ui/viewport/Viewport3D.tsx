// 3D viewport (§B.2 main canvas) — R3F Canvas over a millimetre, Y-up model
// space. Scene config lives in ./constants; colors come from design tokens via
// useViewportTheme (doc 10). The transparent canvas lets the bg-viewport token
// surface through from the shell.
import { Canvas } from '@react-three/fiber';
import { BarDraftPreview } from './BarDraftPreview';
import { BarsLayer } from './BarsLayer';
import { GroundPlane } from './GroundPlane';
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
        camera={{ position: CAMERA_POSITION, fov: CAMERA_FOV, near: CAMERA_NEAR_MM, far: CAMERA_FAR_MM }}
      >
        <ambientLight intensity={AMBIENT_INTENSITY} />
        <directionalLight position={DIRECTIONAL_POSITION} intensity={DIRECTIONAL_INTENSITY} />
        <ViewportGrid />
        <ViewportControls />
        <GroundPlane />
        <WallsLayer />
        <BarsLayer />
        <WallDraftPreview />
        <BarDraftPreview />
      </Canvas>
    </div>
  );
}
