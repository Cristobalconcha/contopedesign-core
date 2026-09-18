/**
 * Elegir una familia tipográfica (INTERFAZ.md §5, APROBADO). Los filtros
 * son los de Google, sobre las 1.946 familias de Google Fonts. Cuando el
 * insumo trajo una familia que no está (Adobe Caslon Pro, típico de un
 * IDML), el selector llega prefiltrado por lo que el nombre deja leer, y el
 * prefiltro se puede cambiar. Nunca se elige una sola candidata por la
 * persona: se muestran alternativas y ella decide. Cada tarjeta se puede
 * abrir «de cerca» en el espécimen, para decidir mirando y no adivinando.
 */
import { findEntry } from '@contope/core';
import { useEffect, useMemo, useState } from 'react';
import {
  buscarFamilia,
  CATALOGO,
  CATEGORIAS,
  filtrar,
  genericaDe,
  IDIOMAS,
  PESOS,
  resolverCaso,
  SIN_FILTROS,
  TRAZOS,
  type FamiliaCatalogo,
  type Filtros,
  type Orden,
} from '../dominio/catalogo.js';
import { cargarMuestras } from '../navegador/fuentes.js';
import { useTaller } from '../taller.js';
import { Especimen } from './Especimen.js';
import { Ventana } from './Ventana.js';

interface FamiliaDeclarada {
  name: string;
  stack: string[];
  idiomas?: string[];
  licencia?: string;
}

function alternar<T>(set: ReadonlySet<T>, v: T): Set<T> {
  const s = new Set(set);
  if (s.has(v)) s.delete(v);
  else s.add(v);
  return s;
}

function familiaAPayload(f: FamiliaCatalogo): FamiliaDeclarada {
  return {
    name: f.f,
    stack: [f.f, genericaDe(f)],
    idiomas: f.l,
    // Los metadatos dicen si es de código abierto, no cuál licencia exacta:
    // se anota lo que dicen. Si no lo es, la licencia queda por declarar.
    ...(f.o ? { licencia: 'código abierto (Google Fonts)' } : {}),
  };
}

export function Tipografia({ requirementId, nombreBuscado: buscadoInicial }: { requirementId: string; nombreBuscado?: string }) {
  const { sistema, despachar, cerrarInstrumento, avisar } = useTaller();
  const entrada = findEntry(sistema.designSet, requirementId);
  const declaradas = useMemo<FamiliaDeclarada[]>(() => {
    const p = entrada?.payload as { familias?: FamiliaDeclarada[] } | undefined;
    return Array.isArray(p?.familias) ? p.familias : [];
  }, [entrada]);

  // La paleta del set (dim1.req01) para el espécimen: los institucionales y
  // los neutros, cada uno con su nombre.
  const p = findEntry(sistema.designSet, 'dim1.req01')?.payload as { institucionales?: Array<{ name: string; value: string }>; neutros?: Array<{ name: string; value: string }> } | undefined;
  const colores = [...(p?.institucionales ?? []), ...(p?.neutros ?? [])];

  const [buscado, setBuscado] = useState<string | undefined>(buscadoInicial);
  const caso = useMemo(() => (buscado !== undefined ? resolverCaso({ nombre: buscado }) : null), [buscado]);
  const [filtros, setFiltros] = useState<Filtros>(() => ({ ...SIN_FILTROS, ...(caso?.caso === 2 ? caso.prefiltro : {}) }));
  const [elegida, setElegida] = useState<FamiliaCatalogo | null>(null);
  const [abierta, setAbierta] = useState<FamiliaCatalogo | null>(null);
  const [tope, setTope] = useState(24);
  const [texto, setTexto] = useState('El veloz murciélago hindú');
  const [tam, setTam] = useState(26);

  useEffect(() => {
    if (caso?.caso === 2) setFiltros((f) => ({ ...SIN_FILTROS, orden: f.orden, ...caso.prefiltro }));
  }, [caso]);

  const resultado = useMemo(() => filtrar(CATALOGO.familias, filtros), [filtros]);
  const vista = resultado.familias.slice(0, tope);
  useEffect(() => cargarMuestras(vista.map((f) => f.f)), [vista]);
  useEffect(() => cargarMuestras(declaradas.map((d) => d.name)), [declaradas]);

  const poner = (parcial: Partial<Filtros>): void => {
    setTope(24);
    setFiltros((f) => ({ ...f, ...parcial }));
  };

  const guardar = (familias: FamiliaDeclarada[]): void => {
    const payload = { ...((entrada?.payload as Record<string, unknown> | undefined) ?? {}), familias };
    despachar({ tipo: 'definir', requirementId, payload, camino: 'diseñador', fuerza: entrada?.fuerza ?? 'explorable' });
  };

  const usar = (): void => {
    if (!elegida) return;
    const nueva = familiaAPayload(elegida);
    const reemplaza = buscado !== undefined && declaradas.some((d) => d.name === buscado);
    const familias = reemplaza
      ? declaradas.map((d) => (d.name === buscado ? nueva : d))
      : declaradas.some((d) => d.name === nueva.name)
        ? declaradas
        : [...declaradas, nueva];
    guardar(familias);
    avisar(reemplaza ? `${buscado} → ${elegida.f}: reemplazada en el fundamento tipográfico.` : `${elegida.f} agregada al fundamento tipográfico.`);
    cerrarInstrumento();
  };

  const quitar = (nombre: string): void => {
    guardar(declaradas.filter((d) => d.name !== nombre));
  };

  return (
    <Ventana
      titulo="Elegir una familia tipográfica"
      por={`${requirementId} · tipografia.fundamento · ${CATALOGO.familias.length} familias de Google Fonts (catálogo del ${CATALOGO.descargadoEn})`}
      pie={
        <>
          <span className="aviso">
            {elegida
              ? `Elegiste ${elegida.f}. Se registra con sus idiomas (${elegida.l.length}) y ${elegida.o ? 'como código abierto' : 'sin licencia declarada: hay que completarla'}.`
              : 'Los filtros son un punto de partida, no una respuesta cerrada. La decisión es tuya.'}
          </span>
          <button className="btn" onClick={cerrarInstrumento}>
            Cancelar
          </button>
          <button className="btn fuerte" disabled={!elegida} onClick={usar}>
            {buscado !== undefined && declaradas.some((d) => d.name === buscado) ? `Usar en lugar de ${buscado}` : 'Agregar esta familia'}
          </button>
        </>
      }
    >
      <aside className="filtros">
        <p className="rot">Buscar</p>
        <input className="buscar" value={filtros.busqueda} onChange={(e) => poner({ busqueda: e.target.value })} placeholder="Nombre de la familia" autoComplete="off" />
        <p className="rot">Categoría</p>
        <div className="chips">
          {CATEGORIAS.map((c) => (
            <button key={c} className="chip2" aria-pressed={filtros.categorias.has(c)} onClick={() => poner({ categorias: alternar(filtros.categorias, c) })}>
              {c}
            </button>
          ))}
        </div>
        <p className="rot">Trazo</p>
        <div className="chips">
          {TRAZOS.map((t) => (
            <button key={t} className="chip2" aria-pressed={filtros.trazos.has(t)} onClick={() => poner({ trazos: alternar(filtros.trazos, t) })}>
              {t}
            </button>
          ))}
        </div>
        <p className="rot">Peso</p>
        <div className="chips">
          {PESOS.map((p) => (
            <button key={p} className="chip2" aria-pressed={filtros.pesos.has(p)} onClick={() => poner({ pesos: alternar(filtros.pesos, p) })}>
              {p}
            </button>
          ))}
        </div>
        <p className="rot">Propiedades</p>
        <div className="chips">
          <button className="chip2" aria-pressed={filtros.italica} onClick={() => poner({ italica: !filtros.italica })}>
            Itálica
          </button>
          <button className="chip2" aria-pressed={filtros.variable} onClick={() => poner({ variable: !filtros.variable })}>
            Variable
          </button>
          <button className="chip2" aria-pressed={filtros.ancho} onClick={() => poner({ ancho: !filtros.ancho })}>
            Ancho
          </button>
        </div>
        <p className="rot">Idioma</p>
        <select className="sel" value={filtros.idioma} onChange={(e) => poner({ idioma: e.target.value })}>
          {IDIOMAS.map(([v, n]) => (
            <option key={v} value={v}>
              {n}
            </option>
          ))}
        </select>
        <p className="rot">Ordenar</p>
        <select className="sel" value={filtros.orden} onChange={(e) => poner({ orden: e.target.value as Orden })}>
          <option value="popularidad">Popularidad</option>
          <option value="tendencia">Tendencia</option>
          <option value="recientes">Más recientes</option>
          <option value="alfabetico">Alfabético</option>
        </select>
        <button className="limpiar" onClick={() => poner({ ...SIN_FILTROS, orden: filtros.orden })}>
          Limpiar filtros
        </button>
      </aside>

      <div className="resultados">
        {abierta ? (
          <Especimen
            key={abierta.f}
            familia={abierta}
            colores={colores}
            textoInicial={texto}
            onElegir={(f) => {
              setElegida(f);
              setAbierta(null);
            }}
            onVolver={() => setAbierta(null)}
          />
        ) : (
          <>
            {declaradas.length ? (
              <div className="declaradas">
                <span className="rot" style={{ margin: 0 }}>
                  Ya declaradas
                </span>
                {declaradas.map((d) => {
                  const enGoogle = buscarFamilia(d.name);
                  return (
                    <span key={d.name} className={`chip-familia ${enGoogle ? '' : 'ausente'}`} style={enGoogle ? { fontFamily: `'${d.name}', ${d.stack.at(-1) ?? 'sans-serif'}` } : undefined}>
                      {d.name}
                      {enGoogle ? null : (
                        <button className="enlace" onClick={() => setBuscado(d.name)} title="No está en Google Fonts: buscar equivalencia">
                          buscar equivalente
                        </button>
                      )}
                      <button className="quitar" onClick={() => quitar(d.name)} title="Quitar del fundamento">
                        ✕
                      </button>
                    </span>
                  );
                })}
              </div>
            ) : null}

            {caso?.caso === 2 ? (
              <div className="procedencia">
                <div className="cab">
                  Se abrió para buscarle equivalencia a <b>{caso.nombre}</b>, que no está en Google Fonts.
                </div>
                <div className="cuerpo">{caso.pista}</div>
              </div>
            ) : null}
            {caso?.caso === 1 ? (
              <div className="procedencia">
                <div className="cab">
                  <b>{caso.familia.f}</b> está en Google Fonts: se puede usar directo.
                </div>
              </div>
            ) : null}

            <div className="res-cab">
              <span className="n">
                {resultado.familias.length} {resultado.familias.length === 1 ? 'familia' : 'familias'}
                {resultado.familias.length > vista.length ? ` · mostrando ${vista.length}` : ''}
                {resultado.sinTrazo ? <span className="tenue"> · {resultado.sinTrazo} no declaran trazo y quedaron fuera</span> : null}
              </span>
              <input className="muestra-txt" value={texto} onChange={(e) => setTexto(e.target.value)} aria-label="Texto de muestra" />
              <input type="range" min={14} max={46} value={tam} onChange={(e) => setTam(Number(e.target.value))} aria-label="Tamaño de muestra" />
            </div>
            {/* La tarjeta no es <button> porque lleva adentro el botón «ver de cerca»,
                y un botón dentro de otro es HTML inválido (React lo acusa en consola). */}
            <div className="fuentes">
              {vista.map((f) => (
                <div
                  key={f.f}
                  className="fuente"
                  role="button"
                  tabIndex={0}
                  aria-pressed={elegida?.f === f.f}
                  onClick={() => setElegida(f)}
                  onDoubleClick={() => setAbierta(f)}
                  onKeyDown={(e) => {
                    if (e.target !== e.currentTarget) return;
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setElegida(f);
                    }
                  }}
                >
                  <span className="nom">
                    <b>{f.f}</b>
                    <span>
                      {f.w.length} peso{f.w.length === 1 ? '' : 's'}
                      {f.i ? ' · it' : ''}
                    </span>
                  </span>
                  <span className="esp" style={{ fontFamily: `'${f.f}', ${genericaDe(f)}`, fontSize: `${tam}px` }}>
                    {texto || 'Aa'}
                  </span>
                  <span className="meta">
                    <i>{f.c}</i>
                    {f.s && f.s !== f.c ? <i>{f.s}</i> : null}
                    {f.v.length ? <i>variable</i> : null}
                    {f.wd ? (
                      <i>
                        ancho {f.wd[0]}–{f.wd[1]}
                      </i>
                    ) : null}
                    {!f.o ? <i>sin licencia declarada</i> : null}
                  </span>
                  <span style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                    <button
                      className="btn chico"
                      title="Abrir el espécimen de esta familia"
                      onClick={(e) => {
                        e.stopPropagation();
                        setAbierta(f);
                      }}
                    >
                      ver de cerca
                    </button>
                  </span>
                </div>
              ))}
            </div>
            {resultado.familias.length === 0 ? <div className="vacio">Ningún resultado con esos filtros.</div> : null}
            {resultado.familias.length > vista.length ? (
              <button className="btn" style={{ margin: '1rem auto 0', display: 'block' }} onClick={() => setTope((t) => t + 24)}>
                Ver más
              </button>
            ) : null}
          </>
        )}
      </div>
    </Ventana>
  );
}
