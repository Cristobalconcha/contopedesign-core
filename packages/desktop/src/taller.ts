/**
 * El estado de la ventana: qué sistema está abierto, en qué archivo, en qué
 * pantalla, y qué instrumento está desplegado encima. El sistema en sí lo
 * gobierna `dominio/reductor.ts`; esto es sólo lo que la ventana necesita
 * saber además.
 */
import { createContext, useContext } from 'react';
import type { Evaluacion } from './dominio/evaluacion.js';
import type { Accion } from './dominio/reductor.js';
import type { Sistema } from './dominio/sistema.js';
import type { Puente } from './puente/index.js';

export type Pantalla = 'inicio' | 'recoleccion' | 'definicion' | 'construccion';

/** Un instrumento abierto desde un parámetro (INTERFAZ.md: ventanas, no etapas). */
export type Instrumento =
  | { tipo: 'tipografia'; requirementId: string; nombreBuscado?: string }
  | { tipo: 'color'; requirementId: string }
  | { tipo: 'espacio'; requirementId: string }
  | { tipo: 'editor'; requirementId: string };

export interface Archivo {
  ruta: string | null;
  nombre: string;
}

export interface Taller {
  sistema: Sistema | null;
  archivo: Archivo | null;
  /** `actualizadoEn` del sistema la última vez que se guardó. */
  guardadoEn: string | null;
  pantalla: Pantalla;
  instrumento: Instrumento | null;
  aviso: { texto: string; tono: 'normal' | 'error' } | null;
}

export interface Contexto {
  taller: Taller;
  sistema: Sistema;
  evaluacion: Evaluacion;
  puente: Puente;
  despachar(accion: Accion): void;
  ir(pantalla: Pantalla): void;
  abrir(instrumento: Instrumento): void;
  cerrarInstrumento(): void;
  avisar(texto: string, tono?: 'normal' | 'error'): void;
}

export const ContextoTaller = createContext<Contexto | null>(null);

export function useTaller(): Contexto {
  const c = useContext(ContextoTaller);
  if (c === null) throw new Error('useTaller fuera del taller');
  return c;
}
