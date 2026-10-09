/**
 * El `.zip` en que baja cada Célula Madre (decisión 35, «Cómo se entrega»):
 * los archivos generados, en su formato, y su `LEEME.md`.
 *
 * Usa `fflate` (puro, sin `node:fs` ni DOM, sin dependencias). El zip es
 * DETERMINISTA: la fecha de cada entrada se inyecta (la de la generación), el
 * orden es el de la lista y la compresión es fija, así que el mismo contenido
 * da los mismos bytes.
 */
import { zipSync, type Zippable } from 'fflate';
import { baseDeNombre } from './comun.js';
import { utf8 } from './huella.js';
import type { ArchivoGenerado, Generador, SistemaDeOrigen } from './tipos.js';

/** Una entrada del zip: su ruta adentro (con `/` para las carpetas) y su contenido. */
export interface EntradaDeZip {
  ruta: string;
  contenido: Uint8Array | string;
}

/**
 * La fecha de las entradas. El formato zip guarda la hora «local» sin zona
 * (fecha DOS) y `fflate` la lee con los métodos locales de `Date`: para que
 * los bytes no dependan del huso del computador, se arma una fecha local con
 * las cifras UTC de `iso`. Fuera de 1980–2099 (lo que cabe en DOS), se acota.
 */
function fechaDeEntrada(iso: string): Date {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) throw new Error(`Fecha no válida para el zip: «${iso}»`);
  const anio = Math.min(2099, Math.max(1980, d.getUTCFullYear()));
  return new Date(anio, d.getUTCMonth(), d.getUTCDate(), d.getUTCHours(), d.getUTCMinutes(), d.getUTCSeconds());
}

function rutaValida(ruta: string): boolean {
  if (ruta === '' || ruta.startsWith('/') || ruta.includes('\\') || ruta.endsWith('/')) return false;
  return ruta.split('/').every((parte) => parte !== '' && parte !== '.' && parte !== '..');
}

/** Arma el zip. `fecha` (ISO) es la de todas las entradas. Rutas relativas, sin `..` ni repetidas. */
export function armarZip(entradas: readonly EntradaDeZip[], fecha: string): Uint8Array {
  const mtime = fechaDeEntrada(fecha);
  const archivos: Zippable = {};
  const vistas = new Set<string>();
  for (const e of entradas) {
    if (!rutaValida(e.ruta)) throw new Error(`Ruta no permitida dentro del zip: «${e.ruta}»`);
    if (vistas.has(e.ruta)) throw new Error(`Ruta repetida dentro del zip: «${e.ruta}»`);
    vistas.add(e.ruta);
    archivos[e.ruta] = [typeof e.contenido === 'string' ? utf8(e.contenido) : e.contenido, { mtime, level: 9 }];
  }
  return zipSync(archivos, { mtime, level: 9 });
}

/** Lo que hace falta para empaquetar una generación: sus archivos y su `LEEME.md`. */
export interface CelulaParaEmpaquetar {
  archivos: readonly ArchivoGenerado[];
  leeme: ArchivoGenerado;
}

/**
 * Las entradas de una Célula Madre: el `LEEME.md` primero y luego los
 * archivos. Con `carpeta`, van dentro de ella (así entran en el zip del ADN).
 */
export function entradasDeCelula(celula: CelulaParaEmpaquetar, carpeta = ''): EntradaDeZip[] {
  const prefijo = carpeta === '' ? '' : `${carpeta.replace(/\/+$/, '')}/`;
  return [celula.leeme, ...celula.archivos].map((a) => ({ ruta: `${prefijo}${a.nombre}`, contenido: a.contenido }));
}

/** `econut-paleta-ase`: el nombre del zip sin extensión, y el de su carpeta en el zip del ADN. */
export function nombreDePaquete(sistema: Pick<SistemaDeOrigen, 'nombre'>, generador: Pick<Generador, 'id'>): string {
  return `${baseDeNombre(sistema.nombre)}-${baseDeNombre(generador.id)}`;
}

/** El `.zip` de una generación (`econut-paleta-ase.zip`), con la fecha de la generación en sus entradas. */
export function zipDeCelula(
  celula: CelulaParaEmpaquetar,
  entrada: { sistema: Pick<SistemaDeOrigen, 'nombre'>; generador: Pick<Generador, 'id'>; generadoEn: string },
): ArchivoGenerado & { contenido: Uint8Array } {
  return {
    nombre: `${nombreDePaquete(entrada.sistema, entrada.generador)}.zip`,
    tipoMime: 'application/zip',
    contenido: armarZip(entradasDeCelula(celula), entrada.generadoEn),
  };
}
