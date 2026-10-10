import { describe, expect, it } from 'vitest';
import { configuracionEspiralDeV7 } from '../formato/generador-v7.js';
import { ANGULO_AUREO, B_AUREA, calcularEspiral, CICLO_ESPIRAL, PHI } from './espiral.js';

/*
 * `computeEspiral` de v10 tal cual (superficie-v10.html), con sus constantes
 * y ayudantes, como referencia: el motor del paquete debe dar lo mismo.
 */
/* eslint-disable */
const V10 = (() => {
  const PHI = (1 + Math.sqrt(5)) / 2, ANG_AUREO = Math.PI * 2 * (1 - 1 / PHI), B_AUREA = Math.log(PHI) / (Math.PI / 2);
  const ESP_CICLO = 25.4;
  const clamp01 = (x: number) => Math.min(Math.max(x, 0), 1);
  const suave = (x: number) => { x = clamp01(x); return x * x * (3 - 2 * x); };
  function computeEspiral(state: any, W: number, H: number, quality = 1) {
    const cfg = state.cfg, S = Math.min(W, H), px = S / 1080;
    const u = ((state.time * cfg.speed) % ESP_CICLO + ESP_CICLO) % ESP_CICLO;
    const N = Math.max(10, Math.round(cfg.espPuntos));
    const nace = 1 - (1 - clamp01(u / 2)) ** 2, expa = suave((u - 9) / 9);
    const vis = N * nace;
    const c = cfg.espEscalaPuntos * 0.32 * S / Math.sqrt(N) * (1 + (cfg.espExpPuntos - 1) * expa);
    const giro = (cfg.espGiro - 25 * (1 - nace)) * Math.PI / 180;
    const cx = W / 2, cy = H / 2;
    const pts = new Float32Array(N * 4);
    for (let n = 0; n < N; n++) {
      const th = n * ANG_AUREO + giro, r = c * Math.sqrt(n);
      pts[n * 4] = cx + r * Math.cos(th); pts[n * 4 + 1] = cy - r * Math.sin(th);
      pts[n * 4 + 2] = cfg.espTamPunto * px / 2; pts[n * 4 + 3] = clamp01(vis - n);
    }
    let L = 0;
    if (u >= 1.5) L = 0.5 * S * (1 - (1 - clamp01((u - 1.5) / 1.5)) ** 2);
    if (u >= 3) L = 0.5 * S + 0.7 * S * suave((u - 3) / 6);
    if (u >= 9) L = 1.2 * S + 1.0 * S * expa;
    L *= cfg.espLargo;
    const enr = cfg.espEnrollado * Math.pow(suave((u - 3) / 6), 1.6);
    const a = cfg.espEscalaEspiral * (1 + (cfg.espExpEspiral - 1) * expa);
    const M = Math.max(60, Math.round(480 * quality)), r0 = Math.max(1e-4, cfg.espOjo) * S, k = B_AUREA / Math.sqrt(1 + B_AUREA * B_AUREA);
    const curva = new Float32Array((M + 1) * 2);
    let x = 0, y = 0; const ds = L / M;
    curva[0] = cx; curva[1] = cy;
    for (let j = 1; j <= M; j++) {
      const s = (j - 0.5) * ds, h = enr * Math.log((r0 + s * k) / r0) / B_AUREA;
      x += Math.cos(h) * ds; y += Math.sin(h) * ds;
      curva[j * 2] = cx + x * a; curva[j * 2 + 1] = cy - y * a;
    }
    const hv = suave((u - 2) / 3) * cfg.espHilos, hilos: number[] = [];
    if (L > 0) for (let n = 0; n < N; n++) {
      if (n >= vis || n >= hv * N) break;
      hilos.push(n, Math.min(M, Math.round(n / N * M)));
    }
    return { espiral: true, pts, curva, hilos, L, px };
  }
  return { computeEspiral, PHI, ANG_AUREO, B_AUREA, ESP_CICLO };
})();

/** La `config` de v10 con los valores por defecto de la espiral y el preset (velocidad 1). */
const CFG = {
  speed: 1, generator: 'espiral', espPuntos: 550, espGiro: 0, espEscalaPuntos: 1, espExpPuntos: 1.7, espEscalaEspiral: 1, espExpEspiral: 2.2, espLargo: 1, espEnrollado: 1,
  espOjo: 0.015, espHilos: 1, espTamPunto: 4.5, espGrosorCurva: 4, espGrosorHilo: 1.2, espOpPunto: 1, espOpCurva: 0.95, espOpHilo: 0.3,
};

const casos: Array<{ t: number; W: number; H: number; q?: number; cfg?: Partial<typeof CFG> }> = [
  ...[0, 0.3, 1.2, 2, 2.7, 3, 5, 9, 13, 18, 22, 25.4, 31.7, -3].map((t) => ({ t, W: 1080, H: 1920 })),
  { t: 6.5, W: 1920, H: 1080, q: 0.6 },
  { t: 12, W: 800, H: 800, cfg: { espPuntos: 1200, espGiro: -90, espEscalaPuntos: 2.1, espExpPuntos: 3.5, espEnrollado: 1.4, espOjo: 0.002, espHilos: 0.4, speed: 2.3 } },
  { t: 4, W: 640, H: 360, q: 0.2, cfg: { espPuntos: 100.4, espLargo: 2.5, espEscalaEspiral: 0.3, espExpEspiral: 5, espOjo: 0.08, espTamPunto: 0.5, speed: 0.4 } },
  { t: 17, W: 1080, H: 1080, cfg: { espEnrollado: 0, espHilos: 0 } },
];

describe('espiral de Fibonacci con hilos', () => {
  it('las constantes: φ, el ángulo áureo (≈ 137,508°) y la b de la espiral áurea (crece φ por cuarto de vuelta)', () => {
    expect(PHI).toBe(V10.PHI);
    expect(ANGULO_AUREO).toBe(V10.ANG_AUREO);
    expect(B_AUREA).toBe(V10.B_AUREA);
    expect(CICLO_ESPIRAL).toBe(V10.ESP_CICLO);
    expect((ANGULO_AUREO * 180) / Math.PI).toBeCloseTo(137.50776, 4);
    expect(Math.exp(B_AUREA * (Math.PI / 2))).toBeCloseTo(PHI, 12);
    expect(B_AUREA).toBeCloseTo(0.30634896, 7);
  });

  it('da lo mismo que computeEspiral de v10: puntos, curva, hilos, largo y px', () => {
    for (const c of casos) {
      const cfg = { ...CFG, ...c.cfg };
      const ref = V10.computeEspiral({ time: c.t, cfg }, c.W, c.H, c.q ?? 1);
      const nuevo = calcularEspiral({ tiempo: c.t, configuracion: configuracionEspiralDeV7(cfg) }, c.W, c.H, c.q ?? 1);
      expect(nuevo.puntos.length).toBe(ref.pts.length);
      expect(nuevo.curva.length).toBe(ref.curva.length);
      for (let i = 0; i < ref.pts.length; i++) expect(Math.abs(nuevo.puntos[i]! - ref.pts[i]!)).toBeLessThanOrEqual(1e-6);
      for (let i = 0; i < ref.curva.length; i++) expect(Math.abs(nuevo.curva[i]! - ref.curva[i]!)).toBeLessThanOrEqual(1e-6);
      expect(nuevo.hilos).toEqual(ref.hilos);
      expect(Math.abs(nuevo.largo - ref.L)).toBeLessThanOrEqual(1e-6);
      expect(nuevo.px).toBe(ref.px);
      // y, de hecho, bit a bit
      expect(Buffer.from(nuevo.puntos.buffer).equals(Buffer.from(ref.pts.buffer))).toBe(true);
      expect(Buffer.from(nuevo.curva.buffer).equals(Buffer.from(ref.curva.buffer))).toBe(true);
    }
  });

  it('la secuencia: al comienzo no hay curva ni hilos; a los 18 s están todos los puntos y todos los hilos', () => {
    const conf = configuracionEspiralDeV7(CFG);
    const a = calcularEspiral({ tiempo: 0.3, configuracion: conf }, 1080, 1920);
    expect(a.largo).toBe(0);
    expect(a.hilos).toEqual([]);
    const b = calcularEspiral({ tiempo: 18, configuracion: conf }, 1080, 1920);
    expect(b.hilos.length / 2).toBe(550);
    expect(b.puntos[549 * 4 + 3]).toBe(1);
    expect(b.largo).toBeCloseTo(2.2 * 1080, 6);
    // el ciclo se repite
    const c = calcularEspiral({ tiempo: 18 + CICLO_ESPIRAL, configuracion: conf }, 1080, 1920);
    expect(Math.abs(c.largo - b.largo)).toBeLessThan(1e-9);
  });

  it('los puntos siguen la filotaxis de Vogel: el punto n a radio c·√n y ángulo n × ángulo áureo', () => {
    const g = calcularEspiral({ tiempo: 2, configuracion: configuracionEspiralDeV7(CFG) }, 1000, 1000);
    const r = (n: number) => Math.hypot(g.puntos[n * 4]! - 500, g.puntos[n * 4 + 1]! - 500);
    expect(r(100) / r(25)).toBeCloseTo(2, 3);
    const ang = (n: number) => Math.atan2(-(g.puntos[n * 4 + 1]! - 500), g.puntos[n * 4]! - 500);
    const d = (((ang(11) - ang(10)) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
    expect(d).toBeCloseTo(ANGULO_AUREO, 4);
  });
});
