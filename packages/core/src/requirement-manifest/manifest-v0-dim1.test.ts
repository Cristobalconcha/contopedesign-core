import { describe, expect, it } from 'vitest';
import { evaluateManifest } from './evaluate';
import { parseRequirementManifest } from './graph';
import { DIM1_MANIFEST_V0, DIM1_REQUIREMENTS_V0 } from './manifest-v0-dim1';
import type { PredicateClause } from './predicate';
import {
  CORE_ROLES_13,
  type RectoraV0,
  type VerificationRecordV0,
} from './types';

const emptyRectoras = (): Map<string, RectoraV0> =>
  new Map<string, RectoraV0>([
    ['descriptor', { id: 'descriptor', tagsRequeridos: [], tagsProhibidos: [], exclusiones: [] }],
    ['mood-wall', { id: 'mood-wall', tagsRequeridos: [], tagsProhibidos: [], exclusiones: [] }],
  ]);

const INTERACTIVE_ROLES = ['action', 'focus', 'active', 'inactive'] as const;
const INTERACTIVE_STATES = ['default', 'hover', 'focus', 'active'] as const;
/** Índice del rol interactivo dentro de CORE_ROLES_13 (orden cerrado de la spec §7). */
const ROLE_INDEX: Record<(typeof INTERACTIVE_ROLES)[number], number> = {
  action: 5,
  focus: 12,
  active: 10,
  inactive: 11,
};

/** Payloads que resuelven las 13 preguntas de la dimensión (fixture de test). */
function resolvedDim1Payloads(): Map<string, unknown> {
  const m = new Map<string, unknown>();
  const ref01 = (i: number) => ({ refReqId: 'dim1.req01', refPath: ['institucionales', i, 'value'] });
  const ref02 = (i: number) => ({ refReqId: 'dim1.req02', refPath: ['roleColors', i, 'color'] });

  m.set('dim1.req01', {
    institucionales: [
      { name: 'azul-institucional', value: '#1d4ed8' },
      { name: 'verde-institucional', value: '#15803d' },
    ],
    neutros: [{ name: 'gris-neutral', value: '#64748b' }],
  });

  m.set('dim1.req02', {
    roleColors: CORE_ROLES_13.map((role, i) => ({
      role,
      color: ref01(0),
      source: `paleta-institucional-${i}`,
      derivation: { of: 'dim1.req01' },
    })),
  });

  m.set('dim1.req03', {
    actionColor: {
      role: 'accent',
      source: { refReqId: 'dim1.req02', refPath: ['roleColors', 4, 'color'] },
    },
  });

  m.set('dim1.req04', {
    ramps: [
      {
        family: { refReqId: 'dim1.req01', refPath: ['institucionales', 0] },
        name: 'azul',
        scale: [
          { step: 1, value: '#1d4ed8' },
          { step: 2, value: '#3b82f6' },
        ],
      },
      {
        family: { refReqId: 'dim1.req01', refPath: ['institucionales', 1] },
        name: 'verde',
        scale: [
          { step: 1, value: '#15803d' },
          { step: 2, value: '#22c55e' },
        ],
      },
    ],
  });

  m.set('dim1.req05', {
    surfaces: [
      {
        level: 'canvas',
        backgroundColor: ref02(0),
        foregroundColor: ref02(2),
        shadow: 'md',
      },
      {
        level: 'card',
        backgroundColor: ref02(1),
        foregroundColor: ref02(2),
        borderColor: ref02(3),
        borderWidth: '1px',
      },
    ],
  });

  m.set('dim1.req06', {
    stateColors: INTERACTIVE_ROLES.flatMap((role) =>
      INTERACTIVE_STATES.map((state) => ({ role, state, color: ref02(ROLE_INDEX[role]) })),
    ),
  });

  m.set('dim1.req07', {
    contrast: {
      umbral: 4.5,
      matriz: [
        {
          fg: { refReqId: 'dim1.req02', refPath: ['roleColors', 2, 'color'] },
          bg: { refReqId: 'dim1.req02', refPath: ['roleColors', 0, 'color'] },
          ratio: 12.5,
          standard: 'WCAG AA',
        },
        {
          fg: { refReqId: 'dim1.req02', refPath: ['roleColors', 2, 'color'] },
          bg: { refReqId: 'dim1.req02', refPath: ['roleColors', 1, 'color'] },
          ratio: 9.0,
          standard: 'WCAG AA',
        },
      ],
    },
  });

  m.set('dim1.req08', {
    relations: {
      allowed: ['alpha', 'tinta'],
      prohibited: ['neón'],
      overlays: [{ color: ref02(1), opacity: 0.5 }],
      gradients: [],
    },
  });

  m.set('dim1.req09', {
    contexts: [
      {
        contextId: 'documentación',
        preponderance: [
          { role: ref02(0), weight: 0.5 },
          { role: ref02(2), weight: 0.5 },
        ],
      },
    ],
  });

  m.set('dim1.req10', {
    redundancy: [
      { meaning: 'success', nonColorCarrier: 'ícono de verificación' },
      { meaning: 'warning', nonColorCarrier: 'ícono de advertencia' },
      { meaning: 'error', nonColorCarrier: 'mensaje de texto' },
      { meaning: 'active', nonColorCarrier: 'subrayado' },
      { meaning: 'inactive', nonColorCarrier: 'opacidad reducida' },
    ],
  });

  const otherIds = DIM1_REQUIREMENTS_V0.map((r) => r.id).filter((id) => id !== 'dim1.req11');
  m.set('dim1.req11', {
    provenance: otherIds.map((id) => ({
      definition: { refReqId: id, refPath: [] },
      sources: [
        {
          kind: 'reference',
          label: 'taxonomía',
          reference: 'taxonomia-dimensiones-y-talleres-definicion-2026-08-27',
          rationale: 'procedencia declarada',
        },
      ],
      author: 'equipo contope',
      revision: 'r1',
    })),
  });

  const forceIds = DIM1_REQUIREMENTS_V0.map((r) => r.id).filter((id) => id !== 'dim1.req12');
  m.set('dim1.req12', {
    forces: forceIds.map((id) => ({
      definition: { refReqId: id, refPath: [] },
      force: id === 'dim1.req01' ? 'inamovible' : 'explorable',
    })),
  });

  m.set('dim1.req13', {
    primaryConsumers: [
      { role: 'primary', consumer: 'button tone=primary vía var(--cod-color-accent)' },
    ],
  });

  return m;
}

const VERIFICATIONS = new Map<string, VerificationRecordV0>([
  [
    'contrast-matrix',
    {
      pruebaId: 'contrast-matrix',
      fecha: '2026-08-30',
      evidencia: 'matriz de contraste auditada contra WCAG',
    },
  ],
]);

describe('manifiesto v0 de Dimensión 1 — fidelidad al fixture §7', () => {
  it('el documento parsea limpio (grafo acíclico, IDs estables, sin brechas silenciosas)', () => {
    const result = parseRequirementManifest(DIM1_MANIFEST_V0);
    expect(result.ok).toBe(true);
  });

  it('contiene los 13 requisitos: dim1.req01..req12 de la fixture §7 + I5 como dim1.req13', () => {
    expect(DIM1_REQUIREMENTS_V0.map((r) => r.id)).toEqual([
      'dim1.req01',
      'dim1.req02',
      'dim1.req03',
      'dim1.req04',
      'dim1.req05',
      'dim1.req06',
      'dim1.req07',
      'dim1.req08',
      'dim1.req09',
      'dim1.req10',
      'dim1.req11',
      'dim1.req12',
      'dim1.req13',
    ]);
  });

  it('respeta dependsOn y ejes del fixture', () => {
    const byId = new Map(DIM1_REQUIREMENTS_V0.map((r) => [r.id, r]));
    expect(byId.get('dim1.req01')?.dependsOn).toEqual([]);
    expect(byId.get('dim1.req02')?.dependsOn).toEqual(['dim1.req01']);
    expect(byId.get('dim1.req03')?.dependsOn).toEqual(['dim1.req02']);
    expect(byId.get('dim1.req07')?.dependsOn).toEqual(['dim1.req02', 'dim1.req05', 'dim1.req06']);
    expect(byId.get('dim1.req09')?.dependsOn).toEqual(['dim1.req02', 'dim1.req05', 'dim1.req08']);
    expect(byId.get('dim1.req12')?.dependsOn).toEqual(['dim1.req02', 'dim1.req04', 'dim1.req05']);
    expect(byId.get('dim1.req13')?.dependsOn).toEqual(['dim1.req02']);
    expect(byId.get('dim1.req01')?.eje).toBe('completitud');
    expect(byId.get('dim1.req11')?.eje).toBe('ciclo-de-vida');
    expect(byId.get('dim1.req12')?.eje).toBe('fuerza');
    expect(byId.get('dim1.req13')?.eje).toBe('coherencia');
  });

  it('declara las 5 brechas de mapeo vacías y la parcial de req08 (nunca silenciosas)', () => {
    const empties = DIM1_REQUIREMENTS_V0.filter((r) => r.mapsToKinds.length === 0);
    expect(empties.map((r) => r.id)).toEqual([
      'dim1.req07',
      'dim1.req09',
      'dim1.req10',
      'dim1.req11',
      'dim1.req12',
    ]);
    for (const req of empties) {
      expect(req.mappingNotes, req.id).toBeDefined();
      expect(req.mappingNotes?.length, req.id).toBeGreaterThan(0);
    }
    const req08 = DIM1_REQUIREMENTS_V0.find((r) => r.id === 'dim1.req08');
    expect(req08?.mapsToKinds).toHaveLength(1);
    expect(req08?.mappingNotes).toBeDefined();
  });

  it('CERO PROSA: la serialización es el dato (round-trip JSON) y cada cláusula es del union conocido', () => {
    const roundTripped = JSON.parse(JSON.stringify(DIM1_MANIFEST_V0));
    expect(roundTripped).toEqual(DIM1_MANIFEST_V0);

    const KNOWN_CLAUSE_KINDS = new Set([
      'exists',
      'singleton',
      'covers',
      'each',
      'some',
      'everyPar',
      'and',
      'or',
      'not',
      'compare',
      'reference',
      'validCss',
      'verified',
      'noConflict',
      'eachIn',
      'someIn',
      'everyDef',
      'containsNoneOf',
    ]);
    const visit = (clause: PredicateClause): void => {
      expect(KNOWN_CLAUSE_KINDS.has(clause.kind), clause.kind).toBe(true);
      switch (clause.kind) {
        case 'and':
        case 'or':
          clause.clauses.forEach(visit);
          return;
        case 'not':
          visit(clause.clause);
          return;
        case 'each':
        case 'some':
        case 'everyPar':
        case 'eachIn':
        case 'someIn':
        case 'everyDef':
          visit(clause.condition);
          return;
        default:
          return;
      }
    };
    for (const req of DIM1_REQUIREMENTS_V0) {
      for (const clause of req.validityPredicate) visit(clause);
    }
  });
});

describe('evaluación de la Dimensión 1 completa', () => {
  it('dimensión resuelta cuando las 13 preguntas tienen definición efectiva válida', () => {
    const evaluation = evaluateManifest({
      manifest: DIM1_MANIFEST_V0,
      payloads: resolvedDim1Payloads(),
      rectoras: emptyRectoras(),
      verifications: VERIFICATIONS,
    });
    expect(evaluation.resultado).toBe('resuelto');
    expect(evaluation.contador).toEqual({ resueltos: 13, activos: 13 });
    expect(evaluation.resultados.every((r) => r.resultado === 'resuelto')).toBe(true);
  });

  it('AND estricto (§8.1.2): un solo requisito no-resuelto tumba la dimensión (12/13 es diagnóstico)', () => {
    const payloads = resolvedDim1Payloads();
    payloads.set('dim1.req13', { primaryConsumers: [{ role: 'primary' }] }); // sin consumer
    const evaluation = evaluateManifest({
      manifest: DIM1_MANIFEST_V0,
      payloads,
      rectoras: emptyRectoras(),
      verifications: VERIFICATIONS,
    });
    expect(evaluation.resultado).toBe('no-resuelto');
    expect(evaluation.contador).toEqual({ resueltos: 12, activos: 13 });
    const req13 = evaluation.resultados.find((r) => r.requisitoId === 'dim1.req13');
    expect(req13?.resultado).toBe('no-resuelto');
  });

  it('cada uno de los 5 predicados en prosa formalizados responde al dato', () => {
    // req02 "deriva de": sin derivation.of = dim1.req01 y sin rule ⇒ no-resuelto.
    const broken02 = resolvedDim1Payloads();
    const roleColors = broken02.get('dim1.req02') as { roleColors: Array<Record<string, unknown>> };
    roleColors.roleColors = roleColors.roleColors.map((entry) => ({ ...entry, derivation: { of: 'direct' } }));
    let evaluation = evaluateManifest({
      manifest: DIM1_MANIFEST_V0,
      payloads: broken02,
      rectoras: emptyRectoras(),
      verifications: VERIFICATIONS,
    });
    expect(evaluation.resultados.find((r) => r.requisitoId === 'dim1.req02')?.resultado).toBe(
      'no-resuelto',
    );
    expect(evaluation.resultado).toBe('no-resuelto');

    // req04 "every familia con rampa": quitar una rampa ⇒ no-resuelto.
    const broken04 = resolvedDim1Payloads();
    const ramps = broken04.get('dim1.req04') as { ramps: unknown[] };
    ramps.ramps = ramps.ramps.slice(0, 1);
    evaluation = evaluateManifest({
      manifest: DIM1_MANIFEST_V0,
      payloads: broken04,
      rectoras: emptyRectoras(),
      verifications: VERIFICATIONS,
    });
    expect(evaluation.resultados.find((r) => r.requisitoId === 'dim1.req04')?.resultado).toBe(
      'no-resuelto',
    );

    // req08 "ninguna definición viola prohibited": colar el literal prohibido ⇒ no-resuelto.
    const broken08 = resolvedDim1Payloads();
    const surfaces = broken08.get('dim1.req05') as { surfaces: Array<Record<string, unknown>> };
    surfaces.surfaces[0] = { ...(surfaces.surfaces[0] ?? {}), level: 'canvas-neón' };
    evaluation = evaluateManifest({
      manifest: DIM1_MANIFEST_V0,
      payloads: broken08,
      rectoras: emptyRectoras(),
      verifications: VERIFICATIONS,
    });
    expect(evaluation.resultados.find((r) => r.requisitoId === 'dim1.req08')?.resultado).toBe(
      'no-resuelto',
    );

    // req11 "every definición con procedencia": quitar una entrada ⇒ no-resuelto.
    const broken11 = resolvedDim1Payloads();
    const provenance = broken11.get('dim1.req11') as { provenance: unknown[] };
    provenance.provenance = provenance.provenance.slice(0, 5);
    evaluation = evaluateManifest({
      manifest: DIM1_MANIFEST_V0,
      payloads: broken11,
      rectoras: emptyRectoras(),
      verifications: VERIFICATIONS,
    });
    expect(evaluation.resultados.find((r) => r.requisitoId === 'dim1.req11')?.resultado).toBe(
      'no-resuelto',
    );

    // req12 "every definición con fuerza + >= 1 inamovible": quitar la inamovible ⇒ no-resuelto.
    const broken12 = resolvedDim1Payloads();
    const forces = broken12.get('dim1.req12') as { forces: Array<Record<string, unknown>> };
    forces.forces = forces.forces.map((entry) => ({ ...entry, force: 'explorable' }));
    evaluation = evaluateManifest({
      manifest: DIM1_MANIFEST_V0,
      payloads: broken12,
      rectoras: emptyRectoras(),
      verifications: VERIFICATIONS,
    });
    expect(evaluation.resultados.find((r) => r.requisitoId === 'dim1.req12')?.resultado).toBe(
      'no-resuelto',
    );
  });
});
