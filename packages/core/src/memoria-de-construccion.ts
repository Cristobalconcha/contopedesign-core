/**
 * La memoria de construcción: el estado del set mientras se arma.
 *
 * Reúne los insumos incorporados, las definiciones detectadas en ellos, cuáles
 * quedaron activas, cuáles se dejaron abiertas a propósito, y qué falta
 * desarrollar. El contrato de diseño es una *proyección* de esto: nunca lo
 * muta, nunca inventa autoridad, nunca convierte un aspecto `open` en una
 * tarea de desarrollar.
 *
 * SOBRE LOS NOMBRES. `EditContext` y compañía vienen del producto anterior,
 * donde describían el contexto de una edición conversacional. Acá describen
 * otra cosa: la memoria de construcción del set, en el sentido que le da la
 * taxonomía del vault («brief → referentes → mood wall → definiciones
 * operativas → conflictos → armonizaciones»). El nombre quedó porque
 * renombrar los tipos fundacionales del sistema es decisión de Cristóbal, no
 * de la IA que escribe. Está anotado como pendiente, no como olvido.
 *
 * Sólo son formas: no traen comportamiento, y nada en este paquete depende de
 * código ajeno para usarlas.
 */

export interface EditContextMaterial {
  /** Stable source identifier used by definition provenance (schema v2+). */
  id?: string | undefined;
  /** Workspace-relative path to the source material. */
  path: string;
  /** MIME type of the material (e.g. "image/png"). */
  type: string;
  /** Semantic role: "wireframe", "mockup", "screenshot", "reference-image". */
  role: string;
  /** How this source entered the analysis pipeline. */
  kind?: 'image' | 'document' | 'text' | 'url' | 'asset' | 'workspace' | 'idml' | undefined;
  /** Original URL, filename, or user-facing source label. */
  locator?: string | undefined;
  /** Human-readable description of the material. */
  description?: string | undefined;
}

export interface EditContextDevelopmentTask {
  id: string;
  /** The definition this task develops (must carry `resolution: 'develop'`). */
  definitionId: string;
  state: 'active' | 'proposed' | 'resolved' | 'rejected';
  /** Definitions that constrain what this task may propose. */
  constraintDefinitionIds: string[];
  /** Definitions proposed as candidates; none auto-replaces a confirmed one. */
  candidateDefinitionIds: string[];
  /** Linked only by human acceptance of a candidate (state `resolved`). */
  resolvedDefinitionId?: string | undefined;
  /** When the person last reviewed this task (accept/reject). */
  reviewedAt?: string | undefined;
}

export interface EditContextDefinition {
  /** Stable identifier for this definition (e.g. "color-palette"). */
  id: string;
  /** Category: "color", "typography", "layout", "spacing", "border", "shadow", "iconography",
   *  "theme-mode", or "layout-width". */
  category: string;
  /** Human-readable label shown in the UI. */
  label: string;
  /** Structured value object — shape depends on category. */
  value: Record<string, unknown>;
  /** Original analyzer output, retained when the user supplies a replacement. */
  detectedValue?: Record<string, unknown> | undefined;
  /** Explicit replacement supplied by the user. Never generated implicitly. */
  overrideValue?: Record<string, unknown> | undefined;
  /** User decision for this variable (schema v2+; `develop` requires v3). */
  resolution?: 'preserve' | 'replace' | 'open' | 'develop' | undefined;
  /** What gives this variable authority; proposals must not become confirmed silently. */
  authority?:
    | 'confirmed'
    | 'proposal'
    | 'inferred'
    | 'fact'
    | 'restriction'
    | 'unknown'
    | undefined;
  /** Publication/use guard derived from the source material. */
  usage?: 'approved' | 'confirm-before-use' | 'private' | undefined;
  /** Detection confidence: "high", "medium", or "low". */
  confidence: 'high' | 'medium' | 'low';
  /** Provenance of this definition: "wireframe-analysis" or "manual-override". */
  source: string;
  /** Brief description of what visual evidence supports this definition. */
  evidence?: string | undefined;
  /** Traceable evidence supporting the detection. */
  provenance?:
    | Array<{
        materialId: string;
        locator?: string | undefined;
        excerpt?: string | undefined;
      }>
    | undefined;
  /** Deliverables or contexts to which this variable applies. */
  appliesTo?: string[] | undefined;
}

export interface EditContext {
  /** Schema version for forward-compatibility. */
  schemaVersion: 1 | 2 | 3;
  /** Source materials used for analysis. */
  materials: EditContextMaterial[];
  /** All definitions detected (active, open, and develop). */
  detected: EditContextDefinition[];
  /** IDs of definitions the user kept active (binding constraints). */
  active: string[];
  /** IDs of definitions the user explicitly left open. */
  open: string[];
  /** Explicit develop tasks (schema v3 only; v1/v2 never carry tasks). */
  developmentTasks?: EditContextDevelopmentTask[] | undefined;
  /** ISO-8601 timestamp of when the analysis was generated. */
  generatedAt: string;
}

