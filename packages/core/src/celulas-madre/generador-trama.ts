/**
 * Generador 4 — Trama (decisión 36): la superficie de puntos como archivo.
 *
 * Core GENERA las tramas; Publisher sólo las reproduce. Este generador arma
 * la receta con `trama-del-adn.ts` y usa el motor único de `@contope/trama`
 * (nunca una copia) para el cuadro quieto. Entrega tres archivos, cada uno
 * con su virtud:
 *
 * - `<sistema>.trama.json`: el **archivo de trama**, vivo e interactivo (la
 *   lámina sigue al cursor), para subirlo a Publisher. Lleva la metadata de
 *   ancestro en `procedencia` y cada color dice de dónde viene.
 * - `<sistema>.trama.txt`: la misma trama como **código `CT1.`** de una
 *   línea, para pegarla (un atributo HTML, un campo de texto, el editor).
 * - `<sistema>.trama.svg`: el **cuadro quieto** del primer instante, vectorial,
 *   para imprenta o web, con la metadata en `<metadata>`.
 *
 * El video (formato cerrado: pierde la interacción) se graba en el escritorio,
 * en la pantalla de la trama, porque necesita un navegador que dibuje.
 *
 * Funciona sin ADN: `disponible` siempre dice que sí. Sin colores por rol,
 * usa los del look; sin formatos de hoja, uno fijo. Con una receta pegada (la
 * que deja el editor del escritorio), la receta manda; sus colores del ADN se
 * vuelven a leer con el ADN de hoy al regenerar.
 */
import { codificarTrama, cuadroEn, cuadroASvg, dimensionesDeLamina, escribirTrama, type ClaveDeColor, type Trama } from '@contope/trama';
import type { DesignSetV0 } from '../design-set/types.js';
import { baseDeNombre, cdata, escaparXml } from './comun.js';
import {
  armarTrama,
  coloresParaTrama,
  formatoPorDefecto,
  formatosParaTrama,
  LOOK_POR_DEFECTO,
  LOOKS_DE_TRAMA,
  medidaDeCuadro,
  requisitosDeTrama,
  tramaDeReceta,
} from './trama-del-adn.js';
import type { Generador, Parametros } from './tipos.js';

/** Largo máximo de la receta pegada (un código CT1 de una secuencia larga cabe holgado). */
export const LARGO_MAXIMO_DE_RECETA = 200_000;

const NOMBRE_DE_COLOR: Record<ClaveDeColor, string> = { lejos: 'Puntos lejanos', cerca: 'Puntos cercanos', fondo: 'Fondo' };

/**
 * La trama que corresponde a estos parámetros: la receta si la hay (con los
 * colores del ADN al día), o la armada con los controles. Lanza con un
 * mensaje en español si la receta no se puede leer.
 */
export function tramaDeParametros(designSet: DesignSetV0, parametros: Parametros, procedencia?: Record<string, unknown>): Trama {
  const receta = typeof parametros['receta'] === 'string' ? parametros['receta'].trim() : '';
  if (receta !== '') {
    const r = tramaDeReceta(receta, designSet);
    if (!r.ok) throw new Error(r.error);
    return procedencia ? { ...r.trama, procedencia } : r.trama;
  }
  const formato = Array.isArray(parametros['formato']) ? parametros['formato'][0] : undefined;
  return armarTrama(designSet, {
    look: typeof parametros['look'] === 'string' ? parametros['look'] : LOOK_POR_DEFECTO,
    semilla: typeof parametros['semilla'] === 'number' ? parametros['semilla'] : 6,
    modo: parametros['modo'] === 'secuencia' ? 'secuencia' : 'vivo',
    duracion: typeof parametros['duracion'] === 'number' ? parametros['duracion'] : 8,
    cerrarCiclo: parametros['cerrarCiclo'] !== false,
    coloresDelAdn: parametros['colores'] !== 'look',
    formato: formato ?? formatoPorDefecto(designSet),
    ...(procedencia ? { procedencia } : {}),
  });
}

/** Los colores de una trama, en palabras: «Fondo: #0b0f14, del ADN (rol background)». */
export function coloresEnPalabras(trama: Trama): string[] {
  return (['fondo', 'lejos', 'cerca'] as const).map((k) => {
    const c = trama.color[k];
    if (c.origen !== 'adn' || !c.rol) return `${NOMBRE_DE_COLOR[k]}: \`${c.hex}\`, propio (elegido a mano)`;
    const [requisito, ...resto] = c.rol.split(':');
    const donde = resto.length === 1 ? `rol «${resto[0] ?? ''}»` : `${resto[0] ?? ''} «${resto.slice(1).join(':')}»`;
    return `${NOMBRE_DE_COLOR[k]}: \`${c.hex}\`, del ADN (${donde}, \`${requisito ?? ''}\`)`;
  });
}

/** El cuadro quieto de una trama como SVG, con el motor de `@contope/trama`. */
export function svgDeTrama(trama: Trama, ancho: number, alto: number, t = trama.cuadroQuieto): string {
  const { cuadro, estado } = cuadroEn(trama, t, ancho, alto, 1);
  const cfg = estado.motor.configuracion;
  return cuadroASvg({
    cuadro,
    puntosPorLinea: dimensionesDeLamina(cfg, 1).puntos,
    ancho,
    alto,
    modo: estado.modo,
    tinta: estado.tinta,
    colores: estado.colores,
    opacidadPunto: cfg.opacidadPunto,
    grosorLinea: cfg.grosorLinea,
    opacidadLinea: cfg.opacidadLinea,
  });
}

function describirTiempo(trama: Trama): string {
  const t = trama.tiempo;
  if (t.modo === 'vivo') return `en vivo, sin final, desde el momento ${t.inicio}`;
  const escenas = t.escenas.length === 1 ? 'una escena' : `${t.escenas.length} escenas`;
  return `secuencia de ${t.duracion} s con ${escenas}${t.cerrarCiclo ? ', en ciclo cerrado (termina en la misma captura en que parte)' : ''}`;
}

export const generadorTrama: Generador = {
  id: 'trama',
  version: '1.0.0',
  nombre: 'Trama',
  descripcion:
    'La superficie de puntos de ContOpe: una lámina de puntos que se pliega y evoluciona, con los colores del sistema. Sale como archivo de trama vivo para Publisher, como código de una línea y como imagen quieta.',
  formato: '.trama.json · Publisher; .txt (código CT1); .svg · Illustrator, Figma, navegador',
  queLee: 'Los colores por rol (fondo, acento) y los institucionales; si eliges uno de sus formatos de hoja, el formato. Sin ADN, funciona igual con los colores del look.',
  lee: (designSet, parametros) => {
    try {
      return requisitosDeTrama(tramaDeParametros(designSet, parametros));
    } catch {
      return [];
    }
  },
  disponible: () => ({ ok: true }),
  parametros: [
    {
      id: 'look',
      tipo: 'opcion',
      etiqueta: 'Look',
      porDefecto: LOOK_POR_DEFECTO,
      opciones: LOOKS_DE_TRAMA.map((l) => ({ valor: l.id, etiqueta: l.nombre })),
    },
    {
      id: 'colores',
      tipo: 'opcion',
      etiqueta: 'Colores',
      ayuda: 'Del ADN: el fondo sale del rol «background» y los puntos del primer institucional y del rol «accent». Lo que el ADN no tenga sale del look.',
      porDefecto: 'adn',
      opciones: [
        { valor: 'adn', etiqueta: 'Del ADN, por rol' },
        { valor: 'look', etiqueta: 'Los del look' },
      ],
    },
    {
      id: 'formato',
      tipo: 'seleccion',
      etiqueta: 'Formato',
      ayuda: 'La proporción de la trama y la medida de la imagen quieta. Los formatos de hoja del ADN aparecen primero.',
      maximo: 1,
      porDefecto: (designSet) => [formatoPorDefecto(designSet)],
      opciones: (designSet) => formatosParaTrama(designSet).map((f) => ({ valor: f.valor, etiqueta: f.etiqueta })),
    },
    {
      id: 'semilla',
      tipo: 'numero',
      etiqueta: 'Semilla (momento de partida)',
      ayuda: 'El instante de la evolución en que parte la trama. El mismo número da siempre la misma imagen.',
      porDefecto: 6,
      min: 0,
      max: 200,
      paso: 0.5,
    },
    {
      id: 'modo',
      tipo: 'opcion',
      etiqueta: 'Tiempo',
      porDefecto: 'vivo',
      opciones: [
        { valor: 'vivo', etiqueta: 'En vivo: evoluciona sin final' },
        { valor: 'secuencia', etiqueta: 'Secuencia: dura lo que digas' },
      ],
    },
    {
      id: 'duracion',
      tipo: 'numero',
      etiqueta: 'Duración de la secuencia',
      ayuda: 'Sólo para la secuencia.',
      porDefecto: 8,
      min: 2,
      max: 120,
      paso: 1,
      unidad: ' s',
    },
    {
      id: 'cerrarCiclo',
      tipo: 'si-no',
      etiqueta: 'Cerrar el ciclo',
      ayuda: 'La secuencia termina en la misma captura en que parte, para que se repita sin costura.',
      porDefecto: true,
    },
    {
      id: 'ancho',
      tipo: 'numero',
      etiqueta: 'Ancho de la imagen quieta',
      ayuda: 'El alto sale de la proporción del formato.',
      porDefecto: 1600,
      min: 480,
      max: 4096,
      paso: 16,
      unidad: ' px',
    },
    {
      id: 'receta',
      tipo: 'texto',
      etiqueta: 'Receta (opcional)',
      ayuda: 'Un código CT1. o SP1., o un archivo de trama en JSON. Si la pegas, manda sobre los controles de arriba (salvo el ancho). La deja acá la pantalla de la trama.',
      porDefecto: '',
      largoMaximo: LARGO_MAXIMO_DE_RECETA,
    },
  ],
  comoUsar: [
    '**El archivo de trama (`.trama.json`)** es la trama viva: evoluciona sin final (o corre su secuencia) y, en vivo, la lámina se deforma con el cursor. ' +
      'En Publisher: en la parte de atrás del sitio, en el bloque o la portada que lleve la trama, sube este archivo (o pega el código del `.txt`). ' +
      'Publisher la reproduce con el mismo motor con que se hizo; con «reducir movimiento» activado, muestra el cuadro quieto.',
    '',
    '**El código (`.txt`)** es la misma trama en una sola línea, empezando con `CT1.`. Sirve para pegarla donde no se sube un archivo: un campo de texto, ' +
      'un atributo `data-cod-trama` en una página, o «Importar» en la pantalla de la trama de ContOpe para seguir editándola.',
    '',
    '**La imagen (`.svg`)** es el primer instante, quieto y vectorial: cada punto es un círculo. Ábrela en Illustrator o colócala en un documento; en Figma, arrástrala. ' +
      'Sirve para imprenta y para la web donde no corre la trama. No se mueve: para algo que se mueva sin Publisher, graba un video desde la pantalla de la trama (el video no sigue al cursor).',
  ].join('\n'),
  generar(designSet, parametros, contexto) {
    const { receta: _receta, ...sinReceta } = contexto.metadata.parametros;
    const procedencia = JSON.parse(JSON.stringify({ ...contexto.metadata, parametros: sinReceta })) as Record<string, unknown>;
    const base = tramaDeParametros(designSet, parametros, procedencia);
    const nombreSistema = contexto.sistema.nombre.trim() || 'Sistema';
    // El nombre y la procedencia arriba, para que se lean primero al abrir el archivo.
    const { kind, version, motor, nombre: nombreDado, procedencia: _p, ...resto } = base;
    const trama: Trama = { kind, version, motor, nombre: nombreDado ?? `${nombreSistema} · Trama`, procedencia, ...resto };
    const nombre = baseDeNombre(contexto.sistema.nombre);
    const ancho = typeof parametros['ancho'] === 'number' ? parametros['ancho'] : 1600;
    const medida = medidaDeCuadro(trama.lienzo, ancho);
    const svg = svgDeTrama(trama, medida.ancho, medida.alto);
    const cabecera =
      `<title>${escaparXml(trama.nombre ?? 'Trama')}</title>` +
      `<desc>Cuadro quieto (instante ${trama.cuadroQuieto} s) de una trama de ContOpe Design. La trama viva va en el archivo .trama.json.</desc>` +
      `<metadata id="contope-celula-madre">${cdata(JSON.stringify(contexto.metadata, null, 2))}</metadata>`;
    const inicio = svg.indexOf('>') + 1;
    const conMetadata = `<?xml version="1.0" encoding="UTF-8"?>\n${svg.slice(0, inicio)}${cabecera}${svg.slice(inicio)}\n`;
    const codigo = codificarTrama(trama);
    const colores = coloresEnPalabras(trama);
    const delAdn = coloresParaTrama(designSet).length > 0;
    return [
      {
        nombre: `${nombre}.trama.json`,
        tipoMime: 'application/json',
        contenido: escribirTrama(trama),
        detalle: `el archivo de trama, ${describirTiempo(trama)}; para Publisher`,
        anexo: {
          titulo: 'Colores y tiempo',
          texto: [
            ...colores.map((c) => `- ${c}`),
            '',
            delAdn
              ? 'Los colores «del ADN» se vuelven a leer al regenerar: si cambia el rol en el ADN, la trama cambia con él. Los propios no se tocan.'
              : 'El sistema todavía no define colores: la trama usa los del look. Cuando el ADN los tenga, regenérala para tomarlos.',
            '',
            `Tiempo: ${describirTiempo(trama)}. Una trama en vivo no tiene final; una secuencia se arma con capturas (escenas) y, si es circular, parte y termina en la misma.`,
          ].join('\n'),
        },
      },
      {
        nombre: `${nombre}.trama.txt`,
        tipoMime: 'text/plain',
        contenido: `${codigo}\n`,
        detalle: `la misma trama como código de una línea (${codigo.length} caracteres)`,
      },
      {
        nombre: `${nombre}.trama.svg`,
        tipoMime: 'image/svg+xml',
        contenido: conMetadata,
        detalle: `el primer instante, quieto, en ${medida.ancho} × ${medida.alto} px`,
      },
    ];
  },
};
