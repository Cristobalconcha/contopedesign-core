import { findEntry } from '@contope/core';
import { describe, expect, it } from 'vitest';
import { leerPropuestas } from './propuestas.js';
import { reducir } from './reductor.js';
import { nuevoSistema } from './sistema.js';

const AHORA = '2026-09-18T16:30:00.000Z';

function archivo(sistemaId: string, propuestas: unknown[], extra: Record<string, unknown> = {}): string {
  return JSON.stringify({ kind: 'contope/propuestas', schemaVersion: 1, designId: sistemaId, propuestas, ...extra });
}

describe('leerPropuestas', () => {
  it('acepta un archivo bien formado para el sistema abierto', () => {
    const s = nuevoSistema('digital', 'x', AHORA);
    const r = leerPropuestas(archivo(s.id, [{ requirementId: 'dim3.req01', payload: { unidad: '4px' }, nota: 'por la retícula' }], { por: 'Claude' }), s);
    expect(r.ok).toBe(true);
    if (!r.ok) throw new Error(r.motivo);
    expect(r.archivo.propuestas).toEqual([{ requirementId: 'dim3.req01', payload: { unidad: '4px' }, nota: 'por la retícula' }]);
    expect(r.archivo.por).toBe('Claude');
    expect(r.avisos).toEqual([]);
  });

  it('rechaza entero lo que no calza: otro sistema, pregunta inexistente, sin payload', () => {
    const s = nuevoSistema('digital', 'x', AHORA);
    expect(leerPropuestas('{', s)).toMatchObject({ ok: false });
    expect(leerPropuestas(archivo('otro', []), s)).toMatchObject({ ok: false, motivo: expect.stringContaining('otro sistema') });
    expect(leerPropuestas(archivo(s.id, [{ requirementId: 'dim99.req01', payload: {} }]), s)).toMatchObject({
      ok: false,
      motivo: expect.stringContaining('no existe'),
    });
    expect(leerPropuestas(archivo(s.id, [{ requirementId: 'dim3.req01' }]), s)).toMatchObject({ ok: false, motivo: expect.stringContaining('payload') });
  });

  it('avisa si la revisión de la cápsula no calza con la última exportada', () => {
    const s = nuevoSistema('digital', 'x', AHORA);
    const r = leerPropuestas(archivo(s.id, [], { contractRevision: 3 }), s);
    expect(r.ok && r.avisos.length).toBe(1);
  });
});

describe('reducir · traer-propuesta', () => {
  it('sobre una pregunta encargada: entra como propuesta explorable de ContOpe y la tarea queda propuesta', () => {
    let s = nuevoSistema('digital', 'x', AHORA);
    s = reducir(s, { tipo: 'encargar-a-contope', requirementId: 'dim3.req01' }, AHORA);
    s = reducir(s, { tipo: 'traer-propuesta', requirementId: 'dim3.req01', payload: { unidad: '4px', escala: [{ step: 1, value: '4px' }] }, nota: 'n' }, AHORA);
    const e = findEntry(s.designSet, 'dim3.req01');
    expect(e?.resolutionPath).toBe('contope');
    expect(e?.provenance).toEqual({ fuente: 'ia' });
    expect(e?.cicloDeVida).toBe('propuesta');
    expect(e?.fuerza).toBe('explorable');
    expect(s.caminos['dim3.req01']).toBeUndefined();
    const t = s.tareas[0];
    expect(t?.state).toBe('proposed');
    expect(t?.candidateDefinitionIds).toEqual([e?.effectiveDefinitionId]);
    expect(s.conflictos).toHaveLength(0);
    expect(s.notasDePropuesta['dim3.req01']).toEqual({ texto: 'n', en: AHORA });
  });

  it('rechaza dos propuestas para la misma pregunta', () => {
    const s = nuevoSistema('digital', 'x', AHORA);
    const dos = archivo(s.id, [
      { requirementId: 'dim3.req01', payload: { unidad: '4px' } },
      { requirementId: 'dim3.req01', payload: { unidad: '8px' } },
    ]);
    expect(leerPropuestas(dos, s)).toMatchObject({ ok: false, motivo: expect.stringContaining('dos propuestas') });
  });

  it('una ref puede apuntar a otra propuesta del mismo archivo, también en ciclo', () => {
    const s = nuevoSistema('digital', 'x', AHORA);
    const ref = (id: string) => ({ refReqId: id, refPath: [] });
    const r = leerPropuestas(
      archivo(s.id, [
        { requirementId: 'dim3.req01', payload: { unidad: '4px' } },
        { requirementId: 'dim3.req02', payload: { roleSpacing: [{ role: 'x', value: { refReqId: 'dim3.req01', refPath: ['escala', 0] } }] } },
        // dim1.req11 y dim1.req12 se nombran entre sí (medido con Econut el 27-09).
        { requirementId: 'dim1.req11', payload: { provenance: [{ definition: ref('dim1.req12') }] } },
        { requirementId: 'dim1.req12', payload: { forces: [{ definition: ref('dim1.req11') }] } },
      ]),
      s,
    );
    expect(r.ok).toBe(true);
    if (!r.ok) throw new Error(r.motivo);
    expect(r.archivo.propuestas.map((p) => p.requirementId)).toEqual(['dim3.req01', 'dim3.req02', 'dim1.req11', 'dim1.req12']);
    expect(r.avisos).toEqual([]);
  });

  it('una ref que no está ni en el sistema ni en el archivo deja fuera sólo esa propuesta y las que dependen de ella', () => {
    const s = nuevoSistema('digital', 'x', AHORA);
    const r = leerPropuestas(
      archivo(s.id, [
        { requirementId: 'dim3.req08', payload: { formatos: [] } },
        { requirementId: 'dim3.req02', payload: { roleSpacing: [{ role: 'x', value: { refReqId: 'dim3.req01', refPath: ['escala', 0] } }] } },
        { requirementId: 'dim3.req05', payload: { contenedores: [{ padding: { refReqId: 'dim3.req02', refPath: ['roleSpacing', 0] } }] } },
      ]),
      s,
    );
    expect(r.ok).toBe(true);
    if (!r.ok) throw new Error(r.motivo);
    expect(r.archivo.propuestas.map((p) => p.requirementId)).toEqual(['dim3.req08']);
    expect(r.avisos).toHaveLength(2);
    expect(r.avisos[0]).toContain('dim3.req02: apunta a dim3.req01');
    expect(r.avisos[1]).toContain('dim3.req05: apunta a dim3.req02');
  });

  it('una entrada de ContOpe reabierta no se pisa: la propuesta nueva queda como conflicto', () => {
    let s = nuevoSistema('digital', 'x', AHORA);
    s = reducir(s, { tipo: 'encargar-a-contope', requirementId: 'dim3.req01' }, AHORA);
    s = reducir(s, { tipo: 'traer-propuesta', requirementId: 'dim3.req01', payload: { unidad: '4px' } }, AHORA);
    s = reducir(s, { tipo: 'aprobar', requirementId: 'dim3.req01', fuerza: 'prioritaria' }, AHORA);
    s = reducir(s, { tipo: 'reabrir', requirementId: 'dim3.req01' }, AHORA);
    s = reducir(s, { tipo: 'traer-propuesta', requirementId: 'dim3.req01', payload: { unidad: '2px' } }, AHORA);
    expect(findEntry(s.designSet, 'dim3.req01')?.payload).toEqual({ unidad: '4px' });
    expect(s.conflictos).toHaveLength(1);
  });

  it('no hay dos encargos vivos para la misma pregunta; definir cierra el encargo como rechazado', () => {
    let s = nuevoSistema('digital', 'x', AHORA);
    s = reducir(s, { tipo: 'encargar-a-contope', requirementId: 'dim3.req01' }, AHORA);
    s = reducir(s, { tipo: 'traer-propuesta', requirementId: 'dim3.req01', payload: { unidad: '4px' } }, AHORA);
    s = reducir(s, { tipo: 'encargar-a-contope', requirementId: 'dim3.req01' }, AHORA);
    expect(s.tareas).toHaveLength(1);
    s = reducir(s, { tipo: 'definir', requirementId: 'dim3.req01', payload: { unidad: '8px' }, camino: 'diseñador', fuerza: 'explorable' }, AHORA);
    expect(s.tareas[0]).toMatchObject({ state: 'rejected', candidateDefinitionIds: [], reviewedAt: AHORA });
    expect(s.tareas[0]?.resolvedDefinitionId).toBeUndefined();
    s = reducir(s, { tipo: 'quitar-definicion', requirementId: 'dim3.req01' }, AHORA);
    s = reducir(s, { tipo: 'encargar-a-contope', requirementId: 'dim3.req01' }, AHORA);
    expect(s.tareas.map((t) => t.state)).toEqual(['rejected', 'active']);
  });

  it('quitar la definición se lleva sus conflictos', () => {
    let s = nuevoSistema('digital', 'x', AHORA);
    s = reducir(s, { tipo: 'definir', requirementId: 'dim3.req01', payload: { unidad: '8px' }, camino: 'diseñador', fuerza: 'inamovible' }, AHORA);
    s = reducir(s, { tipo: 'traer-propuesta', requirementId: 'dim3.req01', payload: { unidad: '4px' } }, AHORA);
    expect(s.conflictos).toHaveLength(1);
    s = reducir(s, { tipo: 'quitar-definicion', requirementId: 'dim3.req01' }, AHORA);
    expect(s.conflictos).toHaveLength(0);
  });

  it('sobre una pregunta ya resuelta por una persona: no la pisa, queda como conflicto', () => {
    let s = nuevoSistema('digital', 'x', AHORA);
    s = reducir(s, { tipo: 'definir', requirementId: 'dim3.req01', payload: { unidad: '8px' }, camino: 'diseñador', fuerza: 'inamovible' }, AHORA);
    s = reducir(s, { tipo: 'traer-propuesta', requirementId: 'dim3.req01', payload: { unidad: '4px' } }, AHORA);
    expect(findEntry(s.designSet, 'dim3.req01')?.payload).toEqual({ unidad: '8px' });
    expect(s.conflictos).toHaveLength(1);
    expect(s.conflictos[0]).toMatchObject({ requirementId: 'dim3.req01', insumoId: 'contope', fragmento: { unidad: '4px' } });
  });

  it('una segunda propuesta reemplaza a la anterior mientras siga siendo propuesta; aprobar resuelve la tarea', () => {
    let s = nuevoSistema('digital', 'x', AHORA);
    s = reducir(s, { tipo: 'encargar-a-contope', requirementId: 'dim3.req01' }, AHORA);
    s = reducir(s, { tipo: 'traer-propuesta', requirementId: 'dim3.req01', payload: { unidad: '4px' } }, AHORA);
    s = reducir(s, { tipo: 'traer-propuesta', requirementId: 'dim3.req01', payload: { unidad: '6px' } }, AHORA);
    const e = findEntry(s.designSet, 'dim3.req01');
    expect(e?.payload).toEqual({ unidad: '6px' });
    expect(e?.revision).toBe(2);
    expect(s.conflictos).toHaveLength(0);
    s = reducir(s, { tipo: 'aprobar', requirementId: 'dim3.req01', fuerza: 'prioritaria' }, AHORA);
    expect(s.tareas[0]).toMatchObject({ state: 'resolved', resolvedDefinitionId: e?.effectiveDefinitionId, reviewedAt: AHORA });
    s = reducir(s, { tipo: 'traer-propuesta', requirementId: 'dim3.req01', payload: { unidad: '2px' } }, AHORA);
    expect(findEntry(s.designSet, 'dim3.req01')?.payload).toEqual({ unidad: '6px' });
    expect(s.conflictos).toHaveLength(1);
  });

  it('quitar una propuesta de ContOpe rechaza su tarea', () => {
    let s = nuevoSistema('digital', 'x', AHORA);
    s = reducir(s, { tipo: 'encargar-a-contope', requirementId: 'dim3.req01' }, AHORA);
    s = reducir(s, { tipo: 'traer-propuesta', requirementId: 'dim3.req01', payload: { unidad: '4px' } }, AHORA);
    s = reducir(s, { tipo: 'quitar-definicion', requirementId: 'dim3.req01' }, AHORA);
    expect(findEntry(s.designSet, 'dim3.req01')).toBeUndefined();
    expect(s.tareas[0]).toMatchObject({ state: 'rejected', reviewedAt: AHORA });
  });
});
