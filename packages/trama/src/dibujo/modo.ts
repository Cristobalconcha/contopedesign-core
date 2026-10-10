/**
 * Modo de dibujo: puntos, líneas o ambos superpuestos (en mixto, las líneas
 * van debajo). Las capturas, presets y códigos anteriores a v7 guardaban
 * `dotted` (sí/no); `modoDe` los lee igual que `modeOf` de v7.
 */

export type ModoDeDibujo = 'puntos' | 'lineas' | 'mixto';
export const MODOS: readonly ModoDeDibujo[] = ['puntos', 'lineas', 'mixto'];

export function esModo(x: unknown): x is ModoDeDibujo {
  return typeof x === 'string' && (MODOS as readonly string[]).includes(x);
}

/**
 * Lee un modo de cualquier forma que haya tenido: el texto, un booleano
 * (`dotted`), o un objeto con `render` (v7), `modo` (este paquete) o
 * `dotted` (capturas viejas).
 */
export function modoDe(o: unknown, porDefecto: ModoDeDibujo = 'puntos'): ModoDeDibujo {
  if (o == null) return porDefecto;
  if (typeof o === 'string') return esModo(o) ? o : porDefecto;
  if (typeof o === 'boolean') return o ? 'puntos' : 'lineas';
  if (typeof o !== 'object') return porDefecto;
  const r = o as { render?: unknown; modo?: unknown; dotted?: unknown };
  if (esModo(r.render)) return r.render;
  if (esModo(r.modo)) return r.modo;
  if (r.dotted === false) return 'lineas';
  if (r.dotted === true) return 'puntos';
  return porDefecto;
}

/** ¿Se dibujan puntos en este modo? */
export const conPuntos = (m: ModoDeDibujo): boolean => m !== 'lineas';
/** ¿Se dibujan líneas en este modo? */
export const conLineas = (m: ModoDeDibujo): boolean => m !== 'puntos';
