/**
 * La tipografía del texto corrido, leída del ADN para el cálculo de texto de
 * la Grilla (dimensión 2).
 *
 * Cristóbal (2026-10-09): «Esto se debería calcular a partir de la familia
 * tipográfica por defecto para el cuerpo de texto». Esa es el estilo del rol
 * Core **«cuerpo»** en `dim2.req02` (`roleStyles[]`, cada uno `{ role,
 * family, fontSize, fontWeight, lineHeight, letterSpacing?, … }`, proyectado
 * al designRuleSet con estado `default`). No se elige otra familia ni se
 * promedia entre roles. `family` es una referencia a una familia del
 * fundamento (`dim2.req01`: `familias[i]`, `{ name, stack, … }`) o una pila
 * CSS escrita.
 *
 * El ancho medio del carácter: el ADN no guarda métricas de fuente
 * (`dim2.req01` trae nombre, pila, idiomas y licencia; el catálogo de Google
 * Fonts de la app trae categoría y ejes, no anchos; el lector de archivos de
 * fuente del escritorio lee `OS/2` pero sólo el peso y la itálica). Por eso el
 * ancho es una ESTIMACIÓN con el promedio estándar del oficio, y se dice así:
 * ≈ 0,5 em por carácter en texto castellano contando los espacios entre
 * palabras; 0,42 si el nombre de la familia la declara condensada o
 * estrecha, 0,56 si la declara ancha o extendida, y 0,6 si su pila cae en
 * `monospace` (las monoespaciadas miden casi siempre 0,6 em). Si algún día el
 * ADN trae el ancho medido, entra acá como `medido`.
 */
import { resolveRefValue } from '../design-set/adapter.js';
import type { DesignSetV0 } from '../design-set/types.js';
import { lengthCssToPx } from '../requirement-manifest/css-values.js';
import { isRefValue } from '../requirement-manifest/types.js';
import { payloadDe } from './espacio-del-adn.js';

/** El rol Core del cuerpo de texto (`CORE_ROLES_9`). */
export const ROL_DEL_TEXTO_CORRIDO = 'cuerpo';

/** Dónde se define, dicho para el diseñador. */
export const DONDE_SE_DEFINE_EL_TEXTO = 'en Definición › Tipografía y jerarquía, el estilo del rol «cuerpo» (familia, tamaño e interlínea)';

export type ClaseDeAncho = 'normal' | 'condensada' | 'ancha' | 'monoespaciada';

/** El promedio estándar por clase, en em, con espacios. */
export const ANCHO_MEDIO_ESTANDAR: Readonly<Record<ClaseDeAncho, number>> = {
  normal: 0.5,
  condensada: 0.42,
  ancha: 0.56,
  monoespaciada: 0.6,
};

export interface TipografiaDelTexto {
  /** El nombre de la familia, como lo da el ADN. */
  familia: string;
  /** El cuerpo, en px CSS, y tal como está escrito («10pt»). */
  cuerpoPx: number;
  cuerpoCss: string;
  /** El interlineado (multiplicador) y la interlínea en px CSS. */
  interlineado: number;
  interlineaPx: number;
  /** El espaciado entre letras, si el ADN lo da en una medida absoluta (px CSS). */
  espaciadoPx: number;
  /** El ancho medio de un carácter (con espacios), en em. */
  anchoMedioEm: number;
  /** De dónde sale: medido de la fuente o estimado con el promedio estándar. */
  origenDelAncho: { tipo: 'estimado'; clase: ClaseDeAncho } | { tipo: 'medido'; fuente: string };
  /** Las preguntas leídas: pasan a ser ancestros del archivo. */
  requisitos: string[];
  /** Lo que se leyó pero no se pudo usar, en palabras. */
  avisos: string[];
}

function esRegistro(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** La primera familia de una pila CSS escrita, sin comillas. */
function primeraDeLaPila(pila: string): string {
  return (pila.split(',')[0] ?? '').trim().replace(/^["']|["']$/g, '');
}

function claseDeAncho(familia: string, pila: string[]): ClaseDeAncho {
  if (pila.some((f) => /^(ui-)?monospace$/i.test(f.trim())) || /\bmono\b/i.test(familia)) return 'monoespaciada';
  if (/condens|narrow|compress|estrech|\bcond\b/i.test(familia)) return 'condensada';
  if (/extend|expand|\bwide\b|ancha/i.test(familia)) return 'ancha';
  return 'normal';
}

/**
 * La tipografía del texto corrido, o qué falta para tenerla. `falta` está
 * dicho para el diseñador y apunta a dónde se define.
 */
export function tipografiaDelTexto(designSet: DesignSetV0): { ok: true; tipografia: TipografiaDelTexto } | { ok: false; falta: string } {
  const p = payloadDe(designSet, 'dim2.req02');
  const estilos = p && Array.isArray(p['roleStyles']) ? p['roleStyles'] : [];
  const estilo = estilos.find((e): e is Record<string, unknown> => esRegistro(e) && e['role'] === ROL_DEL_TEXTO_CORRIDO);
  if (!estilo) return { ok: false, falta: `El ADN no declara la tipografía del texto corrido: define la tipografía del texto corrido para el cálculo de texto, ${DONDE_SE_DEFINE_EL_TEXTO}.` };

  const requisitos = ['dim2.req02'];
  let familia = '';
  let pila: string[] = [];
  const crudo = estilo['family'];
  if (isRefValue(crudo)) {
    const r = resolveRefValue(designSet, crudo);
    if (r.ok && esRegistro(r.value)) {
      pila = Array.isArray(r.value['stack']) ? r.value['stack'].filter((s): s is string => typeof s === 'string') : [];
      familia = typeof r.value['name'] === 'string' && r.value['name'].trim() !== '' ? r.value['name'].trim() : (pila[0] ?? '');
    } else if (r.ok && typeof r.value === 'string') {
      familia = primeraDeLaPila(r.value);
      pila = r.value.split(',').map((s) => s.trim());
    }
    requisitos.push(crudo.refReqId);
  } else if (typeof crudo === 'string') {
    familia = primeraDeLaPila(crudo);
    pila = crudo.split(',').map((s) => s.trim());
  }
  if (familia === '') {
    return { ok: false, falta: `La familia del texto corrido no se puede leer: define la tipografía del texto corrido para el cálculo de texto, ${DONDE_SE_DEFINE_EL_TEXTO}.` };
  }

  const cuerpoCss = typeof estilo['fontSize'] === 'string' ? estilo['fontSize'].trim() : '';
  const cuerpo = lengthCssToPx(cuerpoCss);
  if (!cuerpo.ok || cuerpo.px <= 0) {
    return { ok: false, falta: `El tamaño del texto corrido (${cuerpoCss || 'sin valor'}) no es una medida absoluta (pt, px, mm…): define la tipografía del texto corrido para el cálculo de texto, ${DONDE_SE_DEFINE_EL_TEXTO}.` };
  }
  const interlineado = estilo['lineHeight'];
  if (typeof interlineado !== 'number' || !(interlineado > 0)) {
    return { ok: false, falta: `El texto corrido no declara su interlínea: define la tipografía del texto corrido para el cálculo de texto, ${DONDE_SE_DEFINE_EL_TEXTO}.` };
  }

  const avisos: string[] = [];
  let espaciadoPx = 0;
  if (typeof estilo['letterSpacing'] === 'string' && estilo['letterSpacing'].trim() !== '') {
    const e = lengthCssToPx(estilo['letterSpacing']);
    if (e.ok) espaciadoPx = e.px;
    else avisos.push(`el espaciado entre letras (${estilo['letterSpacing']}) no es una medida absoluta y no entra en el cálculo`);
  }

  const clase = claseDeAncho(familia, pila);
  return {
    ok: true,
    tipografia: {
      familia,
      cuerpoPx: cuerpo.px,
      cuerpoCss,
      interlineado,
      interlineaPx: cuerpo.px * interlineado,
      espaciadoPx,
      anchoMedioEm: ANCHO_MEDIO_ESTANDAR[clase],
      origenDelAncho: { tipo: 'estimado', clase },
      requisitos: [...new Set(requisitos)].sort(),
      avisos,
    },
  };
}
