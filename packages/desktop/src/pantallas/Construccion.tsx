/**
 * Construcción: el editor visual sigue sin dibujar, a propósito (INTERFAZ.md
 * §4: «la pieza más grande, y no se dibuja sin conversarla»). Lo que sí hay
 * acá es real: el estado de cada dimensión, los encargos a ContOpe con su
 * estado, traer de vuelta lo que la IA propuso (primer dibujo, 18-09 por la
 * tarde), y los conflictos que la armonización tendrá que decidir.
 */
import { DIMENSIONES, NOMBRE_DIMENSION } from '../dominio/manifiesto.js';
import { useState } from 'react';
import { encargosDe, jsonDePropuestas, promptDeEncargo } from '../dominio/encargo.js';
import { leerPropuestas } from '../dominio/propuestas.js';
import { useTaller } from '../taller.js';

const NOMBRE_ESTADO: Record<string, string> = {
  active: 'encargada, sin propuesta todavía',
  proposed: 'con propuesta, esperando que la mires en Definición',
  resolved: 'resuelta: aprobaste una propuesta',
  rejected: 'rechazada: quitaste la propuesta',
};

export function Construccion() {
  const { sistema, evaluacion, ir, puente, despachar, avisar, configurarIA } = useTaller();
  const dims = DIMENSIONES.map((d) => ({ id: d, nombre: NOMBRE_DIMENSION[d] ?? d, ev: evaluacion.porDimension.get(d) }));
  const [pidiendo, setPidiendo] = useState(false);
  const encargos = encargosDe(sistema);

  /** Lo que la IA devolvió (por la vía que sea) entra por la misma puerta: validar, y despachar una por una. */
  const traerJson = (json: string, origen: string): void => {
    const lectura = leerPropuestas(json, sistema);
    if (!lectura.ok) {
      avisar(`${origen}: ${lectura.motivo}`, 'error');
      return;
    }
    let traidas = 0;
    let enConflicto = 0;
    for (const p of lectura.archivo.propuestas) {
      const yaResuelta = sistema.designSet.entries.some(
        (e) => e.requirementId === p.requirementId && !(e.resolutionPath === 'contope' && e.cicloDeVida === 'propuesta'),
      );
      if (yaResuelta) enConflicto++;
      else traidas++;
      despachar({ tipo: 'traer-propuesta', requirementId: p.requirementId, payload: p.payload, ...(p.nota !== undefined ? { nota: p.nota } : {}) });
    }
    const partes = [`${traidas} ${traidas === 1 ? 'propuesta traída' : 'propuestas traídas'} como propuesta de ContOpe`];
    if (enConflicto) partes.push(`${enConflicto} sobre preguntas ya resueltas: quedan como conflicto para la armonización`);
    avisar([...partes.map((t) => `${t}.`), ...lectura.avisos].join(' '));
  };

  const pedirAContope = async (): Promise<void> => {
    const estado = await puente.ia.estado();
    const activo = estado.configuracion.proveedores.find((p) => p.id === estado.configuracion.activo);
    if (!activo) {
      avisar('No hay un proveedor de IA en uso: configúralo en «IA del taller».', 'error');
      return;
    }
    const mensajes = promptDeEncargo(sistema, evaluacion);
    if (mensajes === null) {
      avisar('No hay encargos a ContOpe: asigna preguntas con el camino «ContOpe» en Definición.');
      return;
    }
    setPidiendo(true);
    try {
      const r = await puente.ia.pedir(activo.id, mensajes);
      if (!r.ok) {
        avisar(r.motivo, 'error');
        return;
      }
      const json = jsonDePropuestas(r.texto, sistema);
      if (!json.ok) {
        avisar(`${activo.nombre} no devolvió propuestas legibles: ${json.motivo}`, 'error');
        return;
      }
      traerJson(json.json, activo.nombre);
    } catch (error) {
      avisar((error as Error).message, 'error');
    } finally {
      setPidiendo(false);
    }
  };

  const traerPropuestas = async (): Promise<void> => {
    try {
      const archivo = await puente.abrirPropuestas();
      if (archivo === null) return;
      traerJson(archivo.texto, 'El archivo');
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
        La IA que resuelve estos encargos es la del taller: vive en este programa, con el modelo que configures en «IA del
        taller», y trabaja con la base de conocimiento propia (el núcleo del mundo con sus reglas, lo ya definido, las
        cortapisas). Lo que proponga entra como propuesta: nada pisa lo que una persona ya resolvió.
      </p>
      <p className="caminos">
        <button className="btn fuerte" disabled={pidiendo || encargos.length === 0} onClick={() => void pedirAContope()} title={encargos.length ? `Pedir propuestas para ${encargos.join(', ')}` : 'No hay encargos'}>
          {pidiendo ? 'Pidiendo…' : `Pedir a ContOpe${encargos.length ? ` (${encargos.length})` : ''}`}
        </button>
        <button className="btn" onClick={configurarIA}>
          IA del taller…
        </button>
        <button className="btn chico" onClick={() => void traerPropuestas()} title="Vía de prueba: un archivo *.propuestas.json hecho para este sistema">
          Traer desde un archivo…
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
