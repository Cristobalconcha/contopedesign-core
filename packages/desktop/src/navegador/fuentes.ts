/**
 * Cargar la muestra de una familia de Google Fonts en el documento, una sola
 * vez por familia y en lotes. Lo usan el selector de tipografías y las
 * primitivas de familia, para que un «Aa» se vea en la tipografía que dice
 * ser y no en la del sistema.
 */
import { buscarFamilia, urlDeMuestra } from '../dominio/catalogo.js';

const cargadas = new Set<string>();

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
