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
] as const;
type CapaDeGrilla = (typeof CAPAS_DE_GRILLA)[number]['valor'];

/** La capa de las medidas escritas, que se pide aparte (casilla «Escribir las cotas»). */
export const CAPA_COTAS = { id: 'Cotas', etiqueta: 'Cotas' } as const;

const CAPAS_POR_DEFECTO: CapaDeGrilla[] = CAPAS_DE_GRILLA.map((c) => c.valor).filter((v) => v !== 'unidad-base');

/** Los colores de guía de siempre: el cian de Illustrator y el magenta de los márgenes de InDesign. */
const COLORES_DE_GUIA: readonly OpcionDeParametro[] = [
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
  return adn ? { hex: rgbAHex(adn.rgb), adn } : { hex: '#00aeef' };
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
  let texto = `Retícula «${reticula.contexto}» en «${hoja.nombre}» (${etiquetaDeFormato(hoja.formato)}, ${hoja.orientacion}, ${tamano}, ${modo}): ${partes.join('; ')}.`;
  if (reticula.anchoMinimo && enUnidad(reticula.anchoMinimo.px, u) > g.columna + 1e-9) {
    texto += ` Ojo: en esta hoja la columna queda bajo el ancho mínimo que pide la retícula (${reticula.anchoMinimo.css}).`;
  }
  return texto;
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
      cuerpo.push(t(g.ancho / 2, g.alto - g.margen / 2 + alzado, m));
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
  'Cada SVG es una plantilla de grilla a escala real (1:1): la hoja mide lo que dice el ADN, en su unidad (mm si es impresa, px si es contenido corrido), y cada parte viene en su propia capa con nombre: Sangrado, Hoja, Zona segura, Márgenes, Unidad base, Medianiles, Columnas, Línea base y Cotas (sólo las que elegiste). No la escales al usarla.',
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
  version: '1.0.0',
  nombre: 'Grilla',
  descripcion:
    'La retícula del sistema dibujada a escala real sobre cada formato de hoja que soporta: hoja, sangrado, márgenes, columnas, medianiles y línea base, cada uno en su capa, con las medidas escritas. Para superponer o usar de plantilla.',
  formato: '.svg · Illustrator, Figma, InDesign, Inkscape',
  queLee: 'La retícula (columnas y medianil), los formatos de hoja, el sangrado y el margen de cada formato y, si la pides, la línea base.',
  lee: (designSet, parametros) => {
    const ids = ['dim3.req01', 'dim3.req04', 'dim3.req08', 'dim3.req09'];
    if (capasElegidas(parametros).has('linea-base')) ids.push('dim3.req03');
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
      ayuda: 'Las que no marques no van en el archivo. La unidad base es una cuadrícula fina, apagada por defecto.',
      porDefecto: () => [...CAPAS_POR_DEFECTO],
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
      ayuda: 'Uno. Por defecto, el cian de las guías; también puedes usar un color del sistema.',
      minimo: 1,
      maximo: 1,
      porDefecto: () => ['guia:cian'],
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
    const unidadBase = capas.has('unidad-base') ? unidadBaseDelAdn(designSet) : null;
    const sistema = contexto.sistema.nombre.trim() || 'Sistema';
    const base = baseDeNombre(contexto.sistema.nombre);
    const metadata = JSON.stringify(contexto.metadata, null, 2);
    const faltantes: string[] = [];
    if (capas.has('linea-base') && !lineaBase) {
      faltantes.push(`${payloadDe(designSet, 'dim3.req03') ? 'La línea base del ADN no se puede medir' : 'El ADN no declara línea base'}: la capa Línea base no va.`);
    }
    if (capas.has('unidad-base') && !unidadBase) faltantes.push('El ADN no declara una unidad base que se pueda medir: la capa Unidad base no va.');
    return reticulas.flatMap((reticula) =>
      hojas.map((hoja) => {
        const descripcion = grillaEnPalabras(reticula, hoja, { lineaBase });
        const { svg, avisos } = svgDeGrilla({
          titulo: `${sistema} · Grilla «${reticula.contexto}» · ${hoja.nombre}`,
          descripcion,
          metadata,
          reticula,
          hoja,
          capas,
          areas: parametros['estilo'] === 'areas',
          color,
          cotas: parametros['cotas'] !== false,
          lineaBase,
          unidadBase,
        });
        return {
          nombre: `${base}-grilla-${reticula.clave}-${hoja.clave}.svg`,
          tipoMime: 'image/svg+xml',
          contenido: svg,
          detalle: [descripcion, ...faltantes, ...avisos].join(' '),
        };
      }),
    );
  },
};
