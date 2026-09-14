/**
 * Lee una hoja de estilos y ofrece candidatos: colores hacia el fundamento
 * cromático (dim1.req01), familias hacia el fundamento tipográfico
 * (dim2.req01) y longitudes hacia la escala espacial (dim3.req01).
 *
 * Es lectura de texto, no ejecución: variables `--nombre: valor` y
 * declaraciones sueltas. No resuelve `var()`, no calcula nada. Lo que no
 * puede leerse (la licencia de una familia, por ejemplo) se declara como
 * faltante en el candidato en vez de rellenarse.
 */
import type { Candidato } from '../sistema.js';
import { deHex, esNeutro, normalizarColorCss } from './color.js';

export interface LecturaCss {
  colores: Array<{ nombre: string; valor: string }>;
  familias: Array<{ nombre: string; stack: string[] }>;
  longitudes: string[];
}

const COLOR_RE = /#[0-9a-f]{3,8}\b|rgba?\([^)]*\)|hsla?\([^)]*\)|oklch\([^)]*\)/gi;
const VARIABLE_RE = /--([a-z0-9_-]+)\s*:\s*([^;}]+)/gi;
const FAMILIA_RE = /font-family\s*:\s*([^;}]+)/gi;
const LONGITUD_RE = /(?<![\w.-])(\d*\.?\d+)(px|rem|em|pt)\b/g;

function limpiarStack(valor: string): string[] {
  return valor
    .split(',')
    .map((s) => s.trim().replace(/^["']|["']$/g, ''))
    .filter((s) => s && !s.startsWith('var('));
}

export function leerCss(texto: string): LecturaCss {
  const colores = new Map<string, string>();
  const familias = new Map<string, string[]>();
  const longitudes = new Set<string>();

  for (const m of texto.matchAll(VARIABLE_RE)) {
    const nombre = m[1] ?? '';
    const valor = (m[2] ?? '').trim();
    const color = normalizarColorCss(valor);
    if (color !== undefined) {
      if (!colores.has(color)) colores.set(color, nombre);
      continue;
    }
    // Una familia se reconoce por la forma del valor (un nombre entre
    // comillas o una genérica al final), no por el nombre de la variable,
    // que puede estar en cualquier idioma.
    if (/"[^"]+"|'[^']+'|\b(serif|sans-serif|monospace|cursive|fantasy|system-ui)\b/i.test(valor) && !/^\d/.test(valor)) {
      const stack = limpiarStack(valor);
      if (stack[0]) familias.set(stack[0], stack);
      continue;
    }
    if (/^\d*\.?\d+(px|rem|em|pt)$/.test(valor)) longitudes.add(valor);
  }
  for (const m of texto.matchAll(COLOR_RE)) {
    const color = normalizarColorCss(m[0]);
    if (color !== undefined && !colores.has(color)) colores.set(color, '');
  }
  for (const m of texto.matchAll(FAMILIA_RE)) {
    const stack = limpiarStack(m[1] ?? '');
    if (stack[0] && !familias.has(stack[0])) familias.set(stack[0], stack);
  }
  for (const m of texto.matchAll(LONGITUD_RE)) longitudes.add(`${m[1]}${m[2]}`);

  return {
    colores: [...colores].map(([valor, nombre]) => ({ nombre, valor })),
    familias: [...familias].map(([nombre, stack]) => ({ nombre, stack })),
    longitudes: [...longitudes],
  };
}

function nombreColor(nombre: string, valor: string, i: number): string {
  return nombre || `color-${i + 1} ${valor}`;
}

function ordenarLongitudes(valores: string[]): string[] {
  const aPx = (v: string): number => {
    const n = parseFloat(v);
    if (v.endsWith('rem') || v.endsWith('em')) return n * 16;
    if (v.endsWith('pt')) return n * (96 / 72);
    return n;
  };
  return [...new Set(valores)].sort((a, b) => aPx(a) - aPx(b));
}

export function candidatosDeCss(lectura: LecturaCss, idBase: string): Candidato[] {
  const salida: Candidato[] = [];

  if (lectura.colores.length) {
    const institucionales: Array<{ name: string; value: string }> = [];
    const neutros: Array<{ name: string; value: string }> = [];
    lectura.colores.forEach((c, i) => {
      const rgb = deHex(c.valor);
      const entrada = { name: nombreColor(c.nombre, c.valor, i), value: c.valor };
      (rgb && esNeutro(rgb) ? neutros : institucionales).push(entrada);
    });
    salida.push({
      id: `${idBase}-colores`,
      requirementId: 'dim1.req01',
      etiqueta: 'Colores de la hoja',
      detalle: `${institucionales.length} con color y ${neutros.length} neutros, repartidos por saturación (se puede corregir).`,
      muestra: { tipo: 'color', colores: lectura.colores.map((c) => c.valor).slice(0, 8) },
      fragmento: { institucionales, neutros },
      estado: 'pendiente',
    });
  }

  if (lectura.familias.length) {
    salida.push({
      id: `${idBase}-familias`,
      requirementId: 'dim2.req01',
      etiqueta: 'Familias tipográficas',
      detalle: lectura.familias.map((f) => f.nombre).join(', '),
      muestra: {
        tipo: 'familia',
        familia: lectura.familias[0]?.nombre ?? '',
        generica: lectura.familias[0]?.stack.at(-1)?.toLowerCase() ?? 'sans-serif',
      },
      // Idiomas y licencia no están en una hoja de estilos: se dejan fuera
      // a propósito, y el evaluador los va a pedir.
      fragmento: { familias: lectura.familias.map((f) => ({ name: f.nombre, stack: f.stack })) },
      estado: 'pendiente',
      faltante: 'La hoja no dice qué idiomas cubre cada familia ni su licencia: hay que completarlos.',
    });
  }

  const escala = ordenarLongitudes(lectura.longitudes).slice(0, 12);
  if (escala.length >= 2) {
    salida.push({
      id: `${idBase}-escala`,
      requirementId: 'dim3.req01',
      etiqueta: 'Longitudes usadas',
      detalle: `${escala.length} valores distintos, del ${escala[0]} al ${escala[escala.length - 1]}. La unidad base es la menor.`,
      muestra: { tipo: 'espacio', valores: escala.slice(0, 6) },
      fragmento: { unidad: escala[0], escala: escala.map((value, i) => ({ step: i + 1, value })) },
      estado: 'pendiente',
    });
  }

  return salida;
}
