/**
 * Aritmética de color mínima para los extractores: normalizar a hex,
 * clasificar neutro/institucional por saturación, y convertir CMYK de un
 * IDML a RGB de manera declaradamente aproximada.
 */
export interface Rgb {
  r: number;
  g: number;
  b: number;
}

export function aHex({ r, g, b }: Rgb): string {
  const h = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
  return `#${h(r)}${h(g)}${h(b)}`;
}

export function deHex(hex: string): Rgb | undefined {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
  if (!m || m[1] === undefined) return undefined;
  const s = m[1].length === 3 ? m[1].split('').map((c) => c + c).join('') : m[1];
  return { r: parseInt(s.slice(0, 2), 16), g: parseInt(s.slice(2, 4), 16), b: parseInt(s.slice(4, 6), 16) };
}

/** Saturación HSL en 0..1; los neutros están cerca de 0. */
export function saturacion({ r, g, b }: Rgb): number {
  const max = Math.max(r, g, b) / 255;
  const min = Math.min(r, g, b) / 255;
  const l = (max + min) / 2;
  if (max === min) return 0;
  const d = max - min;
  return l > 0.5 ? d / (2 - max - min) : d / (max + min);
}

/** Croma como diferencia entre el canal más alto y el más bajo, en 0..1. */
export function croma({ r, g, b }: Rgb): number {
  return (Math.max(r, g, b) - Math.min(r, g, b)) / 255;
}

/**
 * Reparto propuesto entre institucionales y neutros. Se usa el croma y no la
 * saturación HSL porque ésta se dispara en los casi-blancos (un papel
 * #f6f6f3 sale «saturado» al 14 %). Es una propuesta para que la persona la
 * corrija en el editor: el umbral separa grises y casi-grises; nada más.
 */
export function esNeutro(rgb: Rgb): boolean {
  return croma(rgb) < 0.055;
}

/**
 * CMYK (0..100) → RGB por la fórmula ingenua (sin perfil de color). Un IDML
 * declara CMYK para imprenta; el hex que sale de acá es una aproximación
 * para poder MIRAR el color, y así se etiqueta. El valor de imprenta es el
 * CMYK, que se conserva en el detalle.
 */
export function cmykARgb(c: number, m: number, y: number, k: number): Rgb {
  const f = (v: number) => 255 * (1 - v / 100) * (1 - k / 100);
  return { r: f(c), g: f(m), b: f(y) };
}

/** Normaliza rgb()/hex a hex; deja pasar hsl/oklch tal cual (el núcleo los acepta). */
export function normalizarColorCss(valor: string): string | undefined {
  const v = valor.trim();
  if (/^#[0-9a-f]{3,8}$/i.test(v)) {
    const rgb = deHex(v.length === 5 || v.length === 9 ? v.slice(0, v.length === 5 ? 4 : 7) : v);
    return rgb ? aHex(rgb) : v.toLowerCase();
  }
  const rgbFn = /^rgba?\(\s*(\d{1,3})\s*[, ]\s*(\d{1,3})\s*[, ]\s*(\d{1,3})/i.exec(v);
  if (rgbFn) return aHex({ r: Number(rgbFn[1]), g: Number(rgbFn[2]), b: Number(rgbFn[3]) });
  if (/^(hsla?|oklch)\(/i.test(v)) return v;
  return undefined;
}

/** Distancia euclídea en RGB, para no repetir colores casi iguales. */
export function distancia(a: Rgb, b: Rgb): number {
  return Math.sqrt((a.r - b.r) ** 2 + (a.g - b.g) ** 2 + (a.b - b.b) ** 2);
}
