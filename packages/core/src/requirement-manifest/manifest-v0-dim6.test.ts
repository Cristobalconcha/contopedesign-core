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

/** Payloads que resuelven las nueve preguntas de la dimensión (fixture de test). */
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

  // Adenda C1: estructura física de un tríptico (insumos 10 y 11).
  m.set('dim6.req08', {
    paneles: [
      {
        nombre: 'cara exterior · solapa interior',
        contenido: 'resumen del programa y datos de contacto',
        orden: 1,
      },
      {
        nombre: 'cara exterior · contraportada',
        contenido: 'mapa de acceso y código QR de inscripción',
        orden: 2,
      },
      { nombre: 'cara exterior · portada', contenido: 'titular del evento y fecha', orden: 3 },
      {
        nombre: 'cara interior · pliego',
        contenido: 'programa completo, leído de izquierda a derecha',
        orden: 4,
      },
    ],
    plegado: 'tríptico en rollo con dos pliegues verticales',
    ordenDespliegue: ['portada', 'pliego interior', 'solapa interior', 'contraportada'],
    repetidosPorHoja: ['número de página', 'cabecera de sección', 'membrete'],
  });

  // Adenda C1: flyer de lectura a distancia (insumos 7 y 8). "Feria del libro 2026" = 4 palabras.
  m.set('dim6.req09', {
    dominante: 'Feria del libro 2026',
    palabrasDominante: 4,
    tamanoDominante: '96px',
    cincoPreguntas: [
      { pregunta: 'que', contenido: 'feria del libro independiente' },
      { pregunta: 'cuando', contenido: 'viernes 25 y sábado 26 de septiembre' },
      { pregunta: 'donde', contenido: 'plaza central, entrada por calle Arturo Prat' },
      { pregunta: 'cuanto', contenido: 'entrada liberada' },
      { pregunta: 'como-actuar', contenido: 'escanea el código QR o llama al +56 9 5555 5555' },
    ],
  });

  return m;
}

describe('manifiesto v0 de Dimensión 6 — fidelidad a la spec C1-dim6 §3', () => {
  it('el documento parsea limpio (grafo acíclico, IDs estables, sin brechas silenciosas)', () => {
    const result = parseRequirementManifest(DIM6_MANIFEST_V0);
    expect(result.ok).toBe(true);
  });

  it('contiene los nueve requisitos: dim6.req01..req09 (siete originales + dos de la adenda)', () => {
    expect(DIM6_REQUIREMENTS_V0.map((r) => r.id)).toEqual([
      'dim6.req01',
      'dim6.req02',
      'dim6.req03',
      'dim6.req04',
      'dim6.req05',
      'dim6.req06',
      'dim6.req07',
      'dim6.req08',
      'dim6.req09',
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

  it('las nueve brechas de mapeo están vacías (composición no tiene kind propio) con mappingNotes', () => {
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

describe('adenda C1 del núcleo editorial (2026-09-18) — dim6.req08 y dim6.req09', () => {
  it('el documento sigue parseando limpio y la versión sube a 1.1 / revisión 2', () => {
    const result = parseRequirementManifest(DIM6_MANIFEST_V0);
    expect(result.ok).toBe(true);
    expect(DIM6_MANIFEST_V0.manifestVersion).toBe('1.1');
    expect(DIM6_MANIFEST_V0.revision).toBe(2);
  });

  it('los ids nuevos van al final y en orden, sin tocar los siete anteriores', () => {
    const ids = DIM6_REQUIREMENTS_V0.map((r) => r.id);
    expect(ids.slice(0, 7)).toEqual([
      'dim6.req01',
      'dim6.req02',
      'dim6.req03',
      'dim6.req04',
      'dim6.req05',
      'dim6.req06',
      'dim6.req07',
    ]);
    expect(ids.slice(7)).toEqual(['dim6.req08', 'dim6.req09']);
  });

  it('ejes, dependsOn y packageId de los nuevos según la adenda §3', () => {
    const byId = new Map(DIM6_REQUIREMENTS_V0.map((r) => [r.id, r]));
    const req08 = byId.get('dim6.req08');
    const req09 = byId.get('dim6.req09');
    expect(req08?.eje).toBe('completitud');
    expect(req08?.dependsOn).toEqual(['dim6.req06']);
    expect(req08?.packageId).toBe('pkg.composicion.estructura');
    expect(req09?.eje).toBe('validez');
    expect(req09?.dependsOn).toEqual(['dim6.req01']);
    expect(req09?.packageId).toBe('pkg.composicion.dominante');
  });

  it('los nuevos no declaran rectora y sí declaran su brecha de mapeo (adenda §2)', () => {
    const byId = new Map(DIM6_REQUIREMENTS_V0.map((r) => [r.id, r]));
    for (const id of ['dim6.req08', 'dim6.req09']) {
      expect(byId.get(id)?.rectorBindings, id).toEqual([]);
      expect(byId.get(id)?.mapsToKinds, id).toEqual([]);
      expect(byId.get(id)?.mappingNotes?.length, id).toBeGreaterThan(0);
    }
  });

  it('el umbral del flyer vive en el schema: palabrasDominante declara max 6 y noAplica es el canal de ausencia', () => {
    const req09 = DIM6_REQUIREMENTS_V0.find((r) => r.id === 'dim6.req09')!;
    const campos = req09.payloadSchema;
    expect(campos['palabrasDominante']?.type).toEqual({ kind: 'numero', max: 6 });
    expect(campos['tamanoDominante']?.type).toEqual({ kind: 'longitud-css' });
    expect(campos['noAplica']?.optional).toBe(true);
    // Opcional (integrador, 18-09): si la pieza se lee de cerca, noAplica basta y no hay dominante que escribir.
    expect(campos['dominante']?.optional).toBe(true);
  });
});

describe('evaluación de la Dimensión 6 completa', () => {
  it('dimensión resuelta cuando las nueve preguntas tienen definición efectiva válida', () => {
    const evaluation = evaluateManifest({
      manifest: DIM6_MANIFEST_V0,
      payloads: resolvedDim6Payloads(),
      rectoras: emptyRectoras(),
    });
    expect(evaluation.resultado).toBe('resuelto');
    expect(evaluation.contador).toEqual({ resueltos: 9, activos: 9 });
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
    expect(evaluation.contador).toEqual({ resueltos: 8, activos: 9 });
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

  it('req08 completitud: un panel mudo (sin contenido) ⇒ no-resuelto', () => {
    const payloads = resolvedDim6Payloads();
    const req08 = payloads.get('dim6.req08') as Record<string, unknown>;
    const paneles = req08['paneles'] as Array<Record<string, unknown>>;
    payloads.set('dim6.req08', {
      ...req08,
      paneles: [{ nombre: 'cara exterior · portada', orden: 1 }, ...paneles.slice(1)],
    });
    const evaluation = evaluateManifest({
      manifest: DIM6_MANIFEST_V0,
      payloads,
      rectoras: emptyRectoras(),
    });
    expect(evaluation.resultado).toBe('no-resuelto');
    expect(evaluation.resultados.find((r) => r.requisitoId === 'dim6.req08')?.resultado).toBe(
      'no-resuelto',
    );
  });

  it('umbral roto en req09: siete palabras en la dominante ⇒ no-resuelto (cita «≤ 6 palabras»)', () => {
    const payloads = resolvedDim6Payloads();
    const req09 = payloads.get('dim6.req09') as Record<string, unknown>;
    payloads.set('dim6.req09', { ...req09, palabrasDominante: 7 });
    const evaluation = evaluateManifest({
      manifest: DIM6_MANIFEST_V0,
      payloads,
      rectoras: emptyRectoras(),
    });
    expect(evaluation.resultado).toBe('no-resuelto');
    expect(evaluation.resultados.find((r) => r.requisitoId === 'dim6.req09')?.resultado).toBe(
      'no-resuelto',
    );
  });

  it('umbral roto en req09: dominante de 40 px ⇒ no-resuelto (cita «80 px / 60 pt o más»)', () => {
    const payloads = resolvedDim6Payloads();
    const req09 = payloads.get('dim6.req09') as Record<string, unknown>;
    payloads.set('dim6.req09', { ...req09, tamanoDominante: '40px' });
    const evaluation = evaluateManifest({
      manifest: DIM6_MANIFEST_V0,
      payloads,
      rectoras: emptyRectoras(),
    });
    expect(evaluation.resultado).toBe('no-resuelto');
    expect(evaluation.resultados.find((r) => r.requisitoId === 'dim6.req09')?.resultado).toBe(
      'no-resuelto',
    );
  });

  it('req09 "covers": falta una de las cinco preguntas agrupadas ⇒ no-resuelto', () => {
    const payloads = resolvedDim6Payloads();
    const req09 = payloads.get('dim6.req09') as Record<string, unknown>;
    const cincoPreguntas = req09['cincoPreguntas'] as unknown[];
    payloads.set('dim6.req09', { ...req09, cincoPreguntas: cincoPreguntas.slice(0, 4) });
    const evaluation = evaluateManifest({
      manifest: DIM6_MANIFEST_V0,
      payloads,
      rectoras: emptyRectoras(),
    });
    expect(evaluation.resultado).toBe('no-resuelto');
    expect(evaluation.resultados.find((r) => r.requisitoId === 'dim6.req09')?.resultado).toBe(
      'no-resuelto',
    );
  });

  it('canal de ausencia de req09: sólo la razón escrita (noAplica) ⇒ resuelto', () => {
    const payloads = resolvedDim6Payloads();
    payloads.set('dim6.req09', {
      noAplica: 'es una carta formal que se lee en la mano, no desde el otro lado de la sala',
    });
    const evaluation = evaluateManifest({
      manifest: DIM6_MANIFEST_V0,
      payloads,
      rectoras: emptyRectoras(),
    });
    expect(evaluation.resultado).toBe('resuelto');
    expect(evaluation.contador).toEqual({ resueltos: 9, activos: 9 });
    expect(evaluation.resultados.find((r) => r.requisitoId === 'dim6.req09')?.resultado).toBe(
      'resuelto',
    );
  });

  it('canal de ausencia de req09 mezclado con contenido (noAplica + dominante) ⇒ no-resuelto por exclusión mutua', () => {
    const payloads = resolvedDim6Payloads();
    payloads.set('dim6.req09', {
      noAplica: 'es una carta formal que se lee en la mano',
      dominante: 'Feria del libro 2026',
    });
    const evaluation = evaluateManifest({
      manifest: DIM6_MANIFEST_V0,
      payloads,
      rectoras: emptyRectoras(),
    });
    expect(evaluation.resultado).toBe('no-resuelto');
    expect(evaluation.resultados.find((r) => r.requisitoId === 'dim6.req09')?.resultado).toBe(
      'no-resuelto',
    );
  });

  it('romper req06 (con dependiente directo req08) cuenta la cascada: 9 activos, 7 resueltos', () => {
    const payloads = resolvedDim6Payloads();
    payloads.set('dim6.req06', { flujo: { tipo: 'editorial' } }); // sin descripción
    const evaluation = evaluateManifest({
      manifest: DIM6_MANIFEST_V0,
      payloads,
      rectoras: emptyRectoras(),
    });
    expect(evaluation.resultado).toBe('no-resuelto');
    expect(evaluation.contador).toEqual({ resueltos: 7, activos: 9 });
    expect(evaluation.resultados.find((r) => r.requisitoId === 'dim6.req06')?.resultado).toBe(
      'no-resuelto',
    );
    expect(evaluation.resultados.find((r) => r.requisitoId === 'dim6.req08')?.resultado).toBe(
      'no-resuelto',
    );
  });
});
