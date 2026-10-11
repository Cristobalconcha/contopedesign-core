import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { configuracionPorDefecto } from './configuracion.js';
import { calcularLamina, cuadroDeEstado, dimensionesDeLamina, empaquetar, escribirLamina, tamanoDeCuadro, type EstadoMotor } from './lamina.js';
import { PERMUTACION, ruido } from './ruido.js';

/** El estado de referencia de `probar-trama.mjs` de Publisher: DEFAULTS, tiempo 6. */
const referencia = (): EstadoMotor => ({ tiempo: 6, camara: [0, 0], cursor: [0.5, 0.5], presencia: 0, configuracion: configuracionPorDefecto() });

/** El método exacto de Publisher: redondeo a 2 decimales en Float32, sha256, 16 hex. */
function huella(cuadro: Float32Array): string {
  const r = Float32Array.from(cuadro, (v) => Math.round(v * 100) / 100);
  return createHash('sha256').update(Buffer.from(r.buffer)).digest('hex').slice(0, 16);
}

describe('motor superficie-de-puntos', () => {
  it('reproduce la huella de referencia de Publisher (9c130d7e7d11640b)', () => {
    expect(huella(calcularLamina(referencia(), 1600, 900, 1))).toBe('9c130d7e7d11640b');
  });

  it('es determinista: dos cálculos dan los mismos bits', () => {
    const a = calcularLamina(referencia(), 1600, 900, 1), b = calcularLamina(referencia(), 1600, 900, 1);
    expect(Buffer.from(a.buffer).equals(Buffer.from(b.buffer))).toBe(true);
  });

  it('el cuadro tiene tamaño fijo: líneas × puntos × 5, también con puntos detrás de la cámara', () => {
    const cfg = configuracionPorDefecto();
    const a = calcularLamina(referencia(), 1600, 900, 1);
    expect(a.length).toBe(64 * 480 * 5);
    // cámara pegada a la lámina: muchos puntos quedan detrás y se escriben como ceros
    const cerca = calcularLamina({ ...referencia(), tiempo: 9.5, configuracion: { ...cfg, distancia: 0.5 } }, 1600, 900, 1);
    expect(cerca.length).toBe(a.length);
    let ceros = 0;
    for (let k = 0; k < cerca.length; k += 5) if (cerca[k + 2] === 0) ceros++;
    expect(ceros).toBeGreaterThan(0);
    expect(tamanoDeCuadro(cfg, 0.5)).toBe(dimensionesDeLamina(cfg, 0.5).lineas * dimensionesDeLamina(cfg, 0.5).puntos * 5);
  });

  it('la permutación es la de v7 (semilla 0x2f6b9a1d) y el ruido es estable', () => {
    expect(Array.from(PERMUTACION.slice(0, 8))).toEqual(Array.from(PERMUTACION.slice(256, 264)));
    expect(new Set(PERMUTACION.slice(0, 256)).size).toBe(256);
    expect(ruido(0, 0, 0)).toBe(0);
    expect(ruido(1.5, 2.25, 3.125)).toBe(ruido(1.5, 2.25, 3.125));
  });

  it('empaquetar concatena líneas sueltas en Float32 (packFrame)', () => {
    const p = empaquetar([[1, 2, 3, 4, 5], [6.1, 7, 8, 9, 10]]);
    expect(p).toBeInstanceOf(Float32Array);
    expect(p.length).toBe(10);
    expect(p[5]).toBe(Math.fround(6.1));
  });

  it('cuadroDeEstado sin morf es calcularLamina; con morf mezcla en 64 bits como v7', () => {
    const A = referencia(), B: EstadoMotor = { ...referencia(), tiempo: 11 };
    expect(cuadroDeEstado(A, 800, 450, 0.5)).toEqual(calcularLamina(A, 800, 450, 0.5));
    const m = cuadroDeEstado({ ...A, mezcla: { e: 0.25, estado: B } }, 800, 450, 0.5);
    const n = tamanoDeCuadro(A.configuracion, 0.5);
    const a64 = escribirLamina(A, 800, 450, 0.5, new Float64Array(n)), b64 = escribirLamina(B, 800, 450, 0.5, new Float64Array(n));
    for (const k of [0, 7, 1234, n - 1]) expect(m[k]).toBe(Math.fround(a64[k]! + (b64[k]! - a64[k]!) * 0.25));
  });

  it('el morf usa la malla del primer estado aunque el otro pida otra', () => {
    const A = referencia();
    const B: EstadoMotor = { ...referencia(), configuracion: { ...configuracionPorDefecto(), lineas: 10, puntosPorLinea: 30 } };
    expect(cuadroDeEstado({ ...A, mezcla: { e: 0.5, estado: B } }, 800, 450, 1).length).toBe(64 * 480 * 5);
  });
});
