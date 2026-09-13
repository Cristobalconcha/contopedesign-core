/**
 * Tipos del RequirementManifest — ficha C1-implementación.
 *
 * Contrato: spec-c1-requirement-manifest-2026-08-30.md §2 (esquema del
 * requisito), §3 (estabilidad de IDs), §6.1 (campos de versión del documento),
 * §7 (fixture de Dimensión 1) y §8.2 (definiciones rectoras).
 *
 * Reglas de diseño heredadas de la ficha C1-implementación:
 * - Los validityPredicate son AST estructurado serializable (nunca strings
 *   que se parsean en runtime). La serialización del manifiesto ES el dato.
 * - El campo `required` NO existe en v0 (spec §2, nota; tensión 9 ratificada
 *   por la auditoría).
 * - Verdad-vacía FAIL-CLOSED en toda cláusula cuantificada: colección/slot
 *   ausente o vacío ⇒ false con motivo.
 */

/**
 * IDs de las nueve dimensiones aprobadas (Puerta 0 punto 1). El espacio de
 * coordenadas es cerrado por diseño: una décima dimensión exige cambiar el
 * formato de ID y es un cambio MAJOR (spec §3.1).
 */
export const DIMENSION_IDS = [
  'dim1',
  'dim2',
  'dim3',
  'dim4',
  'dim5',
  'dim6',
  'dim7',
  'dim8',
  'dim9',
] as const;
export type DimensionId = (typeof DIMENSION_IDS)[number];

/** Patrón exacto de ID de requisito (spec §2, §3.1): `^dim[1-9]\.req[0-9]{2}$`. */
export const REQUIREMENT_ID_PATTERN = /^dim[1-9]\.req[0-9]{2}$/;

/** Los cinco ejes transversales (Puerta 0 punto 1). Exactamente 1 por requisito. */
export const EJES = [
  'completitud',
  'validez',
  'ciclo-de-vida',
  'fuerza',
  'coherencia',
] as const;
export type Eje = (typeof EJES)[number];

/** Ciclo de vida del requisito (spec §2): la única mutación permitida. */
export type EstadoRequisito = 'active' | 'deprecated';

/**
 * Los 14 `RULE_KINDS` del designRuleSet de producción
 * (class-cod-canvas-mcp-recipe-compiler.php:21-36, inventariados en
 * ficha-d3-inventario-almacen-definiciones-2026-08-29.md §2). El manifiesto
 * solo puede referirlos; jamás inventar uno nuevo (spec §9.2).
 */
export const RULE_KINDS = [
  'color',
  'typography',
  'spacing',
  'layout',
  'surface',
  'shape',
  'media',
  'button',
  'gallery',
  'table',
  'form',
  'motion',
  'interaction',
  'cadence',
] as const;
export type RuleKind = (typeof RULE_KINDS)[number];

/** Conjuntos cerrados del scope del envelope (spec §9.3, compiler:105-109). */
export const SCOPE_BREAKPOINTS = ['all', 'desktop', 'tablet', 'mobile'] as const;
export type ScopeBreakpoint = (typeof SCOPE_BREAKPOINTS)[number];
export const SCOPE_STATES = ['default', 'hover', 'focus', 'active'] as const;
export type ScopeState = (typeof SCOPE_STATES)[number];

/**
 * AST del payloadSchema (spec §2, campo `payloadSchema`): la FORMA de la
 * definición efectiva que resuelve el requisito. Tipos base de la spec:
 * color-css, longitud-css, texto, ref, enum(...), lista(<slot>), numero(rango).
 * `objeto` y `union` cierran las formas compuestas que usa la fixture §7.
 */
export type PayloadType =
  | { kind: 'color-css' }
  | { kind: 'longitud-css' }
  | { kind: 'texto' }
  | { kind: 'bool' }
  | { kind: 'enum'; values: readonly string[] }
  | { kind: 'numero'; min?: number; max?: number }
  /** Referencia a la definición efectiva de otro requisito; `reqId` ausente = ref genérica. */
  | { kind: 'ref'; reqId?: string }
  | { kind: 'lista'; of: PayloadType }
  | { kind: 'objeto'; fields: Record<string, PayloadFieldSchema> }
  | { kind: 'union'; of: readonly PayloadType[] };

/** Campo de un objeto/una tupla del payload: tipo + opcionalidad. */
export interface PayloadFieldSchema {
  type: PayloadType;
  /** Solo presente cuando es true (exactOptionalPropertyTypes). */
  optional?: boolean;
}

/** payloadSchema: mapa slot → { tipo, opcional } (spec §2). */
export type PayloadSchema = Record<string, PayloadFieldSchema>;

/**
 * Representación canónica de un valor `ref` DENTRO de un payload.
 * `refPath` es una ruta JSON-style (segmentos string|number) dentro del
 * payload resuelto de `refReqId`; ruta vacía = el payload completo.
 * Las claves `refReqId`/`refPath` son metadatos OPACOS: la navegación de
 * rutas las respeta y el walk de hojas string NO desciende dentro de un ref.
 */
export interface RefValue {
  refReqId: string;
  refPath: ReadonlyArray<string | number>;
}

export function isRefValue(value: unknown): value is RefValue {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const rec = value as Record<string, unknown>;
  return (
    typeof rec['refReqId'] === 'string' &&
    Array.isArray(rec['refPath']) &&
    rec['refPath'].every((s) => typeof s === 'string' || typeof s === 'number')
  );
}

/** Entrada de mapsToKinds (spec §2): proyección a kinds del designRuleSet para C2. */
export interface MapsToKindsEntry {
  kind: RuleKind;
  /**
   * Sugerencia de scope para C2 (spec §9.3). Los valores son conjuntos
   * (arrays) porque un requisito puede proyectarse a varios estados o
   * breakpoints; la fixture los escribe como `hover|focus|active`.
   */
  scopeSuggestion?: {
    breakpoint?: ScopeBreakpoint[];
    state?: ScopeState[];
  };
  valueNotes?: string;
}

/**
 * El requisito (spec §2, tabla completa). `required` NO existe en v0.
 * `mappingNotes` es una adición mínima de implementación (no está en la
 * tabla §2): el lugar-dato donde se DECLARA una brecha de mapeo cuando
 * `mapsToKinds` es vacío — la spec exige que la ausencia "se declare, no se
 * pierda en silencio" (spec §2, §9.5) y la fixture escribe esa declaración
 * como valueNotes bajo `mapsToKinds: []`. Documentado en la nota de
 * implementación (c1-implementacion-extension-gramatica-2026-08-30.md).
 */
export interface RequirementV0 {
  /** string, patrón `^dim[1-9]\.req[0-9]{2}$`, único para siempre (spec §2, §3). */
  id: string;
  dimensionId: DimensionId;
  /** Exactamente 1 de 5 ejes (spec §2). */
  eje: Eje;
  /** Frase interrogativa en lenguaje simple; la pregunta ES el requisito. */
  pregunta: string;
  /** `pkg.<dim>.<paquete>`; trazabilidad, no afecta evaluación. */
  packageId: string;
  /** Referencias a IDs; todas deben existir y ser active; prohibidos ciclos (§4). */
  dependsOn: string[];
  /** Forma de la definición efectiva que resuelve el requisito. */
  payloadSchema: PayloadSchema;
  /** Lista ordenada de cláusulas declarativas; todas deben pasar. */
  validityPredicate: readonly import('./predicate.js').PredicateClause[];
  /** `descriptor` | `referente:<id>` | `mood-wall` (spec §2, §8.2). */
  rectorBindings: string[];
  /** Mapeo a kinds del designRuleSet; vacío = sin proyección, DECLARADA. */
  mapsToKinds: MapsToKindsEntry[];
  /** Declaración de brecha de mapeo (ver doc del tipo). */
  mappingNotes?: string;
  estado: EstadoRequisito;
}

/**
 * Restricciones formales de una definición rectora (spec §8.2):
 * tres listas de literales exactos, sin comodines ni regex.
 * Lista vacía = sin restricción de ese tipo. Los tres campos existen siempre.
 */
export interface RectoraV0 {
  /** 'descriptor' | 'mood-wall' | 'referente:<id>' — el id referenciado por rectorBindings/noConflict. */
  id: string;
  tagsRequeridos: string[];
  tagsProhibidos: string[];
  exclusiones: string[];
}

/**
 * Registro de deprecación (spec §3.3.2): quién, cuándo, por qué y — si
 * existe — el ID del sucesor. La deprecación es la única mutación permitida
 * sobre un requisito publicado y es una operación de versión del manifiesto.
 */
export interface DeprecationRecordV0 {
  /** ID del requisito deprecado. */
  id: string;
  autor: string;
  /** Fecha ISO-8601. */
  fecha: string;
  motivo: string;
  /** ID del requisito sucesor (si existe); debe existir y estar active. */
  sucesorId?: string;
}

/**
 * El documento manifiesto (spec §6.1). v0 cubre la Dimensión 1 completa;
 * las otras ocho dimensiones se agregan en cortes posteriores sin tocar este
 * contrato (los IDs son coordenadas estables).
 */
export interface RequirementManifestV0 {
  /** Versión de la FORMA del documento; v0 = 1 (spec §6.1). */
  schemaVersion: 1;
  /** Versión del CONTENIDO de requisitos, `MAJOR.MINOR`. */
  manifestVersion: string;
  /** Entero monótono; cada edición publicada incrementa. */
  revision: number;
  requirements: RequirementV0[];
  /** Registros de deprecación (spec §3.3); solo presente si hay deprecaciones. */
  deprecations?: DeprecationRecordV0[];
}

/** Diagnóstico de evaluación: código máquina + mensaje humano. */
export interface Motivo {
  codigo: string;
  mensaje: string;
}

/** Resultado binario de un requisito (spec §2.1, §8.1): nunca un tercer estado. */
export interface RequirementResultV0 {
  requisitoId: string;
  resultado: 'resuelto' | 'no-resuelto';
  motivos: Motivo[];
}

/** Verificación registrada para la cláusula `verified(pruebaId)`. */
export interface VerificationRecordV0 {
  pruebaId: string;
  fecha: string;
  evidencia: string;
}

/**
 * Veredicto humano registrado (spec §8.2, vía de escape
 * requiere-veredicto-humano-registrado): autor, fecha, motivo. Nunca silencioso.
 */
export interface HumanVerdictV0 {
  requisitoId: string;
  autor: string;
  fecha: string;
  motivo: string;
}

/** Alegación de contradicción difusa no capturable por match literal (§8.2). */
export interface DiffuseAllegationV0 {
  requisitoId: string;
  motivo: string;
}

/**
 * Evaluación de una dimensión (spec §8.1.2): AND estricto sobre los activos.
 * `contador` es solo diagnóstico de interfaz (8/9); nunca un estado contractual.
 */
export interface DimensionEvaluationV0 {
  dimensionId: DimensionId;
  /** Resultados de los requisitos ACTIVE, en orden del documento. */
  resultados: RequirementResultV0[];
  resultado: 'resuelto' | 'no-resuelto';
  contador: {
    resueltos: number;
    activos: number;
  };
}

/** Los 13 roles Core de la dimensión Color y superficies (spec §7, lista cerrada). */
export const CORE_ROLES_13 = [
  'background',
  'surface',
  'text',
  'border',
  'accent',
  'action',
  'info',
  'success',
  'warning',
  'error',
  'active',
  'inactive',
  'focus',
] as const;

/**
 * Los nueve roles Core de la dimensión Tipografía (spec C1-dim2 §2, lista
 * cerrada por analogía con `CORE_ROLES_13` — supuesto declarado, no cita
 * explícita de Puerta 0; ver auditoria-spec-c1-dim2-tipografia-2026-08-31.md
 * tensión 1, aceptada sin acción).
 */
export const CORE_ROLES_9 = [
  'display',
  'título',
  'subtítulo',
  'cuerpo',
  'cita',
  'nota',
  'leyenda',
  'dato',
  'control',
] as const;

/** Patrón de nombre de slot/alias: sin espacios, identificador simple. */
export const IDENTIFIER_PATTERN = /^[A-Za-z][A-Za-z0-9]*$/;

/** Patrón de packageId (fixture §7: pkg.color.fundamento, pkg.color.roles...). */
export const PACKAGE_ID_PATTERN = /^pkg\.[a-z0-9]+(\.[a-z0-9-]+)+$/;

/** Patrón de manifestVersion (§6.1: MAJOR.MINOR). */
export const MANIFEST_VERSION_PATTERN = /^\d+\.\d+$/;
