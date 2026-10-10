/**
 * Los puntos de un cuadro, agrupados por tono y nivel de alfa como los
 * dibuja `drawDots` de v7: 12 tonos × 4 niveles = 48 grupos, cada uno con un
 * solo color y un solo alfa.
 */
import { ALFA_MINIMO_PUNTO, nivelDeAlfa, tonoDeCercania } from './color.js';

/** Con opacidad de punto menor o igual a esto, la capa de puntos no se dibuja. */
export const OPACIDAD_MINIMA_PUNTOS = 0.005;

/**
 * Llama a `fn` por cada punto visible del cuadro con el índice de su primer
 * valor (`k`: x = cuadro[k], y = cuadro[k+1], radio = cuadro[k+2]), su tono
 * (0..11) y su nivel de alfa (0..3). No llama a nada si la opacidad es ~0.
 */
export function recorrerPuntos(
  cuadro: ArrayLike<number>,
  opacidadPunto: number,
  fn: (k: number, tono: number, nivel: number) => void,
): void {
  const da = opacidadPunto;
  if (da <= OPACIDAD_MINIMA_PUNTOS) return;
  for (let k = 0; k < cuadro.length; k += 5) {
    const a = cuadro[k + 4]! * da;
    if (a < ALFA_MINIMO_PUNTO) continue;
    fn(k, tonoDeCercania(cuadro[k + 3]!), nivelDeAlfa(a));
  }
}

/** Índice de grupo (0..47) de un tono y un nivel: tono × 4 + nivel. */
export const grupoDePunto = (tono: number, nivel: number): number => tono * 4 + nivel;
