import { describe, expect, it } from 'vitest';
import { normalizarTrama } from '../formato/normalizar.js';
import type { Trama } from '../formato/tipos.js';
import { configuracionPorDefecto } from '../motor/configuracion.js';
import { cuadroEn, instanteDeCuadro } from '../reproduccion.js';
import { estadoEn, evolucionEn, interpolar, type DocumentoDeLinea } from './evaluar.js';
import { PARAMETRO_ANIMABLE } from './parametros.js';
import { bezierCubica, SUAVIZADO, suavizadoDe } from './suavizados.js';

const cabecera = { kind: 'contope/trama', version: 1, motor: { id: 'superficie-de-puntos', version: '1.0.0' } } as const;
const secuencia = (tiempo: Record<string, unknown>, resto: Record<string, unknown> = {}): Trama =>
  normalizarTrama({ ...cabecera, ...resto, tiempo: { modo: 'secuencia', inicio: 10, duracion: 4, ...tiempo } });
const doc = (pistas: DocumentoDeLinea['pistas']): DocumentoDeLinea => ({
  configuracion: configuracionPorDefecto(), colores: { lejos: '#000000', cerca: '#ffffff', fondo: '#000000' }, pistas, inicio: 10, cursor: { x: 0.5, y: 0.5, presencia: 0 },
});

describe('suavizados', () => {
  it('los cinco con nombre, calculados a mano', () => {
    expect(SUAVIZADO.lineal(0.5)).toBe(0.5);
    expect(SUAVIZADO.suave(0.25)).toBe(0.15625); // 0,0625 × 2,5
    expect(SUAVIZADO.entrada(0.5)).toBe(0.25);
    expect(SUAVIZADO.salida(0.5)).toBe(0.75);
    expect(SUAVIZADO.mantener(0.9)).toBe(0);
  });
  it('cubic-bezier: lineal es la identidad, la suave es simétrica y una curva sin curva cae en lineal', () => {
    expect(bezierCubica(0, 0, 1, 1)(0.3)).toBeCloseTo(0.3, 6);
    expect(bezierCubica(0.42, 0, 0.58, 1)(0.5)).toBeCloseTo(0.5, 6);
    expect(bezierCubica(0.42, 0, 0.58, 1)(0.2)).toBeLessThan(0.2);
    expect(suavizadoDe({ ease: 'curva' })(0.3)).toBe(0.3);
  });
});

describe('interpolación de keyframes', () => {
  const p = PARAMETRO_ANIMABLE['pliegues'];
  it('antes del primero y después del último, el valor del extremo', () => {
    const k = [{ t: 1, v: 0, ease: 'lineal' as const }, { t: 3, v: 10, ease: 'lineal' as const }];
    expect(interpolar(k, 0, p)).toBe(0);
    expect(interpolar(k, 2, p)).toBe(5);
    expect(interpolar(k, 9, p)).toBe(10);
  });
  it('suave y mantener', () => {
    expect(interpolar([{ t: 0, v: 0, ease: 'suave' }, { t: 2, v: 10, ease: 'lineal' }], 0.5, p)).toBe(1.5625);
    expect(interpolar([{ t: 0, v: 0, ease: 'mantener' }, { t: 2, v: 10, ease: 'lineal' }], 1.99, p)).toBe(0);
  });
  it('un parámetro entero salta en el keyframe («hold») aunque el ease sea lineal', () => {
    const k = [{ t: 0, v: 64, ease: 'lineal' as const }, { t: 2, v: 100, ease: 'lineal' as const }];
    expect(interpolar(k, 1.9, PARAMETRO_ANIMABLE['lineas'])).toBe(64);
    expect(interpolar(k, 2, PARAMETRO_ANIMABLE['lineas'])).toBe(100);
  });
  it('los colores se mezclan en sRGB y se redondean', () => {
    expect(interpolar([{ t: 0, v: '#000000', ease: 'lineal' }, { t: 2, v: '#ffffff', ease: 'lineal' }], 1, PARAMETRO_ANIMABLE['color.fondo'])).toBe('#808080');
  });
});

describe('evolución', () => {
  it('sin keyframes corre desde el inicio', () => {
    expect(evolucionEn(doc({}), 2.5)).toEqual({ tiempo: 12.5 });
  });
  it('lineal recorre, fuera de los keyframes corre a 1 s por segundo, mantener congela', () => {
    const d = doc({ evolucion: [{ t: 1, v: 10, ease: 'lineal' }, { t: 3, v: 30, ease: 'lineal' }] });
    expect(evolucionEn(d, 0).tiempo).toBe(9);
    expect(evolucionEn(d, 2).tiempo).toBe(20);
    expect(evolucionEn(d, 4).tiempo).toBe(31);
    const m = doc({ evolucion: [{ t: 1, v: 10, ease: 'mantener' }, { t: 3, v: 30, ease: 'mantener' }] });
    expect(evolucionEn(m, 2).tiempo).toBe(10);
    expect(evolucionEn(m, 5).tiempo).toBe(30);
  });
  it('suave es MORF: los dos momentos vivos y la mezcla con el peso de la curva', () => {
    const d = doc({ evolucion: [{ t: 1, v: 10, ease: 'suave' }, { t: 3, v: 50, ease: 'lineal' }] });
    expect(evolucionEn(d, 2)).toEqual({ tiempo: 11, tiempoB: 49, mezcla: 0.5 });
    const e = evolucionEn(d, 1.5);
    expect(e.mezcla).toBe(0.15625);
  });
  it('estadoEn lleva el morf al motor (blend) y no lo pone en los extremos', () => {
    const t = secuencia({ pistas: { evolucion: [{ t: 1, v: 10, ease: 'suave' }, { t: 3, v: 50 }] } });
    const s = estadoEn(t, 2);
    expect(s.motor.mezcla?.e).toBe(0.5);
    expect(s.motor.mezcla?.estado.tiempo).toBe(49);
    expect(estadoEn(t, 1).motor.mezcla).toBeUndefined();
  });
});

describe('estado de una trama', () => {
  it('pistas numéricas, enteras (redondeadas) y de color', () => {
    const t = secuencia({ pistas: {
      pliegues: [{ t: 0, v: 0 }, { t: 4, v: 2 }],
      puntosPorLinea: [{ t: 0, v: 100.4 }, { t: 2, v: 200 }],
      'color.cerca': [{ t: 0, v: '#000000' }, { t: 4, v: '#FFFFFF' }],
    } });
    const s = estadoEn(t, 1);
    expect(s.motor.configuracion.pliegues).toBe(0.5);
    expect(s.motor.configuracion.puntosPorLinea).toBe(100);
    expect(s.colores.cerca).toBe('#404040');
    expect(s.motor.tiempo).toBe(11);
  });
  it('en vivo: el cursor real entra si la interacción lo permite; el paralaje no, por defecto', () => {
    const vivo = normalizarTrama({ ...cabecera });
    const s = estadoEn(vivo, 3, { cursor: [0.2, 0.8], camara: [1, 1] });
    expect(s.motor.tiempo).toBe(9);
    expect(s.motor.cursor).toEqual([0.2, 0.8]);
    expect(s.motor.presencia).toBe(1);
    expect(s.motor.camara).toEqual([0, 0]);
    const sinCursor = normalizarTrama({ ...cabecera, interaccion: { cursor: false, paralaje: true } });
    const q = estadoEn(sinCursor, 3, { cursor: [0.2, 0.8], camara: [1, 1] });
    expect(q.motor.presencia).toBe(0);
    expect(q.motor.camara).toEqual([1, 1]);
  });
});

describe('escenas', () => {
  const captura = { configuracion: { pliegues: 2.5 }, evolucion: 20 };
  it('morph: un keyframe con la curva al empezar la transición y otro lineal al llegar', () => {
    const t = secuencia({ escenas: [{ id: 1, t: 2, captura, duracion: 1, evolucion: false }] });
    if (t.tiempo.modo !== 'secuencia') throw new Error();
    expect(t.tiempo.pistas.pliegues).toEqual([
      { t: 1, v: 1.8, ease: 'curva', curva: [0.42, 0, 0.58, 1], escena: 1 },
      { t: 2, v: 2.5, ease: 'lineal', escena: 1 },
    ]);
    expect(t.tiempo.pistas.evolucion).toBeUndefined();
    expect(estadoEn(t, 2).motor.configuracion.pliegues).toBe(2.5);
  });
  it('corte: mantener hasta un cuadro antes (1/24 s) y saltar; con evolución, la evolución también llega', () => {
    const t = secuencia({ escenas: [{ id: 1, t: 2, captura, transicion: 'corte' }] });
    if (t.tiempo.modo !== 'secuencia') throw new Error();
    expect(t.tiempo.pistas.pliegues).toEqual([
      { t: 2 - 1 / 24, v: 1.8, ease: 'mantener', escena: 1 },
      { t: 2, v: 2.5, ease: 'lineal', escena: 1 },
    ]);
    expect(estadoEn(t, 2).motor.tiempo).toBe(20);
  });
  it('una escena en el instante 0 rige desde el comienzo', () => {
    const t = secuencia({ escenas: [{ id: 1, t: 0, captura }] });
    expect(estadoEn(t, 0).motor.configuracion.pliegues).toBe(2.5);
    expect(estadoEn(t, 0).motor.tiempo).toBe(20);
  });
  it('los keyframes de escena que traiga el archivo se regeneran; los manuales se conservan', () => {
    const t = secuencia({
      escenas: [{ id: 1, t: 2, captura, transicion: 'corte' }],
      pistas: { pliegues: [{ t: 0.5, v: 9, escena: 1 }], torsion: [{ t: 1, v: 1 }] },
    });
    if (t.tiempo.modo !== 'secuencia') throw new Error();
    expect(t.tiempo.pistas.pliegues!.some((k) => k.v === 9)).toBe(false);
    expect(t.tiempo.pistas.torsion).toEqual([{ t: 1, v: 1, ease: 'lineal' }]);
  });
});

describe('ciclo cerrado', () => {
  const t = secuencia({
    cerrarCiclo: true,
    escenas: [
      { id: 1, t: 0, captura: { evolucion: 4, configuracion: { pliegues: 0.6, distancia: 6 }, color: { cerca: '#ff0000' } } },
      { id: 2, t: 2, captura: { evolucion: 30, configuracion: { pliegues: 2.2, torsion: -1 }, color: { cerca: '#00ff00' } } },
    ],
  });
  it('el último instante es exactamente el primero: mismo cuadro, bit a bit', () => {
    const a = cuadroEn(t, 0, 320, 180, 0.4), b = cuadroEn(t, 4, 320, 180, 0.4);
    expect(b.estado.colores).toEqual(a.estado.colores);
    expect(Buffer.from(b.cuadro.buffer).equals(Buffer.from(a.cuadro.buffer))).toBe(true);
    const casi = cuadroEn(t, 4 - 1 / 24, 320, 180, 0.4);
    expect(Buffer.from(casi.cuadro.buffer).equals(Buffer.from(a.cuadro.buffer))).toBe(false);
  });
  it('una vuelta tiene duración × fps cuadros y el instante duración no se repite', () => {
    expect(instanteDeCuadro(t, 0, 12)).toBe(0);
    expect(instanteDeCuadro(t, 47, 12)).toBe(47 / 12);
    expect(instanteDeCuadro(t, 48, 12)).toBe(0);
    const det = secuencia({ alTerminar: 'detener' });
    expect(instanteDeCuadro(det, 100, 12)).toBe(4);
    expect(instanteDeCuadro(normalizarTrama({ ...cabecera }), 100, 12)).toBe(100 / 12);
  });
});
