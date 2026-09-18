import { describe, expect, it } from 'vitest';
import { evaluar } from './evaluacion.js';
import { reducir } from './reductor.js';
import { nuevoSistema, type Sistema } from './sistema.js';

const AHORA = '2026-09-14T12:00:00.000Z';

function definir(s: Sistema, requirementId: string, payload: Record<string, unknown>): Sistema {
  return reducir(s, { tipo: 'definir', requirementId, payload, camino: 'diseñador', fuerza: 'prioritaria' }, AHORA);
}

/** Un set de espacio (dim3) completo y válido, escrito a mano contra el manifiesto. */
export function sistemaConDim3Completa(): Sistema {
  let s = nuevoSistema('editorial', 'Prueba', AHORA);
  s = definir(s, 'dim3.req01', {
    unidad: '4px',
    escala: [
      { step: 1, value: '4px' },
      { step: 2, value: '8px' },
      { step: 3, value: '16px' },
    ],
  });
  s = definir(s, 'dim3.req02', {
    roleSpacing: [
      { role: 'intraelemento', value: { refReqId: 'dim3.req01', refPath: ['escala', 0, 'value'] }, source: 'escala', derivation: { of: 'dim3.req01' } },
      { role: 'interelemento', value: { refReqId: 'dim3.req01', refPath: ['escala', 1, 'value'] }, source: 'escala', derivation: { of: 'dim3.req01' } },
      { role: 'entre-secciones', value: '32px', source: 'a mano', derivation: { of: 'direct', rule: 'el doble del paso 3' } },
    ],
  });
  s = definir(s, 'dim3.req03', {
    ritmo: { baseline: { refReqId: 'dim3.req01', refPath: ['unidad'] }, aplicaA: ['cuerpo', 'títulos'], alineacion: 'baseline' },
  });
  s = definir(s, 'dim3.req04', {
    reticulas: [{ contexto: 'página web', columns: 4, gap: { refReqId: 'dim3.req01', refPath: ['escala', 2, 'value'] } }],
  });
  s = definir(s, 'dim3.req05', {
    contenedores: [
      { nombre: 'contenido', maxWidth: '1200px', padding: { refReqId: 'dim3.req02', refPath: ['roleSpacing', 1, 'value'] }, relacionSoporte: 'centrado en la ventana' },
      { nombre: 'lectura', maxWidth: '72ch', padding: { refReqId: 'dim3.req02', refPath: ['roleSpacing', 0, 'value'] }, relacionSoporte: 'dentro de contenido' },
    ],
  });
  s = definir(s, 'dim3.req06', {
    adaptaciones: [{ contexto: 'móvil', roleAfectado: { refReqId: 'dim3.req02', refPath: ['roleSpacing', 2] }, ajuste: 'se reduce a la mitad' }],
  });
  s = definir(s, 'dim3.req07', {
    correspondencia: { campoPlano: 'spacing', escalaRelacionada: { refReqId: 'dim3.req01', refPath: [] }, nota: 'spacing = paso 2' },
  });
  return s;
}

describe('evaluar', () => {
  it('un sistema vacío tiene 51 requisitos y ninguno resuelto', () => {
    const e = evaluar(nuevoSistema('digital', 'Vacío', AHORA));
    expect(e.total).toBe(51);
    expect(e.resueltos).toBe(0);
    expect(e.completo).toBe(false);
    expect(e.porRequisito.get('dim1.req01')?.resultado).toBe('no-resuelto');
    expect(e.porDimension.size).toBe(6);
  });

  it('la dimensión de espacio queda resuelta con un set válido, y las demás no', () => {
    const e = evaluar(sistemaConDim3Completa());
    const dim3 = e.porDimension.get('dim3');
    expect(dim3?.contador).toEqual({ resueltos: 7, activos: 7 });
    expect(dim3?.resultado).toBe('resuelto');
    expect(e.resueltos).toBe(7);
    expect(e.completo).toBe(false);
  });

  it('un payload incompleto deja el requisito no-resuelto con el motivo a la vista', () => {
    const s = definir(nuevoSistema('digital', 'P', AHORA), 'dim3.req01', { unidad: '4px', escala: [] });
    const r = evaluar(s).porRequisito.get('dim3.req01');
    expect(r?.resultado).toBe('no-resuelto');
    expect(r?.motivos.map((m) => m.mensaje).join(' ')).toMatch(/escala/);
  });

  it('una dependencia sin resolver arrastra al dependiente', () => {
    const s = definir(nuevoSistema('digital', 'P', AHORA), 'dim3.req02', {
      roleSpacing: [
        { role: 'intraelemento', value: '4px', source: 'x', derivation: { of: 'direct', rule: 'r' } },
        { role: 'interelemento', value: '8px', source: 'x', derivation: { of: 'direct', rule: 'r' } },
        { role: 'entre-secciones', value: '32px', source: 'x', derivation: { of: 'direct', rule: 'r' } },
      ],
    });
    const r = evaluar(s).porRequisito.get('dim3.req02');
    expect(r?.resultado).toBe('no-resuelto');
    expect(r?.motivos.some((m) => m.codigo === 'dependencia-no-resuelta')).toBe(true);
  });
});
