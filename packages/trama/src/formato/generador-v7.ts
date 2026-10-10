/**
 * El generador v7 («Superficie de puntos — prototipo v7») y el archivo de
 * trama: la traducción entre su estado y el formato, en los dos sentidos.
 *
 * El escritorio muestra el generador v7 TAL CUAL (su HTML, sus controles,
 * su línea de tiempo); acá sólo se traduce. v7 llama a las cosas en inglés
 * (`sheetWidth`, `colorDeep`, `ease: 'hold'`, `scene`) y guarda su línea de
 * tiempo en `tl` (pistas `tracks` y escenas `scenes` con la captura entera
 * en `st`). El archivo de trama las llama en español y guarda capturas
 * parciales. Las mismas funciones sirven para que v7 calcule con el motor
 * único (sus envoltorios de `computeSheet`, `interp`, `regenerateScenes`)
 * y para exportar e importar.
 *
 * Todo es puro: datos en, datos fuera.
 */
import type { ModoDeDibujo } from '../dibujo/modo.js';
import { esModo } from '../dibujo/modo.js';
import type { TintaElegida } from '../dibujo/color.js';
import { aplicadorDeEscenas, capturaEn, regenerarPistas, type ParametroDeEscena } from '../linea-de-tiempo/escenas.js';
import { documentoDeTrama, evolucionEn, interpolar } from '../linea-de-tiempo/evaluar.js';
import { PARAMETRO_ANIMABLE, PARAMETROS_ANIMABLES } from '../linea-de-tiempo/parametros.js';
import { CURVA_SUAVE } from '../linea-de-tiempo/suavizados.js';
import type { ConfiguracionEspiral } from '../motor/espiral.js';
import { CONFIGURACION_POR_DEFECTO, NOMBRE_V7, PARAMETROS_MOTOR, type ConfiguracionMotor, type ParametroMotor } from '../motor/configuracion.js';
import { MOTOR_ID, MOTOR_VERSION } from '../motor/lamina.js';
import { normalizarTrama } from './normalizar.js';
import { CIERRE_POR_DEFECTO } from './por-defecto.js';
import {
  CLAVES_DE_COLOR,
  FORMATO_VERSION,
  TRAMA_KIND,
  type Captura,
  type ClaveDeColor,
  type ColorDeTrama,
  type CurvaBezier,
  type Escena,
  type Keyframe,
  type Lienzo,
  type Pistas,
  type RutaAnimable,
  type Suavizado,
  type TiempoSecuencia,
  type Trama,
} from './tipos.js';

// ---------------------------------------------------------------------------
// Nombres
// ---------------------------------------------------------------------------

/** Cómo se llama en v7 cada color de la trama (`colorDeep`, `colorAccent`, `colorBg`). */
export const COLOR_V7: Readonly<Record<ClaveDeColor, string>> = Object.freeze({ lejos: 'colorDeep', cerca: 'colorAccent', fondo: 'colorBg' });

/** Ruta animable del formato → `path` de v7 (`PARAMS` de v7). */
export const RUTA_V7: Readonly<Record<RutaAnimable, string>> = Object.freeze(
  Object.fromEntries(
    PARAMETROS_ANIMABLES.map((p) => {
      const r = p.ruta;
      if (r === 'evolucion') return [r, 'time'];
      if (r === 'cursor.presencia') return [r, 'cursor.presence'];
      if (r === 'cursor.x' || r === 'cursor.y') return [r, r];
      if (r.startsWith('color.')) return [r, COLOR_V7[r.slice(6) as ClaveDeColor]];
      return [r, NOMBRE_V7[r as ParametroMotor]];
    }),
  ) as Record<RutaAnimable, string>,
);

/** `path` de v7 → ruta animable del formato. */
export const RUTA_DE_V7: Readonly<Record<string, RutaAnimable>> = Object.freeze(
  Object.fromEntries((Object.entries(RUTA_V7) as [RutaAnimable, string][]).map(([r, p]) => [p, r])),
);

export type SuavizadoV7 = 'linear' | 'ease' | 'in' | 'out' | 'hold' | 'curve';

/** `ease` de v7 → suavizado del formato (`EASES` de v7). */
export const SUAVIZADO_DE_V7: Readonly<Record<SuavizadoV7, Suavizado>> = Object.freeze({
  linear: 'lineal', ease: 'suave', in: 'entrada', out: 'salida', hold: 'mantener', curve: 'curva',
});
export const SUAVIZADO_V7: Readonly<Record<Suavizado, SuavizadoV7>> = Object.freeze({
  lineal: 'linear', suave: 'ease', entrada: 'in', salida: 'out', mantener: 'hold', curva: 'curve',
});

// ---------------------------------------------------------------------------
// El estado de v7
// ---------------------------------------------------------------------------

/** La `config` de v7: números con nombres en inglés, los tres colores y `inkMode`. */
export type ConfiguracionV7 = Record<string, unknown>;

export interface KeyframeV7 {
  t: number;
  v: number | string;
  ease: SuavizadoV7;
  curve?: CurvaBezier;
  /** Id de la escena que lo generó. */
  scene?: number;
}

export type PistasV7 = Record<string, KeyframeV7[]>;

/** Un estado de v7 (lo que guarda una captura: `snapNow`). */
export interface EstadoCapturaV7 {
  time?: number;
  cam?: number[];
  mouse?: number[];
  presence?: number;
  cfg: ConfiguracionV7;
  render?: string;
  format?: string;
  aspect?: number;
  blend?: unknown;
}

export interface EscenaV7 {
  id: number;
  t: number;
  /** Número de la captura de la que salió (la etiqueta «C3» del carril). */
  snap: number | string;
  st: EstadoCapturaV7;
  type: 'morph' | 'cut';
  dur: number;
  curve: CurvaBezier;
  evo: boolean;
}

/** La línea de tiempo de v7 (`tl`), lo que se guarda de ella. */
export interface LineaV7 {
  duration: number;
  startTime: number;
  cursor: { x: number; y: number; presence: number };
  tracks: PistasV7;
  scenes: EscenaV7[];
}

/** Todo lo que el archivo de trama necesita de v7. */
export interface EstadoV7 {
  cfg: ConfiguracionV7;
  render: string;
  /** Evolución en pantalla (`live.time`): el inicio de una trama en vivo. */
  time: number;
  /** `free` o `ANCHOxALTO`. */
  format: string;
  tl: LineaV7 | null;
  nombre?: string;
}

// ---------------------------------------------------------------------------
// Piezas
// ---------------------------------------------------------------------------

/**
 * La configuración del motor con los valores de v7, sin tocarlos (si falta
 * uno, falta: el motor hará lo mismo que hacía v7). Es lo que usa el
 * envoltorio de `computeSheet`, cuadro a cuadro.
 */
export function configuracionDeV7(cfg: ConfiguracionV7): ConfiguracionMotor {
  const o: Record<string, unknown> = {};
  for (const p of PARAMETROS_MOTOR) o[p] = cfg[NOMBRE_V7[p]];
  return o as unknown as ConfiguracionMotor;
}

/** Igual, pero sólo con números finitos: lo que falta toma el valor por defecto. Para el archivo. */
export function configuracionLimpiaDeV7(cfg: ConfiguracionV7): ConfiguracionMotor {
  const o = { ...CONFIGURACION_POR_DEFECTO };
  for (const p of PARAMETROS_MOTOR) {
    const v = cfg[NOMBRE_V7[p]];
    if (typeof v === 'number' && Number.isFinite(v)) o[p] = v;
  }
  return o;
}

/** Los números de la configuración con los nombres de v7. */
export function cfgV7DeConfiguracion(c: Partial<ConfiguracionMotor>): ConfiguracionV7 {
  const o: ConfiguracionV7 = {};
  for (const p of PARAMETROS_MOTOR) if (c[p] !== undefined) o[NOMBRE_V7[p]] = c[p];
  return o;
}

const hexDe = (cfg: ConfiguracionV7, k: ClaveDeColor, porDefecto: string): string => {
  const v = cfg[COLOR_V7[k]];
  return typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v) ? v.toLowerCase() : porDefecto;
};

/** Los colores de una `config` de v7. */
export function coloresDeV7(cfg: ConfiguracionV7): Record<ClaveDeColor, string> {
  return { lejos: hexDe(cfg, 'lejos', '#2a52d6'), cerca: hexDe(cfg, 'cerca', '#3dd6c0'), fondo: hexDe(cfg, 'fondo', '#000000') };
}

export function keyframeDeV7(k: KeyframeV7): Keyframe {
  let ease = SUAVIZADO_DE_V7[k.ease] ?? 'lineal';
  // v7: una «curva» sin curva se dibuja lineal (easeOf); el formato no la admite sin curva
  if (ease === 'curva' && !k.curve) ease = 'lineal';
  const o: Keyframe = { t: k.t, v: k.v, ease };
  if (ease === 'curva' && k.curve) o.curva = [...k.curve];
  if (typeof k.scene === 'number') o.escena = k.scene;
  return o;
}

export function keyframeAV7(k: Keyframe): KeyframeV7 {
  const o: KeyframeV7 = { t: k.t, v: k.v, ease: SUAVIZADO_V7[k.ease] ?? 'linear' };
  if (k.curva) o.curve = [...k.curva];
  if (typeof k.escena === 'number') o.scene = k.escena;
  return o;
}

/** Los keyframes de v7 con el ease del formato (para evaluar con `interpolar`, sin copiar valores). */
export function keyframesDeV7(keys: readonly KeyframeV7[]): Keyframe[] {
  return keys.map(keyframeDeV7);
}

/** Pistas de v7 → pistas del formato. `soloManuales` deja fuera las que generan las escenas. */
export function pistasDeV7(tracks: PistasV7, soloManuales = false): Pistas {
  const o: Pistas = {};
  for (const [path, keys] of Object.entries(tracks)) {
    const ruta = RUTA_DE_V7[path];
    if (!ruta || !Array.isArray(keys)) continue;
    const lista = (soloManuales ? keys.filter((k) => !k.scene) : keys).map(keyframeDeV7);
    if (lista.length) o[ruta] = lista;
  }
  return o;
}

export function pistasAV7(pistas: Pistas): PistasV7 {
  const o: PistasV7 = {};
  for (const [ruta, keys] of Object.entries(pistas) as [RutaAnimable, Keyframe[]][]) if (keys.length) o[RUTA_V7[ruta]] = keys.map(keyframeAV7);
  return o;
}

/** Lo que una captura de v7 hace llegar, como captura del formato (sólo lo que trae). */
export function capturaDeV7(st: EstadoCapturaV7): Captura {
  const c: Captura = {};
  if (typeof st.time === 'number') c.evolucion = st.time;
  const cursor: { x?: number; y?: number; presencia?: number } = {};
  if (Array.isArray(st.mouse)) {
    if (typeof st.mouse[0] === 'number') cursor.x = st.mouse[0];
    if (typeof st.mouse[1] === 'number') cursor.y = st.mouse[1];
  }
  if (typeof st.presence === 'number') cursor.presencia = st.presence;
  if (Object.keys(cursor).length) c.cursor = cursor;
  const cfg = st.cfg ?? {};
  const configuracion: Partial<ConfiguracionMotor> = {};
  for (const p of PARAMETROS_MOTOR) {
    const v = cfg[NOMBRE_V7[p]];
    if (typeof v === 'number' && Number.isFinite(v)) configuracion[p] = v;
  }
  if (Object.keys(configuracion).length) c.configuracion = configuracion;
  const color: Partial<Record<ClaveDeColor, string>> = {};
  for (const k of CLAVES_DE_COLOR) {
    const v = cfg[COLOR_V7[k]];
    if (typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v)) color[k] = v.toLowerCase();
  }
  if (Object.keys(color).length) c.color = color;
  return c;
}

/** Una captura del formato como estado de v7 (lo que falta en la captura, falta en el estado). */
export function estadoV7DeCaptura(c: Captura): EstadoCapturaV7 {
  const cfg: ConfiguracionV7 = cfgV7DeConfiguracion(c.configuracion ?? {});
  for (const k of CLAVES_DE_COLOR) if (c.color?.[k]) cfg[COLOR_V7[k]] = c.color[k];
  const st: EstadoCapturaV7 = { cfg };
  if (c.evolucion !== undefined) st.time = c.evolucion;
  if (c.cursor?.x !== undefined && c.cursor?.y !== undefined) st.mouse = [c.cursor.x, c.cursor.y];
  if (c.cursor?.presencia !== undefined) st.presence = c.cursor.presencia;
  return st;
}

export function escenaDeV7(sc: EscenaV7): Escena {
  const e: Escena = {
    id: sc.id,
    t: sc.t,
    captura: capturaDeV7(sc.st),
    transicion: sc.type === 'cut' ? 'corte' : 'morph',
    duracion: sc.dur,
    curva: Array.isArray(sc.curve) && sc.curve.length === 4 ? [...sc.curve] : [...CURVA_SUAVE],
    evolucion: !!sc.evo,
  };
  if (sc.snap !== undefined && sc.snap !== '?') e.nombre = `Captura ${sc.snap}`;
  return e;
}

export function escenaAV7(e: Escena): EscenaV7 {
  const n = e.nombre ? /^Captura (\d+)$/.exec(e.nombre) : null;
  return {
    id: e.id,
    t: e.t,
    snap: n ? Number(n[1]) : e.id,
    st: estadoV7DeCaptura(e.captura),
    type: e.transicion === 'corte' ? 'cut' : 'morph',
    dur: e.duracion,
    curve: [...e.curva],
    evo: e.evolucion,
  };
}

function secuenciaDeLinea(tl: LineaV7, soloManuales: boolean): TiempoSecuencia {
  return {
    modo: 'secuencia',
    inicio: tl.startTime,
    duracion: tl.duration,
    pistas: pistasDeV7(tl.tracks, soloManuales),
    escenas: tl.scenes.map(escenaDeV7),
    cerrarCiclo: false,
    cierre: { ...CIERRE_POR_DEFECTO, curva: [...CIERRE_POR_DEFECTO.curva] },
    cursor: { x: tl.cursor.x, y: tl.cursor.y, presencia: tl.cursor.presence },
    alTerminar: 'repetir',
  };
}

/** Un parámetro animable de v7 que el formato todavía no tiene (los de la espiral): su `path` y cómo se compara. */
export interface ParametroExtraV7 {
  path: string;
  /** El `step` de v7: dos valores a menos de medio paso son el mismo. */
  paso: number;
  /** `hold` de v7: salta en el keyframe. */
  entero?: boolean;
  color?: boolean;
}

/**
 * `regenerateScenes` de v7 con el motor único: los keyframes de las escenas
 * se vuelven a generar con `regenerarPistas`; los hechos a mano quedan.
 * Los `extras` (parámetros de v7 fuera del formato, como los de la espiral)
 * pasan por el mismo aplicador de escenas, con sus valores de la `config`.
 */
export function regenerarPistasV7(tl: LineaV7, cfg: ConfiguracionV7, extras: readonly ParametroExtraV7[] = []): PistasV7 {
  const pistas = pistasAV7(regenerarPistas(secuenciaDeLinea(tl, true), { configuracion: configuracionDeV7(cfg), colores: coloresDeV7(cfg) }));
  if (!extras.length) return pistas;
  const fuera: Record<string, Keyframe[]> = {};
  for (const p of extras) {
    const manuales = (tl.tracks[p.path] ?? []).filter((k) => !k.scene).map(keyframeDeV7);
    if (manuales.length) fuera[p.path] = manuales;
  }
  const parametros: ParametroDeEscena[] = extras.map((p) => ({ ruta: p.path, paso: p.paso, ...(p.entero ? { entero: true as const } : {}), ...(p.color ? { color: true as const } : {}) }));
  const aplicar = aplicadorDeEscenas<ReturnType<typeof escenaDeV7> & { st: EstadoCapturaV7 }>(
    parametros,
    fuera,
    (p, t0) => {
      const k = fuera[p.ruta];
      return k && k.length ? interpolar(k, t0, p) : (cfg[p.ruta] as number | string);
    },
    (sc, p) => sc.st.cfg?.[p.ruta] as number | string | undefined,
  );
  for (const sc of tl.scenes.slice().sort((a, b) => a.t - b.t)) aplicar({ ...escenaDeV7(sc), st: sc.st });
  for (const [path, keys] of Object.entries(fuera)) if (keys.length) pistas[path] = keys.map(keyframeAV7);
  return pistas;
}

// ---------------------------------------------------------------------------
// La espiral (v10)
// ---------------------------------------------------------------------------

/** Cómo se llama en v10 cada parámetro de la espiral. */
export const NOMBRE_ESPIRAL_V7: Readonly<Record<keyof ConfiguracionEspiral, string>> = Object.freeze({
  velocidad: 'speed', puntos: 'espPuntos', giro: 'espGiro', escalaPuntos: 'espEscalaPuntos', expPuntos: 'espExpPuntos',
  escalaEspiral: 'espEscalaEspiral', expEspiral: 'espExpEspiral', largo: 'espLargo', enrollado: 'espEnrollado', ojo: 'espOjo',
  hilos: 'espHilos', tamPunto: 'espTamPunto',
});

/** ¿Esta `config` de v7 dibuja la espiral? */
export function esEspiralV7(cfg: ConfiguracionV7 | undefined | null): boolean {
  return !!cfg && cfg['generator'] === 'espiral';
}

/** La configuración de la espiral con los valores de v10, sin tocarlos (para `calcularEspiral`, cuadro a cuadro). */
export function configuracionEspiralDeV7(cfg: ConfiguracionV7): ConfiguracionEspiral {
  const o: Record<string, unknown> = {};
  for (const [k, n] of Object.entries(NOMBRE_ESPIRAL_V7)) o[k] = cfg[n];
  return o as unknown as ConfiguracionEspiral;
}

/** El aviso de v10 cuando se pide la trama de la espiral. */
export const AVISO_TRAMA_ESPIRAL = 'La trama de la espiral llega con la próxima versión del formato; por ahora sale como video, PNG o SVG';

// ---------------------------------------------------------------------------
// v7 → archivo de trama
// ---------------------------------------------------------------------------

export interface OpcionesDeTramaV7 {
  /** Colores con su origen (los del ADN): si el hex de v7 es el mismo, el color queda con ese origen. */
  colores?: Partial<Record<ClaveDeColor, ColorDeTrama>>;
  /** El lienzo si se sabe mejor que por `format` (un formato de hoja del ADN, con `formatoAdn`). */
  lienzo?: Lienzo;
  procedencia?: Record<string, unknown>;
}

/** ¿La línea de tiempo de v7 dice algo? (si no, la trama es en vivo). */
export function lineaEnUso(tl: LineaV7 | null): tl is LineaV7 {
  return !!tl && (Object.values(tl.tracks).some((k) => k.length > 0) || tl.scenes.length > 0);
}

/** Recorta una pista a [0, fin]: lo que pasa después no se ve; el valor en el fin se conserva con un keyframe. */
function recortar(ruta: RutaAnimable, keys: Keyframe[], fin: number, doc: Parameters<typeof evolucionEn>[0]): Keyframe[] {
  if (!keys.some((k) => k.t > fin)) return keys;
  const dentro = keys.filter((k) => k.t < fin - 1e-9);
  const v = ruta === 'evolucion' ? evolucionEn({ ...doc, pistas: { evolucion: keys } }, fin).tiempo : interpolar(keys, fin, PARAMETRO_ANIMABLE[ruta]);
  dentro.push({ t: fin, v, ease: 'lineal' });
  return dentro;
}

/**
 * El archivo de trama (normalizado y válido) del estado de v7. Con la línea
 * de tiempo en uso es una secuencia (pistas hechas a mano y escenas; los
 * keyframes de escena los regenera el normalizador igual que v7); sin ella,
 * una trama en vivo que parte en la evolución en pantalla.
 */
export function tramaDeEstadoV7(e: EstadoV7, opciones: OpcionesDeTramaV7 = {}): Trama {
  // la versión 1 del formato es sólo la superficie de puntos
  if (esEspiralV7(e.cfg) || (e.tl?.scenes ?? []).some((sc) => esEspiralV7(sc.st?.cfg))) throw new Error(AVISO_TRAMA_ESPIRAL);
  const configuracion = configuracionLimpiaDeV7(e.cfg);
  const hex = coloresDeV7(e.cfg);
  const color: Record<ClaveDeColor, ColorDeTrama> = { lejos: { hex: hex.lejos, origen: 'manual' }, cerca: { hex: hex.cerca, origen: 'manual' }, fondo: { hex: hex.fondo, origen: 'manual' } };
  for (const k of CLAVES_DE_COLOR) {
    const dado = opciones.colores?.[k];
    if (dado && dado.hex.toLowerCase() === hex[k]) color[k] = { ...dado, hex: hex[k] };
  }
  const tinta: TintaElegida = e.cfg['inkMode'] === 'luz' || e.cfg['inkMode'] === 'tinta' ? e.cfg['inkMode'] : 'auto';
  const modo: ModoDeDibujo = esModo(e.render) ? e.render : 'puntos';
  const medida = /^(\d+)x(\d+)$/.exec(e.format);
  const lienzo: Lienzo = opciones.lienzo ?? (medida ? { tipo: 'medida', ancho: Number(medida[1]), alto: Number(medida[2]) } : { tipo: 'libre' });
  const documento: Record<string, unknown> = {
    kind: TRAMA_KIND,
    version: FORMATO_VERSION,
    motor: { id: MOTOR_ID, version: MOTOR_VERSION },
    lienzo,
    dibujo: { modo, tinta },
    color,
    configuracion,
    // v7 en vivo sigue al cursor y gira la cámara con él (si el paralaje no es 0)
    interaccion: { cursor: true, paralaje: configuracion.paralaje > 0 },
    cuadroQuieto: 0,
  };
  if (e.nombre && e.nombre.trim()) documento['nombre'] = e.nombre.trim().slice(0, 200);
  if (opciones.procedencia) documento['procedencia'] = opciones.procedencia;
  if (!lineaEnUso(e.tl)) {
    documento['tiempo'] = { modo: 'vivo', inicio: e.time };
  } else {
    const tl = e.tl;
    const fin = tl.duration;
    const s = secuenciaDeLinea(tl, true);
    const doc = { configuracion, colores: hex, pistas: {}, inicio: tl.startTime, cursor: s.cursor };
    const pistas: Pistas = {};
    for (const [ruta, keys] of Object.entries(s.pistas) as [RutaAnimable, Keyframe[]][]) pistas[ruta] = recortar(ruta, keys, fin, doc);
    documento['tiempo'] = { ...s, pistas, escenas: s.escenas.filter((sc) => sc.t <= fin) };
  }
  return normalizarTrama(documento);
}

// ---------------------------------------------------------------------------
// archivo de trama → v7
// ---------------------------------------------------------------------------

/**
 * El estado de v7 que reproduce una trama. Una secuencia con el ciclo
 * cerrado (v7 no tiene esa opción) trae su escena de cierre como una escena
 * más al final, con la captura del instante 0.
 */
export function estadoV7DeTrama(trama: Trama): EstadoV7 {
  const cfg: ConfiguracionV7 = cfgV7DeConfiguracion(trama.configuracion);
  for (const k of CLAVES_DE_COLOR) cfg[COLOR_V7[k]] = trama.color[k].hex;
  cfg['inkMode'] = trama.dibujo.tinta;
  const l = trama.lienzo;
  const e: EstadoV7 = {
    cfg,
    render: trama.dibujo.modo,
    time: trama.tiempo.inicio,
    format: l.tipo === 'medida' ? `${l.ancho}x${l.alto}` : 'free',
    tl: null,
  };
  if (trama.nombre) e.nombre = trama.nombre;
  const t = trama.tiempo;
  if (t.modo === 'secuencia') {
    const manuales: Pistas = {};
    for (const [ruta, keys] of Object.entries(t.pistas) as [RutaAnimable, Keyframe[]][]) {
      const m = keys.filter((k) => k.escena === undefined);
      if (m.length) manuales[ruta] = m;
    }
    const scenes = t.escenas.map(escenaAV7);
    if (t.cerrarCiclo) {
      const id = scenes.reduce((m, s) => Math.max(m, s.id), 0) + 1;
      const fin = t.duracion;
      const sinCierre = scenes.filter((s) => Math.abs(s.t - fin) >= 1 / 48);
      sinCierre.push({
        id, t: fin, snap: id, st: estadoV7DeCaptura(capturaEn(documentoDeTrama(trama), 0)),
        type: t.cierre.transicion === 'corte' ? 'cut' : 'morph', dur: t.cierre.duracion, curve: [...t.cierre.curva], evo: true,
      });
      scenes.splice(0, scenes.length, ...sinCierre);
    }
    e.tl = {
      duration: t.duracion,
      startTime: t.inicio,
      cursor: { x: t.cursor.x, y: t.cursor.y, presence: t.cursor.presencia },
      tracks: pistasAV7(manuales),
      scenes,
    };
  }
  return e;
}
