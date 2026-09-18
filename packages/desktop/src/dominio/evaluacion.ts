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
 *
 * Desde el 18-09-2026 la completitud se mide contra el PAQUETE de definiciones
 * del sistema (lo que el alcance declara), no contra el manifiesto entero.
 * `porRequisito` y `porDimension` siguen cubriendo todo, porque la interfaz
 * necesita el estado de lo que quedó fuera para mostrarlo apagado.
 */
import {
  evaluarNucleo,
  evaluateManifest,
  toFullPayloadsMap,
  toPayloadsMap,
  type DimensionEvaluationV0,
  type NucleoEvaluationV0,
  type DimensionId,
  type RectoraV0,
  type RequirementResultV0,
  type VerificationRecordV0,
} from '@contope/core';
import { paqueteDe } from './alcance.js';
import { MANIFIESTOS, REQUISITOS } from './manifiesto.js';
import { nucleoDeMundo } from './nucleos.js';
import type { Sistema } from './sistema.js';

export interface Evaluacion {
  porRequisito: ReadonlyMap<string, RequirementResultV0>;
  porDimension: ReadonlyMap<DimensionId, DimensionEvaluationV0>;
  /** Los ids exigidos por el alcance del sistema (el manifiesto entero si no hay alcance). */
  paquete: ReadonlySet<string>;
  resueltos: number;
  /** Tamaño del paquete: los requisitos que este sistema declara necesitar. */
  total: number;
  /** Cuántos requisitos del manifiesto quedaron fuera del paquete. */
  fueraDelPaquete: number;
  /** Todos los requisitos del paquete están resueltos. */
  completo: boolean;
  /** El núcleo del mundo elegido, si ese mundo tiene uno medido (preguntas y reglas). */
  nucleo: NucleoEvaluationV0 | undefined;
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
  const paquete = paqueteDe(sistema);
  const resueltos = [...porRequisito.values()].filter((r) => r.resultado === 'resuelto' && paquete.has(r.requisitoId)).length;
  const n = nucleoDeMundo(sistema.mundo);
  const nucleo =
    n === undefined
      ? undefined
      : evaluarNucleo({
          nucleo: n,
          resultados: porRequisito,
          payloads: toFullPayloadsMap(sistema.designSet),
          manifests: MANIFIESTOS,
          rectoras: rectorasSinRestricciones(),
          verifications,
        });
  return {
    nucleo,
    porRequisito,
    porDimension,
    paquete,
    resueltos,
    total: paquete.size,
    fueraDelPaquete: REQUISITOS.length - paquete.size,
    completo: resueltos === paquete.size,
  };
}

/** Los motivos de un requisito, sin repetir el ruido de dependencias cuando ya se ve arriba. */
export function motivosLegibles(resultado: RequirementResultV0 | undefined): string[] {
  if (!resultado) return ['sin evaluar'];
  return resultado.motivos.map((m) => m.mensaje);
}
