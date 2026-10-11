/**
 * Tramos → geometría de tiras de triángulos para WebGL.
 *
 * Las líneas nativas de WebGL miden 1 px; para dibujar el grosor real cada
 * trazo se convierte en una tira (`TRIANGLE_STRIP`) con dos vértices por
 * punto, a medio grosor a cada lado:
 *  - en un punto interior, los dos vértices van sobre la bisectriz del
 *    ángulo (unión en inglete), así los segmentos vecinos comparten borde y
 *    no queda hueco entre ellos; en ángulos muy cerrados el inglete se acota
 *    a dos veces el medio grosor, para que no salga una espina;
 *  - en los extremos, la tira se prolonga medio grosor (el remate redondo de
 *    canvas, aproximado en cuadrado).
 * Todos los trazos van en una sola tira, unidos con triángulos degenerados
 * (se repite el último vértice de un trazo y el primero del siguiente), para
 * dibujar todo con una sola llamada.
 *
 * Cada vértice lleva 6 valores: x, y (px del lienzo × escala), r, g, b
 * (0..1) y alfa (0..1, acotado: canvas acota el alfa de `rgba` igual).
 */
import type { Rgb } from './color.js';
import { trazosDeTramo, type Tramo } from './tramos.js';

export const VALORES_POR_VERTICE = 6;

export interface TirasDeTriangulos {
  /** x, y, r, g, b, alfa por vértice. */
  vertices: Float32Array;
  /** Cantidad de vértices (vertices.length / 6). */
  cantidad: number;
}

export interface OpcionesDeTiras {
  /** Multiplica posiciones y grosor (p. ej. la densidad de píxeles). Por defecto 1. */
  escala?: number;
}

/** Inglete máximo, en medios grosores. */
const INGLETE_MAXIMO = 2;

export function tirasDeTramos(cuadro: ArrayLike<number>, tramos: readonly Tramo[], tonos: readonly Rgb[], opciones: OpcionesDeTiras = {}): TirasDeTriangulos {
  const escala = opciones.escala ?? 1;
  const salida: number[] = [];
  const trazoActual: number[] = [];
  const vertice = (x: number, y: number, c: Rgb, a: number) => {
    trazoActual.push(x, y, c[0] / 255, c[1] / 255, c[2] / 255, a);
  };
  for (const tramo of tramos) {
    const color = tonos[tramo.tono]!;
    const alfa = Math.min(1, Math.max(0, tramo.alfa));
    const h = (tramo.grosor * escala) / 2;
    for (const trazo of trazosDeTramo(cuadro, tramo)) {
      // puntos del trazo, sin repetidos (un segmento de largo 0 no tiene dirección)
      const xs: number[] = [], ys: number[] = [];
      for (const q of trazo) {
        const x = cuadro[q]! * escala, y = cuadro[q + 1]! * escala;
        const n = xs.length;
        if (n && Math.abs(x - xs[n - 1]!) < 1e-6 && Math.abs(y - ys[n - 1]!) < 1e-6) continue;
        xs.push(x); ys.push(y);
      }
      const n = xs.length;
      if (n < 2) continue;
      // direcciones unitarias de cada segmento
      const dx: number[] = [], dy: number[] = [];
      for (let i = 0; i < n - 1; i++) {
        const ex = xs[i + 1]! - xs[i]!, ey = ys[i + 1]! - ys[i]!, l = Math.hypot(ex, ey);
        dx.push(ex / l); dy.push(ey / l);
      }
      trazoActual.length = 0;
      for (let i = 0; i < n; i++) {
        let px = xs[i]!, py = ys[i]!, nx: number, ny: number, largo = h;
        if (i === 0 || i === n - 1) {
          const s = i === 0 ? 0 : n - 2;
          nx = -dy[s]!; ny = dx[s]!;
          // remate: prolongar medio grosor hacia afuera
          const sentido = i === 0 ? -1 : 1;
          px += dx[s]! * h * sentido; py += dy[s]! * h * sentido;
        } else {
          const tx = dx[i - 1]! + dx[i]!, ty = dy[i - 1]! + dy[i]!, tl = Math.hypot(tx, ty);
          const n0x = -dy[i - 1]!, n0y = dx[i - 1]!;
          if (tl < 1e-6) { nx = n0x; ny = n0y; } // vuelta en U: sin bisectriz
          else {
            nx = -ty / tl; ny = tx / tl;
            const coseno = nx * n0x + ny * n0y;
            largo = h / Math.max(coseno, 1 / INGLETE_MAXIMO);
          }
        }
        vertice(px + nx * largo, py + ny * largo, color, alfa);
        vertice(px - nx * largo, py - ny * largo, color, alfa);
      }
      if (salida.length) {
        // degenerados: repetir el último vértice anterior y el primero de este trazo
        const fin = salida.length;
        for (let j = fin - VALORES_POR_VERTICE; j < fin; j++) salida.push(salida[j]!);
        for (let j = 0; j < VALORES_POR_VERTICE; j++) salida.push(trazoActual[j]!);
      }
      for (const v of trazoActual) salida.push(v);
    }
  }
  return { vertices: Float32Array.from(salida), cantidad: salida.length / VALORES_POR_VERTICE };
}
