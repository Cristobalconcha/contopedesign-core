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

/** Payloads que resuelven las nueve preguntas de la dimensión (fixture de test). */
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

  // dim5.req09 (adenda 2026-09-18): foto e ilustración declaran número;
  // iconografía, símbolos y marcas usan el canal de ausencia («no aplica»).
  m.set('dim5.req09', {
    resoluciones: MEDIA_ROLES_5.map((role) =>
      role === 'fotografia' || role === 'ilustracion'
        ? { rol: role, resolucionMinimaPpp: 300 }
        : {
            rol: role,
            noAplica: `no aplica a ${role}: se reproduce vectorial, la densidad de píxeles no lo describe`,
          },
    ),
    politica: {
      modo: 'sustituir',
      texto:
        'si el medio no alcanza la resolución mínima declarada al tamaño de salida, se sustituye por una pieza del banco con densidad suficiente',
    },
  });

  return m;
}

const clonar = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T;
const req09Payload = (): { resoluciones: Array<Record<string, unknown>>; politica: unknown } =>
  clonar(
    resolvedDim5Payloads().get('dim5.req09') as {
      resoluciones: Array<Record<string, unknown>>;
      politica: unknown;
    },
  );

const resultadoDe = (
  payloads: Map<string, unknown>,
  requisitoId: string,
): string | undefined =>
  evaluateManifest({ manifest: DIM5_MANIFEST_V0, payloads, rectoras: emptyRectoras() }).resultados.find(
    (r) => r.requisitoId === requisitoId,
  )?.resultado;

describe('manifiesto v0 de Dimensión 5 — fidelidad a la spec C1-dim5 §2', () => {
  it('el documento parsea limpio (grafo acíclico, IDs estables, sin brechas silenciosas)', () => {
    const result = parseRequirementManifest(DIM5_MANIFEST_V0);
    expect(result.ok).toBe(true);
  });

  it('contiene los nueve requisitos: dim5.req01..req09', () => {
    expect(DIM5_REQUIREMENTS_V0.map((r) => r.id)).toEqual([
      'dim5.req01',
      'dim5.req02',
      'dim5.req03',
      'dim5.req04',
      'dim5.req05',
      'dim5.req06',
      'dim5.req07',
      'dim5.req08',
      'dim5.req09',
    ]);
    // el requisito nuevo entra AL FINAL, después de los ocho existentes
    expect(DIM5_REQUIREMENTS_V0[DIM5_REQUIREMENTS_V0.length - 1]?.id).toBe('dim5.req09');
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
    expect(byId.get('dim5.req09')?.rectorBindings).toEqual([]);
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
      'dim5.req09',
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

  it('la adenda es MINOR: sube a 1.1 / rev 2 y no toca los ocho predicados existentes', () => {
    expect(DIM5_MANIFEST_V0.manifestVersion).toBe('1.1');
    expect(DIM5_MANIFEST_V0.revision).toBe(2);
    expect(DIM5_MANIFEST_V0.requirements.map((r) => r.id)).toEqual(
      DIM5_REQUIREMENTS_V0.map((r) => r.id),
    );
  });

  it('dim5.req09 (adenda 2026-09-18): eje, dependsOn, packageId y destino intra-dimensión', () => {
    const byId = new Map(DIM5_REQUIREMENTS_V0.map((r) => [r.id, r]));
    const req09 = byId.get('dim5.req09');
    expect(req09?.dimensionId).toBe('dim5');
    expect(req09?.packageId).toBe('pkg.imagen.reproduccion');
    expect(req09?.eje).toBe('completitud'); // pasada 1: sin cita no hay umbral
    expect(req09?.estado).toBe('active');
    expect(req09?.dependsOn).toEqual(['dim5.req02']);
    expect(req09?.mapsToKinds).toEqual([]);
    expect((req09?.mappingNotes ?? '').length).toBeGreaterThan(0);

    // dependsOn sólo con ids de esta dimensión, todos existentes y activos
    const ids = new Set(DIM5_REQUIREMENTS_V0.filter((r) => r.estado === 'active').map((r) => r.id));
    for (const dep of req09?.dependsOn ?? []) {
      expect(dep.startsWith('dim5.'), dep).toBe(true);
      expect(ids.has(dep), dep).toBe(true);
    }
  });

  it('dim5.req09 declara el payloadSchema y las cláusulas de la spec §3 (sin umbral inventado)', () => {
    const req09 = DIM5_REQUIREMENTS_V0.find((r) => r.id === 'dim5.req09');
    const schema = req09?.payloadSchema ?? {};
    expect(Object.keys(schema).sort()).toEqual(['politica', 'resoluciones']);
    expect(req09?.validityPredicate.map((c) => c.kind)).toEqual([
      'covers',
      'each',
      'each',
      'exists',
      'exists',
    ]);
  });
});

describe('evaluación de la Dimensión 5 completa', () => {
  it('dimensión resuelta cuando las nueve preguntas tienen definición efectiva válida', () => {
    const evaluation = evaluateManifest({
      manifest: DIM5_MANIFEST_V0,
      payloads: resolvedDim5Payloads(),
      rectoras: emptyRectoras(),
    });
    expect(evaluation.resultado).toBe('resuelto');
    expect(evaluation.contador).toEqual({ resueltos: 9, activos: 9 });
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
    // req03 no tiene dependientes: la cascada es sólo él mismo
    expect(evaluation.contador).toEqual({ resueltos: 8, activos: 9 });
    expect(evaluation.resultados.find((r) => r.requisitoId === 'dim5.req03')?.resultado).toBe(
      'no-resuelto',
    );
  });

  it('req02 "covers": falta uno de los cinco roles de medios ⇒ no-resuelto y cascada por dependsOn', () => {
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
    // req02 tiene dependientes: req03..req09 caen en cascada; sólo req01 queda resuelto
    expect(evaluation.contador).toEqual({ resueltos: 1, activos: 9 });
    for (const id of ['dim5.req03', 'dim5.req04', 'dim5.req05', 'dim5.req06', 'dim5.req07', 'dim5.req08', 'dim5.req09']) {
      expect(evaluation.resultados.find((r) => r.requisitoId === id)?.resultado, id).toBe(
        'no-resuelto',
      );
    }
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
    expect(evaluation.contador).toEqual({ resueltos: 8, activos: 9 });
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
    expect(evaluation.contador).toEqual({ resueltos: 8, activos: 9 });
  });

  // -------------------------------------------------------------------------
  // dim5.req09 — adenda del núcleo editorial (2026-09-18, spec §3)
  // Sin umbral con cita (pasada 1, tensión 9 resuelta): no hay prueba de umbral
  // que romper; lo que se prueba es el canal de ausencia y su exclusión mutua.
  // -------------------------------------------------------------------------

  it('req09 canal de ausencia: los cinco roles pueden declarar «no aplica» con su razón ⇒ resuelto', () => {
    const payloads = resolvedDim5Payloads();
    payloads.set('dim5.req09', {
      resoluciones: MEDIA_ROLES_5.map((rol) => ({
        rol,
        noAplica: `no aplica a ${rol}: la pieza es vectorial y no se mide en puntos por pulgada`,
      })),
      politica: {
        modo: 'aceptar-con-nota',
        texto: 'si algún medio no vectorial no alcanza la resolución mínima, se acepta dejando la nota en el expediente',
      },
    });
    const evaluation = evaluateManifest({
      manifest: DIM5_MANIFEST_V0,
      payloads,
      rectoras: emptyRectoras(),
    });
    expect(evaluation.resultados.find((r) => r.requisitoId === 'dim5.req09')?.resultado).toBe(
      'resuelto',
    );
    expect(evaluation.contador).toEqual({ resueltos: 9, activos: 9 });
    expect(evaluation.resultado).toBe('resuelto');
  });

  it('req09 exclusión mutua: un rol que declara número Y «no aplica» a la vez ⇒ no-resuelto', () => {
    const payloads = resolvedDim5Payloads();
    const base = req09Payload();
    payloads.set('dim5.req09', {
      ...base,
      resoluciones: base.resoluciones.map((r) =>
        r['rol'] === 'iconografia' ? { ...r, resolucionMinimaPpp: 600 } : r,
      ),
    });
    const evaluation = evaluateManifest({
      manifest: DIM5_MANIFEST_V0,
      payloads,
      rectoras: emptyRectoras(),
    });
    expect(evaluation.resultados.find((r) => r.requisitoId === 'dim5.req09')?.resultado).toBe(
      'no-resuelto',
    );
    // req09 no tiene dependientes: la cascada es sólo él mismo
    expect(evaluation.contador).toEqual({ resueltos: 8, activos: 9 });
    expect(evaluation.resultado).toBe('no-resuelto');
  });

  it('req09 completitud: un rol sin número y sin «no aplica» deja el hueco mudo ⇒ no-resuelto', () => {
    const payloads = resolvedDim5Payloads();
    const base = req09Payload();
    payloads.set('dim5.req09', {
      ...base,
      resoluciones: base.resoluciones.map((r) =>
        r['rol'] === 'fotografia' ? { rol: 'fotografia' } : r,
      ),
    });
    expect(resultadoDe(payloads, 'dim5.req09')).toBe('no-resuelto');
    const evaluation = evaluateManifest({
      manifest: DIM5_MANIFEST_V0,
      payloads,
      rectoras: emptyRectoras(),
    });
    expect(evaluation.contador).toEqual({ resueltos: 8, activos: 9 });
  });

  it('req09 "covers": falta uno de los cinco roles de medio ⇒ no-resuelto', () => {
    const payloads = resolvedDim5Payloads();
    const base = req09Payload();
    payloads.set('dim5.req09', { ...base, resoluciones: base.resoluciones.slice(0, 4) });
    const evaluation = evaluateManifest({
      manifest: DIM5_MANIFEST_V0,
      payloads,
      rectoras: emptyRectoras(),
    });
    expect(evaluation.resultados.find((r) => r.requisitoId === 'dim5.req09')?.resultado).toBe(
      'no-resuelto',
    );
    expect(evaluation.contador).toEqual({ resueltos: 8, activos: 9 });
  });

  it('req09 "politica": sin modo ni texto no hay política para el medio que no llega ⇒ no-resuelto', () => {
    const payloads = resolvedDim5Payloads();
    const base = req09Payload();
    payloads.set('dim5.req09', { resoluciones: base.resoluciones, politica: { texto: 'sin modo declarado' } });
    expect(resultadoDe(payloads, 'dim5.req09')).toBe('no-resuelto');
  });
});
