/**
 * Lee tokens del formato W3C Design Tokens (DTCG): objetos anidados donde una
 * hoja tiene `$value` y `$type`. Se recorre el árbol y se agrupan por tipo:
 * `color`, `fontFamily`, `dimension`. Los grupos pueden declarar `$type` una
 * vez para todas sus hojas; se hereda hacia abajo.
 */
import type { Candidato } from '../sistema.js';
import { deHex, esNeutro, normalizarColorCss } from './color.js';

export interface LecturaTokens {
  colores: Array<{ nombre: string; valor: string }>;
  familias: Array<{ nombre: string; stack: string[] }>;
  longitudes: Array<{ nombre: string; valor: string }>;
  total: number;
}

function esRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function dimensionATexto(v: unknown): string | undefined {
  if (typeof v === 'string' && /^\d*\.?\d+(px|rem|em|pt)$/.test(v.trim())) return v.trim();
  if (esRecord(v) && typeof v['value'] === 'number' && typeof v['unit'] === 'string') return `${v['value']}${v['unit']}`;
  return undefined;
}

export function leerTokens(raiz: unknown): LecturaTokens {
  const salida: LecturaTokens = { colores: [], familias: [], longitudes: [], total: 0 };
  const visitar = (nodo: unknown, camino: string[], tipoHeredado: string | undefined): void => {
    if (!esRecord(nodo)) return;
    const tipo = typeof nodo['$type'] === 'string' ? nodo['$type'] : tipoHeredado;
    if ('$value' in nodo) {
      salida.total += 1;
      const nombre = camino.join('.');
      const valor = nodo['$value'];
      if (tipo === 'color' && typeof valor === 'string') {
        const color = normalizarColorCss(valor);
        if (color !== undefined) salida.colores.push({ nombre, valor: color });
      } else if (tipo === 'fontFamily') {
        const stack = Array.isArray(valor) ? valor.filter((x): x is string => typeof x === 'string') : typeof valor === 'string' ? [valor] : [];
        if (stack[0]) salida.familias.push({ nombre: stack[0], stack });
      } else if (tipo === 'dimension') {
        const texto = dimensionATexto(valor);
        if (texto !== undefined) salida.longitudes.push({ nombre, valor: texto });
      }
      return;
    }
    for (const [clave, hijo] of Object.entries(nodo)) {
      if (clave.startsWith('$')) continue;
      visitar(hijo, [...camino, clave], tipo);
    }
  };
  visitar(raiz, [], undefined);
  return salida;
}

export function candidatosDeTokens(lectura: LecturaTokens, idBase: string): Candidato[] {
  const salida: Candidato[] = [];
  if (lectura.colores.length) {
    const institucionales: Array<{ name: string; value: string }> = [];
    const neutros: Array<{ name: string; value: string }> = [];
    for (const c of lectura.colores) {
      const rgb = deHex(c.valor);
      (rgb && esNeutro(rgb) ? neutros : institucionales).push({ name: c.nombre, value: c.valor });
    }
    salida.push({
      id: `${idBase}-colores`,
      requirementId: 'dim1.req01',
      etiqueta: 'Tokens de color',
      detalle: `${lectura.colores.length} tokens: ${institucionales.length} con color y ${neutros.length} neutros (reparto por saturación, corregible).`,
      muestra: { tipo: 'color', colores: lectura.colores.map((c) => c.valor).slice(0, 8) },
      fragmento: { institucionales, neutros },
      estado: 'pendiente',
    });
  }
  if (lectura.familias.length) {
    const unicas = [...new Map(lectura.familias.map((f) => [f.nombre, f])).values()];
    salida.push({
      id: `${idBase}-familias`,
      requirementId: 'dim2.req01',
      etiqueta: 'Tokens de familia tipográfica',
      detalle: unicas.map((f) => f.nombre).join(', '),
      muestra: { tipo: 'familia', familia: unicas[0]?.nombre ?? '', generica: unicas[0]?.stack.at(-1)?.toLowerCase() ?? 'sans-serif' },
      fragmento: { familias: unicas.map((f) => ({ name: f.nombre, stack: f.stack })) },
      estado: 'pendiente',
      faltante: 'Los tokens no traen idiomas ni licencia: hay que completarlos.',
    });
  }
  if (lectura.longitudes.length >= 2) {
    const valores = [...new Set(lectura.longitudes.map((l) => l.valor))];
    salida.push({
      id: `${idBase}-escala`,
      requirementId: 'dim3.req01',
      etiqueta: 'Tokens de dimensión',
      detalle: `${valores.length} valores: ${valores.slice(0, 6).join(', ')}${valores.length > 6 ? '…' : ''}`,
      muestra: { tipo: 'espacio', valores: valores.slice(0, 6) },
      fragmento: { unidad: valores[0], escala: valores.map((value, i) => ({ step: i + 1, value })) },
      estado: 'pendiente',
    });
  }
  return salida;
}
