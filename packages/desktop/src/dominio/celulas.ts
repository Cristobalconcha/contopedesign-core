/**
 * Las Células Madre desde el taller (decisión 35): correr un generador del
 * núcleo sobre el sistema abierto y recordar lo generado.
 *
 * El registro vive en el sistema (`Sistema.celulasMadre`), no en el disco: el
 * taller no vuelve a leer los archivos que escribió. Guarda, por cada
 * generación, la metadata de ancestro y la huella de cada archivo; con eso
 * puede decir, con el ADN de hoy, si cada archivo sigue vigente.
 */
import {
  generarCelula,
  jsonCanonico,
  vigencia,
  type ArchivoGenerado,
  type ArchivoRegistrado,
  type Generador,
  type MetadataDeCelula,
  type Vigencia,
} from '@contope/core';
import type { ArchivoParaGuardar } from '../puente/tipos.js';
import { nuevoId, type Sistema } from './sistema.js';

/** Una generación recordada: qué archivos salieron y de qué ADN. */
export interface CelulaGenerada {
  id: string;
  archivos: ArchivoRegistrado[];
  metadata: MetadataDeCelula;
}

export type GeneracionEnElTaller =
  | { ok: true; celula: CelulaGenerada; archivos: ArchivoGenerado[] }
  | { ok: false; falta: string };

/** Corre el generador sobre el sistema. No toca el sistema: el registro lo hace el reductor. */
export function generarEnElTaller(
  sistema: Sistema,
  generador: Generador,
  parametros: Readonly<Record<string, unknown>>,
  ahora = new Date().toISOString(),
): GeneracionEnElTaller {
  const r = generarCelula(generador, sistema.designSet, { sistema: { designId: sistema.id, nombre: sistema.nombre }, generadoEn: ahora, parametros });
  if (!r.ok) return r;
  return { ok: true, archivos: r.archivos, celula: { id: nuevoId('celula'), archivos: r.registrados, metadata: r.metadata } };
}

/** Los archivos generados, como los pide el puente (todo en bytes). */
export function paraGuardar(archivos: readonly ArchivoGenerado[]): ArchivoParaGuardar[] {
  const utf8 = new TextEncoder();
  return archivos.map((a) => ({
    nombre: a.nombre,
    tipoMime: a.tipoMime,
    bytes: typeof a.contenido === 'string' ? utf8.encode(a.contenido) : a.contenido,
  }));
}

/** Dos generaciones son «la misma» si salieron del mismo generador con los mismos parámetros: la nueva reemplaza a la vieja. */
export function mismaGeneracion(a: MetadataDeCelula, b: MetadataDeCelula): boolean {
  return a.generador.id === b.generador.id && jsonCanonico(a.parametros) === jsonCanonico(b.parametros);
}

/**
 * Registra una generación. Reemplaza a `reemplaza` (lo que se regeneró) si se
 * indica y existe, y si no a la que tenga el mismo generador y parámetros; si
 * no hay ninguna, se suma al final. Nunca quedan dos iguales.
 */
export function registrarCelula(lista: readonly CelulaGenerada[], celula: CelulaGenerada, reemplaza?: string): CelulaGenerada[] {
  let i = reemplaza === undefined ? -1 : lista.findIndex((c) => c.id === reemplaza);
  if (i < 0) i = lista.findIndex((c) => mismaGeneracion(c.metadata, celula.metadata));
  if (i < 0) return [...lista, celula];
  return lista.flatMap((c, k) => (k === i ? [celula] : mismaGeneracion(c.metadata, celula.metadata) ? [] : [c]));
}

/** ¿Lo generado sigue diciendo lo que dice el ADN de hoy? */
export function vigenciaDe(celula: CelulaGenerada, sistema: Sistema): Vigencia {
  return vigencia(celula.metadata, sistema.designSet);
}

/**
 * Nombre corto, para el menú, de las preguntas que leen los generadores. Lo
 * que no esté acá se muestra con el nombre de su dimensión y su id.
 */
export const NOMBRE_CORTO: Readonly<Record<string, string>> = {
  'dim1.req01': 'Fundamento cromático',
  'dim1.req02': 'Colores por rol',
  'dim1.req04': 'Rampas',
  'dim1.req14': 'Reproducción en imprenta',
};
