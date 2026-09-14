/**
 * Compila el proceso principal y el preload de Electron a CommonJS con
 * esbuild. Se compilan aparte del renderizador porque corren en Node, no en
 * el navegador, y porque el preload tiene que ser CommonJS para que Electron
 * lo cargue con `contextIsolation` activado.
 */
import { build } from 'esbuild';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const aqui = dirname(fileURLToPath(import.meta.url));
const raiz = resolve(aqui, '..');

const comun = {
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node22',
  external: ['electron'],
  sourcemap: true,
  logLevel: 'info',
};

await build({
  ...comun,
  entryPoints: [resolve(raiz, 'electron/main.ts')],
  outfile: resolve(raiz, 'dist/electron/main.cjs'),
});
await build({
  ...comun,
  entryPoints: [resolve(raiz, 'electron/preload.ts')],
  outfile: resolve(raiz, 'dist/electron/preload.cjs'),
});
