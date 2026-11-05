import { defineConfig } from 'vite';
import { resolve } from 'node:path';

// Test-only bundle: fake chrome API + background router (see test/harness.ts).
export default defineConfig({
  publicDir: false,
  build: {
    outDir: resolve(__dirname, 'test/dist'),
    emptyOutDir: true,
    target: 'chrome120',
    lib: {
      entry: resolve(__dirname, 'test/harness.ts'),
      formats: ['iife'],
      name: 'FinePrintHarness',
      fileName: () => 'harness.js',
    },
  },
});
