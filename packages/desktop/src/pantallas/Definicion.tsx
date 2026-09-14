/**
 * Definición (INTERFAZ.md §3, pendiente de revisión): el núcleo, con lo que
 * ya viene resuelto desde los insumos y lo que falta. Cada pendiente ofrece
 * los tres caminos: Insumo · Diseñador · ContOpe. La completitud la calcula
 * el evaluador del núcleo, requisito por requisito, con sus motivos.
 */
import { findEntry, type Fuerza } from '@contope/core';
import { useState } from 'react';
import { Primitiva } from '../componentes/Primitiva.js';
import { EXPLICACIONES } from '../dominio/explicaciones.js';
import { DIMENSIONES, NOMBRE_DIMENSION, REQUISITOS, dependientesDe } from '../dominio/manifiesto.js';
import { mundo as mundoDe } from '../dominio/mundos.js';
import { muestraDePayload } from '../dominio/primitivas.js';
import { instrumentoPara } from '../instrumentos/index.js';
import { useTaller } from '../taller.js';

const FUERZAS: Array<[Fuerza, string]> = [
  ['inamovible', 'Inamovible'],
  ['prioritaria', 'Prioritaria'],
  ['explorable', 'Explorable'],
];

const NOMBRE_CAMINO = { insumo: 'insumo', diseñador: 'diseñador', contope: 'ContOpe' } as const;

export function Definicion() {
  const { sistema, evaluacion, despachar, abrir, ir } = useTaller();
  const [abiertas, setAbiertas] = useState<Set<string>>(new Set());
  const [aprobando, setAprobando] = useState<string | null>(null);

  const entradas = sistema.designSet.entries;
  const cuenta = {
    insumo: entradas.filter((e) => e.resolutionPath === 'insumo').length,
    disenador: entradas.filter((e) => e.resolutionPath === 'diseñador').length,
    contope: entradas.filter((e) => e.resolutionPath === 'contope').length,
    encargados: sistema.tareas.filter((t) => t.state === 'active').length,
  };
  const sinNada = REQUISITOS.filter((r) => !findEntry(sistema.designSet, r.id) && !sistema.caminos[r.id]).length;
  const todasAbiertas = REQUISITOS.every((r) => abiertas.has(r.id));

  const alternarTodas = (): void => {
    setAbiertas(todasAbiertas ? new Set() : new Set(REQUISITOS.map((r) => r.id)));
  };
  const alternar = (id: string): void => {
    const s = new Set(abiertas);
    if (s.has(id)) s.delete(id);
    else s.add(id);
    setAbiertas(s);
  };

  return (
    <>
      <section className="def">
        <div className="def-cab">
          <div>
            <h2 className="tit">El núcleo, y quién resuelve lo que falta</h2>
            <p className="desde" style={{ margin: '.2rem 0 0' }}>
              Mundo {mundoDe(sistema.mundo).nombre.toLowerCase()} · {evaluacion.total} requisitos · la completitud es binaria ·{' '}
              <a className="enlace" onClick={alternarTodas}>
                {todasAbiertas ? 'ocultar las explicaciones' : 'explicar todas'}
              </a>
            </p>
          </div>
          <div className="cuentas">
            <div className="cuenta-g">
              <b style={{ color: 'var(--ok)' }}>{evaluacion.resueltos}</b>
              <span>resueltos</span>
            </div>
            <div className="cuenta-g">
              <b style={{ color: 'var(--acero)' }}>{cuenta.insumo}</b>
              <span>desde insumos</span>
            </div>
            <div className="cuenta-g">
              <b style={{ color: 'var(--bronce)' }}>{cuenta.disenador}</b>
              <span>del diseñador</span>
            </div>
            <div className="cuenta-g">
              <b style={{ color: 'var(--ia)' }}>{cuenta.encargados}</b>
              <span>encargados</span>
            </div>
            <div className="cuenta-g">
              <b>{sinNada}</b>
              <span>sin camino</span>
            </div>
          </div>
        </div>

        {DIMENSIONES.map((dim) => {
          const reqs = REQUISITOS.filter((r) => r.dimensionId === dim);
          const ev = evaluacion.porDimension.get(dim);
          return (
            <div className="dim" key={dim}>
              <h3>
                {NOMBRE_DIMENSION[dim] ?? dim}{' '}
                <em>
                  {ev?.contador.resueltos ?? 0} de {reqs.length} resueltos
                </em>
                {ev?.resultado === 'resuelto' ? <span className="dim-ok">dimensión resuelta</span> : null}
              </h3>
              {reqs.map((r) => {
                const entrada = findEntry(sistema.designSet, r.id);
                const resultado = evaluacion.porRequisito.get(r.id);
                const resuelto = resultado?.resultado === 'resuelto';
                const camino = sistema.caminos[r.id];
                const tarea = sistema.tareas.find((t) => t.definitionId.startsWith(`${r.id}.`) && t.state === 'active');
                const conflictos = sistema.conflictos.filter((c) => c.requirementId === r.id);
                const instrumento = instrumentoPara(r.id);
                const muestra = muestraDePayload(sistema.designSet, r.id);
                const abierta = abiertas.has(r.id);
                const dependientes = dependientesDe(r.id);
                const motivosPropios = (resultado?.motivos ?? []).filter((m) => !m.codigo.startsWith('dependencia-'));
                const motivosDeps = (resultado?.motivos ?? []).filter((m) => m.codigo.startsWith('dependencia-'));

                return (
                  <div key={r.id} className={`rq ${entrada ? (resuelto ? 'ya' : 'incompleta') : ''}`}>
                    <Primitiva muestra={muestra} />
                    <div className="q">
                      <span className="id">
                        {r.id} · {r.packageId.replace(/^pkg\./, '')} · {r.eje}
                        {r.dependsOn.length ? ` · depende de ${r.dependsOn.join(', ')}` : ''}
                      </span>
                      {r.pregunta}
                      {entrada ? (
                        <span className="etiquetas">
                          <i className={`et et-${entrada.resolutionPath === 'diseñador' ? 'dis' : entrada.resolutionPath}`}>{NOMBRE_CAMINO[entrada.resolutionPath]}</i>
                          <i className="et">{entrada.cicloDeVida}</i>
                          <i className="et">{entrada.fuerza}</i>
                          <i className="et">rev. {entrada.revision}</i>
                          {entrada.resolutionPath === 'insumo' && entrada.provenance.referenciaId ? (
                            <i className="et">{sistema.insumos.find((i) => i.id === entrada.provenance.referenciaId)?.nombre ?? entrada.provenance.referenciaId}</i>
                          ) : null}
                        </span>
                      ) : null}
                    </div>
                    <button className="ayuda" aria-expanded={abierta} title="¿Qué quiere decir?" onClick={() => alternar(r.id)}>
                      ?
                    </button>

                    {entrada ? (
                      <div className="caminos">
                        <span className={`resuelto ${resuelto ? '' : 'no'}`}>{resuelto ? '✓ resuelto' : `✗ ${motivosPropios.length + motivosDeps.length} motivo${motivosPropios.length + motivosDeps.length === 1 ? '' : 's'}`}</span>
                        <button className="via" onClick={() => abrir(instrumento(r.id))}>
                          Editar
                        </button>
                        {instrumento(r.id).tipo !== 'editor' ? (
                          <button className="via" title="Editar el payload campo por campo" onClick={() => abrir({ tipo: 'editor', requirementId: r.id })}>
                            Como datos
                          </button>
                        ) : null}
                        {entrada.cicloDeVida === 'aprobada' ? (
                          <button className="via" onClick={() => despachar({ tipo: 'reabrir', requirementId: r.id })}>
                            Reabrir
                          </button>
                        ) : (
                          <button className="via v-ok" onClick={() => setAprobando(aprobando === r.id ? null : r.id)} aria-pressed={aprobando === r.id}>
                            Aprobar
                          </button>
                        )}
                        <button
                          className="via peligro"
                          onClick={() => {
                            const aviso = dependientes.length
                              ? `Quitar esta definición deja sin resolver también: ${dependientes.map((d) => d.id).join(', ')}. ¿Quitar igual?`
                              : '¿Quitar esta definición?';
                            if (window.confirm(aviso)) despachar({ tipo: 'quitar-definicion', requirementId: r.id });
                          }}
                        >
                          Quitar
                        </button>
                      </div>
                    ) : (
                      <div className="caminos">
                        <button
                          className="via v-insumo"
                          aria-pressed={camino === 'insumo'}
                          onClick={() => despachar({ tipo: 'asignar-camino', requirementId: r.id, camino: camino === 'insumo' ? null : 'insumo' })}
                        >
                          Insumo
                        </button>
                        <button
                          className="via v-dis"
                          aria-pressed={camino === 'diseñador'}
                          onClick={() => despachar({ tipo: 'asignar-camino', requirementId: r.id, camino: camino === 'diseñador' ? null : 'diseñador' })}
                        >
                          Diseñador
                        </button>
                        <button
                          className="via v-ia"
                          aria-pressed={camino === 'contope'}
                          onClick={() => {
                            if (camino === 'contope') despachar({ tipo: 'asignar-camino', requirementId: r.id, camino: null });
                            else despachar({ tipo: 'encargar-a-contope', requirementId: r.id });
                          }}
                        >
                          ContOpe
                        </button>
                        {camino === 'diseñador' ? (
                          <button className="abrir-inst" onClick={() => abrir(instrumento(r.id))}>
                            Definir →
                          </button>
                        ) : null}
                        {camino === 'insumo' ? (
                          <button className="abrir-inst" onClick={() => ir('recoleccion')}>
                            Ir a recolección →
                          </button>
                        ) : null}
                      </div>
                    )}

                    {aprobando === r.id && entrada ? (
                      <div className="expl aprobar">
                        <b>Aprobar y declarar su fuerza.</b> Inamovible es la marca; prioritaria se cambia sólo con buena razón; explorable se puede probar otra.
                        <span className="chips" style={{ marginTop: '.5rem' }}>
                          {FUERZAS.map(([f, n]) => (
                            <button
                              key={f}
                              className="chip2"
                              onClick={() => {
                                despachar({ tipo: 'aprobar', requirementId: r.id, fuerza: f });
                                setAprobando(null);
                              }}
                            >
                              {n}
                            </button>
                          ))}
                        </span>
                      </div>
                    ) : null}

                    {abierta ? (
                      <div className="expl">
                        <b>Qué quiere decir.</b> {EXPLICACIONES[r.id]}
                      </div>
                    ) : null}

                    {entrada && !resuelto ? (
                      <div className="expl motivos">
                        <b>Por qué no está resuelto.</b>
                        <ul>
                          {motivosPropios.map((m, i) => (
                            <li key={i}>{m.mensaje}</li>
                          ))}
                          {motivosDeps.length ? <li>{motivosDeps.length === 1 ? 'Una dependencia' : `${motivosDeps.length} dependencias`} sin resolver: {motivosDeps.map((m) => m.mensaje.match(/'([^']+)'/)?.[1] ?? '').join(', ')}</li> : null}
                        </ul>
                      </div>
                    ) : null}

                    {tarea ? (
                      <div className="expl" style={{ borderLeftColor: 'var(--ia)' }}>
                        <b>Encargado a ContOpe.</b> Queda como tarea activa en la cápsula
                        {tarea.constraintDefinitionIds.length ? `, restringida por ${tarea.constraintDefinitionIds.join(', ')}` : ', sin restricciones resueltas todavía'}. La IA de
                        escritorio la construye leyendo la cápsula; lo que proponga queda marcado como propuesta hasta que lo mires.
                      </div>
                    ) : null}

                    {conflictos.length ? (
                      <div className="expl" style={{ borderLeftColor: 'var(--bronce)' }}>
                        <b>Ojo.</b> Este requisito ya venía resuelto por otro origen y {conflictos.length === 1 ? 'otro insumo' : `${conflictos.length} insumos más`} también lo
                        resuelve{conflictos.length === 1 ? '' : 'n'} ({conflictos.map((c) => sistema.insumos.find((i) => i.id === c.insumoId)?.nombre ?? c.insumoId).join(', ')}).
                        Quedan las fuentes registradas; cuál manda se decide en la armonización, no acá.
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          );
        })}
      </section>
      <div className="pie-def">
        <span className="aviso">
          {evaluacion.completo
            ? 'Todo el núcleo está resuelto. Se puede construir y después armonizar.'
            : `Faltan ${evaluacion.total - evaluacion.resueltos} requisitos por resolver${sinNada ? ` (${sinNada} sin camino asignado)` : ''}. Sin todos resueltos no se habilita la armonización.`}
        </span>
        <button className="btn" onClick={() => ir('recoleccion')}>
          ← Recolección
        </button>
        <button className="btn fuerte" onClick={() => ir('construccion')}>
          Construcción →
        </button>
      </div>
    </>
  );
}
