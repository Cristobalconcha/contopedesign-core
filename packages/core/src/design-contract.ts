import type { EditContext, EditContextDefinition } from './memoria-de-construccion.js';

/**
 * Design Contract v1 — the canonical, portable design-system recipe a
 * workspace exports for skills and builders (`.codesign/design-contract.json`).
 *
 * The contract is a *projection* of the reviewed `EditContext`: it never
 * mutates the context, never invents authority, and never turns an `open`
 * aspect into a `desarrollar` task. Explicit schema-v3 development tasks are
 * projected verbatim; v1/v2 contexts project no tasks because they cannot
 * carry any. It is deliberately independent from WorkContext
 * (artifact-generation state), wireframes/regions, and any builder/MCP
 * concern.
 */

export const DESIGN_CONTRACT_SCHEMA_VERSION = 1;

/** Why a source may be used. Never inferred from content — only recorded. */
export type ContractSourcePurpose = 'observation' | 'guideline';

/** Precedence order: human-confirmed > approved-guideline >
 *  deterministic-extraction > model-proposal. */
export type ContractAuthority =
  | 'human-confirmed'
  | 'approved-guideline'
  | 'deterministic-extraction'
  | 'model-proposal';

export type ContractDefinitionState = 'observed' | 'proposed' | 'confirmed' | 'rejected';

export type ContractDevelopmentState = 'active' | 'proposed' | 'resolved' | 'rejected';

export interface DesignContractSource {
  id: string;
  /** How the material entered the pipeline (idml, image, css, html, url, text...). */
  technicalKind: string;
  purpose: ContractSourcePurpose;
  label: string;
  /** Original URL, filename, or user-facing source label. */
  locator?: string | undefined;
  /** Workspace-relative path of the evidence file, when one exists. */
  path?: string | undefined;
  importedAt: string;
}

export interface DesignContractProvenanceEntry {
  /** A contract source id, or the reserved `'user'` for human decisions. */
  sourceId: string;
  locator?: string | undefined;
  excerpt?: string | undefined;
}

export interface DesignContractDefinition {
  id: string;
  category: string;
  name: string;
  value?: unknown;
  /** The reviewed-away value when a human replaced a detected one. */
  supersededValue?: unknown;
  state: ContractDefinitionState;
  authority: ContractAuthority;
  /** Source ids backing this definition (never the reserved `'user'`). */
  evidenceSourceIds: string[];
  /** Traceable evidence; `'user'` entries record explicit human decisions. */
  provenance: DesignContractProvenanceEntry[];
  /** Definitions that constrain this one. Empty until definition linking exists. */
  constraintDefinitionIds: string[];
  reviewedAt?: string | undefined;
}

export interface DesignContractDevelopmentTask {
  id: string;
  definitionId: string;
  state: ContractDevelopmentState;
  constraintDefinitionIds: string[];
  candidateDefinitionIds: string[];
  resolvedDefinitionId?: string | undefined;
  reviewedAt?: string | undefined;
}

export interface DesignContractV1 {
  schemaVersion: typeof DESIGN_CONTRACT_SCHEMA_VERSION;
  design: {
    /** Stable opaque id of the Desktop design that owns the workspace. */
    id: string;
    revision: number;
    createdAt: string;
    updatedAt: string;
  };
  sources: DesignContractSource[];
  definitions: DesignContractDefinition[];
  developmentTasks: DesignContractDevelopmentTask[];
  projections: {
    /** `DESIGN.md` projection stamp, or null until Desktop successfully
     *  publishes it (or preserves a manual Markdown file). */
    designMd: { path: 'DESIGN.md'; revision: number; generatedAt: string } | null;
  };
}

/** Reserved provenance sourceId for manual human decisions (matches the
 *  EditContext `materialId: 'user'` convention). */
export const CONTRACT_USER_SOURCE_ID = 'user';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const nonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0;
const isIsoDateString = (value: unknown): value is string =>
  nonEmptyString(value) && !Number.isNaN(Date.parse(value));

const AUTHORITY_VALUES = new Set<string>([
  'human-confirmed',
  'approved-guideline',
  'deterministic-extraction',
  'model-proposal',
]);
const DEFINITION_STATE_VALUES = new Set<string>(['observed', 'proposed', 'confirmed', 'rejected']);
const DEVELOPMENT_STATE_VALUES = new Set<string>(['active', 'proposed', 'resolved', 'rejected']);
const PURPOSE_VALUES = new Set<string>(['observation', 'guideline']);

function parseSource(value: unknown): DesignContractSource | null {
  if (
    !isRecord(value) ||
    !nonEmptyString(value['id']) ||
    !nonEmptyString(value['technicalKind']) ||
    !nonEmptyString(value['label']) ||
    !PURPOSE_VALUES.has(String(value['purpose'])) ||
    !isIsoDateString(value['importedAt'])
  )
    return null;
  if (value['locator'] !== undefined && !nonEmptyString(value['locator'])) return null;
  if (value['path'] !== undefined && !nonEmptyString(value['path'])) return null;
  return {
    id: value['id'],
    technicalKind: value['technicalKind'],
    purpose: value['purpose'] as ContractSourcePurpose,
    label: value['label'],
    ...(value['locator'] !== undefined ? { locator: value['locator'] } : {}),
    ...(value['path'] !== undefined ? { path: value['path'] } : {}),
    importedAt: value['importedAt'],
  };
}

function parseProvenanceEntry(value: unknown): DesignContractProvenanceEntry | null {
  if (!isRecord(value) || !nonEmptyString(value['sourceId'])) return null;
  if (value['locator'] !== undefined && !nonEmptyString(value['locator'])) return null;
  if (value['excerpt'] !== undefined && !nonEmptyString(value['excerpt'])) return null;
  return {
    sourceId: value['sourceId'],
    ...(value['locator'] !== undefined ? { locator: value['locator'] } : {}),
    ...(value['excerpt'] !== undefined ? { excerpt: value['excerpt'] } : {}),
  };
}

function parseDefinition(value: unknown): DesignContractDefinition | null {
  if (
    !isRecord(value) ||
    !nonEmptyString(value['id']) ||
    !nonEmptyString(value['category']) ||
    !nonEmptyString(value['name']) ||
    !AUTHORITY_VALUES.has(String(value['authority'])) ||
    !DEFINITION_STATE_VALUES.has(String(value['state'])) ||
    !Array.isArray(value['evidenceSourceIds']) ||
    !value['evidenceSourceIds'].every(nonEmptyString) ||
    !Array.isArray(value['provenance']) ||
    !Array.isArray(value['constraintDefinitionIds']) ||
    !value['constraintDefinitionIds'].every(nonEmptyString)
  )
    return null;
  const provenance = value['provenance'].map(parseProvenanceEntry);
  if (provenance.some((entry) => entry === null)) return null;
  if (value['reviewedAt'] !== undefined && !isIsoDateString(value['reviewedAt'])) return null;
  return {
    id: value['id'],
    category: value['category'],
    name: value['name'],
    ...(value['value'] !== undefined ? { value: value['value'] } : {}),
    ...(value['supersededValue'] !== undefined
      ? { supersededValue: value['supersededValue'] }
      : {}),
    state: value['state'] as ContractDefinitionState,
    authority: value['authority'] as ContractAuthority,
    evidenceSourceIds: [...(value['evidenceSourceIds'] as string[])],
    provenance: provenance as DesignContractProvenanceEntry[],
    constraintDefinitionIds: [...(value['constraintDefinitionIds'] as string[])],
    ...(value['reviewedAt'] !== undefined ? { reviewedAt: value['reviewedAt'] } : {}),
  };
}

function parseDevelopmentTask(
  value: unknown,
  definitionIds: ReadonlySet<string>,
): DesignContractDevelopmentTask | null {
  if (
    !isRecord(value) ||
    !nonEmptyString(value['id']) ||
    !nonEmptyString(value['definitionId']) ||
    !DEVELOPMENT_STATE_VALUES.has(String(value['state'])) ||
    !Array.isArray(value['constraintDefinitionIds']) ||
    !value['constraintDefinitionIds'].every(nonEmptyString) ||
    !Array.isArray(value['candidateDefinitionIds']) ||
    !value['candidateDefinitionIds'].every(nonEmptyString)
  )
    return null;
  if (value['resolvedDefinitionId'] !== undefined && !nonEmptyString(value['resolvedDefinitionId']))
    return null;
  if (value['reviewedAt'] !== undefined && !isIsoDateString(value['reviewedAt'])) return null;
  if (
    (value['state'] === 'resolved') !== (value['resolvedDefinitionId'] !== undefined) ||
    new Set(value['constraintDefinitionIds'] as string[]).size !==
      (value['constraintDefinitionIds'] as string[]).length ||
    new Set(value['candidateDefinitionIds'] as string[]).size !==
      (value['candidateDefinitionIds'] as string[]).length
  )
    return null;
  const candidateDefinitionIds = value['candidateDefinitionIds'] as string[];
  const resolvedDefinitionId = value['resolvedDefinitionId'] as string | undefined;
  if (value['state'] === 'proposed' && candidateDefinitionIds.length === 0) return null;
  if (value['state'] === 'resolved' && !candidateDefinitionIds.includes(resolvedDefinitionId ?? ''))
    return null;
  const references = [
    value['definitionId'],
    ...(value['constraintDefinitionIds'] as string[]),
    ...candidateDefinitionIds,
    ...(resolvedDefinitionId !== undefined ? [resolvedDefinitionId] : []),
  ];
  if (references.some((id) => !definitionIds.has(id))) return null;
  return {
    id: value['id'],
    definitionId: value['definitionId'],
    state: value['state'] as ContractDevelopmentState,
    constraintDefinitionIds: [...(value['constraintDefinitionIds'] as string[])],
    candidateDefinitionIds: [...candidateDefinitionIds],
    ...(resolvedDefinitionId !== undefined ? { resolvedDefinitionId } : {}),
    ...(value['reviewedAt'] !== undefined ? { reviewedAt: value['reviewedAt'] } : {}),
  };
}

/**
 * Parse and validate a persisted design contract. Returns `null` for any
 * missing, malformed, or schema-invalid value so callers can gate on data
 * they can trust — the same contract as `parseEditContext`.
 */
export function parseDesignContract(value: unknown): DesignContractV1 | null {
  if (!isRecord(value) || value['schemaVersion'] !== DESIGN_CONTRACT_SCHEMA_VERSION) return null;
  const design = value['design'];
  if (
    !isRecord(design) ||
    !nonEmptyString(design['id']) ||
    !Number.isInteger(design['revision']) ||
    (design['revision'] as number) < 1 ||
    !isIsoDateString(design['createdAt']) ||
    !isIsoDateString(design['updatedAt'])
  )
    return null;
  if (!Array.isArray(value['sources']) || !Array.isArray(value['definitions'])) return null;
  const sources = value['sources'].map(parseSource);
  const definitions = value['definitions'].map(parseDefinition);
  if (sources.some((item) => item === null) || definitions.some((item) => item === null))
    return null;
  const parsedSources = sources as DesignContractSource[];
  const parsedDefinitions = definitions as DesignContractDefinition[];
  if (new Set(parsedSources.map((source) => source.id)).size !== parsedSources.length) return null;
  if (parsedSources.some((source) => source.id === CONTRACT_USER_SOURCE_ID)) return null;
  if (
    new Set(parsedDefinitions.map((definition) => definition.id)).size !== parsedDefinitions.length
  )
    return null;

  const sourceIds = new Set(parsedSources.map((source) => source.id));
  // The reserved `'user'` id is valid only in provenance, where it records
  // human decisions. evidenceSourceIds must reference declared sources and can
  // never carry `'user'` — matching the projector, which filters it out.
  const provenanceSourceIds = new Set(sourceIds);
  provenanceSourceIds.add(CONTRACT_USER_SOURCE_ID);
  if (
    parsedDefinitions.some(
      (definition) =>
        definition.evidenceSourceIds.some(
          (id) => id === CONTRACT_USER_SOURCE_ID || !sourceIds.has(id),
        ) ||
        definition.provenance.some((entry) => !provenanceSourceIds.has(entry.sourceId)) ||
        definition.constraintDefinitionIds.some(
          (id) => !parsedDefinitions.some((candidate) => candidate.id === id),
        ),
    )
  )
    return null;

  if (!Array.isArray(value['developmentTasks'])) return null;
  const definitionIds = new Set(parsedDefinitions.map((definition) => definition.id));
  const tasks = value['developmentTasks'].map((task) => parseDevelopmentTask(task, definitionIds));
  if (tasks.some((item) => item === null)) return null;
  const parsedTasks = tasks as DesignContractDevelopmentTask[];
  if (new Set(parsedTasks.map((task) => task.id)).size !== parsedTasks.length) return null;

  const projections = value['projections'];
  if (!isRecord(projections)) return null;
  const designMd = projections['designMd'];
  if (designMd !== null) {
    if (
      !isRecord(designMd) ||
      designMd['path'] !== 'DESIGN.md' ||
      !Number.isInteger(designMd['revision']) ||
      (designMd['revision'] as number) < 1 ||
      !isIsoDateString(designMd['generatedAt'])
    )
      return null;
  }

  return {
    schemaVersion: DESIGN_CONTRACT_SCHEMA_VERSION,
    design: {
      id: design['id'],
      revision: design['revision'] as number,
      createdAt: design['createdAt'],
      updatedAt: design['updatedAt'],
    },
    sources: parsedSources,
    definitions: parsedDefinitions,
    developmentTasks: parsedTasks,
    projections: {
      designMd:
        designMd === null
          ? null
          : {
              path: 'DESIGN.md',
              revision: designMd['revision'] as number,
              generatedAt: designMd['generatedAt'] as string,
            },
    },
  };
}

/** A source as supplied by the current review round, with its explicit purpose. */
export interface ContractRoundSource {
  id: string;
  technicalKind: string;
  purpose: ContractSourcePurpose;
  label: string;
  locator?: string | undefined;
  path?: string | undefined;
}

/** EditContext authority → contract authority tier. */
const AUTHORITY_PROJECTION: Record<
  NonNullable<EditContextDefinition['authority']>,
  ContractAuthority
> = {
  confirmed: 'human-confirmed',
  fact: 'deterministic-extraction',
  // A restriction is an evidence-backed guard (legal, privacy, editorial),
  // not free model invention — it must outrank later model proposals.
  restriction: 'deterministic-extraction',
  inferred: 'model-proposal',
  proposal: 'model-proposal',
  unknown: 'model-proposal',
};

function projectAuthority(authority: EditContextDefinition['authority']): ContractAuthority {
  // Undefined authority only occurs in schema-v1 contexts; treat it as the
  // weakest tier rather than inventing certainty.
  return authority === undefined ? 'model-proposal' : AUTHORITY_PROJECTION[authority];
}

function projectState(
  definition: EditContextDefinition,
  isActive: boolean,
): ContractDefinitionState {
  if (isActive) {
    // Membership in `active` means the definition survived the review
    // checklist as a binding decision.
    return 'confirmed';
  }
  if (definition.source === 'ai-analysis-gap') return 'observed';
  return definition.authority === undefined ||
    definition.authority === 'proposal' ||
    definition.authority === 'unknown' ||
    definition.authority === 'inferred'
    ? 'proposed'
    : 'observed';
}

export interface ProjectDesignContractInput {
  designId: string;
  /** The merged, persisted EditContext this contract projects. */
  editContext: EditContext;
  /** Sources supplied by the current round, carrying the explicit purpose
   *  introduced for analysis payloads (`observation` when absent/legacy). */
  roundSources: ContractRoundSource[];
  /** The previous persisted contract, when one exists for this design. */
  previousContract: DesignContractV1 | null;
}

/**
 * Project a reviewed `EditContext` into the canonical Design Contract v1.
 *
 * Deterministic: identical inputs produce an identical contract (timestamps
 * come from the context, never from the clock). Guarantees:
 *
 * - a previous contract for the *same* design continues its lineage
 *   (revision + 1, preserved `createdAt`, preserved earlier-round sources
 *   and their recorded purposes); a contract for a different design starts
 *   a fresh lineage, mirroring how a shared workspace's edit-context behaves;
 * - sources absent from every round input derive to `purpose: 'observation'`;
 * - `open` aspects are never converted into `developmentTasks` — `open`
 *   stays non-binding and `desarrollar` tasks exist only as the explicit
 *   schema-v3 tasks the context already carries;
 * - `projections.designMd` stays `null` here because this pure context
 *   projection does not write files; the Desktop publisher stamps it only
 *   after the matching DESIGN.md has been written successfully.
 */
export function projectDesignContract(input: ProjectDesignContractInput): DesignContractV1 {
  const previous =
    input.previousContract !== null && input.previousContract.design.id === input.designId
      ? input.previousContract
      : null;
  const context = input.editContext;
  const roundById = new Map(input.roundSources.map((source) => [source.id, source]));
  const previousSourcesById = new Map(
    previous?.sources.map((source) => [source.id, source] as const) ?? [],
  );

  const sources: DesignContractSource[] = [];
  const seenSourceIds = new Set<string>();
  for (const material of context.materials) {
    // `user` is a synthetic provenance id for human review decisions, never a
    // source material. Skipping it keeps this pure projector sound even when
    // called with a context that predates the IPC boundary's reserved-id check.
    if (material.id === undefined || material.id === CONTRACT_USER_SOURCE_ID) continue;
    const round = roundById.get(material.id);
    const prior = previousSourcesById.get(material.id);
    const base = round ?? {
      id: material.id,
      technicalKind: material.kind ?? prior?.technicalKind ?? 'unknown',
      // Legacy materials carry no purpose: derive to observation.
      purpose: prior?.purpose ?? 'observation',
      label: prior?.label ?? material.description ?? material.locator ?? material.id,
      locator: material.locator,
      path: material.path,
    };
    sources.push({
      id: material.id,
      technicalKind: material.kind ?? base.technicalKind,
      purpose: base.purpose,
      label: round?.label ?? prior?.label ?? base.label,
      ...(base.locator !== undefined ? { locator: base.locator } : {}),
      ...(material.path !== undefined && material.path.length > 0 ? { path: material.path } : {}),
      importedAt: prior?.importedAt ?? context.generatedAt,
    });
    seenSourceIds.add(material.id);
  }
  // Earlier-round sources whose materials somehow left the context keep their
  // recorded entry so recorded purposes are never silently dropped.
  for (const prior of previous?.sources ?? []) {
    if (prior.id !== CONTRACT_USER_SOURCE_ID && !seenSourceIds.has(prior.id)) {
      sources.push(prior);
      seenSourceIds.add(prior.id);
    }
  }
  const knownSourceIds = new Set<string>(seenSourceIds);
  knownSourceIds.add(CONTRACT_USER_SOURCE_ID);

  const activeIds = new Set(context.active);
  const definitions: DesignContractDefinition[] = context.detected.map((definition) => {
    const isActive = activeIds.has(definition.id);
    const provenance = (definition.provenance ?? [])
      .filter((entry) => knownSourceIds.has(entry.materialId))
      .map((entry) => ({
        sourceId: entry.materialId,
        ...(entry.locator !== undefined ? { locator: entry.locator } : {}),
        ...(entry.excerpt !== undefined ? { excerpt: entry.excerpt } : {}),
      }));
    const evidenceSourceIds = [
      ...new Set(
        provenance.map((entry) => entry.sourceId).filter((id) => id !== CONTRACT_USER_SOURCE_ID),
      ),
    ];
    const isReplace = definition.resolution === 'replace';
    const effectiveValue = isReplace ? (definition.overrideValue ?? {}) : (definition.value ?? {});
    return {
      id: definition.id,
      category: definition.category,
      name: definition.label,
      value: effectiveValue,
      ...(isReplace && definition.detectedValue !== undefined
        ? { supersededValue: definition.detectedValue }
        : {}),
      state: projectState(definition, isActive),
      authority: projectAuthority(definition.authority),
      evidenceSourceIds,
      provenance,
      constraintDefinitionIds: [],
      ...(isActive ? { reviewedAt: context.generatedAt } : {}),
    };
  });

  return {
    schemaVersion: DESIGN_CONTRACT_SCHEMA_VERSION,
    design: {
      id: input.designId,
      revision: previous === null ? 1 : previous.design.revision + 1,
      createdAt: previous?.design.createdAt ?? context.generatedAt,
      updatedAt: context.generatedAt,
    },
    sources,
    definitions,
    // Explicit schema-v3 tasks project verbatim; `open` must never become a
    // task by inference, and v1/v2 contexts carry no tasks at all.
    developmentTasks:
      context.schemaVersion === 3
        ? (context.developmentTasks ?? []).map((task) => ({
            id: task.id,
            definitionId: task.definitionId,
            state: task.state,
            constraintDefinitionIds: [...task.constraintDefinitionIds],
            candidateDefinitionIds: [...task.candidateDefinitionIds],
            ...(task.resolvedDefinitionId !== undefined
              ? { resolvedDefinitionId: task.resolvedDefinitionId }
              : {}),
            ...(task.reviewedAt !== undefined ? { reviewedAt: task.reviewedAt } : {}),
          }))
        : [],
    projections: { designMd: null },
  };
}
