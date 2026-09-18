/**
 * El núcleo del mundo de campaña (difusión, redes, piezas de marketing).
 *
 * Medido el 18-09-2026 sobre las piezas para redes que salieron del sitio de
 * Santa Luisa de Palpi (17 y 18 de septiembre; vault y memoria
 * `reference_piezas_para_redes_desde_el_sitio`), más la referencia de marca
 * de Claude Design que separa las escalas «para marketing, láminas y
 * gráficos» de las de interfaz:
 *
 * - **Formatos**: post vertical 1080×1350, cuadrado 1080×1080, historia y
 *   reel 1080×1920. «Instagram no pasa de 1080 de ancho: ése es el piso y el
 *   techo» (medido). Una campaña es un sistema de formatos declarados, no una
 *   pieza.
 * - **Resolución**: el video de la familia de la portada sale de un lienzo de
 *   1280×720 y a 1080 de ancho «ya no alcanza: se ve blanda, y ninguna
 *   exportación lo arregla». La resolución mínima por medio no es un detalle
 *   técnico: decide qué medio puede entrar a la campaña.
 * - **Variantes**: la misma composición se exporta como una pantalla por
 *   pieza («una pieza es una pantalla», «un rollo de 440×10.718 no sirve para
 *   nada»), en tres proporciones. El sistema de variantes y la adaptación
 *   entre formatos son lo que hace que las piezas sean de la misma campaña.
 * - **Lectura rápida**: en el feed se lee a distancia y en un segundo; la
 *   línea dominante y sus cinco preguntas (dim6.req09) valen acá igual que
 *   en el afiche.
 *
 * Reglas con número: el contraste (compartido) y el ancho mínimo de 1080 px
 * para todo formato con medida declarada, que es lo único que se midió con
 * cifra. Las zonas seguras de las interfaces de redes no tienen cita medida
 * y por eso son pregunta, no regla.
 */
import type { Operand, PathSegment, PredicateClause } from '../requirement-manifest/predicate.js';
import type { NucleoDeMundoV0 } from './types.js';

const p = (...parts: PathSegment[]): readonly PathSegment[] => parts;
const op = (...parts: PathSegment[]): Operand => ({ kind: 'path', path: parts });
const num = (value: number): Operand => ({ kind: 'number', value });
const str = (value: string): Operand => ({ kind: 'string', value });
const each = (target: readonly PathSegment[], condition: PredicateClause): PredicateClause => ({ kind: 'each', target, condition });
const or = (...clauses: PredicateClause[]): PredicateClause => ({ kind: 'or', clauses });
const not = (clause: PredicateClause): PredicateClause => ({ kind: 'not', clause });
const eq = (left: Operand, right: Operand): PredicateClause => ({ kind: 'compare', op: '==', left, right });
const gte = (left: Operand, right: Operand): PredicateClause => ({ kind: 'compare', op: '>=', left, right });
const gteCss = (left: Operand, right: Operand): PredicateClause => ({ kind: 'compareCss', cssType: 'longitud-css', op: '>=', left, right });

export const NUCLEO_CAMPANA: NucleoDeMundoV0 = {
  schemaVersion: 1,
  mundoId: 'campana',
  nombre: 'Campaña',
  fuente:
    'Las piezas para redes de Santa Luisa de Palpi exportadas del sitio (post 1080×1350, cuadrado 1080×1080, historia 1080×1920; el techo de 1080 de Instagram; el video de portada de 1280×720 que no alcanza), medidas el 17 y 18 de septiembre de 2026, y la referencia de marca de Claude Design (escalas para marketing distintas de las de interfaz).',
  medidoEn: '2026-09-18',
  entradas: [
    {
      requisitoId: 'dim1.req02',
      roles: ['accent', 'text', 'background'],
      porque:
        'Las piezas salieron del sitio con su acento, su tinta y su superficie; una campaña sin esos tres roles se pinta con lo que trae la plantilla de la red.',
    },
    {
      requisitoId: 'dim1.req07',
      porque:
        'Una pieza de feed se mira en un teléfono al sol; el contraste texto/superficie es la regla con número que las fuentes comparten.',
    },
    {
      requisitoId: 'dim2.req02',
      roles: ['título', 'cuerpo'],
      porque:
        'Las piezas llevan un titular y un cuerpo corto; con esos dos roles resueltos la campaña habla con la voz de la marca.',
    },
    {
      requisitoId: 'dim3.req08',
      porque:
        'Una campaña es un sistema de formatos: post vertical, cuadrado, historia. Cada uno con medida declarada en píxeles y orientación; Instagram no pasa de 1080 de ancho.',
    },
    {
      requisitoId: 'dim3.req09',
      porque:
        'Cada formato de red tapa una parte de la pieza con su propia interfaz (nombre de cuenta arriba, botones abajo); la zona segura por formato es lo que evita que el titular quede debajo de un botón. Sin cita medida: es pregunta, no regla.',
    },
    {
      requisitoId: 'dim5.req02',
      roles: ['fotografia', 'marcas'],
      porque:
        'Las piezas de Santa Luisa son fotografía más logotipo; el tratamiento de esos dos medios es lo mínimo que la campaña declara.',
    },
    {
      requisitoId: 'dim5.req09',
      porque:
        'El video de la familia (1280×720) no alcanza para 1080 de ancho y ninguna exportación lo arregla: la resolución mínima por medio decide qué entra a la campaña y qué se rehace.',
    },
    {
      requisitoId: 'dim6.req07',
      porque:
        'La misma composición se adapta a tres proporciones; cómo cambia la composición entre formatos es lo que hace que sean piezas de una misma campaña y no tres piezas.',
    },
    {
      requisitoId: 'dim6.req09',
      porque:
        'En el feed se lee a distancia y en un segundo: la línea dominante, su máximo de palabras y su tamaño mínimo valen acá como en el afiche.',
    },
    {
      requisitoId: 'dim9.req03',
      porque:
        'Una campaña es variantes de un mismo patrón (post, historia, reel; hoy, mañana, con y sin precio); de qué definición hereda cada variante y qué cambia es la pregunta que la mantiene coherente.',
    },
  ],
  reglas: [
    {
      id: 'campana.contraste-4-5',
      requisitoId: 'dim1.req07',
      nombre: 'Contraste texto/superficie de al menos 4,5:1',
      cita: 'Claude Design, craft.md (Accessible as drawn): «Keep text at a contrast of at least 4.5:1 against what is behind it (3:1 from 24px)». La misma regla de los otros mundos.',
      clausulas: [gte(op('contrast', 'umbral'), num(4.5))],
    },
    {
      id: 'campana.ancho-minimo-1080',
      requisitoId: 'dim3.req08',
      nombre: 'Todo formato con medida declarada tiene al menos 1080 px de ancho',
      cita: 'Medido el 2026-09-17 al exportar las piezas de Santa Luisa: «Instagram no pasa de 1080 de ancho: ése es el piso y el techo» (post 1080×1350, cuadrado 1080×1080, historia 1080×1920). Un formato de hoja cerrada (carta, A4) no se compara: la regla es para medidas declaradas en píxeles.',
      clausulas: [
        each(p('formatos'), or(not(eq(op('formato'), str('medida-declarada'))), gteCss(op('medida', 'ancho'), str('1080px')))),
      ],
    },
  ],
};
