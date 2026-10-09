/**
 * Validador del archivo de trama, escrito a mano (sin dependencias).
 *
 * Revisa la forma ESCRITA (con casi todo opcional) y devuelve TODOS los
 * errores que encuentra, cada uno con la ruta del campo en notación de
 * punto y corchetes (`tiempo.pistas.pliegues[2].t`) y un mensaje en
 * español. Lista vacía = válido. Nunca lanza.
 *
 * Es estricto a propósito: un campo desconocido es un error (si el formato
 * crece, sube su versión), los colores son `#rrggbb` y nada más, y los
 * números tienen límites duros (`LIMITES`). El archivo es sólo datos.
 */
import { MODOS } from '../dibujo/modo.js';
import { TINTAS } from '../dibujo/color.js';
import { NOMBRE_V7, PARAMETROS_MOTOR, type ParametroMotor } from '../motor/configuracion.js';
import { MOTOR_ID } from '../motor/lamina.js';
import { esRutaAnimable, PARAMETRO_ANIMABLE } from '../linea-de-tiempo/parametros.js';
import { LIMITES } from './limites.js';
import { CLAVES_DE_COLOR, FORMATO_VERSION, SUAVIZADOS, TRAMA_KIND } from './tipos.js';

export interface ErrorDeValidacion {
  /** Ruta del campo, p. ej. `color.fondo.hex`. Vacía = el documento entero. */
  ruta: string;
  mensaje: string;
}

export const PATRON_HEX = /^#[0-9a-fA-F]{6}$/;
const PATRON_SEMVER = /^(\d+)\.(\d+)\.(\d+)$/;

type Objeto = Record<string, unknown>;

const esObjeto = (x: unknown): x is Objeto => typeof x === 'object' && x !== null && !Array.isArray(x);
const unir = (base: string, clave: string | number) => (typeof clave === 'number' ? `${base}[${clave}]` : base ? `${base}.${clave}` : clave);

class Revision {
  errores: ErrorDeValidacion[] = [];
  error(ruta: string, mensaje: string): void { this.errores.push({ ruta, mensaje }); }

  objeto(x: unknown, ruta: string, permitidas: readonly string[]): x is Objeto {
    if (!esObjeto(x)) { this.error(ruta, 'debe ser un objeto'); return false; }
    for (const k of Object.keys(x)) if (!permitidas.includes(k)) this.error(unir(ruta, k), 'campo desconocido');
    return true;
  }

  numero(x: unknown, ruta: string, min: number = -LIMITES.numeroMax, max: number = LIMITES.numeroMax, entero = false): x is number {
    if (typeof x !== 'number' || !Number.isFinite(x)) { this.error(ruta, 'debe ser un número finito'); return false; }
    if (entero && !Number.isInteger(x)) { this.error(ruta, 'debe ser un número entero'); return false; }
    if (x < min || x > max) { this.error(ruta, `debe estar entre ${min} y ${max}`); return false; }
    return true;
  }

  booleano(x: unknown, ruta: string): x is boolean {
    if (typeof x !== 'boolean') { this.error(ruta, 'debe ser verdadero o falso (true/false)'); return false; }
    return true;
  }

  texto(x: unknown, ruta: string, max: number = LIMITES.textoCortoMax): x is string {
    if (typeof x !== 'string') { this.error(ruta, 'debe ser un texto'); return false; }
    if (x.length > max) { this.error(ruta, `es demasiado largo (máximo ${max} caracteres)`); return false; }
    return true;
  }

  opcion<T extends string>(x: unknown, ruta: string, opciones: readonly T[]): x is T {
    if (typeof x !== 'string' || !(opciones as readonly string[]).includes(x)) {
      this.error(ruta, `debe ser uno de: ${opciones.join(', ')}`);
      return false;
    }
    return true;
  }

  hex(x: unknown, ruta: string): x is string {
    if (typeof x !== 'string' || !PATRON_HEX.test(x)) { this.error(ruta, 'debe ser un color #rrggbb (seis cifras hexadecimales)'); return false; }
    return true;
  }

  curva(x: unknown, ruta: string): void {
    if (!Array.isArray(x) || x.length !== 4) { this.error(ruta, 'debe ser una curva [x1, y1, x2, y2]'); return; }
    x.forEach((v, i) => this.numero(v, unir(ruta, i), i % 2 === 0 ? 0 : -10, i % 2 === 0 ? 1 : 10));
  }
}

/** Revisa que `procedencia` sea JSON puro, acotado en tamaño y profundidad. */
function revisarProcedencia(r: Revision, x: unknown, ruta: string): void {
  if (!esObjeto(x)) { r.error(ruta, 'debe ser un objeto'); return; }
  let malo: string | null = null;
  const recorrer = (v: unknown, rr: string, prof: number): void => {
    if (malo) return;
    if (prof > LIMITES.procedenciaProfundidadMax) { malo = rr; return; }
    if (v === null || typeof v === 'string' || typeof v === 'boolean') return;
    if (typeof v === 'number') { if (!Number.isFinite(v)) malo = rr; return; }
    if (Array.isArray(v)) { v.forEach((w, i) => recorrer(w, unir(rr, i), prof + 1)); return; }
    if (esObjeto(v)) {
      const proto: unknown = Object.getPrototypeOf(v);
      if (proto === Object.prototype || proto === null) {
        for (const [k, w] of Object.entries(v)) recorrer(w, unir(rr, k), prof + 1);
        return;
      }
    }
    malo = rr; // función, símbolo, fecha, clase…: no es dato JSON
  };
  recorrer(x, ruta, 0);
  if (malo) { r.error(malo, 'sólo puede contener datos JSON (textos, números, booleanos, listas, objetos), con a lo más 32 niveles'); return; }
  if (JSON.stringify(x).length > LIMITES.procedenciaMax) r.error(ruta, `es demasiado grande (máximo ${LIMITES.procedenciaMax} bytes)`);
}

/** Revisa una configuración parcial (la de la trama o la de una captura). */
function revisarConfiguracion(r: Revision, x: unknown, ruta: string): void {
  if (!r.objeto(x, ruta, PARAMETROS_MOTOR)) return;
  for (const [k, v] of Object.entries(x)) {
    const p = k as ParametroMotor;
    if (!PARAMETROS_MOTOR.includes(p)) continue;
    if (p === 'lineas') r.numero(v, unir(ruta, k), LIMITES.lineasMin, LIMITES.lineasMax, true);
    else if (p === 'puntosPorLinea') r.numero(v, unir(ruta, k), LIMITES.puntosMin, LIMITES.puntosMax, true);
    else r.numero(v, unir(ruta, k));
  }
  const l = x['lineas'], m = x['puntosPorLinea'];
  if (typeof l === 'number' && typeof m === 'number' && l * m > LIMITES.puntosPorCuadroMax) {
    r.error(ruta, `líneas × puntos por línea no puede pasar de ${LIMITES.puntosPorCuadroMax}`);
  }
}

function revisarColor(r: Revision, x: unknown, ruta: string): void {
  if (typeof x === 'string') { r.hex(x, ruta); return; } // forma corta: sólo el hex, origen manual
  if (!r.objeto(x, ruta, ['hex', 'origen', 'rol', 'huella'])) return;
  if (!('hex' in x)) r.error(unir(ruta, 'hex'), 'falta el color');
  else r.hex(x['hex'], unir(ruta, 'hex'));
  if ('origen' in x) r.opcion(x['origen'], unir(ruta, 'origen'), ['adn', 'manual'] as const);
  if ('rol' in x) r.texto(x['rol'], unir(ruta, 'rol'));
  if ('huella' in x) r.texto(x['huella'], unir(ruta, 'huella'));
  if (x['origen'] !== 'adn' && ('rol' in x || 'huella' in x)) r.error(ruta, 'rol y huella sólo tienen sentido con origen «adn»');
}

function revisarFormatoAdn(r: Revision, x: unknown, ruta: string): void {
  if (!r.objeto(x, ruta, ['id', 'requisito', 'nombre', 'huella'])) return;
  if (!('id' in x)) r.error(unir(ruta, 'id'), 'falta el id del formato');
  for (const k of ['id', 'requisito', 'nombre', 'huella']) if (k in x) r.texto(x[k], unir(ruta, k));
}

function revisarLienzo(r: Revision, x: unknown, ruta: string): void {
  if (!esObjeto(x)) { r.error(ruta, 'debe ser un objeto'); return; }
  const tipo = x['tipo'];
  if (!r.opcion(tipo, unir(ruta, 'tipo'), ['libre', 'proporcion', 'medida'] as const)) return;
  const propios = tipo === 'libre' ? [] : tipo === 'proporcion' ? ['proporcion'] : ['ancho', 'alto'];
  r.objeto(x, ruta, ['tipo', 'formatoAdn', ...propios]);
  if (tipo === 'proporcion') {
    if (!('proporcion' in x)) r.error(unir(ruta, 'proporcion'), 'falta la proporción (ancho / alto)');
    else r.numero(x['proporcion'], unir(ruta, 'proporcion'), LIMITES.proporcionMin, LIMITES.proporcionMax);
  }
  if (tipo === 'medida') {
    for (const k of ['ancho', 'alto']) {
      if (!(k in x)) r.error(unir(ruta, k), `falta el ${k} en px`);
      else r.numero(x[k], unir(ruta, k), 1, LIMITES.medidaMax, true);
    }
  }
  if ('formatoAdn' in x) revisarFormatoAdn(r, x['formatoAdn'], unir(ruta, 'formatoAdn'));
}

function revisarCaptura(r: Revision, x: unknown, ruta: string): void {
  if (!r.objeto(x, ruta, ['evolucion', 'cursor', 'configuracion', 'color'])) return;
  if ('evolucion' in x) r.numero(x['evolucion'], unir(ruta, 'evolucion'));
  if ('cursor' in x && r.objeto(x['cursor'], unir(ruta, 'cursor'), ['x', 'y', 'presencia'])) {
    for (const [k, v] of Object.entries(x['cursor'] as Objeto)) r.numero(v, unir(unir(ruta, 'cursor'), k), -10, 10);
  }
  if ('configuracion' in x) revisarConfiguracion(r, x['configuracion'], unir(ruta, 'configuracion'));
  if ('color' in x && r.objeto(x['color'], unir(ruta, 'color'), CLAVES_DE_COLOR)) {
    for (const [k, v] of Object.entries(x['color'] as Objeto)) r.hex(v, unir(unir(ruta, 'color'), k));
  }
}

function revisarTransicion(r: Revision, x: Objeto, ruta: string): void {
  if ('transicion' in x) r.opcion(x['transicion'], unir(ruta, 'transicion'), ['morph', 'corte'] as const);
  if ('duracion' in x) r.numero(x['duracion'], unir(ruta, 'duracion'), LIMITES.duracionTransicionMin, LIMITES.duracionTransicionMax);
  if ('curva' in x) r.curva(x['curva'], unir(ruta, 'curva'));
}

function revisarTiempo(r: Revision, x: unknown, ruta: string, cuenta: { keyframes: number }): number | null {
  if (!esObjeto(x)) { r.error(ruta, 'debe ser un objeto'); return null; }
  const modo = x['modo'] ?? 'vivo';
  if (!r.opcion(modo, unir(ruta, 'modo'), ['vivo', 'secuencia'] as const)) return null;
  if (modo === 'vivo') {
    r.objeto(x, ruta, ['modo', 'inicio']);
    if ('inicio' in x) r.numero(x['inicio'], unir(ruta, 'inicio'));
    return null;
  }
  r.objeto(x, ruta, ['modo', 'inicio', 'duracion', 'pistas', 'escenas', 'cerrarCiclo', 'cierre', 'cursor', 'alTerminar']);
  if ('inicio' in x) r.numero(x['inicio'], unir(ruta, 'inicio'));
  let duracion: number | null = null;
  if (!('duracion' in x)) r.error(unir(ruta, 'duracion'), 'una secuencia necesita duración (segundos)');
  else if (r.numero(x['duracion'], unir(ruta, 'duracion'), 0, LIMITES.duracionMax)) {
    if (x['duracion'] === 0) r.error(unir(ruta, 'duracion'), 'debe ser mayor que 0');
    else duracion = x['duracion'];
  }
  const tMax = duracion ?? LIMITES.duracionMax;
  if ('pistas' in x) {
    const rp = unir(ruta, 'pistas');
    if (!esObjeto(x['pistas'])) r.error(rp, 'debe ser un objeto: ruta → lista de keyframes');
    else for (const [nombre, keys] of Object.entries(x['pistas'])) {
      const rk = unir(rp, nombre);
      if (!esRutaAnimable(nombre)) {
        const v7 = (Object.entries(NOMBRE_V7) as [string, string][]).find(([, n]) => n === nombre)?.[0];
        r.error(rk, nombre === 'velocidad' || nombre === 'paralaje' ? 'no es animable' : `no es una ruta animable${v7 ? ` (en este formato se llama «${v7}»)` : ''}`);
        continue;
      }
      const p = PARAMETRO_ANIMABLE[nombre]!;
      if (!Array.isArray(keys) || keys.length === 0) { r.error(rk, 'debe ser una lista con al menos un keyframe'); continue; }
      if (keys.length > LIMITES.keyframesPorPistaMax) { r.error(rk, `tiene demasiados keyframes (máximo ${LIMITES.keyframesPorPistaMax})`); continue; }
      cuenta.keyframes += keys.length;
      let previo = -Infinity;
      keys.forEach((k, i) => {
        const ri = unir(rk, i);
        if (!r.objeto(k, ri, ['t', 'v', 'ease', 'curva', 'escena'])) return;
        if (!('t' in k)) r.error(unir(ri, 't'), 'falta el instante');
        else if (r.numero(k['t'], unir(ri, 't'), 0, tMax)) {
          if ((k['t'] as number) <= previo) r.error(unir(ri, 't'), 'los keyframes deben ir en orden de t, sin repetir instantes');
          previo = k['t'] as number;
        }
        if (!('v' in k)) r.error(unir(ri, 'v'), 'falta el valor');
        else if (p.color) r.hex(k['v'], unir(ri, 'v'));
        else if (p.ruta === 'lineas') r.numero(k['v'], unir(ri, 'v'), LIMITES.lineasMin, LIMITES.lineasMax);
        else if (p.ruta === 'puntosPorLinea') r.numero(k['v'], unir(ri, 'v'), LIMITES.puntosMin, LIMITES.puntosMax);
        else r.numero(k['v'], unir(ri, 'v'));
        if ('ease' in k) r.opcion(k['ease'], unir(ri, 'ease'), SUAVIZADOS);
        if (k['ease'] === 'curva' && !('curva' in k)) r.error(unir(ri, 'curva'), 'un keyframe con ease «curva» necesita su curva');
        if ('curva' in k) r.curva(k['curva'], unir(ri, 'curva'));
        if ('escena' in k) r.numero(k['escena'], unir(ri, 'escena'), 0, Number.MAX_SAFE_INTEGER, true);
      });
    }
  }
  if ('escenas' in x) {
    const re = unir(ruta, 'escenas');
    const escenas = x['escenas'];
    if (!Array.isArray(escenas)) r.error(re, 'debe ser una lista');
    else if (escenas.length > LIMITES.escenasMax) r.error(re, `tiene demasiadas escenas (máximo ${LIMITES.escenasMax})`);
    else {
      const ids = new Set<number>();
      escenas.forEach((sc, i) => {
        const ri = unir(re, i);
        if (!r.objeto(sc, ri, ['id', 't', 'captura', 'transicion', 'duracion', 'curva', 'evolucion', 'nombre'])) return;
        if (!('id' in sc)) r.error(unir(ri, 'id'), 'falta el id');
        else if (r.numero(sc['id'], unir(ri, 'id'), 1, Number.MAX_SAFE_INTEGER, true)) {
          if (ids.has(sc['id'] as number)) r.error(unir(ri, 'id'), 'id repetido');
          ids.add(sc['id'] as number);
        }
        if (!('t' in sc)) r.error(unir(ri, 't'), 'falta el instante');
        else r.numero(sc['t'], unir(ri, 't'), 0, tMax);
        if (!('captura' in sc)) r.error(unir(ri, 'captura'), 'falta la captura');
        else revisarCaptura(r, sc['captura'], unir(ri, 'captura'));
        revisarTransicion(r, sc, ri);
        if ('evolucion' in sc) r.booleano(sc['evolucion'], unir(ri, 'evolucion'));
        if ('nombre' in sc) r.texto(sc['nombre'], unir(ri, 'nombre'));
      });
    }
  }
  if ('cerrarCiclo' in x) r.booleano(x['cerrarCiclo'], unir(ruta, 'cerrarCiclo'));
  if ('cierre' in x && r.objeto(x['cierre'], unir(ruta, 'cierre'), ['transicion', 'duracion', 'curva'])) revisarTransicion(r, x['cierre'] as Objeto, unir(ruta, 'cierre'));
  if ('cursor' in x && r.objeto(x['cursor'], unir(ruta, 'cursor'), ['x', 'y', 'presencia'])) {
    for (const [k, v] of Object.entries(x['cursor'] as Objeto)) r.numero(v, unir(unir(ruta, 'cursor'), k), -10, 10);
  }
  if ('alTerminar' in x) r.opcion(x['alTerminar'], unir(ruta, 'alTerminar'), ['repetir', 'detener'] as const);
  return duracion;
}

/** Valida un archivo de trama (ya parseado). Devuelve la lista de errores; vacía = válido. */
export function validarTrama(x: unknown): ErrorDeValidacion[] {
  const r = new Revision();
  if (!r.objeto(x, '', ['kind', 'version', 'motor', 'nombre', 'procedencia', 'lienzo', 'dibujo', 'color', 'configuracion', 'tiempo', 'interaccion', 'cuadroQuieto'])) return r.errores;
  if (x['kind'] !== TRAMA_KIND) r.error('kind', `debe ser «${TRAMA_KIND}»`);
  if (x['version'] !== FORMATO_VERSION) {
    r.error('version', typeof x['version'] === 'number' ? `versión de formato ${x['version']} no soportada: este lector entiende la ${FORMATO_VERSION}` : `debe ser ${FORMATO_VERSION}`);
  }
  if (!('motor' in x)) r.error('motor', 'falta el motor ({ id, version })');
  else if (r.objeto(x['motor'], 'motor', ['id', 'version'])) {
    const m = x['motor'] as Objeto;
    if (m['id'] !== MOTOR_ID) r.error('motor.id', `motor desconocido: este lector sólo tiene «${MOTOR_ID}»`);
    const v = typeof m['version'] === 'string' ? PATRON_SEMVER.exec(m['version']) : null;
    if (!v) r.error('motor.version', 'debe ser una versión x.y.z');
    else if (v[1] !== '1') r.error('motor.version', `motor ${String(m['version'])} no soportado: este lector tiene la versión 1.x`);
  }
  if ('nombre' in x) r.texto(x['nombre'], 'nombre');
  if ('procedencia' in x) revisarProcedencia(r, x['procedencia'], 'procedencia');
  if ('lienzo' in x) revisarLienzo(r, x['lienzo'], 'lienzo');
  if ('dibujo' in x && r.objeto(x['dibujo'], 'dibujo', ['modo', 'tinta'])) {
    const d = x['dibujo'] as Objeto;
    if ('modo' in d) r.opcion(d['modo'], 'dibujo.modo', MODOS);
    if ('tinta' in d) r.opcion(d['tinta'], 'dibujo.tinta', TINTAS);
  }
  if ('color' in x && r.objeto(x['color'], 'color', CLAVES_DE_COLOR)) {
    for (const [k, v] of Object.entries(x['color'] as Objeto)) revisarColor(r, v, unir('color', k));
  }
  if ('configuracion' in x) revisarConfiguracion(r, x['configuracion'], 'configuracion');
  const cuenta = { keyframes: 0 };
  const duracion = 'tiempo' in x ? revisarTiempo(r, x['tiempo'], 'tiempo', cuenta) : null;
  if (cuenta.keyframes > LIMITES.keyframesMax) r.error('tiempo.pistas', `demasiados keyframes en total (máximo ${LIMITES.keyframesMax})`);
  if ('interaccion' in x && r.objeto(x['interaccion'], 'interaccion', ['cursor', 'paralaje'])) {
    for (const [k, v] of Object.entries(x['interaccion'] as Objeto)) r.booleano(v, unir('interaccion', k));
  }
  if ('cuadroQuieto' in x) r.numero(x['cuadroQuieto'], 'cuadroQuieto', 0, duracion ?? LIMITES.numeroMax);
  return r.errores;
}

/** Texto legible de una lista de errores, uno por línea. */
export function describirErrores(errores: readonly ErrorDeValidacion[]): string {
  return errores.map((e) => `${e.ruta || '(documento)'}: ${e.mensaje}`).join('\n');
}
