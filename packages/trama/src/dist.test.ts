/**
 * dist/ es lo que Publisher trae: que esté al día con el código, que sus
 * sha256 sean los de MOTOR.json, que el worker sea autónomo, y que lo
 * construido calcule lo mismo que el código fuente.
 */
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { describe, expect, it } from 'vitest';
import { codificarTrama } from './formato/codigo.js';
import { normalizarTrama } from './formato/normalizar.js';
import { cuadroEn, instanteDeCuadro } from './reproduccion.js';
import { crearAtendedor, type MensajeDelWorker } from './worker/atendedor.js';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const leer = (nombre: string) => readFileSync(join(raiz, 'dist', nombre), 'utf8');
const sha256 = (texto: string) => createHash('sha256').update(texto, 'utf8').digest('hex');
const huella = (c: ArrayLike<number>) => createHash('sha256').update(Buffer.from(Float32Array.from(c, (v) => Math.round(v * 100) / 100).buffer)).digest('hex').slice(0, 16);

const secuencia = normalizarTrama({
  kind: 'contope/trama', version: 1, motor: { id: 'superficie-de-puntos', version: '1.0.0' },
  configuracion: { lineas: 20, puntosPorLinea: 60 },
  tiempo: { modo: 'secuencia', duracion: 2, cerrarCiclo: true, escenas: [{ id: 1, t: 1, captura: { evolucion: 40, configuracion: { pliegues: 2.4 } } }] },
});

describe('dist/', () => {
  it('está al día con el código (el build en memoria da los mismos bytes)', () => {
    const r = spawnSync(process.execPath, [join(raiz, 'scripts/construir.mjs'), '--verificar'], { encoding: 'utf8' });
    expect(r.stderr).toBe('');
    expect(r.status).toBe(0);
  });

  it('los sha256 y tamaños de MOTOR.json son los de los archivos', () => {
    const motor = JSON.parse(leer('MOTOR.json'));
    expect(motor.motor).toEqual({ id: 'superficie-de-puntos', version: '1.0.0' });
    expect(motor.formato).toEqual({ kind: 'contope/trama', version: 1 });
    for (const nombre of ['contope-trama.js', 'contope-trama-worker.js']) {
      const texto = leer(nombre);
      expect(motor.archivos[nombre]).toEqual({ sha256: sha256(texto), bytes: Buffer.byteLength(texto, 'utf8') });
    }
  });

  it('el worker es autónomo: sin Function.toString, sin blob:, sin eval', () => {
    for (const nombre of ['contope-trama-worker.js', 'contope-trama.js']) {
      const texto = leer(nombre);
      expect(texto).not.toMatch(/\.toString\(\)|blob:|createObjectURL|new Function|\beval\(|importScripts|\bimport\(|\brequire\(/);
    }
  });

  it('contope-trama.js expone ContopeTrama en el ámbito global y reproduce la huella de referencia', () => {
    const ventana: Record<string, unknown> = {};
    vm.runInNewContext(leer('contope-trama.js'), ventana);
    const T = ventana['ContopeTrama'] as typeof import('./index.js');
    const est = { tiempo: 6, camara: [0, 0] as const, cursor: [0.5, 0.5] as const, presencia: 0, configuracion: T.configuracionPorDefecto() };
    expect(huella(T.calcularLamina(est, 1600, 900, 1))).toBe('9c130d7e7d11640b');
    const modulo = { exports: {} as Record<string, unknown> };
    vm.runInNewContext(leer('contope-trama.js'), { module: modulo });
    expect(typeof modulo.exports['leerTrama']).toBe('function');
  });

  it('el worker de dist atiende el protocolo y entrega los mismos cuadros que el código fuente', () => {
    const recibidos: MensajeDelWorker[] = [];
    const cola: (() => void)[] = [];
    const ambito: Record<string, unknown> = {
      postMessage: (m: MensajeDelWorker) => recibidos.push(m),
      setTimeout: (fn: () => void) => cola.push(fn),
      onmessage: null,
    };
    ambito['self'] = ambito;
    vm.runInNewContext(leer('contope-trama-worker.js'), ambito);
    const enviar = (data: unknown) => (ambito['onmessage'] as (e: { data: unknown }) => void)({ data });
    enviar({ tipo: 'configurar', gen: 1, trama: codificarTrama(secuencia), ancho: 320, alto: 180, fps: 12, calidad: 0.5 });
    enviar({ tipo: 'pedir', gen: 1, hasta: 24 });
    while (cola.length) cola.shift()!();
    expect(recibidos[0]).toMatchObject({ tipo: 'configurado', gen: 1, lineas: 12, puntos: 30 });
    const cuadros = recibidos.filter((m) => m.tipo === 'cuadro');
    expect(cuadros.map((c) => c.k)).toEqual(Array.from({ length: 25 }, (_, i) => i));
    for (const k of [0, 7, 23, 24]) {
      const c = cuadros[k]!;
      const t = instanteDeCuadro(secuencia, k, 12);
      expect(c.t).toBe(t);
      expect(Array.from(c.datos)).toEqual(Array.from(cuadroEn(secuencia, t, 320, 180, 0.5).cuadro));
    }
    // una vuelta son 24 cuadros: el 24 es el 0
    expect(Array.from(cuadros[24]!.datos)).toEqual(Array.from(cuadros[0]!.datos));
  });
});

describe('protocolo del worker', () => {
  it('una trama inválida responde error con rutas; una generación vieja se ignora', () => {
    const recibidos: MensajeDelWorker[] = [];
    const cola: (() => void)[] = [];
    const atender = crearAtendedor((m) => recibidos.push(m), (fn) => cola.push(fn));
    atender({ tipo: 'configurar', gen: 1, trama: { kind: 'otra' }, ancho: 10, alto: 10, fps: 12 });
    expect(recibidos[0]).toMatchObject({ tipo: 'error', gen: 1 });
    atender({ tipo: 'configurar', gen: 2, trama: 'SP1.' + Buffer.from(JSON.stringify({ time: 1, cfg: { lineCount: 4, points: 10 } })).toString('base64'), ancho: 100, alto: 100, fps: 12 });
    atender({ tipo: 'pedir', gen: 1, hasta: 5 });
    while (cola.length) cola.shift()!();
    expect(recibidos.filter((m) => m.tipo === 'cuadro')).toHaveLength(0);
    atender({ tipo: 'pedir', gen: 2, hasta: 1 });
    atender({ tipo: 'configurar', gen: 3, trama: '{}', ancho: 100, alto: 100, fps: 12 });
    while (cola.length) cola.shift()!();
    // el pedido de la gen 2 alcanzó a dar un cuadro antes de la gen 3; la 3 es inválida y no da cuadros
    expect(recibidos.filter((m) => m.tipo === 'cuadro').every((m) => m.gen === 2)).toBe(true);
    expect(recibidos.at(-1)).toMatchObject({ tipo: 'error', gen: 3 });
  });
});
