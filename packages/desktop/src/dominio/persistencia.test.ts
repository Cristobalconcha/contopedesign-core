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
