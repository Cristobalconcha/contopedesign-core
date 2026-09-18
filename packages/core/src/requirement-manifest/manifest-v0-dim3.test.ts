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

// --- Payloads de la adenda (tipados para no pelear con exactOptionalPropertyTypes) ---

type HojaPayload = {
  formato: string;
  medida?: { ancho: string; alto: string };
  orientacion: string;
  modo: string;
};

type SangradoPayload = {
  sangrado: string;
  zonaSegura: string;
  margenTextoCorrido: string;
  aSangre: string[];
  excepcion?: string;
};

/** Hoja: A4 vertical, página fija (el flyer de una cara de la medición). */
function hojaResuelta(): HojaPayload {
  return { formato: 'a4', orientacion: 'vertical', modo: 'pagina-fija' };
}

/** Sangrado: fondo a sangre declarado, 40 px libres y 72 px para el texto corrido (insumos 3 y 4). */
function sangradoResuelto(): SangradoPayload {
  return {
    sangrado: '12px', // la Fuente A no cita cifra de sangrado: campo abierto declarado (tensión 6)
    zonaSegura: '40px',
    margenTextoCorrido: '72px',
    aSangre: ['fondo'],
  };
}

/** Payloads que resuelven las nueve preguntas de la dimensión (fixture de test). */
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

  // Adenda 2026-09-18: dim3.req08 (hoja) y dim3.req09 (sangrado).
  m.set('dim3.req08', hojaResuelta());
  m.set('dim3.req09', sangradoResuelto());

  return m;
}

describe('manifiesto v0 de Dimensión 3 — fidelidad a la spec C1-dim3 §3', () => {
  it('el documento parsea limpio (grafo acíclico, IDs estables, sin brechas silenciosas)', () => {
    const result = parseRequirementManifest(DIM3_MANIFEST_V0);
    expect(result.ok).toBe(true);
  });

  it('contiene los nueve requisitos: dim3.req01..req09', () => {
    expect(DIM3_REQUIREMENTS_V0.map((r) => r.id)).toEqual([
      'dim3.req01',
      'dim3.req02',
      'dim3.req03',
      'dim3.req04',
      'dim3.req05',
      'dim3.req06',
      'dim3.req07',
      'dim3.req08',
      'dim3.req09',
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
    expect(empties.map((r) => r.id)).toEqual([
      'dim3.req01',
      'dim3.req03',
      'dim3.req06',
      'dim3.req07',
      'dim3.req08',
      'dim3.req09',
    ]);
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
  it('dimensión resuelta cuando las nueve preguntas tienen definición efectiva válida', () => {
    const evaluation = evaluateManifest({
      manifest: DIM3_MANIFEST_V0,
      payloads: resolvedDim3Payloads(),
      rectoras: emptyRectoras(),
    });
    expect(evaluation.resultado).toBe('resuelto');
    expect(evaluation.contador).toEqual({ resueltos: 9, activos: 9 });
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
    expect(evaluation.contador).toEqual({ resueltos: 8, activos: 9 });
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

describe('adenda del núcleo editorial (2026-09-18) — dim3.req08 y dim3.req09', () => {
  it('el documento sigue parseando limpio y la versión sube a 1.1 / revisión 2', () => {
    const result = parseRequirementManifest(DIM3_MANIFEST_V0);
    expect(result.ok).toBe(true);
    expect(DIM3_MANIFEST_V0.schemaVersion).toBe(1);
    expect(DIM3_MANIFEST_V0.manifestVersion).toBe('1.1');
    expect(DIM3_MANIFEST_V0.revision).toBe(2);
    expect(DIM3_MANIFEST_V0.requirements).toHaveLength(9);
  });

  it('los ids nuevos van al final, en orden, y no desplazan a los siete previos', () => {
    expect(DIM3_REQUIREMENTS_V0.slice(0, 7).map((r) => r.id)).toEqual([
      'dim3.req01',
      'dim3.req02',
      'dim3.req03',
      'dim3.req04',
      'dim3.req05',
      'dim3.req06',
      'dim3.req07',
    ]);
    expect(DIM3_REQUIREMENTS_V0.slice(7).map((r) => r.id)).toEqual(['dim3.req08', 'dim3.req09']);
  });

  it('ejes, dependsOn, packageId y rectorBindings de los requisitos nuevos (spec §3)', () => {
    const byId = new Map(DIM3_REQUIREMENTS_V0.map((r) => [r.id, r]));
    const req08 = byId.get('dim3.req08')!;
    const req09 = byId.get('dim3.req09')!;

    expect(req08.eje).toBe('validez');
    expect(req08.dependsOn).toEqual([]);
    expect(req08.packageId).toBe('pkg.espacio.hoja');
    expect(req08.estado).toBe('active');

    expect(req09.eje).toBe('validez');
    expect(req09.dependsOn).toEqual(['dim3.req08']); // dependencia intra-dimensión
    expect(req09.packageId).toBe('pkg.espacio.sangrado');
    expect(req09.estado).toBe('active');

    // adenda §2: ningún requisito de la adenda declara rectoras
    expect(req08.rectorBindings).toEqual([]);
    expect(req09.rectorBindings).toEqual([]);
    expect(req08.mapsToKinds).toEqual([]);
    expect(req09.mapsToKinds).toEqual([]);
  });

  it('req08: una hoja declarada a la medida, dentro del tope, resuelve la dimensión completa', () => {
    const payloads = resolvedDim3Payloads();
    payloads.set('dim3.req08', {
      formato: 'medida-declarada',
      medida: { ancho: '1181px', alto: '1748px' },
      orientacion: 'apaisada',
      modo: 'pagina-fija',
    });
    const evaluation = evaluateManifest({
      manifest: DIM3_MANIFEST_V0,
      payloads,
      rectoras: emptyRectoras(),
    });
    expect(evaluation.resultado).toBe('resuelto');
    expect(evaluation.contador).toEqual({ resueltos: 9, activos: 9 });
  });

  it('req08 cita insumo 1 ("nunca una hoja inventada"): medida-declarada sin medida ⇒ no-resuelto, con cascada sobre req09', () => {
    const payloads = resolvedDim3Payloads();
    payloads.set('dim3.req08', {
      formato: 'medida-declarada',
      orientacion: 'vertical',
      modo: 'pagina-fija',
    });
    const evaluation = evaluateManifest({
      manifest: DIM3_MANIFEST_V0,
      payloads,
      rectoras: emptyRectoras(),
    });
    expect(evaluation.resultado).toBe('no-resuelto');
    expect(evaluation.resultados.find((r) => r.requisitoId === 'dim3.req08')?.resultado).toBe(
      'no-resuelto',
    );
    // cascada: req09 depende de req08 y cae con él
    expect(evaluation.resultados.find((r) => r.requisitoId === 'dim3.req09')?.resultado).toBe(
      'no-resuelto',
    );
    expect(evaluation.contador).toEqual({ resueltos: 7, activos: 9 });
  });

  it('req08 cita insumo 1 ("lado ≤ 8000"): un lado de 9000 px ⇒ no-resuelto, con cascada sobre req09', () => {
    const payloads = resolvedDim3Payloads();
    payloads.set('dim3.req08', {
      formato: 'medida-declarada',
      medida: { ancho: '9000px', alto: '6000px' },
      orientacion: 'vertical',
      modo: 'pagina-fija',
    });
    const evaluation = evaluateManifest({
      manifest: DIM3_MANIFEST_V0,
      payloads,
      rectoras: emptyRectoras(),
    });
    expect(evaluation.resultado).toBe('no-resuelto');
    expect(evaluation.resultados.find((r) => r.requisitoId === 'dim3.req08')?.resultado).toBe(
      'no-resuelto',
    );
    expect(evaluation.resultados.find((r) => r.requisitoId === 'dim3.req09')?.resultado).toBe(
      'no-resuelto',
    );
    expect(evaluation.contador).toEqual({ resueltos: 7, activos: 9 });
  });

  it('req09 cita insumo 3: zona segura de 39 px (< 40) sin razón escrita ⇒ no-resuelto', () => {
    const payloads = resolvedDim3Payloads();
    payloads.set('dim3.req09', { ...sangradoResuelto(), zonaSegura: '39px' });
    const evaluation = evaluateManifest({
      manifest: DIM3_MANIFEST_V0,
      payloads,
      rectoras: emptyRectoras(),
    });
    expect(evaluation.resultado).toBe('no-resuelto');
    expect(evaluation.resultados.find((r) => r.requisitoId === 'dim3.req09')?.resultado).toBe(
      'no-resuelto',
    );
    expect(evaluation.contador).toEqual({ resueltos: 8, activos: 9 });
  });

  it('req09 citas insumos 3 y 4: margen del texto corrido de 60 px (< 72) sin razón escrita ⇒ no-resuelto', () => {
    const payloads = resolvedDim3Payloads();
    payloads.set('dim3.req09', { ...sangradoResuelto(), margenTextoCorrido: '60px' });
    const evaluation = evaluateManifest({
      manifest: DIM3_MANIFEST_V0,
      payloads,
      rectoras: emptyRectoras(),
    });
    expect(evaluation.resultado).toBe('no-resuelto');
    expect(evaluation.resultados.find((r) => r.requisitoId === 'dim3.req09')?.resultado).toBe(
      'no-resuelto',
    );
    expect(evaluation.contador).toEqual({ resueltos: 8, activos: 9 });
  });

  it('req09 "aSangre" vacío no es una declaración ⇒ no-resuelto (fail-closed)', () => {
    const payloads = resolvedDim3Payloads();
    payloads.set('dim3.req09', { ...sangradoResuelto(), aSangre: [] });
    const evaluation = evaluateManifest({
      manifest: DIM3_MANIFEST_V0,
      payloads,
      rectoras: emptyRectoras(),
    });
    expect(evaluation.resultados.find((r) => r.requisitoId === 'dim3.req09')?.resultado).toBe(
      'no-resuelto',
    );
    expect(evaluation.contador).toEqual({ resueltos: 8, activos: 9 });
  });

  it('req09 canal de ausencia: umbrales cortos + razón escrita ⇒ resuelto', () => {
    const payloads = resolvedDim3Payloads();
    payloads.set('dim3.req09', {
      ...sangradoResuelto(),
      zonaSegura: '24px',
      margenTextoCorrido: '48px',
      excepcion: 'la imprenta confirmó márgenes reducidos por el plegado del tríptico',
    });
    const evaluation = evaluateManifest({
      manifest: DIM3_MANIFEST_V0,
      payloads,
      rectoras: emptyRectoras(),
    });
    expect(evaluation.resultado).toBe('resuelto');
    expect(evaluation.resultados.find((r) => r.requisitoId === 'dim3.req09')?.resultado).toBe(
      'resuelto',
    );
    expect(evaluation.contador).toEqual({ resueltos: 9, activos: 9 });
  });

  it('req09 exclusión mutua: cumplir los dos umbrales Y escribir la excepción ⇒ no-resuelto', () => {
    const payloads = resolvedDim3Payloads();
    payloads.set('dim3.req09', {
      ...sangradoResuelto(),
      excepcion: 'la escribo igual aunque los umbrales se cumplen',
    });
    const evaluation = evaluateManifest({
      manifest: DIM3_MANIFEST_V0,
      payloads,
      rectoras: emptyRectoras(),
    });
    expect(evaluation.resultado).toBe('no-resuelto');
    expect(evaluation.resultados.find((r) => r.requisitoId === 'dim3.req09')?.resultado).toBe(
      'no-resuelto',
    );
    expect(evaluation.contador).toEqual({ resueltos: 8, activos: 9 });
  });
});
