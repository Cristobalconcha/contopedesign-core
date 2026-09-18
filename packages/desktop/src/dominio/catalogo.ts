/**
 * El catálogo tipográfico: las familias de Google Fonts, con los filtros de
 * Google tal cual (INTERFAZ.md §5: «no inventar vocabulario semántico
 * propio»). Y las dos cosas medidas que no se pueden olvidar:
 *
 * 1. `stroke` no está declarado en 585 de 1.946 familias. Al filtrar por
 *    trazo desaparecen; el contador las cuenta aparte, porque desaparecer en
 *    silencio es el mismo defecto que un valor por defecto.
 * 2. El ancho vive sólo en el nombre en unas 35 familias (Archivo Narrow,
 *    Barlow Condensed…). Filtrar por ancho también lee el nombre.
 */
import catalogoJson from '../../datos/catalogo-google-fonts.json';

export interface FamiliaCatalogo {
  f: string;
  c: string;
  s: string;
  k: string[];
  w: number[];
  i: 0 | 1;
  v: string[];
  wd: [number, number] | null;
  l: string[];
  p: number | null;
  t: number | null;
  d: string | null;
  o: 0 | 1;
}

export interface Catalogo {
  origen: string;
  descargadoEn: string;
  familias: FamiliaCatalogo[];
}

export const CATALOGO: Catalogo = catalogoJson as Catalogo;

export const CATEGORIAS = ['Sans Serif', 'Serif', 'Display', 'Handwriting', 'Monospace'] as const;
export const TRAZOS = ['Sans Serif', 'Serif', 'Slab Serif'] as const;
export const PESOS = [100, 200, 300, 400, 500, 600, 700, 800, 900] as const;
export const IDIOMAS: ReadonlyArray<readonly [string, string]> = [
  ['', 'Todos'],
  ['latin', 'Latino'],
  ['latin-ext', 'Latino extendido'],
  ['cyrillic', 'Cirílico'],
  ['greek', 'Griego'],
  ['arabic', 'Árabe'],
  ['hebrew', 'Hebreo'],
  ['devanagari', 'Devanagari'],
  ['japanese', 'Japonés'],
  ['korean', 'Coreano'],
  ['chinese-simplified', 'Chino simplificado'],
  ['vietnamese', 'Vietnamita'],
  ['thai', 'Tailandés'],
];

export type Orden = 'popularidad' | 'tendencia' | 'recientes' | 'alfabetico';

export interface Filtros {
  busqueda: string;
  categorias: ReadonlySet<string>;
  trazos: ReadonlySet<string>;
  pesos: ReadonlySet<number>;
  italica: boolean;
  variable: boolean;
  ancho: boolean;
  idioma: string;
  orden: Orden;
}

export const SIN_FILTROS: Filtros = {
  busqueda: '',
  categorias: new Set(),
  trazos: new Set(),
  pesos: new Set(),
  italica: false,
  variable: false,
  ancho: false,
  idioma: '',
  orden: 'popularidad',
};

const ANCHO_EN_NOMBRE = /\b(narrow|condensed|compressed|expanded|extended|wide|semicondensed|extracondensed)\b/i;

/** Verdadero si la familia declara ancho variable O lo lleva en el nombre. */
export function tieneAncho(familia: FamiliaCatalogo): boolean {
  return familia.wd !== null || ANCHO_EN_NOMBRE.test(familia.f);
}

export interface Resultado {
  familias: FamiliaCatalogo[];
  /** Cuántas quedaron fuera del filtro de trazo por no declararlo. */
  sinTrazo: number;
}

export function filtrar(familias: ReadonlyArray<FamiliaCatalogo>, filtros: Filtros): Resultado {
  const q = filtros.busqueda.trim().toLowerCase();
  const pesos = [...filtros.pesos];
  let sinTrazo = 0;
  const r = familias.filter((x) => {
    if (q && !x.f.toLowerCase().includes(q)) return false;
    if (filtros.categorias.size && !filtros.categorias.has(x.c)) return false;
    if (filtros.trazos.size) {
      if (!x.s) {
        sinTrazo += 1;
        return false;
      }
      if (!filtros.trazos.has(x.s)) return false;
    }
    if (pesos.length && !pesos.every((p) => x.w.includes(p))) return false;
    if (filtros.italica && !x.i) return false;
    if (filtros.variable && !x.v.length) return false;
    if (filtros.ancho && !tieneAncho(x)) return false;
    if (filtros.idioma && !x.l.includes(filtros.idioma)) return false;
    return true;
  });
  r.sort(comparador(filtros.orden));
  return { familias: r, sinTrazo };
}

function comparador(orden: Orden): (a: FamiliaCatalogo, b: FamiliaCatalogo) => number {
  switch (orden) {
    case 'alfabetico':
      return (a, b) => a.f.localeCompare(b.f);
    case 'recientes':
      return (a, b) => String(b.d ?? '').localeCompare(String(a.d ?? ''));
    case 'tendencia':
      return (a, b) => (a.t ?? 9e9) - (b.t ?? 9e9);
    case 'popularidad':
      return (a, b) => (a.p ?? 9e9) - (b.p ?? 9e9);
  }
}

export function genericaDe(familia: FamiliaCatalogo): string {
  if (familia.s === 'Serif' || familia.s === 'Slab Serif') return 'serif';
  if (familia.c === 'Serif') return 'serif';
  if (familia.c === 'Monospace') return 'monospace';
  if (familia.c === 'Handwriting') return 'cursive';
  return 'sans-serif';
}

export function buscarFamilia(nombre: string, familias: ReadonlyArray<FamiliaCatalogo> = CATALOGO.familias): FamiliaCatalogo | undefined {
  const n = nombre.trim().toLowerCase();
  return familias.find((f) => f.f.toLowerCase() === n);
}

/**
 * El árbol de cuatro casos del selector (INTERFAZ.md §5):
 *  1. nombre conocido y está en Google Fonts → se usa directo, sin selector;
 *  2. nombre conocido pero no está → hay nombre, no hay muestra: se busca
 *     equivalencia por sus propiedades, con el selector prefiltrado;
 *  3. sólo hay muestra visual → análisis de la muestra (no resuelto: el
 *     selector se abre sin prefiltro y lo dice);
 *  4. ni nombre ni muestra → tipografía no disponible.
 * El prefiltro es un punto de partida modificable, nunca una elección.
 */
export type Caso =
  | { caso: 1; familia: FamiliaCatalogo }
  | { caso: 2; nombre: string; prefiltro: Partial<Filtros>; pista: string }
  | { caso: 3; pista: string }
  | { caso: 4 };

export function resolverCaso(entrada: { nombre?: string; hayMuestra?: boolean }): Caso {
  const nombre = entrada.nombre?.trim() ?? '';
  if (nombre) {
    const exacta = buscarFamilia(nombre);
    if (exacta) return { caso: 1, familia: exacta };
    return { caso: 2, nombre, prefiltro: prefiltroPorNombre(nombre), pista: pistaPorNombre(nombre) };
  }
  if (entrada.hayMuestra) {
    return {
      caso: 3,
      pista: 'Sólo hay muestra visual, sin nombre. El análisis de muestras no está construido: el selector se abre sin prefiltro.',
    };
  }
  return { caso: 4 };
}

/** Lo poco que el nombre de una familia deja leer sobre su forma. */
export function prefiltroPorNombre(nombre: string): Partial<Filtros> {
  const n = nombre.toLowerCase();
  if (/\bmono\b|code|courier|consol/.test(n)) return { categorias: new Set(['Monospace']) };
  if (/script|brush|hand|pen\b/.test(n)) return { categorias: new Set(['Handwriting']) };
  if (/\bslab\b|rockwell|clarendon|egyptienne/.test(n)) return { trazos: new Set(['Slab Serif']) };
  if (/\bsans\b|gothic|grotesk|grotesque|helvetica|arial|futura|univers|frutiger|akzidenz/.test(n)) {
    return { trazos: new Set(['Sans Serif']) };
  }
  if (/\bserif\b|garamond|caslon|baskerville|bodoni|didot|minion|times|georgia|palatino|jenson|bembo|sabon/.test(n)) {
    return { trazos: new Set(['Serif']) };
  }
  return {};
}

function pistaPorNombre(nombre: string): string {
  const pre = prefiltroPorNombre(nombre);
  const partes: string[] = [];
  if (pre.trazos?.size) partes.push(`trazo ${[...pre.trazos].join('/')}`);
  if (pre.categorias?.size) partes.push(`categoría ${[...pre.categorias].join('/')}`);
  return partes.length
    ? `«${nombre}» no está en Google Fonts. Por el nombre parece ${partes.join(', ')}; los filtros llegan puestos así y se pueden cambiar.`
    : `«${nombre}» no está en Google Fonts y el nombre no dice nada de su forma. El selector se abre sin prefiltro.`;
}

/** Construye la URL de Google Fonts CSS para cargar la muestra de un lote de familias. */
export function urlDeMuestra(nombres: ReadonlyArray<string>): string {
  return (
    'https://fonts.googleapis.com/css2?' +
    nombres.map((n) => 'family=' + encodeURIComponent(n).replace(/%20/g, '+')).join('&') +
    '&display=swap'
  );
}

/**
 * La URL de css2 para traer una familia completa: todos sus pesos y, si los
 * tiene, sus itálicas. La usa el espécimen, que necesita la familia entera
 * cargada para poder mostrar cada peso en su fila. Google exige las tuplas
 * ordenadas: primero las `0,` de menor a mayor peso, y después las `1,`. Si
 * la familia no declara pesos, se pide el regular.
 */
export function urlDeFamiliaCompleta(f: FamiliaCatalogo): string {
  const familia = encodeURIComponent(f.f).replace(/%20/g, '+');
  const pesos = f.w.length ? [...f.w].sort((a, b) => a - b) : [400];
  const ejes = f.i === 1 ? `ital,wght@${[...pesos.map((p) => `0,${p}`), ...pesos.map((p) => `1,${p}`)].join(';')}` : `wght@${pesos.join(';')}`;
  return `https://fonts.googleapis.com/css2?family=${familia}:${ejes}&display=swap`;
}
