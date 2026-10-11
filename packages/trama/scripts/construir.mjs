/**
 * Construye `packages/trama/dist/`: lo que ContOpe Publisher trae.
 *
 *   contope-trama.js         IIFE sin dependencias: `ContopeTrama` en window
 *                            y en module.exports (motor, dibujo, línea de
 *                            tiempo, formato, protocolo del worker).
 *   contope-trama-worker.js  worker autónomo con el motor adentro.
 *   MOTOR.json               versiones (paquete, motor, formato), sha256 y
 *                            bytes de cada archivo, y fecha.
 *   package.json             sólo `"type": "commonjs"`, para que Node lea
 *                            dist/ como script y no como módulo ES. No se
 *                            lleva a Publisher.
 *
 * Usa esbuild (ya estaba en el monorepo como dependencia del escritorio y en
 * `onlyBuiltDependencies`; el paquete lo declara como devDependency propia).
 * La salida es determinista: el mismo código da los mismos bytes. La fecha
 * de MOTOR.json sólo cambia si cambia algún archivo.
 *
 *   node scripts/construir.mjs              construye y escribe
 *   node scripts/construir.mjs --verificar  construye en memoria y falla
 *                                           (código 1) si dist/ quedó viejo
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { build } from 'esbuild';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(raiz, 'dist');
const paquete = JSON.parse(readFileSync(join(raiz, 'package.json'), 'utf8'));
const verificar = process.argv.includes('--verificar');

const cabecera = (que) =>
  `/* ${paquete.name} ${paquete.version} — ${que}\n` +
  ` * Generado desde packages/trama/src con \`pnpm trama:construir\` (contopedesign-core). No editar a mano:\n` +
  ` * Publisher lo trae tal cual y verifica su sha256 contra MOTOR.json. */`;

async function empaquetar(entrada, opciones) {
  const r = await build({
    entryPoints: [join(raiz, entrada)],
    bundle: true,
    write: false,
    format: 'iife',
    platform: 'neutral',
    target: 'es2018',
    charset: 'utf8',
    legalComments: 'none',
    minify: false,
    logLevel: 'silent',
    ...opciones,
  });
  return r.outputFiles[0].text;
}

const sha256 = (texto) => createHash('sha256').update(texto, 'utf8').digest('hex');

const principal = await empaquetar('src/entradas/global.ts', {
  globalName: 'ContopeTrama',
  banner: { js: cabecera('motor, línea de tiempo y formato de las tramas') },
  footer: { js: 'if (typeof module === "object" && module && module.exports) module.exports = ContopeTrama;' },
});
const worker = await empaquetar('src/entradas/worker.ts', {
  banner: { js: cabecera('worker de tramas (autónomo: new Worker(\'contope-trama-worker.js\'))') },
});

// las versiones salen del paquete recién construido, no de una copia a mano
const ambito = { module: { exports: {} } };
vm.runInNewContext(principal, ambito);
const T = ambito.module.exports;

const archivos = { 'contope-trama.js': principal, 'contope-trama-worker.js': worker };
const huellas = Object.fromEntries(
  Object.entries(archivos).map(([nombre, texto]) => [nombre, { sha256: sha256(texto), bytes: Buffer.byteLength(texto, 'utf8') }]),
);

const rutaMotor = join(dist, 'MOTOR.json');
const anterior = existsSync(rutaMotor) ? JSON.parse(readFileSync(rutaMotor, 'utf8')) : null;
const iguales = anterior && JSON.stringify(anterior.archivos) === JSON.stringify(huellas);
const motor = {
  paquete: { nombre: paquete.name, version: paquete.version },
  motor: { id: T.MOTOR_ID, version: T.MOTOR_VERSION },
  formato: { kind: T.TRAMA_KIND, version: T.FORMATO_VERSION },
  codigos: { compacto: T.PREFIJO_CODIGO.slice(0, -1), compatibles: [T.PREFIJO_SP1.slice(0, -1)] },
  archivos: huellas,
  fecha: iguales ? anterior.fecha : new Date().toISOString(),
};

if (verificar) {
  const viejos = Object.entries(archivos).filter(([nombre, texto]) => {
    const ruta = join(dist, nombre);
    return !existsSync(ruta) || readFileSync(ruta, 'utf8') !== texto || anterior?.archivos?.[nombre]?.sha256 !== sha256(texto);
  });
  const versiones = anterior && JSON.stringify([anterior.paquete, anterior.motor, anterior.formato]) === JSON.stringify([motor.paquete, motor.motor, motor.formato]);
  if (viejos.length || !versiones) {
    console.error(`dist/ quedó viejo${viejos.length ? `: ${viejos.map(([n]) => n).join(', ')}` : ' (versiones de MOTOR.json)'}. Corre \`pnpm trama:construir\`.`);
    process.exit(1);
  }
  console.log('dist/ al día con el código.');
} else {
  mkdirSync(dist, { recursive: true });
  // el paquete es "type": "module"; dist/ es CommonJS/IIFE (para que require() vea module.exports)
  writeFileSync(join(dist, 'package.json'), '{\n  "type": "commonjs"\n}\n');
  for (const [nombre, texto] of Object.entries(archivos)) writeFileSync(join(dist, nombre), texto);
  writeFileSync(rutaMotor, JSON.stringify(motor, null, 2) + '\n');
  for (const [nombre, h] of Object.entries(huellas)) console.log(`${nombre}  ${(h.bytes / 1024).toFixed(1)} KB  sha256 ${h.sha256}`);
  console.log(`MOTOR.json  motor ${motor.motor.id} ${motor.motor.version} · formato ${motor.formato.version}${iguales ? ' · sin cambios' : ''}`);
}
