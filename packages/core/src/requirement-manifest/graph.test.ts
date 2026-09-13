import { describe, expect, it } from 'vitest';
import { detectCycles, parseRequirementManifest } from './graph';
import { DIM1_MANIFEST_V0 } from './manifest-v0-dim1';
import type {
  DeprecationRecordV0,
  DimensionId,
  RequirementManifestV0,
  RequirementV0,
} from './types';

function minimalReq(
  id: string,
  dependsOn: string[] = [],
  estado: 'active' | 'deprecated' = 'active',
): RequirementV0 {
  return {
    id,
    dimensionId: id.slice(0, 4) as DimensionId,
    eje: 'completitud',
    pregunta: `¿Pregunta de prueba para ${id}?`,
    packageId: 'pkg.color.test',
    dependsOn,
    payloadSchema: { item: { type: { kind: 'texto' } } },
    validityPredicate: [{ kind: 'exists', target: ['item'] }],
    rectorBindings: [],
    mapsToKinds: [],
    estado,
  };
}

function manifest(
  requirements: RequirementV0[],
  deprecations?: DeprecationRecordV0[],
): RequirementManifestV0 {
  return {
    schemaVersion: 1,
    manifestVersion: '1.0',
    revision: 1,
    requirements,
    ...(deprecations !== undefined ? { deprecations } : {}),
  };
}

describe('parseRequirementManifest — forma del documento', () => {
  it('acepta el manifiesto v0 de Dimensión 1', () => {
    const result = parseRequirementManifest(DIM1_MANIFEST_V0);
    expect(result.ok).toBe(true);
  });

  it('rechaza IDs que no cumplen el patrón exacto', () => {
    const result = parseRequirementManifest(manifest([minimalReq('dim1.req1')]));
    expect(result.ok).toBe(false);
    expect(result.errores.some((e) => e.codigo === 'id-patron-invalido')).toBe(true);
  });

  it('rechaza IDs duplicados', () => {
    const result = parseRequirementManifest(
      manifest([minimalReq('dim1.req01'), minimalReq('dim1.req01')]),
    );
    expect(result.ok).toBe(false);
    expect(result.errores.some((e) => e.codigo === 'id-duplicado')).toBe(true);
  });

  it('rechaza dimensionId incoherente con el prefijo del id', () => {
    const req = { ...minimalReq('dim1.req01'), dimensionId: 'dim2' as DimensionId };
    const result = parseRequirementManifest(manifest([req]));
    expect(result.ok).toBe(false);
    expect(result.errores.some((e) => e.codigo === 'dimension-incoherente')).toBe(true);
  });

  it('rechaza preguntas que no son frases interrogativas', () => {
    const req = { ...minimalReq('dim1.req01'), pregunta: 'esto no pregunta' };
    const result = parseRequirementManifest(manifest([req]));
    expect(result.ok).toBe(false);
    expect(result.errores.some((e) => e.codigo === 'pregunta-invalida')).toBe(true);
  });
});

describe('grafo de dependencias (§4) — rechazo en bloque', () => {
  it('CASO (d): dependencia a ID inexistente ⇒ manifiesto inválido con la referencia rota', () => {
    const result = parseRequirementManifest(
      manifest([minimalReq('dim1.req01'), minimalReq('dim1.req02', ['dim1.req99'])]),
    );
    expect(result.ok).toBe(false);
    const broken = result.errores.find((e) => e.codigo === 'dependencia-inexistente');
    expect(broken?.mensaje).toBe('dep dim1.req02 → dim1.req99: ID no existe');
  });

  it('CASO (c): ciclo ⇒ rechazado con el camino completo del ciclo, determinista', () => {
    const doc = manifest([
      minimalReq('dim1.req01', ['dim1.req02']),
      minimalReq('dim1.req02', ['dim1.req01']),
    ]);
    const result = parseRequirementManifest(doc);
    expect(result.ok).toBe(false);
    expect(result.ciclo).toEqual(['dim1.req01', 'dim1.req02', 'dim1.req01']);
    expect(result.errores.some((e) => e.codigo === 'ciclo')).toBe(true);
  });

  it('reporta TODAS las referencias rotas antes que el ciclo', () => {
    const doc = manifest([
      minimalReq('dim1.req01', ['dim1.req02', 'dim1.req98']),
      minimalReq('dim1.req02', ['dim1.req01', 'dim1.req97']),
    ]);
    const result = parseRequirementManifest(doc);
    expect(result.ok).toBe(false);
    const codes = result.errores.map((e) => e.codigo);
    const firstBroken = codes.indexOf('dependencia-inexistente');
    const firstCycle = codes.indexOf('ciclo');
    expect(codes.filter((c) => c === 'dependencia-inexistente').length).toBe(2);
    expect(firstBroken).toBeLessThan(firstCycle);
  });

  it('dependencia a un requisito deprecado ⇒ inválido', () => {
    const doc = manifest(
      [
        minimalReq('dim1.req01', [], 'deprecated'),
        minimalReq('dim1.req02', ['dim1.req01']),
      ],
      [
        {
          id: 'dim1.req01',
          autor: 'equipo',
          fecha: '2026-08-30',
          motivo: 'reemplazado por dim1.req02',
          sucesorId: 'dim1.req02',
        },
      ],
    );
    const result = parseRequirementManifest(doc);
    expect(result.ok).toBe(false);
    expect(result.errores.some((e) => e.codigo === 'dependencia-deprecada')).toBe(true);
  });

  it('detectCycles devuelve null para un grafo acíclico', () => {
    expect(
      detectCycles([
        minimalReq('dim1.req01'),
        minimalReq('dim1.req02', ['dim1.req01']),
        minimalReq('dim1.req03', ['dim1.req01', 'dim1.req02']),
      ]),
    ).toBeNull();
  });
});

describe('deprecación (§3.3) — registro obligatorio y sucesor válido', () => {
  it('CASO (e): deprecado con sucesor válido ⇒ manifiesto aceptado', () => {
    const doc = manifest(
      [minimalReq('dim1.req01', [], 'deprecated'), minimalReq('dim1.req02', [])],
      [
        {
          id: 'dim1.req01',
          autor: 'equipo contope',
          fecha: '2026-08-30',
          motivo: 'la pregunta quedó absorbida por dim1.req02',
          sucesorId: 'dim1.req02',
        },
      ],
    );
    const result = parseRequirementManifest(doc);
    expect(result.ok).toBe(true);
    expect(result.manifest?.deprecations).toHaveLength(1);
  });

  it('deprecado sin registro ⇒ inválido', () => {
    const result = parseRequirementManifest(
      manifest([minimalReq('dim1.req01', [], 'deprecated'), minimalReq('dim1.req02', [])]),
    );
    expect(result.ok).toBe(false);
    expect(result.errores.some((e) => e.codigo === 'deprecacion-sin-registro')).toBe(true);
  });

  it('registro para un requisito active ⇒ inválido', () => {
    const result = parseRequirementManifest(
      manifest(
        [minimalReq('dim1.req01'), minimalReq('dim1.req02', [])],
        [{ id: 'dim1.req01', autor: 'a', fecha: '2026-08-30', motivo: 'x' }],
      ),
    );
    expect(result.ok).toBe(false);
    expect(result.errores.some((e) => e.codigo === 'deprecaciones-invalidas')).toBe(true);
  });

  it('sucesor inexistente o deprecado ⇒ inválido', () => {
    const nonexistent = parseRequirementManifest(
      manifest(
        [minimalReq('dim1.req01', [], 'deprecated'), minimalReq('dim1.req02', [])],
        [
          {
            id: 'dim1.req01',
            autor: 'a',
            fecha: '2026-08-30',
            motivo: 'x',
            sucesorId: 'dim1.req99',
          },
        ],
      ),
    );
    expect(nonexistent.ok).toBe(false);

    const deprecatedSucesor = parseRequirementManifest(
      manifest(
        [minimalReq('dim1.req01', [], 'deprecated'), minimalReq('dim1.req02', [], 'deprecated')],
        [
          {
            id: 'dim1.req01',
            autor: 'a',
            fecha: '2026-08-30',
            motivo: 'x',
            sucesorId: 'dim1.req02',
          },
          { id: 'dim1.req02', autor: 'a', fecha: '2026-08-30', motivo: 'x' },
        ],
      ),
    );
    expect(deprecatedSucesor.ok).toBe(false);
  });
});
