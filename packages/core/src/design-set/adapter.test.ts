import { describe, expect, it } from 'vitest';
import { evaluateManifest } from '../requirement-manifest/evaluate.js';
import { DIM1_MANIFEST_V0 } from '../requirement-manifest/manifest-v0-dim1.js';
import { buildDim1DesignSet, emptyRectoras, VERIFICATIONS } from './dim1-fixture.js';
import {
  findDanglingRefs,
  findDuplicateEntries,
  findEntry,
  resolveRefValue,
  toFullPayloadsMap,
  toPayloadsMap,
} from './adapter.js';

describe('DesignSet (C2, borrador) — puente con el evaluador real de C1', () => {
  it('toFullPayloadsMap + evaluateManifest resuelven la Dimensión 1 completa (todos sus requisitos activos), igual que el test de C1', () => {
    const designSet = buildDim1DesignSet();
    const evaluation = evaluateManifest({
      manifest: DIM1_MANIFEST_V0,
      payloads: toFullPayloadsMap(designSet),
      rectoras: emptyRectoras(),
      verifications: VERIFICATIONS,
    });
    expect(evaluation.resultado).toBe('resuelto');
    // Contra el manifiesto real, no contra un número escrito a mano: dim1 creció a 14 el 2026-09-18.
    const activos = DIM1_MANIFEST_V0.requirements.filter((r) => r.estado === 'active').length;
    expect(evaluation.contador).toEqual({ resueltos: activos, activos });
  });

  it('sin entradas colgantes en el fixture real', () => {
    expect(findDanglingRefs(buildDim1DesignSet())).toEqual([]);
  });

  it('sin duplicados en el fixture real', () => {
    expect(findDuplicateEntries(buildDim1DesignSet())).toEqual([]);
  });

  it('detecta una referencia colgante inyectada a propósito', () => {
    const designSet = buildDim1DesignSet();
    designSet.entries.push({
      requirementId: 'dim1.req13',
      effectiveDefinitionId: 'def-extra',
      resolutionPath: 'diseñador',
      payload: { rotoRef: { refReqId: 'dim1.req99', refPath: [] } },
      provenance: { fuente: 'usuario' },
      fuerza: 'explorable',
      cicloDeVida: 'propuesta',
      revision: 1,
      mapsToKinds: [],
    });
    // Nota: esta entrada duplica dim1.req13 a propósito para el caso de prueba;
    // findDuplicateEntries() debe verla, findDanglingRefs() debe ver la ref rota.
    expect(findDuplicateEntries(designSet)).toEqual(['dim1.req13']);
    const dangling = findDanglingRefs(designSet);
    expect(dangling).toContainEqual({ requirementId: 'dim1.req13', refiereA: 'dim1.req99' });
  });

  it('un requirementId duplicado hace fallar toFullPayloadsMap/toPayloadsMap en vez de resolver en silencio (observación de auditoría de Z)', () => {
    const designSet = buildDim1DesignSet();
    designSet.entries.push({ ...designSet.entries[0]! }); // duplica dim1.req01
    expect(() => toFullPayloadsMap(designSet)).toThrow(/duplicada/);
    expect(() => toPayloadsMap(designSet, 'dim1')).toThrow(/duplicada/);
  });

  it('quitar una entrada del set vuelve la dimensión NO-resuelta (fail-closed a través del adaptador)', () => {
    const designSet = buildDim1DesignSet();
    designSet.entries = designSet.entries.filter((e) => e.requirementId !== 'dim1.req01');
    const evaluation = evaluateManifest({
      manifest: DIM1_MANIFEST_V0,
      payloads: toFullPayloadsMap(designSet),
      rectoras: emptyRectoras(),
      verifications: VERIFICATIONS,
    });
    expect(evaluation.resultado).toBe('no-resuelto');
    expect(evaluation.contador.resueltos).toBeLessThan(13);
  });
});

describe('resolveRefValue — resolución real de RefValue dentro de un DesignSet', () => {
  it('resuelve una ref real de un solo nivel (dim1.req02.roleColors[0].color -> dim1.req01.institucionales[0].value)', () => {
    const designSet = buildDim1DesignSet();
    const req02 = findEntry(designSet, 'dim1.req02')!;
    const roleColors = (req02.payload as { roleColors: Array<{ color: unknown }> }).roleColors;
    const ref = roleColors[0]!.color; // = ref01(0) en el fixture: refReqId dim1.req01, refPath institucionales[0].value
    const result = resolveRefValue(designSet, ref as Parameters<typeof resolveRefValue>[1]);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBe('#1d4ed8'); // azul-institucional real del fixture
    }
  });

  it('entrada ausente da error explícito, no undefined silencioso', () => {
    const designSet = buildDim1DesignSet();
    designSet.entries = designSet.entries.filter((e) => e.requirementId !== 'dim1.req02');
    const result = resolveRefValue(designSet, { refReqId: 'dim1.req02', refPath: ['roleColors', 0, 'color'] });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.codigo).toBe('entrada-ausente');
  });

  it('ruta inválida (índice fuera de rango) da error explícito', () => {
    const designSet = buildDim1DesignSet();
    const result = resolveRefValue(designSet, { refReqId: 'dim1.req02', refPath: ['roleColors', 999, 'color'] });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.codigo).toBe('ruta-invalida');
  });

  it('una ref que resuelve a otra RefValue (cadena) da error explícito, no la sigue a ciegas', () => {
    const designSet = buildDim1DesignSet();
    // dim1.req05.surfaces[0].backgroundColor = ref02(0), que apunta a
    // dim1.req02.roleColors[0].color -- ese campo ES OTRA RefValue (ref01(0))
    // en este fixture: resolver de un solo salto aterriza en una ref, no un
    // valor plano. Cadena real, debe fallar explícito en vez de seguirla.
    const req05 = findEntry(designSet, 'dim1.req05')!;
    const surfaces = (req05.payload as { surfaces: Array<{ backgroundColor: unknown }> }).surfaces;
    const chained = resolveRefValue(designSet, surfaces[0]!.backgroundColor as Parameters<typeof resolveRefValue>[1]);
    expect(chained.ok).toBe(false);
    if (!chained.ok) expect(chained.error.codigo).toBe('ref-encadenada');
  });
});
