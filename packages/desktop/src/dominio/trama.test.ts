import { generadorTrama, leerMetadataDeLeeme } from '@contope/core';
import { leerTrama, tramaDeEstadoV7, validarTrama, type EstadoV7, type Trama } from '@contope/trama';
import { strFromU8, unzipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { buildDim3EspacioDesignSet } from '../../../core/src/design-set/dim3-fixture.js';
import { generarEnElTaller } from './celulas.js';
import { reducir } from './reductor.js';
import { nuevoSistema, type Sistema } from './sistema.js';
import { coloresParaElGenerador, errorDeLectura, esMensajeDelGenerador, formatosParaElGenerador, FUENTE_DEL_GENERADOR, parametrosDeCelula } from './trama.js';

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

/** Lo que v7 entrega con sus colores del ADN sin tocar y una línea de tiempo con dos escenas. */
function estadoDeV7(colores: Record<string, string>): EstadoV7 {
  const cfg = { lineCount: 40, points: 120, colorDeep: colores['lejos'], colorAccent: colores['cerca'], colorBg: colores['fondo'], inkMode: 'auto' };
  const st = (time: number, fold: number) => ({ time, mouse: [0.5, 0.5], presence: 0, cfg: { ...cfg, fold } });
  return {
    cfg, render: 'puntos', time: 12, format: '1920x1080', nombre: 'Cinta',
    tl: {
      duration: 8, startTime: 6, cursor: { x: 0.5, y: 0.5, presence: 0 },
      tracks: { twist: [{ t: 1, v: 0.2, ease: 'ease' }, { t: 5, v: 1.4, ease: 'linear' }] },
      scenes: [
        { id: 1, t: 0, snap: 1, st: st(10, 1), type: 'morph', dur: 1, curve: [0.42, 0, 0.58, 1], evo: true },
        { id: 2, t: 4, snap: 2, st: st(30, 2.2), type: 'cut', dur: 1, curve: [0.42, 0, 0.58, 1], evo: true },
      ],
    },
  };
}

describe('La pantalla de la trama: el puente con el generador v7', () => {
  it('con ADN, los colores de partida salen del ADN por rol, con su origen', () => {
    const c = coloresParaElGenerador(conColores().designSet);
    expect(c.fondo).toMatchObject({ hex: '#0b0f14', origen: 'adn', rol: 'dim1.req02:background' });
    expect(c.cerca).toMatchObject({ hex: '#e0a040', origen: 'adn', rol: 'dim1.req02:accent' });
    expect(c.lejos).toMatchObject({ hex: '#1d3fb8', origen: 'adn', rol: 'dim1.req01:institucionales:Azul' });
  });

  it('sin ADN no se manda ningún color (v7 conserva los suyos) ni formato', () => {
    expect(coloresParaElGenerador(vacio().designSet)).toEqual({});
    expect(formatosParaElGenerador(vacio().designSet)).toEqual([]);
    expect(coloresParaElGenerador(null)).toEqual({});
  });

  it('los formatos de hoja del ADN llegan con el valor ANCHOxALTO que entiende v7 y su formatoAdn', () => {
    const f = formatosParaElGenerador(buildDim3EspacioDesignSet());
    expect(f.length).toBeGreaterThan(0);
    for (const x of f) {
      expect(x.valor).toMatch(/^\d+x\d+$/);
      expect(x.clave).toMatch(/^adn:/);
      expect(x.lienzo).toMatchObject({ tipo: 'medida', formatoAdn: { requisito: 'dim3.req08' } });
      if (x.lienzo.tipo === 'medida') expect(x.valor).toBe(`${x.lienzo.ancho}x${x.lienzo.alto}`);
    }
  });

  it('sólo se aceptan mensajes del generador con su forma', () => {
    expect(esMensajeDelGenerador({ fuente: FUENTE_DEL_GENERADOR, tipo: 'listo' })).toBe(true);
    expect(esMensajeDelGenerador({ fuente: FUENTE_DEL_GENERADOR, tipo: 'trama', pedido: 1, error: 'x' })).toBe(true);
    expect(esMensajeDelGenerador({ fuente: FUENTE_DEL_GENERADOR, tipo: 'trama', pedido: 1 })).toBe(false);
    expect(esMensajeDelGenerador({ fuente: FUENTE_DEL_GENERADOR, tipo: 'trama-exportada', trama: {} })).toBe(true);
    expect(esMensajeDelGenerador({ fuente: FUENTE_DEL_GENERADOR, tipo: 'trama-exportada' })).toBe(false);
    expect(esMensajeDelGenerador({ fuente: 'otra', tipo: 'listo' })).toBe(false);
    expect(esMensajeDelGenerador('listo')).toBe(false);
  });

  it('la trama de v7 baja como Célula Madre con su línea de tiempo entera, y vuelve igual', () => {
    const s = conColores();
    const adn = coloresParaElGenerador(s.designSet);
    const trama = tramaDeEstadoV7(estadoDeV7({ lejos: adn.lejos!.hex, cerca: '#ff0000', fondo: adn.fondo!.hex }), { colores: adn });
    expect(trama.color.lejos.origen).toBe('adn');
    expect(trama.color.cerca).toEqual({ hex: '#ff0000', origen: 'manual' });
    const r = generarEnElTaller(s, generadorTrama, parametrosDeCelula(trama), AHORA);
    if (!r.ok) throw new Error(r.falta);
    const archivos = unzipSync(r.zip.contenido);
    const nombre = (sufijo: string) => Object.keys(archivos).find((n) => n.endsWith(sufijo))!;
    const json = JSON.parse(strFromU8(archivos[nombre('.trama.json')]!)) as Trama;
    expect(validarTrama(json)).toEqual([]);
    // la línea de tiempo llega entera: pistas, escenas y su regeneración
    expect(json.tiempo).toEqual(trama.tiempo);
    expect(json.color).toEqual(trama.color);
    expect(json.configuracion).toEqual(trama.configuracion);
    expect(json.nombre).toBe('Cinta');
    // el código CT1 del zip es la misma trama
    const ct1 = leerTrama(strFromU8(archivos[nombre('.txt')]!));
    if (!ct1.ok) throw new Error('CT1 ilegible');
    expect(ct1.trama.tiempo).toEqual(trama.tiempo);
    // y la metadata de ancestro dice de qué definiciones salió
    const meta = leerMetadataDeLeeme(strFromU8(archivos[nombre('LEEME.md')]!));
    expect(meta.ok && meta.metadata.consulta).toEqual(['dim1.req01', 'dim1.req02']);
  });

  it('sin ADN también baja la Célula Madre', () => {
    const trama = tramaDeEstadoV7(estadoDeV7({ lejos: '#2a52d6', cerca: '#3dd6c0', fondo: '#000000' }));
    const r = generarEnElTaller(vacio(), generadorTrama, parametrosDeCelula(trama));
    expect(r.ok).toBe(true);
    expect(parametrosDeCelula(trama)).toMatchObject({ colores: 'look', modo: 'secuencia', ancho: 1920 });
  });

  it('los errores de lectura se dicen en español, los primeros tres', () => {
    const e = errorDeLectura([{ ruta: 'a', mensaje: 'uno.' }, { ruta: '', mensaje: 'dos' }, { ruta: 'c', mensaje: 'tres' }, { ruta: 'd', mensaje: 'cuatro' }]);
    expect(e).toBe('No se pudo leer la trama: a: uno; dos; c: tres (y 1 más).');
  });
});
