import { defineConfig } from 'vite';
import { resolve } from 'node:path';

// The service worker is bundled into one self-contained file (service workers
// forbid dynamic import(), so this avoids any surprise chunks).
export default defineConfig({
  publicDir: false,
  build: {
    outDir: resolve(__dirname, 'dist'),
    emptyOutDir: false,
    target: 'chrome120',
    minify: 'esbuild',
    lib: {
      entry: resolve(__dirname, 'src/background/index.ts'),
      formats: ['es'],
      fileName: () => 'background.js',
    },
    rollupOptions: { output: { inlineDynamicImports: true } },
  },
});
