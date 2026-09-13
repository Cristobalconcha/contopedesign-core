/**
 * Persistencia del DesignSet — spec-c2-designset-2026-08-31.md §9.1
 * (corrección de Cristobal, 2026-08-31): el guardado con versiones no es un
 * JSON vivo con historial incrustado, es exportar al mismo formato con el
 * que se importó — cada exportación es un archivo fechado, el versionado
 * sale gratis del mecanismo de portabilidad (mismo principio que los
 * `_cod_canvas_snapshots` del escritorio y que `class-cod-site-package-
 * exporter.php`/`-importer.php` del lado WordPress).
 *
 * Este módulo es la mitad de escritorio de ese mecanismo: serializar un
 * DesignSetV0 a texto portable, y volver a parsearlo validando en la
 * frontera (fail-closed) en vez de confiar en que el archivo esté bien
 * formado. No decide DÓNDE vive el archivo (eso es infraestructura del
 * programa de escritorio, fuera de este paquete) — solo la forma segura de
 * ir y volver.
 */
import { findDanglingRefs, findDuplicateEntries } from './adapter.js';
import type { DesignSetV0 } from './types.js';

export interface DesignSetValidationError {
  codigo: string;
  mensaje: string;
}

export interface DesignSetValidationResult {
  ok: boolean;
  errores: DesignSetValidationError[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Valida la forma estructural mínima de un DesignSetV0 (spec §2) más las
 * dos invariantes ya conocidas del adaptador (spec §3, auditoría de C2
 * observación 1): sin referencias colgantes, sin `requirementId` duplicado.
 * No valida cada `payload` contra su `payloadSchema` — eso exige el
 * `RequirementManifest` correspondiente y es responsabilidad del evaluador
 * de C1 (`evaluateManifest`), no de la capa de persistencia.
 */
export function validateDesignSetShape(value: unknown): DesignSetValidationResult {
  const errores: DesignSetValidationError[] = [];
  if (!isRecord(value)) {
    return { ok: false, errores: [{ codigo: 'forma-invalida', mensaje: 'el DesignSet debe ser un objeto' }] };
  }
  if (value['schemaVersion'] !== 1) {
    errores.push({ codigo: 'version-desconocida', mensaje: `schemaVersion '${String(value['schemaVersion'])}' no es 1` });
  }
  if (typeof value['designSetId'] !== 'string' || value['designSetId'] === '') {
    errores.push({ codigo: 'id-invalido', mensaje: 'designSetId debe ser un string no vacío' });
  }
  if (!isRecord(value['manifestRefs'])) {
    errores.push({ codigo: 'manifest-refs-invalido', mensaje: 'manifestRefs debe ser un objeto' });
  }
  if (!Array.isArray(value['entries'])) {
    errores.push({ codigo: 'entries-invalido', mensaje: 'entries debe ser una lista' });
    return { ok: false, errores };
  }

  const REQUIRED_ENTRY_FIELDS = [
    'requirementId',
    'effectiveDefinitionId',
    'resolutionPath',
    'payload',
    'provenance',
    'fuerza',
    'cicloDeVida',
    'revision',
    'mapsToKinds',
  ] as const;
  value['entries'].forEach((entry, index) => {
    if (!isRecord(entry)) {
      errores.push({ codigo: 'entrada-invalida', mensaje: `entries[${index}] no es un objeto` });
      return;
    }
    for (const field of REQUIRED_ENTRY_FIELDS) {
      if (!(field in entry)) {
        errores.push({ codigo: 'entrada-incompleta', mensaje: `entries[${index}] falta el campo '${field}'` });
      }
    }
  });

  if (errores.length > 0) {
    return { ok: false, errores };
  }

  // A esta altura la forma básica es válida; podemos tratarlo como
  // DesignSetV0 para las invariantes de adapter.ts.
  const designSet = value as unknown as DesignSetV0;
  for (const dup of findDuplicateEntries(designSet)) {
    errores.push({ codigo: 'requisito-duplicado', mensaje: `requirementId duplicado en el set: '${dup}'` });
  }
  for (const dangling of findDanglingRefs(designSet)) {
    errores.push({
      codigo: 'referencia-colgante',
      mensaje: `la entrada '${dangling.requirementId}' referencia '${dangling.refiereA}', que no tiene entrada en este set`,
    });
  }

  return { ok: errores.length === 0, errores };
}

/**
 * Serializa un DesignSetV0 a JSON portable ("exportar"). Rechaza en bloque
 * un set inválido — nunca escribe un archivo corrupto (fail-closed en el
 * punto de escritura, no solo en el de lectura).
 */
export function serializeDesignSet(designSet: DesignSetV0): string {
  const validation = validateDesignSetShape(designSet);
  if (!validation.ok) {
    const detalle = validation.errores.map((e) => e.mensaje).join('; ');
    throw new Error(`DesignSet inválido — rechazo en bloque, no se exporta: ${detalle}`);
  }
  return JSON.stringify(designSet, null, 2);
}

/**
 * Parsea un JSON portable de vuelta a DesignSetV0 ("importar"). Rechaza en
 * bloque un archivo corrupto o con forma inesperada — nunca devuelve un
 * DesignSet a medio validar.
 */
export function parseDesignSet(raw: string): DesignSetV0 {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch (error) {
    throw new Error(`DesignSet ilegible — JSON inválido: ${(error as Error).message}`);
  }
  const validation = validateDesignSetShape(value);
  if (!validation.ok) {
    const detalle = validation.errores.map((e) => e.mensaje).join('; ');
    throw new Error(`DesignSet inválido — rechazo en bloque, no se importa: ${detalle}`);
  }
  return value as DesignSetV0;
}
