import { DIM1_MANIFEST_V0, findEntry } from '@contope/core';
import { describe, expect, it } from 'vitest';
import { reducir, unirFragmento } from './reductor.js';
import { nuevoSistema, type Candidato, type Insumo } from './sistema.js';

const AHORA = '2026-09-14T12:00:00.000Z';

function insumo(id: string, candidatos: Candidato[]): Insumo {
  return {
    id,
    nombre: `${id}.css`,
    extension: 'css',
    tipo: 'css',
    tamanoBytes: 10,
    incorporadoEn: AHORA,
    resumen: 'prueba',
    carril: 'referente',
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

describe('reducir · incorporar desde insumos', () => {
  it('crea la entrada como propuesta explorable, trazada al insumo, y limpia el camino asignado', () => {
    let s = nuevoSistema('digital', 'Prueba', AHORA);
    s = reducir(s, { tipo: 'asignar-camino', requirementId: 'dim1.req01', camino: 'insumo' }, AHORA);
    s = reducir(s, { tipo: 'agregar-insumo', insumo: insumo('a', [candidatoColores('a1', ['#70745e'])]) }, AHORA);
    s = reducir(s, { tipo: 'incorporar', insumoId: 'a', candidatoIds: ['a1'] }, AHORA);

    const e = findEntry(s.designSet, 'dim1.req01');
    expect(e).toBeDefined();
    expect(e?.resolutionPath).toBe('insumo');
    expect(e?.provenance).toEqual({ fuente: 'referente', referenciaId: 'a' });
    expect(e?.cicloDeVida).toBe('propuesta');
    expect(e?.fuerza).toBe('explorable');
    expect(e?.mapsToKinds.map((k) => k.kind)).toEqual(['color']);
    expect(s.caminos['dim1.req01']).toBeUndefined();
    // Contra el manifiesto real, no contra un número escrito a mano: la versión de dim1
    // sube cada vez que se publica una edición (subió a 1.1 el 2026-09-18).
    expect(s.designSet.manifestRefs.dim1).toEqual({
      manifestVersion: DIM1_MANIFEST_V0.manifestVersion,
      revision: DIM1_MANIFEST_V0.revision,
    });
    expect(s.insumos[0]?.candidatos[0]?.estado).toBe('incorporado');
  });

  it('dos candidatos del MISMO insumo para el mismo requisito se unen', () => {
    let s = nuevoSistema('digital', 'Prueba', AHORA);
    s = reducir(
      s,
      { tipo: 'agregar-insumo', insumo: insumo('a', [candidatoColores('a1', ['#111111']), candidatoColores('a2', ['#222222'])]) },
      AHORA,
    );
    s = reducir(s, { tipo: 'incorporar', insumoId: 'a', candidatoIds: ['a1', 'a2'] }, AHORA);
    const payload = findEntry(s.designSet, 'dim1.req01')?.payload as { institucionales: unknown[] };
    expect(payload.institucionales).toHaveLength(2);
    expect(s.conflictos).toHaveLength(0);
  });

  it('un segundo insumo para un requisito ya resuelto NO pisa: queda como conflicto', () => {
    let s = nuevoSistema('digital', 'Prueba', AHORA);
    s = reducir(s, { tipo: 'agregar-insumo', insumo: insumo('a', [candidatoColores('a1', ['#111111'])]) }, AHORA);
    s = reducir(s, { tipo: 'agregar-insumo', insumo: insumo('b', [candidatoColores('b1', ['#999999'])]) }, AHORA);
    s = reducir(s, { tipo: 'incorporar', insumoId: 'a', candidatoIds: ['a1'] }, AHORA);
    s = reducir(s, { tipo: 'incorporar', insumoId: 'b', candidatoIds: ['b1'] }, AHORA);

    const payload = findEntry(s.designSet, 'dim1.req01')?.payload as { institucionales: Array<{ value: string }> };
    expect(payload.institucionales.map((c) => c.value)).toEqual(['#111111']);
    expect(s.conflictos).toHaveLength(1);
    expect(s.conflictos[0]).toMatchObject({ requirementId: 'dim1.req01', insumoId: 'b', candidatoId: 'b1' });
    expect(s.designSet.entries).toHaveLength(1);
  });

  it('un candidato ya incorporado no se incorpora dos veces', () => {
    let s = nuevoSistema('digital', 'Prueba', AHORA);
    s = reducir(s, { tipo: 'agregar-insumo', insumo: insumo('a', [candidatoColores('a1', ['#111111'])]) }, AHORA);
    s = reducir(s, { tipo: 'incorporar', insumoId: 'a', candidatoIds: ['a1'] }, AHORA);
    const otra = reducir(s, { tipo: 'incorporar', insumoId: 'a', candidatoIds: ['a1'] }, AHORA);
    expect(otra.designSet).toEqual(s.designSet);
  });
});

describe('reducir · definir, aprobar, reabrir, quitar', () => {
  const payload = { unidad: '4px', escala: [{ step: 1, value: '4px' }] };

  it('definir por el diseñador crea la entrada como propuesta, con la fuerza elegida; aprobar es aparte', () => {
    const s = reducir(
      nuevoSistema('editorial', 'P', AHORA),
      { tipo: 'definir', requirementId: 'dim3.req01', payload, camino: 'diseñador', fuerza: 'prioritaria' },
      AHORA,
    );
    const e = findEntry(s.designSet, 'dim3.req01');
    expect(e).toMatchObject({
      effectiveDefinitionId: 'dim3.req01.def1',
      resolutionPath: 'diseñador',
      provenance: { fuente: 'usuario' },
      cicloDeVida: 'propuesta',
      fuerza: 'prioritaria',
      revision: 1,
    });
  });

  it('editar una definición aprobada la devuelve a propuesta', () => {
    let s = reducir(
      nuevoSistema('editorial', 'P', AHORA),
      { tipo: 'definir', requirementId: 'dim3.req01', payload, camino: 'diseñador', fuerza: 'prioritaria' },
      AHORA,
    );
    s = reducir(s, { tipo: 'aprobar', requirementId: 'dim3.req01', fuerza: 'inamovible' }, AHORA);
    s = reducir(s, { tipo: 'definir', requirementId: 'dim3.req01', payload, camino: 'diseñador', fuerza: 'inamovible' }, AHORA);
    expect(findEntry(s.designSet, 'dim3.req01')?.cicloDeVida).toBe('propuesta');
  });

  it('redefinir sube la revisión y cambia el id efectivo', () => {
    let s = reducir(
      nuevoSistema('editorial', 'P', AHORA),
      { tipo: 'definir', requirementId: 'dim3.req01', payload, camino: 'diseñador', fuerza: 'explorable' },
      AHORA,
    );
    s = reducir(
      s,
      { tipo: 'definir', requirementId: 'dim3.req01', payload: { ...payload, unidad: '8px' }, camino: 'diseñador', fuerza: 'inamovible' },
      AHORA,
    );
    const e = findEntry(s.designSet, 'dim3.req01');
    expect(e?.revision).toBe(2);
    expect(e?.effectiveDefinitionId).toBe('dim3.req01.def2');
    expect(e?.fuerza).toBe('inamovible');
    expect(s.designSet.entries).toHaveLength(1);
  });

  it('aprobar fija fuerza y ciclo sin tocar el valor; reabrir no lo borra; quitar sí', () => {
    let s = nuevoSistema('editorial', 'P', AHORA);
    s = reducir(s, { tipo: 'agregar-insumo', insumo: insumo('a', [candidatoColores('a1', ['#111111'])]) }, AHORA);
    s = reducir(s, { tipo: 'incorporar', insumoId: 'a', candidatoIds: ['a1'] }, AHORA);
    s = reducir(s, { tipo: 'aprobar', requirementId: 'dim1.req01', fuerza: 'inamovible' }, AHORA);
    let e = findEntry(s.designSet, 'dim1.req01');
    expect(e?.cicloDeVida).toBe('aprobada');
    expect(e?.fuerza).toBe('inamovible');
    expect((e?.payload as { institucionales: unknown[] }).institucionales).toHaveLength(1);

    s = reducir(s, { tipo: 'reabrir', requirementId: 'dim1.req01' }, AHORA);
    e = findEntry(s.designSet, 'dim1.req01');
    expect(e?.cicloDeVida).toBe('reabierta');
    expect(e?.payload).toBeDefined();

    s = reducir(s, { tipo: 'quitar-definicion', requirementId: 'dim1.req01' }, AHORA);
    expect(findEntry(s.designSet, 'dim1.req01')).toBeUndefined();
  });

  it('encargar a ContOpe asigna el camino y crea la tarea con las dependencias resueltas como restricción', () => {
    let s = reducir(
      nuevoSistema('editorial', 'P', AHORA),
      { tipo: 'definir', requirementId: 'dim3.req01', payload, camino: 'diseñador', fuerza: 'prioritaria' },
      AHORA,
    );
    s = reducir(s, { tipo: 'encargar-a-contope', requirementId: 'dim3.req02' }, AHORA);
    expect(s.caminos['dim3.req02']).toBe('contope');
    expect(s.tareas).toHaveLength(1);
    expect(s.tareas[0]).toMatchObject({
      definitionId: 'dim3.req02.def1',
      state: 'active',
      constraintDefinitionIds: ['dim3.req01.def1'],
      candidateDefinitionIds: [],
    });
    const otra = reducir(s, { tipo: 'encargar-a-contope', requirementId: 'dim3.req02' }, AHORA);
    expect(otra.tareas).toHaveLength(1);
  });

  it('asignar camino null lo quita; la fecha de actualización sólo cambia si algo cambió', () => {
    const s0 = nuevoSistema('editorial', 'P', AHORA);
    const s1 = reducir(s0, { tipo: 'asignar-camino', requirementId: 'dim6.req01', camino: 'diseñador' }, '2026-09-15T00:00:00.000Z');
    expect(s1.caminos['dim6.req01']).toBe('diseñador');
    expect(s1.actualizadoEn).toBe('2026-09-15T00:00:00.000Z');
    const s2 = reducir(s1, { tipo: 'asignar-camino', requirementId: 'dim6.req01', camino: null }, '2026-09-16T00:00:00.000Z');
    expect(s2.caminos['dim6.req01']).toBeUndefined();
    const s3 = reducir(s2, { tipo: 'incorporar', insumoId: 'no-existe', candidatoIds: [] }, '2026-09-17T00:00:00.000Z');
    expect(s3).toBe(s2);
  });
});

describe('unirFragmento', () => {
  it('concatena listas sin repetir, rellena huecos y no reemplaza valores presentes', () => {
    const base = { unidad: '4px', escala: [{ step: 1, value: '4px' }] };
    const salida = unirFragmento(base, { unidad: '8px', escala: [{ step: 1, value: '4px' }, { step: 2, value: '8px' }], nota: 'x' });
    expect(salida).toEqual({ unidad: '4px', escala: [{ step: 1, value: '4px' }, { step: 2, value: '8px' }], nota: 'x' });
  });
});

describe('reducir · declarar-alcance', () => {
  it('reemplaza el alcance entero y toca la fecha de actualización', () => {
    const s0 = nuevoSistema('digital', 'P', AHORA);
    expect(s0.alcance).toBeNull();

    const s1 = reducir(
      s0,
      {
        tipo: 'declarar-alcance',
        alcance: { proposito: 'el sitio y las redes de una viña', dimensiones: ['dim1'], declaradoEn: '2026-09-18T10:00:00.000Z' },
      },
      '2026-09-18T11:00:00.000Z',
    );
    expect(s1.alcance).toEqual({
      proposito: 'el sitio y las redes de una viña',
      dimensiones: ['dim1'],
      declaradoEn: '2026-09-18T10:00:00.000Z',
    });
    expect(s1.actualizadoEn).toBe('2026-09-18T11:00:00.000Z');
    expect(s0.alcance).toBeNull();

    const s2 = reducir(
      s1,
      { tipo: 'declarar-alcance', alcance: { proposito: '', dimensiones: ['dim2', 'dim3'], declaradoEn: '2026-09-18T12:00:00.000Z' } },
      '2026-09-18T12:30:00.000Z',
    );
    expect(s2.alcance?.dimensiones).toEqual(['dim2', 'dim3']);
    expect(s2.alcance?.proposito).toBe('');
  });
});


function cortapisa(id: string, candidatos: Candidato[]): Insumo {
  return { ...insumo(id, candidatos), carril: 'cortapisa' };
}

describe('reducir · los dos carriles de insumos', () => {
  it('un candidato de un insumo cortapisa entra aprobado e inamovible', () => {
    let s = nuevoSistema('digital', 'Prueba', AHORA);
    s = reducir(s, { tipo: 'agregar-insumo', insumo: cortapisa('k', [candidatoColores('k1', ['#70745e'])]) }, AHORA);
    s = reducir(s, { tipo: 'incorporar', insumoId: 'k', candidatoIds: ['k1'] }, AHORA);

    const e = findEntry(s.designSet, 'dim1.req01');
    expect(e).toBeDefined();
    expect(e?.cicloDeVida).toBe('aprobada');
    expect(e?.fuerza).toBe('inamovible');
    expect(e?.resolutionPath).toBe('insumo');
    expect(e?.provenance).toEqual({ fuente: 'referente', referenciaId: 'k' });
    expect(s.conflictos).toHaveLength(0);
    expect(s.insumos[0]?.candidatos[0]?.estado).toBe('incorporado');
  });

  it('una cortapisa sobre lo que trajo un referente lo desplaza, sube la revisión y deja el rastro', () => {
    let s = nuevoSistema('digital', 'Prueba', AHORA);
    s = reducir(s, { tipo: 'agregar-insumo', insumo: insumo('a', [candidatoColores('a1', ['#111111'])]) }, AHORA);
    s = reducir(s, { tipo: 'incorporar', insumoId: 'a', candidatoIds: ['a1'] }, AHORA);
    s = reducir(s, { tipo: 'agregar-insumo', insumo: cortapisa('k', [candidatoColores('k1', ['#999999'])]) }, AHORA);
    s = reducir(s, { tipo: 'incorporar', insumoId: 'k', candidatoIds: ['k1'] }, AHORA);

    const e = findEntry(s.designSet, 'dim1.req01');
    expect(s.designSet.entries).toHaveLength(1);
    expect(e?.revision).toBe(2);
    expect(e?.effectiveDefinitionId).toBe('dim1.req01.def2');
    expect(e?.fuerza).toBe('inamovible');
    expect(e?.cicloDeVida).toBe('aprobada');
    expect(e?.provenance).toEqual({ fuente: 'referente', referenciaId: 'k' });
    const payload = e?.payload as { institucionales: Array<{ value: string }> };
    expect(payload.institucionales.map((c) => c.value)).toEqual(['#999999']);

    expect(s.conflictos).toHaveLength(1);
    expect(s.conflictos[0]).toMatchObject({
      requirementId: 'dim1.req01',
      insumoId: 'a',
      candidatoId: '',
      desplazada: true,
    });
    const desplazado = s.conflictos[0]?.fragmento as { institucionales: Array<{ value: string }> };
    expect(desplazado.institucionales.map((c) => c.value)).toEqual(['#111111']);
  });

  it('si lo desplazado lo había definido el diseñador, el conflicto lo dice', () => {
    let s = nuevoSistema('digital', 'Prueba', AHORA);
    s = reducir(s, { tipo: 'definir', requirementId: 'dim1.req01', payload: { institucionales: [] }, camino: 'diseñador', fuerza: 'explorable' }, AHORA);
    s = reducir(s, { tipo: 'agregar-insumo', insumo: cortapisa('k', [candidatoColores('k1', ['#999999'])]) }, AHORA);
    s = reducir(s, { tipo: 'incorporar', insumoId: 'k', candidatoIds: ['k1'] }, AHORA);

    expect(findEntry(s.designSet, 'dim1.req01')?.fuerza).toBe('inamovible');
    expect(s.conflictos[0]).toMatchObject({ insumoId: 'diseñador', candidatoId: '', desplazada: true });
  });

  it('dos cortapisas sobre el mismo requisito dejan un conflicto normal: lo decide la armonización', () => {
    let s = nuevoSistema('digital', 'Prueba', AHORA);
    s = reducir(s, { tipo: 'agregar-insumo', insumo: cortapisa('k1', [candidatoColores('k11', ['#111111'])]) }, AHORA);
    s = reducir(s, { tipo: 'incorporar', insumoId: 'k1', candidatoIds: ['k11'] }, AHORA);
    s = reducir(s, { tipo: 'agregar-insumo', insumo: cortapisa('k2', [candidatoColores('k21', ['#999999'])]) }, AHORA);
    s = reducir(s, { tipo: 'incorporar', insumoId: 'k2', candidatoIds: ['k21'] }, AHORA);

    const e = findEntry(s.designSet, 'dim1.req01');
    expect(s.designSet.entries).toHaveLength(1);
    expect(e?.revision).toBe(1);
    expect(e?.provenance).toEqual({ fuente: 'referente', referenciaId: 'k1' });
    const payload = e?.payload as { institucionales: Array<{ value: string }> };
    expect(payload.institucionales.map((c) => c.value)).toEqual(['#111111']);
    expect(s.conflictos).toHaveLength(1);
    expect(s.conflictos[0]).toMatchObject({ requirementId: 'dim1.req01', insumoId: 'k2', candidatoId: 'k21' });
    expect(s.conflictos[0]?.desplazada).toBeUndefined();
  });

  it('tomar-de-insumo guarda la lista marcada; null vuelve a decir «todas»', () => {
    let s = nuevoSistema('digital', 'Prueba', AHORA);
    s = reducir(s, { tipo: 'agregar-insumo', insumo: insumo('a', [candidatoColores('a1', ['#111111'])]) }, AHORA);
    expect(s.insumos[0]?.tomar).toBeNull();

    s = reducir(s, { tipo: 'tomar-de-insumo', insumoId: 'a', dimensiones: ['dim2', 'dim3'] }, AHORA);
    expect(s.insumos[0]?.tomar).toEqual(['dim2', 'dim3']);
    expect(s.actualizadoEn).toBe(AHORA);

    const igual = reducir(s, { tipo: 'tomar-de-insumo', insumoId: 'no-existe', dimensiones: null }, '2026-09-18T00:00:00.000Z');
    expect(igual).toBe(s);

    s = reducir(s, { tipo: 'tomar-de-insumo', insumoId: 'a', dimensiones: null }, AHORA);
    expect(s.insumos[0]?.tomar).toBeNull();
  });
});
