import { describe, expect, it } from 'vitest';
import { evaluateManifest, evaluateRequirement } from './evaluate';
import { parseRequirementManifest } from './graph';
import { DIM1_REQUIREMENTS_V0 } from './manifest-v0-dim1';
import { CORE_ROLES_13, type DeprecationRecordV0, type DimensionId, type RectoraV0, type RequirementManifestV0, type RequirementV0 } from './types';

const emptyRectoras = (): Map<string, RectoraV0> =>
  new Map<string, RectoraV0>([
    ['descriptor', { id: 'descriptor', tagsRequeridos: [], tagsProhibidos: [], exclusiones: [] }],
    ['mood-wall', { id: 'mood-wall', tagsRequeridos: [], tagsProhibidos: [], exclusiones: [] }],
  ]);

const req01 = DIM1_REQUIREMENTS_V0[0] as RequirementV0;
const req02 = DIM1_REQUIREMENTS_V0[1] as RequirementV0;

const payloadReq01 = {
  institucionales: [{ name: 'azul', value: '#1d4ed8' }],
  neutros: [{ name: 'gris', value: '#64748b' }],
};

function minimalReq(
  id: string,
  dependsOn: string[] = [],
  estado: 'active' | 'deprecated' = 'active',
): RequirementV0 {
  return {
    id,
    dimensionId: id.slice(0, 4) as DimensionId,
    eje: 'completitud',
    pregunta: `¿Pregunta de prueba para ${id}?`,
    packageId: 'pkg.color.test',
    dependsOn,
    payloadSchema: { item: { type: { kind: 'texto' } } },
    validityPredicate: [{ kind: 'exists', target: ['item'] }],
    rectorBindings: [],
    mapsToKinds: [],
    estado,
  };
}

function manifest(
  requirements: RequirementV0[],
  deprecations?: DeprecationRecordV0[],
): RequirementManifestV0 {
  return {
    schemaVersion: 1,
    manifestVersion: '1.0',
    revision: 1,
    requirements,
    ...(deprecations !== undefined ? { deprecations } : {}),
  };
}

describe('CASO (a) — requisito resuelto', () => {
  it('dim1.req01 resuelto con payload válido y rectoras sin restricciones', () => {
    const result = evaluateRequirement({
      requisito: req01,
      payload: payloadReq01,
      store: new Map(),
      rectoras: emptyRectoras(),
    });
    expect(result.resultado).toBe('resuelto');
    expect(result.motivos).toEqual([]);
  });
});

describe('CASO (b) — requisito no-resuelto', () => {
  it('dim1.req02 no-resuelto cuando falta un rol Core, con motivo covers', () => {
    const store = new Map<string, Record<string, unknown>>([
      ['dim1.req01', payloadReq01],
    ]);
    const payload = {
      roleColors: CORE_ROLES_13.slice(0, 12).map((role, i) => ({
        role,
        color: { refReqId: 'dim1.req01', refPath: ['institucionales', 0, 'value'] },
        source: `fuente-${i}`,
        derivation: { of: 'dim1.req01' },
      })),
    };
    const result = evaluateRequirement({
      requisito: req02,
      payload,
      store,
      rectoras: emptyRectoras(),
    });
    expect(result.resultado).toBe('no-resuelto');
    expect(result.motivos.some((m) => m.codigo === 'covers-incumplido')).toBe(true);
  });

  it('payload estructuralmente inválido ⇒ no-resuelto con motivo payload-invalido', () => {
    const result = evaluateRequirement({
      requisito: req01,
      payload: { institucionales: [{ name: 'azul', value: 'red' }] },
      store: new Map(),
      rectoras: emptyRectoras(),
    });
    expect(result.resultado).toBe('no-resuelto');
    expect(result.motivos.some((m) => m.codigo === 'payload-invalido')).toBe(true);
  });

  it('dependencia no-resuelta ⇒ no-resuelto (gate §8.1); resultado ausente ⇒ fail-closed', () => {
    const custom = minimalReq('dim1.req05', ['dim1.req04']);
    const deps = new Map([['dim1.req04', { requisitoId: 'dim1.req04', resultado: 'no-resuelto' as const, motivos: [] }]]);
    const result = evaluateRequirement({
      requisito: custom,
      payload: { item: 'x' },
      store: new Map(),
      rectoras: emptyRectoras(),
      dependencyResults: deps,
    });
    expect(result.resultado).toBe('no-resuelto');
    expect(result.motivos.some((m) => m.codigo === 'dependencia-no-resuelta')).toBe(true);

    const missing = evaluateRequirement({
      requisito: custom,
      payload: { item: 'x' },
      store: new Map(),
      rectoras: emptyRectoras(),
    });
    expect(missing.motivos.some((m) => m.codigo === 'dependencia-no-evaluada')).toBe(true);
  });
});

describe('CASO (c) — ciclo ⇒ rechazo en bloque', () => {
  it('parse rechaza con el camino del ciclo y evaluateManifest no evalúa nada', () => {
    const doc = manifest([
      minimalReq('dim1.req01', ['dim1.req02']),
      minimalReq('dim1.req02', ['dim1.req01']),
    ]);
    const parsed = parseRequirementManifest(doc);
    expect(parsed.ok).toBe(false);
    expect(parsed.ciclo).toEqual(['dim1.req01', 'dim1.req02', 'dim1.req01']);
    expect(() =>
      evaluateManifest({ manifest: doc, payloads: new Map(), rectoras: emptyRectoras() }),
    ).toThrow(/rechazo en bloque/);
  });
});

describe('CASO (d) — dependencia a ID inexistente ⇒ rechazo en bloque', () => {
  it('parse rechaza con la referencia rota y evaluateManifest lanza', () => {
    const doc = manifest([minimalReq('dim1.req01'), minimalReq('dim1.req02', ['dim1.req99'])]);
    const parsed = parseRequirementManifest(doc);
    expect(parsed.ok).toBe(false);
    expect(parsed.errores.some((e) => e.codigo === 'dependencia-inexistente')).toBe(true);
    expect(() =>
      evaluateManifest({ manifest: doc, payloads: new Map(), rectoras: emptyRectoras() }),
    ).toThrow(/rechazo en bloque/);
  });
});

describe('CASO (e) — deprecado con sucesor válido', () => {
  it('el deprecado no se evalúa ni cuenta; la dimensión la resuelven los activos', () => {
    const doc = manifest(
      [minimalReq('dim1.req01', [], 'deprecated'), minimalReq('dim1.req02', [])],
      [
        {
          id: 'dim1.req01',
          autor: 'equipo contope',
          fecha: '2026-08-30',
          motivo: 'absorbido por dim1.req02',
          sucesorId: 'dim1.req02',
        },
      ],
    );
    expect(parseRequirementManifest(doc).ok).toBe(true);

    const payloads = new Map<string, unknown>([['dim1.req02', { item: 'valor' }]]);
    const evaluation = evaluateManifest({ manifest: doc, payloads, rectoras: emptyRectoras() });
    expect(evaluation.resultado).toBe('resuelto');
    expect(evaluation.contador).toEqual({ resueltos: 1, activos: 1 });
    expect(evaluation.resultados.map((r) => r.requisitoId)).toEqual(['dim1.req02']);
  });
});

describe('vía de escape requiere-veredicto-humano-registrado (§8.2)', () => {
  it('alegación difusa sin veredicto ⇒ no-resuelto con diagnóstico; con veredicto registrado ⇒ resuelto', () => {
    const base = {
      requisito: req01,
      payload: payloadReq01,
      store: new Map(),
      rectoras: emptyRectoras(),
    };
    const alleged = evaluateRequirement({
      ...base,
      diffuseAllegations: [
        { requisitoId: 'dim1.req01', motivo: 'contradicción semántica difusa alegada' },
      ],
    });
    expect(alleged.resultado).toBe('no-resuelto');
    expect(alleged.motivos.some((m) => m.codigo === 'requiere-veredicto-humano-registrado')).toBe(true);

    const verdict = evaluateRequirement({
      ...base,
      diffuseAllegations: [
        { requisitoId: 'dim1.req01', motivo: 'contradicción semántica difusa alegada' },
      ],
      humanVerdicts: [
        {
          requisitoId: 'dim1.req01',
          autor: 'z',
          fecha: '2026-08-30',
          motivo: 'revisado: no hay contradicción con la rectora',
        },
      ],
    });
    expect(verdict.resultado).toBe('resuelto');
  });
});

describe('rectorBindings implícitos (§8.2, sin cláusula noConflict explícita)', () => {
  it('el binding se evalúa contra las restricciones formales de la rectora', () => {
    const custom: RequirementV0 = {
      ...minimalReq('dim1.req06'),
      rectorBindings: ['descriptor'],
    };
    const strictRectoras = new Map<string, RectoraV0>([
      ['descriptor', { id: 'descriptor', tagsRequeridos: ['institucional'], tagsProhibidos: [], exclusiones: [] }],
    ]);
    const fail = evaluateRequirement({
      requisito: custom,
      payload: { item: 'paleta libre' },
      store: new Map(),
      rectoras: strictRectoras,
    });
    expect(fail.resultado).toBe('no-resuelto');
    expect(fail.motivos.some((m) => m.codigo === 'no-conflict-tag-ausente')).toBe(true);

    const pass = evaluateRequirement({
      requisito: custom,
      payload: { item: 'institucional' },
      store: new Map(),
      rectoras: strictRectoras,
    });
    expect(pass.resultado).toBe('resuelto');
  });
});
