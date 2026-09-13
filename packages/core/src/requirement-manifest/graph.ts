/**
 * Validación estructural del manifiesto y grafo de dependencias
 * (spec §2, §4): referencias rotas, dependencias a deprecados y ciclos
 * (DFS de tres colores, §4.2 — único lugar de la spec con pseudocódigo).
 *
 * Invariantes en cada carga (spec §4.1):
 * 1. Toda referencia apunta a un ID existente ⇒ si no, el manifiesto se
 *    rechaza EN BLOQUE con la lista de referencias rotas.
 * 2. Toda referencia apunta a un requisito active.
 * 3. Prohibidos los ciclos (rechazo en bloque con el camino del ciclo).
 * 4. Orden de lectura estable (orden del documento) ⇒ reporte determinista.
 * 5. Se reportan PRIMERO todas las referencias rotas y DESPUÉS el ciclo.
 */
import type { PredicateClause, Operand, CoverExpected } from './predicate.js';
import {
  DIMENSION_IDS,
  EJES,
  IDENTIFIER_PATTERN,
  MANIFEST_VERSION_PATTERN,
  PACKAGE_ID_PATTERN,
  REQUIREMENT_ID_PATTERN,
  RULE_KINDS,
  SCOPE_BREAKPOINTS,
  SCOPE_STATES,
  type DimensionId,
  type PayloadSchema,
  type PayloadType,
  type RequirementManifestV0,
  type RequirementV0,
} from './types.js';

export interface ManifestValidationIssue {
  codigo: string;
  mensaje: string;
}

export interface ManifestValidationResult {
  ok: boolean;
  manifest?: RequirementManifestV0 | undefined;
  errores: ManifestValidationIssue[];
  /** Camino del ciclo (IDs en orden) si el manifiesto fue rechazado por ciclo. */
  ciclo?: string[] | undefined;
}

function issue(codigo: string, mensaje: string): ManifestValidationIssue {
  return { codigo, mensaje };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isPathSegments(value: unknown): value is readonly (string | number)[] {
  return (
    Array.isArray(value) &&
    value.every((s) => typeof s === 'string' || typeof s === 'number')
  );
}

function isValidIdentifier(value: unknown): value is string {
  return typeof value === 'string' && IDENTIFIER_PATTERN.test(value);
}

function isValidScalarLiteral(value: unknown): boolean {
  if (!isRecord(value)) return false;
  const kind = value['kind'];
  if (kind === 'number' || kind === 'boolean') return typeof value['value'] === kind;
  if (kind === 'string') return typeof value['value'] === 'string';
  return false;
}

function isValidCoverExpected(value: unknown): boolean {
  if (isValidScalarLiteral(value)) return true;
  if (!isRecord(value) || value['kind'] !== 'tuple') return false;
  const items = value['items'];
  return Array.isArray(items) && items.every((item) => isValidScalarLiteral(item));
}

function isValidOperand(value: unknown, errores: ManifestValidationIssue[], path: string): boolean {
  if (!isRecord(value)) {
    errores.push(issue('predicado-invalido', `${path}: operando debe ser un objeto`));
    return false;
  }
  const kind = value['kind'];
  if (kind === 'number' || kind === 'boolean' || kind === 'string') {
    if (kind === 'number') {
      if (typeof value['value'] !== 'number') {
        errores.push(issue('predicado-invalido', `${path}: literal numérico sin value numérico`));
        return false;
      }
    } else if (kind === 'boolean') {
      if (typeof value['value'] !== 'boolean') {
        errores.push(issue('predicado-invalido', `${path}: literal booleano sin value booleano`));
        return false;
      }
    } else if (typeof value['value'] !== 'string') {
      errores.push(issue('predicado-invalido', `${path}: literal texto sin value string`));
      return false;
    }
    return true;
  }
  if (kind === 'path') {
    if (!isPathSegments(value['path'])) {
      errores.push(issue('predicado-invalido', `${path}: operando path sin ruta válida`));
      return false;
    }
    return true;
  }
  if (kind === 'sum') {
    if (!isPathSegments(value['collection']) || !isValidIdentifier(value['field'])) {
      errores.push(issue('predicado-invalido', `${path}: sum sin collection/field válidos`));
      return false;
    }
    return true;
  }
  if (kind === 'count') {
    if (!isPathSegments(value['target'])) {
      errores.push(issue('predicado-invalido', `${path}: count sin target válido`));
      return false;
    }
    return true;
  }
  errores.push(issue('predicado-invalido', `${path}: operando de tipo desconocido '${String(kind)}'`));
  return false;
}

const COMPARE_OPS = ['==', '!=', '<', '<=', '>', '>='] as const;

/** Valida recursivamente la forma del AST de una cláusula (sin evaluarla). */
function isValidClause(value: unknown, errores: ManifestValidationIssue[], path: string): boolean {
  if (!isRecord(value)) {
    errores.push(issue('predicado-invalido', `${path}: cláusula debe ser un objeto`));
    return false;
  }
  const kind = value['kind'];
  const target = value['target'];
  const condition = value['condition'];
  switch (kind) {
    case 'exists':
    case 'singleton':
      if (!isPathSegments(target)) {
        errores.push(issue('predicado-invalido', `${path}: ${String(kind)} sin target válido`));
        return false;
      }
      return true;
    case 'covers': {
      if (!isPathSegments(target)) {
        errores.push(issue('predicado-invalido', `${path}: covers sin target válido`));
        return false;
      }
      const key = value['key'];
      if (!Array.isArray(key) || !key.every((k) => typeof k === 'string')) {
        errores.push(issue('predicado-invalido', `${path}: covers sin key (array de strings)`));
        return false;
      }
      const expected = value['expected'];
      if (!Array.isArray(expected) || expected.length === 0 || !expected.every(isValidCoverExpected)) {
        errores.push(issue('predicado-invalido', `${path}: covers sin lista cerrada esperada no vacía`));
        return false;
      }
      const keyLen: number = key.length;
      for (const exp of expected as readonly CoverExpected[]) {
        if (keyLen > 1) {
          if (exp.kind !== 'tuple' || exp.items.length !== keyLen) {
            errores.push(
              issue('predicado-invalido', `${path}: covers con key compuesta exige tuplas de ${keyLen} componentes`),
            );
            return false;
          }
        } else if (exp.kind === 'tuple') {
          errores.push(issue('predicado-invalido', `${path}: covers con key simple no admite tuplas`));
          return false;
        }
      }
      return true;
    }
    case 'each':
      if (!isPathSegments(target)) {
        errores.push(issue('predicado-invalido', `${path}: each sin target válido`));
        return false;
      }
      return isValidClause(condition, errores, `${path}.each`);
    case 'some': {
      if (!isPathSegments(target) || !isValidIdentifier(value['alias'])) {
        errores.push(issue('predicado-invalido', `${path}: some sin target/alias válidos`));
        return false;
      }
      return isValidClause(condition, errores, `${path}.some`);
    }
    case 'everyPar': {
      const components = value['components'];
      if (
        !isPathSegments(target) ||
        !Array.isArray(components) ||
        components.length === 0 ||
        !components.every(isValidIdentifier)
      ) {
        errores.push(issue('predicado-invalido', `${path}: everyPar sin target/componentes válidos`));
        return false;
      }
      return isValidClause(condition, errores, `${path}.everyPar`);
    }
    case 'and': {
      const clauses = value['clauses'];
      if (!Array.isArray(clauses) || clauses.length === 0) {
        errores.push(issue('predicado-invalido', `${path}: and sin cláusulas (verdad-vacía prohibida)`));
        return false;
      }
      let ok = true;
      clauses.forEach((c, i) => {
        if (!isValidClause(c, errores, `${path}.and[${i}]`)) ok = false;
      });
      return ok;
    }
    case 'or': {
      const clauses = value['clauses'];
      if (!Array.isArray(clauses) || clauses.length < 2) {
        errores.push(issue('predicado-invalido', `${path}: or requiere dos o más operandos`));
        return false;
      }
      let ok = true;
      clauses.forEach((c, i) => {
        if (!isValidClause(c, errores, `${path}.or[${i}]`)) ok = false;
      });
      return ok;
    }
    case 'not':
      return isValidClause(value['clause'], errores, `${path}.not`);
    case 'compare': {
      const op = value['op'];
      if (typeof op !== 'string' || !(COMPARE_OPS as readonly string[]).includes(op)) {
        errores.push(issue('predicado-invalido', `${path}: compare con operador desconocido '${String(op)}'`));
        return false;
      }
      const leftOk = isValidOperand(value['left'], errores, `${path}.compare.left`);
      const rightOk = isValidOperand(value['right'], errores, `${path}.compare.right`);
      return leftOk && rightOk;
    }
    case 'compareCss': {
      const op = value['op'];
      const cssType = value['cssType'];
      if (typeof op !== 'string' || !(COMPARE_OPS as readonly string[]).includes(op)) {
        errores.push(issue('predicado-invalido', `${path}: compareCss con operador desconocido '${String(op)}'`));
        return false;
      }
      if (cssType !== 'longitud-css') {
        errores.push(issue('predicado-invalido', `${path}: compareCss con cssType desconocido '${String(cssType)}'`));
        return false;
      }
      const leftOk = isValidOperand(value['left'], errores, `${path}.compareCss.left`);
      const rightOk = isValidOperand(value['right'], errores, `${path}.compareCss.right`);
      return leftOk && rightOk;
    }
    case 'reference': {
      const reqId = value['reqId'];
      if (!isPathSegments(target) || typeof reqId !== 'string' || !REQUIREMENT_ID_PATTERN.test(reqId)) {
        errores.push(issue('predicado-invalido', `${path}: reference sin target/reqId válidos`));
        return false;
      }
      return true;
    }
    case 'validCss': {
      const cssType = value['cssType'];
      if (!isPathSegments(target) || (cssType !== 'color-css' && cssType !== 'longitud-css')) {
        errores.push(issue('predicado-invalido', `${path}: validCss sin target/cssType válidos`));
        return false;
      }
      return true;
    }
    case 'verified': {
      const pruebaId = value['pruebaId'];
      if (typeof pruebaId !== 'string' || pruebaId.trim().length === 0) {
        errores.push(issue('predicado-invalido', `${path}: verified sin pruebaId no vacío`));
        return false;
      }
      return true;
    }
    case 'noConflict': {
      const rectoraId = value['rectoraId'];
      if (typeof rectoraId !== 'string' || rectoraId.trim().length === 0) {
        errores.push(issue('predicado-invalido', `${path}: noConflict sin rectoraId no vacío`));
        return false;
      }
      return true;
    }
    case 'eachIn':
    case 'someIn': {
      const reqId = value['reqId'];
      const clausePath = value['path'];
      const alias = value['alias'];
      if (
        typeof reqId !== 'string' ||
        !REQUIREMENT_ID_PATTERN.test(reqId) ||
        !isPathSegments(clausePath) ||
        !isValidIdentifier(alias)
      ) {
        errores.push(issue('predicado-invalido', `${path}: ${String(kind)} sin reqId/path/alias válidos`));
        return false;
      }
      return isValidClause(condition, errores, `${path}.${String(kind)}`);
    }
    case 'everyDef': {
      const dimensionId = value['dimensionId'];
      const reqAlias = value['reqAlias'];
      const payloadAlias = value['payloadAlias'];
      if (
        typeof dimensionId !== 'string' ||
        !(DIMENSION_IDS as readonly string[]).includes(dimensionId) ||
        !isValidIdentifier(reqAlias) ||
        !isValidIdentifier(payloadAlias)
      ) {
        errores.push(issue('predicado-invalido', `${path}: everyDef sin dimensionId/aliases válidos`));
        return false;
      }
      return isValidClause(condition, errores, `${path}.everyDef`);
    }
    case 'containsNoneOf': {
      if (!isPathSegments(target) || !isPathSegments(value['literalsPath'])) {
        errores.push(issue('predicado-invalido', `${path}: containsNoneOf sin target/literalsPath válidos`));
        return false;
      }
      return true;
    }
    default:
      errores.push(issue('predicado-invalido', `${path}: cláusula de tipo desconocido '${String(kind)}'`));
      return false;
  }
}

function isValidPayloadType(value: unknown, errores: ManifestValidationIssue[], path: string): boolean {
  if (!isRecord(value)) {
    errores.push(issue('payload-schema-invalido', `${path}: tipo debe ser un objeto`));
    return false;
  }
  const kind = value['kind'];
  switch (kind) {
    case 'color-css':
    case 'longitud-css':
    case 'texto':
    case 'bool':
      return true;
    case 'numero': {
      const min = value['min'];
      const max = value['max'];
      if (min !== undefined && (typeof min !== 'number' || !Number.isFinite(min))) {
        errores.push(issue('payload-schema-invalido', `${path}: numero con min inválido`));
        return false;
      }
      if (max !== undefined && (typeof max !== 'number' || !Number.isFinite(max))) {
        errores.push(issue('payload-schema-invalido', `${path}: numero con max inválido`));
        return false;
      }
      if (typeof min === 'number' && typeof max === 'number' && min > max) {
        errores.push(issue('payload-schema-invalido', `${path}: numero con min > max`));
        return false;
      }
      return true;
    }
    case 'enum': {
      const values = value['values'];
      if (
        !Array.isArray(values) ||
        values.length === 0 ||
        !values.every((v) => typeof v === 'string' && v.length > 0) ||
        new Set(values).size !== values.length
      ) {
        errores.push(issue('payload-schema-invalido', `${path}: enum sin valores cerrados no vacíos y únicos`));
        return false;
      }
      return true;
    }
    case 'ref': {
      const reqId = value['reqId'];
      if (reqId !== undefined && (typeof reqId !== 'string' || !REQUIREMENT_ID_PATTERN.test(reqId))) {
        errores.push(issue('payload-schema-invalido', `${path}: ref con reqId inválido`));
        return false;
      }
      return true;
    }
    case 'lista':
      return isValidPayloadType(value['of'], errores, `${path}.lista`);
    case 'objeto': {
      const fields = value['fields'];
      if (!isRecord(fields) || Object.keys(fields).length === 0) {
        errores.push(issue('payload-schema-invalido', `${path}: objeto sin campos`));
        return false;
      }
      let ok = true;
      for (const [field, fieldRaw] of Object.entries(fields)) {
        if (!isValidIdentifier(field)) {
          errores.push(issue('payload-schema-invalido', `${path}: nombre de campo inválido '${field}'`));
          ok = false;
          continue;
        }
        if (!isRecord(fieldRaw)) {
          errores.push(issue('payload-schema-invalido', `${path}.${field}: campo debe ser objeto { type, optional? }`));
          ok = false;
          continue;
        }
        if (!isValidPayloadType(fieldRaw['type'], errores, `${path}.${field}.type`)) ok = false;
        const optional = fieldRaw['optional'];
        if (optional !== undefined && typeof optional !== 'boolean') {
          errores.push(issue('payload-schema-invalido', `${path}.${field}: optional debe ser booleano`));
          ok = false;
        }
      }
      return ok;
    }
    case 'union': {
      const of = value['of'];
      if (!Array.isArray(of) || of.length < 2) {
        errores.push(issue('payload-schema-invalido', `${path}: union requiere dos o más miembros`));
        return false;
      }
      let ok = true;
      of.forEach((member, i) => {
        if (!isValidPayloadType(member, errores, `${path}.union[${i}]`)) ok = false;
      });
      return ok;
    }
    default:
      errores.push(issue('payload-schema-invalido', `${path}: tipo desconocido '${String(kind)}'`));
      return false;
  }
}

/** Valida la forma del payloadSchema (spec §2): slot → { tipo, opcional }. */
function isValidPayloadSchema(value: unknown, errores: ManifestValidationIssue[], path: string): value is PayloadSchema {
  if (!isRecord(value) || Object.keys(value).length === 0) {
    errores.push(issue('payload-schema-invalido', `${path}: payloadSchema debe ser un objeto de slots no vacío`));
    return false;
  }
  let ok = true;
  for (const [slot, raw] of Object.entries(value)) {
    if (!isValidIdentifier(slot)) {
      errores.push(issue('payload-schema-invalido', `${path}: nombre de slot inválido '${slot}' (sin espacios)`));
      ok = false;
      continue;
    }
    if (!isRecord(raw)) {
      errores.push(issue('payload-schema-invalido', `${path}.${slot}: slot debe ser objeto { tipo, opcional }`));
      ok = false;
      continue;
    }
    if (!isValidPayloadType(raw['type'], errores, `${path}.${slot}.tipo`)) ok = false;
    const optional = raw['optional'];
    if (optional !== undefined && typeof optional !== 'boolean') {
      errores.push(issue('payload-schema-invalido', `${path}.${slot}: opcional debe ser booleano`));
      ok = false;
    }
  }
  return ok;
}

function isValidRequirement(raw: unknown, errores: ManifestValidationIssue[], path: string): raw is RequirementV0 {
  if (!isRecord(raw)) {
    errores.push(issue('requisito-invalido', `${path}: requisito debe ser un objeto`));
    return false;
  }
  let ok = true;

  const id = raw['id'];
  if (typeof id !== 'string' || !REQUIREMENT_ID_PATTERN.test(id)) {
    errores.push(issue('id-patron-invalido', `${path}: id '${String(id)}' no cumple ^dim[1-9]\\.req[0-9]{2}$`));
    ok = false;
  }

  const dimensionId = raw['dimensionId'];
  if (typeof dimensionId !== 'string' || !(DIMENSION_IDS as readonly string[]).includes(dimensionId)) {
    errores.push(issue('dimension-invalida', `${path}: dimensionId '${String(dimensionId)}' no es dim1..dim9`));
    ok = false;
  } else if (typeof id === 'string' && !id.startsWith(`${dimensionId}.`)) {
    errores.push(issue('dimension-incoherente', `${path}: id '${id}' no coincide con dimensionId '${dimensionId}'`));
    ok = false;
  }

  const eje = raw['eje'];
  if (typeof eje !== 'string' || !(EJES as readonly string[]).includes(eje)) {
    errores.push(issue('eje-invalido', `${path}: eje '${String(eje)}' no es uno de los 5 ejes`));
    ok = false;
  }

  const pregunta = raw['pregunta'];
  if (typeof pregunta !== 'string' || pregunta.trim().length === 0 || !pregunta.trimEnd().endsWith('?')) {
    errores.push(issue('pregunta-invalida', `${path}: pregunta debe ser una frase interrogativa no vacía terminada en '?'`));
    ok = false;
  }

  const packageId = raw['packageId'];
  if (typeof packageId !== 'string' || !PACKAGE_ID_PATTERN.test(packageId)) {
    errores.push(issue('package-id-invalido', `${path}: packageId '${String(packageId)}' no cumple pkg.<dim>.<paquete>`));
    ok = false;
  }

  const dependsOn = raw['dependsOn'];
  if (
    !Array.isArray(dependsOn) ||
    !dependsOn.every((d) => typeof d === 'string' && REQUIREMENT_ID_PATTERN.test(d))
  ) {
    errores.push(issue('depends-on-invalido', `${path}: dependsOn debe ser un array de IDs con patrón válido`));
    ok = false;
  }

  if (!isValidPayloadSchema(raw['payloadSchema'], errores, `${path}.payloadSchema`)) ok = false;

  const validityPredicate = raw['validityPredicate'];
  if (!Array.isArray(validityPredicate) || validityPredicate.length === 0) {
    errores.push(issue('predicado-invalido', `${path}: validityPredicate debe ser una lista no vacía de cláusulas`));
    ok = false;
  } else {
    validityPredicate.forEach((clause, i) => {
      if (!isValidClause(clause, errores, `${path}.validityPredicate[${i}]`)) ok = false;
    });
  }

  const rectorBindings = raw['rectorBindings'];
  if (!Array.isArray(rectorBindings) || !rectorBindings.every((b) => typeof b === 'string' && b.length > 0)) {
    errores.push(issue('rector-bindings-invalido', `${path}: rectorBindings debe ser un array de strings no vacíos`));
    ok = false;
  }

  const mapsToKinds = raw['mapsToKinds'];
  if (!Array.isArray(mapsToKinds)) {
    errores.push(issue('maps-to-kinds-invalido', `${path}: mapsToKinds debe ser un array (posiblemente vacío)`));
    ok = false;
  } else {
    mapsToKinds.forEach((entry, i) => {
      if (!isRecord(entry)) {
        errores.push(issue('maps-to-kinds-invalido', `${path}.mapsToKinds[${i}]: debe ser objeto`));
        ok = false;
        return;
      }
      const kind = entry['kind'];
      if (typeof kind !== 'string' || !(RULE_KINDS as readonly string[]).includes(kind)) {
        errores.push(issue('maps-to-kinds-invalido', `${path}.mapsToKinds[${i}]: kind '${String(kind)}' fuera de los 14 RULE_KINDS`));
        ok = false;
      }
      const scopeSuggestion = entry['scopeSuggestion'];
      if (scopeSuggestion !== undefined) {
        if (!isRecord(scopeSuggestion)) {
          errores.push(issue('maps-to-kinds-invalido', `${path}.mapsToKinds[${i}]: scopeSuggestion debe ser objeto`));
          ok = false;
        } else {
          const breakpoint = scopeSuggestion['breakpoint'];
          const state = scopeSuggestion['state'];
          if (
            breakpoint !== undefined &&
            (!Array.isArray(breakpoint) ||
              !breakpoint.every((b) => typeof b === 'string' && (SCOPE_BREAKPOINTS as readonly string[]).includes(b)))
          ) {
            errores.push(issue('maps-to-kinds-invalido', `${path}.mapsToKinds[${i}]: breakpoint fuera de {all, desktop, tablet, mobile}`));
            ok = false;
          }
          if (
            state !== undefined &&
            (!Array.isArray(state) ||
              !state.every((s) => typeof s === 'string' && (SCOPE_STATES as readonly string[]).includes(s)))
          ) {
            errores.push(issue('maps-to-kinds-invalido', `${path}.mapsToKinds[${i}]: state fuera de {default, hover, focus, active}`));
            ok = false;
          }
        }
      }
      const valueNotes = entry['valueNotes'];
      if (valueNotes !== undefined && typeof valueNotes !== 'string') {
        errores.push(issue('maps-to-kinds-invalido', `${path}.mapsToKinds[${i}]: valueNotes debe ser string`));
        ok = false;
      }
    });
  }

  const mappingNotes = raw['mappingNotes'];
  if (mappingNotes !== undefined && typeof mappingNotes !== 'string') {
    errores.push(issue('requisito-invalido', `${path}: mappingNotes debe ser string`));
    ok = false;
  }

  const estado = raw['estado'];
  if (estado !== 'active' && estado !== 'deprecated') {
    errores.push(issue('estado-invalido', `${path}: estado '${String(estado)}' no es active|deprecated`));
    ok = false;
  }

  return ok;
}

/**
 * DFS de tres colores, O(V+E) (spec §4.2). Orden de visita estable (orden de
 * lectura del manifiesto, dependencias en orden declarado) ⇒ el ciclo
 * reportado es determinista. Devuelve el camino completo del ciclo o null.
 */
export function detectCycles(requirements: readonly RequirementV0[]): string[] | null {
  const byId = new Map<string, RequirementV0>(requirements.map((r) => [r.id, r]));
  const WHITE = 0;
  const GRAY = 1;
  const BLACK = 2;
  const color = new Map<string, number>();
  let ciclo: string[] | null = null;

  const visit = (id: string, camino: readonly string[]): void => {
    color.set(id, GRAY);
    const req = byId.get(id);
    if (req !== undefined) {
      for (const dep of req.dependsOn) {
        if (ciclo !== null) return;
        const c = color.get(dep) ?? WHITE;
        if (c === GRAY) {
          ciclo = [...camino, dep];
          return;
        }
        if (c === WHITE) visit(dep, [...camino, dep]);
      }
    }
    color.set(id, BLACK);
  };

  for (const req of requirements) {
    if (ciclo !== null) break;
    if ((color.get(req.id) ?? WHITE) === WHITE) visit(req.id, [req.id]);
  }
  return ciclo;
}

/** Valida un manifiesto ya tipado (usado por evaluateManifest). */
export function validateManifestStructure(manifest: RequirementManifestV0): ManifestValidationResult {
  return parseRequirementManifest(manifest as unknown);
}

/**
 * Carga/parse del manifiesto: validación de forma + invariantes del grafo.
 * Un manifiesto inválido se rechaza EN BLOQUE (spec §4.1): no evalúa nada.
 */
export function parseRequirementManifest(raw: unknown): ManifestValidationResult {
  const errores: ManifestValidationIssue[] = [];
  if (!isRecord(raw)) {
    return {
      ok: false,
      errores: [issue('manifiesto-invalido', 'el manifiesto debe ser un objeto')],
    };
  }

  if (raw['schemaVersion'] !== 1) {
    errores.push(issue('schema-version-invalida', `schemaVersion '${String(raw['schemaVersion'])}' no soportada (v0 = 1)`));
  }
  const manifestVersion = raw['manifestVersion'];
  if (typeof manifestVersion !== 'string' || !MANIFEST_VERSION_PATTERN.test(manifestVersion)) {
    errores.push(issue('manifest-version-invalida', `manifestVersion '${String(manifestVersion)}' no cumple MAJOR.MINOR`));
  }
  const revision = raw['revision'];
  if (typeof revision !== 'number' || !Number.isInteger(revision) || revision < 0) {
    errores.push(issue('revision-invalida', 'revision debe ser un entero monótono ≥ 0'));
  }

  const requirementsRaw = raw['requirements'];
  if (!Array.isArray(requirementsRaw) || requirementsRaw.length === 0) {
    errores.push(issue('requisitos-invalidos', 'requirements debe ser un array no vacío'));
  } else {
    const seen = new Set<string>();
    requirementsRaw.forEach((reqRaw, i) => {
      if (!isValidRequirement(reqRaw, errores, `requirements[${i}]`)) return;
      const id = reqRaw['id'] as string;
      if (seen.has(id)) {
        errores.push(issue('id-duplicado', `id '${id}' duplicado en el manifiesto`));
      }
      seen.add(id);
    });
  }

  // Si la forma básica no permite armar el grafo, se corta aquí.
  if (errores.length > 0) return { ok: false, errores };

  const requirements = requirementsRaw as readonly RequirementV0[];
  const byId = new Map<string, RequirementV0>(requirements.map((r) => [r.id, r]));
  const estados = new Map<string, 'active' | 'deprecated'>(requirements.map((r) => [r.id, r.estado]));

  // Deprecaciones: registro obligatorio para todo deprecado y solo para deprecados (spec §3.3).
  const deprecationsRaw = raw['deprecations'];
  const deprecationById = new Map<string, Record<string, unknown>>();
  if (deprecationsRaw !== undefined) {
    if (!Array.isArray(deprecationsRaw)) {
      errores.push(issue('deprecaciones-invalidas', 'deprecations debe ser un array de registros'));
    } else {
      deprecationsRaw.forEach((record, i) => {
        const path = `deprecations[${i}]`;
        if (!isRecord(record)) {
          errores.push(issue('deprecaciones-invalidas', `${path}: registro debe ser objeto`));
          return;
        }
        const recordId = record['id'];
        if (typeof recordId !== 'string' || !REQUIREMENT_ID_PATTERN.test(recordId)) {
          errores.push(issue('deprecaciones-invalidas', `${path}: id inválido`));
          return;
        }
        if (deprecationById.has(recordId)) {
          errores.push(issue('deprecaciones-invalidas', `${path}: registro duplicado para '${recordId}'`));
          return;
        }
        const targetEstado = estados.get(recordId);
        if (targetEstado === undefined) {
          errores.push(issue('deprecaciones-invalidas', `${path}: id '${recordId}' no existe en el manifiesto`));
          return;
        }
        if (targetEstado !== 'deprecated') {
          errores.push(issue('deprecaciones-invalidas', `${path}: '${recordId}' es active; solo se registran deprecados`));
          return;
        }
        if (
          typeof record['autor'] !== 'string' ||
          record['autor'].trim().length === 0 ||
          typeof record['fecha'] !== 'string' ||
          record['fecha'].trim().length === 0 ||
          typeof record['motivo'] !== 'string' ||
          record['motivo'].trim().length === 0
        ) {
          errores.push(issue('deprecaciones-invalidas', `${path}: autor, fecha y motivo son obligatorios (no vacíos)`));
          return;
        }
        const sucesorId = record['sucesorId'];
        if (sucesorId !== undefined) {
          if (typeof sucesorId !== 'string' || !REQUIREMENT_ID_PATTERN.test(sucesorId)) {
            errores.push(issue('deprecaciones-invalidas', `${path}: sucesorId inválido`));
            return;
          }
          const sucesorEstado = estados.get(sucesorId);
          if (sucesorEstado === undefined) {
            errores.push(issue('deprecaciones-invalidas', `${path}: sucesorId '${sucesorId}' no existe en el manifiesto`));
            return;
          }
          if (sucesorEstado !== 'active') {
            errores.push(issue('deprecaciones-invalidas', `${path}: sucesor '${sucesorId}' debe estar active`));
            return;
          }
        }
        deprecationById.set(recordId, record);
      });
    }
  }
  for (const req of requirements) {
    if (req.estado === 'deprecated' && !deprecationById.has(req.id)) {
      errores.push(issue('deprecacion-sin-registro', `'${req.id}' está deprecated sin registro de deprecación (spec §3.3)`));
    }
  }

  // Invariante 1 y 2 del grafo (spec §4.1): referencias rotas y a deprecados.
  for (const req of requirements) {
    for (const dep of req.dependsOn) {
      const target = byId.get(dep);
      if (target === undefined) {
        errores.push(issue('dependencia-inexistente', `dep ${req.id} → ${dep}: ID no existe`));
        continue;
      }
      if (target.estado === 'deprecated') {
        errores.push(issue('dependencia-deprecada', `dep ${req.id} → ${dep}: el requisito referido está deprecated`));
      }
    }
  }

  // Invariante 3 (spec §4.2): ciclo → rechazo en bloque con el camino.
  const ciclo = detectCycles(requirements);
  if (ciclo !== null) {
    errores.push(issue('ciclo', `ciclo de dependencias: ${ciclo.join(' → ')}`));
  }

  if (errores.length > 0) {
    return ciclo !== null ? { ok: false, errores, ciclo } : { ok: false, errores };
  }

  const manifest: RequirementManifestV0 = {
    schemaVersion: 1,
    manifestVersion: manifestVersion as string,
    revision: revision as number,
    requirements: [...requirements],
  };
  if (deprecationById.size > 0) {
    manifest.deprecations = [...deprecationById.values()].map((record) => ({
      id: record['id'] as string,
      autor: record['autor'] as string,
      fecha: record['fecha'] as string,
      motivo: record['motivo'] as string,
      ...(typeof record['sucesorId'] === 'string' ? { sucesorId: record['sucesorId'] } : {}),
    }));
  }
  return { ok: true, manifest, errores: [] };
}

export function isDimensionId(value: string): value is DimensionId {
  return (DIMENSION_IDS as readonly string[]).includes(value);
}

export type { Operand, CoverExpected, PredicateClause, PayloadType };
