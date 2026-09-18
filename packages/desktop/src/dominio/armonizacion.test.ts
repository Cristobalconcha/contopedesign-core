import { describe, expect, it } from 'vitest';
import { senalesAbiertas, senalesDe, senalesResueltas } from './armonizacion.js';
import { evaluar } from './evaluacion.js';
import { reducir } from './reductor.js';
import { nuevoSistema, type Candidato, type Insumo } from './sistema.js';

const AHORA = '2026-09-18T15:00:00.000Z';

function insumo(id: string, carril: Insumo['carril'], candidatos: Candidato[]): Insumo {
  return {
    id,
    nombre: `${id}.css`,
    extension: 'css',
    tipo: 'css',
    tamanoBytes: 10,
    incorporadoEn: AHORA,
    resumen: 'prueba',
    carril,
    tomar: null,
    candidatos,
  };
}

function candidatoColores(id: string, colores: string[]): Candidato {
  return {
    id,
    requirementId: 'dim1.req01',
    etiqueta: 'colores',
    detalle: '',
    muestra: { tipo: 'color', colores },
    fragmento: { institucionales: colores.map((value, i) => ({ name: `c${i}`, value })), neutros: [] },
    estado: 'pendiente',
  };
}

describe('senalesDe', () => {
  it('una regla del núcleo que no se cumple da una señal de regla, con su cita', () => {
    const s = nuevoSistema('digital', 'x', AHORA);
    const senales = senalesDe(s, evaluar(s));
    const reglas = senales.filter((x) => x.tipo === 'regla');
    expect(reglas.length).toBeGreaterThan(0);
    const primera = reglas[0];
    if (primera?.tipo !== 'regla') throw new Error('se esperaba una señal de regla');
    expect(primera.id.startsWith('regla:')).toBe(true);
    expect(primera.cita.length).toBeGreaterThan(0);
    expect(primera.cortapisa).toBe(false);
  });

  it('un conflicto por desplazamiento da una señal que gana la cortapisa', () => {
    let s = nuevoSistema('digital', 'x', AHORA);
    s = reducir(s, { tipo: 'agregar-insumo', insumo: insumo('ref', 'referente', [candidatoColores('r1', ['#70745e'])]) }, AHORA);
    s = reducir(s, { tipo: 'incorporar', insumoId: 'ref', candidatoIds: ['r1'] }, AHORA);
    s = reducir(s, { tipo: 'agregar-insumo', insumo: insumo('manual', 'cortapisa', [candidatoColores('m1', ['#cda23d'])]) }, AHORA);
    s = reducir(s, { tipo: 'incorporar', insumoId: 'manual', candidatoIds: ['m1'] }, AHORA);
    expect(s.conflictos).toHaveLength(1);
    const senales = senalesDe(s, evaluar(s));
    const conflicto = senales.find((x) => x.tipo === 'conflicto');
    expect(conflicto).toBeDefined();
    expect(conflicto?.requirementId).toBe('dim1.req01');
    expect(conflicto?.cortapisa).toBe(true);
    expect(conflicto?.titulo).toContain('ref.css');
  });

  it('abiertas y resueltas se reparten por lo decidido', () => {
    let s = nuevoSistema('digital', 'x', AHORA);
    const senales = senalesDe(s, evaluar(s));
    const primera = senales[0];
    if (!primera) throw new Error('sin señales');
    expect(senalesAbiertas(s, senales)).toHaveLength(senales.length);
    s = reducir(s, { tipo: 'resolver-senal', senalId: primera.id, estado: 'validada' }, AHORA);
    expect(senalesAbiertas(s, senales)).toHaveLength(senales.length - 1);
    expect(senalesResueltas(s, senales)).toEqual([{ senal: primera, decision: { estado: 'validada', en: AHORA, pasada: 1 } }]);
  });
});
