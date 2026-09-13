import { describe, expect, it } from 'vitest';
import { evaluateManifest } from './evaluate';
import { parseRequirementManifest } from './graph';
import { DIM3_MANIFEST_V0, DIM3_REQUIREMENTS_V0 } from './manifest-v0-dim3';
import type { PredicateClause } from './predicate';
import type { RectoraV0 } from './types';

const emptyRectoras = (): Map<string, RectoraV0> => new Map<string, RectoraV0>();

const SPATIAL_ROLES_3 = ['intraelemento', 'interelemento', 'entre-secciones'] as const;

const refEscala = (i: number) => ({ refReqId: 'dim3.req01', refPath: ['escala', i] });
const refRole = (role: (typeof SPATIAL_ROLES_3)[number]) => ({
  refReqId: 'dim3.req02',
  refPath: ['roleSpacing', SPATIAL_ROLES_3.indexOf(role)],
});

/** Payloads que resuelven las siete preguntas de la dimensión (fixture de test). */
function resolvedDim3Payloads(): Map<string, unknown> {
  const m = new Map<string, unknown>();

  m.set('dim3.req01', {
    unidad: '4px',
    escala: [
      { step: 1, value: '4px' },
      { step: 2, value: '8px' },
      { step: 3, value: '12px' },
      { step: 4, value: '16px' },
      { step: 6, value: '24px' },
      { step: 8, value: '32px' },
    ],
  });

  m.set('dim3.req02', {
    roleSpacing: SPATIAL_ROLES_3.map((role, i) => ({
      role,
      value: refEscala(i * 2),
      source: `escala-paso-${i * 2}`,
      derivation: { of: 'dim3.req01' },
    })),
  });

  m.set('dim3.req03', {
    ritmo: {
      baseline: refEscala(1),
      aplicaA: ['párrafo', 'encabezado', 'lista'],
      alineacion: 'baseline',
    },
  });

  m.set('dim3.req04', {
    reticulas: [
      {
        contexto: 'artículo',
        columns: 8,
        gap: refEscala(3),
        minColumnWidth: '80px',
        align: 'stretch',
        justify: 'start',
      },
    ],
  });

  m.set('dim3.req05', {
    contenedores: [
      { nombre: 'contenido', maxWidth: '72rem', padding: refRole('interelemento'), relacionSoporte: 'viewport, con clamp a 90vw' },
      { nombre: 'ancho-completo', maxWidth: '100vw', padding: refRole('entre-secciones'), relacionSoporte: 'viewport completo, sin límite' },
    ],
  });

  m.set('dim3.req06', {
    adaptaciones: [
      {
        contexto: 'densidad',
        roleAfectado: refRole('intraelemento'),
        ajuste: 'sin adaptación por densidad, mood wall no lo requiere',
      },
    ],
  });

  m.set('dim3.req07', {
    correspondencia: {
      campoPlano: 'spacing',
      escalaRelacionada: refEscala(1),
      nota: 'spacing del almacén plano corresponde al paso base de la escala',
    },
  });

  return m;
}

describe('manifiesto v0 de Dimensión 3 — fidelidad a la spec C1-dim3 §3', () => {
  it('el documento parsea limpio (grafo acíclico, IDs estables, sin brechas silenciosas)', () => {
    const result = parseRequirementManifest(DIM3_MANIFEST_V0);
    expect(result.ok).toBe(true);
  });

  it('contiene los siete requisitos: dim3.req01..req07', () => {
    expect(DIM3_REQUIREMENTS_V0.map((r) => r.id)).toEqual([
      'dim3.req01',
      'dim3.req02',
      'dim3.req03',
      'dim3.req04',
      'dim3.req05',
      'dim3.req06',
      'dim3.req07',
    ]);
  });

  it('respeta dependsOn y ejes de la spec §3', () => {
    const byId = new Map(DIM3_REQUIREMENTS_V0.map((r) => [r.id, r]));
    expect(byId.get('dim3.req01')?.dependsOn).toEqual([]);
    expect(byId.get('dim3.req02')?.dependsOn).toEqual(['dim3.req01']);
    expect(byId.get('dim3.req05')?.dependsOn).toEqual(['dim3.req02', 'dim3.req04']);
    expect(byId.get('dim3.req01')?.eje).toBe('completitud');
    expect(byId.get('dim3.req03')?.eje).toBe('completitud');
    expect(byId.get('dim3.req04')?.eje).toBe('validez');
    expect(byId.get('dim3.req06')?.eje).toBe('ciclo-de-vida');
    expect(byId.get('dim3.req07')?.eje).toBe('coherencia');
  });

  it('ningún requisito declara rectorBindings — espacio no aparece en el alcance de mood-wall (spec §2)', () => {
    for (const req of DIM3_REQUIREMENTS_V0) {
      expect(req.rectorBindings, req.id).toEqual([]);
    }
  });

  it('declara las brechas de mapeo vacías con mappingNotes (nunca silenciosas)', () => {
    const empties = DIM3_REQUIREMENTS_V0.filter((r) => r.mapsToKinds.length === 0);
    expect(empties.map((r) => r.id)).toEqual(['dim3.req01', 'dim3.req03', 'dim3.req06', 'dim3.req07']);
    for (const req of empties) {
      expect(req.mappingNotes, req.id).toBeDefined();
      expect(req.mappingNotes?.length, req.id).toBeGreaterThan(0);
    }
  });

  it('CERO PROSA: la serialización es el dato (round-trip JSON) y cada cláusula es del union conocido', () => {
    const roundTripped = JSON.parse(JSON.stringify(DIM3_MANIFEST_V0));
    expect(roundTripped).toEqual(DIM3_MANIFEST_V0);

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
    for (const req of DIM3_REQUIREMENTS_V0) {
      for (const clause of req.validityPredicate) visit(clause);
    }
  });
});

describe('evaluación de la Dimensión 3 completa', () => {
  it('dimensión resuelta cuando las siete preguntas tienen definición efectiva válida', () => {
    const evaluation = evaluateManifest({
      manifest: DIM3_MANIFEST_V0,
      payloads: resolvedDim3Payloads(),
      rectoras: emptyRectoras(),
    });
    expect(evaluation.resultado).toBe('resuelto');
    expect(evaluation.contador).toEqual({ resueltos: 7, activos: 7 });
    expect(evaluation.resultados.every((r) => r.resultado === 'resuelto')).toBe(true);
  });

  it('AND estricto (§8.1.2): un solo requisito no-resuelto tumba la dimensión', () => {
    const payloads = resolvedDim3Payloads();
    payloads.set('dim3.req06', { adaptaciones: [] }); // lista vacía, no una decisión explícita
    const evaluation = evaluateManifest({
      manifest: DIM3_MANIFEST_V0,
      payloads,
      rectoras: emptyRectoras(),
    });
    expect(evaluation.resultado).toBe('no-resuelto');
    expect(evaluation.contador).toEqual({ resueltos: 6, activos: 7 });
    expect(evaluation.resultados.find((r) => r.requisitoId === 'dim3.req06')?.resultado).toBe(
      'no-resuelto',
    );
  });

  it('req02 "covers": falta uno de los tres roles espaciales ⇒ no-resuelto', () => {
    const payloads = resolvedDim3Payloads();
    const roleSpacing = (payloads.get('dim3.req02') as { roleSpacing: unknown[] }).roleSpacing;
    payloads.set('dim3.req02', { roleSpacing: roleSpacing.slice(0, 2) });
    const evaluation = evaluateManifest({
      manifest: DIM3_MANIFEST_V0,
      payloads,
      rectoras: emptyRectoras(),
    });
    expect(evaluation.resultados.find((r) => r.requisitoId === 'dim3.req02')?.resultado).toBe(
      'no-resuelto',
    );
  });

  it('req05 "gte(count,2)": un solo contenedor ⇒ no-resuelto', () => {
    const payloads = resolvedDim3Payloads();
    const contenedores = (payloads.get('dim3.req05') as { contenedores: unknown[] }).contenedores;
    payloads.set('dim3.req05', { contenedores: contenedores.slice(0, 1) });
    const evaluation = evaluateManifest({
      manifest: DIM3_MANIFEST_V0,
      payloads,
      rectoras: emptyRectoras(),
    });
    expect(evaluation.resultados.find((r) => r.requisitoId === 'dim3.req05')?.resultado).toBe(
      'no-resuelto',
    );
  });

  it('req07 correspondencia con el almacén plano: referencia rota a la escala ⇒ no-resuelto', () => {
    const payloads = resolvedDim3Payloads();
    payloads.set('dim3.req07', {
      correspondencia: { campoPlano: 'spacing', escalaRelacionada: refEscala(1), nota: 'x' },
    });
    // Rompe la referencia: apunta a un req inexistente en el store para forzar 'referencia-rota'.
    const broken = payloads.get('dim3.req07') as { correspondencia: { escalaRelacionada: unknown } };
    broken.correspondencia.escalaRelacionada = { refReqId: 'dim3.req99', refPath: ['x'] };
    const evaluation = evaluateManifest({
      manifest: DIM3_MANIFEST_V0,
      payloads,
      rectoras: emptyRectoras(),
    });
    expect(evaluation.resultados.find((r) => r.requisitoId === 'dim3.req07')?.resultado).toBe(
      'no-resuelto',
    );
  });
});
