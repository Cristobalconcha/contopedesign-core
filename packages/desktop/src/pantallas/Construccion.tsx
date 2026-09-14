/**
 * Construcción y armonización: sin dibujar, a propósito (INTERFAZ.md §4:
 * «la pieza más grande, y no se dibuja sin conversarla»). Lo que sí hay
 * acá es real: el estado de cada dimensión, los encargos que esperan a
 * ContOpe y los conflictos que la armonización tendrá que decidir.
 */
import { DIMENSIONES, NOMBRE_DIMENSION } from '../dominio/manifiesto.js';
import { useTaller } from '../taller.js';

export function Construccion() {
  const { sistema, evaluacion, ir } = useTaller();
  const dims = DIMENSIONES.map((d) => ({ id: d, nombre: NOMBRE_DIMENSION[d] ?? d, ev: evaluacion.porDimension.get(d) }));

  return (
    <section className="stub">
      <span className="marca-stub">No dibujado todavía</span>
      <h2>Construcción y armonización</h2>
      <p>
        Cuando el núcleo esté resuelto, ContOpe construye lo que le quedó encargado y después se armoniza: el catálogo
        propio, mirado junto, para señalar las disonancias. Es la pieza más grande y no se dibuja sin conversarla. Mientras
        tanto, lo que sí existe:
      </p>

      <h3>Estado por dimensión</h3>
      <table className="tabla">
        <tbody>
          {dims.map((d) => (
            <tr key={d.id}>
              <td>{d.nombre}</td>
              <td className="mono">
                {d.ev?.contador.resueltos ?? 0} / {d.ev?.contador.activos ?? 0}
              </td>
              <td className={d.ev?.resultado === 'resuelto' ? 'ok' : 'tenue'}>{d.ev?.resultado === 'resuelto' ? 'resuelta · se puede armonizar' : 'no resuelta'}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h3>Encargos a ContOpe</h3>
      {sistema.tareas.length === 0 ? (
        <p className="tenue">Ninguno. Se encargan desde Definición, con el camino «ContOpe».</p>
      ) : (
        <ul>
          {sistema.tareas.map((t) => (
            <li key={t.id}>
              <span className="mono">{t.definitionId.replace(/\.def\d+$/, '')}</span> · {t.state}
              {t.constraintDefinitionIds.length ? ` · restringido por ${t.constraintDefinitionIds.join(', ')}` : ' · sin restricciones resueltas todavía'}
            </li>
          ))}
        </ul>
      )}
      <p className="tenue">
        La IA que construye los encargos no vive dentro de este programa: se exporta la cápsula y la IA de escritorio la lee
        con el skill <span className="mono">leer-contrato-de-diseno</span>. Traer sus propuestas de vuelta a este archivo todavía
        no está construido.
      </p>

      <h3>Conflictos de origen para la armonización</h3>
      {sistema.conflictos.length === 0 ? (
        <p className="tenue">Ninguno registrado.</p>
      ) : (
        <ul>
          {sistema.conflictos.map((c) => (
            <li key={c.id}>
              <span className="mono">{c.requirementId}</span> · segunda fuente: {sistema.insumos.find((i) => i.id === c.insumoId)?.nombre ?? c.insumoId}
            </li>
          ))}
        </ul>
      )}

      <p style={{ marginTop: '1.5rem' }}>
        <button className="btn" onClick={() => ir('definicion')}>
          ← Volver a definición
        </button>
      </p>
    </section>
  );
}
