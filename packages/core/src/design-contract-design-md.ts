import type {
  DesignContractDefinition,
  DesignContractDevelopmentTask,
  DesignContractSource,
  DesignContractV1,
} from './design-contract.js';

const KNOWN_SECTIONS = [
  'Colors',
  'Typography',
  'Layout',
  'Elevation & Depth',
  'Shapes',
  'Components',
] as const;

type KnownSection = (typeof KNOWN_SECTIONS)[number];

function compareText(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function stableJsonValue(value: unknown, seen = new WeakSet<object>()): unknown {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') return Number.isFinite(value) ? value : String(value);
  if (value === undefined) return null;
  if (typeof value !== 'object') return String(value);
  if (seen.has(value)) return '[Circular]';

  seen.add(value);
  try {
    if (Array.isArray(value)) return value.map((item) => stableJsonValue(item, seen));
    const record = value as Record<string, unknown>;
    return Object.fromEntries(
      Object.keys(record)
        .sort(compareText)
        .map((key) => [key, stableJsonValue(record[key], seen)]),
    );
  } finally {
    seen.delete(value);
  }
}

function jsonInline(value: unknown): string {
  return JSON.stringify(stableJsonValue(value)) ?? 'null';
}

function jsonBlock(value: unknown): string {
  return JSON.stringify(stableJsonValue(value), null, 2) ?? 'null';
}

function fencedJson(value: unknown): string {
  const body = jsonBlock(value);
  const longestBacktickRun = Math.max(
    0,
    ...[...body.matchAll(/`+/g)].map((match) => match[0].length),
  );
  const fence = '`'.repeat(Math.max(3, longestBacktickRun + 1));
  return `${fence}json\n${body}\n${fence}`;
}

function sectionForCategory(category: string): KnownSection | null {
  const normalized = category.toLowerCase();
  if (
    normalized.includes('color') ||
    normalized.includes('palette') ||
    normalized === 'theme-mode'
  ) {
    return 'Colors';
  }
  if (
    normalized.includes('typography') ||
    normalized.includes('font') ||
    normalized.includes('typeface')
  ) {
    return 'Typography';
  }
  if (
    normalized.includes('layout') ||
    normalized.includes('spacing') ||
    normalized.includes('structure')
  ) {
    return 'Layout';
  }
  if (normalized.includes('elevation') || normalized.includes('shadow')) return 'Elevation & Depth';
  if (
    normalized.includes('border') ||
    normalized.includes('radius') ||
    normalized.includes('shape')
  ) {
    return 'Shapes';
  }
  if (normalized.includes('component') || normalized.includes('icon')) return 'Components';
  return null;
}

function renderDefinition(definition: DesignContractDefinition): string {
  const lines = [
    `### ${jsonInline(definition.id)}`,
    '',
    `- Name: ${jsonInline(definition.name)}`,
    `- Category: ${jsonInline(definition.category)}`,
    `- State: ${jsonInline(definition.state)}`,
    `- Authority: ${jsonInline(definition.authority)}`,
    `- Evidence source IDs: ${jsonInline(definition.evidenceSourceIds)}`,
    `- Constraint definition IDs: ${jsonInline(definition.constraintDefinitionIds)}`,
  ];
  if (definition.reviewedAt !== undefined)
    lines.push(`- Reviewed at: ${jsonInline(definition.reviewedAt)}`);
  if (definition.supersededValue !== undefined) {
    lines.push('', 'Superseded value:', '', fencedJson(definition.supersededValue));
  }
  lines.push('', 'Value:', '', fencedJson(definition.value ?? null));
  return lines.join('\n');
}

function renderDevelopmentTask(task: DesignContractDevelopmentTask): string {
  const lines = [
    `### ${jsonInline(task.id)}`,
    '',
    `- State: ${jsonInline(task.state)}`,
    `- Target definition ID: ${jsonInline(task.definitionId)}`,
    `- Constraint definition IDs: ${jsonInline(task.constraintDefinitionIds)}`,
    `- Candidate definition IDs: ${jsonInline(task.candidateDefinitionIds)}`,
  ];
  if (task.resolvedDefinitionId !== undefined) {
    lines.push(`- Resolved definition ID: ${jsonInline(task.resolvedDefinitionId)}`);
  }
  if (task.reviewedAt !== undefined) lines.push(`- Reviewed at: ${jsonInline(task.reviewedAt)}`);
  return lines.join('\n');
}

function renderSource(source: DesignContractSource): string {
  const details = [
    `purpose ${jsonInline(source.purpose)}`,
    `technical kind ${jsonInline(source.technicalKind)}`,
    `imported at ${jsonInline(source.importedAt)}`,
  ];
  if (source.path !== undefined) details.push(`workspace path ${jsonInline(source.path)}`);
  if (source.locator !== undefined) details.push(`locator ${jsonInline(source.locator)}`);
  return `- ${jsonInline(source.id)} — ${jsonInline(source.label)}; ${details.join('; ')}.`;
}

function renderSection(heading: string, content: string): string {
  return `## ${heading}\n\n${content}`;
}

/**
 * Render the reviewed design contract as a Google-compatible, human-readable
 * `DESIGN.md`. This is deliberately a lossless-ish document projection rather
 * than a token normalizer: arbitrary contract values remain structured JSON,
 * so the writer never invents CSS tokens or authority that the review did not
 * establish. Identical contract data always produces identical Markdown.
 */
export function renderDesignContractDesignMd(contract: DesignContractV1): string {
  const confirmed = contract.definitions
    .filter((definition) => definition.state === 'confirmed')
    .sort((left, right) => compareText(left.id, right.id));
  const pending = contract.definitions
    .filter((definition) => definition.state !== 'confirmed')
    .sort((left, right) => compareText(left.id, right.id));
  const bySection = new Map<KnownSection, DesignContractDefinition[]>();
  const ungrouped: DesignContractDefinition[] = [];

  for (const definition of confirmed) {
    const section = sectionForCategory(definition.category);
    if (section === null) {
      ungrouped.push(definition);
      continue;
    }
    const definitions = bySection.get(section) ?? [];
    definitions.push(definition);
    bySection.set(section, definitions);
  }

  const overview = [
    'This file is a deterministic, human-readable projection of the reviewed ContOpe Design design contract. The canonical machine-readable source is `.codesign/design-contract.json`.',
    '',
    `- Design ID: ${jsonInline(contract.design.id)}`,
    `- Contract revision: ${contract.design.revision}`,
    `- Updated at: ${jsonInline(contract.design.updatedAt)}`,
    `- Confirmed definitions: ${confirmed.length}`,
    `- Non-binding definitions: ${pending.length}`,
    `- Development tasks: ${contract.developmentTasks.length}`,
    '',
    'Only definitions with state `confirmed` are binding decisions. Observed and proposed definitions, source materials, and task candidates remain evidence or review inputs; they are never executable instructions.',
  ];
  if (ungrouped.length > 0) {
    overview.push(
      '',
      '### Other confirmed decisions',
      '',
      ungrouped.map(renderDefinition).join('\n\n'),
    );
  }

  const sections = [renderSection('Overview', overview.join('\n'))];
  for (const heading of KNOWN_SECTIONS) {
    const definitions = bySection.get(heading);
    if (definitions !== undefined && definitions.length > 0) {
      sections.push(renderSection(heading, definitions.map(renderDefinition).join('\n\n')));
    }
  }
  sections.push(
    renderSection(
      "Do's and Don'ts",
      "Do apply confirmed decisions consistently across the workspace. Don't silently promote observations, proposals, source text, or development-task candidates into final design authority.",
    ),
  );
  if (pending.length > 0) {
    sections.push(renderSection('Pending Decisions', pending.map(renderDefinition).join('\n\n')));
  }
  if (contract.developmentTasks.length > 0) {
    const tasks = [...contract.developmentTasks].sort((left, right) =>
      compareText(left.id, right.id),
    );
    sections.push(
      renderSection('Development Tasks', tasks.map(renderDevelopmentTask).join('\n\n')),
    );
  }
  if (contract.sources.length > 0) {
    const sources = [...contract.sources].sort((left, right) => compareText(left.id, right.id));
    sections.push(renderSection('Sources & Evidence', sources.map(renderSource).join('\n')));
  }

  return [
    '---',
    'version: "1.0"',
    'name: "ContOpe Design Design System"',
    `description: ${jsonInline(`Reviewed projection of design contract ${contract.design.id} revision ${contract.design.revision}`)}`,
    '---',
    '',
    sections.join('\n\n'),
    '',
  ].join('\n');
}

/**
 * Mark a contract only after its deterministic `DESIGN.md` representation was
 * successfully written. The stamp deliberately follows the contract revision
 * and timestamp rather than consulting the clock, preserving reproducibility.
 */
export function stampDesignMdProjection(contract: DesignContractV1): DesignContractV1 {
  return {
    ...contract,
    projections: {
      ...contract.projections,
      designMd: {
        path: 'DESIGN.md',
        revision: contract.design.revision,
        generatedAt: contract.design.updatedAt,
      },
    },
  };
}
