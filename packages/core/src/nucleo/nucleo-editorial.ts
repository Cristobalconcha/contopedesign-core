/**
 * El núcleo del mundo editorial impreso: folleto, revista, díptico, tríptico,
 * flyer, afiche. Cristóbal, 18-09: «para mí eso es un solo mundo, tiene una
 * misma lógica: colores, tamaños, tratamiento de fondos, tratamiento del
 * espacio, tratamiento de la tipografía».
 *
 * Se cerró midiendo tres cosas (vault, `nucleo-mundo-editorial-medicion-2026-09-18.md`):
 *
 * - **Fuente A**: lo que Claude Design define cuando le piden una pieza impresa
 *   (`print.md`, `craft.md`, el esquema de tokens de su Design System).
 * - **Fuente C**: el folleto real de Santa Luisa (12 páginas, IDML), que fue
 *   además la primera fuente de definiciones del propio Desktop.
 * - **Fuente D**: el inventario de definiciones de InDesign, leído de la
 *   estructura del paquete IDML.
 *
 * Las preguntas salen del cruce de las tres. Las reglas con número, en
 * cambio, salen de una sola base de conocimiento cada una y lo dicen: el
 * folleto real contradice casi todos los umbrales de impreso de Claude
 * Design (cuerpo 10 pt donde pide 12, notas 8 pt donde pide 9, filetes de
 * 0,25 pt donde pide 1 px) y se imprimió bien, porque Claude describe un
 * documento de oficina y el folleto es imprenta. Por eso esos umbrales van
 * **condicionados** a que el sistema declare soportar lo que Claude describe
 * (algún formato de contenido corrido) y no rigen sobre un sistema que sólo
 * soporta página fija. Lo que ninguna fuente cita con número —el filete
 * mínimo de imprenta, la resolución— no es regla.
 *
 * Vocabulario (Cristóbal, 18-09): ContOpe produce sistemas, no piezas. Las
 * preguntas hablan de lo que el sistema SOPORTA (formatos, estructuras,
 * lectura a distancia); la pieza la arma el destino con ese ADN. La
 * declaración inicial del sistema sólo sirve para acotar qué preguntas se le
 * exigen.
 */
import type { Operand, PathSegment, PredicateClause } from '../requirement-manifest/predicate.js';
import type { NucleoDeMundoV0 } from './types.js';

const p = (...parts: PathSegment[]): readonly PathSegment[] => parts;
const op = (...parts: PathSegment[]): Operand => ({ kind: 'path', path: parts });
const num = (value: number): Operand => ({ kind: 'number', value });
const str = (value: string): Operand => ({ kind: 'string', value });
const exists = (target: readonly PathSegment[]): PredicateClause => ({ kind: 'exists', target });
const each = (target: readonly PathSegment[], condition: PredicateClause): PredicateClause => ({ kind: 'each', target, condition });
const and = (...clauses: PredicateClause[]): PredicateClause => ({ kind: 'and', clauses });
const or = (...clauses: PredicateClause[]): PredicateClause => ({ kind: 'or', clauses });
const not = (clause: PredicateClause): PredicateClause => ({ kind: 'not', clause });
const eq = (left: Operand, right: Operand): PredicateClause => ({ kind: 'compare', op: '==', left, right });
const gte = (left: Operand, right: Operand): PredicateClause => ({ kind: 'compare', op: '>=', left, right });
const lte = (left: Operand, right: Operand): PredicateClause => ({ kind: 'compare', op: '<=', left, right });
const gteCss = (left: Operand, right: Operand): PredicateClause => ({ kind: 'compareCss', cssType: 'longitud-css', op: '>=', left, right });

/** Rige sólo cuando el sistema declara soportar algún formato de contenido corrido (dim3.req08). */
const SOLO_SI_SOPORTA_CONTENIDO_CORRIDO = { requisitoId: 'dim3.req08', ruta: ['formatos', '*', 'modo'], igualA: 'contenido-corrido' } as const;

export const NUCLEO_EDITORIAL: NucleoDeMundoV0 = {
  schemaVersion: 1,
  mundoId: 'editorial-impreso',
  nombre: 'Editorial impreso',
  fuente:
    'Cruce de tres fuentes medidas el 2026-09-18: las reglas de impreso de Claude Design (print.md, craft.md, tokens del Design System), el folleto real de Santa Luisa (12 páginas, IDML) y el inventario de definiciones de InDesign leído del paquete IDML',
  medidoEn: '2026-09-18',
  entradas: [
    // Color
    { requisitoId: 'dim1.req01', porque: 'El folleto define 15 muestras con nombre en rampas (dorado, oliva, tierra); Claude Design exige cada color con uso declarado.' },
    { requisitoId: 'dim1.req02', porque: 'Fondo, tinta, acento y superficies con rol: en el folleto cada estilo de párrafo apunta a un rol de color con nombre.' },
    { requisitoId: 'dim1.req04', porque: 'Las rampas 50/100/300/500/700 del folleto son rampas declaradas; Claude Design usa 21 pasos de gris cálido.' },
    { requisitoId: 'dim1.req05', porque: 'Superficies y figura-fondo: fondo entonado y texto casi negro sobre soporte claro (print.md, «Ink»).' },
    { requisitoId: 'dim1.req07', porque: 'El contraste con umbral es la única regla cromática con número en ambas fuentes.' },
    { requisitoId: 'dim1.req08', porque: 'Qué mezclas se permiten: nada de degradados de lavado (craft.md); el folleto arrastra un gradiente de plantilla sin uso.' },
    { requisitoId: 'dim1.req09', porque: 'Preponderancia por contexto: portada, interior y contraportada del folleto no reparten el color igual.' },
    { requisitoId: 'dim1.req14', porque: 'Perfil de salida y equivalencias por sistema: el folleto declara Coated FOGRA39 con la paleta definida en RGB; Hanta, muestras CMYK.' },
    // Tipografía
    { requisitoId: 'dim2.req01', porque: 'Familias con respaldo y licencia: Montserrat, Lora y Birthstone en el folleto; 1–3 familias en craft.md. InDesign lista las sustituidas y las faltantes.' },
    { requisitoId: 'dim2.req02', porque: '27 estilos de párrafo con nombre en el folleto (Hero, Section Title, Body, Quote, CTA…): los roles tipográficos con tamaño, peso e interlínea.' },
    { requisitoId: 'dim2.req03', porque: 'La escalera h1/h2/h3 tiene que distinguirse (print.md); el folleto la resuelve con 53, 22, 12,5 y 10 pt.' },
    { requisitoId: 'dim2.req04', porque: 'Medida, interlínea, alineación y espaciado de párrafo de la lectura prolongada: el cuerpo del folleto va justificado a 10 pt sobre 3 columnas.' },
    { requisitoId: 'dim2.req05', porque: 'Énfasis, números y tablas: 7 estilos de carácter y 9 estilos de tabla y celda en el folleto; print.md fija cabecera, filetes y números a la derecha.' },
    { requisitoId: 'dim2.req06', porque: 'Cómo cambian las reglas entre pantalla e impreso: el mismo sistema alimenta el sitio y el folleto.' },
    // Espacio
    { requisitoId: 'dim3.req01', porque: 'Unidad y escala: el folleto usa medianil de 6 mm y retícula base de 12 pt; Claude Design pide pasos de espacio con uso.' },
    { requisitoId: 'dim3.req02', porque: 'Los tres roles de distancia (dentro, entre elementos, entre secciones) son lo que InDesign expresa como espacio antes y después de párrafo y medianil.' },
    { requisitoId: 'dim3.req03', porque: 'Retícula base declarada (12 pt desde 36 pt en el folleto, oculta pero definida).' },
    { requisitoId: 'dim3.req04', porque: 'Retícula de columnas: 3 columnas con medianil de 17 pt en 15 de 16 páginas del folleto.' },
    { requisitoId: 'dim3.req05', porque: 'Contenedores con relación explícita con el soporte: márgenes de 20/20/15/10 mm en el folleto.' },
    { requisitoId: 'dim3.req08', porque: 'Los formatos que el sistema soporta: carta vertical en el folleto, A3 en Hanta; Claude Design: «nunca una hoja inventada».' },
    { requisitoId: 'dim3.req09', porque: 'Sangrado y zona segura por formato soportado: 5 mm uniforme en el folleto con el contenido dentro de los márgenes; Claude Design: fondos a sangre, contenido no.' },
    // Forma
    { requisitoId: 'dim4.req01', porque: 'Los roles geométricos los declara el set; el folleto tiene un estilo de objeto «Puntas redondeadas» de 2 mm de radio.' },
    { requisitoId: 'dim4.req02', porque: 'Radio de esquina por rol (2 mm en el folleto; radios con uso en el Design System de Claude).' },
    { requisitoId: 'dim4.req03', porque: 'Estilos de borde con filetes: 210 trazos de 1 pt y 21 líneas finas de 0,2–0,25 pt en el folleto; print.md los quiere de al menos 1 px.' },
    { requisitoId: 'dim4.req05', porque: 'Sombra, transparencia y mezcla como política: las tintas y transparencias que la imprenta acepta se declaran, no se improvisan.' },
    // Imagen
    { requisitoId: 'dim5.req02', porque: 'Roles de medio: 18 fotografías colocadas, iconografía en Material Symbols y una marca en el folleto.' },
    { requisitoId: 'dim5.req04', porque: 'Encuadre y relación imagen-texto: print.md pone las fotos como imagen, nunca como fondo, con alto máximo por página.' },
    { requisitoId: 'dim5.req05', porque: 'Tratamiento tonal consistente o la decisión de no aplicar ninguno.' },
    { requisitoId: 'dim5.req08', porque: 'Usos permitidos y prohibidos de la marca.' },
    { requisitoId: 'dim5.req09', porque: 'Resolución efectiva por rol: en el folleto va de 221 a 2.629 ppp; Hanta tenía «baja resolución efectiva para impresión exigente».' },
    // Composición
    { requisitoId: 'dim6.req01', porque: 'Pesos dominante/secundario/silencio y recorrido: el Hero de 53 pt del folleto contra el cuerpo de 10.' },
    { requisitoId: 'dim6.req02', porque: 'Agrupación: las cinco preguntas del flyer van agrupadas, no repartidas en prosa (print.md).' },
    { requisitoId: 'dim6.req04', porque: 'Secuencia y repetición: la maestra A del folleto repite folio y cabecera en cada página.' },
    { requisitoId: 'dim6.req06', porque: 'Flujo editorial: 12 páginas en 7 pliegos leídas en orden.' },
    { requisitoId: 'dim6.req08', porque: 'Las estructuras físicas que el sistema puede producir: caras, paneles, plegado y lo que se repite por hoja (maestras).' },
    { requisitoId: 'dim6.req09', porque: 'Cómo trata la dominante cuando el sistema soporta lectura a distancia (cartelería, afiche, flyer); «no soporta» escrito si no.' },
    // Interacción y movimiento: el impreso no los emite, pero la intención queda resuelta
    { requisitoId: 'dim7.req07', porque: 'El equivalente estático de cada interacción: el impreso no emite interacción (taxonomía §7: «un perfil estático puede no emitir interacción, pero la intención permanece resuelta»).' },
    { requisitoId: 'dim8.req07', porque: 'La versión estática del movimiento: cómo se comunican cambio y jerarquía sin animación.' },
    // Patrones
    { requisitoId: 'dim9.req01', porque: 'Los diez arquetipos con «no aplica» escrito: un folleto tiene secuencia editorial y tablas; un afiche, casi nada más que acción y contenedor.' },
    { requisitoId: 'dim9.req05', porque: 'Estados de contenido: overflow y faltante son lo que rompe una pieza impresa sin aviso (los saltos manuales de Hanta).' },
  ],
  reglas: [
    {
      id: 'editorial.contraste-4-5',
      requisitoId: 'dim1.req07',
      nombre: 'Contraste texto/superficie de al menos 4,5:1',
      cita: 'Claude Design, craft.md (Accessible as drawn): «Keep text at a contrast of at least 4.5:1 against what is behind it (3:1 from 24px)». Vale en las dos fuentes y en los dos mundos.',
      clausulas: [gte(op('contrast', 'umbral'), num(4.5))],
    },
    {
      id: 'editorial.cuerpo-documento-12pt',
      requisitoId: 'dim2.req02',
      nombre: 'En un documento corrido, el cuerpo va a 12 pt (16 px) o más, con interlínea entre 1,5 y 1,65',
      cita: 'Claude Design, print.md (Type, tables, ink): «body 16px (12pt) at line-height 1.5–1.65». Condicionada a que el sistema soporte contenido corrido: el folleto real de Santa Luisa (sólo página fija, imprenta) usa 10 pt y se imprimió bien.',
      condicion: SOLO_SI_SOPORTA_CONTENIDO_CORRIDO,
      clausulas: [
        each(
          p('roleStyles'),
          or(
            not(eq(op('role'), str('cuerpo'))),
            and(gteCss(op('fontSize'), str('16px')), gte(op('lineHeight'), num(1.5)), lte(op('lineHeight'), num(1.65))),
          ),
        ),
      ],
    },
    {
      id: 'editorial.notas-documento-9pt',
      requisitoId: 'dim2.req02',
      nombre: 'En un documento corrido, notas y leyendas van a 9 pt (12 px) o más',
      cita: 'Claude Design, print.md: «captions and footnotes ≥12px (9pt), nothing smaller». Condicionada: el folleto real usa 8 pt en placeholders y tablas.',
      condicion: SOLO_SI_SOPORTA_CONTENIDO_CORRIDO,
      clausulas: [
        each(
          p('roleStyles'),
          or(not(or(eq(op('role'), str('nota')), eq(op('role'), str('leyenda')))), gteCss(op('fontSize'), str('12px'))),
        ),
      ],
    },
    {
      id: 'editorial.medida-declarada',
      requisitoId: 'dim2.req04',
      nombre: 'Cada regla de lectura declara su medida (la guía es 60–75 caracteres)',
      cita: 'Claude Design, print.md: «measure 60–75 characters». El rango no se compara: `ch` no es unidad absoluta para compareCss; se exige que la medida exista.',
      clausulas: [each(p('reglas'), exists(p('measure')))],
    },
  ],
};
