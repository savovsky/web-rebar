import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const currentDir = fileURLToPath(new URL('.', import.meta.url));

// Headless tests for the §N command layer (Q2) and later Rust-adjacent TS math.
// Node environment suffices — commands are UI-free by design; no jsdom needed.
export default defineConfig({
  resolve: {
    alias: {
      '@': resolve(currentDir, './src'),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
