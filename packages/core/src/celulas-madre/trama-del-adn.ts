/**
 * La trama desde el ADN (decisión 36): lo que el generador de tramas y la
 * pantalla del escritorio comparten para ARMAR una trama.
 *
 * Core genera las tramas; Publisher sólo las reproduce. El motor existe una
 * sola vez, en `@contope/trama`: acá no se calcula ni se dibuja nada propio,
 * sólo se arma la receta (el archivo de trama) con los valores del ADN como
 * punto de partida.
 *
 * - **Colores por rol** (dimensión 1): el fondo sale del rol `background`; los
 *   puntos lejanos, del primer color institucional (o de `text`, `action`…);
 *   los cercanos, del rol `accent` (o del segundo institucional…). Cada color
 *   anota de dónde viene (`origen: 'adn'`, con su `rol` y la `huella` de la
 *   definición). Un color elegido a mano queda `origen: 'manual'`: en
 *   pantalla se dice «propio».
 * - **Formato** (dimensión 3, si tiene sentido): los formatos de hoja del ADN
 *   se ofrecen como lienzo, con `formatoAdn` apuntando a su definición.
 * - **Sin ADN también**: con un set vacío (o `null`) la trama sale con los
 *   colores del look elegido y un formato fijo. Es una utilidad para
 *   cualquier proyecto.
 *
 * Todo es puro y determinista: mismo ADN y mismos ajustes, misma trama.
 */
import {
  configuracionPorDefecto,
  describirErrores,
  FORMATO_VERSION,
  leerTrama,
  MOTOR_ID,
  MOTOR_VERSION,
  normalizarTrama,
  TRAMA_KIND,
  type ClaveDeColor,
  type ColorDeTrama,
  type ConfiguracionMotor,
  type DibujoDeTrama,
  type Escena,
  type InteraccionDeTrama,
  type Lienzo,
  type ModoDeDibujo,
  type Pistas,
  type Trama,
} from '@contope/trama';
import type { DesignSetV0 } from '../design-set/types.js';
import { coloresDeRoles, coloresDelFundamento, rgbAHex, type ColorDelAdn } from './color-del-adn.js';
import { hojasDelAdn, PX_POR_UNIDAD } from './espacio-del-adn.js';
import { huella } from './huella.js';

// ---------------------------------------------------------------------------
// Looks: los presets del sistema de v7 («Del sistema» en su menú).
// ---------------------------------------------------------------------------

export interface LookDeTrama {
  id: string;
  nombre: string;
  modo: ModoDeDibujo;
  /** Lo que cambia respecto de la configuración por defecto («Lámina plegada»). */
  configuracion: Partial<ConfiguracionMotor>;
  /** Los colores propios del look, si trae (si no, los por defecto del formato). */
  colores?: Record<ClaveDeColor, string>;
}

const COLORES_POR_DEFECTO: Record<ClaveDeColor, string> = { lejos: '#2a52d6', cerca: '#3dd6c0', fondo: '#000000' };

/** Los siete presets del sistema de v7, con los nombres de parámetro de este formato. */
export const LOOKS_DE_TRAMA: readonly LookDeTrama[] = [
  { id: 'lamina-plegada', nombre: 'Lámina plegada', modo: 'puntos', configuracion: {} },
  {
    id: 'velo-lejano',
    nombre: 'Velo lejano',
    modo: 'puntos',
    configuracion: {
      lineas: 80, puntosPorLinea: 600, distancia: 7, grosor: 1.1, brillo: 0.9, apagadoPorDistancia: 1,
      anchoLamina: 5, pliegues: 1.4, frecuenciaPliegues: 1.4, curvatura: 1.2, torsion: 0.3, inclinacion: 10,
    },
    colores: { lejos: '#1d3fb8', cerca: '#3bb8a8', fondo: '#000000' },
  },
  {
    id: 'ola-amplia',
    nombre: 'Ola amplia',
    modo: 'puntos',
    configuracion: { anchoLamina: 6, torsion: 0.2, pliegues: 2.4, frecuenciaPliegues: 1.2, curvatura: 3, distancia: 5.4, inclinacion: 8, serpenteo: 0.8 },
  },
  {
    id: 'cinta',
    nombre: 'Cinta',
    modo: 'puntos',
    configuracion: {
      lineas: 40, puntosPorLinea: 520, anchoLamina: 1.3, torsion: 1.4, pliegues: 1.0, frecuenciaPliegues: 1.6,
      curvatura: 0, distancia: 4.6, inclinacion: 16, grosor: 1.8,
    },
  },
  {
    id: 'papel',
    nombre: 'Papel',
    modo: 'puntos',
    configuracion: { brillo: 1.2, grosor: 1.7, apagadoPorDistancia: 0.7, lineas: 70, puntosPorLinea: 520, pliegues: 1.6, curvatura: 1.6, distancia: 5.4 },
    colores: { lejos: '#9fb4e8', cerca: '#0e6b62', fondo: '#f1ede4' },
  },
  {
    id: 'torsion-de-lineas',
    nombre: 'Torsión de líneas',
    modo: 'lineas',
    configuracion: {
      lineas: 72, puntosPorLinea: 520, anchoLamina: 4.2, torsion: 1.0, pliegues: 1.6, frecuenciaPliegues: 2.6,
      curvatura: -2.0, distancia: 4.6, inclinacion: 24, giro: -12,
    },
  },
  {
    id: 'puntos-e-hilos',
    nombre: 'Puntos e hilos',
    modo: 'mixto',
    configuracion: {
      lineas: 44, puntosPorLinea: 300, grosor: 2.0, opacidadPunto: 1, grosorLinea: 0.45, opacidadLinea: 0.32,
      anchoLamina: 4.4, pliegues: 1.5, curvatura: 1.6, distancia: 5.2,
    },
  },
];

export const LOOK_POR_DEFECTO = 'lamina-plegada';

export function lookPorId(id: string): LookDeTrama {
  return LOOKS_DE_TRAMA.find((l) => l.id === id) ?? (LOOKS_DE_TRAMA[0] as LookDeTrama);
}

/** La configuración completa de un look: la por defecto con lo suyo encima. */
export function configuracionDeLook(id: string): ConfiguracionMotor {
  return { ...configuracionPorDefecto(), ...lookPorId(id).configuracion };
}

/** Los colores propios de un look (o los por defecto del formato). */
export function coloresDeLook(id: string): Record<ClaveDeColor, string> {
  return { ...(lookPorId(id).colores ?? COLORES_POR_DEFECTO) };
}

// ---------------------------------------------------------------------------
// Colores del ADN, por rol.
// ---------------------------------------------------------------------------

/** Un color del ADN que la trama puede usar, con lo que anota en el archivo. */
export interface ColorParaTrama {
  /** La clave de `color-del-adn.ts` (`roles:accent`, `institucionales:Azul`). */
  clave: string;
  nombre: string;
  /** «Roles», «Institucionales», «Neutros». */
  etiquetaGrupo: string;
  hex: string;
  /** Lo que queda en `rol`: `dim1.req02:accent`, `dim1.req01:institucionales:Azul`. */
  rol: string;
  requirementId: string;
  /** `sha256:` de la definición leída (la misma huella de los ancestros). */
  huella: string;
}

function rolDe(c: ColorDelAdn): string {
  return c.grupo === 'roles' ? `${c.requirementId}:${c.nombre}` : `${c.requirementId}:${c.grupo}:${c.nombre}`;
}

/** Los colores del fundamento y de los roles, listos para una trama. Sin ADN, ninguno. */
export function coloresParaTrama(designSet: DesignSetV0 | null): ColorParaTrama[] {
  if (!designSet) return [];
  const huellas = new Map(designSet.entries.map((e) => [e.requirementId, huella(e.payload)]));
  return [...coloresDeRoles(designSet), ...coloresDelFundamento(designSet)].map((c) => ({
    clave: c.clave,
    nombre: c.nombre,
    etiquetaGrupo: c.etiquetaGrupo,
    hex: rgbAHex(c.rgb),
    rol: rolDe(c),
    requirementId: c.requirementId,
    huella: huellas.get(c.requirementId) ?? '',
  }));
}

/**
 * Dónde se busca cada color, en orden. `institucionales#0` es el primer
 * institucional, sea cual sea su nombre. El fondo se elige primero; después
 * los puntos, saltando lo que sea igual al fondo o al otro color de puntos
 * (puntos del color del fondo no se verían).
 */
export const PREFERENCIAS_DE_COLOR: Readonly<Record<ClaveDeColor, readonly string[]>> = {
  fondo: ['roles:background'],
  lejos: ['institucionales#0', 'roles:text', 'roles:action', 'roles:info'],
  cerca: ['roles:accent', 'institucionales#1', 'roles:action', 'roles:focus', 'roles:success'],
};

function buscar(candidatos: readonly ColorParaTrama[], preferencia: string): ColorParaTrama | undefined {
  const indice = /^institucionales#(\d+)$/.exec(preferencia);
  if (indice) return candidatos.filter((c) => c.clave.startsWith('institucionales:'))[Number(indice[1])];
  return candidatos.find((c) => c.clave === preferencia);
}

export function colorDelAdn(c: ColorParaTrama): ColorDeTrama {
  return { hex: c.hex, origen: 'adn', rol: c.rol, huella: c.huella };
}

/**
 * Los tres colores de la trama según el ADN. Lo que el ADN no da (o daría
 * puntos invisibles) sale de `respaldo`, como color propio.
 */
export function coloresDeTramaDelAdn(designSet: DesignSetV0 | null, respaldo: Record<ClaveDeColor, string> = COLORES_POR_DEFECTO): Record<ClaveDeColor, ColorDeTrama> {
  const candidatos = coloresParaTrama(designSet);
  const elegido: Partial<Record<ClaveDeColor, ColorDeTrama>> = {};
  const usados: string[] = [];
  for (const clave of ['fondo', 'lejos', 'cerca'] as const) {
    const c = PREFERENCIAS_DE_COLOR[clave].map((p) => buscar(candidatos, p)).find((x) => x !== undefined && !usados.includes(x.hex));
    elegido[clave] = c ? colorDelAdn(c) : { hex: respaldo[clave], origen: 'manual' };
    usados.push((elegido[clave] as ColorDeTrama).hex);
  }
  return elegido as Record<ClaveDeColor, ColorDeTrama>;
}

/**
 * Con el ADN de hoy, los colores que vienen del ADN se vuelven a leer por su
 * rol (hex y huella al día). Si el rol ya no existe, el color queda como
 * propio, con el mismo hex: la trama no cambia sola de aspecto.
 */
export function refrescarColoresDelAdn(trama: Trama, designSet: DesignSetV0 | null): Trama {
  const porRol = new Map(coloresParaTrama(designSet).map((c) => [c.rol, c]));
  const color = { ...trama.color };
  for (const clave of ['lejos', 'cerca', 'fondo'] as const) {
    const actual = color[clave];
    if (actual.origen !== 'adn') continue;
    const c = actual.rol === undefined ? undefined : porRol.get(actual.rol);
    color[clave] = c ? colorDelAdn(c) : { hex: actual.hex, origen: 'manual' };
  }
  return { ...trama, color };
}

// ---------------------------------------------------------------------------
// Lienzos: formatos fijos y los formatos de hoja del ADN.
// ---------------------------------------------------------------------------

export interface FormatoParaTrama {
  /** Valor estable: `16x9`, `adn:carta-vertical`. */
  valor: string;
  etiqueta: string;
  lienzo: Lienzo;
  requirementId?: string;
}

/** Los de v7, más los de redes sociales. Medidas en px. */
const FORMATOS_FIJOS: ReadonlyArray<{ valor: string; etiqueta: string; ancho: number; alto: number }> = [
  { valor: '16x9', etiqueta: 'Pantalla 16:9 (1920 × 1080)', ancho: 1920, alto: 1080 },
  { valor: '1x1', etiqueta: 'Cuadrado (1080 × 1080)', ancho: 1080, alto: 1080 },
  { valor: '4x5', etiqueta: 'Vertical 4:5 (1080 × 1350)', ancho: 1080, alto: 1350 },
  { valor: '9x16', etiqueta: 'Historia 9:16 (1080 × 1920)', ancho: 1080, alto: 1920 },
  { valor: 'carta', etiqueta: 'Carta vertical (816 × 1056)', ancho: 816, alto: 1056 },
  { valor: 'doble-carta', etiqueta: 'Doble carta 17 × 11 (1632 × 1056)', ancho: 1632, alto: 1056 },
];

export const FORMATO_LIBRE = 'libre';

/** Los formatos que se ofrecen: los del ADN primero (si hay), los fijos y «libre». */
export function formatosParaTrama(designSet: DesignSetV0 | null): FormatoParaTrama[] {
  const delAdn: FormatoParaTrama[] = [];
  if (designSet) {
    const definicion = designSet.entries.find((e) => e.requirementId === 'dim3.req08');
    for (const h of hojasDelAdn(designSet).hojas) {
      const px = PX_POR_UNIDAD[h.unidad];
      const ancho = Math.round(h.ancho * px), alto = Math.round(h.alto * px);
      if (ancho < 1 || alto < 1 || ancho > 16_384 || alto > 16_384) continue;
      delAdn.push({
        valor: `adn:${h.clave}`,
        etiqueta: `${h.nombre} · del ADN (${ancho} × ${alto})`,
        lienzo: {
          tipo: 'medida', ancho, alto,
          formatoAdn: { id: h.clave, requisito: 'dim3.req08', nombre: h.nombre, ...(definicion ? { huella: huella(definicion.payload) } : {}) },
        },
        requirementId: 'dim3.req08',
      });
    }
  }
  return [
    ...delAdn,
    ...FORMATOS_FIJOS.map((f) => ({ valor: f.valor, etiqueta: f.etiqueta, lienzo: { tipo: 'medida', ancho: f.ancho, alto: f.alto } as Lienzo })),
    { valor: FORMATO_LIBRE, etiqueta: 'Libre (llena el contenedor)', lienzo: { tipo: 'libre' } },
  ];
}

/** El formato por defecto: el primero del ADN si hay; si no, 16:9. */
export function formatoPorDefecto(designSet: DesignSetV0 | null): string {
  return formatosParaTrama(designSet)[0]?.valor ?? '16x9';
}

/** Ancho / alto de un lienzo; uno libre se toma como 16:9. */
export function proporcionDeLienzo(lienzo: Lienzo): number {
  if (lienzo.tipo === 'medida') return lienzo.ancho / lienzo.alto;
  if (lienzo.tipo === 'proporcion') return lienzo.proporcion;
  return 16 / 9;
}

/** La medida del cuadro quieto con `ancho` px, respetando la proporción del lienzo. */
export function medidaDeCuadro(lienzo: Lienzo, ancho: number): { ancho: number; alto: number } {
  const a = Math.max(16, Math.round(ancho));
  return { ancho: a, alto: Math.max(16, Math.round(a / proporcionDeLienzo(lienzo))) };
}

// ---------------------------------------------------------------------------
// Escenas.
// ---------------------------------------------------------------------------

/** Una escena como la entrega quien arma la trama: su captura y, si quiere, su instante y su transición. */
export type EscenaDeAjuste = Pick<Escena, 'captura'> & Partial<Omit<Escena, 'captura' | 'id'>>;

/**
 * Los instantes de `n` escenas repartidas en `duracion`. Con el ciclo
 * cerrado, la última no llega al final (ahí va la escena de cierre, que
 * repite la primera); sin cerrar, la última cae justo al final.
 */
export function repartirEscenas(n: number, duracion: number, cerrarCiclo: boolean): number[] {
  if (n <= 0) return [];
  if (n === 1) return [0];
  const partes = cerrarCiclo ? n : n - 1;
  return Array.from({ length: n }, (_, i) => Math.round(((i * duracion) / partes) * 1000) / 1000);
}

// ---------------------------------------------------------------------------
// Armar la trama.
// ---------------------------------------------------------------------------

export interface AjustesDeTrama {
  nombre: string;
  /** Id de `LOOKS_DE_TRAMA`. */
  look: string;
  /** El momento de evolución en que parte (la «semilla»: el mismo número da la misma imagen). */
  semilla: number;
  modo: 'vivo' | 'secuencia';
  /** Segundos de la secuencia. */
  duracion: number;
  /** La secuencia termina en la misma captura en que parte. */
  cerrarCiclo: boolean;
  /** Valor de `formatosParaTrama`. */
  formato: string;
  /** Un lienzo dado tal cual (el de una trama importada): manda sobre `formato`. */
  lienzo: Lienzo | null;
  /** Si los colores salen del ADN por rol (true) o del look (false). */
  coloresDelAdn: boolean;
  /** Colores elegidos a mano: mandan sobre el ADN y el look, y quedan como propios. */
  colores: Partial<Record<ClaveDeColor, string>>;
  /** Colores ya resueltos (con su origen): mandan sobre todo lo anterior. Lo usa el editor. */
  coloresResueltos: Partial<Record<ClaveDeColor, ColorDeTrama>>;
  /** Ajustes sobre la configuración del look. */
  configuracion: Partial<ConfiguracionMotor>;
  dibujo: Partial<DibujoDeTrama>;
  interaccion: Partial<InteraccionDeTrama>;
  /** Las escenas de la secuencia, en orden. Sin `t`, se reparten en la duración. */
  escenas: EscenaDeAjuste[];
  /** Keyframes hechos a mano (los de una trama importada), que se conservan. */
  pistas: Pistas;
  /** La metadata de ancestro de Células Madre, si la hay. */
  procedencia: Record<string, unknown>;
}

export function ajustesPorDefecto(designSet: DesignSetV0 | null): AjustesDeTrama {
  return {
    nombre: '',
    look: LOOK_POR_DEFECTO,
    semilla: 6,
    modo: 'vivo',
    duracion: 8,
    cerrarCiclo: true,
    formato: formatoPorDefecto(designSet),
    lienzo: null,
    coloresDelAdn: true,
    colores: {},
    coloresResueltos: {},
    configuracion: {},
    dibujo: {},
    interaccion: {},
    escenas: [],
    pistas: {},
    procedencia: {},
  };
}

/** Los colores de la trama para estos ajustes, con su origen. */
export function coloresDeAjustes(designSet: DesignSetV0 | null, ajustes: Pick<AjustesDeTrama, 'look' | 'coloresDelAdn' | 'colores' | 'coloresResueltos'>): Record<ClaveDeColor, ColorDeTrama> {
  const delLook = coloresDeLook(ajustes.look);
  const base: Record<ClaveDeColor, ColorDeTrama> = ajustes.coloresDelAdn
    ? coloresDeTramaDelAdn(designSet, delLook)
    : { lejos: { hex: delLook.lejos, origen: 'manual' }, cerca: { hex: delLook.cerca, origen: 'manual' }, fondo: { hex: delLook.fondo, origen: 'manual' } };
  for (const clave of ['lejos', 'cerca', 'fondo'] as const) {
    const propio = ajustes.colores[clave];
    if (propio !== undefined && /^#[0-9a-fA-F]{6}$/.test(propio)) base[clave] = { hex: propio.toLowerCase(), origen: 'manual' };
    const resuelto = ajustes.coloresResueltos[clave];
    if (resuelto !== undefined) base[clave] = { ...resuelto };
  }
  return base;
}

/**
 * Arma una trama (normalizada y válida) desde el ADN —o sin él— y unos
 * ajustes. Lo que falte en `ajustes` toma su valor por defecto. Lanza
 * `ErrorDeTrama` sólo si los ajustes dan algo fuera de los límites del
 * formato (p. ej. una duración de 0).
 */
export function armarTrama(designSet: DesignSetV0 | null, parcial: Partial<AjustesDeTrama> = {}): Trama {
  const a: AjustesDeTrama = { ...ajustesPorDefecto(designSet), ...parcial };
  const look = lookPorId(a.look);
  const formato = formatosParaTrama(designSet).find((f) => f.valor === a.formato) ?? formatosParaTrama(designSet).find((f) => f.valor === '16x9');
  const configuracion = { ...configuracionDeLook(look.id), ...a.configuracion };
  const color = coloresDeAjustes(designSet, a);
  const documento: Record<string, unknown> = {
    kind: TRAMA_KIND,
    version: FORMATO_VERSION,
    motor: { id: MOTOR_ID, version: MOTOR_VERSION },
    lienzo: a.lienzo ?? formato?.lienzo ?? { tipo: 'libre' },
    dibujo: { modo: a.dibujo.modo ?? look.modo, tinta: a.dibujo.tinta ?? 'auto' },
    color,
    configuracion,
    interaccion: { cursor: a.interaccion.cursor ?? true, paralaje: a.interaccion.paralaje ?? false },
    cuadroQuieto: 0,
  };
  if (a.nombre.trim() !== '') documento['nombre'] = a.nombre.trim().slice(0, 200);
  if (Object.keys(a.procedencia).length) documento['procedencia'] = a.procedencia;
  if (a.modo === 'vivo') {
    documento['tiempo'] = { modo: 'vivo', inicio: a.semilla };
  } else {
    const escenasDadas: EscenaDeAjuste[] = a.escenas.length
      ? a.escenas
      : [{ nombre: 'Inicio', captura: { evolucion: a.semilla } }];
    const conTiempo = escenasDadas.every((e) => typeof e.t === 'number' && e.t >= 0 && e.t <= a.duracion);
    const instantes = repartirEscenas(escenasDadas.length, a.duracion, a.cerrarCiclo);
    documento['tiempo'] = {
      modo: 'secuencia',
      inicio: a.semilla,
      duracion: a.duracion,
      cerrarCiclo: a.cerrarCiclo,
      alTerminar: 'repetir',
      pistas: a.pistas,
      escenas: escenasDadas.map((e, i) => {
        const t = conTiempo ? (e.t as number) : (instantes[i] as number);
        const hueco = i === 0 ? t : t - (conTiempo ? (escenasDadas[i - 1]?.t as number) : (instantes[i - 1] as number));
        const escena: Record<string, unknown> = {
          id: i + 1,
          t,
          captura: e.captura,
          transicion: e.transicion ?? 'morph',
          duracion: e.duracion ?? Math.min(2, Math.max(0.04, Math.round(hueco * 0.6 * 100) / 100)),
          evolucion: e.evolucion ?? true,
        };
        if (e.curva) escena['curva'] = e.curva;
        if (e.nombre !== undefined) escena['nombre'] = e.nombre.slice(0, 200);
        return escena;
      }),
    };
  }
  return normalizarTrama(documento);
}

/**
 * Lee una receta (JSON, `CT1.…` o `SP1.…`) y pone al día sus colores del
 * ADN. Errores en español, juntos, listos para mostrar.
 */
export function tramaDeReceta(receta: string, designSet: DesignSetV0 | null): { ok: true; trama: Trama; avisos: string[] } | { ok: false; error: string } {
  const r = leerTrama(receta);
  if (!r.ok) return { ok: false, error: `La receta de trama no se pudo leer:\n${describirErrores(r.errores)}` };
  return { ok: true, trama: refrescarColoresDelAdn(r.trama, designSet), avisos: r.avisos };
}

/** Las preguntas del ADN de las que sale una trama: las de sus colores del ADN y la de su formato. */
export function requisitosDeTrama(trama: Trama): string[] {
  const ids = new Set<string>();
  for (const clave of ['lejos', 'cerca', 'fondo'] as const) {
    const c = trama.color[clave];
    if (c.origen === 'adn' && c.rol) ids.add(c.rol.split(':')[0] as string);
  }
  const requisito = trama.lienzo.formatoAdn?.requisito;
  if (requisito) ids.add(requisito);
  return [...ids].sort();
}
