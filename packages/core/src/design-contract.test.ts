import { describe, expect, it } from 'vitest';
import {
  CONTRACT_USER_SOURCE_ID,
  type DesignContractV1,
  type ProjectDesignContractInput,
  parseDesignContract,
  projectDesignContract,
} from './design-contract.js';
import {
  renderDesignContractDesignMd,
  stampDesignMdProjection,
} from './design-contract-design-md.js';
import type { EditContext } from './index.js';

function v2Context(overrides: Partial<EditContext> = {}): EditContext {
  return {
    schemaVersion: 2,
    materials: [
      {
        id: 'brief',
        path: '.codesign/sources/brief.txt',
        type: 'text/plain',
        role: 'text',
        kind: 'text',
        locator: 'Project brief',
        description: 'Project brief',
      },
    ],
    detected: [
      {
        id: 'hero-typeface',
        category: 'typography',
        label: 'Hero typeface',
        value: { family: 'Lora' },
        detectedValue: { family: 'Lora' },
        resolution: 'preserve',
        authority: 'confirmed',
        usage: 'approved',
        confidence: 'high',
        source: 'ai-analysis',
        evidence: 'Brief section 1',
        provenance: [
          { materialId: 'brief', locator: 'section 1' },
          {
            materialId: CONTRACT_USER_SOURCE_ID,
            excerpt: 'Confirmed in the design decision checklist',
          },
        ],
      },
    ],
    active: ['hero-typeface'],
    open: [],
    generatedAt: '2026-08-02T00:00:00.000Z',
    ...overrides,
  };
}

function v3Context(): EditContext {
  const base = v2Context();
  return {
    ...base,
    schemaVersion: 3,
    detected: [
      ...base.detected,
      {
        id: 'body-font-gap',
        category: 'typography',
        label: 'Body font',
        value: { status: 'unspecified' },
        detectedValue: { status: 'unspecified' },
        resolution: 'develop',
        authority: 'unknown',
        usage: 'confirm-before-use',
        confidence: 'low',
        source: 'ai-analysis-gap',
        provenance: [{ materialId: 'brief' }],
      },
    ],
    developmentTasks: [
      {
        id: 'develop-body-font',
        definitionId: 'body-font-gap',
        state: 'active',
        constraintDefinitionIds: ['hero-typeface'],
        candidateDefinitionIds: [],
      },
    ],
  };
}

function head<T>(items: T[]): T {
  const [first] = items;
  if (first === undefined) throw new Error('fixture produced no items');
  return first;
}

describe('parseDesignContract', () => {
  it('round-trips a projected contract through serialize/parse', () => {
    const contract = projectDesignContract({
      designId: '11111111-1111-4111-8111-111111111111',
      editContext: v2Context(),
      roundSources: [
        { id: 'brief', technicalKind: 'text', purpose: 'guideline', label: 'Project brief' },
      ],
      previousContract: null,
    });
    const parsed = parseDesignContract(JSON.parse(JSON.stringify(contract)));
    expect(parsed).not.toBeNull();
    expect(parsed).toEqual(contract);
    // Valid human provenance under the reserved `'user'` id stays acceptable;
    // only its use as evidence is rejected (invalidShapes below).
    expect(parsed?.definitions[0]?.provenance).toContainEqual(
      expect.objectContaining({ sourceId: CONTRACT_USER_SOURCE_ID }),
    );
  });

  it('accepts a contract carrying a well-formed development task', () => {
    const base = projectDesignContract({
      designId: 'd1',
      editContext: v2Context(),
      roundSources: [],
      previousContract: null,
    });
    const withTask: DesignContractV1 = {
      ...base,
      definitions: [
        ...base.definitions,
        {
          id: 'color-palette',
          category: 'color',
          name: 'Color palette',
          value: { status: 'unspecified' },
          state: 'observed',
          authority: 'model-proposal',
          evidenceSourceIds: ['brief'],
          provenance: [{ sourceId: 'brief' }],
          constraintDefinitionIds: ['hero-typeface'],
        },
      ],
      developmentTasks: [
        {
          id: 'task-1',
          definitionId: 'color-palette',
          state: 'active',
          constraintDefinitionIds: ['hero-typeface'],
          candidateDefinitionIds: [],
        },
      ],
    };
    expect(parseDesignContract(JSON.parse(JSON.stringify(withTask)))).toEqual(withTask);
  });

  it('rejects incoherent development task candidate lifecycles', () => {
    const base = projectDesignContract({
      designId: 'd1',
      editContext: v2Context(),
      roundSources: [],
      previousContract: null,
    });
    const withTask: DesignContractV1 = {
      ...base,
      developmentTasks: [
        {
          id: 'task-1',
          definitionId: 'hero-typeface',
          state: 'active',
          constraintDefinitionIds: [],
          candidateDefinitionIds: [],
        },
      ],
    };
    const task = head(withTask.developmentTasks);

    expect(
      parseDesignContract({
        ...withTask,
        developmentTasks: [{ ...task, state: 'proposed' }],
      }),
    ).toBeNull();
    expect(
      parseDesignContract({
        ...withTask,
        developmentTasks: [
          {
            ...task,
            state: 'resolved',
            resolvedDefinitionId: 'hero-typeface',
          },
        ],
      }),
    ).toBeNull();
  });

  it('accepts a stamped designMd projection', () => {
    const base = projectDesignContract({
      designId: 'd1',
      editContext: v2Context(),
      roundSources: [],
      previousContract: null,
    });
    const stamped: DesignContractV1 = {
      ...base,
      projections: {
        designMd: { path: 'DESIGN.md', revision: 3, generatedAt: base.design.updatedAt },
      },
    };
    expect(parseDesignContract(JSON.parse(JSON.stringify(stamped)))).toEqual(stamped);
  });

  const invalidShapes: Array<[string, (contract: DesignContractV1) => unknown]> = [
    ['schemaVersion 2', (contract) => ({ ...contract, schemaVersion: 2 })],
    ['missing design', (contract) => ({ ...contract, design: undefined })],
    ['zero revision', (contract) => ({ ...contract, design: { ...contract.design, revision: 0 } })],
    [
      'fractional revision',
      (contract) => ({ ...contract, design: { ...contract.design, revision: 1.5 } }),
    ],
    [
      'non-ISO createdAt',
      (contract) => ({ ...contract, design: { ...contract.design, createdAt: 'yesterday' } }),
    ],
    ['empty design id', (contract) => ({ ...contract, design: { ...contract.design, id: '' } })],
    [
      'invalid purpose',
      (contract) => ({
        ...contract,
        sources: [{ ...head(contract.sources), purpose: 'normative' }],
      }),
    ],
    [
      'duplicate source ids',
      (contract) => ({
        ...contract,
        sources: [...contract.sources, { ...head(contract.sources) }],
      }),
    ],
    [
      "reserved 'user' source id",
      (contract) => ({
        ...contract,
        sources: [{ ...head(contract.sources), id: CONTRACT_USER_SOURCE_ID }],
      }),
    ],
    [
      'invalid authority',
      (contract) => ({
        ...contract,
        definitions: [{ ...head(contract.definitions), authority: 'divine-revelation' }],
      }),
    ],
    [
      'invalid definition state',
      (contract) => ({
        ...contract,
        definitions: [{ ...head(contract.definitions), state: 'binding' }],
      }),
    ],
    [
      'duplicate definition ids',
      (contract) => ({
        ...contract,
        definitions: [...contract.definitions, { ...head(contract.definitions) }],
      }),
    ],
    [
      'evidence source outside sources',
      (contract) => ({
        ...contract,
        definitions: [{ ...head(contract.definitions), evidenceSourceIds: ['ghost'] }],
      }),
    ],
    [
      "reserved 'user' id in evidenceSourceIds",
      (contract) => ({
        ...contract,
        definitions: [
          { ...head(contract.definitions), evidenceSourceIds: [CONTRACT_USER_SOURCE_ID] },
        ],
      }),
    ],
    [
      'provenance source outside sources',
      (contract) => ({
        ...contract,
        definitions: [{ ...head(contract.definitions), provenance: [{ sourceId: 'ghost' }] }],
      }),
    ],
    [
      'constraint references missing definition',
      (contract) => ({
        ...contract,
        definitions: [{ ...head(contract.definitions), constraintDefinitionIds: ['ghost'] }],
      }),
    ],
    [
      'development task with dangling definitionId',
      (contract) => ({
        ...contract,
        developmentTasks: [
          {
            id: 'task-1',
            definitionId: 'ghost',
            state: 'active',
            constraintDefinitionIds: [],
            candidateDefinitionIds: [],
          },
        ],
      }),
    ],
    [
      'designMd projection with wrong path',
      (contract) => ({
        ...contract,
        projections: {
          designMd: { path: 'design.md', revision: 1, generatedAt: contract.design.updatedAt },
        },
      }),
    ],
  ];

  it.each(invalidShapes)('rejects %s', (_name, mutate) => {
    const contract = projectDesignContract({
      designId: 'd1',
      editContext: v2Context(),
      roundSources: [],
      previousContract: null,
    });
    expect(parseDesignContract(JSON.parse(JSON.stringify(mutate(contract))))).toBeNull();
  });

  it('rejects non-object input', () => {
    expect(parseDesignContract(null)).toBeNull();
    expect(parseDesignContract('contract')).toBeNull();
    expect(parseDesignContract([1])).toBeNull();
  });
});

describe('projectDesignContract', () => {
  const designId = '11111111-1111-4111-8111-111111111111';

  it('maps the EditContext authority/resolution matrix onto contract tiers', () => {
    const context = v2Context({
      materials: [
        {
          id: 'm',
          path: 'references/m.png',
          type: 'image/png',
          role: 'image',
          kind: 'image',
          locator: 'm.png',
          description: 'm.png',
        },
      ],
      detected: [
        {
          id: 'preserved-confirmed',
          category: 'typography',
          label: 'Kept',
          value: { family: 'Lora' },
          resolution: 'preserve',
          authority: 'confirmed',
          usage: 'approved',
          confidence: 'high',
          source: 'ai-analysis',
          provenance: [{ materialId: 'm' }],
        },
        {
          id: 'replaced',
          category: 'color',
          label: 'Replaced',
          value: { primary: '#0057B8' },
          detectedValue: { primary: '#0057B8' },
          overrideValue: { primary: '#0A7FFE' },
          resolution: 'replace',
          authority: 'confirmed',
          usage: 'approved',
          confidence: 'high',
          source: 'manual-override',
          provenance: [{ materialId: 'm' }, { materialId: CONTRACT_USER_SOURCE_ID }],
        },
        {
          id: 'idml-fact',
          category: 'typography',
          label: 'IDML style',
          value: { family: 'Minion Pro' },
          resolution: 'preserve',
          authority: 'fact',
          usage: 'approved',
          confidence: 'high',
          source: 'idml-extraction',
          provenance: [{ materialId: 'm', locator: 'Styles/ParagraphStyle.xml' }],
        },
        {
          id: 'legal-restriction',
          category: 'iconography',
          label: 'Logo guard',
          value: { rule: 'logo needs 24px clearance' },
          resolution: 'preserve',
          authority: 'restriction',
          usage: 'confirm-before-use',
          confidence: 'medium',
          source: 'ai-analysis',
          provenance: [{ materialId: 'm' }],
        },
        {
          id: 'open-inferred',
          category: 'color',
          label: 'Inferred palette',
          value: { primary: '#333333' },
          resolution: 'open',
          authority: 'inferred',
          usage: 'confirm-before-use',
          confidence: 'low',
          source: 'ai-analysis',
          provenance: [{ materialId: 'm' }],
        },
        {
          id: 'open-gap',
          category: 'border',
          label: 'Radius gap',
          value: { status: 'unspecified' },
          detectedValue: { status: 'unspecified' },
          resolution: 'open',
          authority: 'unknown',
          usage: 'confirm-before-use',
          confidence: 'low',
          source: 'ai-analysis-gap',
          evidence: 'No radius evidence found',
          provenance: [{ materialId: 'm' }],
        },
      ],
      active: ['preserved-confirmed', 'replaced', 'idml-fact', 'legal-restriction'],
      open: ['open-inferred', 'open-gap'],
    });

    const contract = projectDesignContract({
      designId,
      editContext: context,
      roundSources: [{ id: 'm', technicalKind: 'image', purpose: 'observation', label: 'm.png' }],
      previousContract: null,
    });

    const byId = new Map(contract.definitions.map((definition) => [definition.id, definition]));
    expect(byId.get('preserved-confirmed')).toMatchObject({
      state: 'confirmed',
      authority: 'human-confirmed',
      value: { family: 'Lora' },
      reviewedAt: '2026-08-02T00:00:00.000Z',
    });
    expect(byId.get('replaced')).toMatchObject({
      state: 'confirmed',
      authority: 'human-confirmed',
      value: { primary: '#0A7FFE' },
      supersededValue: { primary: '#0057B8' },
    });
    expect(byId.get('idml-fact')).toMatchObject({
      state: 'confirmed',
      authority: 'deterministic-extraction',
    });
    expect(byId.get('legal-restriction')).toMatchObject({
      state: 'confirmed',
      authority: 'deterministic-extraction',
    });
    expect(byId.get('open-inferred')).toMatchObject({
      state: 'proposed',
      authority: 'model-proposal',
    });
    expect(byId.get('open-inferred')).not.toHaveProperty('reviewedAt');
    expect(byId.get('open-gap')).toMatchObject({ state: 'observed', authority: 'model-proposal' });
    // `user` provenance stays traceable but never becomes evidence.
    expect(byId.get('replaced')?.evidenceSourceIds).toEqual(['m']);
    expect(byId.get('replaced')?.provenance).toEqual([
      { sourceId: 'm' },
      { sourceId: CONTRACT_USER_SOURCE_ID },
    ]);
    // `open` never manufactures a `desarrollar` task.
    expect(contract.developmentTasks).toEqual([]);
  });

  it('records the explicit purpose of the round and derives legacy materials to observation', () => {
    const context = v2Context({
      materials: [
        {
          id: 'manual',
          path: '.codesign/sources/manual.txt',
          type: 'text/plain',
          role: 'text',
          kind: 'text',
          locator: 'manual.txt',
          description: 'manual.txt',
        },
        {
          id: 'legacy',
          path: '.codesign/sources/legacy.txt',
          type: 'text/plain',
          role: 'text',
          kind: 'text',
          locator: 'legacy.txt',
          description: 'legacy.txt',
        },
      ],
    });
    const contract = projectDesignContract({
      designId,
      editContext: context,
      roundSources: [
        { id: 'manual', technicalKind: 'text', purpose: 'guideline', label: 'manual.txt' },
      ],
      previousContract: null,
    });
    expect(contract.sources).toEqual([
      expect.objectContaining({ id: 'manual', purpose: 'guideline', technicalKind: 'text' }),
      expect.objectContaining({ id: 'legacy', purpose: 'observation' }),
    ]);
  });

  it('projects explicit v3 development tasks while preserving the no-open-inference rule', () => {
    const context = v3Context();
    const contract = projectDesignContract({
      designId,
      editContext: context,
      roundSources: [
        { id: 'brief', technicalKind: 'text', purpose: 'guideline', label: 'Project brief' },
      ],
      previousContract: null,
    });

    expect(contract.developmentTasks).toEqual(context.developmentTasks);
    expect(parseDesignContract(contract)).toEqual(contract);
  });

  it("keeps the reserved 'user' id as human provenance, never a source", () => {
    const context = v2Context({
      materials: [
        {
          id: CONTRACT_USER_SOURCE_ID,
          path: '.codesign/sources/user.txt',
          type: 'text/plain',
          role: 'text',
          kind: 'text',
        },
      ],
      detected: v2Context().detected.map((definition) => ({
        ...definition,
        provenance: [
          {
            materialId: CONTRACT_USER_SOURCE_ID,
            excerpt: 'Confirmed in the design decision checklist',
          },
        ],
      })),
    });
    const contract = projectDesignContract({
      designId,
      editContext: context,
      roundSources: [
        {
          id: CONTRACT_USER_SOURCE_ID,
          technicalKind: 'text',
          purpose: 'guideline',
          label: 'User source',
        },
      ],
      previousContract: null,
    });

    expect(contract.sources).toEqual([]);
    expect(contract.definitions[0]?.provenance).toContainEqual({
      sourceId: CONTRACT_USER_SOURCE_ID,
      excerpt: 'Confirmed in the design decision checklist',
    });
    expect(parseDesignContract(contract)).toEqual(contract);
  });

  it('continues a same-design lineage: revision increments, purposes and createdAt survive', () => {
    const first = projectDesignContract({
      designId,
      editContext: v2Context(),
      roundSources: [
        { id: 'brief', technicalKind: 'text', purpose: 'guideline', label: 'Project brief' },
      ],
      previousContract: null,
    });

    const roundTwo = v2Context({
      materials: [
        ...v2Context().materials,
        {
          id: 'notes',
          path: '.codesign/sources/notes.txt',
          type: 'text/plain',
          role: 'text',
          kind: 'text',
          locator: 'Follow-up notes',
          description: 'Follow-up notes',
        },
      ],
      detected: [
        ...v2Context().detected.map((definition) => ({
          ...definition,
          value: { family: 'Inter' },
          overrideValue: { family: 'Inter' },
          detectedValue: { family: 'Lora' },
          resolution: 'replace' as const,
          source: 'manual-override',
        })),
      ],
      generatedAt: '2026-08-03T00:00:00.000Z',
    });
    const second = projectDesignContract({
      designId,
      editContext: roundTwo,
      roundSources: [
        { id: 'notes', technicalKind: 'text', purpose: 'observation', label: 'Follow-up notes' },
      ],
      previousContract: first,
    });

    expect(second.design.revision).toBe(2);
    expect(second.design.createdAt).toBe(first.design.createdAt);
    expect(second.design.updatedAt).toBe('2026-08-03T00:00:00.000Z');
    // The round-1 source keeps its recorded guideline purpose even though
    // round 2 never mentions it.
    expect(second.sources.find((source) => source.id === 'brief')).toMatchObject({
      purpose: 'guideline',
      importedAt: '2026-08-02T00:00:00.000Z',
    });
    expect(second.sources.find((source) => source.id === 'notes')).toMatchObject({
      purpose: 'observation',
      importedAt: '2026-08-03T00:00:00.000Z',
    });
    expect(
      second.definitions.find((definition) => definition.id === 'hero-typeface'),
    ).toMatchObject({
      value: { family: 'Inter' },
      supersededValue: { family: 'Lora' },
    });
  });

  it('starts a fresh lineage when the previous contract belongs to another design', () => {
    const other = projectDesignContract({
      designId: '22222222-2222-4222-8222-222222222222',
      editContext: v2Context(),
      roundSources: [],
      previousContract: null,
    });
    const contract = projectDesignContract({
      designId,
      editContext: v2Context(),
      roundSources: [],
      previousContract: { ...other, design: { ...other.design, revision: 7 } },
    });
    expect(contract.design).toMatchObject({ id: designId, revision: 1 });
  });

  it('drops provenance that dangles past the known sources', () => {
    const context = v2Context({
      detected: [
        {
          ...head(v2Context().detected),
          provenance: [{ materialId: 'ghost' }, { materialId: 'brief' }],
        },
      ],
    });
    const contract = projectDesignContract({
      designId,
      editContext: context,
      roundSources: [],
      previousContract: null,
    });
    expect(contract.definitions[0]?.evidenceSourceIds).toEqual(['brief']);
    expect(contract.definitions[0]?.provenance).toEqual([{ sourceId: 'brief' }]);
  });

  it('projects a schema-v1 context without ids, resolution, or authority', () => {
    const contract = projectDesignContract({
      designId,
      editContext: {
        schemaVersion: 1,
        materials: [{ path: 'placeholder', type: 'image/png', role: 'wireframe' }],
        detected: [
          {
            id: 'layout',
            category: 'layout',
            label: 'Layout',
            value: { columns: 3 },
            confidence: 'high',
            source: 'wireframe-analysis',
          },
        ],
        active: ['layout'],
        open: [],
        generatedAt: '2026-08-01T00:00:00.000Z',
      },
      roundSources: [],
      previousContract: null,
    });
    expect(contract.sources).toEqual([]);
    expect(contract.definitions).toEqual([
      {
        id: 'layout',
        category: 'layout',
        name: 'Layout',
        value: { columns: 3 },
        state: 'confirmed',
        authority: 'model-proposal',
        evidenceSourceIds: [],
        provenance: [],
        constraintDefinitionIds: [],
        reviewedAt: '2026-08-01T00:00:00.000Z',
      },
    ]);
  });

  it('is deterministic: identical inputs produce identical contracts', async () => {
    const input: ProjectDesignContractInput = {
      designId,
      editContext: v2Context(),
      roundSources: [
        { id: 'brief', technicalKind: 'text', purpose: 'guideline', label: 'Project brief' },
      ],
      previousContract: null,
    };
    const a = projectDesignContract(input);
    const b = projectDesignContract(input);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(a).toEqual(b);
  });

  it('emits no designMd projection stamp', () => {
    const contract = projectDesignContract({
      designId,
      editContext: v2Context(),
      roundSources: [],
      previousContract: null,
    });
    expect(contract.projections.designMd).toBeNull();
  });
});

describe('DESIGN.md contract projection', () => {
  function projectedContract(): DesignContractV1 {
    return projectDesignContract({
      designId: '11111111-1111-4111-8111-111111111111',
      editContext: v3Context(),
      roundSources: [
        { id: 'brief', technicalKind: 'text', purpose: 'guideline', label: 'Project brief' },
      ],
      previousContract: null,
    });
  }

  it('renders a deterministic Google-compatible human projection', () => {
    const contract = projectedContract();
    const markdown = renderDesignContractDesignMd(contract);

    // NOTA: acá había una comprobación de que el Markdown resultante pasa el
    // validador de DESIGN.md (frontmatter compatible con Google). Ese validador
    // son 396 líneas heredadas del producto anterior, y traerlas devolvería la
    // obligación de atribuir a un repositorio hecho justamente para no tenerla.
    // La compatibilidad de formato se sigue verificando en el repositorio
    // Contope-Design, que sí lo tiene. Lo que se comprueba acá abajo
    // --estructura, secciones, determinismo, que no se repita texto de fuentes
    // no confiables-- es lo que le toca a este código.
    expect(markdown).toContain('## Overview');
    expect(markdown).toContain('## Typography');
    expect(markdown).toContain('## Pending Decisions');
    expect(markdown).toContain('## Development Tasks');
    expect(markdown).toContain('State: "confirmed"');
    expect(markdown).toContain('State: "active"');
    expect(markdown).toContain('"family": "Lora"');
    // Provenance excerpts can be untrusted source material. The projection
    // points to source ids but does not replay source text as instructions.
    expect(markdown).not.toContain('Confirmed in the design decision checklist');

    const shuffled: DesignContractV1 = {
      ...contract,
      sources: [...contract.sources].reverse(),
      definitions: [...contract.definitions].reverse(),
      developmentTasks: [...contract.developmentTasks].reverse(),
    };
    expect(renderDesignContractDesignMd(shuffled)).toBe(markdown);
  });

  it('uses a fence that cannot be closed by a structured value', () => {
    const contract = projectedContract();
    const withBackticks: DesignContractV1 = {
      ...contract,
      definitions: contract.definitions.map((definition) =>
        definition.id === 'hero-typeface'
          ? { ...definition, value: { note: '```not a markdown fence' } }
          : definition,
      ),
    };

    const markdown = renderDesignContractDesignMd(withBackticks);

    // El cerco que abre el bloque debe ser MÁS LARGO que cualquier racha de
    // acentos graves que haya adentro; si no, el valor lo cierra antes de
    // tiempo y el resto del documento se rompe. Antes esto lo comprobaba el
    // validador de DESIGN.md heredado; medirlo directamente es más fuerte,
    // porque no depende de que el validador conozca este caso.
    const cerco = /^(`{3,})json$/m.exec(markdown);
    expect(cerco).not.toBeNull();
    const largoDelCerco = cerco![1]!.length;
    const rachaMasLargaAdentro = Math.max(
      0,
      ...[...markdown.matchAll(/`+/g)]
        .map((m) => m[0].length)
        .filter((n) => n !== largoDelCerco),
    );
    expect(largoDelCerco).toBeGreaterThan(rachaMasLargaAdentro);
    expect(markdown).toContain('````json');
  });

  it('stamps only the published contract revision without mutating its input', () => {
    const contract = projectedContract();
    const stamped = stampDesignMdProjection(contract);

    expect(contract.projections.designMd).toBeNull();
    expect(stamped.projections.designMd).toEqual({
      path: 'DESIGN.md',
      revision: contract.design.revision,
      generatedAt: contract.design.updatedAt,
    });
    expect(parseDesignContract(stamped)).toEqual(stamped);
  });
});
