/**
 * validityPredicate: AST estructurado (unión discriminada serializable) del
 * contrato spec-c1-requirement-manifest-2026-08-30.md §2.1, más la EXTENSIÓN
 * R1 exigida por la ficha C1-implementación (cuantificación cruzada entre
 * requisitos de la misma dimensión).
 *
 * Decisiones de diseño (ficha C1-implementación, obligatorias):
 * 1. El predicado es DATO serializable: nunca strings que se parsean en
 *    runtime. La serialización del manifiesto es el propio dato.
 * 2. Verdad-vacía FAIL-CLOSED en TODAS las cláusulas cuantificadas:
 *    colección/slot ausente o vacío ⇒ false con motivo. Ningún predicado
 *    puede pasar "por no haber nada que verificar".
 * 3. La evaluación recibe un CONTEXTO: payload propio + store de
 *    definiciones resueltas de otros requisitos (Map<reqId, payload>).
 *
 * Precedencia de resolución de nombres dentro de un cuantificador
 * (documentada en la nota de extensión): bindings R1 → componentes
 * declaradas (everyPar) → campos de la tupla actual → slots del payload.
 *
 * Desviaciones frente a §2.1, documentadas en la nota de extensión:
 * - `sum`/`count` sobre colección ausente O vacía ⇒ false con motivo
 *   (fail-closed por decisión 2 de la ficha); §2.1 decía "0".
 * - Comparación numérica `==`/`!=` usa tolerancia 1e-9 (floats de sum).
 */
import { isColorCss, isLengthCss, lengthCssToPx } from './css-values.js';
import { evaluateNoConflict } from './no-conflict.js';
import { collectStringLeaves, isRecord } from './payload.js';
import {
  isRefValue,
  type Motivo,
  type PayloadSchema,
  type RectoraV0,
  type VerificationRecordV0,
} from './types.js';

export type PathSegment = string | number;

export type ScalarLiteral =
  | { kind: 'number'; value: number }
  | { kind: 'string'; value: string }
  | { kind: 'boolean'; value: boolean };

/** Literal esperado por `covers`: escalar, o tupla para claves compuestas. */
export type CoverExpected = ScalarLiteral | { kind: 'tuple'; items: readonly ScalarLiteral[] };

export type CompareOp = '==' | '!=' | '<' | '<=' | '>' | '>=';

export type Operand =
  | { kind: 'path'; path: readonly PathSegment[] }
  | ScalarLiteral
  | { kind: 'sum'; collection: readonly PathSegment[]; field: string }
  | { kind: 'count'; target: readonly PathSegment[] };

export type PredicateClause =
  /** §2.1: slot presente y no vacío. */
  | { kind: 'exists'; target: readonly PathSegment[] }
  /** Extensión: exactamente un valor (no colección de más de una entrada). */
  | { kind: 'singleton'; target: readonly PathSegment[] }
  /** §2.1: cubre TODA la lista cerrada citada. */
  | {
      kind: 'covers';
      target: readonly PathSegment[];
      key: readonly string[];
      expected: readonly CoverExpected[];
    }
  /** §2.1: toda entrada cumple la condición. */
  | { kind: 'each'; target: readonly PathSegment[]; condition: PredicateClause }
  /** Extensión: existe al menos una entrada que cumple la condición. */
  | { kind: 'some'; target: readonly PathSegment[]; alias: string; condition: PredicateClause }
  /** §2.1: cuantificación sobre tuplas con componentes declaradas. */
  | {
      kind: 'everyPar';
      target: readonly PathSegment[];
      components: readonly string[];
      condition: PredicateClause;
    }
  | { kind: 'and'; clauses: readonly PredicateClause[] }
  | { kind: 'or'; clauses: readonly PredicateClause[] }
  | { kind: 'not'; clause: PredicateClause }
  /** §2.1: comparador con reglas de tipos. */
  | { kind: 'compare'; op: CompareOp; left: Operand; right: Operand }
  /**
   * Extensión (auditoría dim2 2026-08-31): comparador entre valores
   * `longitud-css` (ej. "16px" vs "1rem"), convirtiendo a píxeles antes de
   * comparar. Cláusula APARTE de `compare` (no una opción) porque su
   * fail-closed es distinto: unidades relativas (`em`/`%`/`vh`/`vw`/`ch`/`ex`)
   * no se adivinan, fallan con `unidad-no-comparable`.
   */
  | { kind: 'compareCss'; cssType: 'longitud-css'; op: CompareOp; left: Operand; right: Operand }
  /** §2.1: el valor del slot ES la definición efectiva de `reqId` (prohibido duplicar). */
  | { kind: 'reference'; target: readonly PathSegment[]; reqId: string }
  /** Extensión: valor (o ref resuelta) es un color-css/longitud-css válido. */
  | { kind: 'validCss'; target: readonly PathSegment[]; cssType: 'color-css' | 'longitud-css' }
  /** §2.1: existe verificación registrada. */
  | { kind: 'verified'; pruebaId: string }
  /** §2.1/§8.2: sin contradicción con la rectora vinculada. */
  | { kind: 'noConflict'; rectoraId: string }
  /** EXTENSIÓN R1: cada entrada del slot del payload RESUELTO de otro requisito cumple la condición. */
  | {
      kind: 'eachIn';
      reqId: string;
      path: readonly PathSegment[];
      alias: string;
      condition: PredicateClause;
    }
  /** EXTENSIÓN R1: existe al menos una entrada del slot resuelto de otro requisito que cumple la condición. */
  | {
      kind: 'someIn';
      reqId: string;
      path: readonly PathSegment[];
      alias: string;
      condition: PredicateClause;
    }
  /** EXTENSIÓN R1: toda definición efectiva resuelta de la dimensión cumple la condición. */
  | {
      kind: 'everyDef';
      dimensionId: string;
      reqAlias: string;
      payloadAlias: string;
      condition: PredicateClause;
    }
  /** EXTENSIÓN R1: ninguna hoja string del target contiene (substring) ningún literal de la lista. */
  | {
      kind: 'containsNoneOf';
      target: readonly PathSegment[];
      literalsPath: readonly PathSegment[];
    };

export interface PredicateEvalContext {
  selfId: string;
  payload: Record<string, unknown>;
  payloadSchema: PayloadSchema;
  /** Definiciones resueltas de otros requisitos de la dimensión (decisión 3 de la ficha). */
  store: Map<string, Record<string, unknown>>;
  rectoras: Map<string, RectoraV0>;
  verifications?: Map<string, VerificationRecordV0> | undefined;
}

export interface PredicateEvalResult {
  ok: boolean;
  motivos: Motivo[];
}

interface Scope {
  bindings: Map<string, unknown>;
  components: Map<string, unknown>;
  tuple: Record<string, unknown> | null;
}

interface EvalState {
  ctx: PredicateEvalContext;
  scopes: Scope[];
}

interface ClauseResult {
  truth: boolean;
  motivos: Motivo[];
}

type ResolveResult = { ok: true; value: unknown } | { ok: false; motivo: Motivo };
type NavResult = { ok: true; value: unknown } | { ok: false; motivo: Motivo };

function formatPath(segments: readonly PathSegment[]): string {
  return segments.map((s) => String(s)).join('.');
}

function truncate(text: string, max = 48): string {
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}

const NUMERIC_EPSILON = 1e-9;

/**
 * Navega segmentos sobre un valor, resolviendo refs a través del store.
 * Reglas (documentadas): dentro de un ref, los segmentos `refReqId`/`refPath`
 * acceden a los METADATOS; cualquier otro segmento fuerza la resolución del
 * ref y continúa la navegación sobre el valor resuelto. Límite de
 * profundidad 32 como guardia contra cadenas de refs cíclicas.
 */
function navigate(
  value: unknown,
  segments: readonly PathSegment[],
  state: EvalState,
  depth: number,
): NavResult {
  if (depth > 32) {
    return { ok: false, motivo: { codigo: 'referencia-ciclica', mensaje: 'profundidad de resolución de refs excedida (posible ciclo)' } };
  }
  let current = value;
  let i = 0;
  while (i < segments.length) {
    const seg = segments[i];
    if (seg === undefined) break;
    if (isRefValue(current)) {
      if (typeof seg === 'string' && (seg === 'refReqId' || seg === 'refPath')) {
        current = current[seg];
        i += 1;
        continue;
      }
      const target = state.ctx.store.get(current.refReqId);
      if (target === undefined) {
        return {
          ok: false,
          motivo: {
            codigo: 'referencia-rota',
            mensaje: `referencia a la definición de '${current.refReqId}' ausente del contexto`,
          },
        };
      }
      const resolved = navigate(target, current.refPath, state, depth + 1);
      if (!resolved.ok) return resolved;
      current = resolved.value;
      continue;
    }
    if (typeof seg === 'string' && isRecord(current) && Object.prototype.hasOwnProperty.call(current, seg)) {
      current = current[seg];
      i += 1;
      continue;
    }
    if (typeof seg === 'number' && Array.isArray(current)) {
      if (seg < 0 || seg >= current.length) {
        return { ok: false, motivo: { codigo: 'referencia-fuera-de-rango', mensaje: `índice ${seg} fuera de rango en '${formatPath(segments)}'` } };
      }
      current = current[seg];
      i += 1;
      continue;
    }
    return {
      ok: false,
      motivo: { codigo: 'referencia-no-resoluble', mensaje: `segmento '${String(seg)}' no resoluble en '${formatPath(segments)}'` },
    };
  }
  return { ok: true, value: current };
}

/**
 * Resolución de una referencia de valor con precedencia determinista:
 * bindings R1 → componentes declaradas → campos de la tupla actual →
 * slots del payload.
 */
function resolvePath(segments: readonly PathSegment[], state: EvalState): ResolveResult {
  if (segments.length === 0) return { ok: true, value: state.ctx.payload };
  const first = segments[0];
  if (first === undefined) return { ok: true, value: state.ctx.payload };

  let found = false;
  let value: unknown;
  const firstKey = String(first);

  for (let i = state.scopes.length - 1; i >= 0; i -= 1) {
    const scope = state.scopes[i];
    if (scope === undefined) continue;
    if (scope.bindings.has(firstKey)) {
      value = scope.bindings.get(firstKey);
      found = true;
      break;
    }
    if (scope.components.has(firstKey)) {
      value = scope.components.get(firstKey);
      found = true;
      break;
    }
  }
  if (!found) {
    for (let i = state.scopes.length - 1; i >= 0; i -= 1) {
      const scope = state.scopes[i];
      if (scope?.tuple === null || scope?.tuple === undefined) continue;
      if (Object.prototype.hasOwnProperty.call(scope.tuple, first)) {
        value = scope.tuple[first];
        found = true;
        break;
      }
    }
  }
  if (!found && Object.prototype.hasOwnProperty.call(state.ctx.payload, first)) {
    value = state.ctx.payload[first];
    found = true;
  }
  if (!found) {
    return {
      ok: false,
      motivo: { codigo: 'referencia-no-resoluble', mensaje: `referencia '${formatPath(segments)}' no resoluble` },
    };
  }
  const nav = navigate(value, segments.slice(1), state, 0);
  if (!nav.ok) return nav;
  return { ok: true, value: nav.value };
}

function scalarEquals(value: unknown, lit: ScalarLiteral): boolean {
  switch (lit.kind) {
    case 'number':
      return typeof value === 'number' && value === lit.value;
    case 'string':
      return typeof value === 'string' && value === lit.value;
    case 'boolean':
      return typeof value === 'boolean' && value === lit.value;
  }
}

function describeExpected(expected: CoverExpected): string {
  if (expected.kind === 'tuple') {
    return `(${expected.items.map((item) => (item.kind === 'string' ? `'${item.value}'` : String(item.value))).join(', ')})`;
  }
  return expected.kind === 'string' ? `'${expected.value}'` : String(expected.value);
}

function entryCovers(entry: unknown, expected: CoverExpected, key: readonly string[]): boolean {
  if (key.length === 0) {
    if (expected.kind === 'tuple') return false;
    return scalarEquals(entry, expected);
  }
  if (!isRecord(entry)) return false;
  if (key.length === 1) {
    if (expected.kind === 'tuple') return false;
    const k = key[0];
    if (k === undefined) return false;
    return scalarEquals(entry[k], expected);
  }
  if (expected.kind !== 'tuple' || expected.items.length !== key.length) return false;
  for (let i = 0; i < key.length; i += 1) {
    const k = key[i];
    const item = expected.items[i];
    if (k === undefined || item === undefined) return false;
    if (!scalarEquals(entry[k], item)) return false;
  }
  return true;
}

function describeOperand(op: Operand): string {
  switch (op.kind) {
    case 'number':
      return String(op.value);
    case 'string':
      return `'${op.value}'`;
    case 'boolean':
      return String(op.value);
    case 'path':
      return formatPath(op.path);
    case 'sum':
      return `sum(${formatPath(op.collection)}.${op.field})`;
    case 'count':
      return `count(${formatPath(op.target)})`;
  }
}

function operandTypeName(value: number | string | boolean): string {
  if (typeof value === 'number') return 'numero';
  if (typeof value === 'string') return 'texto';
  return 'bool';
}

type OperandResult = { ok: true; value: number | string | boolean } | { ok: false; motivo: Motivo };

function evalOperand(op: Operand, state: EvalState): OperandResult {
  switch (op.kind) {
    case 'number':
    case 'string':
    case 'boolean':
      return { ok: true, value: op.value };
    case 'path': {
      const r = resolvePath(op.path, state);
      if (!r.ok) return r;
      const v = r.value;
      if (typeof v === 'number' || typeof v === 'string' || typeof v === 'boolean') {
        return { ok: true, value: v };
      }
      return {
        ok: false,
        motivo: {
          codigo: 'operando-invalido',
          mensaje: `operando '${formatPath(op.path)}' no es un valor escalar (numero/texto/bool)`,
        },
      };
    }
    case 'sum': {
      const r = resolvePath(op.collection, state);
      if (!r.ok) return r;
      if (!Array.isArray(r.value)) {
        return {
          ok: false,
          motivo: { codigo: 'sum-invalido', mensaje: `sum: '${formatPath(op.collection)}' no es una colección` },
        };
      }
      // FAIL-CLOSED (decisión 2): colección vacía ⇒ false con motivo.
      if (r.value.length === 0) {
        return {
          ok: false,
          motivo: {
            codigo: 'coleccion-vacia',
            mensaje: `sum: la colección '${formatPath(op.collection)}' está vacía (verdad-vacía fail-closed)`,
          },
        };
      }
      let total = 0;
      for (let idx = 0; idx < r.value.length; idx += 1) {
        const entry = r.value[idx];
        if (!isRecord(entry)) {
          return {
            ok: false,
            motivo: {
              codigo: 'sum-no-numerico',
              mensaje: `sum: entrada ${idx} de '${formatPath(op.collection)}' no es un objeto`,
            },
          };
        }
        const fieldValue = entry[op.field];
        if (typeof fieldValue !== 'number' || !Number.isFinite(fieldValue)) {
          return {
            ok: false,
            motivo: {
              codigo: 'sum-no-numerico',
              mensaje: `sum: entrada ${idx} de '${formatPath(op.collection)}' sin campo numérico '${op.field}'`,
            },
          };
        }
        total += fieldValue;
      }
      return { ok: true, value: total };
    }
    case 'count': {
      const r = resolvePath(op.target, state);
      if (!r.ok) return r;
      if (!Array.isArray(r.value)) {
        return {
          ok: false,
          motivo: { codigo: 'count-invalido', mensaje: `count: '${formatPath(op.target)}' no es una colección` },
        };
      }
      // FAIL-CLOSED (decisión 2): colección vacía ⇒ false con motivo.
      if (r.value.length === 0) {
        return {
          ok: false,
          motivo: {
            codigo: 'coleccion-vacia',
            mensaje: `count: la colección '${formatPath(op.target)}' está vacía (verdad-vacía fail-closed)`,
          },
        };
      }
      return { ok: true, value: r.value.length };
    }
  }
}

function evalCompare(op: CompareOp, left: Operand, right: Operand, state: EvalState): ClauseResult {
  const l = evalOperand(left, state);
  if (!l.ok) return { truth: false, motivos: [l.motivo] };
  const r = evalOperand(right, state);
  if (!r.ok) return { truth: false, motivos: [r.motivo] };

  const compareFalsa = (): ClauseResult => ({
    truth: false,
    motivos: [
      {
        codigo: 'comparacion-falsa',
        mensaje: `comparación falsa: ${describeOperand(left)} ${op} ${describeOperand(right)}`,
      },
    ],
  });

  if (typeof l.value === 'number' && typeof r.value === 'number') {
    const a = l.value;
    const b = r.value;
    let pass = false;
    switch (op) {
      case '==':
        pass = Math.abs(a - b) < NUMERIC_EPSILON;
        break;
      case '!=':
        pass = Math.abs(a - b) >= NUMERIC_EPSILON;
        break;
      case '<':
        pass = a < b;
        break;
      case '<=':
        pass = a <= b;
        break;
      case '>':
        pass = a > b;
        break;
      case '>=':
        pass = a >= b;
        break;
    }
    return pass ? { truth: true, motivos: [] } : compareFalsa();
  }

  if (typeof l.value === 'string' && typeof r.value === 'string') {
    if (op === '==' || op === '!=') {
      const equal = l.value === r.value;
      const pass = op === '==' ? equal : !equal;
      return pass ? { truth: true, motivos: [] } : compareFalsa();
    }
    return {
      truth: false,
      motivos: [
        {
          codigo: 'tipo-incompatible',
          mensaje: `operador '${op}' no permitido entre textos (solo == y !=)`,
        },
      ],
    };
  }

  if (typeof l.value === 'boolean' && typeof r.value === 'boolean') {
    if (op === '==' || op === '!=') {
      const equal = l.value === r.value;
      const pass = op === '==' ? equal : !equal;
      return pass ? { truth: true, motivos: [] } : compareFalsa();
    }
    return {
      truth: false,
      motivos: [
        {
          codigo: 'tipo-incompatible',
          mensaje: `operador '${op}' no permitido entre booleanos (solo == y !=)`,
        },
      ],
    };
  }

  return {
    truth: false,
    motivos: [
      {
        codigo: 'tipo-incompatible',
        mensaje: `comparación de tipos incompatibles (${operandTypeName(l.value)} vs ${operandTypeName(r.value)})`,
      },
    ],
  };
}

/**
 * compareCss: como evalCompare pero para `longitud-css` (ej. "16px" vs
 * "1rem"). Convierte ambos lados a píxeles antes de comparar; unidades
 * relativas (`em`/`%`/`vh`/`vw`/`ch`/`ex`) fallan fail-closed en vez de
 * adivinar (ver `lengthCssToPx`, css-values.ts).
 */
function evalCompareCss(op: CompareOp, left: Operand, right: Operand, state: EvalState): ClauseResult {
  const l = evalOperand(left, state);
  if (!l.ok) return { truth: false, motivos: [l.motivo] };
  const r = evalOperand(right, state);
  if (!r.ok) return { truth: false, motivos: [r.motivo] };

  const lPx = lengthCssToPx(l.value);
  if (!lPx.ok) {
    return {
      truth: false,
      motivos: [
        lPx.codigo === 'unidad-no-comparable'
          ? {
              codigo: 'unidad-no-comparable',
              mensaje: `compareCss: unidad '${lPx.unidad}' de ${describeOperand(left)} no es comparable sin contexto (relativa)`,
            }
          : {
              codigo: 'valor-css-invalido',
              mensaje: `compareCss: ${describeOperand(left)} no es una longitud-css válida`,
            },
      ],
    };
  }
  const rPx = lengthCssToPx(r.value);
  if (!rPx.ok) {
    return {
      truth: false,
      motivos: [
        rPx.codigo === 'unidad-no-comparable'
          ? {
              codigo: 'unidad-no-comparable',
              mensaje: `compareCss: unidad '${rPx.unidad}' de ${describeOperand(right)} no es comparable sin contexto (relativa)`,
            }
          : {
              codigo: 'valor-css-invalido',
              mensaje: `compareCss: ${describeOperand(right)} no es una longitud-css válida`,
            },
      ],
    };
  }

  const a = lPx.px;
  const b = rPx.px;
  let pass = false;
  switch (op) {
    case '==':
      pass = Math.abs(a - b) < NUMERIC_EPSILON;
      break;
    case '!=':
      pass = Math.abs(a - b) >= NUMERIC_EPSILON;
      break;
    case '<':
      pass = a < b;
      break;
    case '<=':
      pass = a <= b;
      break;
    case '>':
      pass = a > b;
      break;
    case '>=':
      pass = a >= b;
      break;
  }
  if (pass) return { truth: true, motivos: [] };
  return {
    truth: false,
    motivos: [
      {
        codigo: 'comparacion-falsa',
        mensaje: `comparación falsa: ${describeOperand(left)} ${op} ${describeOperand(right)} (px: ${a} vs ${b})`,
      },
    ],
  };
}

function prefixed(motivos: readonly Motivo[], prefix: string): Motivo[] {
  return motivos.map((m) => ({ codigo: m.codigo, mensaje: `${prefix}: ${m.mensaje}` }));
}

function evalQuantified(
  entries: readonly unknown[],
  pathLabel: string,
  entryKind: 'each' | 'some',
  alias: string | undefined,
  components: readonly string[] | undefined,
  condition: PredicateClause,
  state: EvalState,
  skipFailMotivo: string,
): ClauseResult {
  if (entries.length === 0) {
    return {
      truth: false,
      motivos: [{ codigo: 'sin-entradas-que-verificar', mensaje: `${pathLabel}: sin entradas que verificar` }],
    };
  }
  let firstFailure: ClauseResult | undefined;
  for (let i = 0; i < entries.length; i += 1) {
    const entry = entries[i];
    if (!isRecord(entry)) {
      const motivo: Motivo = {
        codigo: 'entrada-no-objeto',
        mensaje: `${pathLabel}: entrada ${i} no es un objeto`,
      };
      if (entryKind === 'each') return { truth: false, motivos: [motivo] };
      if (firstFailure === undefined) firstFailure = { truth: false, motivos: [motivo] };
      continue;
    }
    const bindings = new Map<string, unknown>();
    const componentsMap = new Map<string, unknown>();
    if (alias !== undefined) bindings.set(alias, entry);
    if (components !== undefined) {
      for (const component of components) {
        if (!Object.prototype.hasOwnProperty.call(entry, component)) {
          const motivo: Motivo = {
            codigo: 'componente-ausente',
            mensaje: `${pathLabel}: componente '${component}' ausente en la tupla ${i}`,
          };
          if (entryKind === 'each') return { truth: false, motivos: [motivo] };
          if (firstFailure === undefined) firstFailure = { truth: false, motivos: [motivo] };
          continue;
        }
        componentsMap.set(component, entry[component]);
      }
      if (firstFailure !== undefined) continue;
    }
    state.scopes.push({ bindings, components: componentsMap, tuple: entry });
    const inner = evalClause(condition, state);
    state.scopes.pop();
    if (inner.truth) {
      if (entryKind === 'some') return { truth: true, motivos: [] };
      continue;
    }
    const failure: ClauseResult = {
      truth: false,
      motivos: inner.motivos.length > 0 ? prefixed(inner.motivos, `${pathLabel}[${i}]`) : [{ codigo: skipFailMotivo, mensaje: `${pathLabel}[${i}]: condición no cumplida` }],
    };
    if (entryKind === 'each') return failure;
    if (firstFailure === undefined) firstFailure = failure;
  }
  if (entryKind === 'each') return { truth: true, motivos: [] };
  return firstFailure ?? { truth: true, motivos: [] };
}

function evalClause(clause: PredicateClause, state: EvalState): ClauseResult {
  switch (clause.kind) {
    case 'and': {
      if (clause.clauses.length === 0) {
        return {
          truth: false,
          motivos: [{ codigo: 'clausula-invalida', mensaje: 'and: sin cláusulas (verdad-vacía prohibida)' }],
        };
      }
      const motivos: Motivo[] = [];
      for (const c of clause.clauses) {
        const r = evalClause(c, state);
        if (!r.truth) motivos.push(...r.motivos);
      }
      return motivos.length === 0 ? { truth: true, motivos: [] } : { truth: false, motivos };
    }
    case 'or': {
      if (clause.clauses.length < 2) {
        return {
          truth: false,
          motivos: [{ codigo: 'clausula-invalida', mensaje: 'or: requiere dos o más operandos' }],
        };
      }
      let firstFailure: ClauseResult | undefined;
      for (const c of clause.clauses) {
        const r = evalClause(c, state);
        if (r.truth) return { truth: true, motivos: [] };
        if (firstFailure === undefined) firstFailure = r;
      }
      return { truth: false, motivos: firstFailure?.motivos ?? [] };
    }
    case 'not': {
      const inner = evalClause(clause.clause, state);
      if (!inner.truth) return { truth: true, motivos: [] };
      return {
        truth: false,
        motivos: [{ codigo: 'not', mensaje: 'not: la condición interna se cumple' }],
      };
    }
    case 'exists': {
      const r = resolvePath(clause.target, state);
      if (!r.ok) return { truth: false, motivos: [r.motivo] };
      const v = r.value;
      const present = v !== undefined && v !== null;
      let nonEmpty = true;
      if (Array.isArray(v)) nonEmpty = v.length > 0;
      else if (typeof v === 'string') nonEmpty = v.trim().length > 0;
      else if (isRecord(v)) nonEmpty = Object.keys(v).length > 0;
      if (!present || !nonEmpty) {
        return {
          truth: false,
          motivos: [{ codigo: 'slot-ausente', mensaje: `exists: '${formatPath(clause.target)}' ausente o vacío` }],
        };
      }
      return { truth: true, motivos: [] };
    }
    case 'singleton': {
      const r = resolvePath(clause.target, state);
      if (!r.ok) return { truth: false, motivos: [r.motivo] };
      const v = r.value;
      if (v === undefined || v === null) {
        return {
          truth: false,
          motivos: [{ codigo: 'slot-ausente', mensaje: `singleton: '${formatPath(clause.target)}' ausente` }],
        };
      }
      if (Array.isArray(v) && v.length > 1) {
        return {
          truth: false,
          motivos: [
            {
              codigo: 'segundo-valor',
              mensaje: `singleton: '${formatPath(clause.target)}' declara un segundo valor (${v.length} entradas)`,
            },
          ],
        };
      }
      return { truth: true, motivos: [] };
    }
    case 'covers': {
      const r = resolvePath(clause.target, state);
      if (!r.ok) return { truth: false, motivos: [r.motivo] };
      if (!Array.isArray(r.value)) {
        return {
          truth: false,
          motivos: [{ codigo: 'coleccion-invalida', mensaje: `covers: '${formatPath(clause.target)}' no es una colección` }],
        };
      }
      if (r.value.length === 0) {
        return {
          truth: false,
          motivos: [{ codigo: 'coleccion-vacia', mensaje: `covers: '${formatPath(clause.target)}' está vacía (verdad-vacía fail-closed)` }],
        };
      }
      if (clause.expected.length === 0) {
        return {
          truth: false,
          motivos: [{ codigo: 'clausula-invalida', mensaje: 'covers: lista cerrada esperada vacía (verdad-vacía prohibida)' }],
        };
      }
      const missing: string[] = [];
      for (const expected of clause.expected) {
        if (!r.value.some((entry) => entryCovers(entry, expected, clause.key))) {
          missing.push(describeExpected(expected));
        }
      }
      if (missing.length > 0) {
        return {
          truth: false,
          motivos: missing.map((m) => ({ codigo: 'covers-incumplido', mensaje: `covers: no cubre ${m}` })),
        };
      }
      return { truth: true, motivos: [] };
    }
    case 'each': {
      const r = resolvePath(clause.target, state);
      if (!r.ok) return { truth: false, motivos: [r.motivo] };
      if (!Array.isArray(r.value)) {
        return {
          truth: false,
          motivos: [{ codigo: 'coleccion-invalida', mensaje: `each: '${formatPath(clause.target)}' no es una colección` }],
        };
      }
      return evalQuantified(
        r.value,
        `each('${formatPath(clause.target)}')`,
        'each',
        undefined,
        undefined,
        clause.condition,
        state,
        'each',
      );
    }
    case 'some': {
      const r = resolvePath(clause.target, state);
      if (!r.ok) return { truth: false, motivos: [r.motivo] };
      if (!Array.isArray(r.value)) {
        return {
          truth: false,
          motivos: [{ codigo: 'coleccion-invalida', mensaje: `some: '${formatPath(clause.target)}' no es una colección` }],
        };
      }
      return evalQuantified(
        r.value,
        `some('${formatPath(clause.target)}')`,
        'some',
        clause.alias,
        undefined,
        clause.condition,
        state,
        'some',
      );
    }
    case 'everyPar': {
      const r = resolvePath(clause.target, state);
      if (!r.ok) return { truth: false, motivos: [r.motivo] };
      if (!Array.isArray(r.value)) {
        return {
          truth: false,
          motivos: [{ codigo: 'coleccion-invalida', mensaje: `everyPar: '${formatPath(clause.target)}' no es una colección` }],
        };
      }
      return evalQuantified(
        r.value,
        `everyPar('${formatPath(clause.target)}')`,
        'each',
        undefined,
        clause.components,
        clause.condition,
        state,
        'everyPar',
      );
    }
    case 'compare':
      return evalCompare(clause.op, clause.left, clause.right, state);
    case 'compareCss':
      return evalCompareCss(clause.op, clause.left, clause.right, state);
    case 'reference': {
      const r = resolvePath(clause.target, state);
      if (!r.ok) return { truth: false, motivos: [r.motivo] };
      const v = r.value;
      if (!isRefValue(v)) {
        return {
          truth: false,
          motivos: [
            {
              codigo: 'referencia-no-es-ref',
              mensaje: `reference: '${formatPath(clause.target)}' no es una referencia a '${clause.reqId}' (duplicación del valor prohibida)`,
            },
          ],
        };
      }
      if (v.refReqId !== clause.reqId) {
        return {
          truth: false,
          motivos: [
            {
              codigo: 'referencia-reqid',
              mensaje: `reference: '${formatPath(clause.target)}' apunta a '${v.refReqId}', se esperaba '${clause.reqId}'`,
            },
          ],
        };
      }
      const target = state.ctx.store.get(v.refReqId);
      if (target === undefined) {
        return {
          truth: false,
          motivos: [
            {
              codigo: 'referencia-rota',
              mensaje: `reference: la definición de '${v.refReqId}' está ausente del contexto`,
            },
          ],
        };
      }
      const nav = navigate(target, v.refPath, state, 0);
      if (!nav.ok) return { truth: false, motivos: [nav.motivo] };
      return { truth: true, motivos: [] };
    }
    case 'validCss': {
      const r = resolvePath(clause.target, state);
      if (!r.ok) return { truth: false, motivos: [r.motivo] };
      let v = r.value;
      if (isRefValue(v)) {
        const target = state.ctx.store.get(v.refReqId);
        if (target === undefined) {
          return {
            truth: false,
            motivos: [{ codigo: 'referencia-rota', mensaje: `validCss: la definición de '${v.refReqId}' está ausente del contexto` }],
          };
        }
        const nav = navigate(target, v.refPath, state, 0);
        if (!nav.ok) return { truth: false, motivos: [nav.motivo] };
        v = nav.value;
      }
      const valid = clause.cssType === 'color-css' ? isColorCss(v) : isLengthCss(v);
      if (!valid) {
        return {
          truth: false,
          motivos: [
            {
              codigo: 'valor-invalido',
              mensaje: `validCss: '${formatPath(clause.target)}' no es un ${clause.cssType} válido`,
            },
          ],
        };
      }
      return { truth: true, motivos: [] };
    }
    case 'verified': {
      const found = state.ctx.verifications?.has(clause.pruebaId) === true;
      if (!found) {
        return {
          truth: false,
          motivos: [
            {
              codigo: 'verificacion-no-registrada',
              mensaje: `verified: la verificación '${clause.pruebaId}' no está registrada`,
            },
          ],
        };
      }
      return { truth: true, motivos: [] };
    }
    case 'noConflict': {
      const rectora = state.ctx.rectoras.get(clause.rectoraId);
      const res = evaluateNoConflict({
        rectoraId: clause.rectoraId,
        rectora,
        payload: state.ctx.payload,
        payloadSchema: state.ctx.payloadSchema,
      });
      if (res.ok) return { truth: true, motivos: [] };
      return { truth: false, motivos: res.motivo !== undefined ? [res.motivo] : [] };
    }
    case 'eachIn': {
      const other = state.ctx.store.get(clause.reqId);
      if (other === undefined) {
        return {
          truth: false,
          motivos: [{ codigo: 'definicion-ausente', mensaje: `eachIn: la definición de '${clause.reqId}' está ausente del contexto` }],
        };
      }
      const nav = navigate(other, clause.path, state, 0);
      if (!nav.ok) return { truth: false, motivos: [nav.motivo] };
      if (!Array.isArray(nav.value)) {
        return {
          truth: false,
          motivos: [
            {
              codigo: 'coleccion-invalida',
              mensaje: `eachIn: '${clause.reqId}.${formatPath(clause.path)}' no es una colección`,
            },
          ],
        };
      }
      return evalQuantified(
        nav.value,
        `eachIn('${clause.reqId}', '${formatPath(clause.path)}')`,
        'each',
        clause.alias,
        undefined,
        clause.condition,
        state,
        'eachIn',
      );
    }
    case 'someIn': {
      const other = state.ctx.store.get(clause.reqId);
      if (other === undefined) {
        return {
          truth: false,
          motivos: [{ codigo: 'definicion-ausente', mensaje: `someIn: la definición de '${clause.reqId}' está ausente del contexto` }],
        };
      }
      const nav = navigate(other, clause.path, state, 0);
      if (!nav.ok) return { truth: false, motivos: [nav.motivo] };
      if (!Array.isArray(nav.value)) {
        return {
          truth: false,
          motivos: [
            {
              codigo: 'coleccion-invalida',
              mensaje: `someIn: '${clause.reqId}.${formatPath(clause.path)}' no es una colección`,
            },
          ],
        };
      }
      return evalQuantified(
        nav.value,
        `someIn('${clause.reqId}', '${formatPath(clause.path)}')`,
        'some',
        clause.alias,
        undefined,
        clause.condition,
        state,
        'someIn',
      );
    }
    case 'everyDef': {
      const prefix = `${clause.dimensionId}.`;
      const keys: string[] = [];
      for (const key of state.ctx.store.keys()) {
        if (key.startsWith(prefix) && key !== state.ctx.selfId) keys.push(key);
      }
      keys.sort((a, b) => a.localeCompare(b, 'en'));
      if (keys.length === 0) {
        return {
          truth: false,
          motivos: [
            {
              codigo: 'sin-definiciones-que-verificar',
              mensaje: `everyDef: sin definiciones efectivas de ${clause.dimensionId} en el contexto (verdad-vacía fail-closed)`,
            },
          ],
        };
      }
      for (const key of keys) {
        const payload = state.ctx.store.get(key);
        if (payload === undefined) {
          return {
            truth: false,
            motivos: [{ codigo: 'definicion-ausente', mensaje: `everyDef: la definición de '${key}' está ausente del contexto` }],
          };
        }
        state.scopes.push({
          bindings: new Map<string, unknown>([
            [clause.reqAlias, key],
            [clause.payloadAlias, payload],
          ]),
          components: new Map(),
          tuple: null,
        });
        const inner = evalClause(clause.condition, state);
        state.scopes.pop();
        if (!inner.truth) {
          const motivo: Motivo =
            inner.motivos.length > 0
              ? { codigo: inner.motivos[0]?.codigo ?? 'everyDef', mensaje: `everyDef(${key}): ${inner.motivos.map((m) => m.mensaje).join('; ')}` }
              : { codigo: 'everyDef', mensaje: `everyDef(${key}): condición no cumplida` };
          return { truth: false, motivos: [motivo] };
        }
      }
      return { truth: true, motivos: [] };
    }
    case 'containsNoneOf': {
      const targetRes = resolvePath(clause.target, state);
      if (!targetRes.ok) return { truth: false, motivos: [targetRes.motivo] };
      const literalsRes = resolvePath(clause.literalsPath, state);
      if (!literalsRes.ok) return { truth: false, motivos: [literalsRes.motivo] };
      if (!Array.isArray(literalsRes.value)) {
        return {
          truth: false,
          motivos: [
            {
              codigo: 'lista-invalida',
              mensaje: `containsNoneOf: '${formatPath(clause.literalsPath)}' no es una lista`,
            },
          ],
        };
      }
      const literals = literalsRes.value.filter((l): l is string => typeof l === 'string');
      if (literals.length === 0) return { truth: true, motivos: [] };
      const leaves = collectStringLeaves(targetRes.value);
      for (const leaf of leaves) {
        for (const literal of literals) {
          if (leaf.includes(literal)) {
            return {
              truth: false,
              motivos: [
                {
                  codigo: 'literal-prohibido',
                  mensaje: `la definición contiene el literal prohibido '${literal}' (en '${truncate(leaf)}')`,
                },
              ],
            };
          }
        }
      }
      return { truth: true, motivos: [] };
    }
  }
}

/** Evalúa TODAS las cláusulas (lista ordenada): si cualquiera falla ⇒ no-resuelto con todos los motivos. */
export function evaluatePredicate(
  clauses: readonly PredicateClause[],
  ctx: PredicateEvalContext,
): PredicateEvalResult {
  const state: EvalState = { ctx, scopes: [] };
  const motivos: Motivo[] = [];
  for (const clause of clauses) {
    const r = evalClause(clause, state);
    if (!r.truth) motivos.push(...r.motivos);
  }
  return { ok: motivos.length === 0, motivos };
}

/**
 * Recolecta las rectoras cubiertas EXPLÍCITAMENTE por cláusulas noConflict
 * del predicado (para que evaluateRequirement no las vuelva a evaluar vía
 * rectorBindings — spec §8.2: el binding se evalúa una sola vez).
 */
export function collectNoConflictIds(clauses: readonly PredicateClause[]): Set<string> {
  const ids = new Set<string>();
  const visit = (c: PredicateClause): void => {
    switch (c.kind) {
      case 'noConflict':
        ids.add(c.rectoraId);
        return;
      case 'and':
      case 'or':
        for (const inner of c.clauses) visit(inner);
        return;
      case 'not':
        visit(c.clause);
        return;
      case 'each':
      case 'some':
      case 'everyPar':
        visit(c.condition);
        return;
      case 'eachIn':
      case 'someIn':
        visit(c.condition);
        return;
      case 'everyDef':
        visit(c.condition);
        return;
      default:
        return;
    }
  };
  for (const clause of clauses) visit(clause);
  return ids;
}
