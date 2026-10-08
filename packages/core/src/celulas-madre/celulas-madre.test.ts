import { describe, expect, it } from 'vitest';
import { buildDim1DesignSet } from '../design-set/dim1-fixture.js';
import type { DesignSetV0 } from '../design-set/types.js';
import { colorCssARgb, rgbAHex } from './color-del-adn.js';
import { generadorDegradadosSvg } from './generador-degradados-svg.js';
import { generadorPaletaAse } from './generador-paleta-ase.js';
import { huella, jsonCanonico, sha256, utf8 } from './huella.js';
import { leerMetadataDeCelula, vigencia } from './metadata.js';
import { GENERADORES, generarCelula, resolverParametros } from './registro.js';
import { KIND_CELULA_MADRE, type HermanoDeCelula } from './tipos.js';

const SISTEMA = { designId: 'sistema-econut', nombre: 'Econut' };
const AHORA = '2026-10-08T12:00:00.000Z';

// ---------------------------------------------------------------------------
// Lector mínimo de .ase, escrito acá a propósito: no comparte código con el
// escritor, así que si los dos se equivocan, se equivocan distinto.
// ---------------------------------------------------------------------------
interface LeidoAse {
  version: string;
  grupos: Array<{ nombre: string; colores: Array<{ nombre: string; modelo: string; valores: number[]; tipo: number }> }>;
  bloquesDeclarados: number;
  bloquesLeidos: number;
}

function leerAseDePrueba(bytes: Uint8Array): LeidoAse {
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const firma = String.fromCharCode(...bytes.subarray(0, 4));
  if (firma !== 'ASEF') throw new Error(`firma ${firma}`);
  const leerNombre = (i: number): { nombre: string; fin: number } => {
    const largo = v.getUint16(i);
    const unidades: number[] = [];
    for (let k = 0; k < largo; k++) unidades.push(v.getUint16(i + 2 + k * 2));
    if (unidades[unidades.length - 1] !== 0) throw new Error('nombre sin nulo final');
    return { nombre: String.fromCharCode(...unidades.slice(0, -1)), fin: i + 2 + largo * 2 };
  };
  const salida: LeidoAse = { version: `${v.getUint16(4)}.${v.getUint16(6)}`, grupos: [], bloquesDeclarados: v.getUint32(8), bloquesLeidos: 0 };
  let i = 12;
  let grupo: LeidoAse['grupos'][number] | null = null;
  while (i < bytes.length) {
    const tipo = v.getUint16(i);
    const largo = v.getUint32(i + 2);
    const inicio = i + 6;
    salida.bloquesLeidos++;
    if (tipo === 0xc001) {
      grupo = { nombre: leerNombre(inicio).nombre, colores: [] };
      salida.grupos.push(grupo);
    } else if (tipo === 0xc002) {
      grupo = null;
    } else if (tipo === 0x0001) {
      const { nombre, fin } = leerNombre(inicio);
      const modelo = String.fromCharCode(...bytes.subarray(fin, fin + 4));
      const n = modelo === 'CMYK' ? 4 : modelo === 'Gray' ? 1 : 3;
      const valores = Array.from({ length: n }, (_, k) => v.getFloat32(fin + 4 + k * 4));
      const tipoColor = v.getUint16(fin + 4 + n * 4);
      expect(fin + 4 + n * 4 + 2).toBe(inicio + largo);
      if (!grupo) throw new Error('color fuera de grupo');
      grupo.colores.push({ nombre, modelo, valores, tipo: tipoColor });
    } else {
      throw new Error(`bloque desconocido ${tipo.toString(16)}`);
    }
    i = inicio + largo;
  }
  expect(i).toBe(bytes.length);
  return salida;
}

const aHexDeAse = (valores: number[]): string =>
  `#${valores
    .slice(0, 3)
    .map((x) => Math.round(x * 255).toString(16).padStart(2, '0'))
    .join('')}`;

function conPayload(set: DesignSetV0, requirementId: string, payload: unknown): DesignSetV0 {
  return { ...set, entries: set.entries.map((e) => (e.requirementId === requirementId ? { ...e, payload, revision: e.revision + 1, effectiveDefinitionId: `${e.effectiveDefinitionId}-r2` } : e)) };
}

function sin(set: DesignSetV0, requirementId: string): DesignSetV0 {
  return { ...set, entries: set.entries.filter((e) => e.requirementId !== requirementId) };
}

describe('huella', () => {
  it('SHA-256 da los vectores conocidos (FIPS 180-4)', () => {
    expect(sha256(utf8(''))).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
    expect(sha256(utf8('abc'))).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
    expect(sha256(utf8('abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq'))).toBe(
      '248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1',
    );
    // Un millón de 'a': cruza muchos bloques y el largo en bits pasa los 16 bits.
    expect(sha256(new Uint8Array(1_000_000).fill(0x61))).toBe('cdc76e5c9914fb9281a1c7e284d73e67f1809a48a497200e046d39ccc7112cd0');
  });

  it('UTF-8 escribe acentos y emoji como bytes correctos', () => {
    expect([...utf8('ñ')]).toEqual([0xc3, 0xb1]);
    expect([...utf8('€')]).toEqual([0xe2, 0x82, 0xac]);
    expect([...utf8('😀')]).toEqual([0xf0, 0x9f, 0x98, 0x80]);
  });

  it('el JSON canónico no depende del orden de las claves', () => {
    expect(jsonCanonico({ b: 1, a: { d: [1, 'x'], c: null } })).toBe('{"a":{"c":null,"d":[1,"x"]},"b":1}');
    expect(huella({ a: 1, b: 2 })).toBe(huella({ b: 2, a: 1 }));
    expect(huella({ a: 1 })).not.toBe(huella({ a: 2 }));
    expect(huella({ a: 1 })).toMatch(/^sha256:[0-9a-f]{64}$/);
  });
});

describe('colores del ADN', () => {
  it('convierte los colores CSS planos del manifiesto a sRGB', () => {
    expect(rgbAHex(colorCssARgb('#1d4ed8')!)).toBe('#1d4ed8');
    expect(rgbAHex(colorCssARgb('#abc')!)).toBe('#aabbcc');
    expect(rgbAHex(colorCssARgb('rgb(255, 0, 128)')!)).toBe('#ff0080');
    expect(rgbAHex(colorCssARgb('rgba(100%, 0%, 0%, 0.5)')!)).toBe('#ff0000');
    expect(rgbAHex(colorCssARgb('hsl(120, 100%, 25%)')!)).toBe('#008000');
    expect(rgbAHex(colorCssARgb('oklch(62.8% 0.2577 29.23)')!)).toBe('#ff0000');
    expect(rgbAHex(colorCssARgb('oklch(1 0 0)')!)).toBe('#ffffff');
    expect(colorCssARgb('red')).toBeNull();
  });
});

describe('Células Madre · paleta .ase', () => {
  it('el .ase se lee de vuelta y trae los colores del ADN con su nombre', () => {
    const r = generarCelula(generadorPaletaAse, buildDim1DesignSet(), { sistema: SISTEMA, generadoEn: AHORA });
    if (!r.ok) throw new Error(r.falta);
    expect(r.archivos.map((a) => a.nombre)).toEqual(['econut-paleta.ase', 'econut-paleta.ase.contope.json']);
    const ase = r.archivos[0]!.contenido as Uint8Array;
    const leido = leerAseDePrueba(ase);
    expect(leido.version).toBe('1.0');
    expect(leido.bloquesLeidos).toBe(leido.bloquesDeclarados);
    const porGrupo = Object.fromEntries(leido.grupos.map((g) => [g.nombre, g.colores]));
    expect(Object.keys(porGrupo)).toEqual([
      'Econut · ContOpe · Institucionales',
      'Econut · ContOpe · Neutros',
      'Econut · ContOpe · Roles',
      'Econut · ContOpe · Rampa azul',
      'Econut · ContOpe · Rampa verde',
      'Econut · ContOpe · Imprenta CMYK',
    ]);
    const inst = porGrupo['Econut · ContOpe · Institucionales']!;
    expect(inst.map((c) => [c.nombre, c.modelo, aHexDeAse(c.valores), c.tipo])).toEqual([
      ['azul-institucional', 'RGB ', '#1d4ed8', 0],
      ['verde-institucional', 'RGB ', '#15803d', 0],
    ]);
    // Los roles llevan el rol como nombre y resuelven la referencia al fundamento.
    const roles = porGrupo['Econut · ContOpe · Roles']!;
    expect(roles).toHaveLength(13);
    expect(roles[0]).toMatchObject({ nombre: 'background', modelo: 'RGB ' });
    expect(aHexDeAse(roles[0]!.valores)).toBe('#1d4ed8');
    expect(porGrupo['Econut · ContOpe · Rampa azul']!.map((c) => c.nombre)).toEqual(['azul 1', 'azul 2']);
    // CMYK de dim1.req14, en porcentaje en el ADN → 0..1 en el archivo.
    const cmyk = porGrupo['Econut · ContOpe · Imprenta CMYK']!;
    expect(cmyk.map((c) => c.nombre)).toEqual(['azul-institucional CMYK', 'verde-institucional CMYK']);
    expect(cmyk[0]!.modelo).toBe('CMYK');
    expect(cmyk[0]!.valores.map((x) => Math.round(x * 100))).toEqual([87, 64, 0, 15]);
  });

  it('los parámetros sacan grupos y lo que el generador lee', () => {
    const r = generarCelula(generadorPaletaAse, buildDim1DesignSet(), {
      sistema: SISTEMA,
      generadoEn: AHORA,
      parametros: { incluirRoles: false, incluirRampas: false, incluirImprenta: false },
    });
    if (!r.ok) throw new Error(r.falta);
    expect(leerAseDePrueba(r.archivos[0]!.contenido as Uint8Array).grupos.map((g) => g.nombre)).toEqual([
      'Econut · ContOpe · Institucionales',
      'Econut · ContOpe · Neutros',
    ]);
    expect(r.metadata.consulta).toEqual(['dim1.req01']);
  });

  it('la metadata trae sistema, generador, parámetros y la huella de cada definición leída', () => {
    const set = buildDim1DesignSet();
    const r = generarCelula(generadorPaletaAse, set, { sistema: SISTEMA, generadoEn: AHORA });
    if (!r.ok) throw new Error(r.falta);
    const hermano = JSON.parse(r.archivos[1]!.contenido as string) as HermanoDeCelula;
    expect(hermano.kind).toBe(KIND_CELULA_MADRE);
    expect(hermano.schemaVersion).toBe(1);
    expect(hermano.sistema).toEqual({ designId: 'sistema-econut', nombre: 'Econut', designSetId: 'ds-fixture-dim1' });
    expect(hermano.generador).toEqual({ id: 'paleta-ase', version: '1.0.0', nombre: 'Paleta de color' });
    expect(hermano.generadoEn).toBe(AHORA);
    expect(hermano.parametros).toEqual({ incluirRoles: true, incluirRampas: true, incluirImprenta: true });
    expect(hermano.ancestros.map((a) => a.requirementId)).toEqual(['dim1.req01', 'dim1.req02', 'dim1.req04', 'dim1.req14']);
    for (const a of hermano.ancestros) {
      const entrada = set.entries.find((e) => e.requirementId === a.requirementId)!;
      expect(a.huella).toBe(huella(entrada.payload));
      expect(a.effectiveDefinitionId).toBe(entrada.effectiveDefinitionId);
    }
    expect(hermano.archivo.nombre).toBe('econut-paleta.ase');
    expect(hermano.archivo.huella).toBe(`sha256:${sha256(r.archivos[0]!.contenido as Uint8Array)}`);
    expect(r.registrados[0]!.huella).toBe(hermano.archivo.huella);
    // Y se vuelve a leer, como la leería el taller.
    const leida = leerMetadataDeCelula(JSON.parse(r.archivos[1]!.contenido as string));
    expect(leida.ok).toBe(true);
  });

  it('disponible da el motivo cuando falta el color', () => {
    const vacio: DesignSetV0 = { schemaVersion: 1, designSetId: 'vacio', manifestRefs: {}, entries: [] };
    const d = generadorPaletaAse.disponible(vacio);
    expect(d.ok).toBe(false);
    if (!d.ok) expect(d.falta).toMatch(/Define primero los colores/);
    const r = generarCelula(generadorPaletaAse, vacio, { sistema: SISTEMA, generadoEn: AHORA });
    expect(r).toEqual({ ok: false, falta: d.ok ? '' : d.falta });
    expect(generadorDegradadosSvg.disponible(vacio).ok).toBe(false);
  });

  it('es determinista: mismo ADN y parámetros dan los mismos bytes; la fecha sólo cambia la metadata', () => {
    const a = generarCelula(generadorPaletaAse, buildDim1DesignSet(), { sistema: SISTEMA, generadoEn: AHORA });
    const b = generarCelula(generadorPaletaAse, buildDim1DesignSet(), { sistema: SISTEMA, generadoEn: AHORA });
    const c = generarCelula(generadorPaletaAse, buildDim1DesignSet(), { sistema: SISTEMA, generadoEn: '2027-01-01T00:00:00.000Z' });
    if (!a.ok || !b.ok || !c.ok) throw new Error('no generó');
    expect(a.archivos).toEqual(b.archivos);
    expect(c.archivos[0]!.contenido).toEqual(a.archivos[0]!.contenido);
    expect(c.archivos[1]!.contenido).not.toEqual(a.archivos[1]!.contenido);
  });
});

describe('Células Madre · vigencia', () => {
  const generar = (set: DesignSetV0) => {
    const r = generarCelula(generadorPaletaAse, set, { sistema: SISTEMA, generadoEn: AHORA });
    if (!r.ok) throw new Error(r.falta);
    return r.metadata;
  };

  it('vigente mientras el ADN no cambie', () => {
    const set = buildDim1DesignSet();
    expect(vigencia(generar(set), set)).toEqual({ estado: 'vigente' });
  });

  it('desactualizada cuando cambia un payload, y dice cuál', () => {
    const set = buildDim1DesignSet();
    const meta = generar(set);
    const otro = conPayload(set, 'dim1.req01', {
      institucionales: [{ name: 'azul-institucional', value: '#0000ff' }],
      neutros: [{ name: 'gris-neutral', value: '#64748b' }],
    });
    expect(vigencia(meta, otro)).toEqual({ estado: 'desactualizada', cambios: [{ requirementId: 'dim1.req01', motivo: 'cambio' }] });
  });

  it('desactualizada cuando se borra una definición leída', () => {
    const set = buildDim1DesignSet();
    expect(vigencia(generar(set), sin(set, 'dim1.req04'))).toEqual({
      estado: 'desactualizada',
      cambios: [{ requirementId: 'dim1.req04', motivo: 'borrada' }],
    });
  });

  it('desactualizada cuando aparece una definición que consulta y que no estaba', () => {
    const set = buildDim1DesignSet();
    const meta = generar(sin(set, 'dim1.req14'));
    expect(vigencia(meta, set)).toEqual({ estado: 'desactualizada', cambios: [{ requirementId: 'dim1.req14', motivo: 'nueva' }] });
  });

  it('un cambio en algo que no se leyó no la desactualiza', () => {
    const set = buildDim1DesignSet();
    expect(vigencia(generar(set), conPayload(set, 'dim1.req05', { surfaces: [] }))).toEqual({ estado: 'vigente' });
  });

  it('huérfana si viene de otro set o si no queda ninguna de sus definiciones', () => {
    const set = buildDim1DesignSet();
    const meta = generar(set);
    expect(vigencia(meta, { ...set, designSetId: 'otro' }).estado).toBe('huérfana');
    const sinColor = ['dim1.req01', 'dim1.req02', 'dim1.req04', 'dim1.req14'].reduce(sin, set);
    expect(vigencia(meta, sinColor).estado).toBe('huérfana');
  });
});

describe('Células Madre · degradados .svg', () => {
  it('arma un degradado por par seguido, con la metadata dentro', () => {
    const set = buildDim1DesignSet();
    const r = generarCelula(generadorDegradadosSvg, set, { sistema: SISTEMA, generadoEn: AHORA });
    if (!r.ok) throw new Error(r.falta);
    expect(r.archivos.map((a) => a.nombre)).toEqual(['econut-degradados.svg', 'econut-degradados.svg.contope.json']);
    const svg = r.archivos[0]!.contenido as string;
    expect(svg).toContain('<linearGradient id="degradado-azul-institucional-a-verde-institucional" x1="0" y1="0.5" x2="1" y2="0.5">');
    expect(svg).toContain('stop-color="#1d4ed8"');
    expect(svg).toContain('stop-color="#15803d"');
    expect((svg.match(/<linearGradient/g) ?? []).length).toBe(1);
    const json = /<metadata id="contope-celula-madre"><!\[CDATA\[([\s\S]*?)\]\]><\/metadata>/.exec(svg)?.[1];
    const meta = leerMetadataDeCelula(JSON.parse(json ?? 'null'));
    expect(meta.ok).toBe(true);
    if (meta.ok) {
      expect(meta.metadata.generador.id).toBe('degradados-svg');
      expect(meta.metadata.ancestros.map((a) => a.requirementId)).toEqual(['dim1.req01']);
    }
  });

  it('secuencia radial con colores de rol: un solo degradado y lee los roles', () => {
    const set = buildDim1DesignSet();
    const r = generarCelula(generadorDegradadosSvg, set, {
      sistema: SISTEMA,
      generadoEn: AHORA,
      parametros: { colores: ['neutros:gris-neutral', 'roles:accent', 'institucionales:verde-institucional', 'no-existe'], modo: 'secuencia', forma: 'radial' },
    });
    if (!r.ok) throw new Error(r.falta);
    const svg = r.archivos[0]!.contenido as string;
    expect((svg.match(/<radialGradient/g) ?? []).length).toBe(1);
    expect((svg.match(/<stop /g) ?? []).length).toBe(3);
    expect(svg).toContain('offset="0.5"');
    expect(r.metadata.parametros['colores']).toEqual(['neutros:gris-neutral', 'roles:accent', 'institucionales:verde-institucional']);
    expect(r.metadata.consulta).toEqual(['dim1.req01', 'dim1.req02']);
  });

  it('el ángulo sigue la convención de Illustrator (90° = de abajo hacia arriba)', () => {
    const r = generarCelula(generadorDegradadosSvg, buildDim1DesignSet(), { sistema: SISTEMA, generadoEn: AHORA, parametros: { angulo: 90 } });
    if (!r.ok) throw new Error(r.falta);
    expect(r.archivos[0]!.contenido as string).toContain('x1="0.5" y1="1" x2="0.5" y2="0"');
  });

  it('la fecha es lo único que cambia entre dos generaciones iguales', () => {
    const a = generarCelula(generadorDegradadosSvg, buildDim1DesignSet(), { sistema: SISTEMA, generadoEn: AHORA });
    const b = generarCelula(generadorDegradadosSvg, buildDim1DesignSet(), { sistema: SISTEMA, generadoEn: '2027-01-01T00:00:00.000Z' });
    if (!a.ok || !b.ok) throw new Error('no generó');
    expect((b.archivos[0]!.contenido as string).replace('2027-01-01T00:00:00.000Z', AHORA)).toBe(a.archivos[0]!.contenido);
  });
});

describe('Células Madre · registro', () => {
  it('cada generador tiene id único, versión semver, nombre y descripción, y parámetros con valor por defecto', () => {
    const ids = GENERADORES.map((g) => g.id);
    expect(new Set(ids).size).toBe(ids.length);
    const set = buildDim1DesignSet();
    for (const g of GENERADORES) {
      expect(g.version).toMatch(/^\d+\.\d+\.\d+$/);
      expect(g.nombre.length).toBeGreaterThan(3);
      expect(g.descripcion.length).toBeGreaterThan(40);
      expect(Object.keys(resolverParametros(g, set))).toEqual(g.parametros.map((p) => p.id));
    }
  });

  it('resolverParametros corrige lo que no calza con el esquema', () => {
    const set = buildDim1DesignSet();
    expect(resolverParametros(generadorDegradadosSvg, set, { angulo: 999, forma: 'cuadrada', colores: 'x', otro: 1 })).toEqual({
      colores: ['institucionales:azul-institucional', 'institucionales:verde-institucional'],
      modo: 'pares',
      forma: 'lineal',
      angulo: 360,
    });
  });
});
