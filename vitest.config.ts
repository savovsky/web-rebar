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
    // Worker cap (M3 T7, contention fix): the suite carries WALL-TIME budget
    // probes (m1/m3-performance, ifc-solids real-file) whose median-asserted
    // tripwires flake when ~cores forks oversubscribe a machine that is
    // legitimately busy (the author works in parallel — Rule 8; Chrome/
    // Code/dev servers sit at ~70% CPU). Unlimited forks ALSO re-transform
    // everything per fork (~100 s redundant transform here). '25%' gives
    // each fork ~one free core even under that load: gates green AND faster
    // (40 s vs 50 s wall on the author's machine) — no budget/tripwire
    // touched, runner capacity only.
    maxWorkers: '25%',
  },
});
