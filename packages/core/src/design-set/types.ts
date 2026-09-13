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
 * Los tres caminos de resolución de un requisito (taxonomía, spec `2).
 *
 * Hubo un cuarto, `nulo` —dejar una variable voluntariamente indefinida—, y se
 * descartó el mismo día, 2026-09-13. La razón es que partía de un supuesto
 * falso: que todas las variables empiezan indefinidas y hay que ir cerrándolas
 * una por una. No es así. Hay un paquete base de definiciones que no puede no
 * estar —el CORE—, y lo que el diseñador hace sobre él es AGREGAR variables que
 * no estaban consideradas, no anular las que están.
 *
 * Con el core cumpliendo ese papel, `nulo` deja de tener sentido: lo que no
 * está en el core simplemente no se declara, y lo que está en el core no se
 * puede dejar sin resolver.
 *
 * Cuál es el core depende del tipo de proyecto (editorial, packaging, web,
 * campaña…). Ver ARQUITECTURA.md, «El core, y por qué no hay un cuarto camino».
 */
export type ResolutionPath = 'insumo' | 'diseñador' | 'contope';

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
