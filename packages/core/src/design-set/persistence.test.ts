import { describe, expect, it } from 'vitest';
import { parseDesignSet, serializeDesignSet, validateDesignSetShape } from './persistence.js';
import type { DesignSetV0 } from './types.js';

function validSet(): DesignSetV0 {
  return {
    schemaVersion: 1,
    designSetId: 'ds-test-1',
    manifestRefs: { dim1: { manifestVersion: '1.0', revision: 1 } },
    entries: [
      {
        requirementId: 'dim1.req01',
        effectiveDefinitionId: 'def-1',
        resolutionPath: 'diseñador',
        payload: { institucionales: [], neutros: [] },
        provenance: { fuente: 'usuario' },
        fuerza: 'inamovible',
        cicloDeVida: 'aprobada',
        revision: 1,
        mapsToKinds: [],
      },
    ],
  };
}

describe('DesignSet persistence (exportar/importar, spec-c2 §9.1)', () => {
  it('serializa y vuelve a parsear un set válido sin pérdida (round-trip)', () => {
    const original = validSet();
    const json = serializeDesignSet(original);
    const restored = parseDesignSet(json);
    expect(restored).toEqual(original);
  });

  it('rechaza en bloque un JSON ilegible al importar', () => {
    expect(() => parseDesignSet('{ esto no es json')).toThrow(/ilegible/);
  });

  it('rechaza en bloque un schemaVersion desconocido', () => {
    const bad = { ...validSet(), schemaVersion: 2 };
    const result = validateDesignSetShape(bad);
    expect(result.ok).toBe(false);
    expect(result.errores.some((e) => e.codigo === 'version-desconocida')).toBe(true);
    expect(() => parseDesignSet(JSON.stringify(bad))).toThrow(/rechazo en bloque/);
  });

  it('rechaza en bloque una entrada con campo obligatorio ausente', () => {
    const set = validSet();
    const { revision: _revision, ...entryWithoutRevision } = set.entries[0]!;
    const bad = { ...set, entries: [entryWithoutRevision] };
    const result = validateDesignSetShape(bad);
    expect(result.ok).toBe(false);
    expect(result.errores.some((e) => e.codigo === 'entrada-incompleta')).toBe(true);
  });

  it('rechaza en bloque un requirementId duplicado, no lo exporta en silencio', () => {
    const set = validSet();
    set.entries.push({ ...set.entries[0]! });
    expect(() => serializeDesignSet(set)).toThrow(/duplicada|rechazo en bloque/);
  });

  it('rechaza en bloque una referencia colgante', () => {
    const set = validSet();
    set.entries[0]!.payload = { rota: { refReqId: 'dim1.req99', refPath: [] } };
    expect(() => serializeDesignSet(set)).toThrow(/rechazo en bloque/);
    const result = validateDesignSetShape(set);
    expect(result.errores.some((e) => e.codigo === 'referencia-colgante')).toBe(true);
  });
});
