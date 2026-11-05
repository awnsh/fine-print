import { defineConfig } from 'vite';
import { resolve } from 'node:path';

// Extension pages (popup, options, offscreen). The content script is built
// separately: content scripts can't be ES modules, and the service worker is kept as one file.
export default defineConfig({
  root: resolve(__dirname, 'src'),
  publicDir: resolve(__dirname, 'public'),
  base: '',
  build: {
    outDir: resolve(__dirname, 'dist'),
    emptyOutDir: true,
    target: 'chrome120',
    modulePreload: false,
    rollupOptions: {
      input: {
        popup: resolve(__dirname, 'src/popup/index.html'),
        options: resolve(__dirname, 'src/options/index.html'),
        offscreen: resolve(__dirname, 'src/offscreen/index.html'),
      },
    },
  },
});
