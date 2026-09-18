/**
 * Construcción: el editor visual sigue sin dibujar, a propósito (INTERFAZ.md
 * §4: «la pieza más grande, y no se dibuja sin conversarla»). Lo que sí hay
 * acá es real: el estado de cada dimensión, los encargos a ContOpe con su
 * estado, traer de vuelta lo que la IA propuso (primer dibujo, 18-09 por la
 * tarde), y los conflictos que la armonización tendrá que decidir.
 */
import { DIMENSIONES, NOMBRE_DIMENSION } from '../dominio/manifiesto.js';
import { leerPropuestas } from '../dominio/propuestas.js';
import { useTaller } from '../taller.js';

const NOMBRE_ESTADO: Record<string, string> = {
  active: 'encargada, sin propuesta todavía',
  proposed: 'con propuesta, esperando que la mires en Definición',
  resolved: 'resuelta: aprobaste una propuesta',
  rejected: 'rechazada: quitaste la propuesta',
};

export function Construccion() {
  const { sistema, evaluacion, ir, puente, despachar, avisar } = useTaller();
  const dims = DIMENSIONES.map((d) => ({ id: d, nombre: NOMBRE_DIMENSION[d] ?? d, ev: evaluacion.porDimension.get(d) }));

  const traerPropuestas = async (): Promise<void> => {
    try {
      const archivo = await puente.abrirPropuestas();
      if (archivo === null) return;
      const lectura = leerPropuestas(archivo.texto, sistema);
      if (!lectura.ok) {
        avisar(`No se trajo nada: ${lectura.motivo}`, 'error');
        return;
      }
      let traidas = 0;
      let enConflicto = 0;
      for (const p of lectura.archivo.propuestas) {
        const yaResuelta = sistema.designSet.entries.some(
          (e) => e.requirementId === p.requirementId && !(e.resolutionPath === 'contope' && e.cicloDeVida !== 'aprobada'),
        );
        if (yaResuelta) enConflicto++;
        else traidas++;
        despachar({ tipo: 'traer-propuesta', requirementId: p.requirementId, payload: p.payload, ...(p.nota !== undefined ? { nota: p.nota } : {}) });
      }
      const partes = [`${traidas} ${traidas === 1 ? 'propuesta traída' : 'propuestas traídas'} como propuesta de ContOpe`];
      if (enConflicto) partes.push(`${enConflicto} sobre preguntas ya resueltas: quedan como conflicto para la armonización`);
      avisar([...partes.map((t) => `${t}.`), ...lectura.avisos].join(' '));
    } catch (error) {
      avisar((error as Error).message, 'error');
    }
  };

  return (
    <section className="stub">
      <span className="marca-stub">Editor visual no dibujado todavía</span>
      <h2>Construcción</h2>
      <p>
        Cuando el núcleo esté resuelto, ContOpe construye lo que le quedó encargado y después se armoniza (la armonización ya
        tiene su primer dibujo, en la fase siguiente). El editor visual es la pieza más grande y no se dibuja sin
        conversarla. Mientras tanto, lo que sí existe:
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
              <span className="mono">{t.definitionId.replace(/\.def\d+$/, '')}</span> · {NOMBRE_ESTADO[t.state] ?? t.state}
              {t.state === 'active'
                ? t.constraintDefinitionIds.length
                  ? ` · restringida por ${t.constraintDefinitionIds.join(', ')}`
                  : ' · sin restricciones resueltas todavía'
                : ''}
            </li>
          ))}
        </ul>
      )}
      <p className="tenue">
        La IA que construye los encargos no vive dentro de este programa: se exporta la cápsula y la IA de escritorio la lee
        con el skill <span className="mono">leer-contrato-de-diseno</span>. Lo que proponga vuelve en un archivo{' '}
        <span className="mono">*.propuestas.json</span> (el skill dice cómo) y entra acá como propuesta: nada de lo que traiga
        pisa lo que una persona ya resolvió.
      </p>
      <p>
        <button className="btn fuerte" onClick={() => void traerPropuestas()} title="Un archivo *.propuestas.json hecho para este sistema">
          Traer propuestas de la IA…
        </button>
      </p>

      <h3>Conflictos de origen para la armonización</h3>
      {sistema.conflictos.length === 0 ? (
        <p className="tenue">Ninguno registrado.</p>
      ) : (
        <ul>
          {sistema.conflictos.map((c) => (
            <li key={c.id}>
              <span className="mono">{c.requirementId}</span> · segunda fuente:{' '}
              {c.insumoId === 'contope' ? 'ContOpe (propuesta)' : sistema.insumos.find((i) => i.id === c.insumoId)?.nombre ?? c.insumoId}
            </li>
          ))}
        </ul>
      )}

      <p style={{ marginTop: '1.5rem' }}>
        <button className="btn" onClick={() => ir('definicion')}>
          ← Volver a definición
        </button>
        <button className="btn" style={{ marginLeft: '0.5rem' }} onClick={() => ir('armonizacion')}>
          Ir a armonización →
        </button>
      </p>
    </section>
  );
}
