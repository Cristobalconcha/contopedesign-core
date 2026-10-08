/**
 * Células Madre (decisión 35): el menú que ofrece generar archivos desde el
 * ADN del sistema. Cada generador del núcleo (`GENERADORES`) aparece con lo
 * que hace, lo que lee del ADN, si puede generar o qué le falta, sus
 * parámetros y el botón «Generar», que guarda un `.zip` con los archivos y su
 * `LEEME.md` (la ficha). Debajo, lo ya generado, con su vigencia frente al
 * ADN de hoy y «Regenerar».
 *
 * No es una fase más del armado: se puede usar en cualquier momento, con lo
 * que el ADN tenga. Por eso va en la barra separada de las fases, sin flecha.
 */
import {
  GENERADORES,
  NOMBRE_CORTO_DE_PREGUNTA,
  generadorPorId,
  idsQueLee,
  resolverParametros,
  type Generador,
  type MetadataDeCelula,
  type OpcionDeParametro,
  type Parametro,
  type Parametros,
  type Vigencia,
} from '@contope/core';
import { useState } from 'react';
import { generarEnElTaller, paraGuardar, vigenciaDe, type CelulaGenerada } from '../dominio/celulas.js';
import { NOMBRE_DIMENSION, dimensionDe, requisito } from '../dominio/manifiesto.js';
import { useTaller } from '../taller.js';

function nombreDePregunta(id: string): string {
  return NOMBRE_CORTO_DE_PREGUNTA[id] ?? `${NOMBRE_DIMENSION[dimensionDe(id)] ?? dimensionDe(id)} · ${id}`;
}

const FECHA = new Intl.DateTimeFormat('es-CL', { dateStyle: 'medium', timeStyle: 'short' });

function fecha(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : FECHA.format(d);
}

/** La vigencia dicha para el diseñador. */
function textoDeVigencia(v: Vigencia): { clase: string; titulo: string; detalle?: string } {
  if (v.estado === 'vigente') return { clase: 'vigente', titulo: 'Al día con el ADN' };
  if (v.estado === 'huérfana') return { clase: 'huerfana', titulo: 'Sin ancestro', detalle: `No se puede actualizar: ${v.motivo}.` };
  const MOTIVO = { cambio: 'cambió', borrada: 'se borró', nueva: 'se definió después' } as const;
  return {
    clase: 'desactualizada',
    titulo: 'Desactualizado',
    detalle: `Desde que se generó, ${v.cambios.map((c) => `${MOTIVO[c.motivo]} «${nombreDePregunta(c.requirementId)}»`).join('; ')}.`,
  };
}

/** Cómo se lee un parámetro ya elegido, para la lista de lo generado. */
const minuscula = (t: string): string => t.charAt(0).toLowerCase() + t.slice(1);

function resumenDeParametros(generador: Generador | undefined, metadata: MetadataDeCelula, opciones: Map<string, string>): string {
  if (!generador) return '';
  return generador.parametros
    .map((p) => {
      const v = metadata.parametros[p.id];
      if (v === undefined) return null;
      if (p.tipo === 'si-no') return v === true ? minuscula(p.etiqueta) : null;
      if (p.tipo === 'opcion') return p.opciones.find((o) => o.valor === v)?.etiqueta ?? String(v);
      if (p.tipo === 'numero') return `${minuscula(p.etiqueta)} ${String(v)}${p.unidad ?? ''}`;
      return Array.isArray(v) ? v.map((k) => opciones.get(k)?.split(' · ')[0] ?? k).join(' → ') : null;
    })
    .filter((x): x is string => x !== null && x !== '')
    .join(' · ');
}

function ControlDeParametro(props: {
  parametro: Parametro;
  valor: Parametros[string] | undefined;
  opciones: OpcionDeParametro[];
  cambiar(valor: Parametros[string]): void;
}) {
  const { parametro: p, valor, opciones, cambiar } = props;
  if (p.tipo === 'si-no') {
    return (
      <label className="cm-param cm-si-no">
        <input type="checkbox" checked={valor === true} onChange={(e) => cambiar(e.target.checked)} />
        <span>
          {p.etiqueta}
          {p.ayuda ? <em>{p.ayuda}</em> : null}
        </span>
      </label>
    );
  }
  if (p.tipo === 'opcion') {
    return (
      <label className="cm-param">
        <span className="cm-et">{p.etiqueta}</span>
        <select value={typeof valor === 'string' ? valor : p.porDefecto} onChange={(e) => cambiar(e.target.value)}>
          {p.opciones.map((o) => (
            <option key={o.valor} value={o.valor}>
              {o.etiqueta}
            </option>
          ))}
        </select>
        {p.ayuda ? <em>{p.ayuda}</em> : null}
      </label>
    );
  }
  if (p.tipo === 'numero') {
    return (
      <label className="cm-param">
        <span className="cm-et">{p.etiqueta}</span>
        <span className="cm-numero">
          <input
            type="range"
            min={p.min}
            max={p.max}
            step={p.paso ?? 1}
            value={typeof valor === 'number' ? valor : p.porDefecto}
            onChange={(e) => cambiar(Number(e.target.value))}
          />
          <b>
            {typeof valor === 'number' ? valor : p.porDefecto}
            {p.unidad ?? ''}
          </b>
        </span>
        {p.ayuda ? <em>{p.ayuda}</em> : null}
      </label>
    );
  }
  // Selección: fichas que se marcan; si es ordenada, el número dice el orden.
  const elegidos = Array.isArray(valor) ? valor : [];
  const alternar = (v: string): void => cambiar(elegidos.includes(v) ? elegidos.filter((x) => x !== v) : [...elegidos, v]);
  return (
    <div className="cm-param">
      <span className="cm-et">{p.etiqueta}</span>
      <div className="cm-fichas">
        {opciones.map((o) => {
          const i = elegidos.indexOf(o.valor);
          return (
            <button key={o.valor} type="button" className={`cm-ficha ${i >= 0 ? 'on' : ''}`} onClick={() => alternar(o.valor)} title={o.etiqueta}>
              {o.muestra ? <i style={{ background: o.muestra }} /> : null}
              <span>{o.etiqueta.split(' · ')[0]}</span>
              {i >= 0 && p.ordenada ? <b>{i + 1}</b> : null}
            </button>
          );
        })}
      </div>
      {p.ayuda ? <em>{p.ayuda}</em> : null}
    </div>
  );
}

export function CelulasMadre() {
  const { sistema, puente, despachar, avisar, ir } = useTaller();
  const set = sistema.designSet;
  /** Lo que el diseñador tocó, por generador; lo demás sale del valor por defecto. */
  const [tocados, setTocados] = useState<Record<string, Record<string, unknown>>>({});
  const [ocupado, setOcupado] = useState<string | null>(null);

  /** `reemplaza`: el registro que se está regenerando, para que el nuevo tome su lugar. */
  const generar = async (generador: Generador, parametros: Readonly<Record<string, unknown>>, clave: string, reemplaza?: string): Promise<void> => {
    const r = generarEnElTaller(sistema, generador, parametros);
    if (!r.ok) {
      avisar(r.falta, 'error');
      return;
    }
    setOcupado(clave);
    try {
      const destino = await puente.guardarArchivo(paraGuardar(r.zip));
      if (destino === null) return;
      despachar({ tipo: 'registrar-celula', celula: r.celula, ...(reemplaza !== undefined ? { reemplaza } : {}) });
      const nombres = r.celula.archivos.map((a) => a.nombre).join(', ');
      avisar(`${generador.nombre}: ${r.zip.nombre} (${nombres} y su LEEME.md) en ${destino}. Guarda el sistema para que recuerde lo generado.`);
    } catch (error) {
      avisar((error as Error).message, 'error');
    } finally {
      setOcupado(null);
    }
  };

  const generados = [...sistema.celulasMadre].reverse();

  return (
    <section className="cm">
      <div className="cm-cab">
        <span className="marca-stub">Primera entrega</span>
        <h2>Células Madre</h2>
        <p>
          Material hecho con el ADN de este sistema: archivos que se abren tal cual en otra herramienta. Cada generación baja como un{' '}
          <span className="mono">.zip</span> con el archivo y su ficha (<span className="mono">LEEME.md</span>): qué es, cómo se usa
          y su procedencia —de qué sistema, con qué generador, de qué definiciones y cuándo—, que también va adentro del archivo
          cuando el formato tiene dónde. Así se sabe cuándo un archivo quedó atrás porque el ADN cambió.
        </p>
      </div>

      <span className="rot">Qué se puede generar</span>
      <div className="cm-menu">
        {GENERADORES.map((g) => {
          const disponible = g.disponible(set);
          const parametros = resolverParametros(g, set, tocados[g.id] ?? {});
          const lee = idsQueLee(g, set, parametros);
          const cambiar = (id: string, valor: unknown): void => setTocados((t) => ({ ...t, [g.id]: { ...(t[g.id] ?? {}), [id]: valor } }));
          return (
            <article key={g.id} className={`cm-generador ${disponible.ok ? '' : 'sin-adn'}`}>
              <header>
                <b>{g.nombre}</b>
                <span className="mono tenue">{g.formato}</span>
              </header>
              <p className="cm-desc">{g.descripcion}</p>
              <div className="cm-lee">
                <span className="cm-et">Lee del ADN</span>
                <p>{g.queLee}</p>
                <ul>
                  {lee.map((id) => {
                    const definido = set.entries.some((e) => e.requirementId === id);
                    return (
                      <li key={id} className={definido ? 'definido' : 'pendiente'} title={requisito(id)?.pregunta ?? id}>
                        {nombreDePregunta(id)} · {definido ? 'definido' : 'sin definir'}
                      </li>
                    );
                  })}
                </ul>
              </div>
              {disponible.ok ? (
                <>
                  <div className="cm-params">
                    {g.parametros.map((p) => (
                      <ControlDeParametro
                        key={p.id}
                        parametro={p}
                        valor={parametros[p.id]}
                        opciones={p.tipo === 'seleccion' ? p.opciones(set) : []}
                        cambiar={(v) => cambiar(p.id, v)}
                      />
                    ))}
                  </div>
                  <footer>
                    <button className="btn fuerte" disabled={ocupado !== null} onClick={() => void generar(g, parametros, g.id)}>
                      {ocupado === g.id ? 'Generando…' : 'Generar'}
                    </button>
                    <span className="tenue">{puente.entorno === 'navegador' ? 'Se descarga un .zip con el archivo y su ficha.' : 'Guardas un .zip con el archivo y su ficha.'}</span>
                  </footer>
                </>
              ) : (
                <footer className="cm-falta">
                  <span>{disponible.falta}</span>
                  <button className="btn chico" onClick={() => ir('definicion')}>
                    Ir a Definición
                  </button>
                </footer>
              )}
            </article>
          );
        })}
      </div>

      <span className="rot">Lo generado</span>
      {generados.length === 0 ? (
        <p className="tenue">Nada todavía. Lo que generes queda anotado acá, y se guarda con el sistema.</p>
      ) : (
        <ul className="cm-generados">
          {generados.map((c: CelulaGenerada) => {
            const g = generadorPorId(c.metadata.generador.id);
            const v = textoDeVigencia(vigenciaDe(c, sistema));
            const opciones = new Map(
              (g?.parametros ?? []).flatMap((p) => (p.tipo === 'seleccion' ? p.opciones(set).map((o): [string, string] => [o.valor, o.etiqueta]) : [])),
            );
            const resumen = resumenDeParametros(g, c.metadata, opciones);
            return (
              <li key={c.id} className={`cm-hecho ${v.clase}`}>
                <div className="cm-hecho-txt">
                  <b>{c.metadata.generador.nombre}</b>
                  <span className="mono">{c.archivos.map((a) => a.nombre).join(', ')}</span>
                  <span className="tenue">
                    {fecha(c.metadata.generadoEn)}
                    {resumen ? ` · ${resumen}` : ''}
                    {g && g.version !== c.metadata.generador.version ? ` · hecho con la versión ${c.metadata.generador.version}; la actual es ${g.version}` : ''}
                  </span>
                </div>
                <div className="cm-hecho-estado">
                  <span className={`cm-sello ${v.clase}`}>{v.titulo}</span>
                  {v.detalle ? <span className="cm-detalle">{v.detalle}</span> : null}
                </div>
                <div className="cm-hecho-acciones">
                  <button
                    className={`btn chico ${v.clase === 'desactualizada' ? 'fuerte' : ''}`}
                    disabled={!g || ocupado !== null}
                    title={g ? 'Vuelve a generar con los mismos parámetros y el ADN de hoy' : 'Este generador ya no existe en esta versión de la app'}
                    onClick={() => g && void generar(g, c.metadata.parametros, c.id, c.id)}
                  >
                    {ocupado === c.id ? 'Generando…' : 'Regenerar'}
                  </button>
                  <button className="btn chico" title="Quitarlo de esta lista (no borra archivos)" onClick={() => despachar({ tipo: 'olvidar-celula', celulaId: c.id })}>
                    Quitar de la lista
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
