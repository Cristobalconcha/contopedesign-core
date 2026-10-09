/**
 * Una trama en el tiempo: qué instante le toca a cada cuadro y el cuadro de
 * un instante. Es lo que comparten el worker, el reproductor y el
 * exportador de video, para que todos cuenten el tiempo igual.
 */
import type { Trama } from './formato/tipos.js';
import { estadoEn, type Entorno, type EstadoDeTrama } from './linea-de-tiempo/evaluar.js';
import { cuadroDeEstado } from './motor/lamina.js';

/**
 * El instante (s) del cuadro k a `fps` cuadros por segundo. En vivo, k / fps
 * sin fin. En una secuencia que se repite, vuelve a 0 al completar
 * `round(duración × fps)` cuadros: el instante `duración` nunca se dibuja,
 * porque con el ciclo cerrado es igual al 0. Una que se detiene queda en
 * su último instante.
 */
export function instanteDeCuadro(trama: Trama, k: number, fps: number): number {
  const t = trama.tiempo;
  if (t.modo === 'vivo') return k / fps;
  if (t.alTerminar === 'detener') return Math.min(k / fps, t.duracion);
  const total = Math.max(1, Math.round(t.duracion * fps));
  return (((k % total) + total) % total) / fps;
}

/** Cuántos cuadros tiene una vuelta de la secuencia (para un video), o `null` en vivo. */
export function cuadrosDeSecuencia(trama: Trama, fps: number): number | null {
  return trama.tiempo.modo === 'vivo' ? null : Math.max(1, Math.round(trama.tiempo.duracion * fps));
}

/** El cuadro de una trama en el instante t, con morf si toca. */
export function cuadroEn(trama: Trama, t: number, ancho: number, alto: number, calidad = 1, entorno: Entorno = {}): { cuadro: Float32Array; estado: EstadoDeTrama } {
  const estado = estadoEn(trama, t, entorno);
  return { cuadro: cuadroDeEstado(estado.motor, ancho, alto, calidad), estado };
}
