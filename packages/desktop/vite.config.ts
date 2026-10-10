import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import type { Plugin } from 'vite';
import { defineConfig } from 'vitest/config';

/**
 * Los dos scripts que carga el generador v7 (`public/trama/generador-v7.html`)
 * junto a él: el motor único (`ContopeTrama`, de `packages/trama/dist`) y el
 * muxer de MP4 que v7 traía de un CDN, ahora desde su dependencia npm. En
 * desarrollo se sirven; al compilar se copian a `dist/trama/`.
 */
const SCRIPTS_DEL_GENERADOR_V7: Readonly<Record<string, string>> = {
  'trama/contope-trama.js': fileURLToPath(new URL('../trama/dist/contope-trama.js', import.meta.url)),
  'trama/mp4-muxer.js': createRequire(import.meta.url).resolve('mp4-muxer'),
};

function scriptsDelGeneradorV7(): Plugin {
  return {
    name: 'contope-scripts-del-generador-v7',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const archivo = SCRIPTS_DEL_GENERADOR_V7[(req.url ?? '').split('?')[0]!.replace(/^\//, '')];
        if (archivo === undefined) return next();
        res.setHeader('Content-Type', 'text/javascript; charset=utf-8');
        res.end(readFileSync(archivo));
      });
    },
    generateBundle() {
      for (const [fileName, archivo] of Object.entries(SCRIPTS_DEL_GENERADOR_V7)) this.emitFile({ type: 'asset', fileName, source: readFileSync(archivo, 'utf8') });
    },
  };
}

/**
 * El renderizador es una aplicación web común: corre en el navegador para
 * revisarla y dentro de Electron para usarla. `base: './'` hace que los
 * archivos compilados se resuelvan por ruta relativa, que es lo que Electron
 * necesita al cargar `dist/index.html` desde disco.
 */
export default defineConfig({
  base: './',
  plugins: [react(), scriptsDelGeneradorV7()],
  resolve: {
    alias: {
      '@contope/core': fileURLToPath(new URL('../core/src/index.ts', import.meta.url)),
      '@contope/trama': fileURLToPath(new URL('../trama/src/index.ts', import.meta.url)),
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
    include: ['src/**/*.test.ts', 'electron/**/*.test.ts'],
  },
});
