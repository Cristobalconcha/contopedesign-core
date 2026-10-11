import { describe, expect, it } from 'vitest';
import { configuracionPorDefecto } from '../motor/configuracion.js';
import { calcularLamina, dimensionesDeLamina } from '../motor/lamina.js';
import { alfaDeNivel, luminancia, mezclarHex, modoDeTinta, nivelDeAlfa, tonoDeCercania, tonosPorProfundidad, TONOS } from './color.js';
import { mezclarCuadros } from './mezcla.js';
import { modoDe } from './modo.js';
import { recorrerPuntos } from './puntos.js';
import { cuadroASvg } from './svg.js';
import { tirasDeTramos, VALORES_POR_VERTICE } from './tiras.js';
import { tramosDeLinea, trazosDeTramo } from './tramos.js';

/** Un cuadro de una línea con puntos dados como [x, y, radio, cercanía, alfa]. */
const cuadroDe = (puntos: number[][]) => Float32Array.from(puntos.flat());

describe('color y tinta', () => {
  it('12 tonos de lejos a cerca, con los extremos exactos', () => {
    const t = tonosPorProfundidad('#2a52d6', '#3dd6c0');
    expect(t).toHaveLength(TONOS);
    expect(t[0]).toEqual([0x2a, 0x52, 0xd6]);
    expect(t[11]).toEqual([0x3d, 0xd6, 0xc0]);
    expect(tonoDeCercania(0)).toBe(0);
    expect(tonoDeCercania(1)).toBe(11);
    expect(tonoDeCercania(0.5)).toBe(6); // round(5,5)
  });

  it('4 niveles de alfa, pintados al centro de su intervalo', () => {
    expect([0.02, 0.25, 0.6, 0.99, 1.7].map(nivelDeAlfa)).toEqual([0, 1, 2, 3, 3]);
    expect([0, 1, 2, 3].map(alfaDeNivel)).toEqual([0.125, 0.375, 0.625, 0.875]);
  });

  it('tinta automática: sobre fondo claro, tinta; sobre oscuro, luz (umbral 0,4)', () => {
    expect(modoDeTinta('auto', '#000000')).toBe('luz');
    expect(modoDeTinta('auto', '#f1ede4')).toBe('tinta');
    expect(modoDeTinta('luz', '#ffffff')).toBe('luz');
    expect(luminancia('#ffffff')).toBeCloseTo(1);
    expect(mezclarHex('#000000', '#ffffff', 0.5)).toBe('#808080');
  });

  it('modo: lee render, modo y el dotted de las capturas viejas', () => {
    expect(modoDe({ render: 'mixto' })).toBe('mixto');
    expect(modoDe({ dotted: false })).toBe('lineas');
    expect(modoDe({ dotted: true })).toBe('puntos');
    expect(modoDe('otro', 'lineas')).toBe('lineas');
    expect(modoDe(false)).toBe('lineas');
  });
});

describe('puntos y tramos', () => {
  it('recorrerPuntos salta los de alfa < 0,02 y los agrupa por tono y nivel', () => {
    const c = cuadroDe([[1, 1, 1, 0, 0.01], [2, 2, 1, 1, 0.5]]);
    const vistos: number[][] = [];
    recorrerPuntos(c, 1, (k, tono, nivel) => vistos.push([k, tono, nivel]));
    expect(vistos).toEqual([[5, 11, 2]]);
    recorrerPuntos(c, 0, () => { throw new Error('con opacidad 0 no hay puntos'); });
  });

  it('tramos de 6 puntos que comparten borde, con color, alfa y grosor del centro', () => {
    const pts = Array.from({ length: 13 }, (_, i) => [i * 10, 0, 2, i / 12, 1]);
    const tr = tramosDeLinea(cuadroDe(pts), 13, { grosorLinea: 1.5, opacidadLinea: 0.4 });
    expect(tr.map((t) => [t.inicio / 5, t.fin / 5])).toEqual([[0, 6], [6, 12]]);
    expect(tr[0]!.grosor).toBe(3);
    expect(tr[0]!.alfa).toBeCloseTo(0.4);
    expect(tr[0]!.tono).toBe(tonoDeCercania(3 / 12));
  });

  it('un punto detrás de la cámara corta el trazo', () => {
    const pts = Array.from({ length: 7 }, (_, i) => [i * 10, 0, i === 3 ? 0 : 1, 0.5, 1]);
    const c = cuadroDe(pts);
    const [tr] = tramosDeLinea(c, 7, { grosorLinea: 1, opacidadLinea: 1 });
    expect(trazosDeTramo(c, tr!).map((t) => t.map((q) => q / 5))).toEqual([[0, 1, 2], [4, 5, 6]]);
  });
});

describe('tiras de triángulos', () => {
  it('dos vértices por punto, degenerados entre trazos, y el grosor real en px', () => {
    const pts = Array.from({ length: 7 }, (_, i) => [i * 10, 50, 2, 0.5, 1]);
    pts[2]![2] = 0; // corta en un trazo de 2 puntos y otro de 4 (el centro, el 3, da el grosor)
    const c = cuadroDe(pts);
    const tramos = tramosDeLinea(c, 7, { grosorLinea: 2, opacidadLinea: 1 });
    const tonos = tonosPorProfundidad('#000000', '#ffffff');
    const { vertices, cantidad } = tirasDeTramos(c, tramos, tonos);
    expect(cantidad).toBe(2 * 2 + 4 * 2 + 2);
    expect(vertices.length).toBe(cantidad * VALORES_POR_VERTICE);
    const v = (i: number) => Array.from(vertices.slice(i * 6, i * 6 + 6));
    // punto 4, interior del segundo trazo (recto): separación = grosor (radio 2 × 2 = 4)
    expect(Math.abs(v(8)[1]! - v(9)[1]!)).toBeCloseTo(4);
    expect(v(8)[0]).toBeCloseTo(40);
    // el extremo se prolonga medio grosor
    expect(v(0)[0]).toBeCloseTo(-2);
    // degenerados: repiten el último vértice anterior y el primero del siguiente
    expect(v(4)).toEqual(v(3));
    expect(v(5)).toEqual(v(6));
    // color y alfa normalizados
    expect(v(0)[5]).toBe(1);
    expect(v(0)[2]).toBeCloseTo(tonos[6]![0] / 255);
  });

  it('en una esquina el inglete mantiene el grosor perpendicular a cada segmento', () => {
    const c = cuadroDe([[0, 0, 1, 0, 1], [10, 0, 1, 0, 1], [10, 10, 1, 0, 1]]);
    const tramos = tramosDeLinea(c, 3, { grosorLinea: 2, opacidadLinea: 1 }); // grosor 2
    const { vertices } = tirasDeTramos(c, tramos, tonosPorProfundidad('#000000', '#ffffff'), { escala: 2 });
    // escala 2: esquina en (20, 0), medio grosor 2, inglete a 45° → distancia 2√2
    const ax = vertices[12]!, ay = vertices[13]!;
    expect(Math.hypot(ax - 20, ay - 0)).toBeCloseTo(2 * Math.SQRT2);
  });

  it('una lámina real produce tiras coherentes', () => {
    const cfg = configuracionPorDefecto();
    const c = calcularLamina({ tiempo: 6, camara: [0, 0], cursor: [0.5, 0.5], presencia: 0, configuracion: cfg }, 800, 450, 0.5);
    const tramos = tramosDeLinea(c, dimensionesDeLamina(cfg, 0.5).puntos, cfg);
    const { vertices, cantidad } = tirasDeTramos(c, tramos, tonosPorProfundidad('#2a52d6', '#3dd6c0'));
    expect(cantidad).toBeGreaterThan(tramos.length * 4);
    expect(vertices.every(Number.isFinite)).toBe(true);
  });
});

describe('mezcla y SVG', () => {
  it('mezcla lineal entre cuadros del mismo tamaño', () => {
    const m = mezclarCuadros([0, 10], [10, 20], 0.25);
    expect(Array.from(m)).toEqual([2.5, 12.5]);
    expect(() => mezclarCuadros([0], [1, 2], 0.5)).toThrow();
  });

  it('SVG con líneas debajo y puntos encima, y la tinta como mix-blend-mode', () => {
    const cfg = configuracionPorDefecto();
    const cuadro = calcularLamina({ tiempo: 6, camara: [0, 0], cursor: [0.5, 0.5], presencia: 0, configuracion: cfg }, 320, 180, 0.3);
    const svg = cuadroASvg({ ...cfg, cuadro, puntosPorLinea: dimensionesDeLamina(cfg, 0.3).puntos, ancho: 320, alto: 180, modo: 'mixto', tinta: 'auto', colores: { lejos: '#2a52d6', cerca: '#3dd6c0', fondo: '#f1ede4' } });
    expect(svg.indexOf('<g id="lineas"')).toBeGreaterThan(0);
    expect(svg.indexOf('<g id="puntos"')).toBeGreaterThan(svg.indexOf('<g id="lineas"'));
    expect(svg).toContain('mix-blend-mode:multiply');
  });
});
