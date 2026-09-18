/**
 * Armonización, primer dibujo (INTERFAZ.md §4; decisiones 20, 21 y 23). Es un
 * dibujo para conversarlo, no la versión definitiva. Lo que sí hace es real:
 * se entra con el paquete completo; el árbitro del mundo (las reglas con cita
 * de su núcleo) y los conflictos de origen producen señales; sobre cada una
 * la persona valida, anota o redefine; y se vuelve a pasar. La lectura de las
 * declaraciones por la IA no está construida: sus señales entrarán por el
 * mismo formato (`dominio/armonizacion.ts`).
 */
import { useState } from 'react';
import { senalesAbiertas, senalesDe, senalesResueltas, type Senal } from '../dominio/armonizacion.js';
import { NOMBRE_DIMENSION, dimensionDe, requisito } from '../dominio/manifiesto.js';
import { nucleoDeMundo } from '../dominio/nucleos.js';
import { instrumentoPara } from '../instrumentos/index.js';
import { useTaller } from '../taller.js';

export function Armonizacion() {
  const { sistema, evaluacion, despachar, ir, abrir } = useTaller();
  const senales = senalesDe(sistema, evaluacion);
  const abiertas = senalesAbiertas(sistema, senales);
  const resueltas = senalesResueltas(sistema, senales);
  const nucleo = nucleoDeMundo(sistema.mundo);
  const contador = evaluacion.nucleo?.contador;
  const faltan = evaluacion.total - evaluacion.resueltos;
  const pasada = sistema.armonizacion.pasadas;

  return (
    <section className="arm">
      <div className="arm-cab">
        <div>
          <span className="marca-stub">Primer dibujo, para conversar</span>
          <h2>Armonización</h2>
          <p className="arm-sub">
            El catálogo propio, mirado junto. Un árbitro señala; tú validas, anotas o redefines; y se vuelve a pasar. Es una
            etapa, no un aviso en vivo: se entra con el paquete completo.
          </p>
        </div>
        <div className="arm-arbitro">
          <span className="rot">Árbitro de este mundo</span>
          {nucleo ? (
            <>
              <b>{nucleo.nombre}</b>
              <span className="tenue">{nucleo.fuente}</span>
              {contador ? (
                <span className="mono">
                  {contador.reglasCumplidas} de {contador.reglasTotal} reglas cumplidas · {contador.cubiertos} de {contador.total} preguntas
                  del núcleo
                </span>
              ) : null}
            </>
          ) : (
            <span className="tenue">Este mundo no tiene núcleo medido: no hay árbitro todavía.</span>
          )}
        </div>
      </div>

      {!evaluacion.completo ? (
        <div className="arm-puerta">
          <b>Se entra con el paquete completo.</b>
          <span>
            Faltan {faltan} {faltan === 1 ? 'pregunta' : 'preguntas'} del paquete por resolver. Mientras tanto, esto es sólo lectura: lo
            que el árbitro ya señala, tal como está.
          </span>
          <button className="btn" onClick={() => ir('definicion')}>
            ← Volver a definición
          </button>
        </div>
      ) : pasada === 0 ? (
        <div className="arm-puerta lista">
          <b>El paquete está completo.</b>
          <span>
            {senales.length === 0
              ? 'El árbitro no objeta nada y no hay conflictos de origen. Igual se puede pasar, para dejarlo dicho.'
              : `Hay ${senales.length} ${senales.length === 1 ? 'señal' : 'señales'} para mirar.`}
          </span>
          <button className="btn fuerte" onClick={() => despachar({ tipo: 'nueva-pasada' })}>
            Empezar la primera pasada
          </button>
        </div>
      ) : (
        <div className="arm-pasada">
          <span className="mono">pasada {pasada}</span>
          <span className="tenue">
            {abiertas.length === 0
              ? resueltas.length === 0
                ? 'Sin señales.'
                : 'Todas las señales tienen decisión.'
              : `${abiertas.length} ${abiertas.length === 1 ? 'señal abierta' : 'señales abiertas'}`}
          </span>
          <button className="btn chico" onClick={() => despachar({ tipo: 'nueva-pasada' })} title="Vuelve a pasar con lo redefinido; las decisiones quedan">
            Nueva pasada
          </button>
        </div>
      )}

      <h3>Señales abiertas</h3>
      {abiertas.length === 0 ? (
        <p className="tenue">Ninguna.</p>
      ) : (
        <div className="arm-lista">
          {abiertas.map((s) => (
            <Tarjeta
              key={s.id}
              senal={s}
              soloLectura={!evaluacion.completo}
              onValidar={() => despachar({ tipo: 'resolver-senal', senalId: s.id, estado: 'validada' })}
              onAnotar={(nota) => despachar({ tipo: 'resolver-senal', senalId: s.id, estado: 'anotada', nota })}
              onRedefinir={() => {
                if (s.tipo === 'regla' && !s.cortapisa) abrir(instrumentoPara(s.requirementId)(s.requirementId));
                else ir('definicion');
              }}
            />
          ))}
        </div>
      )}

      {resueltas.length > 0 ? (
        <details className="arm-resueltas">
          <summary>
            {resueltas.length} {resueltas.length === 1 ? 'señal con decisión' : 'señales con decisión'}
          </summary>
          <div className="arm-lista">
            {resueltas.map(({ senal, decision }) => (
              <div key={senal.id} className={`arm-senal resuelta ${decision.estado}`}>
                <span className="id">
                  {senal.requirementId} · {NOMBRE_DIMENSION[dimensionDe(senal.requirementId)] ?? ''} · {decision.estado} en la pasada{' '}
                  {decision.pasada}
                </span>
                <b>{senal.titulo}</b>
                {decision.nota ? <p className="arm-nota">{decision.nota}</p> : null}
                <div className="arm-acciones">
                  <button className="btn chico" onClick={() => despachar({ tipo: 'reabrir-senal', senalId: senal.id })}>
                    Reabrir
                  </button>
                </div>
              </div>
            ))}
          </div>
        </details>
      ) : null}

      <p className="arm-ia">
        La lectura de las declaraciones por la IA (lo que no cabe en un valor: materialidad, encuadernación) no está construida. Cuando
        esté, sus señales entran por acá con el mismo formato: validar, anotar o redefinir.
      </p>
    </section>
  );
}

function Tarjeta({
  senal,
  soloLectura,
  onValidar,
  onAnotar,
  onRedefinir,
}: {
  senal: Senal;
  soloLectura: boolean;
  onValidar: () => void;
  onAnotar: (nota: string) => void;
  onRedefinir: () => void;
}) {
  const [anotando, setAnotando] = useState(false);
  const [nota, setNota] = useState('');
  const req = requisito(senal.requirementId);
  return (
    <div className={`arm-senal ${senal.tipo} ${senal.cortapisa ? 'de-cortapisa' : ''}`}>
      <span className="id">
        {senal.tipo === 'regla' ? 'regla del árbitro' : 'conflicto de origen'} · {senal.requirementId} ·{' '}
        {NOMBRE_DIMENSION[dimensionDe(senal.requirementId)] ?? ''}
      </span>
      <b>{senal.titulo}</b>
      {req ? <p className="arm-pregunta">{req.pregunta}</p> : null}
      <p className="arm-detalle">{senal.detalle}</p>
      {senal.tipo === 'regla' && senal.cita ? <blockquote className="arm-cita">{senal.cita}</blockquote> : null}
      {senal.cortapisa ? (
        <p className="arm-gana">
          <b>Gana la cortapisa.</b> Esta definición vino de una cortapisa y no se discute: lo que se redefine es el resto.
        </p>
      ) : null}
      {soloLectura ? null : anotando ? (
        <div className="arm-anotar">
          <textarea
            aria-label="Nota sobre la señal"
            value={nota}
            placeholder="Por qué se deja así, o qué se va a hacer"
            onChange={(e) => setNota(e.target.value)}
          />
          <div className="arm-acciones">
            <button className="btn chico" onClick={() => setAnotando(false)}>
              Cancelar
            </button>
            <button className="btn chico fuerte" disabled={nota.trim() === ''} onClick={() => onAnotar(nota)}>
              Guardar la nota
            </button>
          </div>
        </div>
      ) : (
        <div className="arm-acciones">
          <button className="btn chico" onClick={onValidar} title="Queda como está; la señal se cierra en esta pasada">
            Validar
          </button>
          <button className="btn chico" onClick={() => setAnotando(true)} title="Queda como está, con una nota">
            Anotar
          </button>
          <button className="btn chico fuerte" onClick={onRedefinir} title={senal.cortapisa ? 'Ir a definición para redefinir el resto' : 'Abre el instrumento de la pregunta'}>
            {senal.cortapisa ? 'Redefinir el resto →' : 'Redefinir →'}
          </button>
        </div>
      )}
    </div>
  );
}
