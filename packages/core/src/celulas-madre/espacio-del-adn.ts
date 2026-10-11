/**
 * El espacio del ADN, leído para dibujar grillas (dimensión 3).
 *
 * Dónde vive en el manifiesto:
 * - `dim3.req04` retícula: `reticulas`, cada una `{ contexto, columns (1..8),
 *   gap, minColumnWidth?, align?, justify? }`. `gap` es una referencia a un
 *   paso de la escala (`dim3.req01`, `escala[i]` o `escala[i].value`); se
 *   acepta también una longitud CSS escrita. La retícula NO declara
 *   márgenes, filas ni módulos: es relativa a la hoja.
 * - `dim3.req08` formatos de hoja: `formatos`, `{ nombre, formato (letter, a4,
 *   legal, tabloid, a5, a3 o medida-declarada), medida? { ancho, alto },
 *   orientacion (vertical | apaisada), modo (pagina-fija | contenido-corrido) }`.
 * - `dim3.req09` por formato: `porFormato`, `{ formato (ref a la entrada de
 *   dim3.req08), sangrado, zonaSegura, margenTextoCorrido, aSangre }`. El
 *   margen del texto corrido es el margen de la grilla (igual en los cuatro
 *   lados: el ADN da un solo valor).
 * - `dim3.req03` ritmo: `ritmo.baseline`, referencia a un paso de la escala.
 * - `dim3.req01` fundamento: `unidad` y `escala`.
 *
 * Las longitudes se pasan a px CSS (96 por pulgada, la misma convención con
 * que el insumo del manifiesto da las hojas) con `lengthCssToPx`, que falla
 * en vez de adivinar `%`, `em`, `vw`… Después cada hoja elige la unidad del
 * SVG: la de su medida declarada, mm para una hoja impresa con nombre, px
 * para contenido corrido.
 */
import { resolveRefValue } from '../design-set/adapter.js';
import type { DesignSetV0 } from '../design-set/types.js';
import { lengthCssToPx } from '../requirement-manifest/css-values.js';
import { isRefValue } from '../requirement-manifest/types.js';
import { baseDeNombre } from './comun.js';

/** Las unidades que un SVG entiende en `width`/`height`, con su valor en px CSS. */
export const PX_POR_UNIDAD = { px: 1, mm: 96 / 25.4, cm: 96 / 2.54, in: 96, pt: 96 / 72, pc: 16 } as const;
export type UnidadSvg = keyof typeof PX_POR_UNIDAD;

/** Una longitud del ADN: su valor en px CSS y el texto tal como está escrito. */
export interface LongitudDelAdn {
  px: number;
  css: string;
}

export interface ReticulaDelAdn {
  /** Clave estable para los parámetros: el contexto sin acentos (`articulo`). */
  clave: string;
  contexto: string;
  columnas: number;
  medianil: LongitudDelAdn;
  anchoMinimo?: LongitudDelAdn;
}

export type ModoDeHoja = 'pagina-fija' | 'contenido-corrido';

export interface HojaDelAdn {
  clave: string;
  /** Cómo la llama el sistema («carta vertical»). */
  nombre: string;
  formato: string;
  orientacion: 'vertical' | 'apaisada';
  modo: ModoDeHoja;
  /** La unidad en que se dibuja. */
  unidad: UnidadSvg;
  /** Ancho y alto ya orientados, en `unidad`. */
  ancho: number;
  alto: number;
  /** Lo que el ADN dice para este formato en `dim3.req09`, si lo dice. */
  sangrado?: LongitudDelAdn;
  zonaSegura?: LongitudDelAdn;
  margen?: LongitudDelAdn;
}

/** Las hojas con nombre, verticales: en mm para imprimir y en px (a 96/in, cita del insumo de dim3.req08) para pantalla. */
const HOJAS: Readonly<Record<string, { etiqueta: string; mm: [number, number]; px: [number, number] }>> = {
  letter: { etiqueta: 'Carta', mm: [215.9, 279.4], px: [816, 1056] },
  a4: { etiqueta: 'A4', mm: [210, 297], px: [794, 1123] },
  legal: { etiqueta: 'Oficio (Legal)', mm: [215.9, 355.6], px: [816, 1344] },
  tabloid: { etiqueta: 'Tabloide', mm: [279.4, 431.8], px: [1056, 1632] },
  a5: { etiqueta: 'A5', mm: [148, 210], px: [559, 794] },
  a3: { etiqueta: 'A3', mm: [297, 420], px: [1123, 1587] },
};

export function etiquetaDeFormato(formato: string): string {
  return HOJAS[formato]?.etiqueta ?? 'medida declarada';
}

function esRegistro(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

export function payloadDe(designSet: DesignSetV0, requirementId: string): Record<string, unknown> | null {
  const p = designSet.entries.find((e) => e.requirementId === requirementId)?.payload;
  return esRegistro(p) ? p : null;
}

function deTexto(css: string): LongitudDelAdn | null {
  const r = lengthCssToPx(css);
  return r.ok ? { px: r.px, css: css.trim() } : null;
}

/**
 * Una longitud del ADN: escrita (`'16px'`) o una referencia a un paso de la
 * escala (que resuelve a `{ step, value }` o directo al `value`).
 */
export function longitudDelAdn(designSet: DesignSetV0, valor: unknown): LongitudDelAdn | null {
  if (typeof valor === 'string') return deTexto(valor);
  if (!isRefValue(valor)) return null;
  const r = resolveRefValue(designSet, valor);
  if (!r.ok) return null;
  if (typeof r.value === 'string') return deTexto(r.value);
  if (esRegistro(r.value) && typeof r.value['value'] === 'string') return deTexto(r.value['value']);
  return null;
}

/** Claves únicas y estables desde un nombre: `artículo`, `artículo` → `articulo`, `articulo-2`. */
function claveUnica(nombre: string, usadas: Set<string>): string {
  const base = baseDeNombre(nombre);
  let clave = base;
  for (let n = 2; usadas.has(clave); n++) clave = `${base}-${n}`;
  usadas.add(clave);
  return clave;
}

/** Lo que hay en `dim3.req04`, con lo que no se puede dibujar dicho aparte. */
export function reticulasDelAdn(designSet: DesignSetV0): { reticulas: ReticulaDelAdn[]; problemas: string[] } {
  const p = payloadDe(designSet, 'dim3.req04');
  const reticulas: ReticulaDelAdn[] = [];
  const problemas: string[] = [];
  if (!p || !Array.isArray(p['reticulas'])) return { reticulas, problemas };
  const usadas = new Set<string>();
  p['reticulas'].forEach((r, i) => {
    if (!esRegistro(r)) return;
    const contexto = typeof r['contexto'] === 'string' && r['contexto'].trim() !== '' ? r['contexto'].trim() : `retícula ${i + 1}`;
    const columnas = r['columns'];
    if (typeof columnas !== 'number' || !Number.isInteger(columnas) || columnas < 1) {
      problemas.push(`la retícula «${contexto}» no dice cuántas columnas tiene`);
      return;
    }
    const medianil = longitudDelAdn(designSet, r['gap']);
    if (!medianil) {
      problemas.push(`el medianil de la retícula «${contexto}» no es una medida que se pueda dibujar (tiene que ser un paso de la escala con unidad absoluta: px, mm, pt…)`);
      return;
    }
    const anchoMinimo = longitudDelAdn(designSet, r['minColumnWidth']);
    reticulas.push({ clave: claveUnica(contexto, usadas), contexto, columnas, medianil, ...(anchoMinimo ? { anchoMinimo } : {}) });
  });
  return { reticulas, problemas };
}

/** La unidad de una longitud CSS escrita, si un SVG la entiende (`q` va a mm y `rem` a px). */
function unidadSvgDe(css: unknown): UnidadSvg | null {
  if (typeof css !== 'string') return null;
  const u = /[a-z]+$/i.exec(css.trim())?.[0]?.toLowerCase();
  if (u === undefined) return null;
  if (u === 'q') return 'mm';
  if (u === 'rem') return 'px';
  return u in PX_POR_UNIDAD ? (u as UnidadSvg) : null;
}

const enUnidad = (px: number, unidad: UnidadSvg): number => px / PX_POR_UNIDAD[unidad];

/** Lo que `dim3.req09` dice de cada formato, por su nombre (como lo cruza el predicado del manifiesto). */
function porFormato(designSet: DesignSetV0): Map<string, Record<string, unknown>> {
  const salida = new Map<string, Record<string, unknown>>();
  const p = payloadDe(designSet, 'dim3.req09');
  if (!p || !Array.isArray(p['porFormato'])) return salida;
  for (const pf of p['porFormato']) {
    if (!esRegistro(pf)) continue;
    let nombre: unknown = null;
    if (isRefValue(pf['formato'])) {
      const r = resolveRefValue(designSet, pf['formato']);
      if (r.ok) nombre = esRegistro(r.value) ? r.value['nombre'] : r.value;
    } else nombre = pf['formato'];
    if (typeof nombre === 'string' && !salida.has(nombre)) salida.set(nombre, pf);
  }
  return salida;
}

/** Lo que hay en `dim3.req08` (con su sangrado y márgenes de `dim3.req09`), con lo que no se puede dibujar dicho aparte. */
export function hojasDelAdn(designSet: DesignSetV0): { hojas: HojaDelAdn[]; problemas: string[] } {
  const p = payloadDe(designSet, 'dim3.req08');
  const hojas: HojaDelAdn[] = [];
  const problemas: string[] = [];
  if (!p || !Array.isArray(p['formatos'])) return { hojas, problemas };
  const extras = porFormato(designSet);
  const usadas = new Set<string>();
  p['formatos'].forEach((f, i) => {
    if (!esRegistro(f)) return;
    const nombre = typeof f['nombre'] === 'string' && f['nombre'].trim() !== '' ? f['nombre'].trim() : `formato ${i + 1}`;
    const formato = typeof f['formato'] === 'string' ? f['formato'] : '';
    const apaisada = f['orientacion'] === 'apaisada';
    const modo: ModoDeHoja = f['modo'] === 'contenido-corrido' ? 'contenido-corrido' : 'pagina-fija';
    let unidad: UnidadSvg;
    let lados: [number, number];
    const conNombre = HOJAS[formato];
    if (conNombre) {
      unidad = modo === 'contenido-corrido' ? 'px' : 'mm';
      lados = unidad === 'px' ? conNombre.px : conNombre.mm;
    } else if (formato === 'medida-declarada') {
      const medida = esRegistro(f['medida']) ? f['medida'] : {};
      const ancho = typeof medida['ancho'] === 'string' ? deTexto(medida['ancho']) : null;
      const alto = typeof medida['alto'] === 'string' ? deTexto(medida['alto']) : null;
      if (!ancho || !alto || ancho.px <= 0 || alto.px <= 0) {
        problemas.push(`el formato «${nombre}» no trae su medida (ancho y alto con unidad absoluta)`);
        return;
      }
      // La medida declarada manda: se dibuja en su propia unidad.
      unidad = unidadSvgDe(medida['ancho']) ?? 'px';
      // Ancho y alto se toman tal como están escritos: la orientación no los da vuelta.
      lados = [enUnidad(ancho.px, unidad), enUnidad(alto.px, unidad)];
    } else {
      problemas.push(`el formato «${nombre}» no es una hoja conocida («${formato}»)`);
      return;
    }
    if (conNombre && apaisada) lados = [lados[1], lados[0]];
    const extra = extras.get(nombre);
    const sangrado = extra ? longitudDelAdn(designSet, extra['sangrado']) : null;
    const zonaSegura = extra ? longitudDelAdn(designSet, extra['zonaSegura']) : null;
    const margen = extra ? longitudDelAdn(designSet, extra['margenTextoCorrido']) : null;
    hojas.push({
      clave: claveUnica(nombre, usadas),
      nombre,
      formato,
      orientacion: apaisada ? 'apaisada' : 'vertical',
      modo,
      unidad,
      ancho: lados[0],
      alto: lados[1],
      ...(sangrado ? { sangrado } : {}),
      ...(zonaSegura ? { zonaSegura } : {}),
      ...(margen ? { margen } : {}),
    });
  });
  return { hojas, problemas };
}

/** La línea base (`dim3.req03`), si está y se puede medir. */
export function lineaBaseDelAdn(designSet: DesignSetV0): LongitudDelAdn | null {
  const p = payloadDe(designSet, 'dim3.req03');
  const ritmo = p && esRegistro(p['ritmo']) ? p['ritmo'] : null;
  const l = ritmo ? longitudDelAdn(designSet, ritmo['baseline']) : null;
  return l && l.px > 0 ? l : null;
}

/** La unidad base (`dim3.req01`), si está y se puede medir. */
export function unidadBaseDelAdn(designSet: DesignSetV0): LongitudDelAdn | null {
  const p = payloadDe(designSet, 'dim3.req01');
  const l = p ? longitudDelAdn(designSet, p['unidad']) : null;
  return l && l.px > 0 ? l : null;
}
