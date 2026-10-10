/**
 * Un cuadro como SVG vectorial, con los mismos puntos y tramos: `toSVG` de
 * v7. Las líneas van debajo (grupo `lineas`), los puntos encima (grupo
 * `puntos`, 48 subgrupos por tono y nivel de alfa). La acumulación de luz o
 * tinta se escribe como `mix-blend-mode` (screen o multiply).
 *
 * Los colores llegan validados como `#rrggbb` (el formato lo exige), así que
 * nada de lo que se interpola en el texto puede inyectar marcado.
 */
import { alfaDeNivel, modoDeTinta, tonosPorProfundidad, type TintaElegida } from './color.js';
import { conLineas, conPuntos, type ModoDeDibujo } from './modo.js';
import { grupoDePunto, OPACIDAD_MINIMA_PUNTOS, recorrerPuntos } from './puntos.js';
import { tramosDeLinea } from './tramos.js';

export interface EntradaSvg {
  cuadro: ArrayLike<number>;
  /** Puntos por línea con que se calculó el cuadro (`dimensionesDeLamina(...).puntos`). */
  puntosPorLinea: number;
  ancho: number;
  alto: number;
  modo: ModoDeDibujo;
  tinta: TintaElegida;
  colores: { lejos: string; cerca: string; fondo: string };
  opacidadPunto: number;
  grosorLinea: number;
  opacidadLinea: number;
}

export function cuadroASvg(e: EntradaSvg): string {
  const { cuadro, ancho: W, alto: H } = e;
  const cols = tonosPorProfundidad(e.colores.lejos, e.colores.cerca);
  let body = '';
  if (conLineas(e.modo)) { // capa de líneas (debajo)
    let ls = '';
    for (const tr of tramosDeLinea(cuadro, e.puntosPorLinea, e)) {
      let d = '', pen = false;
      for (let q = tr.inicio; q <= tr.fin; q += 5) {
        if (cuadro[q + 2] === 0) { pen = false; continue; }
        d += (pen ? 'L' : 'M') + cuadro[q]!.toFixed(1) + ' ' + cuadro[q + 1]!.toFixed(1);
        pen = true;
      }
      if (d) ls += `<path d="${d}" stroke="rgb(${cols[tr.tono]!.join(',')})" stroke-opacity="${Math.min(1, tr.alfa).toFixed(3)}" stroke-width="${tr.grosor.toFixed(2)}"/>`;
    }
    if (ls) body += `<g id="lineas" fill="none" stroke-linecap="round" stroke-linejoin="round">${ls}</g>`;
  }
  if (conPuntos(e.modo) && e.opacidadPunto > OPACIDAD_MINIMA_PUNTOS) { // capa de puntos (encima)
    const grupos: string[][] = Array.from({ length: 48 }, () => []);
    recorrerPuntos(cuadro, e.opacidadPunto, (k, tono, nivel) => {
      grupos[grupoDePunto(tono, nivel)]!.push(`<circle cx="${cuadro[k]!.toFixed(1)}" cy="${cuadro[k + 1]!.toFixed(1)}" r="${cuadro[k + 2]!.toFixed(2)}"/>`);
    });
    let ds = '';
    grupos.forEach((g, gi) => {
      if (g.length) ds += `<g fill="rgb(${cols[Math.floor(gi / 4)]!.join(',')})" fill-opacity="${alfaDeNivel(gi % 4)}">${g.join('')}</g>`;
    });
    if (ds) body += `<g id="puntos">${ds}</g>`;
  }
  const mezcla = modoDeTinta(e.tinta, e.colores.fondo) === 'tinta' ? 'multiply' : 'screen';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><style>circle,path{mix-blend-mode:${mezcla}}</style><rect width="${W}" height="${H}" fill="${e.colores.fondo || '#000000'}"/>${body}</svg>`;
}
