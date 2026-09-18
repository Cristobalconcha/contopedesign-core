/**
 * Evaluación y validación de un núcleo de mundo.
 *
 * `evaluarNucleo` no vuelve a evaluar requisitos: recibe los resultados por
 * requisito que ya produjo `evaluateManifest` (uno por dimensión) y los
 * payloads del set, y responde dos cosas: si todas las preguntas que el mundo
 * exige están resueltas, y si cada regla del mundo se cumple sobre el payload
 * de su requisito. Una regla se evalúa con `evaluatePredicate`, el mismo
 * evaluador del manifiesto, con el store de la dimensión del requisito.
 *
 * Fail-closed, igual que la verdad-vacía del predicado: un requisito del
 * núcleo que no fue evaluado cuenta como faltante; una regla cuyo requisito
 * no está resuelto o no tiene payload cuenta como no cumplida. No se puede
 * declarar cubierto lo que nadie miró.
 *
 * `validarNucleo` es la comprobación estructural: cada id existe en los
 * manifiestos que se le pasan y está activo, sin repetidos, cada regla apunta
 * a una entrada del núcleo y trae cita. Un núcleo que apunta a un requisito
 * inexistente es un error de programa, no una ausencia del set.
 */
import { evaluatePredicate } from '../requirement-manifest/predicate.js';
import type {
  RectoraV0,
  RequirementManifestV0,
  RequirementResultV0,
  RequirementV0,
  VerificationRecordV0,
} from '../requirement-manifest/types.js';
import { REQUIREMENT_ID_PATTERN } from '../requirement-manifest/types.js';
import type { NucleoDeMundoV0, NucleoEvaluationV0, ReglaResultV0 } from './types.js';

export interface EvaluarNucleoInput {
  nucleo: NucleoDeMundoV0;
  /** Resultados por requisito, de `evaluateManifest` de cada dimensión. */
  resultados: ReadonlyMap<string, RequirementResultV0>;
  /** Payloads del set por id de requisito (todas las dimensiones). */
  payloads: ReadonlyMap<string, unknown>;
  /** Los manifiestos que definen los requisitos nombrados (para el payloadSchema y el store por dimensión). */
  manifests: readonly RequirementManifestV0[];
  rectoras: Map<string, RectoraV0>;
  verifications?: Map<string, VerificationRecordV0> | undefined;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

export function evaluarNucleo(input: EvaluarNucleoInput): NucleoEvaluationV0 {
  const { nucleo } = input;
  const faltantes: string[] = [];
  for (const entrada of nucleo.entradas) {
    const r = input.resultados.get(entrada.requisitoId);
    if (r === undefined || r.resultado !== 'resuelto') faltantes.push(entrada.requisitoId);
  }

  const porId = new Map<string, RequirementV0>();
  for (const m of input.manifests) for (const r of m.requirements) porId.set(r.id, r);

  const reglas: ReglaResultV0[] = nucleo.reglas.map((regla) => {
    // Condición sobre otra pregunta: si no se cumple, la regla no aplica a esta pieza.
    if (regla.condicion !== undefined) {
      const otro = input.payloads.get(regla.condicion.requisitoId);
      let v: unknown = otro;
      for (const seg of regla.condicion.ruta) v = isRecord(v) ? v[String(seg)] : Array.isArray(v) && typeof seg === 'number' ? v[seg] : undefined;
      if (v !== regla.condicion.igualA) {
        return {
          reglaId: regla.id,
          requisitoId: regla.requisitoId,
          resultado: 'no-aplica',
          motivos: [{ codigo: 'regla-no-aplica', mensaje: `regla ${regla.id}: rige sólo cuando ${regla.condicion.requisitoId}.${regla.condicion.ruta.join('.')} = ${regla.condicion.igualA}` }],
        };
      }
    }
    const requisito = porId.get(regla.requisitoId);
    const resultado = input.resultados.get(regla.requisitoId);
    const payload = input.payloads.get(regla.requisitoId);
    if (requisito === undefined) {
      return {
        reglaId: regla.id,
        requisitoId: regla.requisitoId,
        resultado: 'no-cumple',
        motivos: [{ codigo: 'requisito-inexistente', mensaje: `regla ${regla.id}: el requisito '${regla.requisitoId}' no está en los manifiestos dados` }],
      };
    }
    if (resultado === undefined || resultado.resultado !== 'resuelto' || !isRecord(payload)) {
      return {
        reglaId: regla.id,
        requisitoId: regla.requisitoId,
        resultado: 'no-cumple',
        motivos: [{ codigo: 'requisito-no-resuelto', mensaje: `regla ${regla.id}: '${regla.requisitoId}' no está resuelto, así que la regla no se puede cumplir` }],
      };
    }
    // Store: los payloads de la MISMA dimensión, sin el propio (decisión 3 de la ficha C1).
    const dim = regla.requisitoId.split('.')[0] ?? '';
    const store = new Map<string, Record<string, unknown>>();
    for (const [id, p] of input.payloads) {
      if (id !== regla.requisitoId && id.startsWith(`${dim}.`) && isRecord(p)) store.set(id, p);
    }
    const r = evaluatePredicate(regla.clausulas, {
      selfId: regla.requisitoId,
      payload,
      payloadSchema: requisito.payloadSchema,
      store,
      rectoras: input.rectoras,
      ...(input.verifications !== undefined ? { verifications: input.verifications } : {}),
    });
    return {
      reglaId: regla.id,
      requisitoId: regla.requisitoId,
      resultado: r.ok ? 'cumple' : 'no-cumple',
      motivos: r.motivos.map((m) => ({ codigo: m.codigo, mensaje: `regla ${regla.id} (${regla.nombre}): ${m.mensaje}` })),
    };
  });

  const total = nucleo.entradas.length;
  const reglasCumplidas = reglas.filter((r) => r.resultado !== 'no-cumple').length;
  const cubierto = total > 0 && faltantes.length === 0 && reglasCumplidas === reglas.length;
  return {
    mundoId: nucleo.mundoId,
    resultado: cubierto ? 'cubierto' : 'no-cubierto',
    faltantes,
    reglas,
    contador: { cubiertos: total - faltantes.length, total, reglasCumplidas, reglasTotal: reglas.length },
  };
}

export interface NucleoValidationResult {
  ok: boolean;
  errores: string[];
}

export function validarNucleo(
  nucleo: NucleoDeMundoV0,
  manifests: readonly RequirementManifestV0[],
): NucleoValidationResult {
  const errores: string[] = [];
  const e = (msg: string): void => {
    errores.push(`núcleo '${nucleo.mundoId}': ${msg}`);
  };
  if (nucleo.entradas.length === 0) e('sin entradas (un núcleo vacío no es un núcleo)');
  if (nucleo.fuente.trim() === '') e('sin fuente medida');
  const activos = new Map<string, boolean>();
  for (const m of manifests) for (const r of m.requirements) activos.set(r.id, r.estado === 'active');
  const vistos = new Set<string>();
  for (const entrada of nucleo.entradas) {
    if (!REQUIREMENT_ID_PATTERN.test(entrada.requisitoId)) {
      e(`id '${entrada.requisitoId}' no tiene el patrón dimN.reqNN`);
      continue;
    }
    if (vistos.has(entrada.requisitoId)) e(`'${entrada.requisitoId}' repetido`);
    vistos.add(entrada.requisitoId);
    const activo = activos.get(entrada.requisitoId);
    if (activo === undefined) e(`'${entrada.requisitoId}' no existe en los manifiestos dados`);
    else if (!activo) e(`'${entrada.requisitoId}' está deprecated`);
    if (entrada.porque.trim() === '') e(`'${entrada.requisitoId}' sin porqué`);
  }
  const reglasVistas = new Set<string>();
  for (const regla of nucleo.reglas) {
    if (reglasVistas.has(regla.id)) e(`regla '${regla.id}' repetida`);
    reglasVistas.add(regla.id);
    if (!vistos.has(regla.requisitoId)) e(`regla '${regla.id}' apunta a '${regla.requisitoId}', que no es una entrada del núcleo`);
    if (regla.cita.trim() === '') e(`regla '${regla.id}' sin cita (una regla sin cita es un invento)`);
    if (regla.clausulas.length === 0) e(`regla '${regla.id}' sin cláusulas`);
    if (regla.condicion !== undefined && !activos.has(regla.condicion.requisitoId)) e(`regla '${regla.id}': su condición apunta a '${regla.condicion.requisitoId}', que no existe`);
  }
  return { ok: errores.length === 0, errores };
}
