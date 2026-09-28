import { describe, expect, it } from 'vitest';
import { evaluar } from '../evaluacion.js';
import { reducir } from '../reductor.js';
import { nuevoSistema } from '../sistema.js';
import { candidatosDeAse, leerAse, pesoDeTinte, resumenDeAse } from './ase.js';
import { extraer, tipoDeArchivo } from './index.js';

/** Arma un .ase como lo escribe Illustrator: bloques big-endian, tintes como bloque 0x0002. */
function ase(bloques: Array<{ tipo: number; datos: number[] }>): Uint8Array {
  const salida: number[] = [...'ASEF'].map((c) => c.charCodeAt(0));
  const u16 = (v: number) => [(v >> 8) & 255, v & 255];
  const u32 = (v: number) => [(v >>> 24) & 255, (v >>> 16) & 255, (v >>> 8) & 255, v & 255];
  salida.push(...u16(1), ...u16(0), ...u32(bloques.length));
  for (const b of bloques) salida.push(...u16(b.tipo), ...u32(b.datos.length), ...b.datos);
  return new Uint8Array(salida);
}

function f32(v: number): number[] {
  const d = new DataView(new ArrayBuffer(4));
  d.setFloat32(0, v);
  return [d.getUint8(0), d.getUint8(1), d.getUint8(2), d.getUint8(3)];
}

function nombre(texto: string): number[] {
  const salida = [0, texto.length + 1];
  for (const c of texto) salida.push(0, c.charCodeAt(0));
  return [...salida, 0, 0];
}

function color(texto: string, modelo: string, valores: number[], tipo: number): number[] {
  return [...nombre(texto), ...[...modelo].map((c) => c.charCodeAt(0)), ...valores.flatMap(f32), 0, tipo];
}

const VERDE = color('PANTONE 3298 C', 'RGB ', [4 / 255, 104 / 255, 82 / 255], 1);
const NARANJA = color('Naranja', 'CMYK', [0, 0.63, 0.83, 0.05], 2);

function paletaDePrueba(): Uint8Array {
  return ase([
    { tipo: 0xc001, datos: nombre('Econut') },
    { tipo: 0x0001, datos: VERDE },
    { tipo: 0x0002, datos: [...f32(0.5), ...VERDE] },
    { tipo: 0x0002, datos: [...f32(0.25), ...VERDE] },
    { tipo: 0x0002, datos: [...f32(0.75), ...VERDE] },
    { tipo: 0x0001, datos: NARANJA },
    { tipo: 0x0001, datos: color('Papel', 'Gray', [0.97], 2) },
    { tipo: 0x0001, datos: color('Medido', 'LAB ', [0.5, 20, -10], 0) },
    { tipo: 0xc002, datos: [] },
  ]);
}

describe('ase: lectura', () => {
  it('lee grupos, colores con su modelo, tintas planas y tintes', () => {
    const l = leerAse(paletaDePrueba());
    expect(l.version).toBe('1.0');
    expect(l.grupos).toEqual(['Econut']);
    const base = l.colores.filter((c) => c.tinte === undefined);
    expect(base.map((c) => `${c.nombre} ${c.modelo} ${c.tipo} ${c.hex ?? '-'}`)).toEqual([
      'PANTONE 3298 C RGB plana #046852',
      'Naranja CMYK normal #f25a29',
      'Papel Gris normal #f7f7f7',
      'Medido LAB global -',
    ]);
    expect(l.colores.filter((c) => c.tinte !== undefined).map((c) => c.tinte)).toEqual([0.5, 0.25, 0.75]);
    expect(base.every((c) => c.grupo === 'Econut')).toBe(true);
    expect(resumenDeAse(l)).toBe('Paleta de Adobe (ASE 1.0): 4 colores, 1 tinta plana, 3 tintes, 1 grupo.');
  });

  it('un archivo sin la firma ASEF se rechaza', () => {
    expect(() => leerAse(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]))).toThrow(/ASEF/);
  });

  it('la escala de pesos: el tinte por 400 y la tinta llena es 500', () => {
    expect([0.25, 0.5, 0.75, 1].map(pesoDeTinte)).toEqual([100, 200, 300, 500]);
  });
});

describe('ase: candidatos', () => {
  it('los colores base van a dim1.req01 con su modelo en el nombre; el Lab queda como faltante', () => {
    const [colores] = candidatosDeAse(leerAse(paletaDePrueba()), 'i');
    expect(colores?.requirementId).toBe('dim1.req01');
    const frag = colores?.fragmento as { institucionales: Array<{ name: string; value: string }>; neutros: Array<{ name: string; value: string }> };
    expect(frag.institucionales).toEqual([
      { name: 'PANTONE 3298 C · RGB R4 G104 B82', value: '#046852' },
      { name: 'Naranja · CMYK C0 M63 Y83 K5', value: '#f25a29' },
    ]);
    expect(frag.neutros).toEqual([{ name: 'Papel · Gris gris 97 %', value: '#f7f7f7' }]);
    expect(colores?.detalle).toMatch(/aproximada/);
    expect(colores?.faltante).toMatch(/Lab sin convertir: Medido/);
  });

  it('los tintes van a dim1.req04 como rampa 100/200/300/500, apuntando a su color base', () => {
    const c = candidatosDeAse(leerAse(paletaDePrueba()), 'i');
    const rampas = c.find((x) => x.requirementId === 'dim1.req04');
    expect(rampas?.fragmento).toEqual({
      ramps: [
        {
          family: { refReqId: 'dim1.req01', refPath: ['institucionales', 0] },
          name: 'PANTONE 3298 C · RGB R4 G104 B82',
          scale: [
            { step: 100, value: '#c0d9d4' },
            { step: 200, value: '#82b3a9' },
            { step: 300, value: '#438e7d' },
            { step: 500, value: '#046852' },
          ],
        },
      ],
    });
  });

  it('extraer() enruta .ase; incorporado resuelve dim1.req01 y la rampa se evalúa contra esa paleta', async () => {
    expect(tipoDeArchivo('ase')).toBe('ase');
    // Sólo colores con rampa: así la pregunta de rampas queda resuelta entera.
    const bytes = ase([
      { tipo: 0x0001, datos: VERDE },
      { tipo: 0x0002, datos: [...f32(0.5), ...VERDE] },
      { tipo: 0x0001, datos: color('Gris', 'Gray', [0.5], 2) },
    ]);
    const insumo = await extraer({ nombre: 'paleta.ase', extension: 'ase', bytes });
    expect(insumo.tipo).toBe('ase');
    let s = reducir(nuevoSistema('marca', 'Prueba', '2026-09-27T00:00:00.000Z'), { tipo: 'agregar-insumo', insumo });
    s = reducir(s, { tipo: 'incorporar', insumoId: insumo.id, candidatoIds: insumo.candidatos.map((c) => c.id) });
    const e = evaluar(s);
    expect(e.porRequisito.get('dim1.req01')?.resultado).toBe('resuelto');
    expect(e.porRequisito.get('dim1.req04')?.resultado).toBe('resuelto');
  });
});
