import { defineConfig } from 'vite';

export default defineConfig({
  root: 'web',
  base: './',
  clearScreen: false,
  server: {
    host: '127.0.0.1',
    port: 4173,
    strictPort: true
  },
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    target: 'es2020',
    sourcemap: false
  }
});
