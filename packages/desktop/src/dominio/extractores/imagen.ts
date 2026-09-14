/**
 * Paleta dominante de una imagen, a partir de sus píxeles. Cuantiza cada
 * canal a 4 bits, cuenta las celdas, y va tomando las más pobladas que estén
 * a suficiente distancia de las ya elegidas. Es simple a propósito: da una
 * propuesta para MIRAR; el color que se adopta lo decide la persona.
 *
 * Decodificar la imagen (archivo → píxeles) es cosa del navegador, no de
 * este módulo, que sólo recibe el arreglo RGBA.
 */
import type { Candidato } from '../sistema.js';
import { aHex, distancia, esNeutro, type Rgb } from './color.js';

export function paletaDePixeles(pixeles: Uint8ClampedArray | Uint8Array, cuantos = 5): Rgb[] {
  const celdas = new Map<number, { n: number; r: number; g: number; b: number }>();
  const paso = Math.max(1, Math.floor(pixeles.length / 4 / 60_000)) * 4;
  for (let i = 0; i + 3 < pixeles.length; i += paso) {
    const a = pixeles[i + 3] ?? 0;
    if (a < 128) continue;
    const r = pixeles[i] ?? 0;
    const g = pixeles[i + 1] ?? 0;
    const b = pixeles[i + 2] ?? 0;
    const clave = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
    const c = celdas.get(clave);
    if (c) {
      c.n += 1;
      c.r += r;
      c.g += g;
      c.b += b;
    } else {
      celdas.set(clave, { n: 1, r, g, b });
    }
  }
  const ordenadas = [...celdas.values()]
    .sort((x, y) => y.n - x.n)
    .map((c) => ({ r: c.r / c.n, g: c.g / c.n, b: c.b / c.n }));
  const elegidas: Rgb[] = [];
  for (const c of ordenadas) {
    if (elegidas.every((e) => distancia(e, c) > 48)) elegidas.push(c);
    if (elegidas.length >= cuantos) break;
  }
  return elegidas;
}

export function candidatosDeImagen(paleta: ReadonlyArray<Rgb>, idBase: string, nombreImagen: string): Candidato[] {
  if (!paleta.length) return [];
  const institucionales: Array<{ name: string; value: string }> = [];
  const neutros: Array<{ name: string; value: string }> = [];
  paleta.forEach((rgb, i) => {
    const value = aHex(rgb);
    (esNeutro(rgb) ? neutros : institucionales).push({ name: `${nombreImagen} · color ${i + 1}`, value });
  });
  return [
    {
      id: `${idBase}-paleta`,
      requirementId: 'dim1.req01',
      etiqueta: 'Paleta dominante',
      detalle: `${paleta.length} colores extraídos de la imagen: una propuesta para mirar, no una medición de marca.`,
      muestra: { tipo: 'color', colores: paleta.map(aHex) },
      fragmento: { institucionales, neutros },
      estado: 'pendiente',
    },
  ];
}
