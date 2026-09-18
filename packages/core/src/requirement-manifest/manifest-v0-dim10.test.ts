import { describe, expect, it } from 'vitest';
import { evaluateManifest } from './evaluate';
import { parseRequirementManifest } from './graph';
import { DIM10_MANIFEST_V0, DIM10_REQUIREMENTS_V0 } from './manifest-v0-dim10';
import type { PredicateClause } from './predicate';
import type { RectoraV0, VerificationRecordV0 } from './types';

/** Ids exactos de la dimensión, en el orden del documento (spec §3). */
const IDS_DIM10 = ['dim10.req01', 'dim10.req02', 'dim10.req03', 'dim10.req04', 'dim10.req05'] as const;

/** La dimensión no vincula rectora ninguna: noConflict imposible por construcción. */
const emptyRectoras = (): Map<string, RectoraV0> => new Map<string, RectoraV0>();

/** Verificación registrada de dim10.req05 (`verified('salida-fisica-confirmada')`). */
const VERIFICATIONS = (): Map<string, VerificationRecordV0> =>
  new Map<string, VerificationRecordV0>([
    [
      'salida-fisica-confirmada',
      {
        pruebaId: 'salida-fisica-confirmada',
        fecha: '2026-09-18',
        evidencia: 'acta firmada por el taller de encuadernación sobre la prueba digital',
      },
    ],
  ]);

/** Payloads que resuelven las cinco preguntas (fixture de test). */
function resolvedDim10Payloads(): Map<string, unknown> {
  const m = new Map<string, unknown>();

  m.set('dim10.req01', {
    declaracion: 'interior en papel bond 90 g/m² y tapa en cartulina 300 g/m²',
    acota: ['dim4'],
    ejecuta: 'proveedor',
  });

  m.set('dim10.req02', {
    declaracion: 'laminado mate en la tapa y reserva UV sobre el logotipo',
    acota: ['dim1', 'dim5'],
    ejecuta: 'proveedor',
  });

  m.set('dim10.req03', {
    declaracion: 'troquel de media luna en la tapa y corte al ras en el resto',
    acota: ['dim3', 'dim4'],
    ejecuta: 'proveedor',
  });

  m.set('dim10.req04', {
    declaracion: 'cuadernillos de 8 páginas cosidos con hilo y encolados a la tapa (hotmelt)',
    acota: ['dim3'],
    ejecuta: 'proveedor',
  });

  m.set('dim10.req05', {
    confirmadoPor: 'Imprenta Andina, taller de encuadernación',
    nota: 'confirmado sobre la prueba digital firmada el 18-09-2026',
  });

  return m;
}

/**
 * Sistema sólo pantalla (decisión 15): las cuatro preguntas materiales se
 * responden con «no aplica» escrito, no con el hueco vacío. El payload lleva
 * SÓLO `noAplica`, sin `declaracion` ni `ejecuta`.
 */
function soloPantallaPayloads(): Map<string, unknown> {
  const m = new Map<string, unknown>();
  const declaraNoAplica = (id: string, eje: string): void => {
    m.set(id, { noAplica: `el sistema es sólo pantalla: no tiene ${eje} que declarar` });
  };
  declaraNoAplica('dim10.req01', 'soportes ni materiales');
  declaraNoAplica('dim10.req02', 'acabados de superficie');
  declaraNoAplica('dim10.req03', 'terminaciones');
  declaraNoAplica('dim10.req04', 'sistema de encuadernación');
  m.set('dim10.req05', {
    confirmadoPor: 'equipo de producto',
    nota: 'la confirmación cubre que la salida física no aplica y que las cuatro lo declaran por escrito',
  });
  return m;
}

const evaluar = (payloads: Map<string, unknown>) =>
  evaluateManifest({
    manifest: DIM10_MANIFEST_V0,
    payloads,
    rectoras: emptyRectoras(),
    verifications: VERIFICATIONS(),
  });

const resultadoDe = (payloads: Map<string, unknown>, requisitoId: string): string | undefined =>
  evaluar(payloads).resultados.find((r) => r.requisitoId === requisitoId)?.resultado;

describe('manifiesto v0 de Dimensión 10 — fidelidad a la spec C1-dim10 §3', () => {
  it('el documento parsea limpio (grafo acíclico, IDs estables, sin brechas silenciosas)', () => {
    const result = parseRequirementManifest(DIM10_MANIFEST_V0);
    expect(result.ok).toBe(true);
  });

  it('contiene los cinco requisitos: dim10.req01..req05', () => {
    expect(DIM10_REQUIREMENTS_V0.map((r) => r.id)).toEqual([...IDS_DIM10]);
    expect(DIM10_MANIFEST_V0.requirements.map((r) => r.id)).toEqual([...IDS_DIM10]);
  });

  it('respeta ejes y dependsOn de la spec §3 (req05 cierra las cuatro anteriores)', () => {
    const byId = new Map(DIM10_REQUIREMENTS_V0.map((r) => [r.id, r]));
    expect(byId.get('dim10.req01')?.eje).toBe('completitud');
    expect(byId.get('dim10.req02')?.eje).toBe('completitud');
    expect(byId.get('dim10.req03')?.eje).toBe('completitud');
    expect(byId.get('dim10.req04')?.eje).toBe('completitud');
    expect(byId.get('dim10.req05')?.eje).toBe('validez');

    expect(byId.get('dim10.req01')?.dependsOn).toEqual([]);
    expect(byId.get('dim10.req02')?.dependsOn).toEqual(['dim10.req01']);
    expect(byId.get('dim10.req03')?.dependsOn).toEqual(['dim10.req01']);
    expect(byId.get('dim10.req04')?.dependsOn).toEqual(['dim10.req01']);
    expect(byId.get('dim10.req05')?.dependsOn).toEqual([
      'dim10.req01',
      'dim10.req02',
      'dim10.req03',
      'dim10.req04',
    ]);

    // dependsOn sólo con ids de esta dimensión, todos existentes y activos
    const ids = new Set(DIM10_REQUIREMENTS_V0.filter((r) => r.estado === 'active').map((r) => r.id));
    for (const req of DIM10_REQUIREMENTS_V0) {
      for (const dep of req.dependsOn) {
        expect(dep.startsWith('dim10.'), dep).toBe(true);
        expect(ids.has(dep), dep).toBe(true);
      }
    }
  });

  it('packageIds con prefijo pkg.salida. y dimensionId dim10 en las cinco', () => {
    const byId = new Map(DIM10_REQUIREMENTS_V0.map((r) => [r.id, r]));
    expect(byId.get('dim10.req01')?.packageId).toBe('pkg.salida.materialidad');
    expect(byId.get('dim10.req02')?.packageId).toBe('pkg.salida.acabado');
    expect(byId.get('dim10.req03')?.packageId).toBe('pkg.salida.terminaciones');
    expect(byId.get('dim10.req04')?.packageId).toBe('pkg.salida.encuadernacion');
    expect(byId.get('dim10.req05')?.packageId).toBe('pkg.salida.confirmacion');
    for (const req of DIM10_REQUIREMENTS_V0) {
      expect(req.dimensionId).toBe('dim10');
      expect(req.estado).toBe('active');
    }
  });

  it('rectorBindings vacíos (la salida física no está entre los dominios del mood wall)', () => {
    for (const req of DIM10_REQUIREMENTS_V0) {
      expect(req.rectorBindings, req.id).toEqual([]);
    }
  });

  it('declara las cinco brechas de mapeo vacías con mappingNotes (nunca silenciosas)', () => {
    const empties = DIM10_REQUIREMENTS_V0.filter((r) => r.mapsToKinds.length === 0);
    expect(empties.map((r) => r.id)).toEqual([...IDS_DIM10]);
    for (const req of empties) {
      expect(req.mappingNotes, req.id).toBeDefined();
      expect(req.mappingNotes?.length, req.id).toBeGreaterThan(0);
    }
  });

  it('la forma común: los cuatro campos del payload y el predicado `or(and(exists,exists),exists)`', () => {
    const byId = new Map(DIM10_REQUIREMENTS_V0.map((r) => [r.id, r]));
    for (const id of ['dim10.req01', 'dim10.req02', 'dim10.req03', 'dim10.req04']) {
      const req = byId.get(id);
      expect(Object.keys(req?.payloadSchema ?? {}).sort(), id).toEqual([
        'acota',
        'declaracion',
        'ejecuta',
        'noAplica',
      ]);
      expect(req?.validityPredicate.map((c) => c.kind), id).toEqual(['or']);
    }
    const req05 = byId.get('dim10.req05');
    expect(Object.keys(req05?.payloadSchema ?? {}).sort()).toEqual(['confirmadoPor', 'nota']);
    expect(req05?.validityPredicate).toEqual([{ kind: 'verified', pruebaId: 'salida-fisica-confirmada' }]);
  });

  it('CERO PROSA: la serialización es el dato (round-trip JSON) y cada cláusula es del union conocido', () => {
    const roundTripped = JSON.parse(JSON.stringify(DIM10_MANIFEST_V0));
    expect(roundTripped).toEqual(DIM10_MANIFEST_V0);

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
    for (const req of DIM10_REQUIREMENTS_V0) {
      for (const clause of req.validityPredicate) visit(clause);
    }
  });

  it('la dimensión nace 1.0 / rev 1 (alfa cero, sin deprecaciones)', () => {
    expect(DIM10_MANIFEST_V0.schemaVersion).toBe(1);
    expect(DIM10_MANIFEST_V0.manifestVersion).toBe('1.0');
    expect(DIM10_MANIFEST_V0.revision).toBe(1);
    expect(DIM10_MANIFEST_V0.deprecations).toBeUndefined();
  });
});

describe('evaluación de la Dimensión 10 completa', () => {
  it('dimensión resuelta cuando las cinco preguntas tienen definición efectiva válida', () => {
    const evaluation = evaluar(resolvedDim10Payloads());
    expect(evaluation.resultado).toBe('resuelto');
    expect(evaluation.contador).toEqual({ resueltos: 5, activos: 5 });
    expect(evaluation.resultados.every((r) => r.resultado === 'resuelto')).toBe(true);
  });

  it('req05 sin la verificación `salida-fisica-confirmada` registrada ⇒ no-resuelto', () => {
    const evaluation = evaluateManifest({
      manifest: DIM10_MANIFEST_V0,
      payloads: resolvedDim10Payloads(),
      rectoras: emptyRectoras(),
    });
    expect(evaluation.resultados.find((r) => r.requisitoId === 'dim10.req05')?.resultado).toBe(
      'no-resuelto',
    );
    // req05 no tiene dependientes: la cascada es sólo él mismo
    expect(evaluation.contador).toEqual({ resueltos: 4, activos: 5 });
    expect(evaluation.resultado).toBe('no-resuelto');
  });

  it('sistema sólo pantalla: «no aplica» escrito en las cuatro y req05 confirmado ⇒ resuelto', () => {
    const evaluation = evaluar(soloPantallaPayloads());
    expect(evaluation.resultado).toBe('resuelto');
    expect(evaluation.contador).toEqual({ resueltos: 5, activos: 5 });
    for (const id of ['dim10.req01', 'dim10.req02', 'dim10.req03', 'dim10.req04']) {
      expect(evaluation.resultados.find((r) => r.requisitoId === id)?.resultado, id).toBe('resuelto');
    }
  });

  it('un payload con `declaracion` sin `ejecuta` NO resuelve (verdad vacía cerrada)', () => {
    const payloads = resolvedDim10Payloads();
    payloads.set('dim10.req02', { declaracion: 'laminado mate en la tapa' });
    expect(resultadoDe(payloads, 'dim10.req02')).toBe('no-resuelto');
    const evaluation = evaluar(payloads);
    // req05 depende de req02: caen los dos; req01/req03/req04 quedan resueltos
    expect(evaluation.contador).toEqual({ resueltos: 3, activos: 5 });
    expect(evaluation.resultados.find((r) => r.requisitoId === 'dim10.req05')?.resultado).toBe(
      'no-resuelto',
    );
  });

  it('un payload vacío (ni declaración ejecutable ni «no aplica») tampoco resuelve', () => {
    const payloads = resolvedDim10Payloads();
    payloads.set('dim10.req01', {});
    expect(resultadoDe(payloads, 'dim10.req01')).toBe('no-resuelto');
    // req01 es la raíz de la que cuelgan las otras cuatro: la cascada las tumba todas
    expect(evaluar(payloads).contador).toEqual({ resueltos: 0, activos: 5 });
  });
});
