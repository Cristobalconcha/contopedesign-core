import { describe, expect, it } from 'vitest';
import { BIBLIA } from './datos';
import { consultarBiblia } from './consultar';
import {
  ESTADOS_BIBLIA,
  FUERZAS_BIBLIA,
  TIPOS_DE_PRODUCTO,
  type BibliaGenerada,
  type EntradaBiblia,
  type FilaDeFuerza,
} from './tipos';

// --- Los datos compilados: la frontera del `as` en datos.ts ---------------

describe('biblia.generada.json', () => {
  it('trae los catorce temas, en orden, con entradas', () => {
    expect(BIBLIA.temas.map((t) => t.numero)).toEqual([
      '01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12', '13', '14',
    ]);
    for (const t of BIBLIA.temas) expect(t.entradas.length).toBeGreaterThan(0);
  });

  it('sólo usa estados, tipos y fuerzas de las constantes cerradas', () => {
    for (const t of BIBLIA.temas) {
      expect(ESTADOS_BIBLIA).toContain(t.estado);
      for (const e of t.entradas) {
        for (const f of e.fuerzas) {
          for (const tipo of f.tipos) expect(TIPOS_DE_PRODUCTO).toContain(tipo);
          for (const fz of f.fuerzas) expect(FUERZAS_BIBLIA).toContain(fz);
          expect(new Set(f.fuerzas).size).toBe(f.fuerzas.length);
        }
      }
    }
  });

  it('los ids son únicos y tienen la forma NN.ENN', () => {
    const ids = BIBLIA.temas.flatMap((t) => t.entradas.map((e) => e.id));
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^\d\d\.E\d+$/);
  });

  it('el tema 01 es el aprobado por Cristóbal (ESTADO.md)', () => {
    expect(BIBLIA.temas.find((t) => t.numero === '01')?.estado).toBe('aprobado');
  });

  it('toda entrada tiene enunciado; el informe cuadra con los datos', () => {
    let filas = 0;
    for (const t of BIBLIA.temas) {
      for (const e of t.entradas) {
        expect(e.enunciado.length).toBeGreaterThan(0);
        filas += e.fuerzas.length;
      }
    }
    expect(BIBLIA.informe.filas).toBe(filas);
    expect(BIBLIA.informe.entradas).toBe(BIBLIA.temas.reduce((n, t) => n + t.entradas.length, 0));
  });
});

// --- La consulta, sobre una Biblia de juguete ------------------------------

function fila(etiqueta: string, tipos: FilaDeFuerza['tipos'], fuerzas: FilaDeFuerza['fuerzas']): FilaDeFuerza {
  return { etiqueta, tipos, rol: null, fuerzas, texto: fuerzas.join('; '), porque: 'porque sí' };
}

function entrada(id: string, fuerzas: FilaDeFuerza[]): EntradaBiblia {
  return {
    id,
    numero: id.split('.')[1] ?? '',
    titulo: `Entrada ${id}`,
    enunciado: `Enunciado de ${id}.`,
    tipo: 'Postura.',
    posturas: null,
    paraAprender: 'Mire una pieza.',
    fuentes: '[F01]',
    contradicciones: null,
    notaFuerza: null,
    fuerzas,
  };
}

const JUGUETE: BibliaGenerada = {
  fuente: { carpeta: 'x', commit: null, generadoEn: '2026-09-29T00:00:00.000Z' },
  temas: [
    {
      numero: '01',
      slug: 'grilla',
      titulo: 'Grilla',
      estado: 'aprobado',
      entradas: [
        entrada('01.E01', [fila('web', ['web'], ['cortapisa']), fila('revista', ['revista'], ['divergencia'])]),
        entrada('01.E02', [fila('packaging', ['packaging'], ['recomendacion-fuerte'])]),
      ],
    },
    {
      numero: '05',
      slug: 'contraste',
      titulo: 'Contraste',
      estado: 'por-revisar',
      entradas: [entrada('05.E01', [fila('todos', [...TIPOS_DE_PRODUCTO], ['recomendacion-fuerte'])])],
    },
    {
      numero: '12',
      slug: 'editorial',
      titulo: 'Editorial',
      estado: 'borrador',
      entradas: [entrada('12.E01', [fila('editorial libro', ['editorial-libro'], ['cortapisa'])])],
    },
  ],
  informe: BIBLIA.informe,
};

describe('consultarBiblia', () => {
  it('sin filtros devuelve todas las entradas con todas sus filas y su tema', () => {
    const r = consultarBiblia({}, JUGUETE);
    expect(r.map((e) => e.id)).toEqual(['01.E01', '01.E02', '05.E01', '12.E01']);
    expect(r[0]?.fuerzas).toHaveLength(2);
    expect(r[0]?.tema).toEqual({ numero: '01', slug: 'grilla', titulo: 'Grilla', estado: 'aprobado' });
  });

  it('por tipo: deja sólo las filas de ese tipo y omite las entradas que se quedan sin filas', () => {
    const r = consultarBiblia({ tipos: ['web'] }, JUGUETE);
    expect(r.map((e) => e.id)).toEqual(['01.E01', '05.E01']);
    expect(r[0]?.fuerzas.map((f) => f.etiqueta)).toEqual(['web']);
  });

  it('por tema y por estado', () => {
    expect(consultarBiblia({ temas: ['05', '12'] }, JUGUETE).map((e) => e.id)).toEqual(['05.E01', '12.E01']);
    expect(consultarBiblia({ soloEstados: ['aprobado', 'por-revisar'] }, JUGUETE).map((e) => e.id)).toEqual([
      '01.E01',
      '01.E02',
      '05.E01',
    ]);
  });

  it('no muta los datos', () => {
    const antes = JSON.stringify(JUGUETE);
    consultarBiblia({}, JUGUETE)[0]?.fuerzas.pop();
    expect(JSON.stringify(JUGUETE)).toBe(antes);
  });

  it('sobre los datos reales: el contraste para web trae la cortapisa del Estado de Chile (05.E01)', () => {
    const r = consultarBiblia({ temas: ['05'], tipos: ['web'] });
    const e01 = r.find((e) => e.id === '05.E01');
    expect(e01).toBeDefined();
    expect(e01?.fuerzas.every((f) => f.tipos.includes('web'))).toBe(true);
    expect(e01?.fuerzas.some((f) => f.fuerzas.includes('cortapisa'))).toBe(true);
  });
});
