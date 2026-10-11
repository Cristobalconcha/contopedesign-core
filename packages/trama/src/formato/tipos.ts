/**
 * El ARCHIVO DE TRAMA, versión 1 del formato: los tipos.
 *
 * Una trama es una RECETA: con ella y el motor, cualquiera recalcula los
 * mismos puntos. Es sólo datos (JSON): números, textos de un vocabulario
 * cerrado, colores `#rrggbb`. Nunca código, nunca una URL que haya que
 * cargar. El README del paquete documenta cada campo con un ejemplo.
 *
 * `Trama` es la forma NORMALIZADA (todo presente). Al escribir un archivo
 * casi todo es opcional: `normalizarTrama` completa lo que falta con los
 * valores por defecto, y `validarTrama` revisa la forma escrita.
 */
import type { TintaElegida } from '../dibujo/color.js';
import type { ModoDeDibujo } from '../dibujo/modo.js';
import type { ConfiguracionMotor, ParametroMotor } from '../motor/configuracion.js';

export const TRAMA_KIND = 'contope/trama';
/** Versión del FORMATO del archivo (no del motor ni del paquete). */
export const FORMATO_VERSION = 1;

/** De dónde viene un valor: del ADN del sistema, o elegido a mano. */
export type OrigenDeValor = 'adn' | 'manual';

export interface ColorDeTrama {
  /** `#rrggbb`, siempre seis cifras hexadecimales. */
  hex: string;
  origen: OrigenDeValor;
  /** Con origen `adn`: el rol del color en el sistema (p. ej. `dim1.req02:acento`). */
  rol?: string;
  /** Con origen `adn`: huella de la definición leída, para saber si quedó desactualizado. */
  huella?: string;
}

export type ClaveDeColor = 'lejos' | 'cerca' | 'fondo';
export const CLAVES_DE_COLOR: readonly ClaveDeColor[] = ['lejos', 'cerca', 'fondo'];

export interface ColoresDeTrama {
  /** Color de los puntos lejanos (`colorDeep` en v7). */
  lejos: ColorDeTrama;
  /** Color de los puntos cercanos (`colorAccent`). */
  cerca: ColorDeTrama;
  /** Fondo sólido (`colorBg`). */
  fondo: ColorDeTrama;
}

/** El formato de salida del ADN del que sale el lienzo, si viene de ahí. */
export interface FormatoDelAdn {
  /** Id del formato en el sistema. */
  id: string;
  /** Requisito que lo define (p. ej. `dim3.req05`). */
  requisito?: string;
  nombre?: string;
  huella?: string;
}

/**
 * El lienzo. `libre`: llena el contenedor, sea cual sea su proporción.
 * `proporcion`: ancho / alto fijo. `medida`: ancho y alto en px (la medida
 * de exportación; en pantalla se escala manteniendo la proporción).
 * El motor depende de la proporción (cambia el campo visual bajo 1:1).
 */
export type Lienzo =
  | { tipo: 'libre'; formatoAdn?: FormatoDelAdn }
  | { tipo: 'proporcion'; proporcion: number; formatoAdn?: FormatoDelAdn }
  | { tipo: 'medida'; ancho: number; alto: number; formatoAdn?: FormatoDelAdn };

export interface DibujoDeTrama {
  modo: ModoDeDibujo;
  tinta: TintaElegida;
}

/** Interpolación de un keyframe hacia el siguiente. */
export type Suavizado = 'lineal' | 'suave' | 'entrada' | 'salida' | 'mantener' | 'curva';
export const SUAVIZADOS: readonly Suavizado[] = ['lineal', 'suave', 'entrada', 'salida', 'mantener', 'curva'];

/** cubic-bezier(x1, y1, x2, y2), como en CSS. */
export type CurvaBezier = [number, number, number, number];

export interface Keyframe {
  /** Instante, en segundos desde el comienzo de la secuencia. */
  t: number;
  /** Número, o `#rrggbb` en las pistas de color. */
  v: number | string;
  /** Cómo se llega desde este keyframe al siguiente. */
  ease: Suavizado;
  /** Con `ease: 'curva'`: la curva de tiempo. */
  curva?: CurvaBezier;
  /** Si lo generó una escena: su id. El normalizador lo regenera; no se edita a mano. */
  escena?: number;
}

export type RutaDeCursor = 'cursor.x' | 'cursor.y' | 'cursor.presencia';
export type RutaDeColor = 'color.lejos' | 'color.cerca' | 'color.fondo';
/** Lo que se puede animar: la evolución, casi toda la configuración, el cursor y los colores. */
export type RutaAnimable = 'evolucion' | Exclude<ParametroMotor, 'velocidad' | 'paralaje'> | RutaDeCursor | RutaDeColor;

export type Pistas = Partial<Record<RutaAnimable, Keyframe[]>>;

/** Cursor grabado: posición 0..1 (desde abajo a la izquierda) y presencia 0..1. */
export interface CursorDeTrama { x: number; y: number; presencia: number }

/** Un momento capturado: lo que una escena hace llegar. Todo opcional. */
export interface Captura {
  /** Evolución (el `time` de v7). */
  evolucion?: number;
  cursor?: Partial<CursorDeTrama>;
  configuracion?: Partial<ConfiguracionMotor>;
  color?: Partial<Record<ClaveDeColor, string>>;
}

export type Transicion = 'morph' | 'corte';

export interface Escena {
  /** Entero ≥ 1, único. (El 0 es de la escena de cierre.) */
  id: number;
  /** Instante en que la captura queda exacta. */
  t: number;
  captura: Captura;
  /** `corte`: el cambio es seco; `morph`: la lámina viaja durante `duracion` y llega en `t`. */
  transicion: Transicion;
  /** Segundos de la transición (se acorta si no cabe desde la escena anterior). */
  duracion: number;
  curva: CurvaBezier;
  /** Si la escena también lleva la evolución a la de su captura (morf de geometría). */
  evolucion: boolean;
  nombre?: string;
}

export interface TransicionDeCierre {
  transicion: Transicion;
  duracion: number;
  curva: CurvaBezier;
}

/** En vivo: la trama evoluciona sin fin desde `inicio`. */
export interface TiempoVivo {
  modo: 'vivo';
  /** Evolución en el instante 0. */
  inicio: number;
}

/** Una secuencia: capturas en el tiempo, con duración. */
export interface TiempoSecuencia {
  modo: 'secuencia';
  inicio: number;
  /** Segundos (0 < duración ≤ 600). */
  duracion: number;
  /** Keyframes por ruta. Los de escena los regenera el normalizador. */
  pistas: Pistas;
  escenas: Escena[];
  /** Termina en el mismo estado en que parte: una escena de cierre en `duracion` repite el instante 0. */
  cerrarCiclo: boolean;
  /** Cómo llega la escena de cierre. */
  cierre: TransicionDeCierre;
  /** Cursor cuando su pista no está animada. */
  cursor: CursorDeTrama;
  /** Qué hace el reproductor al llegar al final. */
  alTerminar: 'repetir' | 'detener';
}

export type TiempoDeTrama = TiempoVivo | TiempoSecuencia;

export interface InteraccionDeTrama {
  /** La lámina se deforma con el cursor real (en vivo, en el reproductor). */
  cursor: boolean;
  /** La cámara gira un poco con el cursor real (paralaje). */
  paralaje: boolean;
}

export interface MotorDeTrama {
  id: 'superficie-de-puntos';
  /** Versión semántica del motor con que se hizo. Se lee con cualquier 1.x. */
  version: string;
}

export interface Trama {
  kind: typeof TRAMA_KIND;
  version: typeof FORMATO_VERSION;
  motor: MotorDeTrama;
  nombre?: string;
  /**
   * La metadata de ancestro de Células Madre (decisión 35): de qué sistema y
   * definiciones viene. Opaca para este paquete: se guarda y se devuelve tal
   * cual. Sin ella, la trama queda «sin ancestro».
   */
  procedencia?: Record<string, unknown>;
  lienzo: Lienzo;
  dibujo: DibujoDeTrama;
  color: ColoresDeTrama;
  configuracion: ConfiguracionMotor;
  tiempo: TiempoDeTrama;
  interaccion: InteraccionDeTrama;
  /** Instante (s) que se muestra quieto con `prefers-reduced-motion` o en modo estático. */
  cuadroQuieto: number;
}
