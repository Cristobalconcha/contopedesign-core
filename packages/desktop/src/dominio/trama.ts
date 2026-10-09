/**
 * La pantalla de la trama (decisión 36), sin dibujar: el estado del editor,
 * sus acciones y la trama que sale de él.
 *
 * Core genera las tramas y el motor existe una vez (`@contope/trama`): el
 * editor sólo guarda lo que el diseñador eligió y lo convierte en una trama
 * con `armarTrama` del núcleo, la misma función que usa el generador de
 * Células Madre. Así lo que se ve en pantalla es lo que baja en el `.zip`.
 *
 * - Los colores parten del ADN (por rol) y cada uno se puede cambiar a mano:
 *   queda «propio» (`origen: 'manual'` en el archivo). «Volver al ADN»
 *   borra los propios.
 * - Una trama en vivo no tiene final. Una secuencia se arma con capturas
 *   (escenas); con el ciclo cerrado, parte y termina en la misma.
 * - Sin ADN funciona igual: los colores salen del look.
 */
import {
  ajustesPorDefecto,
  armarTrama,
  coloresDeAjustes,
  configuracionDeLook,
  formatosParaTrama,
  lookPorId,
  refrescarColoresDelAdn,
  type DesignSetV0,
  type EscenaDeAjuste,
} from '@contope/core';
import {
  CURVA_SUAVE,
  type Captura,
  type ClaveDeColor,
  type ColorDeTrama,
  type ConfiguracionMotor,
  type DibujoDeTrama,
  type InteraccionDeTrama,
  type Lienzo,
  type ModoDeDibujo,
  type ParametroMotor,
  type Pistas,
  type TintaElegida,
  type Trama,
} from '@contope/trama';

/** Una escena en el editor: la escena del archivo, con una clave para la lista. */
export interface EscenaDelEditor extends EscenaDeAjuste {
  clave: number;
  nombre: string;
}

export interface EditorDeTrama {
  nombre: string;
  /** El último look elegido (los controles pueden haberlo cambiado). */
  look: string;
  configuracion: ConfiguracionMotor;
  dibujo: DibujoDeTrama;
  /** Los colores que ya no siguen al ADN ni al look: los propios (o los de una trama importada). */
  colores: Partial<Record<ClaveDeColor, ColorDeTrama>>;
  /** Valor de `formatosParaTrama`, o `importado` con `lienzo`. */
  formato: string;
  lienzo: Lienzo | null;
  semilla: number;
  modo: 'vivo' | 'secuencia';
  duracion: number;
  cerrarCiclo: boolean;
  escenas: EscenaDelEditor[];
  /** Keyframes hechos a mano de una trama importada: se conservan tal cual. */
  pistas: Pistas;
  interaccion: InteraccionDeTrama;
  /** La próxima clave de escena. */
  siguiente: number;
}

export const FORMATO_IMPORTADO = 'importado';

/** Los parámetros del motor que la pantalla ofrece, en este orden (rangos de `PARAMETROS_ANIMABLES`). */
export const CONTROLES_DE_TRAMA: readonly ParametroMotor[] = [
  'anchoLamina',
  'torsion',
  'pliegues',
  'curvatura',
  'ondulacion',
  'grosor',
  'lineas',
  'inclinacion',
  'giro',
  'distancia',
  'brillo',
];

export function editorNuevo(designSet: DesignSetV0 | null): EditorDeTrama {
  const a = ajustesPorDefecto(designSet);
  const look = lookPorId(a.look);
  return {
    nombre: '',
    look: look.id,
    configuracion: configuracionDeLook(look.id),
    dibujo: { modo: look.modo, tinta: 'auto' },
    colores: {},
    formato: a.formato,
    lienzo: null,
    semilla: a.semilla,
    modo: 'vivo',
    duracion: a.duracion,
    cerrarCiclo: true,
    escenas: [],
    pistas: {},
    interaccion: { cursor: true, paralaje: false },
    siguiente: 1,
  };
}

/** Los colores con que se ve ahora la trama, con su origen. */
export function coloresDelEditor(e: EditorDeTrama, designSet: DesignSetV0 | null): Record<ClaveDeColor, ColorDeTrama> {
  return coloresDeAjustes(designSet, { look: e.look, coloresDelAdn: true, colores: {}, coloresResueltos: e.colores });
}

/** La trama que describe el editor, normalizada y válida. */
export function tramaDelEditor(e: EditorDeTrama, designSet: DesignSetV0 | null): Trama {
  return armarTrama(designSet, {
    nombre: e.nombre,
    look: e.look,
    semilla: e.semilla,
    modo: e.modo,
    duracion: e.duracion,
    cerrarCiclo: e.cerrarCiclo,
    formato: e.formato,
    lienzo: e.formato === FORMATO_IMPORTADO ? e.lienzo : null,
    coloresDelAdn: true,
    coloresResueltos: e.colores,
    configuracion: e.configuracion,
    dibujo: e.dibujo,
    interaccion: e.interaccion,
    escenas: e.escenas.map(({ clave: _clave, ...escena }) => escena),
    pistas: e.pistas,
  });
}

/** Lo que guarda «Capturar»: el momento y la forma de la lámina. Los colores son de toda la trama, no de una escena. */
export function capturaDelEditor(e: EditorDeTrama, evolucion: number): Captura {
  const { velocidad: _v, paralaje: _p, ...configuracion } = e.configuracion;
  return { evolucion: Math.round(evolucion * 1000) / 1000, configuracion };
}

/** El editor que corresponde a una trama leída (importada), con sus colores del ADN al día. */
export function editorDesdeTrama(trama: Trama, designSet: DesignSetV0 | null): EditorDeTrama {
  const t = refrescarColoresDelAdn(trama, designSet);
  const formato = formatosParaTrama(designSet).find((f) => JSON.stringify(f.lienzo) === JSON.stringify(t.lienzo));
  const base: EditorDeTrama = {
    nombre: t.nombre ?? '',
    look: 'lamina-plegada',
    configuracion: { ...t.configuracion },
    dibujo: { ...t.dibujo },
    colores: { lejos: t.color.lejos, cerca: t.color.cerca, fondo: t.color.fondo },
    formato: formato ? formato.valor : FORMATO_IMPORTADO,
    lienzo: formato ? null : t.lienzo,
    semilla: t.tiempo.inicio,
    modo: t.tiempo.modo,
    duracion: 8,
    cerrarCiclo: true,
    escenas: [],
    pistas: {},
    interaccion: { ...t.interaccion },
    siguiente: 1,
  };
  if (t.tiempo.modo === 'vivo') return base;
  const escenas = t.tiempo.escenas.map((sc, i) => ({
    clave: i + 1,
    nombre: sc.nombre ?? `Escena ${i + 1}`,
    t: sc.t,
    captura: sc.captura,
    transicion: sc.transicion,
    duracion: sc.duracion,
    curva: sc.curva,
    evolucion: sc.evolucion,
  }));
  const pistas: Pistas = {};
  for (const [ruta, keys] of Object.entries(t.tiempo.pistas) as [keyof Pistas, NonNullable<Pistas[keyof Pistas]>][]) {
    const manuales = keys.filter((k) => k.escena === undefined);
    if (manuales.length) pistas[ruta] = manuales;
  }
  return { ...base, duracion: t.tiempo.duracion, cerrarCiclo: t.tiempo.cerrarCiclo, escenas, pistas, siguiente: escenas.length + 1 };
}

export type AccionDeTrama =
  | { tipo: 'look'; look: string }
  | { tipo: 'parametro'; parametro: ParametroMotor; valor: number }
  | { tipo: 'modo-de-dibujo'; modo: ModoDeDibujo }
  | { tipo: 'tinta'; tinta: TintaElegida }
  | { tipo: 'color'; clave: ClaveDeColor; hex: string }
  | { tipo: 'volver-al-adn' }
  | { tipo: 'formato'; formato: string }
  | { tipo: 'semilla'; semilla: number }
  | { tipo: 'modo'; modo: 'vivo' | 'secuencia' }
  | { tipo: 'duracion'; duracion: number }
  | { tipo: 'cerrar-ciclo'; cerrar: boolean }
  | { tipo: 'cursor'; activo: boolean }
  | { tipo: 'capturar'; captura: Captura }
  | { tipo: 'mover-escena'; clave: number; hacia: -1 | 1 }
  | { tipo: 'quitar-escena'; clave: number }
  | { tipo: 'renombrar-escena'; clave: number; nombre: string }
  | { tipo: 'nombre'; nombre: string }
  | { tipo: 'cargar'; editor: EditorDeTrama };

const acotar = (v: number, min: number, max: number): number => Math.min(max, Math.max(min, v));

/** Las escenas, con los instantes borrados: se vuelven a repartir en la duración (al cambiar la lista). */
const sinInstantes = (escenas: readonly EscenaDelEditor[]): EscenaDelEditor[] =>
  escenas.map(({ t: _t, duracion: _d, ...resto }) => resto);

export function reducirTrama(e: EditorDeTrama, a: AccionDeTrama): EditorDeTrama {
  switch (a.tipo) {
    case 'look': {
      const look = lookPorId(a.look);
      // Un look trae su forma, su dibujo y sus colores de respaldo; los colores propios se quedan.
      return { ...e, look: look.id, configuracion: configuracionDeLook(look.id), dibujo: { ...e.dibujo, modo: look.modo } };
    }
    case 'parametro':
      if (!Number.isFinite(a.valor)) return e;
      return { ...e, configuracion: { ...e.configuracion, [a.parametro]: a.parametro === 'lineas' || a.parametro === 'puntosPorLinea' ? Math.round(a.valor) : a.valor } };
    case 'modo-de-dibujo':
      return { ...e, dibujo: { ...e.dibujo, modo: a.modo } };
    case 'tinta':
      return { ...e, dibujo: { ...e.dibujo, tinta: a.tinta } };
    case 'color':
      if (!/^#[0-9a-fA-F]{6}$/.test(a.hex)) return e;
      return { ...e, colores: { ...e.colores, [a.clave]: { hex: a.hex.toLowerCase(), origen: 'manual' } } };
    case 'volver-al-adn':
      return { ...e, colores: {} };
    case 'formato':
      return { ...e, formato: a.formato, lienzo: a.formato === FORMATO_IMPORTADO ? e.lienzo : null };
    case 'semilla':
      return Number.isFinite(a.semilla) ? { ...e, semilla: acotar(a.semilla, 0, 1000) } : e;
    case 'modo':
      return { ...e, modo: a.modo };
    case 'duracion': {
      if (!Number.isFinite(a.duracion)) return e;
      const duracion = acotar(a.duracion, 1, 600);
      const caben = e.escenas.every((sc) => sc.t === undefined || sc.t <= duracion);
      return { ...e, duracion, escenas: caben ? e.escenas : sinInstantes(e.escenas) };
    }
    case 'cerrar-ciclo':
      return { ...e, cerrarCiclo: a.cerrar, escenas: sinInstantes(e.escenas) };
    case 'cursor':
      return { ...e, interaccion: { ...e.interaccion, cursor: a.activo } };
    case 'capturar': {
      const escena: EscenaDelEditor = { clave: e.siguiente, nombre: `Escena ${e.siguiente}`, captura: a.captura, curva: [...CURVA_SUAVE] };
      return { ...e, modo: 'secuencia', escenas: [...sinInstantes(e.escenas), escena], siguiente: e.siguiente + 1 };
    }
    case 'mover-escena': {
      const i = e.escenas.findIndex((sc) => sc.clave === a.clave);
      const j = i + a.hacia;
      if (i < 0 || j < 0 || j >= e.escenas.length) return e;
      const escenas = sinInstantes(e.escenas);
      [escenas[i], escenas[j]] = [escenas[j] as EscenaDelEditor, escenas[i] as EscenaDelEditor];
      return { ...e, escenas };
    }
    case 'quitar-escena':
      return { ...e, escenas: sinInstantes(e.escenas.filter((sc) => sc.clave !== a.clave)) };
    case 'renombrar-escena':
      return { ...e, escenas: e.escenas.map((sc) => (sc.clave === a.clave ? { ...sc, nombre: a.nombre.slice(0, 200) } : sc)) };
    case 'nombre':
      return { ...e, nombre: a.nombre.slice(0, 200) };
    case 'cargar':
      return a.editor;
  }
}

/** Los mensajes de `leerTrama`, para el diseñador: el primero (o los primeros) con su lugar. */
export function errorDeLectura(errores: ReadonlyArray<{ ruta: string; mensaje: string }>): string {
  const primeros = errores.slice(0, 3).map((x) => (x.ruta ? `${x.ruta}: ${x.mensaje}` : x.mensaje).replace(/\.+$/, ''));
  const mas = errores.length > 3 ? ` (y ${errores.length - 3} más)` : '';
  return `No se pudo leer la trama: ${primeros.join('; ')}${mas}.`;
}
