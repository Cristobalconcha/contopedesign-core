/**
 * Alcance (pedido del dueño del producto, 18-09-2026): la pantalla donde se
 * declara QUÉ preguntas del manifiesto este sistema necesita.
 *
 * Es la primera pantalla de un sistema nuevo —entre Inicio y Recolección— y
 * se puede volver a ella cuando se quiera («cambiar el alcance», en
 * Definición). Marcar una dimensión suma TODAS sus preguntas al paquete; las
 * del núcleo del mundo entran siempre, marcada o no su dimensión. Sin alcance
 * todavía, todas las casillas vienen marcadas: un sistema que no acota se
 * comporta como hoy, con el manifiesto entero como paquete.
 */
import type { DimensionId } from '@contope/core';
import { useState } from 'react';
import { DIMENSIONES, NOMBRE_DIMENSION, REQUISITOS, dimensionDe } from '../dominio/manifiesto.js';
import { enNucleo, nucleoDeMundo } from '../dominio/nucleos.js';
import { useTaller } from '../taller.js';

export function Alcance() {
  const { sistema, despachar, ir } = useTaller();
  const [proposito, setProposito] = useState(sistema.alcance?.proposito ?? '');
  const [marcadas, setMarcadas] = useState<Set<DimensionId>>(
    () => new Set(sistema.alcance ? sistema.alcance.dimensiones : DIMENSIONES),
  );

  const alternar = (dim: DimensionId): void => {
    const s = new Set(marcadas);
    if (s.has(dim)) s.delete(dim);
    else s.add(dim);
    setMarcadas(s);
  };

  const delPaquete = REQUISITOS.filter(
    (r) => marcadas.has(dimensionDe(r.id)) || enNucleo(sistema.mundo, r.id),
  ).length;
  const tieneNucleo = nucleoDeMundo(sistema.mundo) !== undefined;

  const guardar = (): void => {
    despachar({
      tipo: 'declarar-alcance',
      alcance: {
        proposito: proposito.trim(),
        dimensiones: DIMENSIONES.filter((d) => marcadas.has(d)),
        declaradoEn: new Date().toISOString(),
      },
    });
    ir('recoleccion');
  };

  return (
    <section className="alcance">
      <h2>¿A qué va este sistema?</h2>
      <p className="desde">En una línea. Queda guardado con el alcance, para leer después por qué declaró lo que declaró.</p>

      <label className="campo">
        <span className="rot">El propósito</span>
        <input
          value={proposito}
          onChange={(e) => setProposito(e.target.value)}
          placeholder="una línea de cartelería para ferias"
          aria-label="Propósito del sistema"
        />
      </label>

      <p className="paquete-aviso">
        Lo que marques abajo es el <b>paquete de definiciones</b> de este sistema. Desde acá la completitud se mide contra
        ese paquete y no contra el manifiesto entero: lo que queda fuera no es una ausencia, es algo que este sistema no
        declara. Puedes volver a esta pantalla y cambiarlo cuando quieras.
      </p>

      <div className="alcance-dims">
        {DIMENSIONES.map((dim) => {
          const reqs = REQUISITOS.filter((r) => r.dimensionId === dim);
          const nucleo = reqs.filter((r) => enNucleo(sistema.mundo, r.id)).length;
          return (
            <label key={dim} className="dim-caja">
              <input type="checkbox" checked={marcadas.has(dim)} onChange={() => alternar(dim)} aria-label={NOMBRE_DIMENSION[dim] ?? dim} />
              <b>{NOMBRE_DIMENSION[dim] ?? dim}</b>
              <span className="n">
                {reqs.length} {reqs.length === 1 ? 'pregunta' : 'preguntas'}
              </span>
              {nucleo > 0 ? <i className="nucleo-nota">{nucleo} del núcleo, siempre</i> : null}
            </label>
          );
        })}
      </div>

      <div className="pie-alcance">
        <span className="aviso">
          Entran {delPaquete} de {REQUISITOS.length} preguntas al paquete.{' '}
          {tieneNucleo
            ? 'Las del núcleo del mundo entran siempre, aunque no marques su dimensión.'
            : 'Este mundo todavía no tiene núcleo medido.'}
        </span>
        {sistema.alcance ? (
          <button className="btn" onClick={() => ir('definicion')}>
            Volver
          </button>
        ) : null}
        <button className="btn fuerte" onClick={guardar}>
          Guardar el alcance y recolectar →
        </button>
      </div>
    </section>
  );
}
