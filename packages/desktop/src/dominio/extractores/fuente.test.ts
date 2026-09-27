import { strToU8, zipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { evaluar } from '../evaluacion.js';
import { reducir } from '../reductor.js';
import { nuevoSistema } from '../sistema.js';
import { candidatosDeFuentes, leerFuente, leerFuentes, licenciaCorta, resumenDeFuentes, zipTraeFuentes } from './fuente.js';
import { extraer, tipoDeArchivo } from './index.js';

/**
 * Una fuente TrueType mínima: sólo las tablas que el lector mira (`name`,
 * `OS/2` y, si es variable, `fvar`). No dibuja nada, pero sus tablas tienen
 * la forma real.
 */
function ttf(opciones: { nombres: Record<number, string>; peso: number; italica?: boolean; ejes?: Array<[string, number, number, number]> }): Uint8Array {
  const u16 = (v: number) => [(v >> 8) & 255, v & 255];
  const u32 = (v: number) => [(v >>> 24) & 255, (v >>> 16) & 255, (v >>> 8) & 255, v & 255];
  const fijo = (v: number) => u32(Math.round(v * 65536) >>> 0);

  const registros = Object.entries(opciones.nombres).map(([id, texto]) => ({ id: Number(id), datos: [...texto].flatMap((c) => u16(c.charCodeAt(0))) }));
  let desplazamiento = 0;
  const cabeceras: number[] = [];
  const textos: number[] = [];
  for (const r of registros) {
    cabeceras.push(...u16(3), ...u16(1), ...u16(0x409), ...u16(r.id), ...u16(r.datos.length), ...u16(desplazamiento));
    textos.push(...r.datos);
    desplazamiento += r.datos.length;
  }
  const name = [...u16(0), ...u16(registros.length), ...u16(6 + registros.length * 12), ...cabeceras, ...textos];

  const os2 = new Array<number>(78).fill(0);
  os2.splice(4, 2, ...u16(opciones.peso));
  os2.splice(62, 2, ...u16(opciones.italica ? 1 : 0x40));

  const tablas: Array<[string, number[]]> = [['OS/2', os2], ['name', name]];
  if (opciones.ejes?.length) {
    const ejes = opciones.ejes.flatMap(([tag, min, def, max]) => [...[...tag].map((c) => c.charCodeAt(0)), ...fijo(min), ...fijo(def), ...fijo(max), ...u16(0), ...u16(256)]);
    tablas.push(['fvar', [...u16(1), ...u16(0), ...u16(16), ...u16(2), ...u16(opciones.ejes.length), ...u16(20), ...u16(0), ...u16(0), ...ejes]]);
  }
  tablas.sort(([a], [b]) => (a < b ? -1 : 1));

  const salida: number[] = [...u32(0x00010000), ...u16(tablas.length), ...u16(0), ...u16(0), ...u16(0)];
  let posicion = 12 + tablas.length * 16;
  const cuerpo: number[] = [];
  for (const [tag, datos] of tablas) {
    salida.push(...[...tag].map((c) => c.charCodeAt(0)), ...u32(0), ...u32(posicion), ...u32(datos.length));
    cuerpo.push(...datos);
    posicion += datos.length;
  }
  return new Uint8Array([...salida, ...cuerpo]);
}

const OFL = 'This Font Software is licensed under the SIL Open Font License, Version 1.1. This license is copied below.';

const OPEN_SANS = ttf({
  nombres: { 1: 'Open Sans', 2: 'Regular', 6: 'OpenSans-Regular', 13: OFL },
  peso: 400,
  ejes: [
    ['wght', 300, 400, 800],
    ['wdth', 75, 100, 100],
  ],
});

describe('fuente: lectura', () => {
  it('lee familia, estilo, peso, ejes variables y licencia de las tablas', () => {
    const [f] = leerFuente(OPEN_SANS, 'OpenSans.ttf');
    expect(f).toMatchObject({ familia: 'Open Sans', estilo: 'Regular', postscript: 'OpenSans-Regular', peso: 400, italica: false });
    expect(f?.ejes).toEqual([
      { tag: 'wght', min: 300, defecto: 400, max: 800 },
      { tag: 'wdth', min: 75, defecto: 100, max: 100 },
    ]);
    expect(licenciaCorta(f?.licencia)).toBe('SIL Open Font License 1.1 (OFL)');
  });

  it('la familia tipográfica (id 16) manda sobre la de estilo (id 1); la itálica sale de OS/2', () => {
    const [f] = leerFuente(ttf({ nombres: { 1: 'Marca Black', 2: 'Italic', 16: 'Marca', 17: 'Black Italic' }, peso: 900, italica: true }), 'm.ttf');
    expect(f).toMatchObject({ familia: 'Marca', estilo: 'Black Italic', peso: 900, italica: true });
  });

  it('un WOFF no se lee y dice por qué; lo que no es fuente se rechaza', () => {
    expect(() => leerFuente(strToU8('wOF2xxxxxxxxxxxx'), 'a.woff2')).toThrow(/WOFF/);
    expect(() => leerFuente(strToU8('hola, esto no es una fuente'), 'a.ttf')).toThrow(/TrueType u OpenType/);
  });
});

describe('fuente: paquetes', () => {
  function paquete(): Uint8Array {
    return zipSync({
      'Big_Shoulders/OFL.txt': strToU8(OFL),
      'Big_Shoulders/BigShoulders-VariableFont_opsz,wght.ttf': ttf({
        nombres: { 1: 'Big Shoulders Thin', 2: 'Regular', 16: 'Big Shoulders', 17: 'Thin' },
        peso: 100,
        ejes: [
          ['opsz', 10, 72, 72],
          ['wght', 100, 100, 900],
        ],
      }),
      'Big_Shoulders/static/BigShoulders_18pt-Bold.ttf': ttf({ nombres: { 1: 'Big Shoulders 18pt', 2: 'Bold' }, peso: 700 }),
      'Big_Shoulders/static/BigShoulders-ExtraLight.ttf': ttf({ nombres: { 1: 'Big Shoulders ExtraLight', 2: 'Regular', 16: 'Big Shoulders', 17: 'ExtraLight' }, peso: 250 }),
      'Big_Shoulders/web/BigShoulders.woff2': strToU8('wOF2xxxxxxxxxxxx'),
      '__MACOSX/._basura.ttf': strToU8('x'),
    });
  }

  it('un ZIP de Google Fonts: junta la variable con sus estáticas de tamaño óptico y toma la licencia', () => {
    const bytes = paquete();
    expect(zipTraeFuentes(bytes)).toBe(true);
    expect(zipTraeFuentes(zipSync({ 'nota.txt': strToU8('hola') }))).toBe(false);
    const l = leerFuentes(bytes, 'Big_Shoulders.zip');
    expect(l.familias).toHaveLength(1);
    const [g] = l.familias;
    expect(g?.nombre).toBe('Big Shoulders');
    expect(g?.tamanosOpticos).toEqual(['18pt']);
    // Los pesos salen del eje wght; el 250 de la ExtraLight estática no se cuela.
    expect(g?.pesos).toEqual([100, 200, 300, 400, 500, 600, 700, 800, 900]);
    expect(g?.licencia).toBe('SIL Open Font License 1.1 (OFL)');
    expect(l.sinLeer.map((s) => s.archivo)).toEqual(['Big_Shoulders/web/BigShoulders.woff2']);
    expect(resumenDeFuentes(l)).toMatch(/^1 familia en 3 fuentes: Big Shoulders\. 1 archivo no se pudo leer \(es una fuente WOFF/);
  });

  it('el candidato usa el nombre, la pila y los idiomas del catálogo de Google Fonts', () => {
    const [c] = candidatosDeFuentes(leerFuentes(paquete(), 'Big_Shoulders.zip'), 'i');
    expect(c?.requirementId).toBe('dim2.req01');
    expect(c?.fragmento).toEqual({
      familias: [
        { name: 'Big Shoulders', stack: ['Big Shoulders', 'sans-serif'], idiomas: ['latin', 'latin-ext', 'vietnamese'], licencia: 'SIL Open Font License 1.1 (OFL)' },
      ],
    });
    expect(c?.detalle).toMatch(/variable \(opsz 10–72, wght 100–900\)/);
    expect(c?.faltante).toBeUndefined();
  });

  it('una familia fuera del catálogo y sin licencia lo dice', () => {
    const [c] = candidatosDeFuentes(leerFuentes(ttf({ nombres: { 1: 'Marca Propia', 2: 'Regular' }, peso: 400 }), 'marca.otf'), 'i');
    expect(c?.fragmento).toEqual({ familias: [{ name: 'Marca Propia', stack: ['Marca Propia'] }] });
    expect(c?.faltante).toMatch(/Sin licencia declarada: Marca Propia/);
  });

  it('extraer() enruta fuentes y paquetes; incorporado resuelve dim2.req01', async () => {
    expect(tipoDeArchivo('ttf')).toBe('fuente');
    expect(tipoDeArchivo('zip', paquete())).toBe('fuente');
    expect(tipoDeArchivo('zip', zipSync({ 'a.txt': strToU8('x') }))).toBe('otro');
    const insumo = await extraer({ nombre: 'OpenSans-VariableFont_wdthwght.ttf', extension: 'ttf', bytes: OPEN_SANS });
    expect(insumo.tipo).toBe('fuente');
    let s = reducir(nuevoSistema('marca', 'Prueba', '2026-09-27T00:00:00.000Z'), { tipo: 'agregar-insumo', insumo });
    s = reducir(s, { tipo: 'incorporar', insumoId: insumo.id, candidatoIds: insumo.candidatos.map((c) => c.id) });
    expect(evaluar(s).porRequisito.get('dim2.req01')?.resultado).toBe('resuelto');
  });
});
