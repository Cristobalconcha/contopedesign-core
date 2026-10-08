/**
 * Generador 1 — Paleta de color (`.ase`).
 *
 * Lee los colores del ADN y escribe un Adobe Swatch Exchange con un grupo por
 * familia (institucionales, neutros, roles, cada rampa, imprenta). El nombre de
 * cada grupo lleva la referencia corta al sistema («Econut · ContOpe ·
 * Institucionales»), porque el `.ase` no tiene otro lugar donde decir de dónde
 * viene: la metadata completa va en el `.contope.json` hermano.
 *
 * Las muestras son GLOBALES: al cambiar una en Illustrator o InDesign cambian
 * todos los objetos que la usan, que es lo que se espera de una paleta de
 * sistema.
 *
 * Criterio sobre imprenta (dim1.req14), decidido sin preguntar:
 * - CMYK: SÍ, cuando el ADN declara la equivalencia con cuatro números. Va en
 *   su propio grupo, como muestra de cuatricromía global, con el nombre del
 *   color y «CMYK». Es la definición de imprenta del sistema; convertir el RGB
 *   a CMYK acá sería inventarla.
 * - Pantone (tinta plana): NO. El ADN guarda el nombre de la tinta, no sus
 *   valores de biblioteca, y una muestra plana necesita valores: poner los del
 *   RGB o el CMYK haría pasar una aproximación por la tinta. Quien imprime la
 *   carga desde la biblioteca Pantone de su programa.
 * - Escala de grises: no, por ahora; es una prueba de lectura, no una tinta.
 */
import type { DesignSetV0 } from '../design-set/types.js';
import { escribirAse, type GrupoAse } from './ase.js';
import { coloresDeRampas, coloresDeRoles, coloresDelFundamento, equivalenciasCmyk, type ColorDelAdn } from './color-del-adn.js';
import { baseDeNombre } from './comun.js';
import type { Generador, Parametros } from './tipos.js';

function coloresElegidos(designSet: DesignSetV0, parametros: Parametros): ColorDelAdn[] {
  return [
    ...coloresDelFundamento(designSet),
    ...(parametros['incluirRoles'] === false ? [] : coloresDeRoles(designSet)),
    ...(parametros['incluirRampas'] === false ? [] : coloresDeRampas(designSet)),
  ];
}

export const generadorPaletaAse: Generador = {
  id: 'paleta-ase',
  version: '1.0.0',
  nombre: 'Paleta de color',
  descripcion:
    'Las muestras de color del sistema, cada una con su nombre, agrupadas por familia. Se carga en el panel Muestras y queda lista para usar.',
  formato: '.ase · Illustrator, InDesign, Photoshop',
  lee: (_designSet, parametros) => [
    'dim1.req01',
    ...(parametros['incluirRoles'] === false ? [] : ['dim1.req02']),
    ...(parametros['incluirRampas'] === false ? [] : ['dim1.req04']),
    ...(parametros['incluirImprenta'] === false ? [] : ['dim1.req14']),
  ],
  disponible(designSet) {
    if (coloresDelFundamento(designSet).length > 0 || coloresDeRoles(designSet).length > 0) return { ok: true };
    return {
      ok: false,
      falta: 'Define primero los colores del sistema: en Definición › Color y superficies, el fundamento cromático (colores institucionales y neutros).',
    };
  },
  parametros: [
    { id: 'incluirRoles', tipo: 'si-no', etiqueta: 'Incluir los colores por rol', ayuda: 'Fondo, texto, acento…: una muestra por rol, con el rol como nombre.', porDefecto: true },
    { id: 'incluirRampas', tipo: 'si-no', etiqueta: 'Incluir las rampas', ayuda: 'Cada paso de cada rampa, en un grupo por rampa.', porDefecto: true },
    {
      id: 'incluirImprenta',
      tipo: 'si-no',
      etiqueta: 'Incluir las equivalencias CMYK',
      ayuda: 'Las que el sistema declara para imprenta, como muestras de cuatricromía. Los Pantone no van: el sistema guarda su nombre, no sus valores.',
      porDefecto: true,
    },
  ],
  generar(designSet, parametros, contexto) {
    const prefijo = `${contexto.sistema.nombre.trim() || 'Sistema'} · ContOpe`;
    const grupos: GrupoAse[] = [];
    const porGrupo = new Map<string, ColorDelAdn[]>();
    for (const c of coloresElegidos(designSet, parametros)) {
      const lista = porGrupo.get(c.etiquetaGrupo) ?? [];
      lista.push(c);
      porGrupo.set(c.etiquetaGrupo, lista);
    }
    for (const [etiqueta, colores] of porGrupo) {
      grupos.push({
        nombre: `${prefijo} · ${etiqueta}`,
        muestras: colores.map((c) => ({ nombre: c.nombre, modelo: 'RGB', valores: [c.rgb.r / 255, c.rgb.g / 255, c.rgb.b / 255], tipo: 'global' })),
      });
    }
    const cmyk = parametros['incluirImprenta'] === false ? [] : equivalenciasCmyk(designSet);
    if (cmyk.length) {
      grupos.push({
        nombre: `${prefijo} · Imprenta CMYK`,
        muestras: cmyk.map((c) => ({ nombre: `${c.nombre} CMYK`, modelo: 'CMYK', valores: c.cmyk, tipo: 'global' })),
      });
    }
    return [{ nombre: `${baseDeNombre(contexto.sistema.nombre)}-paleta.ase`, tipoMime: 'application/octet-stream', contenido: escribirAse(grupos) }];
  },
};
