import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

/**
 * El renderizador es una aplicación web común: corre en el navegador para
 * revisarla y dentro de Electron para usarla. `base: './'` hace que los
 * archivos compilados se resuelvan por ruta relativa, que es lo que Electron
 * necesita al cargar `dist/index.html` desde disco.
 */
export default defineConfig({
  base: './',
  plugins: [react()],
  resolve: {
    alias: {
      '@contope/core': fileURLToPath(new URL('../core/src/index.ts', import.meta.url)),
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: false,
    target: 'es2023',
  },
  server: {
    port: 5180,
    strictPort: true,
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
