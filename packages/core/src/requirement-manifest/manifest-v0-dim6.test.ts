import { describe, expect, it } from 'vitest';
import { evaluateManifest } from './evaluate';
import { parseRequirementManifest } from './graph';
import { DIM6_MANIFEST_V0, DIM6_REQUIREMENTS_V0 } from './manifest-v0-dim6';
import type { PredicateClause } from './predicate';
import type { RectoraV0 } from './types';

const emptyRectoras = (): Map<string, RectoraV0> =>
  new Map<string, RectoraV0>([
    ['descriptor', { id: 'descriptor', tagsRequeridos: [], tagsProhibidos: [], exclusiones: [] }],
    ['mood-wall', { id: 'mood-wall', tagsRequeridos: [], tagsProhibidos: [], exclusiones: [] }],
  ]);

/** Payloads que resuelven las siete preguntas de la dimensión (fixture de test). */
function resolvedDim6Payloads(): Map<string, unknown> {
  const m = new Map<string, unknown>();

  m.set('dim6.req01', {
    pesos: [
      { role: 'dominante', aplicaA: 'titular de portada', tecnica: 'escala 3x + color de acento' },
      { role: 'secundario', aplicaA: 'bajada de portada', tecnica: 'escala 1.5x, tono neutro' },
      { role: 'silencio', aplicaA: 'metadatos de pie', tecnica: 'tamaño mínimo, gris apagado' },
    ],
    recorrido: {
      orden: ['titular', 'imagen', 'bajada', 'cuerpo'],
      descripcion: 'lectura en Z invertida para portadas',
    },
  });

  m.set('dim6.req02', {
    agrupaciones: [
      { principio: 'proximidad', criterio: 'elementos relacionados a menos de 1 unidad de escala' },
      { principio: 'continuidad', criterio: 'alineación compartida entre bloques de una secuencia' },
      { principio: 'separacion', criterio: 'gap mínimo de 2 unidades entre secciones no relacionadas' },
    ],
  });

  m.set('dim6.req03', {
    balance: {
      tipo: 'asimetrico',
      tension: 'contrapeso de imagen grande con bloque de texto denso',
      alineacion: 'eje editorial a la izquierda, imagen ancla a la derecha',
    },
  });

  m.set('dim6.req04', {
    secuencia: {
      patron: 'titular > imagen > cuerpo > cita destacada > cuerpo',
      repeticion: 'cita destacada cada 3-4 párrafos',
      pausas: ['espacio en blanco antes de cada cita', 'línea divisoria entre secciones'],
    },
  });

  m.set('dim6.req05', {
    densidad: {
      modo: 'comodo',
      espacioNegativo: 'al menos 20% del área visible sin contenido en vistas de portada',
    },
  });

  m.set('dim6.req06', {
    flujo: {
      tipo: 'editorial',
      descripcion: 'scroll continuo con anclas de sección, sin paginación',
    },
  });

  m.set('dim6.req07', {
    adaptaciones: [
      { contexto: 'formato impreso', ajuste: 'sin adaptación, mood wall no distingue impreso hoy' },
    ],
  });

  return m;
}

describe('manifiesto v0 de Dimensión 6 — fidelidad a la spec C1-dim6 §3', () => {
  it('el documento parsea limpio (grafo acíclico, IDs estables, sin brechas silenciosas)', () => {
    const result = parseRequirementManifest(DIM6_MANIFEST_V0);
    expect(result.ok).toBe(true);
  });

  it('contiene los siete requisitos: dim6.req01..req07', () => {
    expect(DIM6_REQUIREMENTS_V0.map((r) => r.id)).toEqual([
      'dim6.req01',
      'dim6.req02',
      'dim6.req03',
      'dim6.req04',
      'dim6.req05',
      'dim6.req06',
      'dim6.req07',
    ]);
  });

  it('respeta dependsOn y ejes de la spec §3', () => {
    const byId = new Map(DIM6_REQUIREMENTS_V0.map((r) => [r.id, r]));
    expect(byId.get('dim6.req01')?.dependsOn).toEqual([]);
    expect(byId.get('dim6.req01')?.eje).toBe('completitud');
    expect(byId.get('dim6.req07')?.eje).toBe('ciclo-de-vida');
    for (const id of ['dim6.req02', 'dim6.req03', 'dim6.req04', 'dim6.req05', 'dim6.req06', 'dim6.req07']) {
      expect(byId.get(id)?.dependsOn, id).toEqual(['dim6.req01']);
    }
  });

  it('rectorBindings de mood-wall solo en req01/req02, tras la reversión de la pasada adversarial 2', () => {
    const byId = new Map(DIM6_REQUIREMENTS_V0.map((r) => [r.id, r]));
    expect(byId.get('dim6.req01')?.rectorBindings).toEqual(['descriptor', 'mood-wall']);
    expect(byId.get('dim6.req02')?.rectorBindings).toEqual(['mood-wall']);
    for (const id of ['dim6.req03', 'dim6.req04', 'dim6.req05', 'dim6.req06', 'dim6.req07']) {
      expect(byId.get(id)?.rectorBindings, id).toEqual([]);
    }
  });

  it('las siete brechas de mapeo están vacías (composición no tiene kind propio) con mappingNotes', () => {
    expect(DIM6_REQUIREMENTS_V0.every((r) => r.mapsToKinds.length === 0)).toBe(true);
    for (const req of DIM6_REQUIREMENTS_V0) {
      expect(req.mappingNotes, req.id).toBeDefined();
      expect(req.mappingNotes?.length, req.id).toBeGreaterThan(0);
    }
  });

  it('CERO PROSA: la serialización es el dato (round-trip JSON) y cada cláusula es del union conocido', () => {
    const roundTripped = JSON.parse(JSON.stringify(DIM6_MANIFEST_V0));
    expect(roundTripped).toEqual(DIM6_MANIFEST_V0);

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
    for (const req of DIM6_REQUIREMENTS_V0) {
      for (const clause of req.validityPredicate) visit(clause);
    }
  });
});

describe('evaluación de la Dimensión 6 completa', () => {
  it('dimensión resuelta cuando las siete preguntas tienen definición efectiva válida', () => {
    const evaluation = evaluateManifest({
      manifest: DIM6_MANIFEST_V0,
      payloads: resolvedDim6Payloads(),
      rectoras: emptyRectoras(),
    });
    expect(evaluation.resultado).toBe('resuelto');
    expect(evaluation.contador).toEqual({ resueltos: 7, activos: 7 });
    expect(evaluation.resultados.every((r) => r.resultado === 'resuelto')).toBe(true);
  });

  it('AND estricto (§8.1.2): un solo requisito no-resuelto tumba la dimensión', () => {
    const payloads = resolvedDim6Payloads();
    payloads.set('dim6.req07', { adaptaciones: [] }); // lista vacía, no una decisión explícita
    const evaluation = evaluateManifest({
      manifest: DIM6_MANIFEST_V0,
      payloads,
      rectoras: emptyRectoras(),
    });
    expect(evaluation.resultado).toBe('no-resuelto');
    expect(evaluation.contador).toEqual({ resueltos: 6, activos: 7 });
    expect(evaluation.resultados.find((r) => r.requisitoId === 'dim6.req07')?.resultado).toBe(
      'no-resuelto',
    );
  });

  it('req01 "covers": falta uno de los tres niveles de peso visual ⇒ no-resuelto', () => {
    const payloads = resolvedDim6Payloads();
    const pesos = (payloads.get('dim6.req01') as { pesos: unknown[] }).pesos;
    payloads.set('dim6.req01', {
      pesos: pesos.slice(0, 2),
      recorrido: { orden: ['a', 'b'], descripcion: 'x' },
    });
    const evaluation = evaluateManifest({
      manifest: DIM6_MANIFEST_V0,
      payloads,
      rectoras: emptyRectoras(),
    });
    expect(evaluation.resultados.find((r) => r.requisitoId === 'dim6.req01')?.resultado).toBe(
      'no-resuelto',
    );
  });

  it('req02 "covers": falta uno de los tres principios de agrupación ⇒ no-resuelto', () => {
    const payloads = resolvedDim6Payloads();
    const agrupaciones = (payloads.get('dim6.req02') as { agrupaciones: unknown[] }).agrupaciones;
    payloads.set('dim6.req02', { agrupaciones: agrupaciones.slice(0, 2) });
    const evaluation = evaluateManifest({
      manifest: DIM6_MANIFEST_V0,
      payloads,
      rectoras: emptyRectoras(),
    });
    expect(evaluation.resultados.find((r) => r.requisitoId === 'dim6.req02')?.resultado).toBe(
      'no-resuelto',
    );
  });
});
