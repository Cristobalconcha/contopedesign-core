/**
 * El alcance de un sistema: qué preguntas del manifiesto declara necesitar.
 *
 * Hasta acá la completitud se medía contra el manifiesto entero (las 79
 * preguntas). El dueño del producto lo corrigió el 18-09-2026: la completitud
 * se mide contra lo que el diseñador declaró necesitar, y lo que queda fuera
 * del paquete no es una ausencia, es algo que este sistema no declara.
 *
 * Dos reglas mandan sobre la lista de dimensiones marcadas:
 * - Las preguntas del núcleo del mundo elegido entran SIEMPRE, aunque su
 *   dimensión no esté marcada: son las que ese mundo no puede dejar sin
 *   responder.
 * - Sin alcance declarado, entran todas: un sistema viejo —o uno que prefiera
 *   no acotar— se comporta como hoy.
 */
import type { DimensionId } from '@contope/core';
import { REQUISITOS, dimensionDe } from './manifiesto.js';
import { enNucleo } from './nucleos.js';
import type { Sistema } from './sistema.js';

export interface Alcance {
  proposito: string;
  /** Dimensiones marcadas: todas sus preguntas entran al paquete. */
  dimensiones: DimensionId[];
  declaradoEn: string; // ISO
}

/** El conjunto de ids exigidos. */
export function paqueteDe(sistema: Sistema): ReadonlySet<string> {
  if (sistema.alcance === null) return new Set(REQUISITOS.map((r) => r.id));
  const marcadas = new Set<DimensionId>(sistema.alcance.dimensiones);
  return new Set(
    REQUISITOS.filter((r) => marcadas.has(dimensionDe(r.id)) || enNucleo(sistema.mundo, r.id)).map((r) => r.id),
  );
}

/** ¿Esta pregunta se exige? Sin alcance declarado, todas. Las del núcleo del mundo, siempre. */
export function enPaquete(sistema: Sistema, requirementId: string): boolean {
  return paqueteDe(sistema).has(requirementId);
}
