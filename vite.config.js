import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: 8190,
    open: true
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets'
  }
});
