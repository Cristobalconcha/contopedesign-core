import { describe, expect, it } from 'vitest';
import { evaluateManifest } from './evaluate';
import { parseRequirementManifest } from './graph';
import { DIM5_MANIFEST_V0, DIM5_REQUIREMENTS_V0 } from './manifest-v0-dim5';
import type { PredicateClause } from './predicate';
import type { RectoraV0 } from './types';

const emptyRectoras = (): Map<string, RectoraV0> =>
  new Map<string, RectoraV0>([
    ['descriptor', { id: 'descriptor', tagsRequeridos: [], tagsProhibidos: [], exclusiones: [] }],
    ['mood-wall', { id: 'mood-wall', tagsRequeridos: [], tagsProhibidos: [], exclusiones: [] }],
  ]);

const MEDIA_ROLES_5 = ['fotografia', 'ilustracion', 'iconografia', 'simbolos', 'marcas'] as const;

const refRole = (role: (typeof MEDIA_ROLES_5)[number]) => ({
  refReqId: 'dim5.req02',
  refPath: ['roleMedia', MEDIA_ROLES_5.indexOf(role)],
});

/** Payloads que resuelven las ocho preguntas de la dimensión (fixture de test). */
function resolvedDim5Payloads(): Map<string, unknown> {
  const m = new Map<string, unknown>();

  m.set('dim5.req01', {
    direccion: {
      resumen: 'fotografía documental cálida, ilustración lineal de acento',
      derivation: { of: 'mood-wall' },
    },
  });

  m.set('dim5.req02', {
    roleMedia: MEDIA_ROLES_5.map((role) => ({
      role,
      tratamiento: `tratamiento estándar de ${role}`,
      aspectRatio: role === 'marcas' ? undefined : '4/3',
      fit: role === 'marcas' ? undefined : 'cover',
      source: `banco-${role}`,
      derivation: { of: 'dim5.req01' },
    })),
  });

  m.set('dim5.req03', {
    criterios: {
      tema: 'vida rural y comunidad',
      autenticidad: 'personas y lugares reales, sin stock genérico',
      diversidad: 'edades y roles variados',
      procedencia: 'banco propio o licencia comercial verificable',
      calidad: 'mínimo 2000px en el lado mayor',
    },
  });

  m.set('dim5.req04', {
    encuadres: [
      {
        contexto: 'hero de portada',
        role: refRole('fotografia'),
        aspectRatio: '16/9',
        focalPoint: 'centro-superior',
        relacionTexto: 'texto superpuesto en tercio inferior',
      },
    ],
  });

  m.set('dim5.req05', {
    tratamientos: [
      { role: refRole('fotografia'), ajuste: 'sin tratamiento adicional, mood wall no lo requiere' },
    ],
  });

  m.set('dim5.req06', {
    overlays: {
      allowed: ['duotono suave'],
      prohibited: ['neón', 'glitch agresivo'],
    },
  });

  m.set('dim5.req07', {
    gramatica: {
      forma: 'trazo geométrico simple',
      trazo: '2px constante',
      escala: 'óptica, no proporcional lineal',
      semantica: 'un ícono = un concepto, sin combinaciones',
    },
  });

  m.set('dim5.req08', {
    marca: {
      allowed: ['isotipo sobre fondo claro'],
      prohibited: ['deformar el isotipo', 'recolorear el logo'],
    },
  });

  return m;
}

describe('manifiesto v0 de Dimensión 5 — fidelidad a la spec C1-dim5 §2', () => {
  it('el documento parsea limpio (grafo acíclico, IDs estables, sin brechas silenciosas)', () => {
    const result = parseRequirementManifest(DIM5_MANIFEST_V0);
    expect(result.ok).toBe(true);
  });

  it('contiene los ocho requisitos: dim5.req01..req08', () => {
    expect(DIM5_REQUIREMENTS_V0.map((r) => r.id)).toEqual([
      'dim5.req01',
      'dim5.req02',
      'dim5.req03',
      'dim5.req04',
      'dim5.req05',
      'dim5.req06',
      'dim5.req07',
      'dim5.req08',
    ]);
  });

  it('respeta dependsOn y ejes de la spec §2 tras las 3 pasadas adversariales', () => {
    const byId = new Map(DIM5_REQUIREMENTS_V0.map((r) => [r.id, r]));
    expect(byId.get('dim5.req01')?.dependsOn).toEqual([]);
    expect(byId.get('dim5.req01')?.eje).toBe('completitud');
    expect(byId.get('dim5.req04')?.eje).toBe('completitud'); // reasignado en pasada 2
    expect(byId.get('dim5.req05')?.eje).toBe('completitud'); // reasignado en pasada 2
    expect(byId.get('dim5.req06')?.eje).toBe('coherencia'); // mecanismo agregado en pasada 2
    expect(byId.get('dim5.req07')?.eje).toBe('completitud'); // reasignado en pasada 2
    expect(byId.get('dim5.req08')?.eje).toBe('coherencia');
  });

  it('rectorBindings de mood-wall solo en los requisitos que la spec justifica (req01/02/04/08)', () => {
    const byId = new Map(DIM5_REQUIREMENTS_V0.map((r) => [r.id, r]));
    expect(byId.get('dim5.req01')?.rectorBindings).toEqual(['descriptor', 'mood-wall']);
    expect(byId.get('dim5.req02')?.rectorBindings).toEqual(['mood-wall']);
    expect(byId.get('dim5.req04')?.rectorBindings).toEqual(['mood-wall']);
    expect(byId.get('dim5.req08')?.rectorBindings).toEqual(['mood-wall']);
    expect(byId.get('dim5.req03')?.rectorBindings).toEqual([]);
    expect(byId.get('dim5.req05')?.rectorBindings).toEqual([]);
    expect(byId.get('dim5.req06')?.rectorBindings).toEqual([]);
    expect(byId.get('dim5.req07')?.rectorBindings).toEqual([]);
  });

  it('declara las brechas de mapeo vacías con mappingNotes (nunca silenciosas)', () => {
    const empties = DIM5_REQUIREMENTS_V0.filter((r) => r.mapsToKinds.length === 0);
    expect(empties.map((r) => r.id)).toEqual([
      'dim5.req01',
      'dim5.req03',
      'dim5.req05',
      'dim5.req06',
      'dim5.req07',
      'dim5.req08',
    ]);
    for (const req of empties) {
      expect(req.mappingNotes, req.id).toBeDefined();
      expect(req.mappingNotes?.length, req.id).toBeGreaterThan(0);
    }
  });

  it('CERO PROSA: la serialización es el dato (round-trip JSON) y cada cláusula es del union conocido', () => {
    const roundTripped = JSON.parse(JSON.stringify(DIM5_MANIFEST_V0));
    expect(roundTripped).toEqual(DIM5_MANIFEST_V0);

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
    for (const req of DIM5_REQUIREMENTS_V0) {
      for (const clause of req.validityPredicate) visit(clause);
    }
  });
});

describe('evaluación de la Dimensión 5 completa', () => {
  it('dimensión resuelta cuando las ocho preguntas tienen definición efectiva válida', () => {
    const evaluation = evaluateManifest({
      manifest: DIM5_MANIFEST_V0,
      payloads: resolvedDim5Payloads(),
      rectoras: emptyRectoras(),
    });
    expect(evaluation.resultado).toBe('resuelto');
    expect(evaluation.contador).toEqual({ resueltos: 8, activos: 8 });
    expect(evaluation.resultados.every((r) => r.resultado === 'resuelto')).toBe(true);
  });

  it('AND estricto (§8.1.2): un solo requisito no-resuelto tumba la dimensión', () => {
    const payloads = resolvedDim5Payloads();
    payloads.set('dim5.req03', { criterios: { tema: 'x' } }); // faltan 4 criterios
    const evaluation = evaluateManifest({
      manifest: DIM5_MANIFEST_V0,
      payloads,
      rectoras: emptyRectoras(),
    });
    expect(evaluation.resultado).toBe('no-resuelto');
    expect(evaluation.contador).toEqual({ resueltos: 7, activos: 8 });
    expect(evaluation.resultados.find((r) => r.requisitoId === 'dim5.req03')?.resultado).toBe(
      'no-resuelto',
    );
  });

  it('req02 "covers": falta uno de los cinco roles de medios ⇒ no-resuelto', () => {
    const payloads = resolvedDim5Payloads();
    const roleMedia = (payloads.get('dim5.req02') as { roleMedia: unknown[] }).roleMedia;
    payloads.set('dim5.req02', { roleMedia: roleMedia.slice(0, 4) });
    const evaluation = evaluateManifest({
      manifest: DIM5_MANIFEST_V0,
      payloads,
      rectoras: emptyRectoras(),
    });
    expect(evaluation.resultados.find((r) => r.requisitoId === 'dim5.req02')?.resultado).toBe(
      'no-resuelto',
    );
  });

  it('req06 "everyDef+containsNoneOf": un término prohibido colado en otro payload ⇒ no-resuelto', () => {
    const payloads = resolvedDim5Payloads();
    const criterios = payloads.get('dim5.req03') as { criterios: Record<string, string> };
    criterios.criterios = { ...criterios.criterios, tema: 'campaña con estética neón' };
    const evaluation = evaluateManifest({
      manifest: DIM5_MANIFEST_V0,
      payloads,
      rectoras: emptyRectoras(),
    });
    expect(evaluation.resultados.find((r) => r.requisitoId === 'dim5.req06')?.resultado).toBe(
      'no-resuelto',
    );
    expect(evaluation.resultado).toBe('no-resuelto');
  });

  it('req08 "everyDef+containsNoneOf": un término prohibido de marca colado en otro payload ⇒ no-resuelto', () => {
    const payloads = resolvedDim5Payloads();
    const gramatica = payloads.get('dim5.req07') as { gramatica: Record<string, string> };
    gramatica.gramatica = { ...gramatica.gramatica, forma: 'permite deformar el isotipo en casos especiales' };
    const evaluation = evaluateManifest({
      manifest: DIM5_MANIFEST_V0,
      payloads,
      rectoras: emptyRectoras(),
    });
    expect(evaluation.resultados.find((r) => r.requisitoId === 'dim5.req08')?.resultado).toBe(
      'no-resuelto',
    );
  });
});
