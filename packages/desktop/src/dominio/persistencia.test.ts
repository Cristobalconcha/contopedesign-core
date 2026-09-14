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
