/**
 * Validación estructural del payload contra el payloadSchema (spec §2, §8.1)
 * y el walk ordenado de hojas string que define el dominio de match del
 * mecanismo noConflict (spec §8.2).
 */
import { isColorCss, isLengthCss } from './css-values.js';
import { isRefValue, type Motivo, type PayloadSchema, type PayloadType } from './types.js';

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export interface PayloadCheckResult {
  ok: boolean;
  motivos: Motivo[];
}

function fail(code: string, mensaje: string): PayloadCheckResult {
  return { ok: false, motivos: [{ codigo: code, mensaje }] };
}

const MAX_VALIDATION_MOTIVOS = 20;

/**
 * Valida `value` contra `type`. Devuelve todos los motivos (acotados a
 * MAX_VALIDATION_MOTIVOS para payloads patológicos) en orden determinista
 * (orden de slots del schema, orden de índices de listas, orden de campos).
 */
function validateAgainstType(
  value: unknown,
  type: PayloadType,
  path: string,
  motivos: Motivo[],
): void {
  const add = (mensaje: string): void => {
    if (motivos.length < MAX_VALIDATION_MOTIVOS) {
      motivos.push({ codigo: 'payload-invalido', mensaje });
    }
  };
  switch (type.kind) {
    case 'color-css':
      if (!isColorCss(value)) add(`slot '${path}': no es un color-css válido (hex/rgb/hsl/oklch plano)`);
      return;
    case 'longitud-css':
      if (!isLengthCss(value)) add(`slot '${path}': no es una longitud-css válida`);
      return;
    case 'texto':
      if (typeof value !== 'string') add(`slot '${path}': se esperaba texto`);
      return;
    case 'bool':
      if (typeof value !== 'boolean') add(`slot '${path}': se esperaba booleano`);
      return;
    case 'enum':
      if (typeof value !== 'string' || !type.values.includes(value)) {
        add(`slot '${path}': se esperaba uno de enum(${type.values.join('|')})`);
      }
      return;
    case 'numero': {
      if (typeof value !== 'number' || !Number.isFinite(value)) {
        add(`slot '${path}': se esperaba numero`);
        return;
      }
      if (type.min !== undefined && value < type.min) {
        add(`slot '${path}': numero ${value} por debajo del mínimo ${type.min}`);
      }
      if (type.max !== undefined && value > type.max) {
        add(`slot '${path}': numero ${value} por encima del máximo ${type.max}`);
      }
      return;
    }
    case 'ref': {
      if (!isRefValue(value)) {
        add(`slot '${path}': se esperaba ref (objeto { refReqId, refPath })`);
        return;
      }
      if (type.reqId !== undefined && value.refReqId !== type.reqId) {
        add(`slot '${path}': ref apunta a '${value.refReqId}', se esperaba '${type.reqId}'`);
      }
      return;
    }
    case 'lista': {
      if (!Array.isArray(value)) {
        add(`slot '${path}': se esperaba lista(...)`);
        return;
      }
      value.forEach((item, index) => validateAgainstType(item, type.of, `${path}[${index}]`, motivos));
      return;
    }
    case 'objeto': {
      if (!isRecord(value)) {
        add(`slot '${path}': se esperaba objeto`);
        return;
      }
      for (const [field, fieldSchema] of Object.entries(type.fields)) {
        const fieldValue = value[field];
        if (fieldValue === undefined) {
          if (fieldSchema.optional !== true) add(`slot '${path}': campo obligatorio '${field}' ausente`);
          continue;
        }
        validateAgainstType(fieldValue, fieldSchema.type, `${path}.${field}`, motivos);
      }
      return;
    }
    case 'union': {
      // Valida contra cada miembro en orden; pasa si ALGUNO acepta el valor.
      for (const member of type.of) {
        const memberMotivos: Motivo[] = [];
        validateAgainstType(value, member, path, memberMotivos);
        if (memberMotivos.length === 0) return;
      }
      add(`slot '${path}': no cumple ningún miembro de la unión`);
      return;
    }
  }
}

/** Valida el payload completo contra el payloadSchema (slots en orden del schema). */
export function validatePayload(payload: unknown, schema: PayloadSchema): PayloadCheckResult {
  const motivos: Motivo[] = [];
  if (!isRecord(payload)) {
    motivos.push({
      codigo: 'payload-invalido',
      mensaje: 'el payload debe ser un objeto (la definición efectiva del requisito)',
    });
    return { ok: false, motivos };
  }
  for (const [slot, fieldSchema] of Object.entries(schema)) {
    const value = payload[slot];
    if (value === undefined) {
      if (fieldSchema.optional !== true) {
        motivos.push({
          codigo: 'payload-invalido',
          mensaje: `slot obligatorio '${slot}' ausente del payload`,
        });
      }
      continue;
    }
    validateAgainstType(value, fieldSchema.type, slot, motivos);
  }
  return { ok: motivos.length === 0, motivos };
}

/**
 * Recolecta las hojas string de un valor en ORDEN DETERMINISTA
 * (spec §8.2: "en orden de lectura del payloadSchema"). Los objetos se
 * recorren en el orden de campos del schema cuando se dispone de él y luego
 * las claves extras en orden de inserción; las listas en orden de índice.
 * Los refs son OPACOS (sus metadatos refReqId/refPath no son contenido del
 * set y no participan del match). Números y booleanos no son hojas string.
 */
export function collectStringLeaves(value: unknown, schemaType?: PayloadType): string[] {
  const leaves: string[] = [];
  const walk = (current: unknown, type: PayloadType | undefined): void => {
    if (typeof current === 'string') {
      leaves.push(current);
      return;
    }
    if (typeof current === 'number' || typeof current === 'boolean') return;
    if (current === null || current === undefined) return;
    if (isRefValue(current)) return; // opaco: no se desciende en metadatos de ref
    if (Array.isArray(current)) {
      const itemType = type?.kind === 'lista' ? type.of : undefined;
      for (const item of current) walk(item, itemType);
      return;
    }
    if (isRecord(current)) {
      const schemaFields = type?.kind === 'objeto' ? type.fields : undefined;
      const seen = new Set<string>();
      if (schemaFields) {
        for (const field of Object.keys(schemaFields)) {
          seen.add(field);
          const fieldValue = current[field];
          if (fieldValue !== undefined) walk(fieldValue, schemaFields[field]?.type);
        }
      }
      for (const key of Object.keys(current)) {
        if (seen.has(key)) continue;
        walk(current[key], undefined);
      }
      return;
    }
  };
  walk(value, schemaType);
  return leaves;
}

/**
 * Dominio D del match noConflict sobre el payload del requisito: hojas
 * string recorridas en el orden de lectura del payloadSchema (spec §8.2).
 */
export function collectPayloadDomain(payload: unknown, schema: PayloadSchema): string[] {
  const leaves: string[] = [];
  if (!isRecord(payload)) return leaves;
  const seen = new Set<string>();
  for (const [slot, fieldSchema] of Object.entries(schema)) {
    seen.add(slot);
    const value = payload[slot];
    if (value !== undefined) leaves.push(...collectStringLeaves(value, fieldSchema.type));
  }
  for (const key of Object.keys(payload)) {
    if (seen.has(key)) continue;
    leaves.push(...collectStringLeaves(payload[key]));
  }
  return leaves;
}
