import { findEntry } from '@contope/core';
import { describe, expect, it } from 'vitest';
import { apoyadasEn } from './apoyos.js';
import { serializarSistema } from './persistencia.js';
import { reducir } from './reductor.js';
import { nuevoSistema, type Sistema } from './sistema.js';

const AHORA = '2026-09-19T01:00:00.000Z';

/** dim3.req01 (escala) ← dim3.req02 (roles con ref) ← dim3.req05 (contenedores con ref a los roles). */
function cadena(): Sistema {
  let s = nuevoSistema('digital', 'x', AHORA);
  const def = (id: string, payload: Record<string, unknown>) => {
    s = reducir(s, { tipo: 'definir', requirementId: id, payload, camino: 'diseñador', fuerza: 'explorable' }, AHORA);
  };
  def('dim3.req01', { unidad: '4px', escala: [{ step: 1, value: '4px' }] });
  def('dim3.req02', { roleSpacing: [{ role: 'gap', value: { refReqId: 'dim3.req01', refPath: ['escala', 0] } }] });
  def('dim3.req05', { contenedores: [{ nombre: 'c', maxWidth: '60ch', padding: { refReqId: 'dim3.req02', refPath: ['roleSpacing', 0, 'value'] } }] });
  return s;
}

describe('apoyadasEn', () => {
  it('encuentra lo que se apoya en una definición, transitivamente y sin repetir', () => {
    const s = cadena();
    expect(apoyadasEn(s, 'dim3.req01')).toEqual(['dim3.req02', 'dim3.req05']);
    expect(apoyadasEn(s, 'dim3.req02')).toEqual(['dim3.req05']);
    expect(apoyadasEn(s, 'dim3.req05')).toEqual([]);
  });
});

describe('reducir · quitar-definicion con apoyos', () => {
  it('no quita sola una definición referenciada: el archivo seguiría sin poder guardarse', () => {
    const s = cadena();
    const t = reducir(s, { tipo: 'quitar-definicion', requirementId: 'dim3.req01' }, AHORA);
    expect(t).toBe(s);
    expect(() => serializarSistema(t)).not.toThrow();
  });

  it('reducir: en cascada quita también lo que se apoyaba, y el archivo se guarda', () => {
    const s = cadena();
    const t = reducir(s, { tipo: 'quitar-definicion', requirementId: 'dim3.req01', enCascada: true }, AHORA);
    expect(findEntry(t.designSet, 'dim3.req01')).toBeUndefined();
    expect(findEntry(t.designSet, 'dim3.req02')).toBeUndefined();
    expect(findEntry(t.designSet, 'dim3.req05')).toBeUndefined();
    expect(() => serializarSistema(t)).not.toThrow();
  });

  it('una definición sin apoyos se quita sin más', () => {
    const s = cadena();
    const t = reducir(s, { tipo: 'quitar-definicion', requirementId: 'dim3.req05' }, AHORA);
    expect(findEntry(t.designSet, 'dim3.req05')).toBeUndefined();
    expect(findEntry(t.designSet, 'dim3.req02')).toBeDefined();
    expect(() => serializarSistema(t)).not.toThrow();
  });
});
