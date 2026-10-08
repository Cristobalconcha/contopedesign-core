import { generadorDegradadosSvg, generadorPaletaAse } from '@contope/core';
import { describe, expect, it } from 'vitest';
import { generarEnElTaller, paraGuardar, vigenciaDe } from './celulas.js';
import { leerAse } from './extractores/ase.js';
import { parsearSistema, serializarSistema } from './persistencia.js';
import { reducir } from './reductor.js';
import { nuevoSistema, type Sistema } from './sistema.js';

const AHORA = '2026-10-08T12:00:00.000Z';

function conColor(valor = '#1d4ed8'): Sistema {
  return reducir(
    nuevoSistema('marca', 'Econut', AHORA),
    {
      tipo: 'definir',
      requirementId: 'dim1.req01',
      payload: {
        institucionales: [
          { name: 'Azul', value: valor },
          { name: 'Verde', value: 'oklch(0.6 0.15 150)' },
        ],
        neutros: [{ name: 'Tinta', value: '#1a1f23' }],
      },
      camino: 'diseñador',
      fuerza: 'prioritaria',
    },
    AHORA,
  );
}

describe('Células Madre en el taller', () => {
  it('la paleta generada la lee el mismo extractor de .ase que usa Recolección', () => {
    const r = generarEnElTaller(conColor(), generadorPaletaAse, {}, AHORA);
    if (!r.ok) throw new Error(r.falta);
    const [ase] = paraGuardar(r.archivos);
    const lectura = leerAse(ase!.bytes);
    expect(lectura.version).toBe('1.0');
    expect(lectura.grupos).toEqual(['Econut · ContOpe · Institucionales', 'Econut · ContOpe · Neutros']);
    expect(lectura.colores.map((c) => [c.nombre, c.modelo, c.tipo, c.hex])).toEqual([
      ['Azul', 'RGB', 'global', '#1d4ed8'],
      ['Verde', 'RGB', 'global', expect.stringMatching(/^#[0-9a-f]{6}$/)],
      ['Tinta', 'RGB', 'global', '#1a1f23'],
    ]);
  });

  it('sin color, dice qué falta en vez de generar', () => {
    const r = generarEnElTaller(nuevoSistema('marca', 'Vacío', AHORA), generadorPaletaAse, {}, AHORA);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.falta).toMatch(/Color y superficies/);
  });

  it('el registro se guarda en el archivo y vuelve igual', () => {
    const s = conColor();
    const r = generarEnElTaller(s, generadorPaletaAse, {}, AHORA);
    if (!r.ok) throw new Error(r.falta);
    const t = reducir(s, { tipo: 'registrar-celula', celula: r.celula }, AHORA);
    expect(t.celulasMadre).toHaveLength(1);
    expect(parsearSistema(serializarSistema(t))).toEqual(t);
  });

  it('regenerar con los mismos parámetros reemplaza; con otros, se suma', () => {
    let s = conColor();
    const a = generarEnElTaller(s, generadorDegradadosSvg, {}, AHORA);
    const b = generarEnElTaller(s, generadorDegradadosSvg, {}, '2026-10-09T12:00:00.000Z');
    const c = generarEnElTaller(s, generadorDegradadosSvg, { forma: 'radial' }, AHORA);
    if (!a.ok || !b.ok || !c.ok) throw new Error('no generó');
    s = reducir(s, { tipo: 'registrar-celula', celula: a.celula }, AHORA);
    s = reducir(s, { tipo: 'registrar-celula', celula: b.celula }, AHORA);
    expect(s.celulasMadre.map((x) => x.metadata.generadoEn)).toEqual(['2026-10-09T12:00:00.000Z']);
    s = reducir(s, { tipo: 'registrar-celula', celula: c.celula }, AHORA);
    expect(s.celulasMadre).toHaveLength(2);
    s = reducir(s, { tipo: 'olvidar-celula', celulaId: c.celula.id }, AHORA);
    expect(s.celulasMadre).toHaveLength(1);
  });

  it('«Regenerar» toma el lugar del registro que se regeneró, aunque los parámetros se hayan corregido', () => {
    let s = conColor();
    const viejo = generarEnElTaller(s, generadorDegradadosSvg, { colores: ['institucionales:Azul', 'neutros:Tinta'] }, AHORA);
    if (!viejo.ok) throw new Error(viejo.falta);
    s = reducir(s, { tipo: 'registrar-celula', celula: viejo.celula }, AHORA);
    // El color «Tinta» se borra del ADN: al regenerar, los parámetros vuelven al valor por defecto.
    s = reducir(
      s,
      {
        tipo: 'definir',
        requirementId: 'dim1.req01',
        payload: { institucionales: [{ name: 'Azul', value: '#1d4ed8' }, { name: 'Verde', value: '#15803d' }], neutros: [] },
        camino: 'diseñador',
        fuerza: 'prioritaria',
      },
      AHORA,
    );
    const nuevo = generarEnElTaller(s, generadorDegradadosSvg, viejo.celula.metadata.parametros, AHORA);
    if (!nuevo.ok) throw new Error(nuevo.falta);
    expect(nuevo.celula.metadata.parametros['colores']).toEqual(['institucionales:Azul', 'institucionales:Verde']);
    s = reducir(s, { tipo: 'registrar-celula', celula: nuevo.celula, reemplaza: viejo.celula.id }, AHORA);
    expect(s.celulasMadre.map((c) => c.id)).toEqual([nuevo.celula.id]);
  });

  it('al redefinir el color, lo generado queda desactualizado', () => {
    const s = conColor();
    const r = generarEnElTaller(s, generadorPaletaAse, {}, AHORA);
    if (!r.ok) throw new Error(r.falta);
    const t = reducir(s, { tipo: 'registrar-celula', celula: r.celula }, AHORA);
    expect(vigenciaDe(r.celula, t)).toEqual({ estado: 'vigente' });
    const u = reducir(
      t,
      {
        tipo: 'definir',
        requirementId: 'dim1.req01',
        payload: { institucionales: [{ name: 'Azul', value: '#0000ff' }], neutros: [{ name: 'Tinta', value: '#1a1f23' }] },
        camino: 'diseñador',
        fuerza: 'prioritaria',
      },
      AHORA,
    );
    expect(vigenciaDe(r.celula, u)).toEqual({ estado: 'desactualizada', cambios: [{ requirementId: 'dim1.req01', motivo: 'cambio' }] });
  });
});

describe('persistencia · celulasMadre', () => {
  it('un archivo viejo sin el registro abre con la lista vacía', () => {
    const plano = JSON.parse(serializarSistema(nuevoSistema('digital', 'Viejo', AHORA))) as Record<string, unknown>;
    delete plano['celulasMadre'];
    expect(parsearSistema(JSON.stringify(plano)).celulasMadre).toEqual([]);
  });

  it('un registro con la metadata rota rechaza el archivo, con el motivo', () => {
    const plano = JSON.parse(serializarSistema(nuevoSistema('digital', 'Roto', AHORA))) as Record<string, unknown>;
    plano['celulasMadre'] = [{ id: 'celula-1', archivos: [], metadata: { kind: 'otra-cosa' } }];
    expect(() => parsearSistema(JSON.stringify(plano))).toThrow(/Célula Madre 'celula-1'/);
    plano['celulasMadre'] = 'no';
    expect(() => parsearSistema(JSON.stringify(plano))).toThrow(/'celulasMadre' debe ser una lista/);
  });
});
