/**
 * Fixture real de la Dimensión 1 (13 requisitos, color) envuelta como
 * DesignSetV0 — compartida entre `adapter.test.ts` y las pruebas de
 * integración de persistencia, para no triplicar la misma construcción.
 * NO es un archivo `.test.ts` a propósito: los tests no deberían importar
 * de otros archivos de test (acopla la ejecución de una suite a otra), así
 * que este fixture vive en un módulo normal.
 *
 * Los mismos 13 payloads que `manifest-v0-dim1.test.ts` (suite de C1) —
 * reconstruidos aquí en vez de importados, para no acoplar la suite de C2 a
 * la de C1.
 */
import { DIM1_MANIFEST_V0, DIM1_REQUIREMENTS_V0 } from '../requirement-manifest/manifest-v0-dim1.js';
import { CORE_ROLES_13, type RectoraV0, type VerificationRecordV0 } from '../requirement-manifest/types.js';
import type { DesignSetEntryV0, DesignSetV0 } from './types.js';

export const emptyRectoras = (): Map<string, RectoraV0> =>
  new Map<string, RectoraV0>([
    ['descriptor', { id: 'descriptor', tagsRequeridos: [], tagsProhibidos: [], exclusiones: [] }],
    ['mood-wall', { id: 'mood-wall', tagsRequeridos: [], tagsProhibidos: [], exclusiones: [] }],
  ]);

const INTERACTIVE_ROLES = ['action', 'focus', 'active', 'inactive'] as const;
const INTERACTIVE_STATES = ['default', 'hover', 'focus', 'active'] as const;
const ROLE_INDEX: Record<(typeof INTERACTIVE_ROLES)[number], number> = {
  action: 5,
  focus: 12,
  active: 10,
  inactive: 11,
};

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
    actionColor: { role: 'accent', source: { refReqId: 'dim1.req02', refPath: ['roleColors', 4, 'color'] } },
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
      { level: 'canvas', backgroundColor: ref02(0), foregroundColor: ref02(2), shadow: 'md' },
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
    primaryConsumers: [{ role: 'primary', consumer: 'button tone=primary vía var(--cod-color-accent)' }],
  });
  // dim1.req14 (adenda del núcleo editorial, 2026-09-18): reproducción de color y tinta.
  // Los valores CMYK son de ejemplo, no una conversión medida.
  m.set('dim1.req14', {
    perfil: 'Coated FOGRA39 (ISO 12647-2:2004)',
    equivalencias: [
      {
        colorRef: { refReqId: 'dim1.req01', refPath: ['institucionales', 0] },
        sistemas: [
          { sistema: 'rgb', valor: '29 78 216' },
          { sistema: 'cmyk', valor: '87 64 0 15' },
        ],
      },
      {
        colorRef: { refReqId: 'dim1.req01', refPath: ['institucionales', 1] },
        sistemas: [{ sistema: 'cmyk', valor: '89 0 100 20' }],
      },
    ],
    coberturaTinta: 'sin manchas oscuras a página completa; cobertura total bajo 300 % según la imprenta',
    grisTextoMinimo: '#767676',
  });
  return m;
}

export const VERIFICATIONS = new Map<string, VerificationRecordV0>([
  [
    'contrast-matrix',
    { pruebaId: 'contrast-matrix', fecha: '2026-08-30', evidencia: 'matriz de contraste auditada contra WCAG' },
  ],
  [
    'lectura-monocroma',
    { pruebaId: 'lectura-monocroma', fecha: '2026-09-18', evidencia: 'prueba impresa en escala de grises: todo el texto se lee' },
  ],
]);

/** Envuelve los 14 payloads reales en entradas de DesignSet (spec-c2 §2). */
export function buildDim1DesignSet(): DesignSetV0 {
  const payloads = resolvedDim1Payloads();
  const byId = new Map(DIM1_REQUIREMENTS_V0.map((r) => [r.id, r]));
  const entries: DesignSetEntryV0[] = [...payloads.entries()].map(([requirementId, payload]) => {
    const requisito = byId.get(requirementId);
    if (!requisito) throw new Error(`fixture inconsistente: ${requirementId} no está en DIM1_REQUIREMENTS_V0`);
    return {
      requirementId,
      effectiveDefinitionId: `def-${requirementId}`,
      resolutionPath: 'diseñador',
      payload,
      provenance: { fuente: 'usuario' },
      fuerza: 'inamovible',
      cicloDeVida: 'aprobada',
      revision: 1,
      mapsToKinds: requisito.mapsToKinds,
    };
  });
  return {
    schemaVersion: 1,
    designSetId: 'ds-fixture-dim1',
    manifestRefs: { dim1: { manifestVersion: DIM1_MANIFEST_V0.manifestVersion, revision: DIM1_MANIFEST_V0.revision } },
    entries,
  };
}
