import { describe, expect, it } from 'vitest';
import { evaluateManifest } from './evaluate';
import { parseRequirementManifest } from './graph';
import { DIM2_MANIFEST_V0, DIM2_REQUIREMENTS_V0 } from './manifest-v0-dim2';
import type { PredicateClause } from './predicate';
import { CORE_ROLES_9, type RectoraV0 } from './types';

const emptyRectoras = (): Map<string, RectoraV0> =>
  new Map<string, RectoraV0>([
    ['descriptor', { id: 'descriptor', tagsRequeridos: [], tagsProhibidos: [], exclusiones: [] }],
    ['mood-wall', { id: 'mood-wall', tagsRequeridos: [], tagsProhibidos: [], exclusiones: [] }],
  ]);

const FLAT_STORE_FIELDS = [
  'font_heading',
  'font_body',
  'font_accent',
  'size_base',
  'h1_size',
  'h2_size',
  'h3_size',
  'h4_size',
  'h5_size',
  'h6_size',
] as const;

/** fontSize por rol (spec §4: display>título>subtítulo>cuerpo>cita≈nota≈leyenda≈dato>control). */
const FONT_SIZES: Record<(typeof CORE_ROLES_9)[number], string> = {
  display: '48px',
  título: '32px',
  subtítulo: '24px',
  cuerpo: '16px',
  cita: '15px',
  nota: '15px',
  leyenda: '15px',
  dato: '15px',
  control: '12px',
};

/** Índice de cada rol dentro de roleStyles (mismo orden que CORE_ROLES_9). */
const roleIndex = (role: (typeof CORE_ROLES_9)[number]): number => CORE_ROLES_9.indexOf(role);

const refRole = (role: (typeof CORE_ROLES_9)[number]) => ({
  refReqId: 'dim2.req02',
  refPath: ['roleStyles', roleIndex(role)],
});

/** Payloads que resuelven las ocho preguntas de la dimensión (fixture de test). */
function resolvedDim2Payloads(): Map<string, unknown> {
  const m = new Map<string, unknown>();
  const refFam = (i: number) => ({ refReqId: 'dim2.req01', refPath: ['familias', i] });

  m.set('dim2.req01', {
    familias: [
      {
        name: 'Fuente Institucional',
        stack: ['Fuente Institucional', 'sans-serif'],
        idiomas: ['es', 'en'],
        licencia: 'licencia comercial vigente',
      },
      {
        name: 'Fuente Secundaria',
        stack: ['Fuente Secundaria', 'serif'],
        idiomas: ['es'],
        licencia: 'open font license',
      },
    ],
  });

  m.set('dim2.req02', {
    roleStyles: CORE_ROLES_9.map((role) => {
      const isControl = role === 'control';
      return {
        role,
        family: isControl ? 'ui-monospace, monospace' : refFam(0),
        fontSize: FONT_SIZES[role],
        fontWeight: role === 'display' || role === 'título' ? 700 : role === 'subtítulo' ? 600 : 400,
        lineHeight: role === 'display' ? 1.1 : role === 'título' ? 1.2 : role === 'subtítulo' ? 1.3 : 1.5,
        source: `escala-${role}`,
        derivation: isControl
          ? { of: 'direct', rule: 'stack de sistema, sin familia institucional (rol de control)' }
          : { of: 'dim2.req01' },
      };
    }),
  });

  m.set('dim2.req03', {
    pares: [
      { mayor: refRole('display'), menor: refRole('título'), distincion: 'tamaño' },
      { mayor: refRole('título'), menor: refRole('subtítulo'), distincion: 'tamaño' },
      { mayor: refRole('subtítulo'), menor: refRole('cuerpo'), distincion: 'tamaño' },
      { mayor: refRole('cuerpo'), menor: refRole('cita'), distincion: 'peso' },
      { mayor: refRole('cita'), menor: refRole('nota'), distincion: 'ambos' },
      { mayor: refRole('nota'), menor: refRole('leyenda'), distincion: 'ambos' },
      { mayor: refRole('leyenda'), menor: refRole('dato'), distincion: 'ambos' },
      { mayor: refRole('dato'), menor: refRole('control'), distincion: 'tamaño' },
    ],
  });

  m.set('dim2.req04', {
    reglas: [
      { role: 'cuerpo', measure: '70ch', paragraphSpacing: '1rem', align: 'left' },
      { role: 'cita', measure: '60ch', paragraphSpacing: '1.2rem', align: 'left' },
      { role: 'nota', measure: '50ch', paragraphSpacing: '0.5rem', align: 'left' },
    ],
  });

  m.set('dim2.req05', {
    enfasis: {
      negrita: { fontWeight: 700 },
      cursiva: { style: 'italic' },
      subrayado: { decoration: 'underline' },
    },
    numeros: 'tabular',
    tablas: 'bordes finos, encabezado en negrita',
  });

  m.set('dim2.req06', {
    adaptaciones: [
      {
        contexto: 'densidad',
        roleAfectado: refRole('cuerpo'),
        ajuste: 'sin adaptación por densidad, mood wall no lo requiere',
      },
    ],
  });

  m.set('dim2.req07', {
    correspondencias: [
      { campoPlano: 'font_heading', role: refRole('título'), nota: 'familia de encabezados' },
      { campoPlano: 'font_body', role: refRole('cuerpo'), nota: 'familia de cuerpo' },
      { campoPlano: 'font_accent', role: refRole('dato'), nota: 'familia de acento' },
      { campoPlano: 'size_base', role: refRole('cuerpo'), nota: 'tamaño base = cuerpo' },
      { campoPlano: 'h1_size', role: refRole('display'), nota: 'h1 = display' },
      { campoPlano: 'h2_size', role: refRole('título'), nota: 'h2 = título' },
      { campoPlano: 'h3_size', role: refRole('subtítulo'), nota: 'h3 = subtítulo' },
      { campoPlano: 'h4_size', role: refRole('subtítulo'), nota: 'sin rol Core propio, comparte subtítulo' },
      { campoPlano: 'h5_size', role: refRole('nota'), nota: 'h5 = nota' },
      { campoPlano: 'h6_size', role: refRole('leyenda'), nota: 'h6 = leyenda' },
    ],
  });

  m.set('dim2.req08', {
    voces: CORE_ROLES_9.map((role) => ({
      role,
      fuerza:
        role === 'display' || role === 'título'
          ? 'inamovible'
          : role === 'subtítulo' || role === 'cuerpo'
            ? 'prioritaria'
            : 'explorable',
    })),
  });

  return m;
}

describe('manifiesto v0 de Dimensión 2 — fidelidad a la spec C1-dim2 §3', () => {
  it('el documento parsea limpio (grafo acíclico, IDs estables, sin brechas silenciosas)', () => {
    const result = parseRequirementManifest(DIM2_MANIFEST_V0);
    expect(result.ok).toBe(true);
  });

  it('contiene los ocho requisitos: dim2.req01..req07 + implícito como dim2.req08', () => {
    expect(DIM2_REQUIREMENTS_V0.map((r) => r.id)).toEqual([
      'dim2.req01',
      'dim2.req02',
      'dim2.req03',
      'dim2.req04',
      'dim2.req05',
      'dim2.req06',
      'dim2.req07',
      'dim2.req08',
    ]);
  });

  it('respeta dependsOn y ejes de la spec §3', () => {
    const byId = new Map(DIM2_REQUIREMENTS_V0.map((r) => [r.id, r]));
    expect(byId.get('dim2.req01')?.dependsOn).toEqual([]);
    expect(byId.get('dim2.req02')?.dependsOn).toEqual(['dim2.req01']);
    expect(byId.get('dim2.req03')?.dependsOn).toEqual(['dim2.req02']);
    expect(byId.get('dim2.req07')?.dependsOn).toEqual(['dim2.req01', 'dim2.req02']);
    expect(byId.get('dim2.req01')?.eje).toBe('completitud');
    expect(byId.get('dim2.req03')?.eje).toBe('coherencia');
    expect(byId.get('dim2.req06')?.eje).toBe('ciclo-de-vida');
    expect(byId.get('dim2.req08')?.eje).toBe('fuerza');
  });

  it('declara las brechas de mapeo vacías con mappingNotes (nunca silenciosas)', () => {
    const empties = DIM2_REQUIREMENTS_V0.filter((r) => r.mapsToKinds.length === 0);
    expect(empties.map((r) => r.id)).toEqual([
      'dim2.req01',
      'dim2.req03',
      'dim2.req06',
      'dim2.req07',
      'dim2.req08',
    ]);
    for (const req of empties) {
      expect(req.mappingNotes, req.id).toBeDefined();
      expect(req.mappingNotes?.length, req.id).toBeGreaterThan(0);
    }
  });

  it('dim2.req08.voces usa role como enum (CORE_ROLES_9), no como ref — corrección de implementación', () => {
    const req08 = DIM2_REQUIREMENTS_V0.find((r) => r.id === 'dim2.req08');
    const rolField = (req08?.payloadSchema['voces'] as { type: { of: { fields: Record<string, unknown> } } })
      .type.of.fields['role'];
    expect(rolField).toEqual({ type: { kind: 'enum', values: [...CORE_ROLES_9] } });
  });

  it('CERO PROSA: la serialización es el dato (round-trip JSON) y cada cláusula es del union conocido', () => {
    const roundTripped = JSON.parse(JSON.stringify(DIM2_MANIFEST_V0));
    expect(roundTripped).toEqual(DIM2_MANIFEST_V0);

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
      'compareCss',
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
    for (const req of DIM2_REQUIREMENTS_V0) {
      for (const clause of req.validityPredicate) visit(clause);
    }
  });
});

describe('evaluación de la Dimensión 2 completa', () => {
  it('dimensión resuelta cuando las ocho preguntas tienen definición efectiva válida', () => {
    const evaluation = evaluateManifest({
      manifest: DIM2_MANIFEST_V0,
      payloads: resolvedDim2Payloads(),
      rectoras: emptyRectoras(),
    });
    expect(evaluation.resultado).toBe('resuelto');
    expect(evaluation.contador).toEqual({ resueltos: 8, activos: 8 });
    expect(evaluation.resultados.every((r) => r.resultado === 'resuelto')).toBe(true);
  });

  it('AND estricto (§8.1.2): un solo requisito no-resuelto tumba la dimensión', () => {
    const payloads = resolvedDim2Payloads();
    payloads.set('dim2.req05', { enfasis: { negrita: { fontWeight: 700 } }, numeros: 'tabular' }); // sin cursiva/subrayado
    const evaluation = evaluateManifest({
      manifest: DIM2_MANIFEST_V0,
      payloads,
      rectoras: emptyRectoras(),
    });
    expect(evaluation.resultado).toBe('no-resuelto');
    expect(evaluation.contador).toEqual({ resueltos: 7, activos: 8 });
    const req05 = evaluation.resultados.find((r) => r.requisitoId === 'dim2.req05');
    expect(req05?.resultado).toBe('no-resuelto');
  });

  it('req03 (compareCss): romper la jerarquía de tamaño ⇒ no-resuelto', () => {
    const payloads = resolvedDim2Payloads();
    // subtítulo (24px) pasa a ser más chico que cuerpo (16px): el par
    // subtítulo>cuerpo con distincion:'tamaño' deja de cumplirse.
    const roleStyles = (payloads.get('dim2.req02') as { roleStyles: Array<Record<string, unknown>> })
      .roleStyles;
    const idx = roleIndex('subtítulo');
    const entry = roleStyles[idx];
    if (entry) roleStyles[idx] = { ...entry, fontSize: '10px' };
    const evaluation = evaluateManifest({
      manifest: DIM2_MANIFEST_V0,
      payloads,
      rectoras: emptyRectoras(),
    });
    expect(evaluation.resultados.find((r) => r.requisitoId === 'dim2.req03')?.resultado).toBe(
      'no-resuelto',
    );
    expect(evaluation.resultado).toBe('no-resuelto');
  });

  it('req03 (compareCss): distincion "peso" no exige comparación de tamaño', () => {
    const payloads = resolvedDim2Payloads();
    // El par cuerpo/cita ya está declarado con distincion:'peso'; invertir
    // los tamaños (cita > cuerpo) no debe romper el requisito.
    const roleStyles = (payloads.get('dim2.req02') as { roleStyles: Array<Record<string, unknown>> })
      .roleStyles;
    const citaIdx = roleIndex('cita');
    const citaEntry = roleStyles[citaIdx];
    if (citaEntry) roleStyles[citaIdx] = { ...citaEntry, fontSize: '99px' };
    const evaluation = evaluateManifest({
      manifest: DIM2_MANIFEST_V0,
      payloads,
      rectoras: emptyRectoras(),
    });
    expect(evaluation.resultados.find((r) => r.requisitoId === 'dim2.req03')?.resultado).toBe(
      'resuelto',
    );
  });

  it('req02 "deriva de": sin derivation.of = dim2.req01 y sin rule ⇒ no-resuelto', () => {
    const payloads = resolvedDim2Payloads();
    const roleStyles = (payloads.get('dim2.req02') as { roleStyles: Array<Record<string, unknown>> })
      .roleStyles;
    payloads.set('dim2.req02', {
      roleStyles: roleStyles.map((entry) => ({ ...entry, derivation: { of: 'direct' } })),
    });
    const evaluation = evaluateManifest({
      manifest: DIM2_MANIFEST_V0,
      payloads,
      rectoras: emptyRectoras(),
    });
    expect(evaluation.resultados.find((r) => r.requisitoId === 'dim2.req02')?.resultado).toBe(
      'no-resuelto',
    );
  });

  it('req07 "covers" almacén plano: falta una de las diez claves ⇒ no-resuelto', () => {
    const payloads = resolvedDim2Payloads();
    const correspondencias = (
      payloads.get('dim2.req07') as { correspondencias: Array<Record<string, unknown>> }
    ).correspondencias;
    payloads.set('dim2.req07', {
      correspondencias: correspondencias.filter((c) => c['campoPlano'] !== 'h6_size'),
    });
    const evaluation = evaluateManifest({
      manifest: DIM2_MANIFEST_V0,
      payloads,
      rectoras: emptyRectoras(),
    });
    expect(evaluation.resultados.find((r) => r.requisitoId === 'dim2.req07')?.resultado).toBe(
      'no-resuelto',
    );
  });

  it('FLAT_STORE_FIELDS de la fixture cubre exactamente las diez claves del almacén plano', () => {
    expect(FLAT_STORE_FIELDS).toHaveLength(10);
  });
});
