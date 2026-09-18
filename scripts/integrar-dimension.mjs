// Integra una dimensión nueva del manifiesto en el repo (MAPA.md §6, pasos 2 a 7b).
// Uso: node scripts/integrar-dimension.mjs <N> "<Nombre en pantalla>" <carpeta con los 3 archivos>
// La carpeta trae manifest-v0-dimN.ts, manifest-v0-dimN.test.ts y explicaciones-dimN.snippet.ts
// (el snippet exporta EXPLICACIONES_DIMN con una entrada por requisito).
// Toca exactamente los registros que lista MAPA.md §6 (pasos 2 a 7b): index.ts,
// manifiesto.ts, explicaciones.ts, los dos conteos y el prefijo en primitivas.ts.
// No corre pruebas: eso lo hace el integrador.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const [N, nombre, carpeta] = process.argv.slice(2);
if (!N || !nombre || !carpeta) throw new Error('uso: integrar-dimension.mjs <N> "<Nombre>" <carpeta>');
// La raíz del repo es la carpeta padre de scripts/; REPO en el entorno la cambia
// (sirve para ensayar en un git worktree aparte antes de tocar el árbol real).
const REPO = process.env.REPO ?? path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RM = path.join(REPO, 'packages/core/src/requirement-manifest');
const DOM = path.join(REPO, 'packages/desktop/src/dominio');

const read = (p) => fs.readFileSync(p, 'utf8');
const write = (p, s) => fs.writeFileSync(p, s);

// 1. Archivos del núcleo.
for (const f of [`manifest-v0-dim${N}.ts`, `manifest-v0-dim${N}.test.ts`]) {
  fs.copyFileSync(path.join(carpeta, f), path.join(RM, f));
}
const manifestSrc = read(path.join(RM, `manifest-v0-dim${N}.ts`));
const nuevos = (manifestSrc.match(new RegExp(`id: 'dim${N}\\.req\\d\\d'`, 'g')) ?? []).length;
if (nuevos === 0) throw new Error('el manifiesto no declara ids');

// 2. index.ts: bloque de exports de manifiestos, ordenado por número.
const idxPath = path.join(RM, 'index.ts');
let idx = read(idxPath);
const linea = `export * from './manifest-v0-dim${N}.js';`;
if (!idx.includes(linea)) {
  // Los archivos del repo pueden venir con CRLF: se parte por cualquiera de los dos
  // (el 18-09 la versión anterior no reconoció las líneas con \r y dejó dim4 al final).
  const lines = idx.split(/\r?\n/);
  // \d+ y no \d: desde el 18-09 hay una dimensión de dos dígitos (dim10).
  const exportsManifest = lines.filter((l) => /^export \* from '\.\/manifest-v0-dim\d+\.js';$/.test(l));
  const resto = lines.filter((l) => !/^export \* from '\.\/manifest-v0-dim\d+\.js';$/.test(l));
  exportsManifest.push(linea);
  exportsManifest.sort((a, b) => Number(a.match(/dim(\d+)/)[1]) - Number(b.match(/dim(\d+)/)[1]));
  // Los exports de manifiesto van al final del archivo, después del resto.
  while (resto.length && resto[resto.length - 1] === '') resto.pop();
  idx = [...resto, ...exportsManifest, ''].join('\n');
  write(idxPath, idx);
}

// 3. manifiesto.ts: import, MANIFIESTOS y NOMBRE_DIMENSION, en orden numérico.
const manPath = path.join(DOM, 'manifiesto.ts');
let man = read(manPath);
const constName = `DIM${N}_MANIFEST_V0`;
if (!man.includes(constName)) {
  const ordenar = (arr) => arr.sort((a, b) => Number(a.match(/DIM(\d+)/)[1]) - Number(b.match(/DIM(\d+)/)[1]));
  // import { DIM1_MANIFEST_V0, ... } — reconstruye la lista de DIMx_MANIFEST_V0 dentro del import.
  man = man.replace(/import \{([\s\S]*?)\} from '@contope\/core';/, (m, body) => {
    const items = body.split(',').map((s) => s.trim()).filter(Boolean);
    const dims = ordenar([...items.filter((s) => /^DIM\d+_MANIFEST_V0$/.test(s)), constName]);
    const otros = items.filter((s) => !/^DIM\d+_MANIFEST_V0$/.test(s));
    return `import {\n${[...dims, ...otros].map((s) => `  ${s},`).join('\n')}\n} from '@contope/core';`;
  });
  man = man.replace(/export const MANIFIESTOS: ReadonlyArray<RequirementManifestV0> = \[([\s\S]*?)\];/, (m, body) => {
    const items = ordenar([...body.split(',').map((s) => s.trim()).filter(Boolean), constName]);
    return `export const MANIFIESTOS: ReadonlyArray<RequirementManifestV0> = [\n${items.map((s) => `  ${s},`).join('\n')}\n];`;
  });
  man = man.replace(/export const NOMBRE_DIMENSION: Partial<Record<DimensionId, string>> = \{([\s\S]*?)\};/, (m, body) => {
    const entradas = body.split('\n').map((s) => s.trim()).filter(Boolean);
    entradas.push(`dim${N}: '${nombre}',`);
    entradas.sort((a, b) => Number(a.match(/dim(\d+)/)[1]) - Number(b.match(/dim(\d+)/)[1]));
    return `export const NOMBRE_DIMENSION: Partial<Record<DimensionId, string>> = {\n${entradas.map((s) => `  ${s}`).join('\n')}\n};`;
  });
  write(manPath, man);
}

// 4. explicaciones.ts: pega el bloque del snippet antes del cierre, en orden.
const expPath = path.join(DOM, 'explicaciones.ts');
let exp = read(expPath);
if (!exp.includes(`'dim${N}.req01'`)) {
  const snippet = read(path.join(carpeta, `explicaciones-dim${N}.snippet.ts`));
  const cuerpo = snippet.match(/= \{\n([\s\S]*?)\n\};/);
  if (!cuerpo) throw new Error('snippet sin objeto');
  const entradasNuevas = cuerpo[1];
  // Inserta antes de la primera entrada de una dimensión mayor, o al final.
  const lines = exp.split('\n');
  let insertAt = lines.findIndex((l) => {
    const m = l.match(/^  'dim(\d+)\.req\d\d':/);
    return m && Number(m[1]) > Number(N);
  });
  if (insertAt < 0) insertAt = lines.lastIndexOf('};');
  lines.splice(insertAt, 0, ...entradasNuevas.split('\n'));
  write(expPath, lines.join('\n'));
}

// 5. Conteos.
// Sólo sobre los manifiestos REGISTRADOS en manifiesto.ts: un archivo suelto en el
// árbol no cuenta (medido en el ensayo del 18-09). Y el número de dimensiones
// (porDimension.size) sube con ellos.
const registrados = [...new Set([...read(manPath).matchAll(/DIM(\d+)_MANIFEST_V0/g)].map((m) => m[1]))];
const total = registrados.reduce(
  (acc, d) => acc + (read(path.join(RM, `manifest-v0-dim${d}.ts`)).match(/id: 'dim\d+\.req\d\d'/g) ?? []).length,
  0,
);
{
  const p = path.join(DOM, 'explicaciones.test.ts');
  write(p, read(p).replace(/toHaveLength\(\d+\)/, `toHaveLength(${total})`));
}
{
  const p = path.join(DOM, 'evaluacion.test.ts');
  let s = read(p);
  s = s.replace(/tiene \d+ requisitos/, `tiene ${total} requisitos`);
  s = s.replace(/expect\(e\.total\)\.toBe\(\d+\)/, `expect(e.total).toBe(${total})`);
  s = s.replace(/expect\(e\.porDimension\.size\)\.toBe\(\d+\)/, `expect(e.porDimension.size).toBe(${registrados.length})`);
  write(p, s);
}
// 6. primitivas.ts: cada paquete nuevo necesita una primitiva distinta de 'nada'
// (primitivas.test.ts lo exige). Hasta que exista una primitiva visual propia, la
// honesta es 'texto': un resumen, no un color inventado.
const primPath = path.join(DOM, 'primitivas.ts');
let prim = read(primPath);
const prefijos = [...new Set([...manifestSrc.matchAll(/packageId: 'pkg.([a-z-]+)./g)].map((m) => m[1]))];
for (const pref of prefijos) {
  if (!prim.includes(`startsWith('${pref}.')`)) {
    prim = prim.replace("  return 'nada';", `  // dim${N}: sin primitiva visual propia todavía; se muestra como texto.
  if (p.startsWith('${pref}.')) return 'texto';
  return 'nada';`);
  }
}
write(primPath, prim);
console.log(`dim${N} integrada: ${nuevos} requisitos nuevos, total ${total}`);
