/**
 * Las líneas de la lámina, en tramos de 6 puntos, cada uno con el color, el
 * alfa y el grosor de su punto central (`lineTramos` de v7). Un tramo
 * comparte su último punto con el primero del siguiente, así la línea no se
 * corta. Dentro de un tramo, un punto detrás de la cámara (radio 0) levanta
 * el lápiz: por eso un tramo puede tener varios trazos.
 */
import { tonoDeCercania } from './color.js';

/** Puntos que avanza cada tramo. */
export const PUNTOS_POR_TRAMO = 6;
/** Con opacidad de línea menor o igual a esto, la capa de líneas no se dibuja. */
export const OPACIDAD_MINIMA_LINEAS = 0.002;
/** Un tramo con alfa menor que esto no se dibuja. */
export const ALFA_MINIMO_TRAMO = 0.008;

export interface Tramo {
  /** Índice en el cuadro del primer valor del primer punto. */
  inicio: number;
  /** Índice en el cuadro del primer valor del último punto (incluido). */
  fin: number;
  /** Tono (0..11) del punto central. */
  tono: number;
  /** Alfa del punto central × opacidad de línea (puede pasar de 1: se acota al pintar). */
  alfa: number;
  /** Grosor en px: radio del punto central × grosor de línea, mínimo 0,2. */
  grosor: number;
}

export interface OpcionesDeLinea {
  grosorLinea: number;
  opacidadLinea: number;
}

/** Los tramos de un cuadro de `puntosPorLinea` puntos por línea. */
export function tramosDeLinea(cuadro: ArrayLike<number>, puntosPorLinea: number, opciones: OpcionesDeLinea): Tramo[] {
  const la = opciones.opacidadLinea, lw = opciones.grosorLinea;
  const salida: Tramo[] = [];
  if (la <= OPACIDAD_MINIMA_LINEAS) return salida;
  const largo = puntosPorLinea * 5;
  for (let base = 0; base + largo <= cuadro.length; base += largo) {
    for (let k = 0; k + 5 < largo; k += 5 * PUNTOS_POR_TRAMO) {
      const end = Math.min(largo - 5, k + 5 * PUNTOS_POR_TRAMO), mid = base + k + Math.floor((end - k) / 10) * 5;
      const a = cuadro[mid + 4]! * la;
      if (a < ALFA_MINIMO_TRAMO) continue;
      salida.push({ inicio: base + k, fin: base + end, tono: tonoDeCercania(cuadro[mid + 3]!), alfa: a, grosor: Math.max(0.2, cuadro[mid + 2]! * lw) });
    }
  }
  return salida;
}

/**
 * Los trazos de un tramo: listas de índices de punto (el índice de x en el
 * cuadro), cortadas donde un punto está detrás de la cámara. Un trazo de un
 * solo punto queda fuera (en canvas, un `moveTo` sin `lineTo` no pinta).
 */
export function trazosDeTramo(cuadro: ArrayLike<number>, tramo: Tramo): number[][] {
  const trazos: number[][] = [];
  let actual: number[] = [];
  for (let q = tramo.inicio; q <= tramo.fin; q += 5) {
    if (cuadro[q + 2] === 0) {
      if (actual.length > 1) trazos.push(actual);
      actual = [];
      continue;
    }
    actual.push(q);
  }
  if (actual.length > 1) trazos.push(actual);
  return trazos;
}
