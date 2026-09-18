import { describe, expect, it } from 'vitest';
import { CATALOGO, filtrar, resolverCaso, SIN_FILTROS, tieneAncho, urlDeFamiliaCompleta, urlDeMuestra } from './catalogo.js';

describe('catálogo tipográfico', () => {
  it('trae las 1.946 familias de Google Fonts con fecha de descarga', () => {
    expect(CATALOGO.familias).toHaveLength(1946);
    expect(CATALOGO.descargadoEn).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('al filtrar por trazo cuenta aparte las que no lo declaran, en vez de perderlas en silencio', () => {
    const r = filtrar(CATALOGO.familias, { ...SIN_FILTROS, trazos: new Set(['Serif']) });
    expect(r.sinTrazo).toBe(585);
    expect(r.familias.every((f) => f.s === 'Serif')).toBe(true);
    expect(r.familias.length).toBeGreaterThan(300);
  });

  it('el ancho también se lee del nombre', () => {
    const narrow = CATALOGO.familias.find((f) => f.f === 'Archivo Narrow');
    expect(narrow).toBeDefined();
    expect(narrow?.wd).toBeNull();
    expect(tieneAncho(narrow!)).toBe(true);
    const r = filtrar(CATALOGO.familias, { ...SIN_FILTROS, ancho: true });
    expect(r.familias.some((f) => f.f === 'Archivo Narrow')).toBe(true);
  });

  it('los pesos exigen que TODOS los elegidos existan; la búsqueda es por nombre', () => {
    const r = filtrar(CATALOGO.familias, { ...SIN_FILTROS, pesos: new Set([100, 900]), busqueda: 'sans' });
    expect(r.familias.every((f) => f.w.includes(100) && f.w.includes(900) && /sans/i.test(f.f))).toBe(true);
  });

  it('ordena por lo que Google ordena', () => {
    const pop = filtrar(CATALOGO.familias, SIN_FILTROS).familias;
    expect((pop[0]?.p ?? 0) <= (pop[1]?.p ?? 0)).toBe(true);
    const alfa = filtrar(CATALOGO.familias, { ...SIN_FILTROS, orden: 'alfabetico' }).familias;
    expect(alfa[0]?.f.localeCompare(alfa[1]?.f ?? '')).toBeLessThanOrEqual(0);
  });
});

describe('el árbol de cuatro casos', () => {
  it('1: nombre que está en Google Fonts → directo', () => {
    const c = resolverCaso({ nombre: 'Lora' });
    expect(c.caso).toBe(1);
    if (c.caso === 1) expect(c.familia.f).toBe('Lora');
  });
  it('2: nombre conocido que no está → prefiltro por lo que el nombre deja leer, modificable', () => {
    const c = resolverCaso({ nombre: 'Adobe Caslon Pro' });
    expect(c.caso).toBe(2);
    if (c.caso === 2) {
      expect([...(c.prefiltro.trazos ?? [])]).toEqual(['Serif']);
      expect(c.pista).toMatch(/no está en Google Fonts/);
    }
  });
  it('3: sólo muestra → sin prefiltro y diciéndolo', () => {
    const c = resolverCaso({ hayMuestra: true });
    expect(c.caso).toBe(3);
  });
  it('4: nada → no disponible', () => {
    expect(resolverCaso({}).caso).toBe(4);
  });
});

describe('urlDeMuestra', () => {
  it('arma la URL de Google Fonts con los nombres con espacios como +', () => {
    expect(urlDeMuestra(['Archivo Narrow', 'Lora'])).toBe(
      'https://fonts.googleapis.com/css2?family=Archivo+Narrow&family=Lora&display=swap',
    );
  });
});

describe('urlDeFamiliaCompleta', () => {
  const base = {
    f: 'Nombre Con Espacios',
    c: 'Sans Serif',
    s: 'Sans Serif',
    k: [],
    w: [300, 400, 700],
    i: 0 as 0 | 1,
    v: [],
    wd: null,
    l: ['latin'],
    p: null,
    t: null,
    d: null,
    o: 1 as 0 | 1,
  };

  it('con itálica pide cada peso dos veces, primero las redondas y después las itálicas', () => {
    expect(urlDeFamiliaCompleta({ ...base, i: 1 })).toBe(
      'https://fonts.googleapis.com/css2?family=Nombre+Con+Espacios:ital,wght@0,300;0,400;0,700;1,300;1,400;1,700&display=swap',
    );
  });

  it('sin itálica pide sólo los pesos', () => {
    expect(urlDeFamiliaCompleta(base)).toBe('https://fonts.googleapis.com/css2?family=Nombre+Con+Espacios:wght@300;400;700&display=swap');
  });
});
