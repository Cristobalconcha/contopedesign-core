/**
 * Formas de transporte del archivo de trama y su lectura.
 *
 * - JSON: el archivo `.trama.json`, la forma de referencia.
 * - `CT1.…`: el mismo documento en UNA línea, para un atributo HTML
 *   (`data-cod-trama="CT1.…"`), una receta del MCP o un portapapeles. Es
 *   base64url (sin `+`, `/` ni `=`: no hay que escapar nada en HTML ni en
 *   URL) del JSON compacto: sin los valores que son iguales a los por
 *   defecto y sin los keyframes que regeneran las escenas. No es otro
 *   formato: al leerse pasa por el mismo validador y el mismo normalizador.
 *   Sin compresión a propósito: deflate pediría una dependencia y haría el
 *   código opaco a la vista; una trama en vivo cabe en unos cientos de
 *   caracteres.
 * - `SP1.…`: los códigos de captura viejos de v7 (un instante). Se leen y se
 *   convierten a una trama en vivo que parte en ese instante.
 */
import { modoDe } from '../dibujo/modo.js';
import { CONFIGURACION_POR_DEFECTO, NOMBRE_V7, PARAMETROS_MOTOR, type ConfiguracionMotor } from '../motor/configuracion.js';
import { MOTOR_ID, MOTOR_VERSION } from '../motor/lamina.js';
import { base64ABytes, bytesABase64, bytesAUtf8, utf8ABytes } from './base64.js';
import { LIMITES } from './limites.js';
import { normalizarTrama } from './normalizar.js';
import { COLOR_CERCA_POR_DEFECTO, COLOR_FONDO_POR_DEFECTO, COLOR_LEJOS_POR_DEFECTO, tramaPorDefecto } from './por-defecto.js';
import { CLAVES_DE_COLOR, FORMATO_VERSION, TRAMA_KIND, type Keyframe, type Trama } from './tipos.js';
import { PATRON_HEX, validarTrama, type ErrorDeValidacion } from './validar.js';

export const PREFIJO_CODIGO = 'CT1.';
export const PREFIJO_SP1 = 'SP1.';

export type OrigenDeLectura = 'json' | 'objeto' | 'ct1' | 'sp1';

export type LecturaDeTrama =
  | { ok: true; trama: Trama; origen: OrigenDeLectura; avisos: string[] }
  | { ok: false; errores: ErrorDeValidacion[]; origen?: OrigenDeLectura };

type Objeto = Record<string, unknown>;
const esObjeto = (x: unknown): x is Objeto => typeof x === 'object' && x !== null && !Array.isArray(x);
const falla = (mensaje: string, origen?: OrigenDeLectura): LecturaDeTrama =>
  origen ? { ok: false, errores: [{ ruta: '', mensaje }], origen } : { ok: false, errores: [{ ruta: '', mensaje }] };

/**
 * Convierte una captura de v7 (el JSON dentro de un `SP1.`) en un documento
 * de trama: un instante → modo vivo con ese inicio. Lo que la captura no
 * trae queda con su valor por defecto; lo que no se entiende se ignora.
 */
export function capturaV7ATrama(st: Objeto): { documento: Objeto; avisos: string[] } {
  const avisos: string[] = [];
  const cfg = esObjeto(st['cfg']) ? st['cfg'] : {};
  const configuracion: Partial<ConfiguracionMotor> = {};
  for (const p of PARAMETROS_MOTOR) {
    const v = cfg[NOMBRE_V7[p]];
    if (typeof v === 'number' && Number.isFinite(v)) configuracion[p] = v;
  }
  const hex = (v: unknown, porDefecto: string) => (typeof v === 'string' && PATRON_HEX.test(v) ? v.toLowerCase() : porDefecto);
  const tinta = cfg['inkMode'] === 'luz' || cfg['inkMode'] === 'tinta' ? cfg['inkMode'] : 'auto';
  const documento: Objeto = {
    kind: TRAMA_KIND,
    version: FORMATO_VERSION,
    motor: { id: MOTOR_ID, version: MOTOR_VERSION },
    dibujo: { modo: modoDe(st, 'puntos'), tinta },
    color: {
      lejos: hex(cfg['colorDeep'], COLOR_LEJOS_POR_DEFECTO),
      cerca: hex(cfg['colorAccent'], COLOR_CERCA_POR_DEFECTO),
      fondo: hex(cfg['colorBg'], COLOR_FONDO_POR_DEFECTO),
    },
    configuracion,
    tiempo: { modo: 'vivo', inicio: st['time'] },
  };
  const formato = typeof st['format'] === 'string' ? /^(\d+)x(\d+)$/.exec(st['format']) : null;
  if (formato) documento['lienzo'] = { tipo: 'medida', ancho: Number(formato[1]), alto: Number(formato[2]) };
  if (st['blend']) avisos.push('la captura se tomó a mitad de un morf: se usó el momento de partida');
  return { documento, avisos };
}

function lecturaDeDocumento(doc: unknown, origen: OrigenDeLectura, avisos: string[] = []): LecturaDeTrama {
  const errores = validarTrama(doc);
  if (errores.length) return { ok: false, errores, origen };
  return { ok: true, trama: normalizarTrama(doc), origen, avisos };
}

/**
 * Lee una trama desde un texto (JSON, `CT1.…` o `SP1.…`) o desde un objeto
 * ya parseado. Nunca lanza: devuelve la trama normalizada o los errores.
 */
export function leerTrama(entrada: unknown): LecturaDeTrama {
  if (typeof entrada !== 'string') {
    return esObjeto(entrada) ? lecturaDeDocumento(entrada, 'objeto') : falla('se esperaba un texto o un objeto');
  }
  if (entrada.length > LIMITES.textoMaximo) return falla(`el texto es demasiado grande (máximo ${LIMITES.textoMaximo} caracteres)`);
  const texto = entrada.trim();
  if (texto.startsWith(PREFIJO_SP1)) {
    let st: unknown;
    try { st = JSON.parse(bytesAUtf8(base64ABytes(texto.slice(4)))); } catch { return falla('código SP1 ilegible (base64 o JSON roto)', 'sp1'); }
    if (!esObjeto(st) || typeof st['time'] !== 'number' || !Number.isFinite(st['time']) || !esObjeto(st['cfg'])) {
      return falla('código SP1 sin instante (time) o sin configuración (cfg)', 'sp1');
    }
    const { documento, avisos } = capturaV7ATrama(st);
    return lecturaDeDocumento(documento, 'sp1', avisos);
  }
  if (texto.startsWith(PREFIJO_CODIGO)) {
    let doc: unknown;
    try { doc = JSON.parse(bytesAUtf8(base64ABytes(texto.slice(4)))); } catch { return falla('código CT1 ilegible (base64 o JSON roto)', 'ct1'); }
    return lecturaDeDocumento(doc, 'ct1');
  }
  if (texto.startsWith('{')) {
    let doc: unknown;
    try { doc = JSON.parse(texto); } catch (e) { return falla(`JSON inválido: ${(e as Error).message}`, 'json'); }
    return lecturaDeDocumento(doc, 'json');
  }
  return falla('no se reconoce: se esperaba un archivo de trama en JSON o un código CT1. o SP1.');
}

/**
 * El documento más corto que normaliza a la misma trama: sin valores por
 * defecto, colores manuales en forma corta y sin los keyframes de escena.
 */
export function compactarTrama(trama: Trama): Objeto {
  const d = tramaPorDefecto();
  const o: Objeto = { kind: trama.kind, version: trama.version, motor: { ...trama.motor } };
  if (trama.nombre !== undefined) o['nombre'] = trama.nombre;
  if (trama.procedencia !== undefined) o['procedencia'] = trama.procedencia;
  if (trama.lienzo.tipo !== 'libre' || trama.lienzo.formatoAdn) o['lienzo'] = trama.lienzo;
  const dibujo: Objeto = {};
  if (trama.dibujo.modo !== d.dibujo.modo) dibujo['modo'] = trama.dibujo.modo;
  if (trama.dibujo.tinta !== d.dibujo.tinta) dibujo['tinta'] = trama.dibujo.tinta;
  if (Object.keys(dibujo).length) o['dibujo'] = dibujo;
  const color: Objeto = {};
  for (const k of CLAVES_DE_COLOR) {
    const c = trama.color[k];
    const simple = c.origen === 'manual' && c.rol === undefined && c.huella === undefined;
    if (simple && c.hex === d.color[k].hex) continue;
    color[k] = simple ? c.hex : c;
  }
  if (Object.keys(color).length) o['color'] = color;
  const cfg: Objeto = {};
  for (const p of PARAMETROS_MOTOR) if (trama.configuracion[p] !== CONFIGURACION_POR_DEFECTO[p]) cfg[p] = trama.configuracion[p];
  if (Object.keys(cfg).length) o['configuracion'] = cfg;
  const t = trama.tiempo;
  if (t.modo === 'vivo') {
    if (t.inicio !== d.tiempo.inicio) o['tiempo'] = { modo: 'vivo', inicio: t.inicio };
  } else {
    const pistas: Objeto = {};
    for (const [ruta, keys] of Object.entries(t.pistas) as [string, Keyframe[]][]) {
      const manuales = keys.filter((k) => k.escena === undefined);
      if (manuales.length) pistas[ruta] = manuales;
    }
    o['tiempo'] = { ...t, pistas };
  }
  if (trama.interaccion.cursor !== d.interaccion.cursor || trama.interaccion.paralaje !== d.interaccion.paralaje) o['interaccion'] = trama.interaccion;
  if (trama.cuadroQuieto !== d.cuadroQuieto) o['cuadroQuieto'] = trama.cuadroQuieto;
  return o;
}

/** La trama como código `CT1.…` de una línea. */
export function codificarTrama(trama: Trama): string {
  return PREFIJO_CODIGO + bytesABase64(utf8ABytes(JSON.stringify(compactarTrama(trama))), true);
}

/** La trama como archivo JSON legible (la forma completa, normalizada). */
export function escribirTrama(trama: Trama): string {
  return JSON.stringify(trama, null, 2) + '\n';
}
