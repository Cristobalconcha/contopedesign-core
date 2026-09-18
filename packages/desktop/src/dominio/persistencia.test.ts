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
