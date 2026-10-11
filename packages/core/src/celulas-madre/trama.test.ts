import { bytesABase64, cuadroEn, leerTrama, utf8ABytes, validarTrama, type Trama } from '@contope/trama';
import { strFromU8, unzipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { buildDim1DesignSet } from '../design-set/dim1-fixture.js';
import { buildDim3EspacioDesignSet } from '../design-set/dim3-fixture.js';
import type { DesignSetV0 } from '../design-set/types.js';
import { generadorTrama, tramaDeParametros } from './generador-trama.js';
import { huella } from './huella.js';
import { leerMetadataDeLeeme } from './leeme.js';
import { vigencia } from './metadata.js';
import { GENERADORES, generarCelula, resolverParametros } from './registro.js';
import { armarTrama, coloresDeTramaDelAdn, formatosParaTrama, refrescarColoresDelAdn, repartirEscenas, tramaDeReceta } from './trama-del-adn.js';

const SISTEMA = { designId: 'sistema-nocturno', nombre: 'Nocturno' };
const AHORA = '2026-10-09T12:00:00.000Z';

function conPayload(set: DesignSetV0, requirementId: string, payload: unknown): DesignSetV0 {
  return { ...set, entries: set.entries.map((e) => (e.requirementId === requirementId ? { ...e, payload, revision: e.revision + 1, effectiveDefinitionId: `${e.effectiveDefinitionId}-r2` } : e)) };
}

/** El set de dim1 con roles de colores distintos: fondo oscuro, acento cálido. */
function setNocturno(acento = '#e0a040'): DesignSetV0 {
  const base = buildDim1DesignSet();
  const roles = (base.entries.find((e) => e.requirementId === 'dim1.req02')!.payload as { roleColors: Array<Record<string, unknown>> }).roleColors;
  const color: Record<string, string> = { background: '#0b0f14', accent: acento };
  return conPayload(base, 'dim1.req02', { roleColors: roles.map((r) => (color[r['role'] as string] ? { ...r, color: color[r['role'] as string] } : r)) });
}

const SIN_ADN: DesignSetV0 = { schemaVersion: 1, designSetId: 'ds-vacio', manifestRefs: {}, entries: [] };

function generar(parametros: Record<string, unknown> = {}, set: DesignSetV0 = setNocturno()) {
  const r = generarCelula(generadorTrama, set, { sistema: SISTEMA, generadoEn: AHORA, parametros });
  if (!r.ok) throw new Error(r.falta);
  return r;
}

const archivo = (r: ReturnType<typeof generar>, sufijo: string): string => {
  const a = r.archivos.find((x) => x.nombre.endsWith(sufijo));
  if (!a || typeof a.contenido !== 'string') throw new Error(`falta ${sufijo}`);
  return a.contenido;
};

describe('Trama: el generador', () => {
  it('está en el registro y está disponible siempre, con o sin ADN', () => {
    expect(GENERADORES).toContain(generadorTrama);
    expect(generadorTrama.disponible(SIN_ADN)).toEqual({ ok: true });
    expect(generadorTrama.disponible(setNocturno())).toEqual({ ok: true });
  });

  it('entrega el archivo de trama, el código CT1 y el SVG; el archivo pasa validarTrama', () => {
    for (const modo of ['vivo', 'secuencia']) {
      const r = generar({ modo });
      expect(r.archivos.map((a) => a.nombre)).toEqual(['nocturno.trama.json', 'nocturno.trama.txt', 'nocturno.trama.svg']);
      const doc = JSON.parse(archivo(r, '.json')) as unknown;
      expect(validarTrama(doc)).toEqual([]);
      expect((doc as Trama).tiempo.modo).toBe(modo);
    }
  });

  it('el archivo de trama lleva la procedencia (sin la receta) y su nombre', () => {
    const r = generar();
    const trama = JSON.parse(archivo(r, '.json')) as Trama;
    expect(Object.keys(trama).slice(0, 5)).toEqual(['kind', 'version', 'motor', 'nombre', 'procedencia']);
    expect(trama.nombre).toBe('Nocturno · Trama');
    const p = trama.procedencia as Record<string, unknown>;
    expect(p['kind']).toBe('contope/celula-madre');
    expect(p['sistema']).toEqual({ ...SISTEMA, designSetId: setNocturno().designSetId });
    expect(p['generador']).toEqual({ id: 'trama', version: generadorTrama.version, nombre: 'Trama' });
    expect(p['parametros']).not.toHaveProperty('receta');
  });

  it('el SVG es el primer instante, con la metadata adentro y la medida del formato', () => {
    const r = generar({ formato: ['1x1'], ancho: 800 });
    const svg = archivo(r, '.svg');
    expect(svg.startsWith('<?xml')).toBe(true);
    expect(svg).toContain('width="800" height="800"');
    expect(svg).toContain('<metadata id="contope-celula-madre"><![CDATA[');
    expect(svg).toContain('"generador": {');
    expect((svg.match(/<circle /g) ?? []).length).toBeGreaterThan(1000);
    expect(svg).toContain('fill="#0b0f14"'); // el fondo del ADN
  });

  it('mismo ADN, parámetros y fecha → mismos bytes (también el zip)', () => {
    const a = generar({ modo: 'secuencia', duracion: 6 });
    const b = generar({ modo: 'secuencia', duracion: 6 });
    expect(a.zip.contenido).toEqual(b.zip.contenido);
  });

  it('el zip trae el LEEME con la ficha y los tres archivos', () => {
    const r = generar();
    expect(r.zip.nombre).toBe('nocturno-trama.zip');
    const zip = unzipSync(r.zip.contenido);
    expect(Object.keys(zip)).toEqual(['LEEME.md', 'nocturno.trama.json', 'nocturno.trama.txt', 'nocturno.trama.svg']);
    const leeme = strFromU8(zip['LEEME.md']!);
    const ficha = leerMetadataDeLeeme(leeme);
    expect(ficha.ok).toBe(true);
    if (!ficha.ok) return;
    expect(ficha.metadata.generador.id).toBe('trama');
    expect(ficha.metadata.archivos.map((a) => a.nombre)).toEqual(['nocturno.trama.json', 'nocturno.trama.txt', 'nocturno.trama.svg']);
    expect(ficha.metadata.consulta).toEqual(['dim1.req01', 'dim1.req02']);
    expect(leeme).toContain('## Colores y tiempo · `nocturno.trama.json`');
    expect(leeme).toContain('Fondo: `#0b0f14`, del ADN (rol «background», `dim1.req02`)');
    expect(leeme).toContain('En Publisher');
    expect(leeme).toContain('imprenta');
  });
});

describe('Trama: los colores del ADN', () => {
  it('cada color sale de su rol y anota rol y huella', () => {
    const set = setNocturno();
    const c = coloresDeTramaDelAdn(set);
    const huellaDe = (id: string) => huella(set.entries.find((e) => e.requirementId === id)!.payload);
    expect(c.fondo).toEqual({ hex: '#0b0f14', origen: 'adn', rol: 'dim1.req02:background', huella: huellaDe('dim1.req02') });
    expect(c.cerca).toEqual({ hex: '#e0a040', origen: 'adn', rol: 'dim1.req02:accent', huella: huellaDe('dim1.req02') });
    expect(c.lejos).toEqual({ hex: '#1d4ed8', origen: 'adn', rol: 'dim1.req01:institucionales:azul-institucional', huella: huellaDe('dim1.req01') });
  });

  it('no repite el color del fondo en los puntos: salta al siguiente candidato', () => {
    // En el set de dim1 todos los roles son el azul institucional, también el fondo.
    const c = coloresDeTramaDelAdn(buildDim1DesignSet());
    expect(c.fondo.hex).toBe('#1d4ed8');
    expect(c.cerca).toMatchObject({ hex: '#15803d', origen: 'adn', rol: 'dim1.req01:institucionales:verde-institucional' });
    expect(c.lejos).toEqual({ hex: '#2a52d6', origen: 'manual' }); // nada distinto: el del look
  });

  it('un color elegido a mano queda propio (origen manual, sin rol)', () => {
    const t = armarTrama(setNocturno(), { colores: { cerca: '#FF0000' } });
    expect(t.color.cerca).toEqual({ hex: '#ff0000', origen: 'manual' });
    expect(t.color.fondo.origen).toBe('adn');
    expect(validarTrama(t)).toEqual([]);
  });

  it('con «los del look», ningún color viene del ADN y el ADN no es ancestro', () => {
    const r = generar({ colores: 'look', look: 'papel' });
    const t = JSON.parse(archivo(r, '.json')) as Trama;
    expect(t.color.fondo).toEqual({ hex: '#f1ede4', origen: 'manual' });
    expect(r.metadata.consulta).toEqual([]);
  });

  it('al regenerar una receta, los colores del ADN se leen de nuevo; los propios no', () => {
    const primera = generar();
    const receta = archivo(primera, '.txt').trim();
    const otroAcento = setNocturno('#ff6699');
    expect(vigencia(primera.metadata, otroAcento).estado).toBe('desactualizada');
    const t = JSON.parse(archivo(generar({ receta }, otroAcento), '.json')) as Trama;
    expect(t.color.cerca).toMatchObject({ hex: '#ff6699', origen: 'adn', rol: 'dim1.req02:accent' });
    const propia = armarTrama(setNocturno(), { colores: { cerca: '#123456' } });
    expect(refrescarColoresDelAdn(propia, otroAcento).color.cerca).toEqual({ hex: '#123456', origen: 'manual' });
  });

  it('si el rol ya no existe, el color queda propio con el mismo hex', () => {
    const t = armarTrama(setNocturno());
    expect(refrescarColoresDelAdn(t, SIN_ADN).color.cerca).toEqual({ hex: '#e0a040', origen: 'manual' });
  });
});

describe('Trama: sin ADN', () => {
  it('arma una trama válida con null o con un set vacío, con los colores del look', () => {
    for (const set of [null, SIN_ADN]) {
      const t = armarTrama(set, { look: 'velo-lejano' });
      expect(validarTrama(t)).toEqual([]);
      expect(t.color.lejos).toEqual({ hex: '#1d3fb8', origen: 'manual' });
      expect(t.configuracion.lineas).toBe(80);
    }
  });

  it('genera el zip sin ancestros y lo dice en el LEEME', () => {
    const r = generar({}, SIN_ADN);
    expect(r.metadata.consulta).toEqual([]);
    expect(r.metadata.ancestros).toEqual([]);
    expect(r.leeme.contenido).toContain('El sistema todavía no define colores');
    expect(validarTrama(JSON.parse(archivo(r, '.json')))).toEqual([]);
  });
});

describe('Trama: formato y escenas', () => {
  it('los formatos de hoja del ADN se ofrecen primero, con formatoAdn', () => {
    const set = buildDim3EspacioDesignSet();
    const formatos = formatosParaTrama(set);
    const delAdn = formatos.filter((f) => f.valor.startsWith('adn:'));
    expect(delAdn.length).toBeGreaterThan(0);
    expect(formatos[0]).toBe(delAdn[0]);
    const r = generar({}, set);
    const t = JSON.parse(archivo(r, '.json')) as Trama;
    expect(t.lienzo.formatoAdn).toMatchObject({ requisito: 'dim3.req08' });
    expect(r.metadata.consulta).toContain('dim3.req08');
    expect(resolverParametros(generadorTrama, set)['formato']).toEqual([delAdn[0]!.valor]);
  });

  it('reparte las escenas: con el ciclo cerrado la última no llega al final', () => {
    expect(repartirEscenas(4, 8, true)).toEqual([0, 2, 4, 6]);
    expect(repartirEscenas(3, 8, false)).toEqual([0, 4, 8]);
    expect(repartirEscenas(1, 8, true)).toEqual([0]);
  });

  it('cerrar el ciclo: el último cuadro es el primero', () => {
    const t = armarTrama(null, {
      modo: 'secuencia',
      duracion: 4,
      cerrarCiclo: true,
      escenas: [
        { nombre: 'Plegada', captura: { evolucion: 6 } },
        { nombre: 'Ola', captura: { evolucion: 30, configuracion: { anchoLamina: 6, pliegues: 2.4 }, color: { cerca: '#ff0000' } } },
      ],
    });
    expect(t.tiempo.modo === 'secuencia' && t.tiempo.escenas.map((e) => e.t)).toEqual([0, 2]);
    const inicio = cuadroEn(t, 0, 160, 90, 0.3);
    const fin = cuadroEn(t, 4, 160, 90, 0.3);
    const medio = cuadroEn(t, 2, 160, 90, 0.3);
    expect(Array.from(fin.cuadro)).toEqual(Array.from(inicio.cuadro));
    expect(fin.estado.colores).toEqual(inicio.estado.colores);
    expect(medio.estado.colores.cerca).toBe('#ff0000');
    expect(Array.from(medio.cuadro)).not.toEqual(Array.from(inicio.cuadro));
  });
});

describe('Trama: importar', () => {
  it('CT1 de ida y vuelta: el código del .txt es el mismo archivo', () => {
    const r = generar({ modo: 'secuencia' });
    const leida = leerTrama(archivo(r, '.txt'));
    expect(leida.ok && leida.origen).toBe('ct1');
    expect(leida.ok && leida.trama).toEqual(JSON.parse(archivo(r, '.json')));
  });

  it('SP1 de v7 como receta: se convierte en una trama en vivo', () => {
    const sp1 = 'SP1.' + bytesABase64(utf8ABytes(JSON.stringify({ time: 12.5, render: 'lineas', cfg: { lineCount: 50, colorBg: '#ffffff', colorDeep: '#112233', colorAccent: '#445566' } })));
    const t = tramaDeParametros(SIN_ADN, { receta: sp1 });
    expect(t.tiempo).toEqual({ modo: 'vivo', inicio: 12.5 });
    expect(t.dibujo.modo).toBe('lineas');
    expect(t.configuracion.lineas).toBe(50);
    expect(t.color.fondo).toEqual({ hex: '#ffffff', origen: 'manual' });
    expect(validarTrama(JSON.parse(archivo(generar({ receta: sp1 }, SIN_ADN), '.json')))).toEqual([]);
  });

  it('una receta rota no genera y dice por qué, en español', () => {
    expect(tramaDeReceta('hola', null)).toEqual({ ok: false, error: expect.stringContaining('no se reconoce') as unknown });
    const r = generarCelula(generadorTrama, SIN_ADN, { sistema: SISTEMA, generadoEn: AHORA, parametros: { receta: 'CT1.@@@' } });
    expect(r.ok).toBe(false);
    expect(!r.ok && r.falta).toMatch(/^La receta de trama no se pudo leer/);
  });
});
