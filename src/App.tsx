// Temporary T3 smoke scene: proves WASM → typed arrays → THREE.BufferGeometry → render.
// Replaced by the real app shell + Viewport3D in T6/T7.
import { useEffect, useMemo, useState } from 'react';
import { Bounds, OrbitControls } from '@react-three/drei';
import { Canvas } from '@react-three/fiber';
import { createTestBarGeometry } from './engine/bar-geometry';
import { initWasm } from './engine/wasm-bridge';

function App() {
  const [isWasmReady, setIsWasmReady] = useState(false);
  useEffect(() => {
    let isMounted = true;
    initWasm()
      .then(() => {
        if (isMounted) setIsWasmReady(true);
      })
      .catch((error: unknown) => {
        console.error('Failed to load web-rebar core WASM', error);
      });
    return () => {
      isMounted = false;
    };
  }, []);

  const testGeometry = useMemo(() => (isWasmReady ? createTestBarGeometry() : null), [isWasmReady]);
  useEffect(() => () => testGeometry?.dispose(), [testGeometry]);

  return (
    <div className='w-screen h-screen'>
      <Canvas>
        <color attach='background' args={['#101018']} />
        <ambientLight />
        <directionalLight />
        <Bounds fit clip observe>
          {testGeometry ? (
            <mesh geometry={testGeometry}>
              <meshStandardMaterial color='#c8842a' />
            </mesh>
          ) : null}
        </Bounds>
        <OrbitControls />
      </Canvas>
    </div>
  );
}

export default App;
