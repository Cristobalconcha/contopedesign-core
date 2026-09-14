/**
 * Desarrollo con ventana: levanta Vite, compila main y preload, y abre
 * Electron apuntando al servidor de desarrollo. Cerrar la ventana cierra
 * todo.
 */
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const aqui = dirname(fileURLToPath(import.meta.url));
const raiz = resolve(aqui, '..');
const require = createRequire(import.meta.url);

const servidor = await createServer({ configFile: resolve(raiz, 'vite.config.ts'), root: raiz });
await servidor.listen();
const direccion = servidor.resolvedUrls?.local[0];
if (direccion === undefined) throw new Error('Vite no publicó una dirección local');
console.log(`Renderizador en ${direccion}`);

await import('./empaquetar-electron.mjs');

const electron = spawn(require('electron'), ['.'], {
  cwd: raiz,
  stdio: 'inherit',
  env: { ...process.env, VITE_DEV_SERVER_URL: direccion },
});
electron.on('exit', async () => {
  await servidor.close();
  process.exit(0);
});
