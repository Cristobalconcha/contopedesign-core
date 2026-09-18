import { DIM3_MANIFEST_V0 } from '@contope/core';
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
  // Adenda del núcleo editorial (2026-09-18): la hoja y el sangrado también son preguntas de espacio.
  s = definir(s, 'dim3.req08', { formatos: [{ nombre: 'carta vertical', formato: 'letter', orientacion: 'vertical', modo: 'pagina-fija' }] });
  s = definir(s, 'dim3.req09', {
    porFormato: [{ formato: { refReqId: 'dim3.req08', refPath: ['formatos', 0] }, sangrado: '14pt', zonaSegura: '40px', margenTextoCorrido: '72px', aSangre: ['fondo'] }],
  });
  return s;
}

describe('evaluar', () => {
  it('un sistema vacío tiene 84 requisitos y ninguno resuelto', () => {
    const e = evaluar(nuevoSistema('digital', 'Vacío', AHORA));
    expect(e.total).toBe(84);
    expect(e.resueltos).toBe(0);
    expect(e.completo).toBe(false);
    expect(e.porRequisito.get('dim1.req01')?.resultado).toBe('no-resuelto');
    expect(e.porDimension.size).toBe(10);
  });

  it('la dimensión de espacio queda resuelta con un set válido, y las demás no', () => {
    const e = evaluar(sistemaConDim3Completa());
    const dim3 = e.porDimension.get('dim3');
    // Contra el manifiesto real: dim3 creció a 9 el 2026-09-18 (hoja y sangrado).
    const activos = DIM3_MANIFEST_V0.requirements.filter((r) => r.estado === 'active').length;
    expect(dim3?.contador).toEqual({ resueltos: activos, activos });
    expect(dim3?.resultado).toBe('resuelto');
    expect(e.resueltos).toBe(activos);
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
  it('el mundo editorial tiene núcleo medido y arranca no-cubierto; marca no tiene núcleo todavía', () => {
    const editorial = evaluar(nuevoSistema('editorial', 'Folleto', AHORA));
    expect(editorial.nucleo?.mundoId).toBe('editorial-impreso');
    expect(editorial.nucleo?.resultado).toBe('no-cubierto');
    expect(editorial.nucleo?.contador.total).toBe(40);
    expect(editorial.nucleo?.faltantes).toHaveLength(40);
    const digital = evaluar(nuevoSistema('digital', 'Sitio', AHORA));
    expect(digital.nucleo?.mundoId).toBe('web');
    expect(digital.nucleo?.contador.total).toBe(5);
    expect(evaluar(nuevoSistema('marca', 'Marca', AHORA)).nucleo).toBeUndefined();
  });
});
