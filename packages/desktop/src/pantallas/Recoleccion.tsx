/**
 * Recolección (INTERFAZ.md §2, pendiente de revisión): se incorpora un
 * insumo, se elige QUÉ se quiere tomar de él, se registra con trazabilidad
 * al requisito que resuelve, y el sistema pregunta si seguir o avanzar.
 *
 * Desde el 18-09-2026 los insumos entran por DOS CARRILES: como referente (lo
 * que se toma entra como propuesta, para decidir después) o como cortapisa (el
 * manual de estilo, el logotipo, la paleta institucional, el sistema anterior
 * cuando lo nuevo es una variante: lo que trae entra aprobado e inamovible). En
 * los dos carriles el diseñador marca, sobre el desglose de dimensiones, qué se
 * toma de ese insumo; lo no marcado no se ofrece: sus candidatos quedan
 * ocultos hasta que se vuelvan a marcar, sin descartarse.
 *
 * Todo lo que hay acá es real: los archivos entran por el selector del
 * sistema o arrastrados, los candidatos salen de leerlos, y el medidor lo
 * calcula el evaluador del núcleo.
 */
import type { DimensionId } from '@contope/core';
import { useEffect, useMemo, useState } from 'react';
import { Primitiva } from '../componentes/Primitiva.js';
import { extraer } from '../dominio/extractores/index.js';
import { NOMBRE_DIMENSION, dimensionDe, requisito } from '../dominio/manifiesto.js';
import type { Carril, Insumo } from '../dominio/sistema.js';
import { decodificarImagen } from '../navegador/imagen.js';
import type { ArchivoDeInsumo } from '../puente/index.js';
import { useTaller } from '../taller.js';

function tamano(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

const NOMBRE_TIPO: Record<Insumo['tipo'], string> = {
  css: 'Hoja de estilos',
  'tokens-w3c': 'Tokens W3C',
  imagen: 'Imagen',
  idml: 'InDesign (IDML)',
  pdf: 'PDF',
  texto: 'Texto',
  otro: 'Archivo',
};

const AYUDA_CARRIL: Record<Carril, string> = {
  referente: 'Se toma lo que marques; entra como propuesta, para decidir después.',
  cortapisa: 'Canal imperativo: manual de estilos, branding del cliente, paleta institucional o el sistema anterior. Lo que tomes entra aprobado e inamovible, y queda marcado así aunque quites el archivo.',
};

export function Recoleccion() {
  const { sistema, evaluacion, puente, despachar, ir, avisar } = useTaller();
  const [activo, setActivo] = useState<string | null>(sistema.insumos[0]?.id ?? null);
  const [seleccion, setSeleccion] = useState<Set<string>>(new Set());
  const [recienRegistrado, setRecienRegistrado] = useState(false);
  const [leyendo, setLeyendo] = useState(false);
  const [encima, setEncima] = useState(false);
  const [carril, setCarril] = useState<Carril>('referente');

  useEffect(() => {
    if (activo === null || !sistema.insumos.some((i) => i.id === activo)) setActivo(sistema.insumos[0]?.id ?? null);
  }, [activo, sistema.insumos]);

  const insumo = sistema.insumos.find((i) => i.id === activo) ?? null;
  const pendientes = insumo?.candidatos.filter((c) => c.estado === 'pendiente') ?? [];

  // Qué dimensiones tiene este insumo (las que traen algún candidato) y cuáles
  // se toman: `tomar` en null quiere decir «todas».
  const dimensionesDelInsumo: DimensionId[] = [];
  for (const c of insumo?.candidatos ?? []) {
    const d = dimensionDe(c.requirementId);
    if (!dimensionesDelInsumo.includes(d)) dimensionesDelInsumo.push(d);
  }
  const marcadas: DimensionId[] = insumo?.tomar ?? dimensionesDelInsumo;
  const visibles = pendientes.filter((c) => marcadas.includes(dimensionDe(c.requirementId)));

  const registro = useMemo(
    () =>
      sistema.insumos.flatMap((i) =>
        i.candidatos.filter((c) => c.estado === 'incorporado').map((c) => ({ insumo: i, candidato: c })),
      ),
    [sistema.insumos],
  );

  const incorporarArchivos = async (archivos: ArchivoDeInsumo[]): Promise<void> => {
    if (!archivos.length) return;
    setLeyendo(true);
    try {
      let ultimo: string | null = null;
      for (const a of archivos) {
        const nuevo = await extraer({ nombre: a.nombre, extension: a.extension, bytes: a.bytes }, { decodificarImagen });
        // El carril lo pone acá quien incorpora, no el extractor: los archivos
        // que entran —por el selector o arrastrados— llevan el del conmutador.
        despachar({ tipo: 'agregar-insumo', insumo: { ...nuevo, carril } });
        ultimo = nuevo.id;
      }
      if (ultimo !== null) setActivo(ultimo);
      setSeleccion(new Set());
      setRecienRegistrado(false);
    } catch (error) {
      avisar((error as Error).message, 'error');
    } finally {
      setLeyendo(false);
    }
  };

  const elegirArchivos = (): void => {
    void puente.abrirInsumos().then(incorporarArchivos);
  };

  const soltar = (e: React.DragEvent): void => {
    e.preventDefault();
    setEncima(false);
    const archivos = [...e.dataTransfer.files];
    void Promise.all(
      archivos.map(async (f) => ({
        nombre: f.name,
        extension: f.name.split('.').pop()?.toLowerCase() ?? '',
        bytes: new Uint8Array(await f.arrayBuffer()),
      })),
    ).then(incorporarArchivos);
  };

  const alternarDimension = (dim: DimensionId): void => {
    if (!insumo) return;
    const nuevas = marcadas.includes(dim) ? marcadas.filter((d) => d !== dim) : [...marcadas, dim];
    despachar({ tipo: 'tomar-de-insumo', insumoId: insumo.id, dimensiones: nuevas });
    if (!nuevas.includes(dim)) {
      // Lo que se oculta se destilda: lo oculto no se registra.
      const ocultos = new Set(
        insumo.candidatos.filter((c) => dimensionDe(c.requirementId) === dim).map((c) => c.id),
      );
      setSeleccion(new Set([...seleccion].filter((id) => !ocultos.has(id))));
    }
  };

  const registrar = (): void => {
    if (!insumo || seleccion.size === 0) return;
    // Sólo se registra lo que está a la vista: candidatos de dimensiones marcadas.
    const ids = [...seleccion].filter((id) => {
      const c = insumo.candidatos.find((x) => x.id === id);
      return c !== undefined && marcadas.includes(dimensionDe(c.requirementId));
    });
    if (ids.length === 0) return;
    despachar({ tipo: 'incorporar', insumoId: insumo.id, candidatoIds: ids });
    setSeleccion(new Set());
    setRecienRegistrado(true);
  };

  const conflictosDe = (requirementId: string) => sistema.conflictos.filter((c) => c.requirementId === requirementId);

  const elegirInsumo = (id: string): void => {
    setActivo(id);
    setSeleccion(new Set());
    setRecienRegistrado(false);
  };

  return (
    <section className="tres">
      <div className="col col-lat">
        <div className="carril" role="group" aria-label="Carril del insumo que entra">
          <button className="chip2" aria-pressed={carril === 'referente'} onClick={() => setCarril('referente')}>
            Entra como referente
          </button>
          <button className="chip2" aria-pressed={carril === 'cortapisa'} onClick={() => setCarril('cortapisa')}>
            Entra como cortapisa
          </button>
        </div>
        <p className="carril-ayuda">{AYUDA_CARRIL[carril]}</p>
        <button
          className={`agregar ${encima ? 'encima' : ''}`}
          onClick={elegirArchivos}
          onDragEnter={(e) => {
            e.preventDefault();
            setEncima(true);
          }}
          onDragOver={(e) => {
            e.preventDefault();
            setEncima(true);
          }}
          onDragLeave={() => setEncima(false)}
          onDrop={soltar}
          disabled={leyendo}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
            <path d="M12 5v14M5 12h14" />
          </svg>
          <b>{leyendo ? 'Leyendo…' : 'Incorporar un insumo'}</b>
          <span>IDML, CSS, tokens W3C, imagen… o arrástralo aquí</span>
        </button>
        <p className="rot" style={{ marginTop: 0 }}>
          Insumos incorporados
        </p>
        {sistema.insumos.length === 0 ? <p className="tenue">Todavía ninguno.</p> : null}
        {sistema.insumos.map((i) => {
          const hechos = i.candidatos.filter((c) => c.estado === 'incorporado').length;
          return (
            <div key={i.id} className={`insumo ${i.id === activo ? 'activo' : ''}`} onClick={() => elegirInsumo(i.id)} role="button" tabIndex={0}>
              {i.miniatura ? <img className="mini" src={i.miniatura} alt="" /> : null}
              <b>{i.nombre}</b>
              <span>
                {NOMBRE_TIPO[i.tipo]} · {tamano(i.tamanoBytes)}
              </span>
              {i.carril === 'cortapisa' ? <i className="et et-cortapisa">cortapisa</i> : null}
              {hechos ? <span className="cuenta">✓ {hechos} incorporada{hechos === 1 ? '' : 's'}</span> : null}
            </div>
          );
        })}
      </div>

      <div className="col">
        {insumo ? (
          <>
            <h2 className="tit">¿Qué incorporas de este insumo?</h2>
            <p className="desde">
              Desde {insumo.nombre} · {insumo.resumen}
            </p>
            {dimensionesDelInsumo.length ? (
              <>
                <p className="rot" style={{ marginBottom: '.3rem' }}>
                  ¿Qué tomas de este insumo?
                </p>
                <div className="tomar">
                  {dimensionesDelInsumo.map((d) => (
                    <button
                      key={d}
                      className="chip2"
                      aria-pressed={marcadas.includes(d)}
                      onClick={() => alternarDimension(d)}
                    >
                      {NOMBRE_DIMENSION[d] ?? d}
                    </button>
                  ))}
                </div>
              </>
            ) : null}
            {pendientes.length === 0 ? (
              <p className="tenue">
                {insumo.candidatos.length === 0
                  ? 'De este insumo no se extrajo nada: queda registrado igual, con su carril.'
                  : 'Todo lo de este insumo ya se incorporó o se descartó.'}
              </p>
            ) : null}
            {pendientes.length > 0 && visibles.length === 0 ? (
              <p className="tenue">No hay dimensiones marcadas arriba: marca alguna para ver sus candidatos.</p>
            ) : null}
            {visibles.map((c) => {
              const req = requisito(c.requirementId);
              const sel = seleccion.has(c.id);
              const soloInforma = Object.keys(c.fragmento).length === 0;
              return (
                <div
                  key={c.id}
                  className={`extraccion ${sel ? 'sel' : ''} ${soloInforma ? 'informa' : ''}`}
                  onClick={() => {
                    if (soloInforma) return;
                    const s = new Set(seleccion);
                    if (s.has(c.id)) s.delete(c.id);
                    else s.add(c.id);
                    setSeleccion(s);
                  }}
                >
                  <div className="caja">{sel ? '✓' : ''}</div>
                  <div className="txt">
                    <b>{c.etiqueta}</b>
                    <span>{c.detalle}</span>
                    {c.faltante ? <span className="faltante">Falta: {c.faltante}</span> : null}
                    <span className="req">
                      → {c.requirementId} · {req?.packageId.replace(/^pkg\./, '')}
                    </span>
                    {conflictosDe(c.requirementId).length || sistema.designSet.entries.some((e) => e.requirementId === c.requirementId && e.provenance.referenciaId !== insumo.id) ? (
                      <span className="faltante">Este requisito ya está resuelto por otro origen: si lo incorporas, queda registrado como conflicto para la armonización.</span>
                    ) : null}
                  </div>
                  <Primitiva muestra={c.muestra} />
                  <button
                    className="descartar"
                    title="No incorporar"
                    onClick={(e) => {
                      e.stopPropagation();
                      despachar({ tipo: 'descartar-candidato', insumoId: insumo.id, candidatoId: c.id });
                    }}
                  >
                    ✕
                  </button>
                </div>
              );
            })}
            {recienRegistrado ? (
              <div className="decision">
                <div className="cab">Registrado. ¿Seguir incorporando, o avanzar?</div>
                <div className="cuerpo">
                  <button className="btn" onClick={elegirArchivos}>
                    Incorporar otro insumo
                  </button>
                  <button className="btn fuerte" onClick={() => ir('definicion')}>
                    Avanzar a definición →
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ marginTop: '1rem' }}>
                <button className="btn fuerte" disabled={seleccion.size === 0} onClick={registrar}>
                  Registrar lo seleccionado
                </button>
              </div>
            )}
          </>
        ) : (
          <>
            <h2 className="tit">Recolección</h2>
            <p className="desde">Entran los referentes y los insumos: un IDML, tokens del W3C, una hoja de estilos, imágenes. Se registran como fuentes, con su procedencia.</p>
            <p className="tenue">Incorpora el primero desde la izquierda. Si prefieres partir definiendo a mano, puedes ir directo a Definición.</p>
            <button className="btn" onClick={() => ir('definicion')}>
              Ir a definición sin insumos →
            </button>
          </>
        )}
      </div>

      <div className="col col-lat">
        <p className="rot" style={{ marginTop: 0 }}>
          Núcleo resuelto
        </p>
        <div className="barra-med">
          <i style={{ width: `${(evaluacion.resueltos / evaluacion.total) * 100}%` }} />
        </div>
        <div className="med-n">
          {evaluacion.resueltos} de {evaluacion.total} requisitos
          {sistema.designSet.entries.length > evaluacion.resueltos ? ` · ${sistema.designSet.entries.length - evaluacion.resueltos} con definición incompleta` : ''}
        </div>
        <p className="rot">Registro</p>
        <div className="registro">
          {registro.length === 0 ? <div className="tenue">Nada todavía.</div> : null}
          {registro.map(({ insumo: i, candidato: c }) => (
            <div key={c.id} className="r">
              <Primitiva muestra={c.muestra} />
              <div>
                <b>{c.etiqueta}</b>
                <span>
                  {i.nombre} → {c.requirementId}
                </span>
              </div>
            </div>
          ))}
        </div>
        {sistema.conflictos.length ? (
          <>
            <p className="rot">Conflictos de origen</p>
            <div className="registro">
              {sistema.conflictos.map((c) => (
                <div key={c.id} className="r">
                  <div>
                    <b>{c.requirementId}</b>
                    <span>
                      {sistema.insumos.find((i) => i.id === c.insumoId)?.nombre ?? c.insumoId} ·{' '}
                      {c.desplazada ? 'lo desplazó una cortapisa; quedó de lado' : 'lo decide la armonización'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : null}
      </div>
    </section>
  );
}
