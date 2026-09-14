/**
 * La completitud la calcula el núcleo, no la interfaz. Este módulo sólo
 * prepara lo que `evaluateManifest` pide y ordena el resultado por requisito
 * para poder pintarlo.
 *
 * Las rectoras (descriptor y mood wall) se pasan SIN restricciones, porque el
 * taller todavía no tiene dónde declararlas. Es lo mismo que hace la fixture
 * del núcleo; cuando exista el descriptor semántico, se pasan las de verdad.
 * Un requisito ligado a una rectora que no existe queda no-resuelto
 * (fail-closed del núcleo), por eso no se puede omitirlas.
 */
import {
  evaluateManifest,
  toPayloadsMap,
  type DimensionEvaluationV0,
  type DimensionId,
  type RectoraV0,
  type RequirementResultV0,
  type VerificationRecordV0,
} from '@contope/core';
import { MANIFIESTOS, REQUISITOS } from './manifiesto.js';
import type { Sistema } from './sistema.js';

export interface Evaluacion {
  porRequisito: ReadonlyMap<string, RequirementResultV0>;
  porDimension: ReadonlyMap<DimensionId, DimensionEvaluationV0>;
  resueltos: number;
  total: number;
  /** Todos los requisitos activos del manifiesto están resueltos. */
  completo: boolean;
}

export function rectorasSinRestricciones(): Map<string, RectoraV0> {
  return new Map<string, RectoraV0>([
    ['descriptor', { id: 'descriptor', tagsRequeridos: [], tagsProhibidos: [], exclusiones: [] }],
    ['mood-wall', { id: 'mood-wall', tagsRequeridos: [], tagsProhibidos: [], exclusiones: [] }],
  ]);
}

export function evaluar(sistema: Sistema): Evaluacion {
  const verifications = new Map<string, VerificationRecordV0>(
    sistema.verificaciones.map((v) => [v.pruebaId, v]),
  );
  const porRequisito = new Map<string, RequirementResultV0>();
  const porDimension = new Map<DimensionId, DimensionEvaluationV0>();
  for (const manifest of MANIFIESTOS) {
    const dim = manifest.requirements[0]?.dimensionId;
    if (dim === undefined) continue;
    const evaluacion = evaluateManifest({
      manifest,
      payloads: toPayloadsMap(sistema.designSet, dim),
      rectoras: rectorasSinRestricciones(),
      verifications,
    });
    porDimension.set(dim, evaluacion);
    for (const r of evaluacion.resultados) porRequisito.set(r.requisitoId, r);
  }
  const resueltos = [...porRequisito.values()].filter((r) => r.resultado === 'resuelto').length;
  return {
    porRequisito,
    porDimension,
    resueltos,
    total: REQUISITOS.length,
    completo: resueltos === REQUISITOS.length,
  };
}

/** Los motivos de un requisito, sin repetir el ruido de dependencias cuando ya se ve arriba. */
export function motivosLegibles(resultado: RequirementResultV0 | undefined): string[] {
  if (!resultado) return ['sin evaluar'];
  return resultado.motivos.map((m) => m.mensaje);
}
