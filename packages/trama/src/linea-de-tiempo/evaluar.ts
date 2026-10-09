/**
 * Evaluación determinística de una trama en un instante: `staticValue`,
 * `interp`, `valueAt`, `evolutionAt` y `evalState` de v7.
 *
 * La EVOLUCIÓN es especial. Entre dos keyframes suyos:
 *  - `lineal`: recorre el tiempo del motor de un valor al otro;
 *  - `mantener`: lo congela;
 *  - cualquier otro (suave, entrada, salida, curva): MORF. Los dos momentos
 *    siguen vivos (el primero avanza desde su keyframe, el segundo llega al
 *    suyo) y el cuadro es la mezcla de ambos con el peso de la curva.
 * Antes del primer keyframe y después del último, la evolución corre a 1 s
 * por segundo (salvo que el último sea `mantener`).
 */
import type { TintaElegida } from '../dibujo/color.js';
import { mezclarHex } from '../dibujo/color.js';
import type { ModoDeDibujo } from '../dibujo/modo.js';
import type { ConfiguracionMotor } from '../motor/configuracion.js';
import type { EstadoMotor } from '../motor/lamina.js';
import type { ClaveDeColor, CursorDeTrama, Keyframe, Pistas, RutaAnimable, Trama } from '../formato/tipos.js';
import { PARAMETRO_ANIMABLE, PARAMETROS_ANIMABLES, type ParametroAnimable } from './parametros.js';
import { suavizadoDe } from './suavizados.js';

/** Lo que la línea de tiempo necesita de una trama (el `doc` de v7). */
export interface DocumentoDeLinea {
  configuracion: ConfiguracionMotor;
  colores: Record<ClaveDeColor, string>;
  pistas: Pistas;
  /** Evolución en el instante 0 (`startTime` de v7). */
  inicio: number;
  cursor: CursorDeTrama;
}

export const CURSOR_EN_REPOSO: Readonly<CursorDeTrama> = Object.freeze({ x: 0.5, y: 0.5, presencia: 0 });

export function documentoDeTrama(trama: Trama): DocumentoDeLinea {
  const tiempo = trama.tiempo;
  return {
    configuracion: trama.configuracion,
    colores: { lejos: trama.color.lejos.hex, cerca: trama.color.cerca.hex, fondo: trama.color.fondo.hex },
    pistas: tiempo.modo === 'secuencia' ? tiempo.pistas : {},
    inicio: tiempo.inicio,
    cursor: tiempo.modo === 'secuencia' ? tiempo.cursor : { ...CURSOR_EN_REPOSO },
  };
}

/** El valor de una ruta cuando no está animada (`staticValue`). */
export function valorFijo(doc: DocumentoDeLinea, ruta: RutaAnimable, t: number): number | string {
  if (ruta === 'evolucion') return doc.inicio + t;
  if (ruta === 'cursor.x') return doc.cursor.x;
  if (ruta === 'cursor.y') return doc.cursor.y;
  if (ruta === 'cursor.presencia') return doc.cursor.presencia;
  if (ruta === 'color.lejos') return doc.colores.lejos;
  if (ruta === 'color.cerca') return doc.colores.cerca;
  if (ruta === 'color.fondo') return doc.colores.fondo;
  return doc.configuracion[ruta];
}

/** Interpola keyframes ordenados en t (`interp`). Un parámetro entero salta. */
export function interpolar(keys: readonly Keyframe[], t: number, p: Pick<ParametroAnimable, 'entero' | 'color'> | undefined): number | string {
  const primero = keys[0]!;
  if (t <= primero.t) return primero.v;
  const ultimo = keys[keys.length - 1]!;
  if (t >= ultimo.t) return ultimo.v;
  let i = 0;
  while (i < keys.length - 2 && keys[i + 1]!.t <= t) i++;
  const a = keys[i]!, b = keys[i + 1]!;
  if (a.ease === 'mantener' || p?.entero) return a.v;
  const u = suavizadoDe(a)((t - a.t) / (b.t - a.t));
  return p?.color ? mezclarHex(String(a.v), String(b.v), u) : (a.v as number) + ((b.v as number) - (a.v as number)) * u;
}

/** El valor de una ruta en t (`valueAt`). */
export function valorEn(doc: DocumentoDeLinea, ruta: RutaAnimable, t: number): number | string {
  const k = doc.pistas[ruta];
  return k && k.length ? interpolar(k, t, PARAMETRO_ANIMABLE[ruta]) : valorFijo(doc, ruta, t);
}

export interface Evolucion {
  /** Tiempo de evolución del momento principal. */
  tiempo: number;
  /** En un morf: el tiempo del segundo momento y el peso de la mezcla (0..1). */
  tiempoB?: number;
  mezcla?: number;
}

/** La evolución en t (`evolutionAt`). */
export function evolucionEn(doc: DocumentoDeLinea, t: number): Evolucion {
  const keys = doc.pistas.evolucion;
  if (!keys || !keys.length) return { tiempo: valorEn(doc, 'evolucion', t) as number };
  const primero = keys[0]!, ultimo = keys[keys.length - 1]!;
  const v = (k: Keyframe) => k.v as number;
  if (t <= primero.t) return { tiempo: v(primero) - (primero.t - t) };
  if (t >= ultimo.t) return { tiempo: ultimo.ease === 'mantener' ? v(ultimo) : v(ultimo) + (t - ultimo.t) };
  let i = 0;
  while (i < keys.length - 2 && keys[i + 1]!.t <= t) i++;
  const a = keys[i]!, b = keys[i + 1]!, u = (t - a.t) / (b.t - a.t);
  if (a.ease === 'mantener') return { tiempo: v(a) };
  if (a.ease === 'lineal') return { tiempo: v(a) + (v(b) - v(a)) * u };
  return { tiempo: v(a) + (t - a.t), tiempoB: v(b) - (b.t - t), mezcla: suavizadoDe(a)(u) };
}

/** Lo que se necesita para calcular y dibujar un instante. */
export interface EstadoDeTrama {
  motor: EstadoMotor;
  colores: Record<ClaveDeColor, string>;
  modo: ModoDeDibujo;
  tinta: TintaElegida;
}

/** El estado del motor y los colores en t (`evalState`, sin cámara). */
export function estadoDeDocumento(doc: DocumentoDeLinea, t: number): { motor: EstadoMotor; colores: Record<ClaveDeColor, string> } {
  const configuracion: ConfiguracionMotor = { ...doc.configuracion };
  const colores = { ...doc.colores };
  for (const p of PARAMETROS_ANIMABLES) {
    if (p.ruta === 'evolucion' || p.ruta.startsWith('cursor.')) continue;
    const keys = doc.pistas[p.ruta];
    if (!keys || !keys.length) continue;
    const v = interpolar(keys, t, p);
    if (p.color) colores[p.ruta.slice(6) as ClaveDeColor] = v as string;
    else configuracion[p.ruta as keyof ConfiguracionMotor] = p.entero ? Math.round(v as number) : (v as number);
  }
  const evo = evolucionEn(doc, t);
  const cursor: [number, number] = [valorEn(doc, 'cursor.x', t) as number, valorEn(doc, 'cursor.y', t) as number];
  const presencia = valorEn(doc, 'cursor.presencia', t) as number;
  const motor: EstadoMotor = { tiempo: evo.tiempo, camara: [0, 0], cursor, presencia, configuracion };
  if (evo.mezcla != null && evo.mezcla !== 0 && evo.mezcla !== 1) {
    motor.mezcla = { e: evo.mezcla, estado: { tiempo: evo.tiempoB!, camara: [0, 0], cursor, presencia, configuracion } };
  }
  return { motor, colores };
}

/** Lo que el reproductor sabe del mundo real: el cursor y el paralaje. */
export interface Entorno {
  /** Cursor real, 0..1 desde abajo a la izquierda. */
  cursor?: readonly [number, number];
  presencia?: number;
  /** Paralaje, -1..1. */
  camara?: readonly [number, number];
}

/**
 * El estado de una trama en el instante t (segundos desde que empieza).
 * En vivo, el entorno aporta el cursor y el paralaje si la interacción los
 * permite. En una secuencia manda lo grabado: el cursor de sus pistas.
 */
export function estadoEn(trama: Trama, t: number, entorno: Entorno = {}): EstadoDeTrama {
  const { motor, colores } = estadoDeDocumento(documentoDeTrama(trama), t);
  if (trama.tiempo.modo === 'vivo') {
    if (trama.interaccion.cursor && entorno.cursor) {
      motor.cursor = [entorno.cursor[0], entorno.cursor[1]];
      motor.presencia = entorno.presencia ?? 1;
    }
    if (trama.interaccion.paralaje && entorno.camara) motor.camara = [entorno.camara[0], entorno.camara[1]];
  }
  return { motor, colores, modo: trama.dibujo.modo, tinta: trama.dibujo.tinta };
}
