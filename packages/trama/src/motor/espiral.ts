/**
 * El segundo motor: «Espiral de Fibonacci con hilos» (v10 del generador).
 *
 * Es `computeEspiral` de v10, portado sin cambiar fórmulas, constantes ni
 * el orden de las operaciones (los puntos y la curva se guardan en
 * `Float32Array`, como en v10):
 *  - PUNTOS en filotaxis de Vogel: el punto n está en el ángulo n × ángulo
 *    áureo y a radio c·√n;
 *  - una CURVA guía que nace recta desde el centro y se enrolla hasta la
 *    espiral áurea (r crece φ veces por cuarto de vuelta): su rumbo en el
 *    arco s es enrollado × ln((r0 + s·k) / r0) / b;
 *  - HILOS de cada punto a su lugar en la curva: el punto n va a la
 *    fracción n/N del largo.
 * Es 2D. La secuencia está en el propio tiempo: un ciclo de 25,4 s a
 * velocidad 1 (nacimiento 0–2 s, línea 1,5–3 s, enrollado 3–9 s,
 * expansión 9–18 s y reposo).
 */

/** Razón áurea. */
export const PHI = (1 + Math.sqrt(5)) / 2;
/** Ángulo áureo (rad): 2π (1 − 1/φ), ≈ 137,5°. */
export const ANGULO_AUREO = Math.PI * 2 * (1 - 1 / PHI);
/** b de la espiral áurea r = a·e^(bθ): r crece φ veces por cuarto de vuelta. */
export const B_AUREA = Math.log(PHI) / (Math.PI / 2);
/** Segundos de un ciclo de la secuencia a velocidad 1. */
export const CICLO_ESPIRAL = 25.4;

/** Lo que el cálculo de la espiral lee de la configuración (en v10, `espPuntos`, `speed`…). */
export interface ConfiguracionEspiral {
  /** Velocidad: el tiempo de la secuencia es evolución × velocidad (`speed`). */
  velocidad: number;
  /** Puntos del disco (`espPuntos`). */
  puntos: number;
  /** Giro del disco, en grados (`espGiro`). */
  giro: number;
  /** Separación de los puntos (`espEscalaPuntos`). */
  escalaPuntos: number;
  /** Cuánto se expanden los puntos al final (`espExpPuntos`). */
  expPuntos: number;
  /** Tamaño de la espiral (`espEscalaEspiral`). */
  escalaEspiral: number;
  /** Cuánto se expande la espiral (`espExpEspiral`). */
  expEspiral: number;
  /** Largo de la curva (`espLargo`). */
  largo: number;
  /** Enrollado: 0 recta, 1 áurea (`espEnrollado`). */
  enrollado: number;
  /** Ojo del centro, en fracción del lado menor (`espOjo`). */
  ojo: number;
  /** Fracción de hilos visibles (`espHilos`). */
  hilos: number;
  /** Tamaño del punto, en px a 1080 (`espTamPunto`). */
  tamPunto: number;
}

export interface EstadoEspiral {
  /** Evolución, en segundos de la trama. */
  tiempo: number;
  configuracion: ConfiguracionEspiral;
}

export interface CuadroEspiral {
  /** Por punto: x, y, radio y visibilidad (0..1). */
  puntos: Float32Array;
  /** La curva: M + 1 vértices (x, y); el primero es el centro. */
  curva: Float32Array;
  /** Pares [punto, vértice de la curva] de los hilos visibles. */
  hilos: number[];
  /** Largo de la curva, en px. */
  largo: number;
  /** px por unidad (lado menor / 1080). */
  px: number;
}

const acotar01 = (x: number): number => Math.min(Math.max(x, 0), 1);
const suave = (x: number): number => { x = acotar01(x); return x * x * (3 - 2 * x); };

/** Los puntos, la curva y los hilos de la espiral en un cuadro de W × H. */
export function calcularEspiral(estado: EstadoEspiral, W: number, H: number, calidad = 1): CuadroEspiral {
  const cfg = estado.configuracion, S = Math.min(W, H), px = S / 1080;
  const u = ((estado.tiempo * cfg.velocidad) % CICLO_ESPIRAL + CICLO_ESPIRAL) % CICLO_ESPIRAL;
  const N = Math.max(10, Math.round(cfg.puntos));
  const nace = 1 - (1 - acotar01(u / 2)) ** 2, expa = suave((u - 9) / 9);
  const vis = N * nace;
  const c = cfg.escalaPuntos * 0.32 * S / Math.sqrt(N) * (1 + (cfg.expPuntos - 1) * expa);
  const giro = (cfg.giro - 25 * (1 - nace)) * Math.PI / 180;
  const cx = W / 2, cy = H / 2;
  const puntos = new Float32Array(N * 4);
  for (let n = 0; n < N; n++) {
    const th = n * ANGULO_AUREO + giro, r = c * Math.sqrt(n);
    puntos[n * 4] = cx + r * Math.cos(th); puntos[n * 4 + 1] = cy - r * Math.sin(th);
    puntos[n * 4 + 2] = cfg.tamPunto * px / 2; puntos[n * 4 + 3] = acotar01(vis - n);
  }
  // largo de la curva: nace en 2–3 s, crece mientras se enrolla y en la expansión
  let L = 0;
  if (u >= 1.5) L = 0.5 * S * (1 - (1 - acotar01((u - 1.5) / 1.5)) ** 2);
  if (u >= 3) L = 0.5 * S + 0.7 * S * suave((u - 3) / 6);
  if (u >= 9) L = 1.2 * S + 1.0 * S * expa;
  L *= cfg.largo;
  const enr = cfg.enrollado * Math.pow(suave((u - 3) / 6), 1.6);
  const a = cfg.escalaEspiral * (1 + (cfg.expEspiral - 1) * expa);
  const M = Math.max(60, Math.round(480 * calidad)), r0 = Math.max(1e-4, cfg.ojo) * S, k = B_AUREA / Math.sqrt(1 + B_AUREA * B_AUREA);
  const curva = new Float32Array((M + 1) * 2);
  let x = 0, y = 0; const ds = L / M;
  curva[0] = cx; curva[1] = cy;
  for (let j = 1; j <= M; j++) {
    const s = (j - 0.5) * ds, h = enr * Math.log((r0 + s * k) / r0) / B_AUREA;
    x += Math.cos(h) * ds; y += Math.sin(h) * ds;
    curva[j * 2] = cx + x * a; curva[j * 2 + 1] = cy - y * a;
  }
  const hv = suave((u - 2) / 3) * cfg.hilos, hilos: number[] = [];
  if (L > 0) for (let n = 0; n < N; n++) {
    if (n >= vis || n >= hv * N) break;
    hilos.push(n, Math.min(M, Math.round(n / N * M)));
  }
  return { puntos, curva, hilos, largo: L, px };
}
