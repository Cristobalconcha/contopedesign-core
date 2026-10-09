import { strFromU8, unzipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { buildDim3EspacioDesignSet, resolvedDim3EspacioPayloads } from '../design-set/dim3-fixture.js';
import type { DesignSetV0 } from '../design-set/types.js';
import { emptyRectoras } from '../design-set/dim1-fixture.js';
import { evaluateManifest } from '../requirement-manifest/evaluate.js';
import { DIM3_MANIFEST_V0 } from '../requirement-manifest/manifest-v0-dim3.js';
import { generadorGrillaSvg, medianilesDeDivision } from './generador-grilla-svg.js';
import { huella } from './huella.js';
import { leerMetadataDeLeeme } from './leeme.js';
import { leerMetadataDeCelula } from './metadata.js';
import { GENERADORES, generarCelula, resolverParametros } from './registro.js';

const SISTEMA = { designId: 'sistema-econut', nombre: 'Econut' };
const AHORA = '2026-10-08T12:00:00.000Z';

// ---------------------------------------------------------------------------
// Lector mínimo de XML, escrito acá a propósito (el núcleo no tiene DOM): si
// el SVG no está bien formado —etiquetas sin cerrar, atributos rotos,
// entidades desconocidas—, falla.
// ---------------------------------------------------------------------------
interface Nodo {
  nombre: string;
  atributos: Record<string, string>;
  hijos: Nodo[];
  texto: string;
}

function leerXml(xml: string): Nodo {
  let i = 0;
  const raiz: Nodo = { nombre: '#documento', atributos: {}, hijos: [], texto: '' };
  const pila: Nodo[] = [raiz];
  const entidades: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
  const desescapar = (t: string): string =>
    t.replace(/&([a-z]+);/g, (_, e: string) => {
      const v = entidades[e];
      if (v === undefined) throw new Error(`entidad desconocida &${e};`);
      return v;
    });
  while (i < xml.length) {
    if (xml.startsWith('<?', i)) {
      i = xml.indexOf('?>', i) + 2;
    } else if (xml.startsWith('<![CDATA[', i)) {
      const fin = xml.indexOf(']]>', i);
      if (fin < 0) throw new Error('CDATA sin cerrar');
      pila[pila.length - 1]!.texto += xml.slice(i + 9, fin);
      i = fin + 3;
    } else if (xml.startsWith('</', i)) {
      const fin = xml.indexOf('>', i);
      const nombre = xml.slice(i + 2, fin).trim();
      const abierto = pila.pop();
      if (abierto?.nombre !== nombre) throw new Error(`cierra </${nombre}> pero estaba abierto <${abierto?.nombre}>`);
      i = fin + 1;
    } else if (xml[i] === '<') {
      const m = /^<([A-Za-z_][\w:.-]*)((?:\s+[A-Za-z_][\w:.-]*="[^"<]*")*)\s*(\/?)>/.exec(xml.slice(i));
      if (!m) throw new Error(`etiqueta mal formada cerca de «${xml.slice(i, i + 40)}»`);
      const atributos: Record<string, string> = {};
      for (const a of (m[2] ?? '').matchAll(/([A-Za-z_][\w:.-]*)="([^"]*)"/g)) {
        if (a[1]! in atributos) throw new Error(`atributo repetido ${a[1]}`);
        atributos[a[1]!] = desescapar(a[2]!);
      }
      const nodo: Nodo = { nombre: m[1]!, atributos, hijos: [], texto: '' };
      pila[pila.length - 1]!.hijos.push(nodo);
      if (m[3] !== '/') pila.push(nodo);
      i += m[0].length;
    } else {
      const fin = xml.indexOf('<', i);
      const corte = fin < 0 ? xml.length : fin;
      pila[pila.length - 1]!.texto += desescapar(xml.slice(i, corte));
      i = corte;
    }
  }
  if (pila.length !== 1) throw new Error(`quedó abierto <${pila[pila.length - 1]!.nombre}>`);
  const elementos = raiz.hijos;
  if (elementos.length !== 1) throw new Error('el documento debe tener una sola raíz');
  return elementos[0]!;
}

const capasDe = (svg: Nodo): Nodo[] => svg.hijos.filter((h) => h.nombre === 'g');
const capa = (svg: Nodo, id: string): Nodo | undefined => capasDe(svg).find((g) => g.atributos['id'] === id);
const num = (n: Nodo, a: string): number => Number(n.atributos[a]);

function generar(parametros: Record<string, unknown> = {}, set: DesignSetV0 = buildDim3EspacioDesignSet()) {
  const r = generarCelula(generadorGrillaSvg, set, { sistema: SISTEMA, generadoEn: AHORA, parametros });
  if (!r.ok) throw new Error(r.falta);
  return r;
}

function svgDe(parametros: Record<string, unknown>): Nodo {
  const r = generar(parametros);
  expect(r.archivos).toHaveLength(1);
  return leerXml(r.archivos[0]!.contenido as string);
}

function sin(set: DesignSetV0, requirementId: string): DesignSetV0 {
  return { ...set, entries: set.entries.filter((e) => e.requirementId !== requirementId) };
}

const A4 = { reticulas: ['texto-corrido'], formatos: ['a4-vertical'] };

describe('Células Madre · grilla .svg', () => {
  it('la fixture de espacio es ADN válido para el manifiesto de la dimensión 3', () => {
    const evaluacion = evaluateManifest({ manifest: DIM3_MANIFEST_V0, payloads: resolvedDim3EspacioPayloads(), rectoras: emptyRectoras() });
    for (const id of ['dim3.req01', 'dim3.req03', 'dim3.req04', 'dim3.req08', 'dim3.req09']) {
      expect(evaluacion.resultados.find((r) => r.requisitoId === id)?.resultado, id).toBe('resuelto');
    }
  });

  it('está en el registro', () => {
    expect(GENERADORES).toContain(generadorGrillaSvg);
  });

  it('el SVG parsea; la hoja A4 mide 210 × 297 mm y el sangrado de 3 mm va por fuera', () => {
    const svg = svgDe(A4);
    expect(svg.nombre).toBe('svg');
    expect(svg.atributos['width']).toBe('216mm');
    expect(svg.atributos['height']).toBe('303mm');
    expect(svg.atributos['viewBox']).toBe('-3 -3 216 303');
    const hoja = capa(svg, 'Hoja')!.hijos[0]!;
    expect([hoja.nombre, num(hoja, 'x'), num(hoja, 'y'), num(hoja, 'width'), num(hoja, 'height')]).toEqual(['rect', 0, 0, 210, 297]);
    const sangrado = capa(svg, 'Sangrado')!.hijos[0]!;
    expect([num(sangrado, 'x'), num(sangrado, 'y'), num(sangrado, 'width'), num(sangrado, 'height')]).toEqual([-3, -3, 216, 303]);
  });

  it('sin la capa Sangrado, el lienzo es la hoja exacta', () => {
    const svg = svgDe({ ...A4, capas: ['hoja', 'columnas'] });
    expect([svg.atributos['width'], svg.atributos['height'], svg.atributos['viewBox']]).toEqual(['210mm', '297mm', '0 0 210 297']);
  });

  it('las columnas y los medianiles calzan con columnas, medianil y márgenes', () => {
    const svg = svgDe(A4);
    // 6 columnas, medianil 4 mm, márgenes de 20 mm: (210 − 40 − 5 × 4) / 6 = 25 mm.
    const columnas = capa(svg, 'Columnas')!.hijos;
    expect(columnas).toHaveLength(6);
    columnas.forEach((c, i) => {
      expect(num(c, 'x')).toBeCloseTo(20 + i * 29, 6);
      expect(num(c, 'width')).toBeCloseTo(25, 6);
      expect(num(c, 'y')).toBe(20);
      expect(num(c, 'height')).toBe(257);
    });
    const ultima = columnas[5]!;
    expect(num(ultima, 'x') + num(ultima, 'width')).toBeCloseTo(190, 6);
    const medianiles = capa(svg, 'Medianiles')!.hijos;
    expect(medianiles.map((m) => [num(m, 'x'), num(m, 'width')])).toEqual([45, 74, 103, 132, 161].map((x) => [x, 4]));
    const margenes = capa(svg, 'Margenes')!.hijos[0]!;
    expect([num(margenes, 'x'), num(margenes, 'y'), num(margenes, 'width'), num(margenes, 'height')]).toEqual([20, 20, 170, 257]);
    // Línea base de 12 pt = 4,2333 mm, desde el margen superior hasta el inferior.
    const lineas = capa(svg, 'Linea_base')!.hijos;
    expect(lineas).toHaveLength(Math.floor(257 / ((12 * 25.4) / 72)));
    expect(num(lineas[0]!, 'y1')).toBeCloseTo(20 + (12 * 25.4) / 72, 3);
  });

  it('apaisado da vuelta la hoja y el contenido corrido se dibuja en px', () => {
    const a5 = svgDe({ reticulas: ['portada'], formatos: ['a5-apaisado'], capas: ['hoja', 'columnas'] });
    expect([a5.atributos['width'], a5.atributos['height']]).toEqual(['210mm', '148mm']);
    const cols = capa(a5, 'Columnas')!.hijos;
    expect(cols.map((c) => num(c, 'width'))).toEqual([81, 81]); // (210 − 40 − 8) / 2

    const carta = svgDe({ reticulas: ['texto-corrido'], formatos: ['carta-corrida'] });
    expect([carta.atributos['width'], carta.atributos['height']]).toEqual(['834px', '1074px']); // 816 × 1056 + 9 px de sangrado por lado
    expect(num(capa(carta, 'Hoja')!.hijos[0]!, 'width')).toBe(816);
    const medianil = (4 * 96) / 25.4;
    const ancho = (816 - 2 * 72 - 5 * medianil) / 6;
    const c = capa(carta, 'Columnas')!.hijos;
    expect(num(c[1]!, 'x')).toBeCloseTo(72 + ancho + medianil, 3);
    expect(num(c[1]!, 'width')).toBeCloseTo(ancho, 3);
  });

  it('las capas pedidas existen, con su nombre legible, y las no pedidas no', () => {
    const todas = svgDe(A4);
    expect(capasDe(todas).map((g) => g.atributos['id'])).toEqual(['Sangrado', 'Hoja', 'Zona_segura', 'Margenes', 'Medianiles', 'Columnas', 'Linea_base', 'Division_binaria', 'Division_ternaria', 'Cotas']);
    const margenes = capa(todas, 'Margenes')!;
    expect(margenes.atributos['inkscape:label']).toBe('Márgenes');
    expect(margenes.atributos['data-name']).toBe('Márgenes');
    expect(margenes.atributos['inkscape:groupmode']).toBe('layer');
    expect(todas.atributos['xmlns:inkscape']).toBe('http://www.inkscape.org/namespaces/inkscape');

    const pocas = svgDe({ ...A4, capas: ['hoja', 'columnas', 'no-existe'], cotas: false });
    expect(capasDe(pocas).map((g) => g.atributos['id'])).toEqual(['Hoja', 'Columnas']);

    const fina = svgDe({ ...A4, capas: ['unidad-base'], cotas: false });
    const unidad = capa(fina, 'Unidad_base')!.hijos;
    expect(unidad).toHaveLength(209 + 296); // una línea por milímetro, sin los bordes
  });

  it('divisiones: el medianil de la mitad en magenta y los de los tercios en cian', () => {
    // 6 columnas de 25 mm, medianil 4 mm, margen 20 mm: el 3.º medianil parte en dos; el 2.º y el 4.º, en tres.
    const svg = svgDe(A4);
    const binaria = capa(svg, 'Division_binaria')!;
    expect(binaria.atributos['stroke']).toBe('#ff00ff');
    expect(binaria.atributos['inkscape:label']).toBe('División binaria');
    expect(binaria.hijos.map((r) => num(r, 'x'))).toEqual([20 + 3 * 25 + 2 * 4]);
    const ternaria = capa(svg, 'Division_ternaria')!;
    expect(ternaria.atributos['stroke']).toBe('#00aeef');
    expect(ternaria.hijos.map((r) => num(r, 'x'))).toEqual([20 + 2 * 25 + 1 * 4, 20 + 4 * 25 + 3 * 4]);
    ternaria.hijos.forEach((r) => expect(num(r, 'width')).toBeCloseTo(4, 6));

    // La portada tiene 2 columnas: se parte en mitades, no en tercios (y el LEEME lo dice).
    const portada = generar({ reticulas: ['portada'], formatos: ['a4-vertical'] });
    const p = leerXml(portada.archivos[0]!.contenido as string);
    expect(capa(p, 'Division_binaria')!.hijos).toHaveLength(1);
    expect(capa(p, 'Division_ternaria')).toBeUndefined();
    expect(portada.leeme.contenido).toContain('división binaria (mitades) en el 1.º medianil, en magenta');
    expect(portada.leeme.contenido).toContain('no se parte en tercios por un medianil');

    const texto = generar(A4).leeme.contenido;
    expect(texto).toContain('división binaria (mitades) en el 3.º medianil, en magenta');
    expect(texto).toContain('división ternaria (tercios) en el 2.º y 4.º medianil, en cian');
  });

  it('medianilesDeDivision: mitades con columnas pares, tercios con múltiplos de 3', () => {
    expect(medianilesDeDivision(1)).toEqual({ binaria: [], ternaria: [] });
    expect(medianilesDeDivision(2)).toEqual({ binaria: [1], ternaria: [] });
    expect(medianilesDeDivision(3)).toEqual({ binaria: [], ternaria: [1, 2] });
    expect(medianilesDeDivision(6)).toEqual({ binaria: [3], ternaria: [2, 4] });
    expect(medianilesDeDivision(12)).toEqual({ binaria: [6], ternaria: [4, 8] });
    expect(medianilesDeDivision(5)).toEqual({ binaria: [], ternaria: [] });
  });

  it('las cotas escriben ancho de columna, medianil y márgenes', () => {
    const textos = capa(svgDe(A4), 'Cotas')!.hijos.map((t) => t.texto);
    expect(textos.filter((t) => t === '25 mm')).toHaveLength(6);
    expect(textos).toContain('medianil 4 mm');
    expect(textos).toContain('margen 20 mm');
    expect(textos).toContain('línea base 4,23 mm (12pt)');
  });

  it('estilo: sólo líneas sin relleno, o áreas translúcidas; el color sale de la guía o del ADN', () => {
    const lineas = svgDe(A4);
    const cols = capa(lineas, 'Columnas')!;
    expect(cols.atributos['fill']).toBe('none');
    expect(cols.atributos['stroke']).toBe('#9aa3ad');
    expect(cols.hijos.every((c) => c.atributos['fill'] === undefined)).toBe(true);

    const r = generar({ ...A4, estilo: 'areas', color: ['roles:accent'] });
    const areas = leerXml(r.archivos[0]!.contenido as string);
    const c0 = capa(areas, 'Columnas')!.hijos[0]!;
    expect(c0.atributos['fill']).toBe('#1d4ed8');
    expect(Number(c0.atributos['fill-opacity'])).toBeGreaterThan(0);
    expect(Number(c0.atributos['fill-opacity'])).toBeLessThan(1);
    expect(capa(areas, 'Margenes')!.hijos[0]!.atributos['fill-rule']).toBe('evenodd');
    // El color del rol entra en lo que lee.
    expect(r.metadata.consulta).toContain('dim1.req02');
  });

  it('color: se elige uno solo', () => {
    const set = buildDim3EspacioDesignSet();
    expect(resolverParametros(generadorGrillaSvg, set, { color: ['guia:magenta', 'roles:accent'] })['color']).toEqual(['guia:magenta']);
    expect(resolverParametros(generadorGrillaSvg, set, { color: [] })['color']).toEqual(['guia:gris']);
  });

  it('por defecto, una grilla por cada retícula y cada formato, todas en el zip con su LEEME', () => {
    const r = generar();
    expect(r.archivos.map((a) => a.nombre)).toEqual([
      'econut-grilla-texto-corrido-a4-vertical.svg',
      'econut-grilla-texto-corrido-a5-apaisado.svg',
      'econut-grilla-texto-corrido-carta-corrida.svg',
      'econut-grilla-portada-a4-vertical.svg',
      'econut-grilla-portada-a5-apaisado.svg',
      'econut-grilla-portada-carta-corrida.svg',
    ]);
    for (const a of r.archivos) leerXml(a.contenido as string);
    expect(r.zip.nombre).toBe('econut-grilla-svg.zip');
    const dentro = unzipSync(r.zip.contenido);
    expect(Object.keys(dentro)).toEqual(['LEEME.md', ...r.archivos.map((a) => a.nombre)]);
    expect(strFromU8(dentro['econut-grilla-portada-a4-vertical.svg']!)).toBe(r.archivos[3]!.contenido);
    expect(strFromU8(dentro['LEEME.md']!)).toBe(r.leeme.contenido);
  });

  it('el LEEME describe la retícula en palabras y dice cómo usarla en Illustrator, Figma e InDesign', () => {
    const t = generar(A4).leeme.contenido;
    expect(t).toContain(
      '- `econut-grilla-texto-corrido-a4-vertical.svg`: Retícula «texto corrido» en «A4 vertical» (A4, vertical, 210 × 297 mm, página fija): 6 columnas de 25 mm con medianil de 4 mm; márgenes de 20 mm por lado (el margen del texto corrido); sangrado de 3 mm por fuera de la hoja; zona segura a 12 mm del borde; línea base cada 4,23 mm (12pt); división binaria (mitades) en el 3.º medianil, en magenta; división ternaria (tercios) en el 2.º y 4.º medianil, en cian.',
    );
    expect(t).toContain('Ver → Guías → Crear guías');
    expect(t).toContain('**Figma**');
    expect(t).toContain('página maestra');
    expect(t).toContain('Hay un archivo por cada retícula y cada formato de hoja elegidos');
    expect(t).toContain('- Capas: Sangrado, Hoja, Zona segura, Márgenes, Medianiles, Columnas, Línea base, División binaria, División ternaria');
    const carta = generar({ reticulas: ['texto-corrido'], formatos: ['carta-corrida'] }).leeme.contenido;
    expect(carta).toContain('(Carta, vertical, 816 × 1056 px, contenido corrido, en px como pantalla): 6 columnas de 99,4 px con medianil de 15,12 px (4mm); márgenes de 72 px por lado');
  });

  it('la metadata, dentro del SVG y en el LEEME, trae la huella de cada pregunta leída', () => {
    const set = buildDim3EspacioDesignSet();
    const r = generar(A4, set);
    const svg = leerXml(r.archivos[0]!.contenido as string);
    const dentro = leerMetadataDeCelula(JSON.parse(svg.hijos.find((h) => h.nombre === 'metadata')!.texto));
    if (!dentro.ok) throw new Error(dentro.motivo);
    expect(dentro.metadata).toEqual(r.metadata);
    expect(r.metadata.generador).toEqual({ id: 'grilla-svg', version: '1.0.0', nombre: 'Grilla' });
    expect(r.metadata.consulta).toEqual(['dim3.req01', 'dim3.req03', 'dim3.req04', 'dim3.req08', 'dim3.req09']);
    for (const a of r.metadata.ancestros) {
      const e = set.entries.find((x) => x.requirementId === a.requirementId)!;
      expect(a.huella).toBe(huella(e.payload));
      expect(a.effectiveDefinitionId).toBe(e.effectiveDefinitionId);
    }
    const ficha = leerMetadataDeLeeme(r.leeme.contenido);
    expect(ficha.ok && ficha.metadata.archivos.map((a) => a.nombre)).toEqual(['econut-grilla-texto-corrido-a4-vertical.svg']);
    // Sin la capa de línea base, el ritmo no es ancestro.
    expect(generar({ ...A4, capas: ['hoja', 'columnas'] }).metadata.consulta).toEqual(['dim3.req01', 'dim3.req04', 'dim3.req08', 'dim3.req09']);
  });

  it('disponible dice qué falta: la retícula primero, y la hoja', () => {
    const set = buildDim3EspacioDesignSet();
    const sinReticula = generadorGrillaSvg.disponible(sin(set, 'dim3.req04'));
    expect(sinReticula.ok).toBe(false);
    if (!sinReticula.ok) expect(sinReticula.falta).toMatch(/^Define la retícula primero: .*«Retícula»/);
    expect(generarCelula(generadorGrillaSvg, sin(set, 'dim3.req04'), { sistema: SISTEMA, generadoEn: AHORA })).toEqual({
      ok: false,
      falta: sinReticula.ok ? '' : sinReticula.falta,
    });
    const sinHoja = generadorGrillaSvg.disponible(sin(set, 'dim3.req08'));
    expect(!sinHoja.ok && sinHoja.falta).toMatch(/define los formatos de hoja primero.*«Formatos de hoja»/);
    // Un medianil que no se puede medir (en %) también se dice.
    const raro = {
      ...set,
      entries: set.entries.map((e) => (e.requirementId === 'dim3.req04' ? { ...e, payload: { reticulas: [{ contexto: 'web', columns: 4, gap: '2%' }] } } : e)),
    };
    const d = generadorGrillaSvg.disponible(raro);
    expect(!d.ok && d.falta).toMatch(/el medianil de la retícula «web»/);
    expect(generadorGrillaSvg.disponible({ schemaVersion: 1, designSetId: 'vacio', manifestRefs: {}, entries: [] }).ok).toBe(false);
  });

  it('una retícula que no cabe en la hoja no genera, y dice por qué', () => {
    const set = buildDim3EspacioDesignSet();
    const ancha = {
      ...set,
      entries: set.entries.map((e) => (e.requirementId === 'dim3.req04' ? { ...e, payload: { reticulas: [{ contexto: 'imposible', columns: 8, gap: '30mm' }] } } : e)),
    };
    const r = generarCelula(generadorGrillaSvg, ancha, { sistema: SISTEMA, generadoEn: AHORA });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.falta).toMatch(/La retícula «imposible» no cabe en «A4 vertical»/);
  });

  it('es determinista: misma fecha, mismos bytes; otra fecha sólo cambia la metadata', () => {
    const a = generar();
    const b = generar();
    expect(a.archivos).toEqual(b.archivos);
    expect(a.zip.contenido).toEqual(b.zip.contenido);
    const c = generarCelula(generadorGrillaSvg, buildDim3EspacioDesignSet(), { sistema: SISTEMA, generadoEn: '2027-01-01T00:00:00.000Z' });
    if (!c.ok) throw new Error(c.falta);
    expect((c.archivos[0]!.contenido as string).replace('2027-01-01T00:00:00.000Z', AHORA)).toBe(a.archivos[0]!.contenido);
  });
});
