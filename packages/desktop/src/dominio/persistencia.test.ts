import { describe, expect, it } from 'vitest';
import { sistemaConDim3Completa } from './evaluacion.test.js';
import { nombreDeArchivo, parsearSistema, serializarSistema } from './persistencia.js';
import { nuevoSistema } from './sistema.js';

describe('persistencia', () => {
  it('ida y vuelta sin pérdida', () => {
    const s = sistemaConDim3Completa();
    const texto = serializarSistema(s);
    expect(parsearSistema(texto)).toEqual(s);
  });

  it('rechaza en bloque lo que no es un sistema, con el motivo', () => {
    expect(() => parsearSistema('{')).toThrow(/JSON/);
    expect(() => parsearSistema('{"kind":"otra-cosa"}')).toThrow(/no es un sistema/);
    const roto = { ...nuevoSistema('digital', 'x'), designSet: { schemaVersion: 2 } };
    expect(() => parsearSistema(JSON.stringify(roto))).toThrow(/DesignSet inválido/);
  });

  it('el nombre de archivo sale del nombre del sistema, sin acentos ni espacios', () => {
    expect(nombreDeArchivo(nuevoSistema('marca', 'Santa Luisa de Palpi'))).toBe('santa-luisa-de-palpi.contope.json');
    expect(nombreDeArchivo(nuevoSistema('marca', '¡¡!!'))).toBe('sistema.contope.json');
  });
});

describe('persistencia · alcance', () => {
  it('un archivo viejo sin alcance se abre con alcance null', () => {
    const plano = JSON.parse(serializarSistema(nuevoSistema('digital', 'Viejo'))) as Record<string, unknown>;
    delete plano['alcance'];
    expect(parsearSistema(JSON.stringify(plano)).alcance).toBeNull();
  });

  it('un alcance con una dimensión desconocida se rechaza', () => {
    const roto: Record<string, unknown> = {
      ...nuevoSistema('digital', 'x'),
      alcance: { proposito: '', dimensiones: ['dim99'], declaradoEn: '2026-09-18T00:00:00.000Z' },
    };
    expect(() => parsearSistema(JSON.stringify(roto))).toThrow(/dimensión desconocida/);
  });
});


describe('persistencia · carril y tomar de los insumos', () => {
  function insumoPlano(extra: Record<string, unknown> = {}): Record<string, unknown> {
    return {
      id: 'insumo-viejo',
      nombre: 'viejo.css',
      extension: 'css',
      tipo: 'css',
      tamanoBytes: 10,
      incorporadoEn: '2026-09-14T12:00:00.000Z',
      resumen: 'viejo',
      candidatos: [],
      ...extra,
    };
  }

  function conInsumos(insumos: unknown[]): string {
    const plano = JSON.parse(serializarSistema(nuevoSistema('digital', 'Viejo'))) as Record<string, unknown>;
    plano['insumos'] = insumos;
    return JSON.stringify(plano);
  }

  it('un insumo sin carril ni tomar se abre como referente, con tomar null', () => {
    const s = parsearSistema(conInsumos([insumoPlano()]));
    expect(s.insumos[0]?.carril).toBe('referente');
    expect(s.insumos[0]?.tomar).toBeNull();
  });

  it('un carril que no es ninguno de los dos se rechaza entero', () => {
    expect(() => parsearSistema(conInsumos([insumoPlano({ carril: 'otro' })]))).toThrow(/carril desconocido/);
  });

  it('un tomar que no es lista ni null se rechaza', () => {
    expect(() => parsearSistema(conInsumos([insumoPlano({ tomar: 'dim1' })]))).toThrow(/'tomar'/);
  });

  it('un tomar con una dimensión desconocida se rechaza', () => {
    expect(() => parsearSistema(conInsumos([insumoPlano({ tomar: ['dim99'] })]))).toThrow(/dimensión desconocida/);
  });

  it('ida y vuelta de una cortapisa que toma sólo dos dimensiones', () => {
    const s = parsearSistema(conInsumos([insumoPlano({ carril: 'cortapisa', tomar: ['dim2', 'dim3'] })]));
    expect(s.insumos[0]?.carril).toBe('cortapisa');
    expect(s.insumos[0]?.tomar).toEqual(['dim2', 'dim3']);
    expect(parsearSistema(serializarSistema(s))).toEqual(s);
  });
});

describe('persistencia · armonización', () => {
  it('un archivo sin armonización abre con cero pasadas; una forma rara se rechaza', () => {
    const base = nuevoSistema('digital', 'x') as unknown as Record<string, unknown>;
    const { armonizacion: _sin, ...viejo } = base;
    expect(parsearSistema(JSON.stringify(viejo)).armonizacion).toEqual({ pasadas: 0, senales: {} });
    const raro = { ...base, armonizacion: { pasadas: 1, senales: { 'regla:x': { estado: 'quizás', en: 'hoy', pasada: 1 } } } };
    expect(() => parsearSistema(JSON.stringify(raro))).toThrow(/estado desconocido/);
  });
});

describe('persistencia · frontera hostil (auditoría 18-09)', () => {
  it('rechaza una cápsula anterior ilegible, una pasada no entera y una clave __proto__', () => {
    const base = nuevoSistema('digital', 'x') as unknown as Record<string, unknown>;
    expect(() => parsearSistema(JSON.stringify({ ...base, capsulaAnterior: { schemaVersion: 1 } }))).toThrow(/capsulaAnterior/);
    const pasadaRara = { ...base, armonizacion: { pasadas: 1, senales: { 'regla:x': { estado: 'validada', en: 'hoy', pasada: -7.5 } } } };
    expect(() => parsearSistema(JSON.stringify(pasadaRara))).toThrow(/entero desde 1/);
    const proto = { ...base, armonizacion: { pasadas: 1, senales: { __proto__: { estado: 'validada', en: 'hoy', pasada: 1 } } } };
    expect(() => parsearSistema(JSON.stringify(proto).replace('"senales":{}', '"senales":{"__proto__":{"estado":"validada","en":"hoy","pasada":1}}'))).toThrow(/no permitido/);
  });
  it('un archivo sin notas de propuesta abre con el diccionario vacío', () => {
    const base = nuevoSistema('digital', 'x') as unknown as Record<string, unknown>;
    const { notasDePropuesta: _sin, ...viejo } = base;
    expect(parsearSistema(JSON.stringify(viejo)).notasDePropuesta).toEqual({});
  });
});

describe('persistencia · canal imperativo', () => {
  it('un archivo viejo sin la marca la deriva de los insumos con carril cortapisa', () => {
    const base = nuevoSistema('digital', 'x') as unknown as Record<string, unknown>;
    const viejo: Record<string, unknown> = {
      ...base,
      insumos: [{ id: 'manual', nombre: 'manual.css', extension: 'css', tipo: 'css', tamanoBytes: 1, incorporadoEn: '2026-09-18T00:00:00.000Z', resumen: '', carril: 'cortapisa', tomar: null, candidatos: [] }],
      designSet: {
        ...(base['designSet'] as Record<string, unknown>),
        entries: [
          {
            requirementId: 'dim1.req01',
            effectiveDefinitionId: 'dim1.req01.def1',
            resolutionPath: 'insumo',
            payload: { institucionales: [{ name: 'a', value: '#70745e' }], neutros: [] },
            provenance: { fuente: 'referente', referenciaId: 'manual' },
            fuerza: 'inamovible',
            cicloDeVida: 'aprobada',
            revision: 1,
            mapsToKinds: [],
          },
        ],
      },
    };
    delete viejo['imperativas'];
    const s = parsearSistema(JSON.stringify(viejo));
    expect(s.imperativas['dim1.req01']).toMatchObject({ insumoId: 'manual', nombre: 'manual.css' });
  });
});
