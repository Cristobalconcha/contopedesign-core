/**
 * El núcleo del mundo web, escrito como preguntas del manifiesto más sus
 * reglas.
 *
 * Cristóbal lo cerró el 2026-09-16 midiendo el sitio real de Santa Luisa:
 * «si yo puedo tener el sitio web ahora como se ve, no tengo ninguna variable
 * de WordPress apareciendo, quiere decir que me basta con esas definiciones».
 * Son ocho roles, no ocho valores, y viven en el plugin
 * (`contope-publisher/includes/class-cod-design-core.php`, `roles()`): tres
 * colores (acento, tinta, superficie), dos tipografías (títulos, cuerpo), una
 * medida (el ancho de la caja de lectura) y, desde el 2026-09-17, dos
 * movimientos (aparecer, responder).
 *
 * Este archivo es la misma lista dicha en ids de requisito. La
 * correspondencia rol→requisito es lectura del integrador (18-09) y va
 * escrita en cada `porque`; donde el rol del plugin no se llama igual que el
 * del manifiesto (ink → text; surface → background/surface), se dice.
 *
 * La regla del contraste sale de la base de conocimiento de Claude Design
 * (`craft.md`: «Text 4.5:1 (3:1 at 24px+)»), la misma que rige el impreso: es
 * el ejemplo de que la pregunta es compartida y el número es de la base de
 * conocimiento, no del manifiesto.
 */
import type { Operand, PathSegment, PredicateClause } from '../requirement-manifest/predicate.js';
import type { NucleoDeMundoV0 } from './types.js';

const op = (...parts: PathSegment[]): Operand => ({ kind: 'path', path: parts });
const num = (value: number): Operand => ({ kind: 'number', value });
const gte = (left: Operand, right: Operand): PredicateClause => ({ kind: 'compare', op: '>=', left, right });

export const NUCLEO_WEB: NucleoDeMundoV0 = {
  schemaVersion: 1,
  mundoId: 'web',
  nombre: 'Web',
  fuente:
    'El sitio real de Santa Luisa de Palpi sobre el plugin ContOpe (COD_Design_Core::roles(), 8 roles), medido el 2026-09-16 y el 2026-09-17; la regla de contraste, de craft.md de Claude Design',
  medidoEn: '2026-09-17',
  entradas: [
    {
      requisitoId: 'dim1.req02',
      roles: ['accent', 'text', 'background'],
      porque:
        'Sin acento, tinta y superficie el plugin pintaba el azul del panel de WordPress y el resultado «parecía decidido». El plugin los llama accent, ink y surface; en los 13 roles del manifiesto son accent, text y background/surface.',
    },
    {
      requisitoId: 'dim1.req07',
      porque:
        'El contraste texto/superficie es la única regla que la base de conocimiento fija con número para pantalla; sin la pareja verificada el sitio puede pintarse con roles que no se leen.',
    },
    {
      requisitoId: 'dim2.req02',
      roles: ['título', 'cuerpo'],
      porque:
        'Títulos y cuerpo son las dos tipografías que el tema declara (heading, body); sin ellas el sitio cae en la del tema por omisión.',
    },
    {
      requisitoId: 'dim2.req04',
      porque:
        'El ancho de la caja de lectura (measure, --cod-layout-max-width) es la única medida del núcleo web; en el manifiesto es la medida de los roles de lectura prolongada.',
    },
    {
      requisitoId: 'dim8.req02',
      roles: ['entrada', 'feedback'],
      porque:
        'Aparecer (enter, 420–500 ms) y responder (response, 160–200 ms) se calibran contra cosas distintas —la vista y la mano— y el primer sitio real necesitó los dos; corresponden a los roles entrada y feedback (guía C2 de dim8.req02, propuesta, no equivalencia demostrada).',
    },
  ],
  reglas: [
    {
      id: 'web.contraste-4-5',
      requisitoId: 'dim1.req07',
      nombre: 'Contraste texto/superficie de al menos 4,5:1',
      cita: 'Claude Design, craft.md (Accessible as drawn): «Keep text at a contrast of at least 4.5:1 against what is behind it (3:1 from 24px)». El umbral que el set declara en dim1.req07 no puede quedar por debajo.',
      clausulas: [gte(op('contrast', 'umbral'), num(4.5))],
    },
  ],
};
