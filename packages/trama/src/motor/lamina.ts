/**
 * El motor: un estado → los puntos proyectados de la lámina, en un cuadro.
 *
 * Es `computeSheet` de v7, portado sin cambiar fórmulas, constantes ni el
 * orden de las operaciones. Tres cosas que parecen detalles y no lo son:
 *  - el eje central se guarda en un `Float32Array` (como en v7): sus valores
 *    pierden precisión ahí, y esa pérdida es parte de la imagen;
 *  - el resto se calcula en `number` (64 bits) y recién se reduce a 32 bits
 *    al escribirse en el cuadro, igual que `packFrame` de Publisher;
 *  - un punto detrás de la cámara se escribe como cinco ceros: conserva su
 *    lugar, así todos los cuadros de una trama tienen el mismo tamaño y se
 *    pueden mezclar valor a valor.
 *
 * El cuadro es plano: por cada línea, por cada punto, cinco valores
 * `[x, y, radio, cercanía, alfa]` (x, y y radio en px del lienzo; cercanía y
 * alfa sin unidad). Tamaño: lineas × puntos × 5 (ver `dimensionesDeLamina`).
 */
import { multiplicar, rotacionX, rotacionY, rotacionZ, suavizado, traslacion } from './camara.js';
import type { ConfiguracionMotor } from './configuracion.js';
import { ruido } from './ruido.js';

/** Identidad y versión del motor. Cambia la versión mayor si cambia la imagen. */
export const MOTOR_ID = 'superficie-de-puntos';
export const MOTOR_VERSION = '1.0.0';

/** Valores por punto en un cuadro. */
export const VALORES_POR_PUNTO = 5;

/** Lo que el motor necesita para calcular un instante. */
export interface EstadoMotor {
  /** Evolución, en segundos de la trama; el motor usa evolución × velocidad. */
  tiempo: number;
  /** Paralaje de la cámara, [x, y] en -1..1 (`cam` en v7). */
  camara: readonly [number, number];
  /** Cursor, [x, y] en 0..1 desde abajo a la izquierda (`mouse` en v7). */
  cursor: readonly [number, number];
  /** Presencia del cursor, 0..1: multiplica la deformación (`presence`). */
  presencia: number;
  configuracion: ConfiguracionMotor;
  /**
   * Morf: si está, el cuadro es la mezcla de este estado con `estado`
   * en proporción `e` (0 = este, 1 = el otro), calculada sobre la malla de
   * este estado. Es el `blend` de v7.
   */
  mezcla?: { e: number; estado: EstadoMotor };
}

/** Cuántas líneas y puntos por línea calcula el motor con esa calidad. */
export function dimensionesDeLamina(cfg: Pick<ConfiguracionMotor, 'lineas' | 'puntosPorLinea'>, calidad = 1): { lineas: number; puntos: number } {
  return {
    lineas: Math.max(2, Math.round(cfg.lineas * Math.min(1, calidad * 1.2))),
    puntos: Math.max(8, Math.round(cfg.puntosPorLinea * calidad)),
  };
}

/** Tamaño (en valores) del cuadro de esa configuración. */
export function tamanoDeCuadro(cfg: Pick<ConfiguracionMotor, 'lineas' | 'puntosPorLinea'>, calidad = 1): number {
  const d = dimensionesDeLamina(cfg, calidad);
  return d.lineas * d.puntos * VALORES_POR_PUNTO;
}

/** Arreglo donde se puede escribir un cuadro: de 32 o de 64 bits. */
export type DestinoDeCuadro = Float32Array | Float64Array;

/**
 * Escribe la lámina de `estado` en `destino` (que debe medir
 * `tamanoDeCuadro`) sin mirar `estado.mezcla`. Devuelve `destino`.
 */
export function escribirLamina<D extends DestinoDeCuadro>(estado: EstadoMotor, W: number, H: number, calidad: number, destino: D): D {
  const cfg = estado.configuracion, t = estado.tiempo * cfg.velocidad;
  const { lineas: N, puntos: M } = dimensionesDeLamina(cfg, calidad);
  if (destino.length !== N * M * VALORES_POR_PUNTO) throw new RangeError(`el destino mide ${destino.length} y el cuadro ${N * M * VALORES_POR_PUNTO}`);
  const aspect = W / H, d2r = Math.PI / 180;
  const f = 1 / Math.tan((aspect < 1 ? 60 : 42) * d2r / 2);
  let view = traslacion(0, 0, -cfg.distancia * (aspect < 1 ? 1.25 : 1));
  view = multiplicar(view, rotacionZ(cfg.giro * d2r));
  view = multiplicar(view, rotacionX((cfg.inclinacion + estado.camara[1] * 6 * cfg.paralaje) * d2r));
  view = multiplicar(view, rotacionY(estado.camara[0] * 10 * cfg.paralaje * d2r));
  const v0 = view[0]!, v1 = view[1]!, v2 = view[2]!, v4 = view[4]!, v5 = view[5]!, v6 = view[6]!;
  const v8 = view[8]!, v9 = view[9]!, v10 = view[10]!, v12 = view[12]!, v13 = view[13]!, v14 = view[14]!;
  const scalePx = H / 1080;
  const mx = estado.cursor[0], my = estado.cursor[1], mForce = cfg.deformacionCursor * estado.presencia, mr2 = cfg.radioCursor * cfg.radioCursor;

  // eje central y orientación de la sección: dependen sólo de x, una vez por punto a lo largo
  const axis = new Float32Array(M * 3); // cy, cz, theta
  for (let j = 0; j < M; j++) {
    const u = j / (M - 1), x = (u - 0.5) * cfg.largoLamina;
    axis[j * 3] = cfg.serpenteo * (Math.sin(x * 0.35 + t * 0.5) * 0.45 + ruido(x * 0.16 + 3.1, t * 0.18, 1.7) * 1.3);
    axis[j * 3 + 1] = cfg.serpenteo * ruido(x * 0.14 + 7.3, t * 0.15, 4.2) * 1.4;
    axis[j * 3 + 2] = cfg.torsion * x * 0.28 + cfg.pliegues * ruido(x * 0.22 * cfg.frecuenciaPliegues + 11.0, t * 0.12, 8.6) * 3.2 + t * 0.15;
  }
  const half = cfg.anchoLamina / 2, curl = cfg.curvatura;
  let o = 0;
  for (let i = 0; i < N; i++) {
    const v = (i / (N - 1)) * 2 - 1; // -1..1 a lo ancho
    const edge = 1 - suavizado(0.82, 1.0, Math.abs(v)) * 0.85;
    for (let j = 0; j < M; j++) {
      const u = j / (M - 1), x = (u - 0.5) * cfg.largoLamina;
      const th = axis[j * 3 + 2]!;
      // sección en arco: con curvatura, la lámina se enrolla sobre sí misma
      let oy: number, oz: number;
      if (Math.abs(curl) < 1e-3) { oy = Math.sin(th) * v * half; oz = Math.cos(th) * v * half; }
      else {
        const R = half / curl, a = v * curl;
        oy = R * (Math.sin(th + a) - Math.sin(th));
        oz = R * (Math.cos(th) - Math.cos(th + a));
        // v7 suma aquí «oy += 0; oz += 0» (centrar el arco en el eje): no cambia nada
      }
      const px = x;
      let py = axis[j * 3]! + oy, pz = axis[j * 3 + 1]! + oz;
      // ondulación fina, normal aproximada a la sección
      const wv = cfg.ondulacion * ruido(x * cfg.frecuenciaOndulacion * 0.6, v * cfg.frecuenciaOndulacion * 1.4 + 20, t * 0.4);
      py += wv * Math.cos(th + v * curl); pz -= wv * Math.sin(th + v * curl);
      // a la cámara
      const cx = v0 * px + v4 * py + v8 * pz + v12;
      const cy = v1 * px + v5 * py + v9 * pz + v13;
      let cz = v2 * px + v6 * py + v10 * pz + v14;
      if (cz > -0.15) { // detrás de la cámara: invisible, pero conserva su lugar
        destino[o] = 0; destino[o + 1] = 0; destino[o + 2] = 0; destino[o + 3] = 0; destino[o + 4] = 0;
        o += 5;
        continue;
      }
      let nx = (f / aspect) * cx / -cz, ny = f * cy / -cz - cfg.desplazamientoY * 2;
      nx -= cfg.desplazamientoX * 2;
      // deformación del cursor: empuja hacia la cámara y hacia afuera
      if (mForce) {
        const dx = (nx - (mx * 2 - 1)) * aspect, dy = ny - (my * 2 - 1);
        const k = mForce * Math.exp(-(dx * dx + dy * dy) / mr2);
        if (k > 1e-3) {
          const dd = Math.hypot(dx, dy) || 1;
          cz += k * 0.7; nx += dx / dd / aspect * k * 0.02; ny += dy / dd * k * 0.02;
        }
      }
      const depth = -cz;
      const sx = (nx + 1) / 2 * W, sy = (1 - ny) / 2 * H;
      const near = suavizado(cfg.distancia + 2.5, cfg.distancia - 1.5, depth);
      const persp = Math.pow(cfg.distancia / depth, cfg.crecimientoPorCercania);
      const r = Math.max(0.25, cfg.grosor * 0.5 * persp * scalePx);
      const ends = suavizado(0, 0.08, u) * suavizado(1, 0.92, u);
      const a = cfg.brillo * ends * edge * (1 - cfg.apagadoPorDistancia * 0.8 * (1 - near));
      destino[o] = sx; destino[o + 1] = sy; destino[o + 2] = r; destino[o + 3] = near; destino[o + 4] = a;
      o += 5;
    }
  }
  return destino;
}

/**
 * El cuadro empaquetado de un estado (sin morf): `computeSheet` + `packFrame`
 * de Publisher en un solo paso. Tamaño fijo para una configuración y calidad.
 */
export function calcularLamina(estado: EstadoMotor, W: number, H: number, calidad = 1): Float32Array {
  return escribirLamina(estado, W, H, calidad, new Float32Array(tamanoDeCuadro(estado.configuracion, calidad)));
}

/**
 * Empaqueta líneas sueltas (una lista de `[x, y, radio, cercanía, alfa, …]`
 * por línea, como las devolvía `computeSheet` de v7) en un solo cuadro.
 * Es `packFrame` de Publisher; sirve para comparar con v7.
 */
export function empaquetar(lineas: ReadonlyArray<ArrayLike<number>>): Float32Array {
  let n = 0;
  for (const l of lineas) n += l.length;
  const salida = new Float32Array(n);
  let o = 0;
  for (const l of lineas) { salida.set(l, o); o += l.length; }
  return salida;
}

/**
 * El cuadro de un estado, con morf si lo trae: calcula los dos estados sobre
 * la misma malla (la del primero) y los mezcla. Como `computeState` de v7,
 * la mezcla se hace con los valores de 64 bits y se reduce a 32 al final.
 */
export function cuadroDeEstado(estado: EstadoMotor, W: number, H: number, calidad = 1): Float32Array {
  if (!estado.mezcla) return calcularLamina(estado, W, H, calidad);
  const n = tamanoDeCuadro(estado.configuracion, calidad);
  const A = escribirLamina(estado, W, H, calidad, new Float64Array(n));
  const otro = estado.mezcla.estado;
  // misma malla para poder mezclar
  const cfgB = { ...otro.configuracion, lineas: estado.configuracion.lineas, puntosPorLinea: estado.configuracion.puntosPorLinea };
  const B = escribirLamina({ ...otro, configuracion: cfgB }, W, H, calidad, new Float64Array(n));
  const e = estado.mezcla.e, salida = new Float32Array(n);
  for (let k = 0; k < n; k++) salida[k] = A[k]! + (B[k]! - A[k]!) * e;
  return salida;
}
