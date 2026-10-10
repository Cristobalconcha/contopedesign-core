import { strFromU8, unzipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { buildDim1DesignSet } from '../design-set/dim1-fixture.js';
import type { DesignSetV0 } from '../design-set/types.js';
import { colorCssARgb, rgbAHex } from './color-del-adn.js';
import { generadorDegradadosSvg } from './generador-degradados-svg.js';
import { generadorPaletaAse } from './generador-paleta-ase.js';
import { huella, jsonCanonico, sha256, utf8 } from './huella.js';
import { escribirLeeme, fechaEnPalabras, leerMetadataDeLeeme } from './leeme.js';
import { leerMetadataDeCelula, vigencia } from './metadata.js';
import { GENERADORES, generarCelula, resolverParametros } from './registro.js';
import { KIND_CELULA_MADRE } from './tipos.js';
import { armarZip, entradasDeCelula } from './zip.js';

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
    expect(r.archivos.map((a) => a.nombre)).toEqual(['econut-paleta.ase']);
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
    const leida = leerMetadataDeLeeme(r.leeme.contenido);
    if (!leida.ok) throw new Error(leida.motivo);
    const ficha = leida.metadata;
    expect(ficha.kind).toBe(KIND_CELULA_MADRE);
    expect(ficha.schemaVersion).toBe(1);
    expect(ficha.sistema).toEqual({ designId: 'sistema-econut', nombre: 'Econut', designSetId: 'ds-fixture-dim1' });
    expect(ficha.generador).toEqual({ id: 'paleta-ase', version: '1.0.0', nombre: 'Paleta de color' });
    expect(ficha.generadoEn).toBe(AHORA);
    expect(ficha.parametros).toEqual({ incluirRoles: true, incluirRampas: true, incluirImprenta: true });
    expect(ficha.ancestros.map((a) => a.requirementId)).toEqual(['dim1.req01', 'dim1.req02', 'dim1.req04', 'dim1.req14']);
    for (const a of ficha.ancestros) {
      const entrada = set.entries.find((e) => e.requirementId === a.requirementId)!;
      expect(a.huella).toBe(huella(entrada.payload));
      expect(a.effectiveDefinitionId).toBe(entrada.effectiveDefinitionId);
    }
    expect(ficha.archivos).toEqual([
      { nombre: 'econut-paleta.ase', tipoMime: 'application/octet-stream', huella: `sha256:${sha256(r.archivos[0]!.contenido as Uint8Array)}` },
    ]);
    expect(r.registrados).toEqual(ficha.archivos);
    // La metadata común de la ficha es la misma que guarda el taller.
    expect(leerMetadataDeCelula(ficha)).toEqual({ ok: true, metadata: r.metadata });
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
    expect(a.zip.contenido).toEqual(b.zip.contenido);
    expect(c.archivos[0]!.contenido).toEqual(a.archivos[0]!.contenido);
    expect(c.leeme.contenido).not.toEqual(a.leeme.contenido);
    expect(c.zip.contenido).not.toEqual(a.zip.contenido);
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
    expect(r.archivos.map((a) => a.nombre)).toEqual(['econut-degradados.svg']);
    expect(r.zip.nombre).toBe('econut-degradados-svg.zip');
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

describe('Células Madre · el .zip y su LEEME.md', () => {
  const generarPaleta = (fecha = AHORA) => {
    const r = generarCelula(generadorPaletaAse, buildDim1DesignSet(), { sistema: { designId: 'x', nombre: 'Santa Lucía' }, generadoEn: fecha });
    if (!r.ok) throw new Error(r.falta);
    return r;
  };

  it('el zip se llama <sistema>-<generador>.zip y trae el LEEME y el archivo, byte a byte', () => {
    const r = generarPaleta();
    expect(r.zip.nombre).toBe('santa-lucia-paleta-ase.zip');
    expect(r.zip.tipoMime).toBe('application/zip');
    const dentro = unzipSync(r.zip.contenido);
    expect(Object.keys(dentro)).toEqual(['LEEME.md', 'santa-lucia-paleta.ase']);
    expect(dentro['santa-lucia-paleta.ase']).toEqual(r.archivos[0]!.contenido);
    expect(strFromU8(dentro['LEEME.md']!)).toBe(r.leeme.contenido);
    // No queda ningún .contope.json hermano.
    expect(Object.keys(dentro).some((n) => n.endsWith('.contope.json'))).toBe(false);
  });

  it('el zip es determinista: la fecha de las entradas es la de la generación, en cifras UTC', () => {
    expect(generarPaleta().zip.contenido).toEqual(generarPaleta().zip.contenido);
    const bytes = generarPaleta('2026-10-08T12:34:56.000Z').zip.contenido;
    const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    expect(v.getUint32(0, true)).toBe(0x04034b50);
    const hora = v.getUint16(10, true);
    const dia = v.getUint16(12, true);
    expect([(dia >> 9) + 1980, (dia >> 5) & 15, dia & 31, hora >> 11, (hora >> 5) & 63, (hora & 31) * 2]).toEqual([2026, 10, 8, 12, 34, 56]);
  });

  it('armarZip pone las entradas en carpetas y rechaza rutas que se salen o se repiten', () => {
    const r = generarPaleta();
    const dentro = unzipSync(armarZip(entradasDeCelula(r, 'celulas-madre/paleta'), AHORA));
    expect(Object.keys(dentro)).toEqual(['celulas-madre/paleta/LEEME.md', 'celulas-madre/paleta/santa-lucia-paleta.ase']);
    expect(() => armarZip([{ ruta: '../fuera.txt', contenido: 'x' }], AHORA)).toThrow(/no permitida/);
    expect(() => armarZip([{ ruta: '/raiz.txt', contenido: 'x' }], AHORA)).toThrow(/no permitida/);
    expect(() => armarZip([{ ruta: 'a.txt', contenido: 'x' }, { ruta: 'a.txt', contenido: 'y' }], AHORA)).toThrow(/repetida/);
    expect(() => armarZip([{ ruta: 'a.txt', contenido: 'x' }], 'no es fecha')).toThrow(/Fecha/);
  });

  it('el LEEME dice qué es, de dónde viene, qué definiciones y parámetros usó, cómo usarlo, y que caduca', () => {
    const t = generarPaleta().leeme.contenido;
    expect(t.startsWith('# Paleta de color · Santa Lucía\n')).toBe(true);
    expect(t).toContain('- Sistema: **Santa Lucía**');
    expect(t).toContain('- Generador: Paleta de color, versión 1.0.0');
    expect(t).toContain(`- Generado el ${fechaEnPalabras(AHORA)}`);
    const set = buildDim1DesignSet();
    const req01 = set.entries.find((e) => e.requirementId === 'dim1.req01')!;
    expect(t).toContain(`- **Fundamento cromático** (\`dim1.req01\`): revisión ${req01.revision}, huella \`${huella(req01.payload).slice(7, 19)}\``);
    expect(t).toContain('- **Reproducción en imprenta** (`dim1.req14`)');
    expect(t).toContain('- Incluir las rampas: sí');
    expect(t).toContain('Abrir biblioteca de muestras → Otra biblioteca');
    expect(t).toContain('queda desactualizado');
    expect(t).toMatch(/para que ContOpe lo lea[^\n]*\n\n```json\n\{/);
    expect(t.trimEnd().endsWith('```')).toBe(true);
  });

  it('la fecha se dice en palabras, en hora de Chile', () => {
    expect(fechaEnPalabras('2026-10-08T12:00:00.000Z')).toBe('8 de octubre de 2026, 09:00 (hora de Chile)');
    expect(fechaEnPalabras('2026-07-01T23:05:00.000Z')).toBe('1 de julio de 2026, 19:05 (hora de Chile)');
    expect(fechaEnPalabras('otra cosa')).toBe('otra cosa');
  });

  it('el LEEME de un SVG explica cómo abrirlo, dice qué no estaba definido y los parámetros en palabras', () => {
    const r = generarCelula(generadorDegradadosSvg, buildDim1DesignSet(), {
      sistema: SISTEMA,
      generadoEn: AHORA,
      parametros: { colores: ['institucionales:verde-institucional', 'institucionales:azul-institucional'], forma: 'radial' },
    });
    if (!r.ok) throw new Error(r.falta);
    expect(r.leeme.contenido).toContain('Illustrator (Archivo → Abrir)');
    expect(r.leeme.contenido).toContain('- Colores, en orden: verde-institucional → azul-institucional');
    expect(r.leeme.contenido).toContain('- Forma: Radial (desde el centro)');
    const sinRampas = generarCelula(generadorPaletaAse, sin(buildDim1DesignSet(), 'dim1.req04'), { sistema: SISTEMA, generadoEn: AHORA });
    if (!sinRampas.ok) throw new Error(sinRampas.falta);
    expect(sinRampas.leeme.contenido).toContain('- **Rampas** (`dim1.req04`): no estaba definida al generar. Si se define, este archivo queda desactualizado.');
  });

  it('un solo LEEME describe varios archivos, y su ficha trae la huella de cada uno', () => {
    const set = buildDim1DesignSet();
    const r = generarPaleta();
    const otro = { nombre: 'santa-lucia-muestra.svg', tipoMime: 'image/svg+xml', contenido: '<svg/>' };
    const leeme = escribirLeeme({ generador: generadorPaletaAse, designSet: set, metadata: r.metadata, archivos: [...r.archivos, otro] });
    expect(leeme.contenido).toContain('Trae estos archivos:');
    expect(leeme.contenido).toContain('**`santa-lucia-muestra.svg`**. Es un dibujo vectorial.');
    const leida = leerMetadataDeLeeme(leeme.contenido);
    if (!leida.ok) throw new Error(leida.motivo);
    expect(leida.metadata.archivos.map((a) => [a.nombre, a.huella])).toEqual([
      ['santa-lucia-paleta.ase', `sha256:${sha256(r.archivos[0]!.contenido as Uint8Array)}`],
      ['santa-lucia-muestra.svg', `sha256:${sha256(utf8('<svg/>'))}`],
    ]);
  });

  it('leerMetadataDeLeeme toma el último bloque json, tolera CRLF y comillas invertidas, y falla cerrado', () => {
    const r = generarPaleta();
    const conRuido = `Nota previa:\n\n\`\`\`json\n{"kind":"otra cosa"}\n\`\`\`\n\n${r.leeme.contenido}`.replace(/\n/g, '\r\n');
    const leida = leerMetadataDeLeeme(conRuido);
    expect(leida.ok && leida.metadata.generador.id).toBe('paleta-ase');
    expect(vigencia(leida.ok ? leida.metadata : r.metadata, buildDim1DesignSet())).toEqual({ estado: 'vigente' });

    const raro = generarCelula(generadorPaletaAse, buildDim1DesignSet(), { sistema: { designId: 'y', nombre: 'Con ``` adentro' }, generadoEn: AHORA });
    if (!raro.ok) throw new Error(raro.falta);
    expect(raro.leeme.contenido).toContain('````json');
    const leidaRara = leerMetadataDeLeeme(raro.leeme.contenido);
    expect(leidaRara.ok && leidaRara.metadata.sistema.nombre).toBe('Con ``` adentro');

    expect(leerMetadataDeLeeme('# Sin ficha')).toEqual({ ok: false, motivo: 'el LEEME no trae el bloque json con la ficha' });
    expect(leerMetadataDeLeeme('```json\n{ roto\n```')).toEqual({ ok: false, motivo: 'el bloque json del LEEME no se puede leer' });
    expect(leerMetadataDeLeeme('```json\n{"kind":"contope/sistema"}\n```').ok).toBe(false);
    const sinArchivos = JSON.stringify({ ...r.metadata });
    expect(leerMetadataDeLeeme(`\`\`\`json\n${sinArchivos}\n\`\`\``)).toEqual({ ok: false, motivo: "'archivos' debe ser una lista con al menos un archivo" });
  });
});
