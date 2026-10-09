import { generadorTrama, leerMetadataDeLeeme } from '@contope/core';
import { codificarTrama, cuadroEn, leerTrama, validarTrama, type Trama } from '@contope/trama';
import { strFromU8, unzipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { generarEnElTaller } from './celulas.js';
import { reducir } from './reductor.js';
import { nuevoSistema, type Sistema } from './sistema.js';
import {
  capturaDelEditor,
  coloresDelEditor,
  editorDesdeTrama,
  editorNuevo,
  errorDeLectura,
  FORMATO_IMPORTADO,
  reducirTrama,
  tramaDelEditor,
  type AccionDeTrama,
  type EditorDeTrama,
} from './trama.js';

const AHORA = '2026-10-09T12:00:00.000Z';

/** Un sistema con el fundamento y los roles de fondo y acento definidos. */
function conColores(): Sistema {
  const definir = (s: Sistema, requirementId: string, payload: Record<string, unknown>): Sistema =>
    reducir(s, { tipo: 'definir', requirementId, payload, camino: 'diseñador', fuerza: 'prioritaria' }, AHORA);
  const s = definir(nuevoSistema('marca', 'Nocturno', AHORA), 'dim1.req01', {
    institucionales: [{ name: 'Azul', value: '#1d3fb8' }],
    neutros: [{ name: 'Tinta', value: '#0b0f14' }],
  });
  return definir(s, 'dim1.req02', {
    roleColors: [
      { role: 'background', color: '#0b0f14' },
      { role: 'accent', color: '#e0a040' },
    ],
  });
}

const vacio = (): Sistema => nuevoSistema('marca', 'Sin nada', AHORA);
const aplicar = (e: EditorDeTrama, ...acciones: AccionDeTrama[]): EditorDeTrama => acciones.reduce(reducirTrama, e);

describe('La pantalla de la trama', () => {
  it('con ADN, los colores parten del ADN por rol', () => {
    const s = conColores();
    const c = coloresDelEditor(editorNuevo(s.designSet), s.designSet);
    expect(c.fondo).toMatchObject({ hex: '#0b0f14', origen: 'adn', rol: 'dim1.req02:background' });
    expect(c.cerca).toMatchObject({ hex: '#e0a040', origen: 'adn', rol: 'dim1.req02:accent' });
    expect(c.lejos).toMatchObject({ hex: '#1d3fb8', origen: 'adn', rol: 'dim1.req01:institucionales:Azul' });
  });

  it('cambiar un color lo deja propio; «volver al ADN» lo devuelve', () => {
    const s = conColores();
    const e = aplicar(editorNuevo(s.designSet), { tipo: 'color', clave: 'cerca', hex: '#FF0000' });
    expect(tramaDelEditor(e, s.designSet).color.cerca).toEqual({ hex: '#ff0000', origen: 'manual' });
    expect(aplicar(e, { tipo: 'color', clave: 'cerca', hex: 'rojo' })).toBe(e); // un hex inválido no entra
    const devuelto = aplicar(e, { tipo: 'volver-al-adn' });
    expect(tramaDelEditor(devuelto, s.designSet).color.cerca.origen).toBe('adn');
  });

  it('un sistema vacío arma una trama válida con los colores del look', () => {
    const s = vacio();
    const e = aplicar(editorNuevo(s.designSet), { tipo: 'look', look: 'papel' });
    const t = tramaDelEditor(e, s.designSet);
    expect(validarTrama(t)).toEqual([]);
    expect(t.color.fondo).toEqual({ hex: '#f1ede4', origen: 'manual' });
    expect(t.configuracion.lineas).toBe(70);
  });

  it('el look cambia la forma y el dibujo; los controles la ajustan', () => {
    const s = vacio();
    const e = aplicar(editorNuevo(s.designSet), { tipo: 'look', look: 'torsion-de-lineas' }, { tipo: 'parametro', parametro: 'lineas', valor: 30.6 });
    expect(e.dibujo.modo).toBe('lineas');
    expect(e.configuracion.lineas).toBe(31);
    expect(e.configuracion.curvatura).toBe(-2);
  });

  it('capturar pasa a secuencia; las escenas se reparten, se ordenan y se quitan', () => {
    const s = vacio();
    let e = editorNuevo(s.designSet);
    e = aplicar(e, { tipo: 'duracion', duracion: 9 }, { tipo: 'capturar', captura: capturaDelEditor(e, 6) });
    expect(e.modo).toBe('secuencia');
    e = aplicar(e, { tipo: 'parametro', parametro: 'pliegues', valor: 2.4 });
    e = aplicar(e, { tipo: 'capturar', captura: capturaDelEditor(e, 20) }, { tipo: 'capturar', captura: capturaDelEditor(e, 33) });
    const instantes = (x: EditorDeTrama) => {
      const t = tramaDelEditor(x, s.designSet).tiempo;
      return t.modo === 'secuencia' ? t.escenas.map((sc) => [sc.nombre, sc.t]) : [];
    };
    expect(instantes(e)).toEqual([['Escena 1', 0], ['Escena 2', 3], ['Escena 3', 6]]);
    e = aplicar(e, { tipo: 'mover-escena', clave: 3, hacia: -1 }, { tipo: 'renombrar-escena', clave: 3, nombre: 'Ola' });
    expect(instantes(e)).toEqual([['Escena 1', 0], ['Ola', 3], ['Escena 2', 6]]);
    e = aplicar(e, { tipo: 'quitar-escena', clave: 1 });
    expect(instantes(e)).toEqual([['Ola', 0], ['Escena 2', 4.5]]);
    // Sin cerrar el ciclo, la última cae al final.
    expect(instantes(aplicar(e, { tipo: 'cerrar-ciclo', cerrar: false }))).toEqual([['Ola', 0], ['Escena 2', 9]]);
  });

  it('con el ciclo cerrado, el último cuadro es el primero', () => {
    const s = conColores();
    let e = editorNuevo(s.designSet);
    e = aplicar(e, { tipo: 'duracion', duracion: 4 }, { tipo: 'capturar', captura: capturaDelEditor(e, 6) });
    e = aplicar(e, { tipo: 'parametro', parametro: 'anchoLamina', valor: 6 });
    e = aplicar(e, { tipo: 'capturar', captura: capturaDelEditor(e, 25) });
    const t = tramaDelEditor(e, s.designSet);
    expect(Array.from(cuadroEn(t, 4, 120, 68, 0.3).cuadro)).toEqual(Array.from(cuadroEn(t, 0, 120, 68, 0.3).cuadro));
    expect(Array.from(cuadroEn(t, 2, 120, 68, 0.3).cuadro)).not.toEqual(Array.from(cuadroEn(t, 0, 120, 68, 0.3).cuadro));
  });

  it('la captura no lleva velocidad, paralaje ni colores', () => {
    const c = capturaDelEditor(editorNuevo(null), 12.34567);
    expect(c.evolucion).toBe(12.346);
    expect(c.configuracion).not.toHaveProperty('velocidad');
    expect(c.configuracion).not.toHaveProperty('paralaje');
    expect(c).not.toHaveProperty('color');
  });

  it('importar y volver a exportar da la misma trama (CT1 de ida y vuelta)', () => {
    const s = conColores();
    let e = editorNuevo(s.designSet);
    e = aplicar(e, { tipo: 'color', clave: 'lejos', hex: '#336699' }, { tipo: 'duracion', duracion: 6 }, { tipo: 'capturar', captura: capturaDelEditor(e, 8) });
    e = aplicar(e, { tipo: 'capturar', captura: capturaDelEditor(e, 18) }, { tipo: 'formato', formato: '1x1' });
    const original = tramaDelEditor(e, s.designSet);
    const leida = leerTrama(codificarTrama(original));
    if (!leida.ok) throw new Error('no se leyó');
    const otra = editorDesdeTrama(leida.trama, s.designSet);
    expect(otra.formato).toBe('1x1');
    expect(otra.colores.lejos).toEqual({ hex: '#336699', origen: 'manual' });
    expect(tramaDelEditor(otra, s.designSet)).toEqual(original);
  });

  it('una trama con lienzo propio se importa como «importado» y conserva su lienzo', () => {
    const t = { ...tramaDelEditor(editorNuevo(null), null), lienzo: { tipo: 'proporcion', proporcion: 2.5 } } as Trama;
    const e = editorDesdeTrama(t, null);
    expect(e.formato).toBe(FORMATO_IMPORTADO);
    expect(tramaDelEditor(e, null).lienzo).toEqual({ tipo: 'proporcion', proporcion: 2.5 });
  });

  it('los errores de lectura se dicen en español, con su lugar', () => {
    const r = leerTrama('{"kind":"contope/trama","version":1,"motor":{"id":"superficie-de-puntos","version":"1.0.0"},"tiempo":{"modo":"secuencia"}}');
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(errorDeLectura(r.errores)).toMatch(/^No se pudo leer la trama: tiempo/);
    const basura = leerTrama('hola');
    expect(!basura.ok && errorDeLectura(basura.errores)).toContain('no se reconoce');
  });

  it('la Célula Madre del editor sale por el camino de siempre: zip con LEEME, ficha y los tres archivos', () => {
    const s = conColores();
    const e = aplicar(editorNuevo(s.designSet), { tipo: 'color', clave: 'cerca', hex: '#ff00aa' });
    const t = tramaDelEditor(e, s.designSet);
    const r = generarEnElTaller(s, generadorTrama, { receta: codificarTrama(t), formato: [e.formato] }, AHORA);
    if (!r.ok) throw new Error(r.falta);
    const zip = unzipSync(r.zip.contenido);
    expect(Object.keys(zip)).toEqual(['LEEME.md', 'nocturno.trama.json', 'nocturno.trama.txt', 'nocturno.trama.svg']);
    const ficha = leerMetadataDeLeeme(strFromU8(zip['LEEME.md']!));
    expect(ficha.ok && ficha.metadata.consulta).toEqual(['dim1.req01', 'dim1.req02']);
    const archivo = JSON.parse(strFromU8(zip['nocturno.trama.json']!)) as Trama;
    expect(validarTrama(archivo)).toEqual([]);
    expect(archivo.color.cerca).toEqual({ hex: '#ff00aa', origen: 'manual' });
    expect(archivo.color.fondo.origen).toBe('adn');
    expect(archivo.configuracion).toEqual(t.configuracion);
  });
});
