import { type DesignContractV1, parseDesignContract } from './design-contract.js';
import { renderDesignContractDesignMd } from './design-contract-design-md.js';

/**
 * The payload inside the optional `.ocdsite` `designModel` entrypoint.
 *
 * This is deliberately a contribution to a future site package, rather than a
 * site package exporter. Desktop has no authoritative WordPress content or
 * theme graph, so manufacturing the required `content` and `theme` entrypoints
 * here would create a structurally valid but semantically dishonest package.
 */
export const PORTABLE_DESIGN_MODEL_SCHEMA_VERSION = 1;
export const PORTABLE_DESIGN_MODEL_KIND = 'contope/design-model';
export const PORTABLE_DESIGN_MODEL_PATH = 'design/model.json';
export const PORTABLE_DESIGN_MD_PATH = 'design/DESIGN.md';

export interface PortableDesignModelTransport {
  package: {
    /** The enclosing `.ocdsite` package revision, never a Desktop design id. */
    id: string;
    revision: string;
  };
  project: {
    /** The enclosing `.ocdsite` project association, never a WordPress slug. */
    id: string;
    name: string;
  };
}

export interface PortableDesignModelV1 {
  schemaVersion: typeof PORTABLE_DESIGN_MODEL_SCHEMA_VERSION;
  kind: typeof PORTABLE_DESIGN_MODEL_KIND;
  /** Duplicated identity makes the entrypoint cheaply inspectable. It must
   * exactly equal `contract.design`; it is not an independent identity. */
  design: DesignContractV1['design'];
  /** Links the Desktop design to the package/project identities already owned
   * by the portable package contract. */
  transport: PortableDesignModelTransport;
  provenance: {
    producer: 'contope-design-desktop';
    producerVersion: string;
    exportedAt: string;
  };
  /** Canonical reviewed source of truth, including source provenance. */
  contract: DesignContractV1;
  /** Deterministic human-readable projection of the embedded contract. A
   * preserved manual workspace DESIGN.md is represented as reviewed source
   * evidence in `contract`, never promoted by copying arbitrary Markdown. */
  designMd: {
    path: typeof PORTABLE_DESIGN_MD_PATH;
    revision: number;
    content: string;
  };
}

export interface ProjectPortableDesignModelInput {
  contract: DesignContractV1;
  transport: PortableDesignModelTransport;
  producerVersion: string;
  exportedAt: string;
}

export interface PortableDesignPackageContributionV1 {
  /** This exact path becomes `manifest.entrypoints.designModel` when a site
   * packager owns the complete content/theme manifest. */
  entrypointPath: typeof PORTABLE_DESIGN_MODEL_PATH;
  model: PortableDesignModelV1;
  files: Array<{
    path: typeof PORTABLE_DESIGN_MODEL_PATH | typeof PORTABLE_DESIGN_MD_PATH;
    role: 'design-model' | 'other';
    mediaType: 'application/json' | 'text/markdown';
    content: string;
  }>;
}

const PACKAGE_ID_RE = /^urn:ocd:package:[A-Za-z0-9._-]+$/u;
const PROJECT_ID_RE = /^urn:ocd:project:[A-Za-z0-9._-]+$/u;
const VERSION_RE = /^[0-9]+(?:\.[0-9]+){0,3}(?:[-+][A-Za-z0-9._-]+)?$/u;
const RFC3339_DATE_TIME_RE =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/u;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasExactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const actual = Object.keys(value);
  return actual.length === keys.length && actual.every((key) => keys.includes(key));
}

function isNonEmptyString(value: unknown, maxLength?: number): value is string {
  return (
    typeof value === 'string' &&
    value.trim().length > 0 &&
    (maxLength === undefined || value.length <= maxLength)
  );
}

function isDateTime(value: unknown): value is string {
  return (
    isNonEmptyString(value) && RFC3339_DATE_TIME_RE.test(value) && !Number.isNaN(Date.parse(value))
  );
}

function parseTransport(value: unknown): PortableDesignModelTransport | null {
  if (!isRecord(value) || !hasExactKeys(value, ['package', 'project'])) return null;
  if (!isRecord(value['package']) || !isRecord(value['project'])) return null;
  const packageValue = value['package'];
  const projectValue = value['project'];
  if (
    !hasExactKeys(packageValue, ['id', 'revision']) ||
    !hasExactKeys(projectValue, ['id', 'name']) ||
    !isNonEmptyString(packageValue['id']) ||
    !PACKAGE_ID_RE.test(packageValue['id']) ||
    !isNonEmptyString(packageValue['revision'], 128) ||
    !isNonEmptyString(projectValue['id']) ||
    !PROJECT_ID_RE.test(projectValue['id']) ||
    !isNonEmptyString(projectValue['name'], 200)
  ) {
    return null;
  }
  return {
    package: { id: packageValue['id'], revision: packageValue['revision'] },
    project: { id: projectValue['id'], name: projectValue['name'] },
  };
}

function parseProvenance(value: unknown): PortableDesignModelV1['provenance'] | null {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, ['producer', 'producerVersion', 'exportedAt']) ||
    value['producer'] !== 'contope-design-desktop' ||
    !isNonEmptyString(value['producerVersion'], 40) ||
    !VERSION_RE.test(value['producerVersion']) ||
    !isDateTime(value['exportedAt'])
  ) {
    return null;
  }
  return {
    producer: 'contope-design-desktop',
    producerVersion: value['producerVersion'],
    exportedAt: value['exportedAt'],
  };
}

function sameDesign(
  value: unknown,
  contract: DesignContractV1,
): value is DesignContractV1['design'] {
  return (
    isRecord(value) &&
    hasExactKeys(value, ['id', 'revision', 'createdAt', 'updatedAt']) &&
    value['id'] === contract.design.id &&
    value['revision'] === contract.design.revision &&
    value['createdAt'] === contract.design.createdAt &&
    value['updatedAt'] === contract.design.updatedAt
  );
}

function cloneContract(contract: DesignContractV1): DesignContractV1 | null {
  try {
    return parseDesignContract(JSON.parse(JSON.stringify(contract)) as unknown);
  } catch {
    return null;
  }
}

/**
 * Projects the canonical reviewed contract into a portable `designModel`.
 *
 * It is pure: no workspace file, database record, package manifest, or ZIP is
 * written here. The caller must explicitly provide the portable package and
 * project identities, which prevents Desktop from silently inventing either.
 */
export function projectPortableDesignModel(
  input: ProjectPortableDesignModelInput,
): PortableDesignModelV1 {
  const contract = cloneContract(input.contract);
  const transport = parseTransport(input.transport);
  const provenance = parseProvenance({
    producer: 'contope-design-desktop',
    producerVersion: input.producerVersion,
    exportedAt: input.exportedAt,
  });
  if (contract === null || transport === null || provenance === null) {
    throw new Error('Portable design model input is invalid');
  }
  const content = renderDesignContractDesignMd(contract);
  return {
    schemaVersion: PORTABLE_DESIGN_MODEL_SCHEMA_VERSION,
    kind: PORTABLE_DESIGN_MODEL_KIND,
    design: { ...contract.design },
    transport,
    provenance,
    contract,
    designMd: {
      path: PORTABLE_DESIGN_MD_PATH,
      revision: contract.design.revision,
      content,
    },
  };
}

/** Strict parser for a `design/model.json` contribution from a portable site
 * package. It verifies that the duplicated identity and DESIGN.md projection
 * still match the embedded canonical contract. */
export function parsePortableDesignModel(value: unknown): PortableDesignModelV1 | null {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, [
      'schemaVersion',
      'kind',
      'design',
      'transport',
      'provenance',
      'contract',
      'designMd',
    ]) ||
    value['schemaVersion'] !== PORTABLE_DESIGN_MODEL_SCHEMA_VERSION ||
    value['kind'] !== PORTABLE_DESIGN_MODEL_KIND
  ) {
    return null;
  }
  const contract = parseDesignContract(value['contract']);
  const transport = parseTransport(value['transport']);
  const provenance = parseProvenance(value['provenance']);
  if (
    contract === null ||
    transport === null ||
    provenance === null ||
    !sameDesign(value['design'], contract) ||
    !isRecord(value['designMd']) ||
    !hasExactKeys(value['designMd'], ['path', 'revision', 'content']) ||
    value['designMd']['path'] !== PORTABLE_DESIGN_MD_PATH ||
    value['designMd']['revision'] !== contract.design.revision ||
    typeof value['designMd']['content'] !== 'string' ||
    value['designMd']['content'] !== renderDesignContractDesignMd(contract)
  ) {
    return null;
  }
  return {
    schemaVersion: PORTABLE_DESIGN_MODEL_SCHEMA_VERSION,
    kind: PORTABLE_DESIGN_MODEL_KIND,
    design: { ...contract.design },
    transport,
    provenance,
    contract,
    designMd: {
      path: PORTABLE_DESIGN_MD_PATH,
      revision: contract.design.revision,
      content: value['designMd']['content'],
    },
  };
}

/** Serializes only a valid model with stable field ordering and a trailing
 * newline, ready for the future `.ocdsite` packager to hash and inventory. */
export function serializePortableDesignModel(model: PortableDesignModelV1): string {
  const parsed = parsePortableDesignModel(model);
  if (parsed === null) throw new Error('Portable design model is invalid');
  return `${JSON.stringify(parsed, null, 2)}\n`;
}

/**
 * Produces exactly the two Desktop-owned payload files for an eventual
 * `.ocdsite`. A site packager supplies required content/theme files, calculates
 * byte hashes/sizes, and writes the outer manifest/ZIP; this function never
 * claims to have done those jobs.
 */
export function createPortableDesignPackageContribution(
  input: ProjectPortableDesignModelInput,
): PortableDesignPackageContributionV1 {
  const model = projectPortableDesignModel(input);
  return {
    entrypointPath: PORTABLE_DESIGN_MODEL_PATH,
    model,
    files: [
      {
        path: PORTABLE_DESIGN_MODEL_PATH,
        role: 'design-model',
        mediaType: 'application/json',
        content: serializePortableDesignModel(model),
      },
      {
        path: PORTABLE_DESIGN_MD_PATH,
        role: 'other',
        mediaType: 'text/markdown',
        content: model.designMd.content,
      },
    ],
  };
}
