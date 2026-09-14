import { parseDesignContract } from '@contope/core';
import { describe, expect, it } from 'vitest';
import { proyectarCapsula } from './capsula.js';
import { reducir } from './reductor.js';
import { nuevoSistema, type Insumo } from './sistema.js';

const AHORA = '2026-09-14T12:00:00.000Z';

function sistemaDePrueba() {
  let s = nuevoSistema('marca', 'Cápsula', AHORA);
  const insumo: Insumo = {
    id: 'manual',
    nombre: 'manual.css',
    extension: 'css',
    tipo: 'css',
    tamanoBytes: 1,
    incorporadoEn: AHORA,
    resumen: 'r',
    candidatos: [
      {
        id: 'c1',
        requirementId: 'dim1.req01',
        etiqueta: 'colores',
        detalle: '',
        muestra: { tipo: 'color', colores: ['#70745e'] },
        fragmento: { institucionales: [{ name: 'oliva', value: '#70745e' }], neutros: [{ name: 'papel', value: '#f6f6f3' }] },
        estado: 'pendiente',
      },
    ],
  };
  s = reducir(s, { tipo: 'agregar-insumo', insumo }, AHORA);
  s = reducir(s, { tipo: 'incorporar', insumoId: 'manual', candidatoIds: ['c1'] }, AHORA);
  s = reducir(
    s,
    {
      tipo: 'definir',
      requirementId: 'dim3.req01',
      payload: { unidad: '4px', escala: [{ step: 1, value: '4px' }] },
      camino: 'diseñador',
      fuerza: 'inamovible',
    },
    AHORA,
  );
  s = reducir(s, { tipo: 'aprobar', requirementId: 'dim3.req01', fuerza: 'inamovible' }, AHORA);
  s = reducir(s, { tipo: 'encargar-a-contope', requirementId: 'dim3.req02' }, AHORA);
  return s;
}

describe('proyectarCapsula', () => {
  it('produce un contrato que el núcleo vuelve a leer, con la autoridad que corresponde a cada camino', () => {
    const { contrato, designMd, archivos } = proyectarCapsula(sistemaDePrueba());
    expect(parseDesignContract(JSON.parse(JSON.stringify(contrato)))).not.toBeNull();
    expect(contrato.design.revision).toBe(1);
    expect(contrato.sources.map((s) => s.id)).toEqual(['manual']);

    const deInsumo = contrato.definitions.find((d) => d.id === 'dim1.req01.def1');
    expect(deInsumo).toMatchObject({ state: 'observed', authority: 'deterministic-extraction', evidenceSourceIds: ['manual'] });

    const delDisenador = contrato.definitions.find((d) => d.id === 'dim3.req01.def1');
    expect(delDisenador).toMatchObject({ state: 'confirmed', authority: 'human-confirmed', evidenceSourceIds: [] });
    expect(delDisenador?.provenance).toEqual([{ sourceId: 'user', excerpt: 'dim3.req01' }]);

    expect(contrato.developmentTasks).toHaveLength(1);
    expect(contrato.developmentTasks[0]).toMatchObject({
      definitionId: 'dim3.req02.def1',
      state: 'active',
      constraintDefinitionIds: ['dim3.req01.def1'],
    });
    // El encargo existe como definición declarada y vacía: ni confirmada ni con valor.
    const encargada = contrato.definitions.find((d) => d.id === 'dim3.req02.def1');
    expect(encargada).toMatchObject({ state: 'proposed', authority: 'model-proposal', value: {} });
    expect(contrato.projections.designMd).toMatchObject({ path: 'DESIGN.md', revision: 1 });

    expect(designMd).toContain('dim3.req01.def1');
    expect(archivos.map((a) => a.nombre)).toEqual(['design-contract.json', 'DESIGN.md']);
  });

  it('exportar de nuevo continúa el linaje: revisión 2, misma fecha de creación', () => {
    let s = sistemaDePrueba();
    const primera = proyectarCapsula(s);
    s = reducir(s, { tipo: 'registrar-capsula', contrato: primera.contrato }, AHORA);
    s = reducir(s, { tipo: 'renombrar', nombre: 'Cápsula 2' }, '2026-09-15T00:00:00.000Z');
    const segunda = proyectarCapsula(s);
    expect(segunda.contrato.design.revision).toBe(2);
    expect(segunda.contrato.design.createdAt).toBe(primera.contrato.design.createdAt);
    expect(segunda.contrato.design.updatedAt).toBe('2026-09-15T00:00:00.000Z');
  });
});
