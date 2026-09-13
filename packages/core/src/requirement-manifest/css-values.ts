/**
 * Validadores sintácticos de los tipos base `color-css` y `longitud-css`
 * (spec §2, payloadSchema).
 *
 * Alcance (compiler:187): los colores admitidos son PLANOS — hex, rgb, hsl,
 * oklch. Nada de var(), color() ni nombres de color: un nombre como "red" es
 * inválido aquí. Esto es deliberado: el manifiesto exige definiciones
 * efectivas cerradas, y un color fuera de esas familias no es traducible al
 * designRuleSet.
 */

const HEX_COLOR_RE = /^#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

/** Componente numérico 0-255 o porcentaje 0-100%. */
const RGB_COMPONENT = '(?:\\d{1,3}(?:\\.\\d+)?%?|\\d{1,3})';

const RGB_FN_RE = new RegExp(
  `^rgb\\(\\s*${RGB_COMPONENT}\\s*,\\s*${RGB_COMPONENT}\\s*,\\s*${RGB_COMPONENT}\\s*\\)$`,
  'i',
);

/** Alpha: número 0..1 o porcentaje. */
const ALPHA_COMPONENT = '(?:\\d+(?:\\.\\d+)?%|0(?:\\.\\d+)?|1(?:\\.0+)?|\\.\\d+)';

const RGBA_FN_RE = new RegExp(
  `^rgba\\(\\s*${RGB_COMPONENT}\\s*,\\s*${RGB_COMPONENT}\\s*,\\s*${RGB_COMPONENT}\\s*,\\s*${ALPHA_COMPONENT}\\s*\\)$`,
  'i',
);

const HSL_HUE = '(?:\\d{1,3}(?:\\.\\d+)?)';
const HSL_PCT = '(?:\\d{1,3}(?:\\.\\d+)?%)';

const HSL_FN_RE = new RegExp(
  `^hsl\\(\\s*${HSL_HUE}\\s*,\\s*${HSL_PCT}\\s*,\\s*${HSL_PCT}\\s*\\)$`,
  'i',
);

const HSLA_FN_RE = new RegExp(
  `^hsla\\(\\s*${HSL_HUE}\\s*,\\s*${HSL_PCT}\\s*,\\s*${HSL_PCT}\\s*,\\s*${ALPHA_COMPONENT}\\s*\\)$`,
  'i',
);

/** oklch(l c h) u oklch(l c h / a). */
const OKLCH_FN_RE =
  /^oklch\(\s*\d{1,3}(?:\.\d+)?%?\s+\d+(?:\.\d+)?\s+\d+(?:\.\d+)?(?:\s*\/\s*\d+(?:\.\d+)?%?)?\s*\)$/i;

const isPlainNumber = (raw: string): boolean => /^(?:\d{1,3}(?:\.\d+)?)$/.test(raw);

/**
 * Valida componentes numéricos de rgb()/rgba(): 0-255 enteros/decimales o
 * porcentajes 0-100%. Un componente fuera de rango invalida el color.
 */
function validRgbComponents(s: string, count: number): boolean {
  const inner = /^rgba?\(\s*(.*?)\s*\)$/i.exec(s);
  if (!inner) return false;
  const parts = inner[1]?.split(',').map((p) => p.trim()) ?? [];
  if (parts.length !== count || parts.some((p) => p === undefined || p === '')) return false;
  for (const part of parts.slice(0, 3)) {
    if (part === undefined) return false;
    if (part.endsWith('%')) {
      const num = part.slice(0, -1);
      if (!isPlainNumber(num) || Number(num) > 100) return false;
    } else if (!isPlainNumber(part) || Number(part) > 255) {
      return false;
    }
  }
  if (count === 4) {
    const alpha = parts[3];
    if (alpha === undefined) return false;
    if (alpha.endsWith('%')) {
      const num = alpha.slice(0, -1);
      if (!isPlainNumber(num) || Number(num) > 100) return false;
    } else if (!/^(?:0(?:\.[0-9]+)?|1(?:\.0+)?|\.[0-9]+)$/.test(alpha) || Number(alpha) > 1) {
      return false;
    }
  }
  return true;
}

/** `rgb(r,g,b)` / `rgba(r,g,b,a)` válidos: componentes en rango. */
export function isColorCss(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const s = value.trim();
  if (s.length === 0) return false;
  if (HEX_COLOR_RE.test(s)) return true;
  if (OKLCH_FN_RE.test(s)) return true;
  if (RGB_FN_RE.test(s)) return validRgbComponents(s, 3);
  if (RGBA_FN_RE.test(s)) return validRgbComponents(s, 4);
  if (HSL_FN_RE.test(s)) {
    const match = /^hsl\(\s*([^,]+)\s*,\s*([^,]+)\s*,\s*([^,]+)\s*\)$/i.exec(s);
    if (match) {
      const hue = match[1];
      if (!hue || !isPlainNumber(hue) || Number(hue) > 360) return false;
    }
    return true;
  }
  if (HSLA_FN_RE.test(s)) {
    const match = /^hsla\(\s*([^,]+)\s*,\s*([^,]+)\s*,\s*([^,]+)\s*,\s*([^,]+)\s*\)$/i.exec(s);
    if (match) {
      const hue = match[1];
      if (!hue || !isPlainNumber(hue) || Number(hue) > 360) return false;
    }
    return true;
  }
  return false;
}

const LENGTH_UNITS = 'px|rem|em|%|vh|vw|ch|ex|pt|pc|cm|mm|in|q';

const LENGTH_RE = new RegExp(`^(?:0(?:\\.0+)?|(?:\\d+(?:\\.\\d+)?)(?:${LENGTH_UNITS}))$`, 'i');

/** Longitud CSS simple: número con unidad del set cerrado, o cero sin unidad. */
export function isLengthCss(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const s = value.trim();
  if (s.length === 0) return false;
  return LENGTH_RE.test(s);
}

/**
 * Factor de conversión a píxeles para unidades ABSOLUTAS (sin ambigüedad,
 * spec CSS) más `rem` bajo una asunción FIJA y declarada de raíz = 16px
 * (mismo tratamiento que un supuesto declarado, no un hecho verificado del
 * payload). Deliberadamente NO incluye `em`/`%`/`vh`/`vw`/`ch`/`ex`: esas
 * dependen de contexto (fuente heredada, viewport, métricas de fuente) que
 * el payload no tiene — convertirlas sería adivinar, contra el fail-closed
 * de C1.
 */
const PX_PER_UNIT: Readonly<Record<string, number>> = {
  px: 1,
  pt: 96 / 72,
  pc: 16,
  in: 96,
  cm: 96 / 2.54,
  mm: 96 / 25.4,
  q: 96 / 101.6,
  rem: 16,
};

export type LengthToPxResult =
  | { ok: true; px: number }
  | { ok: false; codigo: 'valor-css-invalido' | 'unidad-no-comparable'; unidad?: string };

/** Convierte una `longitud-css` a píxeles, o falla explícito si no se puede sin adivinar. */
export function lengthCssToPx(value: unknown): LengthToPxResult {
  if (!isLengthCss(value)) return { ok: false, codigo: 'valor-css-invalido' };
  const s = value.trim();
  if (/^0(?:\.0+)?$/.test(s)) return { ok: true, px: 0 };
  const match = /^(\d+(?:\.\d+)?)(.+)$/.exec(s);
  if (!match?.[1] || !match[2]) return { ok: false, codigo: 'valor-css-invalido' };
  const num = Number(match[1]);
  const unit = match[2].toLowerCase();
  const factor = PX_PER_UNIT[unit];
  if (factor === undefined) return { ok: false, codigo: 'unidad-no-comparable', unidad: unit };
  return { ok: true, px: num * factor };
}
