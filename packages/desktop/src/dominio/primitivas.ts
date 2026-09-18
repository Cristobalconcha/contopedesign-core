/**
 * Primitivas: cómo se MUESTRA cada tipo de parámetro (INTERFAZ.md, «El
 * principio»). Un color en parches, una familia en un fragmento de texto, una
 * holgura en una caja con su aire visible, una retícula en columnas, un radio
 * en un recuadro que sí lo lee, un estado en una pastilla con su tono, una
 * duración en una barra proporcional, un arquetipo en un cuadrito con sus
 * slots. Y la novena, `nada`: sin definir, en línea punteada — un parámetro sin
 * resolver no puede parecerse a un color gris.
 *
 * Este módulo no dibuja: decide qué primitiva le toca a cada requisito y
 * extrae de un payload real los datos que la primitiva necesita. Dibujar es
 * cosa de `componentes/Primitiva.tsx`.
 */
import { findEntry, isRefValue, resolveRefValue, type DesignSetV0 } from '@contope/core';
import { requisito } from './manifiesto.js';

/** El tono de una pastilla de estado: tres significados y dos acentos. */
export type TonoDeEstado = 'neutro' | 'ok' | 'aviso' | 'error' | 'acento';
/** Un estado declarado y el tono que le toca (dim7.req02, dim7.req04, dim8.req02). */
export type EstadoDeMuestra = { nombre: string; tono: TonoDeEstado };
/** Un paso de una escala de duraciones (dim8.req03) o un movimiento con su tiempo (dim8.req04). */
export type MovimientoDeMuestra = { nombre: string; ms: number };
/** Un arquetipo declarado (dim9.req01) o una anatomía (dim9.req02). */
export type ArquetipoDeMuestra = { nombre: string; slots?: number; noAplica?: boolean };

export type Muestra =
  | { tipo: 'color'; colores: string[] }
  | { tipo: 'superficie'; fondo: string; frente?: string }
  | { tipo: 'familia'; familia: string; generica: string }
  | { tipo: 'roles'; familia: string; generica: string; titulo: string; cuerpo: string }
  | { tipo: 'espacio'; valores: string[] }
  | {
      tipo: 'radio';
      radio?: string;
      borde?: { ancho: string; estilo: 'none' | 'solid' | 'dashed'; color?: string };
      sombra?: boolean;
    }
  | { tipo: 'estados'; estados: EstadoDeMuestra[] }
  | { tipo: 'movimiento'; movimientos: MovimientoDeMuestra[] }
  | { tipo: 'arquetipos'; arquetipos: ArquetipoDeMuestra[] }
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
  // dim7: los estados y el feedback se muestran como pastillas con su tono.
  if (p.startsWith('interaccion.')) return 'estados';
  // dim8: las duraciones se muestran como barras proporcionales a sus ms.
  if (p.startsWith('movimiento.')) return 'movimiento';
  // dim9: los arquetipos y sus anatomías se muestran como cuadritos.
  if (p.startsWith('patrones.')) return 'arquetipos';
  // dim10: sin primitiva visual propia todavía; se muestra como texto.
  if (p.startsWith('salida.')) return 'texto';
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

/** El estilo de filete REAL del compilador (dim4.req03: none|solid|dashed). */
function estiloDeFilete(v: unknown): 'none' | 'solid' | 'dashed' | undefined {
  if (v === 'none') return 'none';
  if (v === 'solid') return 'solid';
  if (v === 'dashed') return 'dashed';
  return undefined;
}

/** El tono de cada uno de los diez estados de dim7.req02, según su nombre. */
function tonoDeEstado(nombre: string): TonoDeEstado {
  const n = nombre.toLowerCase();
  if (n === 'exito' || n === 'éxito') return 'ok';
  if (n === 'error') return 'error';
  if (n === 'activo' || n === 'seleccionado' || n === 'foco' || n === 'hover') return 'acento';
  return 'neutro';
}

/** El tono de cada tipo de feedback de dim7.req04. */
function tonoDeFeedback(tipo: string): TonoDeEstado {
  const t = tipo.toLowerCase();
  if (t === 'confirmacion' || t === 'confirmación') return 'ok';
  if (t === 'advertencia') return 'aviso';
  if (t === 'recuperacion' || t === 'recuperación') return 'acento';
  if (t === 'error') return 'error';
  return 'neutro';
}

/** El tono de cada rol de movimiento de dim8.req02: sólo feedback y énfasis se tiñen. */
function tonoDeRol(nombre: string): TonoDeEstado {
  const r = nombre.toLowerCase();
  if (r === 'feedback') return 'acento';
  if (r === 'enfasis' || r === 'énfasis') return 'aviso';
  return 'neutro';
}

/** Los estados declarados, en su orden, con el tono que les toca. */
function estadosDe(v: unknown, campo: string, tono: (valor: string) => TonoDeEstado): EstadoDeMuestra[] {
  return lista(v)
    .map((e) => e[campo])
    .filter((n): n is string => typeof n === 'string')
    .map((nombre) => ({ nombre, tono: tono(nombre) }));
}

/** La duración en ms de un movimiento: literal, o la ref resuelta a la escala de dim8.req03. */
function msDeTiempo(set: DesignSetV0, movimiento: Record<string, unknown>): number | undefined {
  const directo = valorFinal(set, movimiento['duracionMs']);
  if (typeof directo === 'number') return directo;
  const porRef = valorFinal(set, movimiento['tiempo']);
  if (typeof porRef === 'number') return porRef;
  return esRecord(porRef) && typeof porRef['duracion'] === 'number' ? porRef['duracion'] : undefined;
}

function conEstados(estados: EstadoDeMuestra[]): Muestra {
  return estados.length ? { tipo: 'estados', estados } : { tipo: 'nada' };
}

function conMovimiento(movimientos: MovimientoDeMuestra[]): Muestra {
  return movimientos.length ? { tipo: 'movimiento', movimientos } : { tipo: 'nada' };
}

function conArquetipos(arquetipos: ArquetipoDeMuestra[]): Muestra {
  return arquetipos.length ? { tipo: 'arquetipos', arquetipos } : { tipo: 'nada' };
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

    // --- dim4: forma, borde y profundidad --------------------------------
    case 'dim4.req02': {
      // El radio del primer rol que traiga uno. `radio` es el vocabulario
      // cerrado del compilador (longitud|none|pill|circle): `pill` y `circle`
      // no tienen medida que mostrar, así que se salta la entrada en vez de
      // inventarle un valor.
      for (const forma of lista(p['formas'])) {
        const vocabulario = typeof forma['vocabulario'] === 'string' ? forma['vocabulario'].toLowerCase() : '';
        if (vocabulario.includes('cuadrado') || vocabulario.includes('sin radio')) return { tipo: 'radio', radio: '0' };
        const clase = typeof forma['radio'] === 'string' ? forma['radio'] : '';
        if (clase === 'none') return { tipo: 'radio', radio: '0' };
        if (clase !== 'longitud') continue;
        const valor = valorFinal(set, forma['radioValor']);
        const medida =
          typeof valor === 'string' ? valor : esRecord(valor) && typeof valor['value'] === 'string' ? valor['value'] : undefined;
        if (medida !== undefined) return { tipo: 'radio', radio: medida };
      }
      return { tipo: 'radio' };
    }
    case 'dim4.req03': {
      // El primer filete del primer estilo: ancho, estilo y color si es literal
      // o ref resoluble. Sin filetes, el recuadro a secas.
      const primerEstilo = lista(p['estilosDeBorde'])[0];
      const filete = primerEstilo ? lista(primerEstilo['filetes'])[0] : undefined;
      const ancho = filete ? filete['grosor'] : undefined;
      const estilo = estiloDeFilete(filete ? filete['tipo'] : undefined);
      if (typeof ancho !== 'string' || estilo === undefined) return { tipo: 'radio' };
      const color = filete ? colorDe(set, filete['color']) : undefined;
      return { tipo: 'radio', borde: { ancho, estilo, ...(color !== undefined ? { color } : {}) } };
    }
    case 'dim4.req04': {
      // Un nivel de profundidad mayor que 0 se ve como sombra; si no, recuadro.
      const profunda = lista(p['profundidades']).some((d) => {
        const nivel = valorFinal(set, d['nivel']);
        return typeof nivel === 'number' && nivel > 0;
      });
      return profunda ? { tipo: 'radio', sombra: true } : { tipo: 'radio' };
    }
    case 'dim4.req05':
    case 'dim4.req06':
    case 'dim4.req07':
    case 'dim4.req08':
      // Política material, máscaras, excepciones y adaptación no tienen forma
      // propia que mostrar: el recuadro de la forma, como hasta hoy.
      return Object.keys(p).length ? { tipo: 'radio' } : { tipo: 'nada' };

    // --- dim7: interacción, estados y feedback ---------------------------
    case 'dim7.req02':
      // Los diez estados declarados, en su orden, cada uno con su tono.
      return conEstados(estadosDe(p['estados'], 'nombre', tonoDeEstado));
    case 'dim7.req04':
      // Los cuatro tipos de feedback, con el tono de su tipo.
      return conEstados(estadosDe(p['feedback'], 'tipo', tonoDeFeedback));

    // --- dim8: movimiento y temporalidad ---------------------------------
    case 'dim8.req02':
      // Los seis roles de movimiento: todos neutros salvo feedback y énfasis.
      return conEstados(estadosDe(p['roles'], 'nombre', tonoDeRol));
    case 'dim8.req03': {
      // Cada paso de la escala nombrada, con sus ms.
      const movimientos: MovimientoDeMuestra[] = [];
      for (const paso of lista(p['escala'])) {
        const nombre = paso['nombre'];
        const ms = paso['duracion'];
        if (typeof nombre === 'string' && typeof ms === 'number') movimientos.push({ nombre, ms });
      }
      return conMovimiento(movimientos);
    }
    case 'dim8.req04': {
      // Cada movimiento con su duración: la literal, o la ref resuelta a la
      // escala de req03. Si no se puede resolver, el movimiento se omite.
      const movimientos: MovimientoDeMuestra[] = [];
      for (const movimiento of lista(p['movimientos'])) {
        const nombre = movimiento['caso'];
        const ms = msDeTiempo(set, movimiento);
        if (typeof nombre === 'string' && ms !== undefined) movimientos.push({ nombre, ms });
      }
      return conMovimiento(movimientos);
    }

    // --- dim9: patrones reutilizables ------------------------------------
    case 'dim9.req01': {
      const arquetipos: ArquetipoDeMuestra[] = [];
      for (const declarado of lista(p['arquetipos'])) {
        const nombre = declarado['nombre'];
        if (typeof nombre === 'string') arquetipos.push({ nombre });
      }
      return conArquetipos(arquetipos);
    }
    case 'dim9.req02': {
      const arquetipos: ArquetipoDeMuestra[] = [];
      for (const anatomia of lista(p['anatomias'])) {
        const nombre = anatomia['arquetipo'];
        if (typeof nombre !== 'string') continue;
        const slots = lista(anatomia['slots']).length;
        const noAplica = typeof anatomia['noAplica'] === 'string' && anatomia['noAplica'] !== '';
        arquetipos.push({
          nombre,
          ...(slots > 0 ? { slots } : {}),
          ...(noAplica ? { noAplica: true } : {}),
        });
      }
      return conArquetipos(arquetipos);
    }

    default: {
      // La salida física (pkg.salida.*) viaja en prosa: se muestra el texto
      // declarado —o el «no aplica» escrito— y no un resumen de sus claves.
      if (requisito(requirementId)?.packageId.startsWith('pkg.salida.')) {
        const noAplica = p['noAplica'];
        if (typeof noAplica === 'string') return { tipo: 'texto', texto: `no aplica: ${noAplica.slice(0, 40)}` };
        const declaracion = p['declaracion'];
        if (typeof declaracion === 'string') {
          return { tipo: 'texto', texto: declaracion.length > 60 ? `${declaracion.slice(0, 60)}…` : declaracion };
        }
      }
      return resumenTexto(p);
    }
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
