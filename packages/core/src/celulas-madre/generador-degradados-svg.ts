/**
 * Generador 2 — Degradados (`.svg`).
 *
 * Con los colores del ADN, en el orden que elija el diseñador, arma
 * degradados lineales o radiales: uno por cada par seguido, o uno solo que
 * pasa por todos. Escribe un SVG con los degradados definidos (`<defs>`) y
 * una lámina de muestra donde cada uno pinta una franja con su nombre. Al
 * abrirlo en Illustrator, cada degradado queda aplicado y se arrastra al panel
 * Muestras; en Figma o Inkscape, igual.
 *
 * Las paradas van en hex sRGB aunque el ADN diga oklch o hsl: no todos los
 * programas de diseño leen oklch en un SVG. El ángulo sigue la convención de
 * Illustrator: 0° de izquierda a derecha, 90° de abajo hacia arriba.
 *
 * La metadata de ancestro va dentro, en `<metadata>`, como JSON.
 */
import type { DesignSetV0 } from '../design-set/types.js';
import { coloresDeRampas, coloresDeRoles, coloresDelFundamento, rgbAHex, type ColorDelAdn } from './color-del-adn.js';
import { baseDeNombre, cdata, escaparXml } from './comun.js';
import type { Generador, Parametros } from './tipos.js';

function todosLosColores(designSet: DesignSetV0): ColorDelAdn[] {
  return [...coloresDelFundamento(designSet), ...coloresDeRoles(designSet), ...coloresDeRampas(designSet)];
}

/** Por defecto: los institucionales si hay dos o más; si no, todo el fundamento; si no, los dos primeros que haya. */
function coloresPorDefecto(designSet: DesignSetV0): string[] {
  const fundamento = coloresDelFundamento(designSet);
  const institucionales = fundamento.filter((c) => c.grupo === 'institucionales');
  if (institucionales.length >= 2) return institucionales.map((c) => c.clave);
  if (fundamento.length >= 2) return fundamento.map((c) => c.clave);
  return todosLosColores(designSet)
    .slice(0, 2)
    .map((c) => c.clave);
}

function elegidos(designSet: DesignSetV0, parametros: Parametros): ColorDelAdn[] {
  const todos = new Map(todosLosColores(designSet).map((c) => [c.clave, c]));
  const claves = Array.isArray(parametros['colores']) ? parametros['colores'] : [];
  return claves.flatMap((k) => {
    const c = todos.get(k);
    return c ? [c] : [];
  });
}

/** Un id XML válido y legible (Illustrator lo usa como nombre de la muestra). */
function idDe(nombre: string, usados: Set<string>): string {
  const base = `degradado-${baseDeNombre(nombre)}`;
  let id = base;
  for (let n = 2; usados.has(id); n++) id = `${base}-${n}`;
  usados.add(id);
  return id;
}

const r4 = (v: number): string => String(Math.round(v * 10000) / 10000);

export const generadorDegradadosSvg: Generador = {
  id: 'degradados-svg',
  version: '1.0.0',
  nombre: 'Degradados',
  descripcion:
    'Degradados hechos con los colores del sistema, en el orden que elijas, con una lámina de muestra. Cada degradado queda aplicado a una franja con su nombre, listo para tomarlo.',
  formato: '.svg · Illustrator, Figma, Inkscape, navegador',
  lee: (designSet, parametros) => [...new Set(elegidos(designSet, parametros).map((c) => c.requirementId))].sort(),
  disponible(designSet) {
    if (todosLosColores(designSet).length >= 2) return { ok: true };
    return {
      ok: false,
      falta: 'Un degradado necesita al menos dos colores: define el fundamento cromático (o los colores por rol) en Definición › Color y superficies.',
    };
  },
  parametros: [
    {
      id: 'colores',
      tipo: 'seleccion',
      etiqueta: 'Colores, en orden',
      ayuda: 'El degradado recorre los colores en el orden en que los marcas. Sin marcar, se usan los institucionales.',
      ordenada: true,
      porDefecto: coloresPorDefecto,
      opciones: (designSet) => todosLosColores(designSet).map((c) => ({ valor: c.clave, etiqueta: `${c.nombre} · ${c.etiquetaGrupo}`, muestra: c.css })),
    },
    {
      id: 'modo',
      tipo: 'opcion',
      etiqueta: 'Cómo se arman',
      porDefecto: 'pares',
      opciones: [
        { valor: 'pares', etiqueta: 'Uno por cada par seguido (A→B, B→C…)' },
        { valor: 'secuencia', etiqueta: 'Uno solo que pasa por todos' },
      ],
    },
    {
      id: 'forma',
      tipo: 'opcion',
      etiqueta: 'Forma',
      porDefecto: 'lineal',
      opciones: [
        { valor: 'lineal', etiqueta: 'Lineal' },
        { valor: 'radial', etiqueta: 'Radial (desde el centro)' },
      ],
    },
    {
      id: 'angulo',
      tipo: 'numero',
      etiqueta: 'Ángulo',
      ayuda: 'Como en Illustrator: 0° va de izquierda a derecha; 90°, de abajo hacia arriba. Los radiales no lo usan.',
      porDefecto: 0,
      min: 0,
      max: 360,
      paso: 15,
      unidad: '°',
    },
  ],
  generar(designSet, parametros, contexto) {
    const colores = elegidos(designSet, parametros);
    if (colores.length < 2) throw new Error('Elige al menos dos colores para armar un degradado.');
    const tramos: ColorDelAdn[][] =
      parametros['modo'] === 'secuencia' ? [colores] : colores.slice(1).map((c, i) => [colores[i] as ColorDelAdn, c]);
    const radial = parametros['forma'] === 'radial';
    const angulo = typeof parametros['angulo'] === 'number' ? parametros['angulo'] : 0;
    const rad = (angulo * Math.PI) / 180;
    const [x1, y1, x2, y2] = [0.5 - Math.cos(rad) / 2, 0.5 + Math.sin(rad) / 2, 0.5 + Math.cos(rad) / 2, 0.5 - Math.sin(rad) / 2];

    const ancho = 960;
    const margen = 48;
    const alto = 120;
    const separacion = 64;
    const cabecera = 96;
    const usados = new Set<string>();
    const defs: string[] = [];
    const lamina: string[] = [];
    tramos.forEach((tramo, i) => {
      const nombre = tramo.map((c) => c.nombre).join(' → ');
      const id = idDe(tramo.map((c) => c.nombre).join(' a '), usados);
      const paradas = tramo
        .map((c, k) => `      <stop offset="${r4(tramo.length === 1 ? 0 : k / (tramo.length - 1))}" stop-color="${rgbAHex(c.rgb)}"/>`)
        .join('\n');
      defs.push(
        radial
          ? `    <radialGradient id="${id}" cx="0.5" cy="0.5" r="0.5">\n${paradas}\n    </radialGradient>`
          : `    <linearGradient id="${id}" x1="${r4(x1)}" y1="${r4(y1)}" x2="${r4(x2)}" y2="${r4(y2)}">\n${paradas}\n    </linearGradient>`,
      );
      const y = cabecera + i * (alto + separacion);
      lamina.push(
        `  <rect x="${margen}" y="${y}" width="${ancho - margen * 2}" height="${alto}" fill="url(#${id})"/>`,
        `  <text x="${margen}" y="${y + alto + 22}" class="nombre">${escaparXml(nombre)}</text>`,
      );
    });
    const altoTotal = cabecera + tramos.length * (alto + separacion);
    const titulo = `${contexto.sistema.nombre.trim() || 'Sistema'} · Degradados`;
    const svg = [
      '<?xml version="1.0" encoding="UTF-8"?>',
      `<svg xmlns="http://www.w3.org/2000/svg" width="${ancho}" height="${altoTotal}" viewBox="0 0 ${ancho} ${altoTotal}">`,
      `  <title>${escaparXml(titulo)}</title>`,
      `  <metadata id="contope-celula-madre">${cdata(JSON.stringify(contexto.metadata, null, 2))}</metadata>`,
      '  <style>text{font-family:Archivo,Helvetica,Arial,sans-serif;fill:#1a1f23}.titulo{font-size:22px;font-weight:700}.pie{font-size:12px;fill:#6b7478}.nombre{font-size:14px}</style>',
      '  <defs>',
      ...defs,
      '  </defs>',
      `  <rect width="${ancho}" height="${altoTotal}" fill="#ffffff"/>`,
      `  <text x="${margen}" y="52" class="titulo">${escaparXml(titulo)}</text>`,
      `  <text x="${margen}" y="74" class="pie">Hecho por ContOpe Design desde el ADN del sistema. De dónde viene: ver la metadata de este archivo.</text>`,
      ...lamina,
      '</svg>',
      '',
    ].join('\n');
    return [{ nombre: `${baseDeNombre(contexto.sistema.nombre)}-degradados.svg`, tipoMime: 'image/svg+xml', contenido: svg }];
  },
};
