/**
 * Puente entre DesignSet (persistencia) y el evaluador de RequirementManifest
 * ya existente (spec-c2-designset-2026-08-31.md §2, §3).
 *
 * evaluateManifest() (requirement-manifest/evaluate.ts) ya sabe evaluar un
 * Map<requisitoId, payload> — este módulo solo construye ese mapa a partir
 * de un DesignSetV0 y verifica que las referencias cruzadas (RefValue) entre
 * entradas no queden colgando (spec §3).
 */
import { isRecord } from '../requirement-manifest/payload.js';
import { isRefValue, type DimensionId, type RefValue } from '../requirement-manifest/types.js';
import type { DesignSetEntryV0, DesignSetV0 } from './types.js';

/**
 * Construye el Map<requisitoId, payload> que espera evaluateManifest(), con
 * solo las entradas de la dimensión pedida. Un requisito activo sin entrada
 * en el DesignSet simplemente no aparece en el mapa — evaluateRequirement()
 * ya trata eso como no-resuelto (fail-closed, herencia directa de C1).
 */
export function toPayloadsMap(
  designSet: DesignSetV0,
  dimensionId: DimensionId,
): Map<string, unknown> {
  const map = new Map<string, unknown>();
  for (const entry of designSet.entries) {
    if (!entry.requirementId.startsWith(`${dimensionId}.`)) continue;
    if (map.has(entry.requirementId)) {
      throw new Error(
        `DesignSet corrupto: entrada duplicada para '${entry.requirementId}' — ` +
          'un requisito no puede tener dos definiciones efectivas en el mismo set (fail-closed en la frontera del adaptador).',
      );
    }
    map.set(entry.requirementId, entry.payload);
  }
  return map;
}

/** Une los payloads de TODAS las entradas, sin filtrar por dimensión. */
export function toFullPayloadsMap(designSet: DesignSetV0): Map<string, unknown> {
  const map = new Map<string, unknown>();
  for (const entry of designSet.entries) {
    if (map.has(entry.requirementId)) {
      throw new Error(
        `DesignSet corrupto: entrada duplicada para '${entry.requirementId}' — ` +
          'un requisito no puede tener dos definiciones efectivas en el mismo set (fail-closed en la frontera del adaptador).',
      );
    }
    map.set(entry.requirementId, entry.payload);
  }
  return map;
}

/** Recolecta todos los RefValue de un valor, sin importar la forma del schema. */
function collectRefValues(value: unknown, out: { refReqId: string }[]): void {
  if (value === null || value === undefined) return;
  if (isRefValue(value)) {
    out.push({ refReqId: value.refReqId });
    return; // opaco: no se desciende dentro de un ref, igual que collectStringLeaves
  }
  if (Array.isArray(value)) {
    for (const item of value) collectRefValues(item, out);
    return;
  }
  if (isRecord(value)) {
    for (const key of Object.keys(value)) collectRefValues(value[key], out);
  }
}

export interface DanglingRef {
  /** Entrada cuyo payload contiene la referencia colgante. */
  requirementId: string;
  /** requirementId al que apunta la referencia y que NO tiene entrada en el set. */
  refiereA: string;
}

/**
 * Toda RefValue dentro de un payload debe apuntar a un requirementId que
 * también tenga entrada en el MISMO DesignSet (spec §3). Devuelve la lista
 * de referencias colgantes; vacía = todas resuelven dentro del set.
 */
export function findDanglingRefs(designSet: DesignSetV0): DanglingRef[] {
  const presentes = new Set(designSet.entries.map((e) => e.requirementId));
  const dangling: DanglingRef[] = [];
  for (const entry of designSet.entries) {
    const refs: { refReqId: string }[] = [];
    collectRefValues(entry.payload, refs);
    for (const ref of refs) {
      if (!presentes.has(ref.refReqId)) {
        dangling.push({ requirementId: entry.requirementId, refiereA: ref.refReqId });
      }
    }
  }
  return dangling;
}

/** true si el set tiene más de una entrada para el mismo requirementId (dato corrupto, nunca debería pasar). */
export function findDuplicateEntries(designSet: DesignSetV0): string[] {
  const seen = new Set<string>();
  const dupes = new Set<string>();
  for (const entry of designSet.entries) {
    if (seen.has(entry.requirementId)) dupes.add(entry.requirementId);
    seen.add(entry.requirementId);
  }
  return [...dupes];
}

export function findEntry(
  designSet: DesignSetV0,
  requirementId: string,
): DesignSetEntryV0 | undefined {
  return designSet.entries.find((e) => e.requirementId === requirementId);
}

export interface RefResolutionError {
  codigo: 'entrada-ausente' | 'ruta-invalida' | 'ref-encadenada';
  mensaje: string;
}

export type RefResolution =
  | { ok: true; value: unknown }
  | { ok: false; error: RefResolutionError };

/**
 * Resuelve una RefValue navegando `refPath` dentro del payload de la
 * entrada que referencia (`refReqId`), DENTRO DEL MISMO DesignSet — no hay
 * insumo de ningún requirement-manifest existente que resuelva un valor
 * real a partir de un ref (evaluate.ts/predicate.ts solo verifican forma y
 * existencia, nunca navegan `refPath` hasta un valor). Es nueva, acotada a
 * lo que hace falta para proyectar `surface` (project-to-designruleset.ts).
 *
 * Fail-closed: entrada ausente o ruta inválida son errores explícitos, no
 * `undefined` silencioso. Una ref que resuelve a OTRA RefValue (cadena de
 * referencias) también es un error explícito — encadenar no está cubierto
 * todavía, no se resuelve a ciegas.
 */
export function resolveRefValue(designSet: DesignSetV0, ref: RefValue): RefResolution {
  const target = findEntry(designSet, ref.refReqId);
  if (!target) {
    return {
      ok: false,
      error: { codigo: 'entrada-ausente', mensaje: `no hay entrada para '${ref.refReqId}' en este DesignSet` },
    };
  }
  let current: unknown = target.payload;
  for (const segment of ref.refPath) {
    if (typeof segment === 'number') {
      if (!Array.isArray(current) || segment < 0 || segment >= current.length) {
        return {
          ok: false,
          error: {
            codigo: 'ruta-invalida',
            mensaje: `refPath de '${ref.refReqId}' rompe en el índice ${segment} (no es una lista o está fuera de rango)`,
          },
        };
      }
      current = current[segment];
    } else {
      if (!isRecord(current) || !(segment in current)) {
        return {
          ok: false,
          error: { codigo: 'ruta-invalida', mensaje: `refPath de '${ref.refReqId}' rompe en el campo '${segment}'` },
        };
      }
      current = current[segment];
    }
  }
  if (isRefValue(current)) {
    return {
      ok: false,
      error: {
        codigo: 'ref-encadenada',
        mensaje: `'${ref.refReqId}' resuelve a otra RefValue (hacia '${current.refReqId}') — cadenas de referencias no soportadas todavía`,
      },
    };
  }
  return { ok: true, value: current };
}
