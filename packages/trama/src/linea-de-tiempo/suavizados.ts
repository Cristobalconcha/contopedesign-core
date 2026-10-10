/**
 * Curvas de interpolación de la línea de tiempo (`EASES`, `cubicBezier`,
 * `CURVES` y `easeOf` de v7, con nombres en español).
 */
import type { CurvaBezier, Keyframe, Suavizado } from '../formato/tipos.js';

export type FuncionDeSuavizado = (u: number) => number;

/** Las interpolaciones con nombre. `mantener` congela el valor hasta el siguiente keyframe. */
export const SUAVIZADO: Readonly<Record<Exclude<Suavizado, 'curva'>, FuncionDeSuavizado>> = Object.freeze({
  lineal: (u: number) => u,
  suave: (u: number) => u * u * (3 - 2 * u),
  entrada: (u: number) => u * u,
  salida: (u: number) => 1 - (1 - u) * (1 - u),
  mantener: () => 0,
});

/** Las curvas de tiempo con nombre del generador (las transiciones de escena). */
export const CURVAS: Readonly<Record<string, { etiqueta: string; c: CurvaBezier }>> = Object.freeze({
  lineal: { etiqueta: 'Lineal', c: [0, 0, 1, 1] },
  suave: { etiqueta: 'Suave', c: [0.42, 0, 0.58, 1] },
  entrada: { etiqueta: 'Acelera (entrada lenta)', c: [0.42, 0, 1, 1] },
  salida: { etiqueta: 'Frena (salida lenta)', c: [0, 0, 0.58, 1] },
  golpe: { etiqueta: 'Golpe (llega de inmediato)', c: [0.05, 0.9, 0.1, 1] },
  respiro: { etiqueta: 'Respiro (lento · rápido · lento)', c: [0.75, 0, 0.25, 1] },
  anticipa: { etiqueta: 'Anticipación (retrocede y parte)', c: [0.36, -0.45, 0.6, 1] },
  rebote: { etiqueta: 'Se pasa y vuelve', c: [0.3, 1.45, 0.6, 1] },
});

/** La curva por defecto de las transiciones: «suave». */
export const CURVA_SUAVE: CurvaBezier = [0.42, 0, 0.58, 1];

/** cubic-bezier como en CSS: Newton y, si no converge, bisección (`cubicBezier` de v7). */
export function bezierCubica(x1: number, y1: number, x2: number, y2: number): FuncionDeSuavizado {
  const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
  const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
  const sx = (t: number) => ((ax * t + bx) * t + cx) * t, sy = (t: number) => ((ay * t + by) * t + cy) * t, dx = (t: number) => (3 * ax * t + 2 * bx) * t + cx;
  return (u: number) => {
    if (u <= 0) return 0;
    if (u >= 1) return 1;
    let t = u;
    for (let i = 0; i < 8; i++) { const e = sx(t) - u, d = dx(t); if (Math.abs(e) < 1e-6 || Math.abs(d) < 1e-6) break; t -= e / d; }
    if (t < 0 || t > 1 || Math.abs(sx(t) - u) > 1e-4) {
      let lo = 0, hi = 1;
      t = u;
      for (let i = 0; i < 30; i++) { if (sx(t) < u) lo = t; else hi = t; t = (lo + hi) / 2; }
    }
    return sy(t);
  };
}

const cache = new Map<string, FuncionDeSuavizado>();

/** La función de un keyframe; una `curva` sin curva cae en lineal, como en v7. */
export function suavizadoDe(k: Pick<Keyframe, 'ease' | 'curva'>): FuncionDeSuavizado {
  if (k.ease === 'curva') {
    if (!k.curva) return SUAVIZADO.lineal;
    const clave = k.curva.join(',');
    let f = cache.get(clave);
    if (!f) { f = bezierCubica(...k.curva); cache.set(clave, f); }
    return f;
  }
  return SUAVIZADO[k.ease] ?? SUAVIZADO.lineal;
}
