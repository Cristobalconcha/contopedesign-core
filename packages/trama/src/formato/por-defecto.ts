/**
 * Los valores por defecto del archivo de trama: los del preset «Lámina
 * plegada» de v7, en vivo desde la evolución 6 (el instante del código de
 * referencia de Publisher), sin ancestro.
 */
import { configuracionPorDefecto } from '../motor/configuracion.js';
import { MOTOR_ID, MOTOR_VERSION } from '../motor/lamina.js';
import { CURVA_SUAVE } from '../linea-de-tiempo/suavizados.js';
import { FORMATO_VERSION, TRAMA_KIND, type CursorDeTrama, type Trama, type TransicionDeCierre } from './tipos.js';

export const COLOR_LEJOS_POR_DEFECTO = '#2a52d6';
export const COLOR_CERCA_POR_DEFECTO = '#3dd6c0';
export const COLOR_FONDO_POR_DEFECTO = '#000000';
export const INICIO_POR_DEFECTO = 6;

export const CIERRE_POR_DEFECTO: Readonly<TransicionDeCierre> = Object.freeze({ transicion: 'morph', duracion: 1, curva: CURVA_SUAVE });
export const CURSOR_POR_DEFECTO: Readonly<CursorDeTrama> = Object.freeze({ x: 0.5, y: 0.5, presencia: 0 });
export const DURACION_DE_ESCENA_POR_DEFECTO = 1;

export function tramaPorDefecto(): Trama {
  return {
    kind: TRAMA_KIND,
    version: FORMATO_VERSION,
    motor: { id: MOTOR_ID, version: MOTOR_VERSION },
    lienzo: { tipo: 'libre' },
    dibujo: { modo: 'puntos', tinta: 'auto' },
    color: {
      lejos: { hex: COLOR_LEJOS_POR_DEFECTO, origen: 'manual' },
      cerca: { hex: COLOR_CERCA_POR_DEFECTO, origen: 'manual' },
      fondo: { hex: COLOR_FONDO_POR_DEFECTO, origen: 'manual' },
    },
    configuracion: configuracionPorDefecto(),
    tiempo: { modo: 'vivo', inicio: INICIO_POR_DEFECTO },
    interaccion: { cursor: true, paralaje: false },
    cuadroQuieto: 0,
  };
}
