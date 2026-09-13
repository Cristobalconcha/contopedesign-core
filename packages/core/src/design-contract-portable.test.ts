import { describe, expect, it } from 'vitest';
import { projectDesignContract } from './design-contract.js';
import {
  createPortableDesignPackageContribution,
  PORTABLE_DESIGN_MD_PATH,
  PORTABLE_DESIGN_MODEL_KIND,
  PORTABLE_DESIGN_MODEL_PATH,
  parsePortableDesignModel,
  projectPortableDesignModel,
  serializePortableDesignModel,
} from './design-contract-portable.js';
import type { EditContext } from './index.js';

function contractFixture() {
  const context: EditContext = {
    schemaVersion: 2,
    materials: [
      {
        id: 'manual-guideline',
        path: 'DESIGN.md',
        type: 'text/markdown',
        role: 'text',
        kind: 'workspace',
        locator: 'DESIGN.md',
        description: 'Manual design guideline',
      },
    ],
    detected: [
      {
        id: 'brand-blue',
        category: 'color',
        label: 'Brand blue',
        value: { hex: '#123456' },
        detectedValue: { hex: '#123456' },
        resolution: 'preserve',
        authority: 'confirmed',
        usage: 'approved',
        confidence: 'high',
        source: 'human-review',
        provenance: [{ materialId: 'manual-guideline', locator: 'palette' }],
      },
    ],
    active: ['brand-blue'],
    open: [],
    generatedAt: '2026-08-23T12:00:00.000Z',
  };
  return projectDesignContract({
    designId: 'desktop-design-42',
    editContext: context,
    roundSources: [
      {
        id: 'manual-guideline',
        technicalKind: 'workspace',
        purpose: 'guideline',
        label: 'DESIGN.md',
      },
    ],
    previousContract: null,
  });
}

function inputFixture() {
  return {
    contract: contractFixture(),
    transport: {
      package: { id: 'urn:ocd:package:pkg-42', revision: '2026-08-23T12:30:00Z' },
      project: { id: 'urn:ocd:project:project-42', name: 'Portable design test' },
    },
    producerVersion: '0.2.1',
    exportedAt: '2026-08-23T12:30:00.000Z',
  };
}

describe('portable design model contribution', () => {
  it('carries the reviewed contract, identity, provenance, and deterministic DESIGN.md', () => {
    const input = inputFixture();
    const contribution = createPortableDesignPackageContribution(input);

    expect(contribution.entrypointPath).toBe(PORTABLE_DESIGN_MODEL_PATH);
    expect(contribution.model.kind).toBe(PORTABLE_DESIGN_MODEL_KIND);
    expect(contribution.model.design).toEqual(input.contract.design);
    expect(contribution.model.contract).toEqual(input.contract);
    expect(contribution.model.transport).toEqual(input.transport);
    expect(contribution.model.provenance).toEqual({
      producer: 'contope-design-desktop',
      producerVersion: '0.2.1',
      exportedAt: '2026-08-23T12:30:00.000Z',
    });
    expect(contribution.model.designMd).toMatchObject({
      path: PORTABLE_DESIGN_MD_PATH,
      revision: input.contract.design.revision,
    });
    expect(contribution.model.designMd.content).toContain('Brand blue');
    expect(contribution.files).toEqual([
      expect.objectContaining({
        path: PORTABLE_DESIGN_MODEL_PATH,
        role: 'design-model',
        mediaType: 'application/json',
      }),
      expect.objectContaining({
        path: PORTABLE_DESIGN_MD_PATH,
        role: 'other',
        mediaType: 'text/markdown',
        content: contribution.model.designMd.content,
      }),
    ]);
    expect(parsePortableDesignModel(JSON.parse(contribution.files[0]?.content ?? '{}'))).toEqual(
      contribution.model,
    );
  });

  it('is deterministic and does not retain mutable references to the caller contract', () => {
    const input = inputFixture();
    const model = projectPortableDesignModel(input);
    const first = serializePortableDesignModel(model);
    const second = serializePortableDesignModel(projectPortableDesignModel(input));

    input.contract.design.id = 'caller-mutated-after-projection';
    expect(model.design.id).toBe('desktop-design-42');
    expect(first).toBe(second);
  });

  it('rejects identity drift, stale projection text, wrong URN domains, and unknown fields', () => {
    const model = projectPortableDesignModel(inputFixture());

    expect(
      parsePortableDesignModel({
        ...model,
        design: { ...model.design, revision: model.design.revision + 1 },
      }),
    ).toBeNull();
    expect(
      parsePortableDesignModel({
        ...model,
        designMd: { ...model.designMd, content: '# manually edited and stale\n' },
      }),
    ).toBeNull();
    expect(
      parsePortableDesignModel({
        ...model,
        transport: {
          ...model.transport,
          project: { ...model.transport.project, id: 'urn:ocd:package:wrong-domain' },
        },
      }),
    ).toBeNull();
    expect(parsePortableDesignModel({ ...model, extra: true })).toBeNull();
  });

  it('requires the outer package identities to be explicit and schema-compatible', () => {
    const input = inputFixture();
    expect(() =>
      projectPortableDesignModel({
        ...input,
        transport: {
          ...input.transport,
          package: { ...input.transport.package, id: 'desktop-design-42' },
        },
      }),
    ).toThrow('Portable design model input is invalid');
    expect(() =>
      projectPortableDesignModel({ ...input, producerVersion: 'not-a-version' }),
    ).toThrow('Portable design model input is invalid');
    expect(() => projectPortableDesignModel({ ...input, exportedAt: '2026-08-23' })).toThrow(
      'Portable design model input is invalid',
    );
  });
});
