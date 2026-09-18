/**
 * El instrumento de las definiciones por declaración (ARQUITECTURA.md, paso 3;
 * decisiones 25 y 26): la materialidad, el acabado, la encuadernación y las
 * terminaciones no caben en un valor, así que se escriben en palabras del
 * diseñador — más qué acota y quién la ejecuta — o se declara que no aplican,
 * con su porqué. La lee la IA en la armonización; no la valida un predicado.
 */
import { findEntry } from '@contope/core';
import { useMemo, useState } from 'react';
import { EXPLICACIONES } from '../dominio/explicaciones.js';
import { DIMENSIONES, NOMBRE_DIMENSION, requisito } from '../dominio/manifiesto.js';
import { useTaller } from '../taller.js';
import { Ventana } from './Ventana.js';

/** Las dos ramas del conmutador: declarar la salida, o decir que no aplica. */
type Rama = 'declarar' | 'noAplica';

/** Quién ejecuta lo declarado (enum cerrado de la dimensión 10). */
type Ejecuta = 'destino' | 'proveedor' | 'disenador';

const EJECUTORES: ReadonlyArray<{ valor: Ejecuta; texto: string }> = [
  { valor: 'destino', texto: 'La aplicación de destino (InDesign, el sitio)' },
  { valor: 'proveedor', texto: 'Un proveedor: la imprenta, el taller' },
  { valor: 'disenador', texto: 'Tú mismo' },
];

function esEjecuta(v: unknown): v is Ejecuta {
  return v === 'destino' || v === 'proveedor' || v === 'disenador';
}

export function Declaracion({ requirementId }: { requirementId: string }) {
  const { sistema, despachar, cerrarInstrumento, avisar } = useTaller();
  const entrada = findEntry(sistema.designSet, requirementId);
  const req = requisito(requirementId);

  const inicial = useMemo(() => {
    const p = (entrada?.payload as Record<string, unknown> | undefined) ?? {};
    const declaracionCruda = p['declaracion'];
    const noAplicaCrudo = p['noAplica'];
    const ejecutaCrudo = p['ejecuta'];
    const acotaCrudo = p['acota'];
    const declaracion = typeof declaracionCruda === 'string' ? declaracionCruda : '';
    const noAplica = typeof noAplicaCrudo === 'string' ? noAplicaCrudo : '';
    const acota = Array.isArray(acotaCrudo) ? acotaCrudo.filter((x): x is string => typeof x === 'string') : [];
    const rama: Rama = noAplica.trim() !== '' && declaracion.trim() === '' ? 'noAplica' : 'declarar';
    return { declaracion, noAplica, acota, ejecuta: esEjecuta(ejecutaCrudo) ? ejecutaCrudo : null, rama };
  }, [entrada]);

  const [rama, setRama] = useState<Rama>(inicial.rama);
  const [declaracion, setDeclaracion] = useState(inicial.declaracion);
  const [noAplica, setNoAplica] = useState(inicial.noAplica);
  const [acota, setAcota] = useState<string[]>(inicial.acota);
  const [ejecuta, setEjecuta] = useState<Ejecuta | null>(inicial.ejecuta);

  // La propia dimensión no se acota a sí misma.
  const dimensiones = DIMENSIONES.filter((d) => d !== 'dim10');

  const alternar = (d: string): void => {
    setAcota((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]));
  };

  const completa =
    rama === 'declarar' ? declaracion.trim() !== '' && ejecuta !== null : noAplica.trim() !== '';

  const estado =
    rama === 'declarar'
      ? declaracion.trim() === ''
        ? 'Falta la declaración, en tus palabras.'
        : ejecuta === null
          ? 'Falta quién la ejecuta.'
          : 'Se guarda con procedencia: diseñador.'
      : noAplica.trim() === ''
        ? 'Falta el porqué.'
        : 'Se guarda con procedencia: diseñador.';

  const guardar = (): void => {
    const payload =
      rama === 'declarar'
        ? {
            declaracion: declaracion.trim(),
            ...(acota.length ? { acota } : {}),
            ...(ejecuta !== null ? { ejecuta } : {}),
          }
        : { noAplica: noAplica.trim() };
    despachar({ tipo: 'definir', requirementId, payload, camino: 'diseñador', fuerza: entrada?.fuerza ?? 'explorable' });
    avisar('Declaración guardada.');
    cerrarInstrumento();
  };

  return (
    <Ventana
      titulo="Definir por declaración"
      por={`${requirementId} · ${req?.packageId ?? 'declaración'}`}
      ancho="angosto"
      pie={
        <>
          <span className="aviso">{estado}</span>
          <button className="btn" onClick={cerrarInstrumento}>
            Cancelar
          </button>
          <button className="btn fuerte" onClick={guardar} disabled={!completa}>
            Guardar la declaración
          </button>
        </>
      }
    >
      <div className="declaracion">
        <p className="desde">
          <b>{req?.pregunta ?? ''}</b>
        </p>
        <p className="desde">{EXPLICACIONES[requirementId]}</p>

        <div className="rama">
          <button className={rama === 'declarar' ? 'chip2 on' : 'chip2'} onClick={() => setRama('declarar')}>
            Declarar
          </button>
          <button className={rama === 'noAplica' ? 'chip2 on' : 'chip2'} onClick={() => setRama('noAplica')}>
            No aplica a este sistema
          </button>
        </div>

        {rama === 'declarar' ? (
          <>
            <div className="rot">La declaración, en tus palabras</div>
            <textarea
              aria-label="La declaración, en tus palabras"
              value={declaracion}
              placeholder="Libro de 48 páginas en pliegos de 8, corchete y hotmelt; portada en cartulina de 300 g"
              onChange={(e) => setDeclaracion(e.target.value)}
            />

            <div className="rot">Qué acota</div>
            <div className="chips">
              {dimensiones.map((d) => (
                <button
                  key={d}
                  className={acota.includes(d) ? 'chip2 on' : 'chip2'}
                  title={NOMBRE_DIMENSION[d] ?? d}
                  onClick={() => alternar(d)}
                >
                  {NOMBRE_DIMENSION[d] ?? d}
                </button>
              ))}
            </div>

            <div className="rot">Quién la ejecuta</div>
            <div className="radios">
              {EJECUTORES.map((op) => (
                <label key={op.valor}>
                  <input type="radio" name="ejecuta" checked={ejecuta === op.valor} onChange={() => setEjecuta(op.valor)} />
                  {op.texto}
                </label>
              ))}
            </div>
          </>
        ) : (
          <>
            <div className="rot">Por qué este sistema no tiene esta salida</div>
            <textarea
              aria-label="Por qué este sistema no tiene esta salida"
              value={noAplica}
              placeholder="Sólo vive en pantalla"
              onChange={(e) => setNoAplica(e.target.value)}
            />
          </>
        )}
      </div>
    </Ventana>
  );
}
