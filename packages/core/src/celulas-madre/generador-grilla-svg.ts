/**
 * Generador 3 — Grilla (`.svg`).
 *
 * Con la retícula del ADN (`dim3.req04`: columnas y medianil) repartida en
 * cada formato de hoja que el sistema soporta (`dim3.req08`), con sus
 * márgenes, sangrado y zona segura (`dim3.req09`) y, si se pide, la línea
 * base (`dim3.req03`) y la unidad base (`dim3.req01`), dibuja una plantilla
 * de grilla a escala real para superponer o colocar en Illustrator, Figma o
 * InDesign.
 *
 * Cómo dibuja:
 * - Una hoja impresa se dibuja en su unidad física (`width="210mm"`,
 *   `viewBox` en mm) para que calce 1:1; el contenido corrido, en px. La
 *   medida declarada manda con su propia unidad.
 * - Cada parte es una capa: un `<g>` de primer nivel con `id` ASCII y su
 *   nombre legible en `inkscape:label` y `data-name` («Márgenes»).
 * - La hoja empieza en (0, 0). El sangrado va por fuera: si se dibuja, el
 *   lienzo crece hacia los cuatro lados (`viewBox` con origen negativo).
 * - Márgenes: el margen del texto corrido del formato, igual en los cuatro
 *   lados (el ADN da un solo valor). Sin él, la retícula ocupa la hoja entera.
 * - Columnas: ancho = (ancho útil − medianiles) / columnas.
 * - Línea base: una línea cada paso, desde el margen superior (sin contar
 *   el borde) hasta el inferior, entre los márgenes.
 *
 * El ADN no declara filas ni módulos (`dim3.req04` sólo trae columnas,
 * medianil y ancho mínimo de columna): por eso no hay capa de módulos.
 *
 * La metadata de ancestro va dentro, en `<metadata>`, como JSON.
 */
import type { DesignSetV0 } from '../design-set/types.js';
import { coloresDeRoles, coloresDelFundamento, rgbAHex, type ColorDelAdn } from './color-del-adn.js';
import { baseDeNombre, cdata, escaparXml } from './comun.js';
import {
  PX_POR_UNIDAD,
  etiquetaDeFormato,
  hojasDelAdn,
  lineaBaseDelAdn,
  payloadDe,
  reticulasDelAdn,
  unidadBaseDelAdn,
  type HojaDelAdn,
  type LongitudDelAdn,
  type ReticulaDelAdn,
  type UnidadSvg,
} from './espacio-del-adn.js';
import { tipografiaDelTexto, type TipografiaDelTexto } from './texto-del-adn.js';
import type { Generador, OpcionDeParametro, Parametros } from './tipos.js';

/** Las capas, en el orden en que se apilan (la primera queda abajo). `id` va al SVG; `etiqueta`, al nombre de la capa. */
export const CAPAS_DE_GRILLA = [
  { valor: 'sangrado', id: 'Sangrado', etiqueta: 'Sangrado' },
  { valor: 'hoja', id: 'Hoja', etiqueta: 'Hoja' },
  { valor: 'zona-segura', id: 'Zona_segura', etiqueta: 'Zona segura' },
  { valor: 'margenes', id: 'Margenes', etiqueta: 'Márgenes' },
  { valor: 'unidad-base', id: 'Unidad_base', etiqueta: 'Unidad base' },
  { valor: 'medianiles', id: 'Medianiles', etiqueta: 'Medianiles' },
  { valor: 'columnas', id: 'Columnas', etiqueta: 'Columnas' },
  { valor: 'linea-base', id: 'Linea_base', etiqueta: 'Línea base' },
  { valor: 'division-binaria', id: 'Division_binaria', etiqueta: 'División binaria' },
  { valor: 'division-ternaria', id: 'Division_ternaria', etiqueta: 'División ternaria' },
  { valor: 'calculo-texto', id: 'Calculo_de_texto', etiqueta: 'Cálculo de texto' },
] as const;
type CapaDeGrilla = (typeof CAPAS_DE_GRILLA)[number]['valor'];

/** La capa de las medidas escritas, que se pide aparte (casilla «Escribir las cotas»). */
export const CAPA_COTAS = { id: 'Cotas', etiqueta: 'Cotas' } as const;

const CAPAS_POR_DEFECTO: CapaDeGrilla[] = CAPAS_DE_GRILLA.map((c) => c.valor).filter((v) => v !== 'unidad-base' && v !== 'calculo-texto');

/** Por defecto: todas menos la unidad base; el cálculo de texto, sólo si el ADN trae la tipografía del texto corrido. */
function capasPorDefecto(designSet: DesignSetV0): CapaDeGrilla[] {
  return tipografiaDelTexto(designSet).ok ? CAPAS_DE_GRILLA.map((c) => c.valor).filter((v) => v !== 'unidad-base') : [...CAPAS_POR_DEFECTO];
}

/**
 * Las divisiones de la retícula (Cristóbal, 2026-10-09: «es conveniente siempre disponer de dos
 * colores con combinaciones binarias y ternarias»): el medianil que parte la grilla en dos
 * mitades va en magenta; los que la parten en tres tercios, en cian. Con 6 columnas, el 3.º en
 * magenta y el 2.º y el 4.º en cian. Es una práctica del diseño de diarios y revistas, donde la
 * página se arma en módulos de dos y de tres partes. Colores fijos, para que se reconozcan en
 * cualquier sistema.
 */
export const COLOR_DIVISION_BINARIA = '#ff00ff';
export const COLOR_DIVISION_TERNARIA = '#00aeef';

/** Los medianiles (contados desde 1) donde la grilla se parte en mitades y en tercios. */
export function medianilesDeDivision(columnas: number): { binaria: number[]; ternaria: number[] } {
  return {
    binaria: columnas >= 2 && columnas % 2 === 0 ? [columnas / 2] : [],
    ternaria: columnas >= 3 && columnas % 3 === 0 ? [columnas / 3, (2 * columnas) / 3] : [],
  };
}

/** Los colores de guía: el gris por defecto (deja que destaquen las divisiones), y el cian de Illustrator y el magenta de InDesign. */
const COLORES_DE_GUIA: readonly OpcionDeParametro[] = [
  { valor: 'guia:gris', etiqueta: 'Gris de guía', muestra: '#9aa3ad' },
  { valor: 'guia:cian', etiqueta: 'Cian de guía', muestra: '#00aeef' },
  { valor: 'guia:magenta', etiqueta: 'Magenta de guía', muestra: '#ff00ff' },
];

function coloresDelAdn(designSet: DesignSetV0): ColorDelAdn[] {
  return [...coloresDeRoles(designSet), ...coloresDelFundamento(designSet)];
}

function colorElegido(designSet: DesignSetV0, parametros: Parametros): { hex: string; adn?: ColorDelAdn } {
  const clave = Array.isArray(parametros['color']) ? parametros['color'][0] : undefined;
  const guia = COLORES_DE_GUIA.find((c) => c.valor === clave);
  if (guia?.muestra) return { hex: guia.muestra };
  const adn = coloresDelAdn(designSet).find((c) => c.clave === clave);
  return adn ? { hex: rgbAHex(adn.rgb), adn } : { hex: '#9aa3ad' };
}

function capasElegidas(parametros: Parametros): Set<CapaDeGrilla> {
  const v = parametros['capas'];
  return new Set((Array.isArray(v) ? v : CAPAS_POR_DEFECTO).filter((x): x is CapaDeGrilla => CAPAS_DE_GRILLA.some((c) => c.valor === x)));
}

function elegidas<T extends { clave: string }>(todas: T[], valor: unknown): T[] {
  const claves = new Set(Array.isArray(valor) ? valor : []);
  return todas.filter((x) => claves.has(x.clave));
}

// ---------------------------------------------------------------------------
// Números: coordenadas con punto (SVG) y cotas con coma (para leer).
// ---------------------------------------------------------------------------

/** Una coordenada del SVG: hasta 4 decimales, sin ceros de más. */
const r4 = (v: number): string => {
  const n = Math.round(v * 10000) / 10000;
  return String(Object.is(n, -0) ? 0 : n);
};

/** Una cifra para leer, en español de Chile: hasta 2 decimales, con coma. */
export function cifra(v: number): string {
  const n = Math.round(v * 100) / 100;
  return String(Object.is(n, -0) ? 0 : n).replace('.', ',');
}

const enUnidad = (px: number, unidad: UnidadSvg): number => px / PX_POR_UNIDAD[unidad];

/** «4,23 mm (16px)»: en la unidad de la hoja y, si el ADN la escribió en otra, como está escrita. */
function medidaEnPalabras(l: LongitudDelAdn, unidad: UnidadSvg): string {
  const enHoja = `${cifra(enUnidad(l.px, unidad))} ${unidad}`;
  const escrita = /[a-z]+$/i.exec(l.css)?.[0]?.toLowerCase();
  return escrita === unidad ? enHoja : `${enHoja} (${l.css})`;
}

// ---------------------------------------------------------------------------
// La grilla de una retícula en una hoja.
// ---------------------------------------------------------------------------

interface Geometria {
  u: UnidadSvg;
  ancho: number;
  alto: number;
  sangrado: number;
  zonaSegura: number;
  margen: number;
  medianil: number;
  columna: number;
  columnas: number;
  xs: number[];
}

function geometria(reticula: ReticulaDelAdn, hoja: HojaDelAdn): Geometria {
  const u = hoja.unidad;
  const margen = hoja.margen ? enUnidad(hoja.margen.px, u) : 0;
  const medianil = enUnidad(reticula.medianil.px, u);
  const util = hoja.ancho - 2 * margen;
  const columna = (util - (reticula.columnas - 1) * medianil) / reticula.columnas;
  if (util <= 0 || hoja.alto - 2 * margen <= 0) {
    throw new Error(`En «${hoja.nombre}», los márgenes (${hoja.margen?.css ?? ''}) no dejan espacio para la retícula. Revisa el margen del texto corrido de ese formato.`);
  }
  if (columna <= 0) {
    throw new Error(
      `La retícula «${reticula.contexto}» no cabe en «${hoja.nombre}»: ${reticula.columnas} columnas con medianil de ${reticula.medianil.css} no dejan ancho para las columnas. Desmarca ese formato o esa retícula, o revisa el medianil.`,
    );
  }
  return {
    u,
    ancho: hoja.ancho,
    alto: hoja.alto,
    sangrado: hoja.sangrado ? enUnidad(hoja.sangrado.px, u) : 0,
    zonaSegura: hoja.zonaSegura ? enUnidad(hoja.zonaSegura.px, u) : 0,
    margen,
    medianil,
    columna,
    columnas: reticula.columnas,
    xs: Array.from({ length: reticula.columnas }, (_, i) => margen + i * (columna + medianil)),
  };
}

/** La retícula en palabras: «8 columnas de 18,47 mm con medianil de 4,23 mm (16px); márgenes…». */
export function grillaEnPalabras(reticula: ReticulaDelAdn, hoja: HojaDelAdn, extras: { lineaBase?: LongitudDelAdn | null } = {}): string {
  const g = geometria(reticula, hoja);
  const u = hoja.unidad;
  const tamano = `${cifra(hoja.ancho)} × ${cifra(hoja.alto)} ${u}`;
  const modo = hoja.modo === 'pagina-fija' ? 'página fija' : 'contenido corrido, en px como pantalla';
  const partes = [
    `${g.columnas === 1 ? '1 columna' : `${g.columnas} columnas`} de ${cifra(g.columna)} ${u}` +
      (g.columnas > 1 ? ` con medianil de ${medidaEnPalabras(reticula.medianil, u)}` : ''),
    hoja.margen ? `márgenes de ${medidaEnPalabras(hoja.margen, u)} por lado (el margen del texto corrido)` : 'sin márgenes declarados: la retícula ocupa la hoja entera',
  ];
  if (hoja.sangrado) partes.push(`sangrado de ${medidaEnPalabras(hoja.sangrado, u)} por fuera de la hoja`);
  if (hoja.zonaSegura) partes.push(`zona segura a ${medidaEnPalabras(hoja.zonaSegura, u)} del borde`);
  if (extras.lineaBase) partes.push(`línea base cada ${medidaEnPalabras(extras.lineaBase, u)}`);
  const div = medianilesDeDivision(g.columnas);
  const ordinal = (n: number): string => `${n}.º`;
  const enLista = (ns: number[]): string => (ns.length === 2 ? `${ordinal(ns[0] as number)} y ${ordinal(ns[1] as number)}` : ns.map(ordinal).join(', '));
  if (div.binaria.length) partes.push(`división binaria (mitades) en el ${enLista(div.binaria)} medianil, en magenta`);
  if (div.ternaria.length) partes.push(`división ternaria (tercios) en el ${enLista(div.ternaria)} medianil, en cian`);
  if (g.columnas > 1 && !div.binaria.length && !div.ternaria.length) partes.push(`con ${g.columnas} columnas la grilla no se parte en mitades ni en tercios por un medianil`);
  else if (g.columnas > 1 && !div.binaria.length) partes.push('no se parte en mitades por un medianil (columnas impares)');
  else if (g.columnas > 1 && !div.ternaria.length) partes.push('no se parte en tercios por un medianil');
  let texto = `Retícula «${reticula.contexto}» en «${hoja.nombre}» (${etiquetaDeFormato(hoja.formato)}, ${hoja.orientacion}, ${tamano}, ${modo}): ${partes.join('; ')}.`;
  if (reticula.anchoMinimo && enUnidad(reticula.anchoMinimo.px, u) > g.columna + 1e-9) {
    texto += ` Ojo: en esta hoja la columna queda bajo el ancho mínimo que pide la retícula (${reticula.anchoMinimo.css}).`;
  }
  return texto;
}

// ---------------------------------------------------------------------------
// El cálculo de texto (Cristóbal, decisión 35: «se maqueteaba con lápiz; para
// calcular la cantidad de texto se multiplicaban los cm de columna por
// cantidad de caracteres»). Con la familia por defecto del cuerpo de texto.
// ---------------------------------------------------------------------------

export interface MedidaDeTexto {
  clave: 'columna' | 'mitad' | 'tercio' | 'completo';
  /** «1 columna», «mitad (3 columnas)»… */
  etiqueta: string;
  /** El ancho, en la unidad de la hoja. */
  ancho: number;
  /** Caracteres por línea, al entero hacia abajo. */
  porLinea: number;
  /** Caracteres a todo el alto útil (se escribe con «≈»). */
  aTodoElAlto: number;
}

export interface CalculoDeTexto {
  tipografia: TipografiaDelTexto;
  unidad: UnidadSvg;
  /** El ancho medio de un carácter (con espacios), en la unidad de la hoja. */
  anchoDeCaracter: number;
  /** Con qué paso se cuentan las líneas, en la unidad de la hoja. */
  pasoDeLinea: number;
  /** La línea base del ADN, si con ella se cuentan las líneas. */
  lineaBase: LongitudDelAdn | null;
  /** Cuántas líneas base ocupa cada línea de texto (1 si no hay línea base o si la interlínea cabe en una). */
  lineasBasePorLinea: number;
  altoUtil: number;
  margen: number;
  lineas: number;
  medidas: MedidaDeTexto[];
  /** Caracteres por columna completa y por página (todas las columnas). */
  porColumna: number;
  porPagina: number;
  columnas: number;
  /** La regla del lápiz: caracteres por unidad de alto de columna (cm, o 100 px en pantalla). */
  regla: { unidad: string; caracteres: number; lineas: number };
}

/** «10/12 pt»: el cuerpo y la interlínea en la unidad en que el ADN escribió el cuerpo. */
export function cuerpoEInterlinea(t: TipografiaDelTexto): string {
  const escrita = /[a-z]+$/i.exec(t.cuerpoCss)?.[0]?.toLowerCase() ?? 'px';
  const u: UnidadSvg = escrita in PX_POR_UNIDAD ? (escrita as UnidadSvg) : 'px';
  return `${cifra(enUnidad(t.cuerpoPx, u))}/${cifra(enUnidad(t.interlineaPx, u))} ${u}`;
}

/**
 * Caracteres por línea (en 1 columna, la mitad, un tercio y a ancho
 * completo, las que existan), líneas por columna, caracteres por columna y
 * por página, y caracteres por cm de alto de columna.
 */
export function calculoDeTexto(reticula: ReticulaDelAdn, hoja: HojaDelAdn, tipografia: TipografiaDelTexto, lineaBase: LongitudDelAdn | null): CalculoDeTexto {
  const g = geometria(reticula, hoja);
  const u = g.u;
  const anchoDeCaracter = enUnidad(tipografia.cuerpoPx * tipografia.anchoMedioEm + tipografia.espaciadoPx, u);
  // Las líneas se cuentan con la línea base del ADN; si la interlínea del cuerpo es mayor, cada línea de texto ocupa varias.
  const interlinea = enUnidad(tipografia.interlineaPx, u);
  const base = lineaBase ? enUnidad(lineaBase.px, u) : 0;
  const lineasBasePorLinea = base > 0 ? Math.max(1, Math.ceil(interlinea / base - 1e-9)) : 1;
  const pasoDeLinea = base > 0 ? base * lineasBasePorLinea : interlinea;
  const altoUtil = g.alto - 2 * g.margen;
  const lineas = Math.floor(altoUtil / pasoDeLinea + 1e-9);
  const porLinea = (ancho: number): number => Math.max(0, Math.floor(ancho / anchoDeCaracter + 1e-9));
  const tramo = (k: number): number => k * g.columna + (k - 1) * g.medianil;
  const n = g.columnas;
  const medida = (clave: MedidaDeTexto['clave'], etiqueta: string, ancho: number): MedidaDeTexto => ({ clave, etiqueta, ancho, porLinea: porLinea(ancho), aTodoElAlto: porLinea(ancho) * lineas });
  const igualA = n === 2 ? ' (la mitad)' : n === 3 ? ' (un tercio)' : '';
  const medidas = [medida('columna', `1 columna${igualA}`, g.columna)];
  const div = medianilesDeDivision(n);
  if (div.binaria.length && n / 2 > 1) medidas.push(medida('mitad', `mitad (${n / 2} columnas)`, tramo(n / 2)));
  if (div.ternaria.length && n / 3 > 1) medidas.push(medida('tercio', `tercio (${n / 3} columnas)`, tramo(n / 3)));
  if (n > 1) medidas.push(medida('completo', `ancho completo (${n} columnas)`, tramo(n)));
  const columna = medidas[0] as MedidaDeTexto;
  const porUnidad = u === 'px' ? { unidad: '100 px', largo: 100 } : { unidad: 'cm', largo: enUnidad(PX_POR_UNIDAD.cm, u) };
  const lineasPorUnidad = porUnidad.largo / pasoDeLinea;
  return {
    tipografia,
    unidad: u,
    anchoDeCaracter,
    pasoDeLinea,
    lineaBase: base > 0 ? lineaBase : null,
    lineasBasePorLinea,
    altoUtil,
    margen: g.margen,
    lineas,
    medidas,
    porColumna: columna.aTodoElAlto,
    porPagina: columna.aTodoElAlto * n,
    columnas: n,
    regla: { unidad: porUnidad.unidad, caracteres: columna.porLinea * lineasPorUnidad, lineas: lineasPorUnidad },
  };
}

/** Un entero para leer, con punto de miles: 5040 → «5.040». */
export function entero(v: number): string {
  return String(Math.round(v)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

function origenDelAnchoEnPalabras(c: CalculoDeTexto, corto = false): string {
  const t = c.tipografia;
  const em = `${cifra(t.anchoMedioEm)} em`;
  if (t.origenDelAncho.tipo === 'medido') return `${corto ? 'Ancho' : 'ancho'} medio ${em}, medido en ${t.origenDelAncho.fuente}`;
  if (corto) return `Ancho medio estimado con el promedio estándar (${em}, con espacios): mide la fuente para afinar`;
  const clase = t.origenDelAncho.clase;
  const porque =
    clase === 'normal'
      ? 'el promedio estándar para texto en castellano'
      : clase === 'condensada'
        ? 'el promedio estándar para una letra condensada (lo dice el nombre de la familia)'
        : clase === 'ancha'
          ? 'el promedio estándar para una letra ancha o extendida (lo dice el nombre de la familia)'
          : 'el ancho habitual de una letra monoespaciada (su pila cae en monospace)';
  return `ancho medio de un carácter **${em}** (≈ ${cifra(c.anchoDeCaracter)} ${c.unidad}), estimado con ${porque}, contando los espacios entre palabras; el ADN no trae la medida de la fuente. Es una estimación, no una medición: mide la fuente para afinar`;
}

/** La línea resumida del cálculo, para el detalle del archivo en el LEEME. */
export function calculoEnPalabras(c: CalculoDeTexto): string {
  const col = c.medidas[0] as MedidaDeTexto;
  return (
    `Cálculo de texto con ${c.tipografia.familia} ${cuerpoEInterlinea(c.tipografia)} (la familia por defecto del cuerpo de texto del ADN; ancho medio ${c.tipografia.origenDelAncho.tipo === 'medido' ? 'medido' : 'estimado'}): ` +
    `${col.porLinea} caracteres por línea en 1 columna, ${c.lineas} líneas por columna, ≈ ${entero(c.porColumna)} caracteres por columna, ≈ ${entero(c.porPagina)} por página y ≈ ${entero(c.regla.caracteres)} por ${c.regla.unidad} de columna.`
  );
}

/** Las líneas que se escriben en la capa «Cálculo de texto». */
function lineasDeLaCapa(c: CalculoDeTexto): string[] {
  const nombres: Record<MedidaDeTexto['clave'], string> = { columna: 'en 1 columna', mitad: 'en la mitad', tercio: 'en un tercio', completo: 'a ancho completo' };
  return [
    `Cálculo de texto · calculado con ${c.tipografia.familia}, ${cuerpoEInterlinea(c.tipografia)}, la familia por defecto del cuerpo de texto del ADN`,
    origenDelAnchoEnPalabras(c, true),
    `Caracteres por línea: ${c.medidas.map((m) => `${m.porLinea} ${nombres[m.clave]}`).join(' · ')}`,
    `${c.lineas} líneas por columna · ≈ ${entero(c.porColumna)} caracteres por columna · ≈ ${entero(c.porPagina)} por página · ≈ ${entero(c.regla.caracteres)} por ${c.regla.unidad} de columna`,
  ];
}

/** La sección «Cálculo de texto» del LEEME, para un archivo. */
export function calculoParaElLeeme(c: CalculoDeTexto, hoja: HojaDelAdn): string {
  const t = c.tipografia;
  const u = c.unidad;
  const col = c.medidas[0] as MedidaDeTexto;
  const lineasDe = c.lineaBase
    ? `la línea base del ADN, de ${medidaEnPalabras(c.lineaBase, u)}` +
      (c.lineasBasePorLinea > 1 ? `, de a ${c.lineasBasePorLinea} líneas base por línea de texto porque la interlínea del cuerpo es mayor` : '')
    : `la interlínea del cuerpo (${cifra(enUnidad(t.interlineaPx, u))} ${u}; el ADN no declara línea base)`;
  const alto = c.margen > 0 ? `${cifra(hoja.alto)} − 2 × ${cifra(c.margen)} = ${cifra(c.altoUtil)} ${u}` : `${cifra(c.altoUtil)} ${u}, la hoja entera (no hay márgenes declarados)`;
  const ejemplo = 4000;
  const enCm = c.regla.unidad === 'cm';
  const ocupa = enCm ? `${entero(ejemplo / c.regla.caracteres)} cm` : `${entero((ejemplo / c.regla.caracteres) * 100)} px`;
  const altoDeColumna = enCm ? `${cifra(enUnidad(c.altoUtil * PX_POR_UNIDAD[u], 'cm'))} cm` : `${entero(c.altoUtil)} px`;
  const hueco = enCm ? '10 cm' : '1.000 px';
  const filas = c.medidas.map((m) => `| ${m.etiqueta} | ${cifra(m.ancho)} ${u} | ${m.porLinea} | ≈ ${entero(m.aTodoElAlto)} |`);
  return [
    `Calculado con **${t.familia}, ${cuerpoEInterlinea(t)}** (interlineado ${cifra(t.interlineado)}), la familia por defecto del cuerpo de texto del ADN (el estilo del rol «cuerpo»).` +
      (t.espaciadoPx ? ' Incluye el espaciado entre letras del cuerpo.' : '') +
      (t.avisos.length ? ` Ojo: ${t.avisos.join('; ')}.` : ''),
    '',
    `- Ancho: ${origenDelAnchoEnPalabras(c)}.`,
    `- Alto útil de la columna: ${alto}. Las líneas se cuentan con ${lineasDe}: **${c.lineas} líneas por columna**.`,
    '- Caracteres por línea: el ancho dividido por el ancho medio, al entero hacia abajo. El resto va con «≈»: depende del texto.',
    '',
    `| medida | ancho | caracteres por línea | a todo el alto (${c.lineas} líneas) |`,
    '|---|---|---|---|',
    ...filas,
    `| página (${c.columnas === 1 ? '1 columna' : `${c.columnas} columnas`} de texto) | — | — | ≈ ${entero(c.porPagina)} |`,
    '',
    `**La regla del lápiz**: ≈ ${entero(c.regla.caracteres)} caracteres por ${c.regla.unidad} de alto de columna (${col.porLinea} caracteres por línea × ${cifra(c.regla.lineas)} líneas por ${c.regla.unidad}). ` +
      `Para saber cuánto ocupa un texto, divide sus caracteres (con espacios) por esa cifra: un texto de ${entero(ejemplo)} caracteres ocupa ≈ ${ocupa} de una columna${c.porColumna > 0 ? `, o ≈ ${cifra(Math.round((ejemplo / c.porColumna) * 10) / 10)} columnas de ${altoDeColumna}` : ''}. ` +
      `Al revés, multiplica: un hueco de ${hueco} de una columna recibe ≈ ${entero(c.regla.caracteres * 10)} caracteres.`,
  ].join('\n');
}

/** Más de esto, la unidad base no se dibuja: serían miles de líneas que tapan la grilla. */
const MAXIMO_DE_LINEAS_DE_UNIDAD = 2000;

function svgDeGrilla(entrada: {
  titulo: string;
  descripcion: string;
  metadata: string;
  reticula: ReticulaDelAdn;
  hoja: HojaDelAdn;
  capas: Set<CapaDeGrilla>;
  areas: boolean;
  color: string;
  cotas: boolean;
  lineaBase: LongitudDelAdn | null;
  unidadBase: LongitudDelAdn | null;
  calculo: CalculoDeTexto | null;
}): { svg: string; avisos: string[] } {
  const { reticula, hoja, capas, areas, color } = entrada;
  const g = geometria(reticula, hoja);
  const u = g.u;
  const avisos: string[] = [];
  const trazo = u === 'px' ? 1 : enUnidad(1 / 3, u); // 1 px en pantalla; 0,25 pt impreso
  const letra = u === 'px' ? 10 : enUnidad(8, u); // 10 px en pantalla; 6 pt impreso
  const conSangrado = capas.has('sangrado') && g.sangrado > 0;
  const b = conSangrado ? g.sangrado : 0;
  const [x0, y0, lienzoAncho, lienzoAlto] = [-b, -b, g.ancho + 2 * b, g.alto + 2 * b];
  const rect = (x: number, y: number, w: number, h: number, extra = ''): string =>
    `<rect x="${r4(x)}" y="${r4(y)}" width="${r4(w)}" height="${r4(h)}"${extra}/>`;
  /** Una franja entre dos rectángulos (el de afuera y el de adentro), para rellenar sólo el borde. */
  const franja = (afuera: number, adentro: number, extra = ''): string => {
    const o = (d: number): string => `M${r4(-d)} ${r4(-d)}H${r4(g.ancho + d)}V${r4(g.alto + d)}H${r4(-d)}Z`;
    return `<path d="${o(afuera)} ${o(-adentro)}" fill-rule="evenodd"${extra}/>`;
  };
  const relleno = (opacidad: number): string => ` fill="${color}" fill-opacity="${opacidad}" stroke="none"`;
  const capa = (id: string, etiqueta: string, cuerpo: string[], atributos = ''): string =>
    [
      `  <g id="${id}" data-name="${escaparXml(etiqueta)}" inkscape:groupmode="layer" inkscape:label="${escaparXml(etiqueta)}"${atributos}>`,
      ...cuerpo.map((l) => `    ${l}`),
      '  </g>',
    ].join('\n');

  const grupos: string[] = [];
  for (const c of CAPAS_DE_GRILLA) {
    if (!capas.has(c.valor)) continue;
    const cuerpo: string[] = [];
    switch (c.valor) {
      case 'sangrado':
        if (!conSangrado) continue;
        cuerpo.push(areas ? franja(b, 0, relleno(0.12)) : rect(-b, -b, g.ancho + 2 * b, g.alto + 2 * b));
        break;
      case 'hoja':
        cuerpo.push(rect(0, 0, g.ancho, g.alto));
        break;
      case 'zona-segura':
        if (g.zonaSegura <= 0) continue;
        cuerpo.push(rect(g.zonaSegura, g.zonaSegura, g.ancho - 2 * g.zonaSegura, g.alto - 2 * g.zonaSegura, ` stroke-dasharray="${r4(trazo * 6)} ${r4(trazo * 4)}"`));
        break;
      case 'margenes':
        if (g.margen <= 0) continue;
        cuerpo.push(areas ? franja(0, g.margen, relleno(0.08)) : rect(g.margen, g.margen, g.ancho - 2 * g.margen, g.alto - 2 * g.margen));
        break;
      case 'unidad-base': {
        if (!entrada.unidadBase) continue;
        const paso = enUnidad(entrada.unidadBase.px, u);
        const verticales = Math.floor(g.ancho / paso);
        const horizontales = Math.floor(g.alto / paso);
        if (verticales + horizontales > MAXIMO_DE_LINEAS_DE_UNIDAD) {
          avisos.push(`La unidad base (${entrada.unidadBase.css}) es demasiado fina para dibujarla en esta hoja: se omitió esa capa.`);
          continue;
        }
        for (let i = 1; i <= verticales; i++) if (i * paso < g.ancho - 1e-9) cuerpo.push(`<line x1="${r4(i * paso)}" y1="0" x2="${r4(i * paso)}" y2="${r4(g.alto)}"/>`);
        for (let i = 1; i <= horizontales; i++) if (i * paso < g.alto - 1e-9) cuerpo.push(`<line x1="0" y1="${r4(i * paso)}" x2="${r4(g.ancho)}" y2="${r4(i * paso)}"/>`);
        grupos.push(capa(c.id, c.etiqueta, cuerpo, ` fill="none" stroke="${color}" stroke-width="${r4(trazo / 2)}" stroke-opacity="0.5"`));
        continue;
      }
      case 'medianiles':
        if (g.columnas < 2 || g.medianil <= 0) continue;
        for (let i = 0; i < g.columnas - 1; i++) {
          cuerpo.push(rect((g.xs[i] as number) + g.columna, g.margen, g.medianil, g.alto - 2 * g.margen, areas ? relleno(0.05) : ''));
        }
        break;
      case 'columnas':
        for (const x of g.xs) cuerpo.push(rect(x, g.margen, g.columna, g.alto - 2 * g.margen, areas ? relleno(0.16) : ''));
        break;
      case 'division-binaria':
      case 'division-ternaria': {
        if (g.columnas < 2) continue;
        const binaria = c.valor === 'division-binaria';
        const medianiles = medianilesDeDivision(g.columnas)[binaria ? 'binaria' : 'ternaria'];
        if (medianiles.length === 0) continue;
        const tono = binaria ? COLOR_DIVISION_BINARIA : COLOR_DIVISION_TERNARIA;
        for (const n of medianiles) {
          const x = (g.xs[n - 1] as number) + g.columna;
          cuerpo.push(rect(x, g.margen, g.medianil, g.alto - 2 * g.margen, areas ? ` fill="${tono}" fill-opacity="0.3" stroke="none"` : ''));
        }
        grupos.push(capa(c.id, c.etiqueta, cuerpo, ` fill="none" stroke="${tono}" stroke-width="${r4(trazo * 1.5)}"`));
        continue;
      }
      case 'calculo-texto': {
        // Abajo, en el margen inferior (o, si no cabe, al pie de las columnas), en letra chica y con el color de las cotas.
        if (!entrada.calculo) continue;
        const lineas = lineasDeLaCapa(entrada.calculo);
        const salto = letra * 1.3;
        const enElMargen = g.margen >= letra * (lineas.length * 1.3 + 0.8);
        const y0 = enElMargen ? g.alto - g.margen + letra * 1.4 : g.alto - g.margen - letra * 0.5 - (lineas.length - 1) * salto;
        const x = g.margen > 0 ? g.margen : letra;
        lineas.forEach((l, i) => cuerpo.push(`<text x="${r4(x)}" y="${r4(y0 + i * salto)}">${escaparXml(l)}</text>`));
        grupos.push(
          capa(c.id, c.etiqueta, cuerpo, ` fill="${color}" stroke="none" font-family="Archivo, Helvetica, Arial, sans-serif" font-size="${r4(letra)}" text-anchor="start"`),
        );
        continue;
      }
      case 'linea-base': {
        if (!entrada.lineaBase) continue;
        const paso = enUnidad(entrada.lineaBase.px, u);
        for (let k = 1; g.margen + k * paso <= g.alto - g.margen + 1e-9; k++) {
          const y = g.margen + k * paso;
          cuerpo.push(`<line x1="${r4(g.margen)}" y1="${r4(y)}" x2="${r4(g.ancho - g.margen)}" y2="${r4(y)}"/>`);
        }
        grupos.push(capa(c.id, c.etiqueta, cuerpo, ` fill="none" stroke="${color}" stroke-width="${r4(trazo / 2)}" stroke-opacity="0.7"`));
        continue;
      }
    }
    grupos.push(capa(c.id, c.etiqueta, cuerpo, ` fill="none" stroke="${color}" stroke-width="${r4(trazo)}"`));
  }

  if (entrada.cotas) {
    const t = (x: number, y: number, texto: string, girar = false): string =>
      `<text x="${r4(x)}" y="${r4(y)}"${girar ? ` transform="rotate(-90 ${r4(x)} ${r4(y)})"` : ''}>${escaparXml(texto)}</text>`;
    const alzado = letra * 0.35; // para centrar el texto en su línea
    const cuerpo: string[] = [];
    const arriba = g.margen >= letra * 2 ? g.margen - letra * 0.7 : g.margen + letra * 1.3;
    for (const x of g.xs) cuerpo.push(t(x + g.columna / 2, arriba, `${cifra(g.columna)} ${u}`));
    if (g.columnas > 1) {
      const cx = (g.xs[0] as number) + g.columna + g.medianil / 2;
      cuerpo.push(t(cx + alzado, g.alto / 2, `medianil ${medidaEnPalabras(reticula.medianil, u)}`, true));
    }
    if (hoja.margen && g.margen > 0) {
      const m = `margen ${medidaEnPalabras(hoja.margen, u)}`;
      cuerpo.push(t(g.margen / 2 + alzado, g.alto / 2, m, true));
      // Abajo, el margen lo ocupa el cálculo de texto si va: ahí la cota del margen queda sólo a la izquierda.
      if (!(entrada.calculo && capas.has('calculo-texto'))) cuerpo.push(t(g.ancho / 2, g.alto - g.margen / 2 + alzado, m));
    }
    if (entrada.lineaBase && capas.has('linea-base') && g.margen > 0) {
      cuerpo.push(t(g.ancho - g.margen / 2 + alzado, g.alto / 2, `línea base ${medidaEnPalabras(entrada.lineaBase, u)}`, true));
    }
    grupos.push(
      capa(
        CAPA_COTAS.id,
        CAPA_COTAS.etiqueta,
        cuerpo,
        ` fill="${color}" stroke="none" font-family="Archivo, Helvetica, Arial, sans-serif" font-size="${r4(letra)}" text-anchor="middle"`,
      ),
    );
  }

  const svg = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape" width="${r4(lienzoAncho)}${u}" height="${r4(lienzoAlto)}${u}" viewBox="${r4(x0)} ${r4(y0)} ${r4(lienzoAncho)} ${r4(lienzoAlto)}">`,
    `  <title>${escaparXml(entrada.titulo)}</title>`,
    `  <desc>${escaparXml(entrada.descripcion)}</desc>`,
    `  <metadata id="contope-celula-madre">${cdata(entrada.metadata)}</metadata>`,
    ...grupos,
    '</svg>',
    '',
  ].join('\n');
  return { svg, avisos };
}

const COMO_USAR_GRILLA = [
  'Cada SVG es una plantilla de grilla a escala real (1:1): la hoja mide lo que dice el ADN, en su unidad (mm si es impresa, px si es contenido corrido), y cada parte viene en su propia capa con nombre: Sangrado, Hoja, Zona segura, Márgenes, Unidad base, Medianiles, Columnas, Línea base, División binaria, División ternaria, Cálculo de texto y Cotas (sólo las que elegiste). Las divisiones marcan los medianiles que parten la grilla en mitades (magenta) y en tercios (cian), para armar composiciones de dos y de tres partes, como se hace en el diseño de diarios y revistas. No la escales al usarla.',
  '',
  'El cálculo de texto (capa «Cálculo de texto», al pie de la hoja, y su sección en este LEEME) es la cuenta con que se maqueteaba con lápiz: con la familia por defecto del cuerpo de texto del ADN, cuántos caracteres caben por línea, por columna y por página, y cuántos por centímetro de alto de columna. Se diseña primero la estructura y después llegan los textos: divide los caracteres de un texto (con espacios) por los caracteres por cm y sabes cuántos cm de columna ocupa. Es una estimación: el ancho medio de la letra se mide en la fuente, y lo que trae el ADN se dice en cada sección.',
  '',
  '- **Illustrator**: Archivo → Abrir (la mesa de trabajo queda del tamaño del lienzo) o Archivo → Colocar sobre tu documento, al 100 %. Cada capa llega como un grupo con su nombre, que puedes ocultar o bloquear por separado; bloquéala para trabajar encima. Para tenerla como guías, selecciona lo que quieras (por ejemplo Márgenes y Columnas) y usa Ver → Guías → Crear guías.',
  '- **Figma**: arrastra el SVG al lienzo o usa Importar; queda un marco con las capas adentro. Ponlo sobre el diseño, bájale la opacidad si quieres y bloquéalo (Mayús + Ctrl + L, o ⇧⌘L en Mac).',
  '- **InDesign**: en la página maestra (Ventana → Páginas, doble clic en la maestra), Archivo → Colocar, alinéalo con la esquina de la página y bloquéalo (Objeto → Bloquear). Así está en todas las páginas y no se mueve. Déjalo en una capa propia sin imprimir (Opciones de capa → desmarca «Imprimir capa»).',
  '',
  'Si trae el sangrado, el lienzo es más grande que la hoja: la hoja empieza donde termina el sangrado. Al colocarlo, alinea su borde con la guía de sangrado, o genera sin la capa Sangrado y el lienzo será la hoja exacta.',
  '',
  'Hay un archivo por cada retícula y cada formato de hoja elegidos: la retícula del ADN no dice en qué hoja va, así que se reparte en cada formato que el sistema soporta. Los márgenes son el margen del texto corrido de cada formato, igual en los cuatro lados.',
].join('\n');

export const generadorGrillaSvg: Generador = {
  id: 'grilla-svg',
  version: '1.1.0',
  nombre: 'Grilla',
  descripcion:
    'La retícula del sistema dibujada a escala real sobre cada formato de hoja que soporta: hoja, sangrado, márgenes, columnas, medianiles y línea base, cada uno en su capa, con las medidas escritas, y las divisiones que parten la grilla en mitades (magenta) y en tercios (cian). Con la tipografía del texto corrido, el cálculo de texto: cuántos caracteres caben por línea, por columna, por página y por cm de columna. Para superponer o usar de plantilla.',
  formato: '.svg · Illustrator, Figma, InDesign, Inkscape',
  queLee: 'La retícula (columnas y medianil), los formatos de hoja, el sangrado y el margen de cada formato, la línea base y, para el cálculo de texto, la familia por defecto del cuerpo de texto con su tamaño e interlínea.',
  lee: (designSet, parametros) => {
    const ids = ['dim3.req01', 'dim3.req04', 'dim3.req08', 'dim3.req09'];
    const capas = capasElegidas(parametros);
    if (capas.has('linea-base')) ids.push('dim3.req03');
    // La tipografía es ancestro sólo cuando el cálculo de texto va incluido (la capa marcada y la tipografía legible).
    const tipografia = capas.has('calculo-texto') ? tipografiaDelTexto(designSet) : null;
    if (tipografia?.ok) ids.push(...tipografia.tipografia.requisitos, 'dim3.req03');
    const adn = colorElegido(designSet, parametros).adn;
    if (adn) ids.push(adn.requirementId);
    return [...new Set(ids)].sort();
  },
  disponible(designSet) {
    const donde = 'en Definición › Espacio, ritmo y retícula';
    const r = reticulasDelAdn(designSet);
    if (r.reticulas.length === 0) {
      if (r.problemas.length > 0) return { ok: false, falta: `La retícula todavía no se puede dibujar: ${r.problemas[0]}. Corrígela ${donde} («Retícula»).` };
      return { ok: false, falta: `Define la retícula primero: ${donde}, la pregunta «Retícula» (columnas y medianil).` };
    }
    const h = hojasDelAdn(designSet);
    if (h.hojas.length === 0) {
      if (h.problemas.length > 0) return { ok: false, falta: `Los formatos de hoja todavía no se pueden dibujar: ${h.problemas[0]}. Corrígelos ${donde} («Formatos de hoja»).` };
      return { ok: false, falta: `La retícula se reparte en una hoja, y el sistema no declara ninguna: define los formatos de hoja primero, ${donde} («Formatos de hoja»).` };
    }
    return { ok: true };
  },
  parametros: [
    {
      id: 'reticulas',
      tipo: 'seleccion',
      etiqueta: 'Retículas',
      ayuda: 'Se hace una grilla por cada retícula y cada formato marcados. Sin marcar ninguna, van todas.',
      porDefecto: (designSet) => reticulasDelAdn(designSet).reticulas.map((r) => r.clave),
      opciones: (designSet) =>
        reticulasDelAdn(designSet).reticulas.map((r) => ({ valor: r.clave, etiqueta: `${r.contexto} · ${r.columnas} col., medianil ${r.medianil.css}` })),
    },
    {
      id: 'formatos',
      tipo: 'seleccion',
      etiqueta: 'Formatos de hoja',
      ayuda: 'Sin marcar ninguno, van todos.',
      porDefecto: (designSet) => hojasDelAdn(designSet).hojas.map((h) => h.clave),
      opciones: (designSet) =>
        hojasDelAdn(designSet).hojas.map((h) => ({ valor: h.clave, etiqueta: `${h.nombre} · ${etiquetaDeFormato(h.formato)}, ${h.modo === 'pagina-fija' ? 'página fija' : 'contenido corrido'}` })),
    },
    {
      id: 'capas',
      tipo: 'seleccion',
      etiqueta: 'Capas',
      ayuda: 'Las que no marques no van en el archivo. La unidad base es una cuadrícula fina, apagada por defecto. El cálculo de texto va encendido cuando el ADN trae la tipografía del texto corrido.',
      porDefecto: (designSet) => capasPorDefecto(designSet),
      opciones: () => CAPAS_DE_GRILLA.map((c) => ({ valor: c.valor, etiqueta: c.etiqueta })),
    },
    {
      id: 'estilo',
      tipo: 'opcion',
      etiqueta: 'Estilo',
      porDefecto: 'lineas',
      opciones: [
        { valor: 'lineas', etiqueta: 'Sólo líneas (trazo fino, sin relleno)' },
        { valor: 'areas', etiqueta: 'Áreas translúcidas (columnas, medianiles, márgenes y sangrado rellenos)' },
      ],
    },
    {
      id: 'color',
      tipo: 'seleccion',
      etiqueta: 'Color de la guía',
      ayuda: 'Uno, para las guías comunes. Por defecto, gris, para que destaquen las divisiones en magenta (mitades) y cian (tercios); también puedes usar un color del sistema.',
      minimo: 1,
      maximo: 1,
      porDefecto: () => ['guia:gris'],
      opciones: (designSet) => [
        ...COLORES_DE_GUIA,
        ...coloresDelAdn(designSet).map((c) => ({ valor: c.clave, etiqueta: `${c.nombre} · ${c.etiquetaGrupo}`, muestra: c.css })),
      ],
    },
    {
      id: 'cotas',
      tipo: 'si-no',
      etiqueta: 'Escribir las cotas',
      ayuda: 'Ancho de columna, medianil y márgenes escritos sobre la grilla, en su propia capa («Cotas»).',
      porDefecto: true,
    },
  ],
  comoUsar: COMO_USAR_GRILLA,
  generar(designSet, parametros, contexto) {
    const reticulas = elegidas(reticulasDelAdn(designSet).reticulas, parametros['reticulas']);
    const hojas = elegidas(hojasDelAdn(designSet).hojas, parametros['formatos']);
    if (reticulas.length === 0 || hojas.length === 0) throw new Error('Elige al menos una retícula y un formato de hoja.');
    const capas = capasElegidas(parametros);
    if (capas.size === 0) throw new Error('Elige al menos una capa.');
    const color = colorElegido(designSet, parametros).hex;
    const lineaBase = capas.has('linea-base') ? lineaBaseDelAdn(designSet) : null;
    const tipografia = tipografiaDelTexto(designSet);
    const conCalculo = capas.has('calculo-texto') && tipografia.ok;
    const lineaBaseDelCalculo = conCalculo ? lineaBaseDelAdn(designSet) : null;
    const unidadBase = capas.has('unidad-base') ? unidadBaseDelAdn(designSet) : null;
    const sistema = contexto.sistema.nombre.trim() || 'Sistema';
    const base = baseDeNombre(contexto.sistema.nombre);
    const metadata = JSON.stringify(contexto.metadata, null, 2);
    const faltantes: string[] = [];
    if (!tipografia.ok) faltantes.push(`Sin cálculo de texto. ${tipografia.falta}`);
    if (capas.has('linea-base') && !lineaBase) {
      faltantes.push(`${payloadDe(designSet, 'dim3.req03') ? 'La línea base del ADN no se puede medir' : 'El ADN no declara línea base'}: la capa Línea base no va.`);
    }
    if (capas.has('unidad-base') && !unidadBase) faltantes.push('El ADN no declara una unidad base que se pueda medir: la capa Unidad base no va.');
    return reticulas.flatMap((reticula) =>
      hojas.map((hoja) => {
        const descripcion = grillaEnPalabras(reticula, hoja, { lineaBase });
        const calculo = conCalculo && tipografia.ok ? calculoDeTexto(reticula, hoja, tipografia.tipografia, lineaBaseDelCalculo) : null;
        const { svg, avisos } = svgDeGrilla({
          titulo: `${sistema} · Grilla «${reticula.contexto}» · ${hoja.nombre}`,
          descripcion: calculo ? `${descripcion} ${calculoEnPalabras(calculo)}` : descripcion,
          metadata,
          reticula,
          hoja,
          capas,
          areas: parametros['estilo'] === 'areas',
          color,
          cotas: parametros['cotas'] !== false,
          lineaBase,
          unidadBase,
          calculo,
        });
        return {
          nombre: `${base}-grilla-${reticula.clave}-${hoja.clave}.svg`,
          tipoMime: 'image/svg+xml',
          contenido: svg,
          detalle: [descripcion, ...(calculo ? [calculoEnPalabras(calculo)] : []), ...faltantes, ...avisos].join(' '),
          ...(calculo ? { anexo: { titulo: 'Cálculo de texto', texto: calculoParaElLeeme(calculo, hoja) } } : {}),
        };
      }),
    );
  },
};
