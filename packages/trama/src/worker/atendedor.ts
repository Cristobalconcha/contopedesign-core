/**
 * El protocolo del worker de tramas, sin el worker: una máquina de estados
 * pura que recibe mensajes y envía cuadros. `entradas/worker.ts` la conecta
 * con `self.postMessage` y `setTimeout`; las pruebas la conectan con
 * funciones de mentira.
 *
 * Es el protocolo de Publisher hoy (configurar → pedir cuadros hasta k →
 * cuadro listo), con dos cambios: recibe una TRAMA (la receta entera, en
 * objeto o en texto JSON/CT1/SP1) en vez de una configuración suelta, y
 * evalúa la línea de tiempo en cada cuadro.
 *
 *   página → worker  { tipo: 'configurar', gen, trama, ancho, alto, fps, calidad? }
 *   worker → página  { tipo: 'configurado', gen, lineas, puntos, avisos }
 *                    { tipo: 'error', gen, errores }        (trama inválida)
 *   página → worker  { tipo: 'pedir', gen, hasta }          (cuadros 0..hasta)
 *   worker → página  { tipo: 'cuadro', gen, k, t, datos, colores }
 *
 * `gen` numera las configuraciones: un mensaje de una generación vieja se
 * ignora. Se calcula UN cuadro por turno y entre cuadro y cuadro el worker
 * atiende mensajes, así una configuración nueva (cambio de tamaño, otra
 * trama) nunca espera a que termine trabajo obsoleto. `datos` es un
 * `Float32Array` que se transfiere (no se copia).
 *
 * Todos los cuadros de una trama miden lo mismo, salvo que su línea de
 * tiempo anime `lineas` o `puntosPorLinea`: entonces el tamaño cambia en
 * esos keyframes, y la página sólo debe mezclar cuadros del mismo largo.
 */
import { leerTrama } from '../formato/codigo.js';
import type { ClaveDeColor, Trama } from '../formato/tipos.js';
import type { ErrorDeValidacion } from '../formato/validar.js';
import { estadoEn } from '../linea-de-tiempo/evaluar.js';
import { cuadroDeEstado, dimensionesDeLamina } from '../motor/lamina.js';
import { instanteDeCuadro } from '../reproduccion.js';

export interface MensajeConfigurar {
  tipo: 'configurar';
  gen: number;
  trama: unknown;
  ancho: number;
  alto: number;
  fps: number;
  calidad?: number;
}
export interface MensajePedir { tipo: 'pedir'; gen: number; hasta: number }
export type MensajeAlWorker = MensajeConfigurar | MensajePedir;

export interface MensajeConfigurado { tipo: 'configurado'; gen: number; lineas: number; puntos: number; avisos: string[] }
export interface MensajeError { tipo: 'error'; gen: number; errores: ErrorDeValidacion[] }
export interface MensajeCuadro { tipo: 'cuadro'; gen: number; k: number; t: number; datos: Float32Array; colores: Record<ClaveDeColor, string> }
export type MensajeDelWorker = MensajeConfigurado | MensajeError | MensajeCuadro;

export type Enviar = (m: MensajeDelWorker, transferir?: ArrayBuffer[]) => void;
export type Programar = (fn: () => void) => void;

/** Un atendedor: devuelve la función que recibe cada mensaje. */
export function crearAtendedor(enviar: Enviar, programar: Programar): (m: unknown) => void {
  let trabajo: { trama: Trama; ancho: number; alto: number; fps: number; calidad: number } | null = null;
  let gen = -1, siguiente = 0, hasta = -1, ocupado = false;

  const bombear = (): void => {
    if (!trabajo || siguiente > hasta) { ocupado = false; return; }
    ocupado = true;
    const k = siguiente++, g = gen, { trama, ancho, alto, fps, calidad } = trabajo;
    const t = instanteDeCuadro(trama, k, fps);
    const estado = estadoEn(trama, t);
    const datos = cuadroDeEstado(estado.motor, ancho, alto, calidad);
    enviar({ tipo: 'cuadro', gen: g, k, t, datos, colores: estado.colores }, [datos.buffer as ArrayBuffer]);
    programar(bombear);
  };

  return (m: unknown): void => {
    if (typeof m !== 'object' || m === null) return;
    const msg = m as Partial<MensajeAlWorker>;
    if (msg.tipo === 'configurar') {
      const c = msg as MensajeConfigurar;
      gen = c.gen; siguiente = 0; hasta = -1; trabajo = null;
      const lectura = leerTrama(c.trama);
      const medidas = [c.ancho, c.alto, c.fps].every((v) => typeof v === 'number' && Number.isFinite(v) && v > 0);
      if (!lectura.ok || !medidas) {
        enviar({ tipo: 'error', gen, errores: lectura.ok ? [{ ruta: '', mensaje: 'ancho, alto y fps deben ser números positivos' }] : lectura.errores });
        return;
      }
      const calidad = typeof c.calidad === 'number' && c.calidad > 0 && c.calidad <= 1 ? c.calidad : 1;
      trabajo = { trama: lectura.trama, ancho: c.ancho, alto: c.alto, fps: c.fps, calidad };
      const d = dimensionesDeLamina(lectura.trama.configuracion, calidad);
      enviar({ tipo: 'configurado', gen, lineas: d.lineas, puntos: d.puntos, avisos: lectura.avisos });
    } else if (msg.tipo === 'pedir' && trabajo && msg.gen === gen && typeof msg.hasta === 'number') {
      hasta = Math.max(hasta, msg.hasta);
    }
    if (!ocupado) bombear();
  };
}
