/**
 * Consultar la Biblia: una búsqueda por tema, tipo de producto y estado, sin
 * juicio en tiempo de uso (spec de tipos de producto §5.2). Función pura: no
 * decide qué fuerza gana ni resume; devuelve lo que el capítulo dice, filtrado.
 */
import { BIBLIA } from './datos.js';
import type { BibliaGenerada, ConsultaBiblia, EntradaConsultada } from './tipos.js';

/**
 * Las entradas que responden a la consulta, en el orden de la Biblia (tema y
 * número de entrada). Con `tipos`, cada entrada trae sólo las filas de fuerza
 * que nombran alguno de esos tipos, y se omiten las que se quedan sin filas
 * (las entradas cuya fuerza es sólo prosa, `notaFuerza`, no entran en una
 * consulta por tipo). Las filas «no aplica» se devuelven: filtrarlas es cosa
 * de quien presenta.
 *
 * `biblia` es para las pruebas; por omisión, los datos compilados.
 */
export function consultarBiblia(consulta: ConsultaBiblia = {}, biblia: BibliaGenerada = BIBLIA): EntradaConsultada[] {
  const temas = consulta.temas ? new Set(consulta.temas) : null;
  const estados = consulta.soloEstados ? new Set(consulta.soloEstados) : null;
  const tipos = consulta.tipos ? new Set(consulta.tipos) : null;

  const salida: EntradaConsultada[] = [];
  for (const tema of biblia.temas) {
    if (temas && !temas.has(tema.numero)) continue;
    if (estados && !estados.has(tema.estado)) continue;
    const { numero, slug, titulo, estado } = tema;
    for (const entrada of tema.entradas) {
      const fuerzas = entrada.fuerzas.filter((f) => !tipos || f.tipos.some((t) => tipos.has(t)));
      if (tipos && fuerzas.length === 0) continue;
      salida.push({ ...entrada, fuerzas, tema: { numero, slug, titulo, estado } });
    }
  }
  return salida;
}
