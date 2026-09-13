/**
 * Evaluación binaria del requisito y del manifiesto (spec §8.1).
 *
 * resolved(req) ⟺ payload válido contra payloadSchema ∧ validityPredicate
 * pasa ∧ sin contradicción con ninguna rectora vinculada (§8.2) ∧ todas las
 * dependsOn están resueltas. El resultado es SIEMPRE resuelto|no-resuelto
 * con diagnósticos; nunca un tercer estado.
 *
 * Vía de escape (§8.2): una alegación de contradicción difusa no capturable
 * por match literal deja el requisito no-resuelto con diagnóstico
 * `requiere-veredicto-humano-registrado` y no vuelve a resuelto sin un
 * veredicto humano registrado (autor, fecha, motivo). El veredicto no
 * anula el match literal mecánico: solo neutraliza alegaciones difusas.
 */
import { validateManifestStructure } from './graph.js';
import { evaluateNoConflict } from './no-conflict.js';
import { isRecord, validatePayload } from './payload.js';
import { collectNoConflictIds, evaluatePredicate } from './predicate.js';
import type {
  DiffuseAllegationV0,
  DimensionEvaluationV0,
  DimensionId,
  HumanVerdictV0,
  Motivo,
  PayloadSchema,
  RectoraV0,
  RequirementManifestV0,
  RequirementResultV0,
  RequirementV0,
  VerificationRecordV0,
} from './types.js';

export interface EvaluateRequirementInput {
  requisito: RequirementV0;
  /** Definición efectiva que el set declara para este requisito. */
  payload: unknown;
  /**
   * Store de definiciones resueltas de OTROS requisitos de la dimensión
   * (decisión 3 de la ficha): Map<reqId, payload resuelto>. No debe incluir
   * el payload del propio requisito.
   */
  store: Map<string, Record<string, unknown>>;
  rectoras: Map<string, RectoraV0>;
  /** Resultados de las dependsOn (gate §8.1); ausente = fail-closed. */
  dependencyResults?: Map<string, RequirementResultV0> | undefined;
  verifications?: Map<string, VerificationRecordV0> | undefined;
  humanVerdicts?: HumanVerdictV0[] | undefined;
  diffuseAllegations?: DiffuseAllegationV0[] | undefined;
}

export function evaluateRequirement(input: EvaluateRequirementInput): RequirementResultV0 {
  const { requisito } = input;
  const motivos: Motivo[] = [];
  const schema: PayloadSchema = requisito.payloadSchema;
  const payloadRecord = isRecord(input.payload) ? input.payload : {};

  // 1. Payload válido contra payloadSchema (spec §8.1.1).
  const payloadCheck = validatePayload(input.payload, schema);
  if (!payloadCheck.ok) motivos.push(...payloadCheck.motivos);

  // 2. validityPredicate completo (TODAS las cláusulas).
  const predicate = evaluatePredicate(requisito.validityPredicate, {
    selfId: requisito.id,
    payload: payloadRecord,
    payloadSchema: schema,
    store: input.store,
    rectoras: input.rectoras,
    ...(input.verifications !== undefined ? { verifications: input.verifications } : {}),
  });
  if (!predicate.ok) motivos.push(...predicate.motivos);

  // 3. rectorBindings (spec §8.2): noConflict por cada binding no cubierto
  //    explícitamente por una cláusula del predicado (se evalúa una sola vez).
  const explicitNoConflict = collectNoConflictIds(requisito.validityPredicate);
  for (const binding of requisito.rectorBindings) {
    if (explicitNoConflict.has(binding)) continue;
    const res = evaluateNoConflict({
      rectoraId: binding,
      rectora: input.rectoras.get(binding),
      payload: payloadRecord,
      payloadSchema: schema,
    });
    if (!res.ok && res.motivo !== undefined) motivos.push(res.motivo);
  }

  // 4. Vía de escape (spec §8.2): alegación difusa sin veredicto registrado.
  const allegations = (input.diffuseAllegations ?? []).filter((a) => a.requisitoId === requisito.id);
  const verdicts = (input.humanVerdicts ?? []).filter((v) => v.requisitoId === requisito.id);
  if (allegations.length > 0 && verdicts.length === 0) {
    const allegation = allegations[0];
    if (allegation !== undefined) {
      motivos.push({
        codigo: 'requiere-veredicto-humano-registrado',
        mensaje: `alegación de contradicción difusa sin veredicto humano registrado: ${allegation.motivo}`,
      });
    }
  }

  // 5. Gate de dependencias (spec §4.1, §8.1): dependencia no-resuelta ⇒ no-resuelto.
  for (const dep of requisito.dependsOn) {
    const depResult = input.dependencyResults?.get(dep);
    if (depResult === undefined) {
      motivos.push({
        codigo: 'dependencia-no-evaluada',
        mensaje: `dependencia '${dep}' sin resultado en el contexto (fail-closed)`,
      });
      continue;
    }
    if (depResult.resultado !== 'resuelto') {
      motivos.push({ codigo: 'dependencia-no-resuelta', mensaje: `dependencia '${dep}' no-resuelta` });
    }
  }

  return {
    requisitoId: requisito.id,
    resultado: motivos.length === 0 ? 'resuelto' : 'no-resuelto',
    motivos,
  };
}

export interface EvaluateManifestInput {
  manifest: RequirementManifestV0;
  /** Payloads por requisito; ausente = ese requisito queda no-resuelto (fail-closed). */
  payloads: Map<string, unknown>;
  rectoras: Map<string, RectoraV0>;
  verifications?: Map<string, VerificationRecordV0> | undefined;
  humanVerdicts?: HumanVerdictV0[] | undefined;
  diffuseAllegations?: DiffuseAllegationV0[] | undefined;
}

/**
 * Orden topológico determinista (DFS post-order en orden del documento y de
 * dependencias declarado) para que el gate de dependsOn siempre encuentre el
 * resultado de sus dependencias.
 */
function topologicalOrder(active: readonly RequirementV0[]): RequirementV0[] {
  const byId = new Map<string, RequirementV0>(active.map((r) => [r.id, r]));
  const visited = new Set<string>();
  const order: RequirementV0[] = [];
  const visit = (req: RequirementV0): void => {
    if (visited.has(req.id)) return;
    visited.add(req.id);
    for (const dep of req.dependsOn) {
      const depReq = byId.get(dep);
      if (depReq !== undefined) visit(depReq);
    }
    order.push(req);
  };
  for (const req of active) visit(req);
  return order;
}

/**
 * Evaluación del manifiesto (spec §8.1.2): AND estricto sobre los activos.
 * Un manifiesto estructuralmente inválido se rechaza en bloque (throw):
 * "un manifiesto inválido no evalúa nada" (spec §4.1). Los deprecados no se
 * evalúan y no cuentan ni a favor ni en contra (spec §3.3).
 */
export function evaluateManifest(input: EvaluateManifestInput): DimensionEvaluationV0 {
  const validation = validateManifestStructure(input.manifest);
  if (!validation.ok) {
    const detalle = validation.errores.map((e) => e.mensaje).join('; ');
    throw new Error(`manifiesto inválido — rechazo en bloque (spec §4.1): ${detalle}`);
  }

  const requirements = input.manifest.requirements;
  const active = requirements.filter((r) => r.estado === 'active');
  const results = new Map<string, RequirementResultV0>();

  for (const req of topologicalOrder(active)) {
    const store = new Map<string, Record<string, unknown>>();
    for (const other of active) {
      if (other.id === req.id) continue;
      const payload = input.payloads.get(other.id);
      if (isRecord(payload)) store.set(other.id, payload);
    }
    results.set(
      req.id,
      evaluateRequirement({
        requisito: req,
        payload: input.payloads.get(req.id),
        store,
        rectoras: input.rectoras,
        dependencyResults: results,
        ...(input.verifications !== undefined ? { verifications: input.verifications } : {}),
        ...(input.humanVerdicts !== undefined ? { humanVerdicts: input.humanVerdicts } : {}),
        ...(input.diffuseAllegations !== undefined ? { diffuseAllegations: input.diffuseAllegations } : {}),
      }),
    );
  }

  const resultados: RequirementResultV0[] = active.map((req) => {
    const result = results.get(req.id);
    if (result !== undefined) return result;
    return {
      requisitoId: req.id,
      resultado: 'no-resuelto',
      motivos: [{ codigo: 'no-evaluado', mensaje: 'requisito no evaluado' }],
    };
  });
  const resueltos = resultados.filter((r) => r.resultado === 'resuelto').length;
  const firstRequirement = requirements[0];
  const dimensionId: DimensionId = firstRequirement?.dimensionId ?? 'dim1';

  return {
    dimensionId,
    resultados,
    // Fail-closed también a nivel dimensión: sin requisitos activos no hay
    // nada que verificar y la dimensión no puede declararse resuelta.
    resultado: resueltos === resultados.length && resultados.length > 0 ? 'resuelto' : 'no-resuelto',
    contador: { resueltos, activos: resultados.length },
  };
}
