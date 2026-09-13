/**
 * Tipos del DesignSet — ficha C2 (borrador, sin auditar todavía).
 *
 * Contrato: spec-c2-designset-2026-08-31.md §2 (esquema de entrada), §5 (los
 * dos hogares), §6 (sin registro de auditoría dentro del JSON).
 *
 * Un DesignSet es la hoja de respuestas que resuelve un RequirementManifest
 * (C1): para cada requisito activo, la definición efectiva (payload) que lo
 * resuelve. evaluateRequirement()/evaluateManifest() (requirement-manifest/
 * evaluate.ts) ya saben validar un payload contra su requisito — este módulo
 * NO reimplementa esa validación, solo define dónde vive el payload de forma
 * persistente y cómo se conecta con el evaluador existente (ver adapter.ts).
 */
import type { DimensionId, MapsToKindsEntry } from '../requirement-manifest/types.js';

/**
 * Los cuatro caminos de resolución de un requisito (taxonomía, spec §2).
 *
 * `nulo` es el que no estaba: significa que una variable que el sistema
 * incluye por defecto se dejó **voluntariamente indefinida**. No es «todavía
 * no», ni un olvido: es una decisión, y por eso resuelve el requisito y cuenta
 * para la completitud.
 *
 * Su consecuencia operativa es que NO SE EMITE NADA al destino. Emitir una
 * regla vacía sería peor que no emitir: el destino le pondría su propio valor
 * por defecto, que es exactamente lo que este camino declara que no debe
 * ocurrir. Las cuatro funciones de proyección lo cortan antes de empezar.
 *
 * ABIERTO, y hay que resolverlo antes de confiar en este camino. Cristóbal lo
 * levantó el mismo día que lo definió: hay propiedades que el medio resuelve
 * SIEMPRE — el color de un texto, el fondo de algo que se pinta. Ahí no existe
 * «no decidir»: si el set no decide, decide el navegador, o decide el destino.
 * Para esas, `nulo` no está prohibido: es INALCANZABLE.
 *
 * La salida propuesta es un «mínimo irreducible»: un conjunto chico de
 * requisitos donde `nulo` no es un camino legal, y que por eso impiden que el
 * set se dé por completo hasta que alguien los defina. Es lo contrario de un
 * valor por defecto: el sistema no rellena, se niega a completarse.
 *
 * Cuáles son esos requisitos es trabajo de la taxonomía, no de este archivo.
 * Hasta que exista esa lista, el tipo acepta `nulo` en cualquier requisito y
 * NADA lo impide. Queda anotado como pendiente, no como decisión.
 */
export type ResolutionPath = 'insumo' | 'diseñador' | 'contope' | 'nulo';

/** Eje "fuerza" de la taxonomía (spec §2). */
export type Fuerza = 'inamovible' | 'prioritaria' | 'explorable';

/** Eje "ciclo-de-vida" de la taxonomía (spec §2). */
export type CicloDeVida = 'propuesta' | 'aprobada' | 'reabierta' | 'reemplazada';

/** Vocabulario de procedencia (spec §2; homologación con designRuleSet.provenance.sources queda como tensión abierta §8.3). */
export type FuenteProvenance = 'referente' | 'usuario' | 'ia';

export interface ProvenanceV0 {
  fuente: FuenteProvenance;
  /** ID del referente/mood-wall/descriptor de origen, si aplica. */
  referenciaId?: string;
}

/**
 * Una entrada del DesignSet (spec §2): la definición efectiva de UN
 * requisito. `mapsToKinds` se copia del requisito al momento de resolver
 * (no se recalcula aquí) para que el DesignSet sea autocontenido.
 */
export interface DesignSetEntryV0 {
  requirementId: string;
  effectiveDefinitionId: string;
  resolutionPath: ResolutionPath;
  /** Debe validar contra el payloadSchema del requisito referenciado. */
  payload: unknown;
  provenance: ProvenanceV0;
  fuerza: Fuerza;
  cicloDeVida: CicloDeVida;
  /** Entero monótono; sube en cada edición publicada de ESTA entrada. */
  revision: number;
  mapsToKinds: MapsToKindsEntry[];
}

/** Referencia a la versión de manifiesto que una dimensión del set resuelve. */
export interface ManifestRefV0 {
  manifestVersion: string;
  revision: number;
}

export interface DesignSetV0 {
  schemaVersion: 1;
  designSetId: string;
  manifestRefs: Partial<Record<DimensionId, ManifestRefV0>>;
  entries: DesignSetEntryV0[];
}
