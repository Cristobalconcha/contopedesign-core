/**
 * La pantalla de la trama (decisión 36), sin dibujar: lo que el escritorio
 * le dice al generador v7 y lo que hace con lo que el generador le devuelve.
 *
 * El generador es v7 tal cual (`public/trama/generador-v7.html`), en un
 * iframe: sus controles, su galería, su línea de tiempo, su audio y su
 * video son los suyos. El escritorio sólo le pasa el ADN y recibe la trama:
 *
 * - **Colores del ADN** (por rol) como valores de partida; «Volver al ADN»
 *   los vuelve a mandar. Al exportar, un color que sigue igual al del ADN
 *   queda con `origen: 'adn'` (rol y huella); uno cambiado, propio.
 * - **Formatos de hoja del ADN**: se suman al menú de formato de v7 (con el
 *   valor `ANCHOxALTO` que v7 entiende) y viajan con su `formatoAdn`.
 * - **La trama**: v7 la arma con `tramaDeEstadoV7` (en `@contope/trama`) y
 *   el escritorio hace la Célula Madre con el generador de siempre, con la
 *   trama como receta (`CT1.…`).
 *
 * Sin ADN funciona igual: no se mandan colores y v7 usa los suyos.
 */
import { coloresDeTramaDelAdn, formatosParaTrama, type DesignSetV0 } from '@contope/core';
import { codificarTrama, type ClaveDeColor, type ColorDeTrama, type Lienzo, type Trama } from '@contope/trama';

/** Marca de los mensajes entre el escritorio y el generador v7. */
export const FUENTE_DEL_GENERADOR = 'contope-trama';

/** Dónde vive el generador v7, relativo a `index.html` (en desarrollo y compilado). */
export const PAGINA_DEL_GENERADOR = './trama/generador-v7.html';

export type ColoresParaElGenerador = Partial<Record<ClaveDeColor, ColorDeTrama>>;

export interface FormatoParaElGenerador {
  /** Clave estable del formato en el escritorio (`adn:carta`). */
  clave: string;
  /** Lo que v7 entiende en su menú de formato: `ANCHOxALTO`. */
  valor: string;
  etiqueta: string;
  lienzo: Lienzo;
}

type ConFuente<T> = T & { fuente: typeof FUENTE_DEL_GENERADOR };

export type MensajeAlGenerador = ConFuente<
  | { tipo: 'iniciar'; colores: ColoresParaElGenerador; formatos: FormatoParaElGenerador[]; quietud: boolean }
  | { tipo: 'colores'; colores: ColoresParaElGenerador }
  | { tipo: 'importar'; trama: Trama }
  | { tipo: 'pedir-trama'; pedido: number }
>;

export type MensajeDelGenerador = ConFuente<{ tipo: 'listo' } | { tipo: 'trama'; pedido: number; trama: Trama } | { tipo: 'trama'; pedido: number; error: string }>;

/** Los colores que el ADN da por rol. Los que no salen del ADN no se mandan: v7 conserva los suyos. */
export function coloresParaElGenerador(designSet: DesignSetV0 | null): ColoresParaElGenerador {
  const o: ColoresParaElGenerador = {};
  for (const [clave, c] of Object.entries(coloresDeTramaDelAdn(designSet)) as [ClaveDeColor, ColorDeTrama][]) if (c.origen === 'adn') o[clave] = c;
  return o;
}

/** Los formatos de hoja del ADN, para sumarlos al menú de formato de v7. */
export function formatosParaElGenerador(designSet: DesignSetV0 | null): FormatoParaElGenerador[] {
  return formatosParaTrama(designSet).flatMap((f) =>
    f.valor.startsWith('adn:') && f.lienzo.tipo === 'medida'
      ? [{ clave: f.valor, valor: `${f.lienzo.ancho}x${f.lienzo.alto}`, etiqueta: f.etiqueta, lienzo: f.lienzo }]
      : [],
  );
}

/** ¿Es un mensaje del generador? Lo que no tenga su forma no se toma en cuenta. */
export function esMensajeDelGenerador(x: unknown): x is MensajeDelGenerador {
  if (typeof x !== 'object' || x === null) return false;
  const m = x as Record<string, unknown>;
  if (m['fuente'] !== FUENTE_DEL_GENERADOR) return false;
  if (m['tipo'] === 'listo') return true;
  return m['tipo'] === 'trama' && typeof m['pedido'] === 'number' && (typeof m['error'] === 'string' || (typeof m['trama'] === 'object' && m['trama'] !== null));
}

/**
 * Los parámetros del generador de tramas de Células Madre para la trama que
 * entregó v7: la receta manda (sus colores del ADN se vuelven a leer); los
 * demás quedan en la metadata para saber cómo se hizo.
 */
export function parametrosDeCelula(trama: Trama): Record<string, unknown> {
  return {
    receta: codificarTrama(trama),
    colores: Object.values(trama.color).some((c) => c.origen === 'adn') ? 'adn' : 'look',
    modo: trama.tiempo.modo,
    ancho: trama.lienzo.tipo === 'medida' ? Math.max(480, Math.min(4096, trama.lienzo.ancho)) : 1600,
  };
}

/** Los mensajes de `leerTrama`, para el diseñador: el primero (o los primeros) con su lugar. */
export function errorDeLectura(errores: ReadonlyArray<{ ruta: string; mensaje: string }>): string {
  const primeros = errores.slice(0, 3).map((x) => (x.ruta ? `${x.ruta}: ${x.mensaje}` : x.mensaje).replace(/\.+$/, ''));
  const mas = errores.length > 3 ? ` (y ${errores.length - 3} más)` : '';
  return `No se pudo leer la trama: ${primeros.join('; ')}${mas}.`;
}
