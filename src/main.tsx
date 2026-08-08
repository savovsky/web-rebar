import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Provider } from 'react-redux';
import App from './App.tsx';
import { initWasm, wasmSelfTest } from './engine/wasm-bridge';
import './index.css';
import { store } from './stores';

// WASM loads in parallel with first paint; geometry calls (T3/T9) await initWasm() internally.
initWasm()
  .then(() => {
    const { version, probeSum } = wasmSelfTest();
    console.info(`web-rebar core WASM v${version} loaded (round-trip probe: ${probeSum})`);
  })
  .catch((error: unknown) => {
    console.error('Failed to load web-rebar core WASM', error);
  });

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Provider store={store}>
      <App />
    </Provider>
  </StrictMode>,
);
