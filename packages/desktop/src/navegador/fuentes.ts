/**
 * Cargar tipografías de Google Fonts en el documento, una sola vez por
 * familia. `cargarMuestras` trae el peso regular, para que un «Aa» se vea en
 * la tipografía que dice ser y no en la del sistema; `cargarFamiliaCompleta`
 * trae todos los pesos y las itálicas, que es lo que el espécimen necesita
 * para desplegar una familia entera.
 */
import { buscarFamilia, urlDeFamiliaCompleta, urlDeMuestra, type FamiliaCatalogo } from '../dominio/catalogo.js';

const cargadas = new Set<string>();
const completas = new Set<string>();

export function cargarMuestras(nombres: ReadonlyArray<string>): void {
  const nuevas = nombres.filter((n) => !cargadas.has(n) && buscarFamilia(n) !== undefined);
  if (!nuevas.length) return;
  nuevas.forEach((n) => cargadas.add(n));
  for (let i = 0; i < nuevas.length; i += 8) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = urlDeMuestra(nuevas.slice(i, i + 8));
    document.head.appendChild(link);
  }
}

/** Carga todos los pesos (y sus itálicas) de una familia, una sola vez. */
export function cargarFamiliaCompleta(f: FamiliaCatalogo): void {
  if (completas.has(f.f)) return;
  completas.add(f.f);
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = urlDeFamiliaCompleta(f);
  document.head.appendChild(link);
}
