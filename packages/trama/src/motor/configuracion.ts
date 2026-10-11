/**
 * La configuración numérica del motor «superficie de puntos»: todos los
 * parámetros de v7 que son números, con sus valores por defecto (los del
 * preset «Lámina plegada», `config` en v7).
 *
 * Los nombres van en español; `NOMBRE_V7` dice cómo se llamaba cada uno en
 * v7 y en los códigos `SP1.`, y es la única tabla que traduce entre los dos.
 * Los colores, el modo de dibujo y la tinta no están acá: en el archivo de
 * trama viven en `color` y `dibujo`, porque cada color anota su origen.
 */

export interface ConfiguracionMotor {
  /** Líneas paralelas de la lámina (entero; `lineCount`). */
  lineas: number;
  /** Puntos por línea (entero; `points`). */
  puntosPorLinea: number;
  /** Ancho de la lámina, en unidades de escena (`sheetWidth`). */
  anchoLamina: number;
  /** Largo de la lámina (`sheetLength`). */
  largoLamina: number;
  /** Cuánto serpentea el eje central (`meander`). */
  serpenteo: number;
  /** Torsión a lo largo (`twist`). */
  torsion: number;
  /** Pliegues: giro de la sección con ruido (`fold`). */
  pliegues: number;
  /** Qué tan seguidos son los pliegues (`foldFreq`). */
  frecuenciaPliegues: number;
  /** Curvatura de la sección: la lámina se enrolla (`curl`). */
  curvatura: number;
  /** Ondulación fina de la superficie (`wave`). */
  ondulacion: number;
  /** Frecuencia de la ondulación (`waveFreq`). */
  frecuenciaOndulacion: number;
  /** Velocidad de la evolución: el tiempo del motor es evolución × velocidad (`speed`). */
  velocidad: number;
  /** Tamaño del punto o grosor de la línea, en px a 1080 de alto (`size`). */
  grosor: number;
  /** Cuánto crecen los puntos cercanos (`perspectiveSize`). */
  crecimientoPorCercania: number;
  /** Inclinación de la cámara, en grados (`tilt`). */
  inclinacion: number;
  /** Giro de la composición, en grados (`roll`). */
  giro: number;
  /** Distancia de la cámara (`distance`). */
  distancia: number;
  /** Desplazamiento horizontal de la imagen (`offsetX`). */
  desplazamientoX: number;
  /** Desplazamiento vertical de la imagen (`offsetY`). */
  desplazamientoY: number;
  /** Brillo: multiplica el alfa de cada punto (`intensity`). */
  brillo: number;
  /** Cuánto se apagan los puntos lejanos (`depthFade`). */
  apagadoPorDistancia: number;
  /** Cuánto gira la cámara con el paralaje del cursor (`parallax`). */
  paralaje: number;
  /** Fuerza de la deformación del cursor (`mouseForm`). */
  deformacionCursor: number;
  /** Radio de la deformación del cursor, en fracción de la vista (`mouseRadius`). */
  radioCursor: number;
  /** Opacidad de los puntos (`dotAlpha`). Dibujo; no cambia la geometría. */
  opacidadPunto: number;
  /** Grosor de la línea, en veces el radio del punto (`lineWeight`). Dibujo. */
  grosorLinea: number;
  /** Opacidad de la línea (`lineAlpha`). Dibujo. */
  opacidadLinea: number;
}

export type ParametroMotor = keyof ConfiguracionMotor;

/** Valores por defecto: `config` de v7 (preset «Lámina plegada»). */
export const CONFIGURACION_POR_DEFECTO: Readonly<ConfiguracionMotor> = Object.freeze({
  lineas: 64,
  puntosPorLinea: 480,
  anchoLamina: 4,
  largoLamina: 13,
  serpenteo: 1.0,
  torsion: 0.5,
  pliegues: 1.8,
  frecuenciaPliegues: 2.0,
  curvatura: 1.8,
  ondulacion: 0.22,
  frecuenciaOndulacion: 1.3,
  velocidad: 0.25,
  grosor: 1.6,
  crecimientoPorCercania: 1.0,
  inclinacion: 18,
  giro: -6,
  distancia: 5.0,
  desplazamientoX: 0,
  desplazamientoY: 0,
  brillo: 1.1,
  apagadoPorDistancia: 1.0,
  paralaje: 1.0,
  deformacionCursor: 0.5,
  radioCursor: 0.22,
  opacidadPunto: 1.0,
  grosorLinea: 1.4,
  opacidadLinea: 0.4,
});

/** Los parámetros en el orden de `config` de v7. */
export const PARAMETROS_MOTOR = Object.keys(CONFIGURACION_POR_DEFECTO) as ParametroMotor[];

/** Parámetros enteros: en la línea de tiempo no se interpolan, saltan («hold»). */
export const PARAMETROS_ENTEROS: readonly ParametroMotor[] = ['lineas', 'puntosPorLinea'];

/** Nombre de cada parámetro en v7 y en los códigos `SP1.`. */
export const NOMBRE_V7: Readonly<Record<ParametroMotor, string>> = Object.freeze({
  lineas: 'lineCount',
  puntosPorLinea: 'points',
  anchoLamina: 'sheetWidth',
  largoLamina: 'sheetLength',
  serpenteo: 'meander',
  torsion: 'twist',
  pliegues: 'fold',
  frecuenciaPliegues: 'foldFreq',
  curvatura: 'curl',
  ondulacion: 'wave',
  frecuenciaOndulacion: 'waveFreq',
  velocidad: 'speed',
  grosor: 'size',
  crecimientoPorCercania: 'perspectiveSize',
  inclinacion: 'tilt',
  giro: 'roll',
  distancia: 'distance',
  desplazamientoX: 'offsetX',
  desplazamientoY: 'offsetY',
  brillo: 'intensity',
  apagadoPorDistancia: 'depthFade',
  paralaje: 'parallax',
  deformacionCursor: 'mouseForm',
  radioCursor: 'mouseRadius',
  opacidadPunto: 'dotAlpha',
  grosorLinea: 'lineWeight',
  opacidadLinea: 'lineAlpha',
});

export function configuracionPorDefecto(): ConfiguracionMotor {
  return { ...CONFIGURACION_POR_DEFECTO };
}
