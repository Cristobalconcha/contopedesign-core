/**
 * «Qué dice la Biblia»: las entradas de la Biblia del diseño que tocan a una
 * pregunta en el mundo del sistema, plegadas. Es la misma búsqueda que va al
 * prompt de encargo (`dominio/biblia.ts`, `entradasPertinentes`), mostrada para
 * que el diseñador vea lo que ContOpe va a usar y pueda aprender de ello: el
 * enunciado, la fuerza para este tipo de producto, «para aprender» y el estado
 * del tema (lo «por revisar» todavía no lo aprueba el dueño).
 */
import { entradasPertinentes, NOMBRE_ESTADO, NOMBRE_FUERZA, recortar } from '../dominio/biblia.js';
import type { MundoId } from '../dominio/mundos.js';

export function QueDiceLaBiblia({ mundo, requirementId }: { mundo: MundoId; requirementId: string }) {
  const entradas = entradasPertinentes(mundo, [requirementId]);
  if (entradas.length === 0) return null;
  return (
    <details className="expl biblia">
      <summary>
        <b>Qué dice la Biblia</b> · {entradas.length} {entradas.length === 1 ? 'entrada' : 'entradas'}
      </summary>
      {entradas.map(({ entrada, filas }) => (
        <div key={entrada.id} className="biblia-entrada">
          <span className="id">
            {entrada.id} · {entrada.tema.titulo} · <i className="et">{NOMBRE_ESTADO[entrada.tema.estado]}</i>
          </span>
          <p>
            <b>{entrada.titulo}.</b> {recortar(entrada.enunciado, 600)}
          </p>
          <ul>
            {filas.map((f, i) => (
              <li key={i}>
                <b>{f.etiqueta}</b>: {f.fuerzas.map((x) => NOMBRE_FUERZA[x]).join(' + ')} — {recortar(f.texto, 240)}
              </li>
            ))}
          </ul>
          {entrada.paraAprender ? (
            <p>
              <b>Para aprender.</b> {recortar(entrada.paraAprender, 900)}
            </p>
          ) : null}
        </div>
      ))}
    </details>
  );
}
