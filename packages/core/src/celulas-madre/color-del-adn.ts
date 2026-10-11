/**
 * Los colores del ADN, leídos para fabricar archivos.
 *
 * Dónde vive el color en el manifiesto (dimensión 1):
 * - `dim1.req01` fundamento: `institucionales` y `neutros`, cada uno
 *   `{ name, value }` con `value` en color CSS plano (hex, rgb, hsl, oklch).
 * - `dim1.req02` roles: `roleColors`, `{ role, color }`, con `color` en CSS o
 *   una referencia a un color del fundamento. El rol es el nombre de muestra.
 * - `dim1.req04` rampas: `ramps`, `{ name, scale: [{ step, value }] }`.
 * - `dim1.req14` reproducción: `equivalencias`, `{ colorRef, sistemas: [{
 *   sistema: cmyk|rgb|pantone|escala-de-grises, valor (texto) }] }`.
 *
 * Todo se convierte a sRGB 0..255 para escribir. El alfa se descarta: ni el
 * `.ase` ni una parada de degradado de Illustrator lo guardan como parte del
 * color (en SVG va aparte, como opacidad, y acá no se usa).
 */
import { resolveRefValue } from '../design-set/adapter.js';
import type { DesignSetV0 } from '../design-set/types.js';
import { isColorCss } from '../requirement-manifest/css-values.js';
import { isRefValue } from '../requirement-manifest/types.js';

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

export type GrupoDeColor = 'institucionales' | 'neutros' | 'roles' | 'rampas';

export interface ColorDelAdn {
  /** Estable entre generaciones mientras el nombre no cambie: `institucionales:Azul`, `roles:accent`. */
  clave: string;
  nombre: string;
  grupo: GrupoDeColor;
  /** Nombre del grupo para el diseñador («Institucionales», «Rampa azul»). */
  etiquetaGrupo: string;
  /** El valor tal como está en el ADN. */
  css: string;
  rgb: Rgb;
  requirementId: string;
}

export interface CmykDelAdn {
  /** El color del fundamento al que corresponde. */
  nombre: string;
  /** C, M, Y, K en 0..1. */
  cmyk: [number, number, number, number];
  /** El texto tal como está en el ADN. */
  texto: string;
}

const limitar = (v: number, min: number, max: number): number => Math.min(max, Math.max(min, v));

function hexARgb(hex: string): Rgb {
  let h = hex.slice(1);
  if (h.length === 3 || h.length === 4) h = [...h].map((c) => c + c).join('');
  return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16) };
}

function hslARgb(h: number, s: number, l: number): Rgb {
  // CSS Color 4, §7.1.
  const f = (n: number): number => {
    const k = (n + h / 30) % 12;
    const a = s * Math.min(l, 1 - l);
    return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
  };
  return { r: f(0) * 255, g: f(8) * 255, b: f(4) * 255 };
}

function oklchARgb(l: number, c: number, hGrados: number): Rgb {
  const h = (hGrados * Math.PI) / 180;
  const a = c * Math.cos(h);
  const b = c * Math.sin(h);
  // OKLab → LMS → sRGB lineal (Björn Ottosson, 2020).
  const l_ = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m_ = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s_ = (l - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const lineal = [
    4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_,
    -1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_,
    -0.0041960863 * l_ - 0.7034186147 * m_ + 1.707614701 * s_,
  ];
  const gamma = (x: number): number => {
    const v = limitar(x, 0, 1);
    return (v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055) * 255;
  };
  return { r: gamma(lineal[0] ?? 0), g: gamma(lineal[1] ?? 0), b: gamma(lineal[2] ?? 0) };
}

/**
 * Un color CSS plano del manifiesto a sRGB 0..255. `null` si no es un color
 * que el manifiesto acepte (`isColorCss`). Fuera de gama (oklch) se recorta.
 */
export function colorCssARgb(valor: unknown): Rgb | null {
  if (!isColorCss(valor)) return null;
  const s = valor.trim().toLowerCase();
  if (s.startsWith('#')) return hexARgb(s);
  const dentro = /\(([^)]*)\)/.exec(s)?.[1] ?? '';
  const partes = dentro.split(/[\s,/]+/).filter((p) => p !== '');
  const num = (i: number): number => parseFloat(partes[i] ?? '0');
  const pct = (i: number): boolean => (partes[i] ?? '').endsWith('%');
  if (s.startsWith('rgb')) {
    const canal = (i: number): number => (pct(i) ? (num(i) / 100) * 255 : num(i));
    return { r: canal(0), g: canal(1), b: canal(2) };
  }
  if (s.startsWith('hsl')) return hslARgb(num(0) % 360, num(1) / 100, num(2) / 100);
  if (s.startsWith('oklch')) return oklchARgb(pct(0) ? num(0) / 100 : num(0), num(1), num(2));
  return null;
}

/** sRGB 0..255 a `#rrggbb`. */
export function rgbAHex(rgb: Rgb): string {
  const h = (v: number): string => Math.round(limitar(v, 0, 255)).toString(16).padStart(2, '0');
  return `#${h(rgb.r)}${h(rgb.g)}${h(rgb.b)}`;
}

function esRegistro(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function payloadDe(designSet: DesignSetV0, requirementId: string): Record<string, unknown> | null {
  const p = designSet.entries.find((e) => e.requirementId === requirementId)?.payload;
  return esRegistro(p) ? p : null;
}

/** Un valor de color que puede ser CSS o una referencia (a un `{ name, value }` o directo al `value`). */
function valorDeColor(designSet: DesignSetV0, valor: unknown): string | null {
  if (typeof valor === 'string') return isColorCss(valor) ? valor : null;
  if (!isRefValue(valor)) return null;
  const r = resolveRefValue(designSet, valor);
  if (!r.ok) return null;
  if (typeof r.value === 'string') return isColorCss(r.value) ? r.value : null;
  if (esRegistro(r.value) && typeof r.value['value'] === 'string' && isColorCss(r.value['value'])) return r.value['value'];
  return null;
}

function listaDeNombrados(lista: unknown): Array<{ name: string; value: string }> {
  if (!Array.isArray(lista)) return [];
  return lista.flatMap((x) =>
    esRegistro(x) && typeof x['name'] === 'string' && x['name'].trim() !== '' && isColorCss(x['value']) ? [{ name: x['name'].trim(), value: x['value'] }] : [],
  );
}

/** Los colores del fundamento (`dim1.req01`): institucionales y neutros. */
export function coloresDelFundamento(designSet: DesignSetV0): ColorDelAdn[] {
  const p = payloadDe(designSet, 'dim1.req01');
  if (!p) return [];
  const salida: ColorDelAdn[] = [];
  for (const [grupo, etiqueta] of [
    ['institucionales', 'Institucionales'],
    ['neutros', 'Neutros'],
  ] as const) {
    for (const c of listaDeNombrados(p[grupo])) {
      const rgb = colorCssARgb(c.value);
      if (rgb) salida.push({ clave: `${grupo}:${c.name}`, nombre: c.name, grupo, etiquetaGrupo: etiqueta, css: c.value, rgb, requirementId: 'dim1.req01' });
    }
  }
  return salida;
}

/** Los colores por rol (`dim1.req02`), con el rol como nombre. */
export function coloresDeRoles(designSet: DesignSetV0): ColorDelAdn[] {
  const p = payloadDe(designSet, 'dim1.req02');
  if (!p || !Array.isArray(p['roleColors'])) return [];
  const salida: ColorDelAdn[] = [];
  for (const rc of p['roleColors']) {
    if (!esRegistro(rc) || typeof rc['role'] !== 'string') continue;
    const css = valorDeColor(designSet, rc['color']);
    const rgb = css === null ? null : colorCssARgb(css);
    if (css !== null && rgb) {
      salida.push({ clave: `roles:${rc['role']}`, nombre: rc['role'], grupo: 'roles', etiquetaGrupo: 'Roles', css, rgb, requirementId: 'dim1.req02' });
    }
  }
  return salida;
}

/** Los pasos de cada rampa (`dim1.req04`), nombrados «<rampa> <paso>». */
export function coloresDeRampas(designSet: DesignSetV0): ColorDelAdn[] {
  const p = payloadDe(designSet, 'dim1.req04');
  if (!p || !Array.isArray(p['ramps'])) return [];
  const salida: ColorDelAdn[] = [];
  for (const rampa of p['ramps']) {
    if (!esRegistro(rampa) || typeof rampa['name'] !== 'string' || !Array.isArray(rampa['scale'])) continue;
    const nombre = rampa['name'].trim();
    for (const paso of rampa['scale']) {
      if (!esRegistro(paso) || typeof paso['step'] !== 'number') continue;
      const rgb = colorCssARgb(paso['value']);
      if (!rgb) continue;
      salida.push({
        clave: `rampas:${nombre}:${paso['step']}`,
        nombre: `${nombre} ${paso['step']}`,
        grupo: 'rampas',
        etiquetaGrupo: `Rampa ${nombre}`,
        css: String(paso['value']),
        rgb,
        requirementId: 'dim1.req04',
      });
    }
  }
  return salida;
}

/**
 * Las equivalencias CMYK de `dim1.req14`. El valor es texto libre en el ADN
 * («C0 M80 Y95 K0», «0/80/95/0», «0, 0.8, 0.95, 0»): se toman los cuatro
 * primeros números; si alguno pasa de 1 se leen como porcentajes. Lo que no
 * trae cuatro números no se adivina: se omite.
 */
export function equivalenciasCmyk(designSet: DesignSetV0): CmykDelAdn[] {
  const p = payloadDe(designSet, 'dim1.req14');
  if (!p || !Array.isArray(p['equivalencias'])) return [];
  const salida: CmykDelAdn[] = [];
  for (const eq of p['equivalencias']) {
    if (!esRegistro(eq) || !isRefValue(eq['colorRef']) || !Array.isArray(eq['sistemas'])) continue;
    const nombre = nombreReferido(designSet, eq['colorRef'].refReqId, eq['colorRef'].refPath);
    if (nombre === null) continue;
    for (const s of eq['sistemas']) {
      if (!esRegistro(s) || s['sistema'] !== 'cmyk' || typeof s['valor'] !== 'string') continue;
      const numeros = (s['valor'].match(/\d+(?:[.,]\d+)?/g) ?? []).slice(0, 4).map((n) => parseFloat(n.replace(',', '.')));
      if (numeros.length < 4) continue;
      const escala = numeros.some((n) => n > 1) ? 100 : 1;
      const [c = 0, m = 0, y = 0, k = 0] = numeros.map((n) => limitar(n / escala, 0, 1));
      salida.push({ nombre, cmyk: [c, m, y, k], texto: s['valor'] });
    }
  }
  return salida;
}

/** El nombre del color del fundamento al que apunta una referencia (`['institucionales', 0]` o `[..., 'value']`). */
function nombreReferido(designSet: DesignSetV0, refReqId: string, refPath: ReadonlyArray<string | number>): string | null {
  const p = payloadDe(designSet, refReqId);
  const [lista, indice] = refPath;
  if (!p || typeof lista !== 'string' || typeof indice !== 'number') return null;
  const items = p[lista];
  const item = Array.isArray(items) ? (items[indice] as unknown) : undefined;
  return esRegistro(item) && typeof item['name'] === 'string' ? item['name'] : null;
}
