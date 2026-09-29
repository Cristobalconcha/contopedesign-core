/**
 * La Biblia del diseño en el taller: qué parte de la Biblia le toca a cada
 * encargo, y cómo se le da a la IA.
 *
 * La Biblia está compilada en el núcleo (`@contope/core`, `consultarBiblia`).
 * Acá sólo se decide la búsqueda, con dos tablas escritas a mano y sin juicio en
 * tiempo de uso (spec de tipos de producto §5.2): el tipo de producto sale del
 * mundo del sistema, y los temas salen del paquete (`packageId`) de cada pregunta
 * encargada. Lo que la Biblia dice para ese tipo, con su fuerza, va al prompt
 * tal cual, recortado sólo por tamaño.
 */
import {
  consultarBiblia,
  BIBLIA,
  type EntradaConsultada,
  type EstadoBiblia,
  type FilaDeFuerza,
  type FuerzaBiblia,
  type TipoDeProducto,
} from '@contope/core';
import { requisito } from './manifiesto.js';
import type { MundoId } from './mundos.js';
import type { Sistema } from './sistema.js';

/**
 * Qué tipos de producto de la Biblia cubre cada mundo de la pantalla de inicio.
 * Los mundos son cuatro y los tipos ocho (spec §7.3); la señalética no tiene
 * mundo todavía, así que el tema 10 no llega a ningún prompt.
 */
export const TIPOS_POR_MUNDO: Readonly<Record<MundoId, readonly TipoDeProducto[]>> = {
  editorial: ['editorial-libro', 'revista'],
  marca: ['marca', 'packaging'],
  digital: ['web'],
  campana: ['campana-digital', 'afiche'],
};

/**
 * Qué temas de la Biblia tocan a cada paquete del manifiesto. La clave es un
 * prefijo de `packageId` (hasta un punto): una pregunta recibe los temas de
 * todas las claves que calzan, de la familia (`pkg.color`) y del paquete
 * (`pkg.color.reproduccion`). Revisado contra los `packageId` reales de
 * `manifest-v0-dim1.ts` … `dim10.ts` el 29-09-2026: las diez familias y los
 * doce paquetes nombrados existen; la prueba exige que toda pregunta reciba al
 * menos un tema.
 *
 * Temas: 01 grilla, 02 tipografía (elección), 03 tipografía (escala), 04 color
 * (armonía), 05 color (contraste), 06 jerarquía, 07 composición, 08 ritmo y
 * espacio, 09 imagen, 10 señalética, 11 packaging, 12 editorial, 13 pantalla e
 * interacción, 14 producción impresa.
 */
export const TEMAS_POR_PAQUETE: Readonly<Record<string, readonly string[]>> = {
  'pkg.color': ['04', '05'],
  'pkg.color.reproduccion': ['14'],
  'pkg.tipografia': ['02', '03'],
  'pkg.tipografia.lectura': ['06'],
  'pkg.tipografia.editorial': ['12'],
  'pkg.espacio': ['01', '08'],
  'pkg.espacio.hoja': ['12', '14'],
  'pkg.espacio.sangrado': ['12', '14'],
  'pkg.composicion': ['07'],
  'pkg.composicion.estructura': ['01'],
  'pkg.composicion.ritmo': ['08'],
  'pkg.composicion.densidad': ['08'],
  'pkg.composicion.flujo': ['06'],
  'pkg.composicion.foco': ['06'],
  'pkg.composicion.dominante': ['06'],
  'pkg.forma': ['07'],
  'pkg.imagen': ['09'],
  'pkg.imagen.reproduccion': ['14'],
  'pkg.interaccion': ['13'],
  'pkg.movimiento': ['13'],
  'pkg.patrones': ['13', '06'],
  'pkg.salida': ['14'],
  'pkg.salida.encuadernacion': ['12'],
};

/** Temas que un mundo suma a cualquier encargo suyo: su capítulo propio. */
export const TEMAS_POR_MUNDO: Readonly<Partial<Record<MundoId, readonly string[]>>> = {
  editorial: ['12'],
  marca: ['11'],
};

/**
 * Qué estados de tema entran al prompt. Los borradores (temas que todavía no
 * pasan la síntesis y la verificación de citas; hoy 11 a 14) quedan fuera: la
 * línea del prompt sólo sabe decir «aprobado» o «por revisar». Cuando un tema
 * se sintetiza, ESTADO.md lo dice y basta recompilar.
 */
export const ESTADOS_EN_PROMPT: readonly EstadoBiblia[] = ['aprobado', 'por-revisar'];

/** Topes de la sección: se recorta primero divergencia, luego recomendación; nunca cortapisa. */
export const TOPE_ENTRADAS = 40;
export const TOPE_CARACTERES = 12_000;

const LARGO_ENUNCIADO = 280;
const LARGO_CELDA = 160;
const LARGO_PORQUE = 160;

/** Temas de un paquete, sin repetir, en orden de número. */
export function temasDePaquete(packageId: string): string[] {
  const temas = new Set<string>();
  for (const [clave, lista] of Object.entries(TEMAS_POR_PAQUETE)) {
    if (packageId === clave || packageId.startsWith(`${clave}.`)) for (const t of lista) temas.add(t);
  }
  return [...temas].sort();
}

/** Temas que tocan a unos encargos en un mundo; vacío si ningún encargo es una pregunta conocida. */
export function temasDeEncargos(mundo: MundoId, encargos: readonly string[]): string[] {
  const temas = new Set<string>();
  for (const id of encargos) {
    const req = requisito(id);
    if (req === undefined) continue;
    for (const t of temasDePaquete(req.packageId)) temas.add(t);
  }
  if (temas.size === 0) return [];
  for (const t of TEMAS_POR_MUNDO[mundo] ?? []) temas.add(t);
  return [...temas].sort();
}

/** Rango de una fuerza: menor es más fuerte. `no-aplica` no se presenta. */
const RANGO: Readonly<Record<FuerzaBiblia, number>> = {
  cortapisa: 0,
  'recomendacion-fuerte': 1,
  divergencia: 2,
  'no-aplica': 9,
};

/** La fuerza más fuerte que una fila presenta, o `undefined` si sólo dice «no aplica» o nada. */
function rangoDeFila(fila: FilaDeFuerza): number | undefined {
  const rangos = fila.fuerzas.map((f) => RANGO[f]).filter((r) => r < RANGO['no-aplica']);
  return rangos.length === 0 ? undefined : Math.min(...rangos);
}

/** Una entrada lista para presentar: sus filas presentables, ordenadas, y su rango. */
export interface EntradaPertinente {
  entrada: EntradaConsultada;
  filas: FilaDeFuerza[];
  /** 0 cortapisa, 1 recomendación fuerte, 2 divergencia: la fila más fuerte. */
  rango: number;
}

/**
 * Las entradas de la Biblia que tocan a unos encargos en un mundo, sin repetir,
 * con sólo las filas del tipo de producto del mundo que dicen algo (se omiten
 * «no aplica» y las celdas sin fuerza). Orden: cortapisas, recomendaciones
 * fuertes, divergencias; dentro de cada una, lo aprobado antes que lo por
 * revisar, y luego por id.
 */
export function entradasPertinentes(mundo: MundoId, encargos: readonly string[]): EntradaPertinente[] {
  const temas = temasDeEncargos(mundo, encargos);
  if (temas.length === 0) return [];
  const consultadas = consultarBiblia({ temas, tipos: TIPOS_POR_MUNDO[mundo], soloEstados: ESTADOS_EN_PROMPT });
  const salida: EntradaPertinente[] = [];
  for (const entrada of consultadas) {
    const conRango = entrada.fuerzas
      .map((fila, i) => ({ fila, i, rango: rangoDeFila(fila) }))
      .filter((x): x is { fila: FilaDeFuerza; i: number; rango: number } => x.rango !== undefined)
      .sort((a, b) => a.rango - b.rango || a.i - b.i);
    const primera = conRango[0];
    if (primera === undefined) continue;
    salida.push({ entrada, filas: conRango.map((x) => x.fila), rango: primera.rango });
  }
  const estado = (e: EntradaPertinente): number => (e.entrada.tema.estado === 'aprobado' ? 0 : 1);
  return salida.sort(
    (a, b) => a.rango - b.rango || estado(a) - estado(b) || a.entrada.id.localeCompare(b.entrada.id, 'en'),
  );
}

// ---------------------------------------------------------------------------
// La sección del prompt
// ---------------------------------------------------------------------------

const NOMBRE_FUERZA: Readonly<Record<FuerzaBiblia, string>> = {
  cortapisa: 'cortapisa',
  'recomendacion-fuerte': 'recomendación fuerte',
  divergencia: 'divergencia',
  'no-aplica': 'no aplica',
};

export const NOMBRE_ESTADO: Readonly<Record<EstadoBiblia, string>> = {
  aprobado: 'aprobado',
  'por-revisar': 'por revisar',
  borrador: 'borrador',
};

/** Texto en una línea, sin marcas de markdown, recortado en un límite de palabra. */
export function recortar(texto: string, largo: number): string {
  const limpio = texto
    .replace(/\*\*?|__|`/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (limpio.length <= largo) return limpio;
  const corte = limpio.slice(0, largo - 1);
  const espacio = corte.lastIndexOf(' ');
  return `${(espacio > largo * 0.6 ? corte.slice(0, espacio) : corte).replace(/[\s,;:.—-]+$/, '')}…`;
}

function lineasDeEntrada({ entrada, filas }: EntradaPertinente): string[] {
  const { tema } = entrada;
  const lineas = [
    `- ${entrada.id} · tema ${tema.numero} ${tema.titulo} · ${NOMBRE_ESTADO[tema.estado]} · ${recortar(entrada.enunciado, LARGO_ENUNCIADO)}`,
  ];
  for (const fila of filas) {
    const fuerzas = fila.fuerzas.map((f) => NOMBRE_FUERZA[f]).join(' + ');
    const celda = recortar(fila.texto, LARGO_CELDA);
    // Si la celda no dice más que la fuerza, no se repite.
    const dice = celda.replace(/[()., ]/g, '').toLowerCase() === fuerzas.replace(/[+ ]/g, '').toLowerCase() ? '' : ` — ${celda}`;
    const porque = fila.porque.trim() === '' ? '' : ` · porqué: ${recortar(fila.porque, LARGO_PORQUE)}`;
    lineas.push(`  · ${fila.etiqueta} → ${fuerzas}${dice}${porque}`);
  }
  return lineas;
}

function encabezado(mundo: MundoId): string[] {
  const commit = BIBLIA.fuente.commit === null ? '' : ` (vault ${BIBLIA.fuente.commit.slice(0, 7)})`;
  return [
    'LA BIBLIA DEL DISEÑO',
    `Conocimiento de oficio de ContOpe${commit}, buscado por el tipo de producto de este mundo (${TIPOS_POR_MUNDO[mundo].join(', ')}) y por los temas de las preguntas encargadas. Cada entrada trae su id, su tema, su estado y su enunciado; debajo, las filas que aplican a este tipo: etiqueta (tipo, rol o jurisdicción) → fuerza — lo que dice · porqué. Aplica sólo las filas cuya etiqueta calce con este sistema.`,
    'Cómo usar cada fuerza:',
    '  cortapisa: respétala. Sólo cede ante algo de más autoridad del ORDEN DE AUTORIDAD: nunca la pongas por encima de una definición humana (human-confirmed) ni de una IMPERATIVA del manual del cliente. Si te apartas de una cortapisa, dilo en la nota con el porqué.',
    '  recomendación fuerte: propónla por defecto; si no la sigues, explica por qué en la nota.',
    '  divergencia: hay posturas distintas y ninguna se impone; elige una y di en la nota cuál elegiste.',
    '  «por revisar»: el dueño todavía no aprueba ese tema; úsalo con esa cautela. «aprobado»: lo aprobó.',
    'En la nota de cada propuesta, cita los ids de la Biblia que usaste (por ejemplo «05.E01»).',
  ];
}

/**
 * La sección «LA BIBLIA DEL DISEÑO» del prompt de encargo, o `null` si nada de
 * la Biblia toca a estos encargos en este mundo. Determinística: los mismos
 * datos dan el mismo texto. Respeta `TOPE_ENTRADAS` y `TOPE_CARACTERES`
 * recortando primero las entradas cuya fila más fuerte es divergencia, después
 * las de recomendación fuerte (de la última hacia atrás), y nunca las que traen
 * una cortapisa; si recorta, lo dice en una línea.
 */
export function seccionBiblia(sistema: Sistema, encargos: readonly string[]): string | null {
  const pertinentes = entradasPertinentes(sistema.mundo, encargos);
  if (pertinentes.length === 0) return null;

  const bloques = pertinentes.map((p) => ({ rango: p.rango, texto: lineasDeEntrada(p).join('\n') }));
  const cabeza = encabezado(sistema.mundo).join('\n');
  const largo = (): number => cabeza.length + bloques.reduce((n, b) => n + b.texto.length + 1, 0);
  const omitidas = { divergencia: 0, recomendacion: 0 };
  for (const rango of [2, 1]) {
    while (bloques.length > TOPE_ENTRADAS || largo() > TOPE_CARACTERES) {
      const i = bloques.map((b) => b.rango).lastIndexOf(rango);
      if (i === -1) break;
      bloques.splice(i, 1);
      if (rango === 2) omitidas.divergencia++;
      else omitidas.recomendacion++;
    }
  }

  const lineas = [cabeza, ...bloques.map((b) => b.texto)];
  const total = omitidas.divergencia + omitidas.recomendacion;
  if (total > 0) {
    lineas.push(
      `(Por tamaño se omitieron ${total} entradas de ${pertinentes.length}: ${omitidas.divergencia} de divergencia y ${omitidas.recomendacion} de recomendación fuerte. Las cortapisas van todas.)`,
    );
  }
  return lineas.join('\n');
}
