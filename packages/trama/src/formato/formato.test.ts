import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CONFIGURACION_POR_DEFECTO, NOMBRE_V7, PARAMETROS_MOTOR } from '../motor/configuracion.js';
import { cuadroEn } from '../reproduccion.js';
import { base64ABytes, bytesABase64, bytesAUtf8, utf8ABytes } from './base64.js';
import { codificarTrama, compactarTrama, escribirTrama, leerTrama } from './codigo.js';
import { ErrorDeTrama, normalizarTrama } from './normalizar.js';
import { tramaPorDefecto } from './por-defecto.js';
import { validarTrama } from './validar.js';

const cabecera = { kind: 'contope/trama', version: 1, motor: { id: 'superficie-de-puntos', version: '1.0.0' } };

/** El ejemplo completo del README. */
const EJEMPLO = {
  ...cabecera,
  nombre: 'Portada Nocturno',
  procedencia: { kind: 'contope/celula-madre', sistema: { id: 'nocturno', nombre: 'Nocturno' }, generador: { id: 'trama', version: '0.1.0' } },
  lienzo: { tipo: 'proporcion', proporcion: 1.7778, formatoAdn: { id: 'pantalla-16-9', requisito: 'dim3.req05' } },
  dibujo: { modo: 'mixto', tinta: 'auto' },
  color: {
    lejos: { hex: '#1d3fb8', origen: 'adn', rol: 'dim1.req02:primario', huella: 'a1b2c3d4e5f60718' },
    cerca: { hex: '#3bb8a8', origen: 'adn', rol: 'dim1.req02:acento', huella: '0f1e2d3c4b5a6978' },
    fondo: '#000000',
  },
  configuracion: { lineas: 44, puntosPorLinea: 300, grosor: 2, grosorLinea: 0.45, opacidadLinea: 0.32 },
  tiempo: {
    modo: 'secuencia', inicio: 6, duracion: 8, cerrarCiclo: true, alTerminar: 'repetir',
    cierre: { transicion: 'morph', duracion: 1.5, curva: [0.42, 0, 0.58, 1] },
    escenas: [
      { id: 1, t: 0, nombre: 'Lámina plegada', captura: { evolucion: 6 } },
      { id: 2, t: 4, nombre: 'Ola amplia', transicion: 'morph', duracion: 2, curva: [0.75, 0, 0.25, 1], evolucion: true,
        captura: { evolucion: 31.5, configuracion: { anchoLamina: 6, torsion: 0.2, pliegues: 2.4, curvatura: 3 } } },
    ],
    pistas: { 'cursor.presencia': [{ t: 1, v: 0, ease: 'suave' }, { t: 3, v: 1, ease: 'mantener' }, { t: 6, v: 0 }] },
  },
  interaccion: { cursor: true, paralaje: false },
  cuadroQuieto: 4,
};

describe('validador', () => {
  it('el ejemplo completo del README es este mismo y es válido', () => {
    const readme = readFileSync(new URL('../../README.md', import.meta.url), 'utf8');
    const bloque = /```json\n([\s\S]*?)\n```/.exec(readme)![1]!;
    expect(JSON.parse(bloque)).toEqual(EJEMPLO);
  });

  it('un documento mínimo (sólo cabecera) y el ejemplo completo son válidos', () => {
    expect(validarTrama(cabecera)).toEqual([]);
    expect(validarTrama(EJEMPLO)).toEqual([]);
  });

  it('errores con la ruta del campo, en español, todos a la vez', () => {
    const errores = validarTrama({
      ...cabecera, version: 2, sobra: 1,
      color: { fondo: { hex: '#fff"/><script>' }, cerca: '#12345' },
      configuracion: { lineas: 64.5, pliegues: 'mucho' },
      tiempo: { modo: 'secuencia', duracion: 4, pistas: { velocidad: [{ t: 0, v: 1 }], fold: [{ t: 0, v: 1 }], pliegues: [{ t: 2, v: 1 }, { t: 1, v: 2 }, { t: 9, v: 1, ease: 'curva' }] } },
    });
    const por = Object.fromEntries(errores.map((e) => [e.ruta, e.mensaje]));
    expect(por['version']).toMatch(/versión de formato 2 no soportada/);
    expect(por['sobra']).toBe('campo desconocido');
    expect(por['color.fondo.hex']).toMatch(/#rrggbb/);
    expect(por['color.cerca']).toMatch(/#rrggbb/);
    expect(por['configuracion.lineas']).toMatch(/entero/);
    expect(por['configuracion.pliegues']).toMatch(/número/);
    expect(por['tiempo.pistas.velocidad']).toBe('no es animable');
    expect(por['tiempo.pistas.fold']).toMatch(/«pliegues»/);
    expect(por['tiempo.pistas.pliegues[1].t']).toMatch(/orden/);
    expect(por['tiempo.pistas.pliegues[2].t']).toMatch(/entre 0 y 4/);
    expect(por['tiempo.pistas.pliegues[2].curva']).toMatch(/necesita su curva/);
  });

  it('límites duros contra archivos que congelarían el reproductor', () => {
    const e = validarTrama({ ...cabecera, configuracion: { lineas: 1000, puntosPorLinea: 4000 } });
    expect(e).toEqual([{ ruta: 'configuracion', mensaje: expect.stringMatching(/no puede pasar de 500000/) }]);
    expect(validarTrama({ ...cabecera, tiempo: { modo: 'secuencia', duracion: 601 } })[0]!.ruta).toBe('tiempo.duracion');
  });

  it('motor desconocido o de otra versión mayor', () => {
    expect(validarTrama({ ...cabecera, motor: { id: 'aurora', version: '1.0.0' } })[0]!.ruta).toBe('motor.id');
    expect(validarTrama({ ...cabecera, motor: { id: 'superficie-de-puntos', version: '2.0.0' } })[0]!.mensaje).toMatch(/no soportado/);
    expect(validarTrama({ ...cabecera, motor: { id: 'superficie-de-puntos', version: '1.7.0' } })).toEqual([]);
  });

  it('procedencia: opaca pero sólo datos JSON', () => {
    expect(validarTrama({ ...cabecera, procedencia: { a: [1, { b: null }] } })).toEqual([]);
    expect(validarTrama({ ...cabecera, procedencia: { f: () => 1 } })[0]!.ruta).toBe('procedencia.f');
    expect(validarTrama({ ...cabecera, procedencia: { d: new Date(0) } })[0]!.ruta).toBe('procedencia.d');
  });

  it('el lienzo sólo admite los campos de su tipo', () => {
    expect(validarTrama({ ...cabecera, lienzo: { tipo: 'medida', ancho: 1920, alto: 1080 } })).toEqual([]);
    expect(validarTrama({ ...cabecera, lienzo: { tipo: 'libre', proporcion: 2 } })[0]!.ruta).toBe('lienzo.proporcion');
    expect(validarTrama({ ...cabecera, lienzo: { tipo: 'proporcion' } })[0]!.ruta).toBe('lienzo.proporcion');
  });

  it('rol y huella sólo con origen adn; el id de escena 0 está reservado', () => {
    expect(validarTrama({ ...cabecera, color: { lejos: { hex: '#000000', rol: 'x' } } })[0]!.ruta).toBe('color.lejos');
    expect(validarTrama({ ...cabecera, tiempo: { modo: 'secuencia', duracion: 2, escenas: [{ id: 0, t: 1, captura: {} }] } })[0]!.ruta).toBe('tiempo.escenas[0].id');
  });
});

describe('normalizador', () => {
  it('completa los valores por defecto', () => {
    expect(normalizarTrama(cabecera)).toEqual(tramaPorDefecto());
  });
  it('expande la forma corta de los colores, conserva origen y procedencia', () => {
    const t = normalizarTrama(EJEMPLO);
    expect(t.color.fondo).toEqual({ hex: '#000000', origen: 'manual' });
    expect(t.color.cerca).toEqual({ hex: '#3bb8a8', origen: 'adn', rol: 'dim1.req02:acento', huella: '0f1e2d3c4b5a6978' });
    expect(t.procedencia).toEqual(EJEMPLO.procedencia);
    expect(t.configuracion.lineas).toBe(44);
    expect(t.configuracion.pliegues).toBe(CONFIGURACION_POR_DEFECTO.pliegues);
  });
  it('con un documento inválido lanza ErrorDeTrama con todos los errores', () => {
    try { normalizarTrama({ ...cabecera, color: { fondo: 'rojo' } }); throw new Error('no lanzó'); }
    catch (e) { expect(e).toBeInstanceOf(ErrorDeTrama); expect((e as ErrorDeTrama).errores[0]!.ruta).toBe('color.fondo'); }
  });
  it('es idempotente: normalizar lo normalizado da lo mismo', () => {
    const t = normalizarTrama(EJEMPLO);
    expect(normalizarTrama(JSON.parse(escribirTrama(t)))).toEqual(t);
  });
});

describe('lectura: JSON, CT1 y SP1', () => {
  it('JSON', () => {
    const r = leerTrama(JSON.stringify(EJEMPLO));
    expect(r.ok && r.origen).toBe('json');
  });

  it('CT1: una línea segura para HTML y URL, que vuelve a la misma trama', () => {
    const t = normalizarTrama(EJEMPLO);
    const codigo = codificarTrama(t);
    expect(codigo).toMatch(/^CT1\.[A-Za-z0-9_-]+$/);
    const r = leerTrama(codigo);
    expect(r.ok).toBe(true);
    if (r.ok) { expect(r.origen).toBe('ct1'); expect(r.trama).toEqual(t); }
    expect(codificarTrama(tramaPorDefecto()).length).toBeLessThan(160);
    expect(compactarTrama(tramaPorDefecto())).toEqual(cabecera);
  });

  it('SP1: un instante → trama en vivo que parte en ese instante, con la misma imagen', () => {
    // el código de referencia de probar-trama.mjs: DEFAULTS del motor de Publisher, tiempo 6, dotted
    const cfg: Record<string, number> = {};
    for (const p of PARAMETROS_MOTOR) cfg[NOMBRE_V7[p]] = CONFIGURACION_POR_DEFECTO[p];
    const ref = { time: 6, cam: [0, 0], mouse: [0.5, 0.5], presence: 0, cfg: { ...cfg, colorDeep: '#2a52d6', colorAccent: '#3dd6c0' }, dotted: true };
    const codigo = 'SP1.' + Buffer.from(JSON.stringify(ref), 'utf8').toString('base64');
    const r = leerTrama(codigo);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.origen).toBe('sp1');
    expect(r.trama.tiempo).toEqual({ modo: 'vivo', inicio: 6 });
    expect(r.trama.dibujo.modo).toBe('puntos');
    const { cuadro } = cuadroEn(r.trama, 0, 1600, 900, 1);
    const h = createHash('sha256').update(Buffer.from(Float32Array.from(cuadro, (v) => Math.round(v * 100) / 100).buffer)).digest('hex').slice(0, 16);
    expect(h).toBe('9c130d7e7d11640b');
  });

  it('SP1 de v7 con render, formato y tinta; y uno a mitad de morf avisa', () => {
    const st = { time: 3.5, render: 'lineas', format: '1920x1080', cfg: { fold: 2, colorBg: '#F1EDE4', inkMode: 'tinta', lineWeight: 2 }, blend: { e: 0.4 } };
    const r = leerTrama('SP1.' + Buffer.from(JSON.stringify(st)).toString('base64'));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.trama.configuracion.pliegues).toBe(2);
    expect(r.trama.configuracion.grosorLinea).toBe(2);
    expect(r.trama.color.fondo.hex).toBe('#f1ede4');
    expect(r.trama.dibujo).toEqual({ modo: 'lineas', tinta: 'tinta' });
    expect(r.trama.lienzo).toEqual({ tipo: 'medida', ancho: 1920, alto: 1080 });
    expect(r.avisos[0]).toMatch(/morf/);
  });

  it('nunca lanza: códigos rotos, vacíos o desconocidos devuelven errores', () => {
    for (const malo of ['SP1.no-es-base64!!', 'SP1.' + Buffer.from('{"time":"x"}').toString('base64'), 'CT1.%%%', '', 'XX1.abc', '{roto', 42, null]) {
      const r = leerTrama(malo);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.errores.length).toBeGreaterThan(0);
    }
  });

  it('base64 y UTF-8 propios: ida y vuelta con tildes, eñes y emoji, en los dos alfabetos', () => {
    const texto = 'Señal «ñandú» — 🌊 ok';
    expect(bytesAUtf8(utf8ABytes(texto))).toBe(texto);
    expect(bytesABase64(utf8ABytes(texto))).toBe(Buffer.from(texto, 'utf8').toString('base64'));
    expect(bytesAUtf8(base64ABytes(bytesABase64(utf8ABytes(texto), true)))).toBe(texto);
  });
});
