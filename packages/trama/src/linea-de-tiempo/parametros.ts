/**
 * Qué se puede animar y cómo (`PARAMS` de v7, en su mismo orden).
 * `entero`: no se interpola, salta en el keyframe y se redondea («hold»).
 * `color`: se mezcla en sRGB. `paso`: la precisión con que dos valores se
 * consideran iguales al generar keyframes desde escenas (la mitad del paso).
 * La velocidad y el paralaje no son animables: la evolución depende de la
 * velocidad, y el paralaje es reacción al cursor real.
 */
import type { RutaAnimable } from '../formato/tipos.js';

export interface ParametroAnimable {
  ruta: RutaAnimable;
  grupo: string;
  etiqueta: string;
  min: number;
  max: number;
  paso: number;
  entero?: true;
  color?: true;
}

const P = (grupo: string, ruta: RutaAnimable, etiqueta: string, min: number, max: number, paso: number, extra: { entero?: true; color?: true } = {}): ParametroAnimable =>
  ({ ruta, grupo, etiqueta, min, max, paso, ...extra });

export const PARAMETROS_ANIMABLES: readonly ParametroAnimable[] = Object.freeze([
  P('Tiempo', 'evolucion', 'Evolución', 0, 1000, 0.01),
  P('Lámina', 'anchoLamina', 'Ancho de la lámina', 0.3, 6, 0.05),
  P('Lámina', 'largoLamina', 'Largo', 4, 24, 0.5),
  P('Lámina', 'serpenteo', 'Serpenteo del eje', 0, 2.5, 0.05),
  P('Lámina', 'torsion', 'Torsión', -2, 2, 0.05),
  P('Lámina', 'pliegues', 'Pliegues', 0, 2.5, 0.05),
  P('Lámina', 'frecuenciaPliegues', 'Frecuencia de pliegues', 0.2, 4, 0.05),
  P('Lámina', 'curvatura', 'Curvatura (enrollar)', -3, 3, 0.05),
  P('Lámina', 'ondulacion', 'Ondulación fina', 0, 1, 0.01),
  P('Lámina', 'frecuenciaOndulacion', 'Frecuencia de ondulación', 0.2, 5, 0.05),
  P('Trazo', 'grosor', 'Tamaño de punto / grosor', 0.3, 6, 0.05),
  P('Trazo', 'crecimientoPorCercania', 'Crecimiento por cercanía', 0, 2, 0.05),
  P('Trazo', 'opacidadPunto', 'Opacidad de punto', 0, 1.5, 0.01),
  P('Trazo', 'grosorLinea', 'Grosor de línea', 0.1, 5, 0.05),
  P('Trazo', 'opacidadLinea', 'Opacidad de línea', 0, 1.5, 0.01),
  P('Trazo', 'lineas', 'Líneas', 10, 220, 1, { entero: true }),
  P('Trazo', 'puntosPorLinea', 'Puntos por línea', 30, 600, 1, { entero: true }),
  P('Cámara', 'inclinacion', 'Inclinación', -60, 60, 1),
  P('Cámara', 'giro', 'Giro', -90, 90, 1),
  P('Cámara', 'distancia', 'Distancia', 2.5, 12, 0.1),
  P('Cámara', 'desplazamientoX', 'Desplazamiento H', -0.5, 0.5, 0.01),
  P('Cámara', 'desplazamientoY', 'Desplazamiento V', -0.5, 0.5, 0.01),
  P('Cursor', 'cursor.x', 'Posición X del cursor', 0, 1, 0.01),
  P('Cursor', 'cursor.y', 'Posición Y del cursor', 0, 1, 0.01),
  P('Cursor', 'cursor.presencia', 'Presencia del cursor', 0, 1, 0.01),
  P('Cursor', 'deformacionCursor', 'Deformación del cursor', 0, 2, 0.05),
  P('Cursor', 'radioCursor', 'Radio del cursor', 0.05, 0.6, 0.01),
  P('Luz y color', 'brillo', 'Brillo', 0.1, 2, 0.01),
  P('Luz y color', 'apagadoPorDistancia', 'Apagado por distancia', 0, 1, 0.01),
  P('Luz y color', 'color.lejos', 'Color lejos', 0, 0, 0, { color: true }),
  P('Luz y color', 'color.cerca', 'Color cerca', 0, 0, 0, { color: true }),
  P('Luz y color', 'color.fondo', 'Fondo', 0, 0, 0, { color: true }),
]);

export const PARAMETRO_ANIMABLE: Readonly<Partial<Record<string, ParametroAnimable>>> = Object.freeze(
  Object.fromEntries(PARAMETROS_ANIMABLES.map((p) => [p.ruta, p])),
);

export function esRutaAnimable(x: string): x is RutaAnimable {
  return Object.prototype.hasOwnProperty.call(PARAMETRO_ANIMABLE, x);
}

/** Cuadros por segundo de la grilla de la línea de tiempo (`TL_FPS` de v7). */
export const CUADROS_POR_SEGUNDO_LINEA = 24;
/** Redondea un instante a la grilla de 1/24 s (`snapT` de v7). */
export const ajustarAGrilla = (t: number): number => Math.round(t * CUADROS_POR_SEGUNDO_LINEA) / CUADROS_POR_SEGUNDO_LINEA;
