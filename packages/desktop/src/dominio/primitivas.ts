/**
 * Primitivas: cómo se MUESTRA cada tipo de parámetro (INTERFAZ.md, «El
 * principio»). Un color en parches, una familia en un fragmento de texto, una
 * holgura en una caja con su aire visible, una retícula en columnas. Y la
 * novena, `nada`: sin definir, en línea punteada — un parámetro sin resolver
 * no puede parecerse a un color gris.
 *
 * Este módulo no dibuja: decide qué primitiva le toca a cada requisito y
 * extrae de un payload real los datos que la primitiva necesita. Dibujar es
 * cosa de `primitivas/Primitiva.tsx`.
 */
import { findEntry, isRefValue, resolveRefValue, type DesignSetV0 } from '@contope/core';

export type Muestra =
  | { tipo: 'color'; colores: string[] }
  | { tipo: 'superficie'; fondo: string; frente?: string }
  | { tipo: 'familia'; familia: string; generica: string }
  | { tipo: 'roles'; familia: string; generica: string; titulo: string; cuerpo: string }
  | { tipo: 'espacio'; valores: string[] }
  | { tipo: 'radio' }
  | { tipo: 'imagen'; src?: string; nota?: string }
  | { tipo: 'reticula'; columnas: number }
  | { tipo: 'texto'; texto: string }
  | { tipo: 'nada' };

export type TipoPrimitiva = Muestra['tipo'];

/** Qué primitiva le toca a un requisito, por el paquete al que pertenece. */
export function tipoDePaquete(packageId: string): TipoPrimitiva {
  const p = packageId.replace(/^pkg\./, '');
  if (p.startsWith('color.superficies')) return 'superficie';
  if (p.startsWith('color.')) return 'color';
  if (p.startsWith('tipografia.fundamento')) return 'familia';
  if (p.startsWith('tipografia.')) return 'roles';
  if (p.startsWith('espacio.reticula')) return 'reticula';
  if (p.startsWith('espacio.')) return 'espacio';
  if (p.startsWith('forma.') || p.includes('borde') || p.includes('profundidad')) return 'radio';
  if (p.startsWith('imagen.')) return 'imagen';
  if (p.startsWith('composicion.')) return 'reticula';
  // dim7: sin primitiva visual propia todavía; se muestra como texto.
  if (p.startsWith('interaccion.')) return 'texto';
  // dim8: sin primitiva visual propia todavía; se muestra como texto.
  if (p.startsWith('movimiento.')) return 'texto';
  return 'nada';
}

function esRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function lista(v: unknown): Record<string, unknown>[] {
  return Array.isArray(v) ? v.filter(esRecord) : [];
}

function textos(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
}

/** Devuelve el valor final de un campo que puede ser literal o una ref al set. */
function valorFinal(set: DesignSetV0, v: unknown): unknown {
  if (isRefValue(v)) {
    const r = resolveRefValue(set, v);
    return r.ok ? r.value : undefined;
  }
  return v;
}

function colorDe(set: DesignSetV0, v: unknown): string | undefined {
  const f = valorFinal(set, v);
  if (typeof f === 'string') return f;
  if (esRecord(f) && typeof f['value'] === 'string') return f['value'];
  if (esRecord(f) && typeof f['color'] === 'string') return f['color'];
  return undefined;
}

function generica(stack: string[]): string {
  const ultima = stack[stack.length - 1]?.toLowerCase() ?? '';
  if (['serif', 'sans-serif', 'monospace', 'cursive', 'fantasy', 'system-ui'].includes(ultima)) return ultima;
  return 'sans-serif';
}

/**
 * De un payload real a lo que su primitiva muestra. Cuando el payload no
 * tiene nada visual (una lista de textos, por ejemplo) devuelve `texto` con un
 * resumen corto, que la primitiva dibuja como tal: no se inventa un color para
 * que la fila se vea llena.
 */
export function muestraDePayload(set: DesignSetV0, requirementId: string): Muestra {
  const entrada = findEntry(set, requirementId);
  if (!entrada || !esRecord(entrada.payload)) return { tipo: 'nada' };
  const p = entrada.payload;

  switch (requirementId) {
    case 'dim1.req01': {
      const colores = [...lista(p['institucionales']), ...lista(p['neutros'])]
        .map((c) => c['value'])
        .filter((v): v is string => typeof v === 'string');
      return colores.length ? { tipo: 'color', colores } : { tipo: 'nada' };
    }
    case 'dim1.req02': {
      const colores = lista(p['roleColors'])
        .map((r) => colorDe(set, r['color']))
        .filter((v): v is string => v !== undefined);
      return colores.length ? { tipo: 'color', colores } : { tipo: 'nada' };
    }
    case 'dim1.req03': {
      const c = esRecord(p['actionColor']) ? colorDe(set, p['actionColor']['source']) : undefined;
      return c ? { tipo: 'color', colores: [c] } : { tipo: 'nada' };
    }
    case 'dim1.req04': {
      const colores = lista(p['ramps']).flatMap((r) =>
        lista(r['scale'])
          .map((s) => s['value'])
          .filter((v): v is string => typeof v === 'string'),
      );
      return colores.length ? { tipo: 'color', colores } : { tipo: 'nada' };
    }
    case 'dim1.req05': {
      const primera = lista(p['surfaces'])[0];
      const fondo = primera ? colorDe(set, primera['backgroundColor']) : undefined;
      const frente = primera ? colorDe(set, primera['foregroundColor']) : undefined;
      return fondo ? { tipo: 'superficie', fondo, ...(frente !== undefined ? { frente } : {}) } : { tipo: 'nada' };
    }
    case 'dim1.req06': {
      const colores = lista(p['stateColors'])
        .map((r) => colorDe(set, r['color']))
        .filter((v): v is string => v !== undefined);
      return colores.length ? { tipo: 'color', colores } : { tipo: 'nada' };
    }
    case 'dim1.req08': {
      const colores = esRecord(p['relations'])
        ? lista(p['relations']['overlays'])
            .map((o) => colorDe(set, o['color']))
            .filter((v): v is string => v !== undefined)
        : [];
      return colores.length ? { tipo: 'color', colores } : resumenTexto(p);
    }
    case 'dim2.req01': {
      const primera = lista(p['familias'])[0];
      const stack = primera ? textos(primera['stack']) : [];
      const familia = stack[0] ?? (typeof primera?.['name'] === 'string' ? primera['name'] : undefined);
      return familia ? { tipo: 'familia', familia, generica: generica(stack) } : { tipo: 'nada' };
    }
    case 'dim2.req02': {
      const estilos = lista(p['roleStyles']);
      const titulo = estilos.find((e) => e['role'] === 'título') ?? estilos[0];
      const cuerpo = estilos.find((e) => e['role'] === 'cuerpo');
      if (!titulo) return { tipo: 'nada' };
      const fam = valorFinal(set, titulo['family']);
      const familia =
        typeof fam === 'string' ? fam : esRecord(fam) && typeof fam['name'] === 'string' ? fam['name'] : undefined;
      if (!familia) return { tipo: 'nada' };
      const stack = esRecord(fam) ? textos(fam['stack']) : [familia];
      return { tipo: 'roles', familia, generica: generica(stack), titulo: 'Título', cuerpo: cuerpo ? 'cuerpo de texto corrido' : '' };
    }
    case 'dim3.req01': {
      const valores = lista(p['escala'])
        .map((e) => e['value'])
        .filter((v): v is string => typeof v === 'string');
      return valores.length ? { tipo: 'espacio', valores } : { tipo: 'nada' };
    }
    case 'dim3.req02': {
      const valores = lista(p['roleSpacing'])
        .map((r) => valorFinal(set, r['value']))
        .map((v) => (esRecord(v) && typeof v['value'] === 'string' ? v['value'] : v))
        .filter((v): v is string => typeof v === 'string');
      return valores.length ? { tipo: 'espacio', valores } : { tipo: 'nada' };
    }
    case 'dim3.req04': {
      const primera = lista(p['reticulas'])[0];
      const columnas = typeof primera?.['columns'] === 'number' ? primera['columns'] : undefined;
      return columnas ? { tipo: 'reticula', columnas } : { tipo: 'nada' };
    }
    case 'dim3.req05': {
      const valores = lista(p['contenedores'])
        .map((c) => c['maxWidth'])
        .filter((v): v is string => typeof v === 'string');
      return valores.length ? { tipo: 'espacio', valores } : { tipo: 'nada' };
    }
    default:
      return resumenTexto(p);
  }
}

function resumenTexto(p: Record<string, unknown>): Muestra {
  const claves = Object.keys(p);
  if (!claves.length) return { tipo: 'nada' };
  const partes = claves.map((k) => {
    const v = p[k];
    if (Array.isArray(v)) return `${k} · ${v.length}`;
    if (typeof v === 'string') return v.length > 18 ? `${v.slice(0, 18)}…` : v;
    if (esRecord(v)) return `${k} · ${Object.keys(v).length}`;
    return String(v);
  });
  return { tipo: 'texto', texto: partes.join(' · ') };
}
