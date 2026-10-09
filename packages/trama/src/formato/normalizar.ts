/**
 * Normalizador: de la forma escrita (casi todo opcional) a la `Trama`
 * completa. Completa los valores por defecto, expande la forma corta de los
 * colores y, en una secuencia, REGENERA los keyframes de las escenas (los
 * que traen `escena`), con la escena de cierre si `cerrarCiclo`. Así un
 * archivo no puede decir una cosa en sus escenas y otra en sus pistas.
 *
 * Valida primero: con un documento inválido lanza `ErrorDeTrama` con todos
 * los errores. El resultado es una copia; la entrada no se toca.
 */
import { CURVA_SUAVE } from '../linea-de-tiempo/suavizados.js';
import { regenerarPistas } from '../linea-de-tiempo/escenas.js';
import { PARAMETROS_MOTOR } from '../motor/configuracion.js';
import { CIERRE_POR_DEFECTO, CURSOR_POR_DEFECTO, DURACION_DE_ESCENA_POR_DEFECTO, tramaPorDefecto } from './por-defecto.js';
import {
  CLAVES_DE_COLOR,
  type Captura, type ColorDeTrama, type CurvaBezier, type Escena, type Keyframe, type Lienzo, type Pistas, type RutaAnimable,
  type TiempoDeTrama, type TiempoSecuencia, type Trama,
} from './tipos.js';
import { describirErrores, validarTrama, type ErrorDeValidacion } from './validar.js';

export class ErrorDeTrama extends Error {
  readonly errores: ErrorDeValidacion[];
  constructor(errores: ErrorDeValidacion[]) {
    super('archivo de trama inválido:\n' + describirErrores(errores));
    this.name = 'ErrorDeTrama';
    this.errores = errores;
  }
}

type Objeto = Record<string, unknown>;
const comoObjeto = (x: unknown): Objeto => (typeof x === 'object' && x !== null ? (x as Objeto) : {});
const copiaJson = <T>(x: T): T => JSON.parse(JSON.stringify(x)) as T;

function color(x: unknown, porDefecto: ColorDeTrama): ColorDeTrama {
  if (x === undefined) return { ...porDefecto };
  if (typeof x === 'string') return { hex: x.toLowerCase(), origen: 'manual' };
  const o = comoObjeto(x);
  const c: ColorDeTrama = { hex: String(o['hex']).toLowerCase(), origen: o['origen'] === 'adn' ? 'adn' : 'manual' };
  if (typeof o['rol'] === 'string') c.rol = o['rol'];
  if (typeof o['huella'] === 'string') c.huella = o['huella'];
  return c;
}

function captura(x: unknown): Captura {
  const o = copiaJson(comoObjeto(x)) as Captura;
  if (o.color) for (const k of CLAVES_DE_COLOR) if (o.color[k]) o.color[k] = o.color[k]!.toLowerCase();
  return o;
}

function tiempo(x: unknown, base: Pick<Trama, 'configuracion' | 'color'>): TiempoDeTrama {
  const o = comoObjeto(x);
  const inicio = typeof o['inicio'] === 'number' ? o['inicio'] : tramaPorDefecto().tiempo.inicio;
  if ((o['modo'] ?? 'vivo') === 'vivo') return { modo: 'vivo', inicio };
  const cierre = comoObjeto(o['cierre']);
  const cursor = comoObjeto(o['cursor']);
  const pistas: Pistas = {};
  for (const [ruta, keys] of Object.entries(comoObjeto(o['pistas']))) {
    pistas[ruta as RutaAnimable] = (keys as Objeto[]).map((k) => {
      const kf: Keyframe = { t: k['t'] as number, v: typeof k['v'] === 'string' ? k['v'].toLowerCase() : (k['v'] as number), ease: (k['ease'] as Keyframe['ease']) ?? 'lineal' };
      if (k['curva']) kf.curva = [...(k['curva'] as CurvaBezier)];
      if (typeof k['escena'] === 'number') kf.escena = k['escena'];
      return kf;
    });
  }
  const escenas: Escena[] = (Array.isArray(o['escenas']) ? (o['escenas'] as Objeto[]) : []).map((sc) => {
    const e: Escena = {
      id: sc['id'] as number,
      t: sc['t'] as number,
      captura: captura(sc['captura']),
      transicion: sc['transicion'] === 'corte' ? 'corte' : 'morph',
      duracion: typeof sc['duracion'] === 'number' ? sc['duracion'] : DURACION_DE_ESCENA_POR_DEFECTO,
      curva: sc['curva'] ? [...(sc['curva'] as CurvaBezier)] : [...CURVA_SUAVE],
      evolucion: sc['evolucion'] !== false,
    };
    if (typeof sc['nombre'] === 'string') e.nombre = sc['nombre'];
    return e;
  }).sort((a, b) => a.t - b.t);
  const secuencia: TiempoSecuencia = {
    modo: 'secuencia',
    inicio,
    duracion: o['duracion'] as number,
    pistas,
    escenas,
    cerrarCiclo: o['cerrarCiclo'] === true,
    cierre: {
      transicion: cierre['transicion'] === 'corte' ? 'corte' : CIERRE_POR_DEFECTO.transicion,
      duracion: typeof cierre['duracion'] === 'number' ? cierre['duracion'] : CIERRE_POR_DEFECTO.duracion,
      curva: cierre['curva'] ? [...(cierre['curva'] as CurvaBezier)] : [...CIERRE_POR_DEFECTO.curva],
    },
    cursor: {
      x: typeof cursor['x'] === 'number' ? cursor['x'] : CURSOR_POR_DEFECTO.x,
      y: typeof cursor['y'] === 'number' ? cursor['y'] : CURSOR_POR_DEFECTO.y,
      presencia: typeof cursor['presencia'] === 'number' ? cursor['presencia'] : CURSOR_POR_DEFECTO.presencia,
    },
    alTerminar: o['alTerminar'] === 'detener' ? 'detener' : 'repetir',
  };
  secuencia.pistas = regenerarPistas(secuencia, {
    configuracion: base.configuracion,
    colores: { lejos: base.color.lejos.hex, cerca: base.color.cerca.hex, fondo: base.color.fondo.hex },
  });
  return secuencia;
}

/** La trama completa a partir de un documento escrito. Lanza `ErrorDeTrama` si no es válido. */
export function normalizarTrama(x: unknown): Trama {
  const errores = validarTrama(x);
  if (errores.length) throw new ErrorDeTrama(errores);
  const o = comoObjeto(x);
  const d = tramaPorDefecto();
  const trama: Trama = { ...d, motor: { id: d.motor.id, version: String(comoObjeto(o['motor'])['version']) } };
  if (typeof o['nombre'] === 'string') trama.nombre = o['nombre'];
  if (o['procedencia'] !== undefined) trama.procedencia = copiaJson(o['procedencia'] as Record<string, unknown>);
  if (o['lienzo'] !== undefined) trama.lienzo = copiaJson(o['lienzo'] as Lienzo);
  const dibujo = comoObjeto(o['dibujo']);
  trama.dibujo = { modo: (dibujo['modo'] as Trama['dibujo']['modo']) ?? d.dibujo.modo, tinta: (dibujo['tinta'] as Trama['dibujo']['tinta']) ?? d.dibujo.tinta };
  const c = comoObjeto(o['color']);
  trama.color = { lejos: color(c['lejos'], d.color.lejos), cerca: color(c['cerca'], d.color.cerca), fondo: color(c['fondo'], d.color.fondo) };
  const cfg = comoObjeto(o['configuracion']);
  for (const p of PARAMETROS_MOTOR) if (typeof cfg[p] === 'number') trama.configuracion[p] = cfg[p];
  trama.tiempo = tiempo(o['tiempo'], trama);
  const i = comoObjeto(o['interaccion']);
  trama.interaccion = {
    cursor: typeof i['cursor'] === 'boolean' ? i['cursor'] : d.interaccion.cursor,
    paralaje: typeof i['paralaje'] === 'boolean' ? i['paralaje'] : d.interaccion.paralaje,
  };
  if (typeof o['cuadroQuieto'] === 'number') trama.cuadroQuieto = o['cuadroQuieto'];
  return trama;
}
