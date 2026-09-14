/**
 * Lee un IDML de InDesign: es un ZIP con XML adentro. De ahí salen
 *
 * - los colores de `Resources/Graphic.xml` (CMYK, RGB o LAB) → dim1.req01;
 * - las familias de `Resources/Fonts.xml` → dim2.req01;
 * - los estilos de párrafo de `Resources/Styles.xml`, como detalle para
 *   mirar (nombre, familia, cuerpo, interlínea): no se convierten solos en
 *   roles tipográficos, porque qué estilo es «título» y cuál «cuerpo» lo
 *   decide la persona.
 *
 * El XML se lee con expresiones regulares sobre atributos, no con un parser
 * de DOM: alcanza para estos tres archivos y funciona igual en Node (las
 * pruebas) y en el navegador. Un CMYK se muestra convertido a hex de forma
 * aproximada, y se dice.
 */
import { unzipSync } from 'fflate';
import type { Candidato } from '../sistema.js';
import { aHex, cmykARgb, esNeutro, type Rgb } from './color.js';

export interface ColorIdml {
  nombre: string;
  espacio: string;
  componentes: number[];
  hex: string | undefined;
}

export interface EstiloParrafoIdml {
  nombre: string;
  familia: string | undefined;
  estilo: string | undefined;
  cuerpo: number | undefined;
  interlinea: number | undefined;
}

export interface LecturaIdml {
  colores: ColorIdml[];
  familias: string[];
  estilos: EstiloParrafoIdml[];
  archivos: string[];
}

function atributo(etiqueta: string, nombre: string): string | undefined {
  const m = new RegExp(`\\b${nombre}="([^"]*)"`).exec(etiqueta);
  return m?.[1];
}

function desescapar(s: string): string {
  return s.replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
}

function hexDe(espacio: string, comp: number[]): string | undefined {
  if (espacio === 'RGB' && comp.length >= 3) return aHex({ r: comp[0] ?? 0, g: comp[1] ?? 0, b: comp[2] ?? 0 });
  if (espacio === 'CMYK' && comp.length >= 4) return aHex(cmykARgb(comp[0] ?? 0, comp[1] ?? 0, comp[2] ?? 0, comp[3] ?? 0));
  return undefined;
}

export function leerGraphicXml(xml: string): ColorIdml[] {
  const colores: ColorIdml[] = [];
  for (const m of xml.matchAll(/<Color\b[^>]*>/g)) {
    const etiqueta = m[0];
    const nombre = desescapar(atributo(etiqueta, 'Name') ?? '');
    if (!nombre || nombre.startsWith('$ID/')) continue;
    if (['Black', 'Paper', 'Registration', 'None', 'Cyan', 'Magenta', 'Yellow'].includes(nombre)) continue;
    const espacio = atributo(etiqueta, 'Space') ?? '';
    const componentes = (atributo(etiqueta, 'ColorValue') ?? '')
      .split(/\s+/)
      .map(Number)
      .filter((n) => Number.isFinite(n));
    colores.push({ nombre, espacio, componentes, hex: hexDe(espacio, componentes) });
  }
  return colores;
}

export function leerFontsXml(xml: string): string[] {
  const familias = new Set<string>();
  for (const m of xml.matchAll(/<FontFamily\b[^>]*>/g)) {
    const nombre = desescapar(atributo(m[0], 'Name') ?? '');
    if (nombre) familias.add(nombre);
  }
  return [...familias];
}

export function leerStylesXml(xml: string): EstiloParrafoIdml[] {
  const estilos: EstiloParrafoIdml[] = [];
  // Un elemento puede cerrarse en la misma etiqueta (`/>`) o tener cuerpo
  // hasta su cierre; se recorre etiqueta por etiqueta para que uno vacío no
  // se trague al siguiente.
  const apertura = /<ParagraphStyle\b([^>]*?)(\/?)>/g;
  for (let m = apertura.exec(xml); m !== null; m = apertura.exec(xml)) {
    const cabecera = m[1] ?? '';
    let cuerpo = '';
    if (m[2] !== '/') {
      const cierre = xml.indexOf('</ParagraphStyle>', apertura.lastIndex);
      cuerpo = cierre >= 0 ? xml.slice(apertura.lastIndex, cierre) : '';
      if (cierre >= 0) apertura.lastIndex = cierre;
    }
    const nombre = desescapar(atributo(cabecera, 'Name') ?? '');
    if (!nombre || nombre.startsWith('$ID/') || nombre.startsWith('[')) continue;
    const fuenteInterna = /<AppliedFont[^>]*>([^<]*)<\/AppliedFont>/.exec(cuerpo)?.[1];
    const familia = desescapar(fuenteInterna ?? atributo(cabecera, 'AppliedFont') ?? '') || undefined;
    const interlineaTexto = /<Leading[^>]*>([^<]*)<\/Leading>/.exec(cuerpo)?.[1] ?? atributo(cabecera, 'Leading');
    const cuerpoTexto = atributo(cabecera, 'PointSize');
    estilos.push({
      nombre,
      familia,
      estilo: atributo(cabecera, 'FontStyle'),
      cuerpo: cuerpoTexto !== undefined && Number.isFinite(Number(cuerpoTexto)) ? Number(cuerpoTexto) : undefined,
      interlinea: interlineaTexto !== undefined && Number.isFinite(Number(interlineaTexto)) ? Number(interlineaTexto) : undefined,
    });
  }
  return estilos;
}

export function leerIdml(bytes: Uint8Array): LecturaIdml {
  const archivos = unzipSync(bytes);
  const texto = (ruta: string): string => {
    const clave = Object.keys(archivos).find((k) => k.toLowerCase() === ruta.toLowerCase());
    const datos = clave !== undefined ? archivos[clave] : undefined;
    return datos ? new TextDecoder().decode(datos) : '';
  };
  return {
    colores: leerGraphicXml(texto('Resources/Graphic.xml')),
    familias: leerFontsXml(texto('Resources/Fonts.xml')),
    estilos: leerStylesXml(texto('Resources/Styles.xml')),
    archivos: Object.keys(archivos),
  };
}

export function candidatosDeIdml(lectura: LecturaIdml, idBase: string): Candidato[] {
  const salida: Candidato[] = [];
  const conHex = lectura.colores.filter((c): c is ColorIdml & { hex: string } => c.hex !== undefined);
  if (conHex.length) {
    const institucionales: Array<{ name: string; value: string }> = [];
    const neutros: Array<{ name: string; value: string }> = [];
    for (const c of conHex) {
      const rgb: Rgb | undefined =
        c.espacio === 'CMYK' ? cmykARgb(c.componentes[0] ?? 0, c.componentes[1] ?? 0, c.componentes[2] ?? 0, c.componentes[3] ?? 0) : undefined;
      const entrada = { name: c.nombre, value: c.hex };
      (rgb && esNeutro(rgb) ? neutros : institucionales).push(entrada);
    }
    const cmyk = conHex.filter((c) => c.espacio === 'CMYK').length;
    salida.push({
      id: `${idBase}-colores`,
      requirementId: 'dim1.req01',
      etiqueta: 'Muestras de color del documento',
      detalle:
        `${conHex.length} muestras con nombre` +
        (cmyk ? `; ${cmyk} vienen en CMYK y se muestran convertidas a hex de forma aproximada (el valor de imprenta es el CMYK).` : '.'),
      muestra: { tipo: 'color', colores: conHex.map((c) => c.hex).slice(0, 8) },
      fragmento: { institucionales, neutros },
      estado: 'pendiente',
    });
  }
  if (lectura.familias.length) {
    salida.push({
      id: `${idBase}-familias`,
      requirementId: 'dim2.req01',
      etiqueta: 'Familias usadas en el documento',
      detalle: lectura.familias.join(', '),
      muestra: { tipo: 'familia', familia: lectura.familias[0] ?? '', generica: 'serif' },
      fragmento: { familias: lectura.familias.map((name) => ({ name, stack: [name] })) },
      estado: 'pendiente',
      faltante:
        'El IDML no dice la licencia ni los idiomas de cada familia, y una familia de pago no está en Google Fonts: el selector busca equivalencia.',
    });
  }
  if (lectura.estilos.length) {
    const resumen = lectura.estilos
      .slice(0, 6)
      .map((e) => `${e.nombre}${e.cuerpo !== undefined ? ` ${e.cuerpo}pt` : ''}${e.familia ? ` · ${e.familia}` : ''}`)
      .join(' · ');
    salida.push({
      id: `${idBase}-estilos`,
      requirementId: 'dim2.req02',
      etiqueta: `${lectura.estilos.length} estilos de párrafo`,
      detalle: `${resumen}${lectura.estilos.length > 6 ? ' …' : ''}. Qué estilo hace de título, cuerpo o nota lo decides en el editor: no se adivina.`,
      muestra: { tipo: 'texto', texto: `${lectura.estilos.length} estilos` },
      // No se propone payload: el mapeo estilo → rol es criterio, no lectura.
      fragmento: {},
      estado: 'pendiente',
      faltante: 'Este candidato sólo informa; el mapeo estilo → rol Core se hace a mano.',
    });
  }
  return salida;
}
