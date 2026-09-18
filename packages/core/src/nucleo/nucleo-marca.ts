/**
 * El núcleo del mundo de marca (identidad, envase, etiqueta, aplicaciones).
 *
 * Medido el 18-09-2026 sobre dos fuentes, y con una ausencia dicha:
 *
 * - **Fuente C**: la identidad real de Santa Luisa de Palpi, leída del IDML del
 *   folleto (paleta de tres familias con cinco pasos cada una: dorado, oliva,
 *   tierra; tres tipografías con roles cerrados: Birthstone sólo para el
 *   titular héroe, Montserrat para todo lo demás, Lora sólo para citas; y el
 *   logotipo como vector en el sitio), que es la misma identidad que hoy rige
 *   el sitio y las piezas de redes.
 * - **Fuente A**: cómo declara un manual de marca sus reglas, leído de las
 *   referencias de marca de Claude Design (`brand-colors.md`,
 *   `brand-typography.md`): dos colores de base (fondo y tinta), UN color de
 *   énfasis, secundarios para ilustración y no para la interfaz, una rampa de
 *   grises cálidos y nunca neutros de otra temperatura, bordes derivados de la
 *   tinta y nunca de color; en tipografía, familias con su pila de fallbacks,
 *   una escala por roles con tamaño, peso e interlínea, pesos moderados y
 *   sin tracking.
 * - **Sin pieza de packaging real que medir.** No hay envase ni etiqueta de
 *   Santa Luisa; por eso este núcleo es de MARCA y no dice nada de packaging
 *   que no pueda citar. Cuando exista una pieza real se mide, como se hizo con
 *   el folleto.
 *
 * Lo que distingue a una marca de un sitio o de un folleto es que sus
 * definiciones tienen que **viajar**: reproducirse en pantalla, en imprenta y
 * en escala de grises con el mismo color (dim1.req14), decir qué está
 * permitido y prohibido hacer con ella (dim5.req08), y declarar qué tan fija es
 * cada voz tipográfica (dim2.req08). Por eso esas tres preguntas están acá y
 * no en los otros núcleos.
 *
 * Reglas con número: sólo el contraste tiene cita numérica en las fuentes.
 * Lo demás son preguntas que no pueden quedar sin responder, no umbrales.
 */
import type { Operand, PathSegment, PredicateClause } from '../requirement-manifest/predicate.js';
import type { NucleoDeMundoV0 } from './types.js';

const op = (...parts: PathSegment[]): Operand => ({ kind: 'path', path: parts });
const num = (value: number): Operand => ({ kind: 'number', value });
const gte = (left: Operand, right: Operand): PredicateClause => ({ kind: 'compare', op: '>=', left, right });

export const NUCLEO_MARCA: NucleoDeMundoV0 = {
  schemaVersion: 1,
  mundoId: 'marca',
  nombre: 'Marca',
  fuente:
    'La identidad real de Santa Luisa de Palpi (IDML del folleto: paleta de tres familias por cinco pasos, tres tipografías con roles cerrados, logotipo vectorial) y las referencias de marca de Claude Design (brand-colors.md, brand-typography.md), medidas el 2026-09-18. Sin pieza de packaging real: el núcleo es de marca.',
  medidoEn: '2026-09-18',
  entradas: [
    {
      requisitoId: 'dim1.req01',
      porque:
        'Santa Luisa declara dorado y oliva como institucionales y tierra como neutro; Claude Design parte de dos colores de base (fondo y tinta). Sin el fundamento con procedencia no hay marca que reproducir.',
    },
    {
      requisitoId: 'dim1.req04',
      porque:
        'Cada familia de Santa Luisa trae cinco pasos (50, 100, 300, 500, 600/700); Claude Design trae una rampa de 21 grises cálidos. Una marca sin rampas no puede bajar a fondos ni subir a tintas sin inventar colores.',
    },
    {
      requisitoId: 'dim1.req02',
      roles: ['accent', 'text', 'background'],
      porque:
        'Claude Design: fondo (Ivory), tinta (Slate) y UN color de énfasis (Clay). Son los mismos tres roles del núcleo web, porque una marca tiene que poder aterrizar en un sitio sin traducción.',
    },
    {
      requisitoId: 'dim1.req03',
      porque:
        'Claude Design: «the single emphasis color». En Santa Luisa el dorado-600 es el único color de acción y de héroe. Un acento duplicado es una marca que se contradice.',
    },
    {
      requisitoId: 'dim1.req08',
      porque:
        'Claude Design prohíbe con nombre: nunca bordes de color para estructura, nunca grises de otra temperatura, los secundarios nunca en la interfaz. Lo permitido y lo prohibido es lo que hace que la marca se sostenga cuando la aplica otro.',
    },
    {
      requisitoId: 'dim1.req07',
      porque:
        'La única regla con número que las fuentes comparten: el contraste texto/superficie. Una marca que se lee en el folleto y no en el sitio no es una marca.',
    },
    {
      requisitoId: 'dim1.req14',
      porque:
        'La marca se reproduce en más de un sistema: el folleto va en CMYK y el sitio en hexadecimal, y la lectura monocroma se verifica. Sin equivalencias por sistema, cada destino inventa su verde.',
    },
    {
      requisitoId: 'dim2.req01',
      porque:
        'Claude Design escribe cada familia con su pila de fallbacks y avisa que sin la fuente instalada rinde el fallback; Santa Luisa usa tres familias de Google con licencia abierta. La marca declara familias, fallbacks y licencia, o no viaja.',
    },
    {
      requisitoId: 'dim2.req02',
      roles: ['título', 'cuerpo'],
      porque:
        'Santa Luisa: Birthstone sólo en el titular héroe, Montserrat en todo lo demás, Lora sólo en citas; Claude Design: serif en títulos y sans en cuerpo, con una escala de roles. Títulos y cuerpo son el mínimo que toda aplicación de la marca necesita.',
    },
    {
      requisitoId: 'dim2.req08',
      porque:
        'Que Birthstone vaya sólo en el héroe no es un gusto: es una voz inamovible de la marca. Claude Design lo dice a su manera (pesos moderados, nunca negrita falsa, sin tracking). La fuerza de cada voz es lo que impide que el destino la sustituya.',
    },
    {
      requisitoId: 'dim5.req02',
      roles: ['marcas', 'simbolos'],
      porque:
        'El logotipo y los símbolos son los medios que sólo la marca posee; en Santa Luisa el logotipo viaja como vector desde el sitio hasta las piezas de redes. Sin su tratamiento declarado, cada aplicación lo trata distinto.',
    },
    {
      requisitoId: 'dim5.req08',
      porque:
        'Los usos permitidos y prohibidos de marca son el corazón de un manual: qué se puede hacer con el logotipo y qué no, con exclusiones que atan al resto de la dimensión.',
    },
    {
      requisitoId: 'dim5.req09',
      porque:
        'Un logotipo en vector no tiene resolución mínima y hay que decirlo; una fotografía de marca sí. La marca declara la resolución de cada medio al tamaño de salida, o el destino la pixela (medido el 17-09 con el video de la portada, 1280×720, que no alcanza para redes).',
    },
  ],
  reglas: [
    {
      id: 'marca.contraste-4-5',
      requisitoId: 'dim1.req07',
      nombre: 'Contraste texto/superficie de al menos 4,5:1',
      cita: 'Claude Design, craft.md (Accessible as drawn): «Keep text at a contrast of at least 4.5:1 against what is behind it (3:1 from 24px)». Es la misma regla de los mundos web y editorial: la pregunta es compartida y el número es de la base de conocimiento.',
      clausulas: [gte(op('contrast', 'umbral'), num(4.5))],
    },
  ],
};
