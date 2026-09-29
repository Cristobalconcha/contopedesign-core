/**
 * Los datos compilados de la Biblia. El JSON lo escribe `pnpm biblia:compilar`
 * (scripts/biblia/compilar.mjs) y se importa como módulo: nada de `node:fs`,
 * para que el mismo código sirva en el renderizador (Vite), en Electron
 * (esbuild) y en las pruebas (Vitest). Los tres empaquetan JSON sin plugin.
 *
 * El `as` es la frontera: TypeScript infiere `string` donde el archivo trae
 * literales (`'cortapisa'`, `'web'`…). La prueba `biblia.test.ts` comprueba que
 * todos los valores estén dentro de las constantes cerradas de `tipos.ts`.
 */
import datos from './biblia.generada.json';
import type { BibliaGenerada } from './tipos.js';

export const BIBLIA: BibliaGenerada = datos as BibliaGenerada;
