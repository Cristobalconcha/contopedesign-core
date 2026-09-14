import { describe, expect, it } from 'vitest';
import { sistemaConDim3Completa } from './evaluacion.test.js';
import { REQUISITOS } from './manifiesto.js';
import { muestraDePayload, tipoDePaquete } from './primitivas.js';
import { reducir } from './reductor.js';
import { nuevoSistema } from './sistema.js';

describe('tipoDePaquete', () => {
  it('cada requisito del manifiesto tiene una primitiva que no es "nada"', () => {
    for (const r of REQUISITOS) expect(tipoDePaquete(r.packageId)).not.toBe('nada');
  });
  it('superficies, familia y roles se distinguen del resto de su dimensión', () => {
    expect(tipoDePaquete('pkg.color.superficies')).toBe('superficie');
    expect(tipoDePaquete('pkg.color.roles')).toBe('color');
    expect(tipoDePaquete('pkg.tipografia.fundamento')).toBe('familia');
    expect(tipoDePaquete('pkg.tipografia.lectura')).toBe('roles');
    expect(tipoDePaquete('pkg.espacio.reticula')).toBe('reticula');
  });
});

describe('muestraDePayload', () => {
  it('sin entrada es "nada": lo no resuelto no se parece a un color gris', () => {
    expect(muestraDePayload(nuevoSistema('digital', 'x').designSet, 'dim1.req01')).toEqual({ tipo: 'nada' });
  });

  it('lee los colores del fundamento y resuelve referencias en los roles', () => {
    let s = nuevoSistema('digital', 'x');
    s = reducir(s, {
      tipo: 'definir',
      requirementId: 'dim1.req01',
      payload: { institucionales: [{ name: 'oliva', value: '#70745e' }], neutros: [{ name: 'papel', value: '#f6f6f3' }] },
      camino: 'diseñador',
      fuerza: 'inamovible',
    });
    s = reducir(s, {
      tipo: 'definir',
      requirementId: 'dim1.req02',
      payload: {
        roleColors: [
          { role: 'background', color: { refReqId: 'dim1.req01', refPath: ['neutros', 0, 'value'] }, source: 'x', derivation: { of: 'dim1.req01' } },
          { role: 'accent', color: '#cda23d', source: 'x', derivation: { of: 'direct', rule: 'r' } },
        ],
      },
      camino: 'diseñador',
      fuerza: 'inamovible',
    });
    expect(muestraDePayload(s.designSet, 'dim1.req01')).toEqual({ tipo: 'color', colores: ['#70745e', '#f6f6f3'] });
    expect(muestraDePayload(s.designSet, 'dim1.req02')).toEqual({ tipo: 'color', colores: ['#f6f6f3', '#cda23d'] });
  });

  it('espacio: la escala, los roles (con refs) y la retícula', () => {
    const set = sistemaConDim3Completa().designSet;
    expect(muestraDePayload(set, 'dim3.req01')).toEqual({ tipo: 'espacio', valores: ['4px', '8px', '16px'] });
    expect(muestraDePayload(set, 'dim3.req02')).toEqual({ tipo: 'espacio', valores: ['4px', '8px', '32px'] });
    expect(muestraDePayload(set, 'dim3.req04')).toEqual({ tipo: 'reticula', columnas: 4 });
    expect(muestraDePayload(set, 'dim3.req07').tipo).toBe('texto');
  });
});
