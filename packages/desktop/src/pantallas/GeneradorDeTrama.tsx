/**
 * La pantalla de la trama (decisión 36): el generador de tramas de Células
 * Madre, con vista previa viva.
 *
 * Core genera las tramas; Publisher sólo las reproduce. Acá se arma la
 * trama mirando cómo queda: los colores parten del ADN (y cada uno se puede
 * cambiar a mano), los controles mueven la lámina, «Capturar» guarda el
 * momento en pantalla como escena de una secuencia. Funciona también con un
 * sistema vacío: sin ADN, los colores salen del look.
 *
 * Lo que sale:
 * - la Célula Madre (`.zip`): archivo de trama, código CT1 e imagen SVG,
 *   con su LEEME y la metadata de ancestro, por el mismo camino que los
 *   demás generadores (y queda en «Lo generado»);
 * - una imagen PNG del instante en pantalla;
 * - un video `.webm` (formato cerrado: no sigue al cursor), si el navegador
 *   sabe grabar.
 */
import {
  baseDeNombre,
  coloresParaTrama,
  formatosParaTrama,
  generadorTrama,
  LOOKS_DE_TRAMA,
  medidaDeCuadro,
  proporcionDeLienzo,
} from '@contope/core';
import { codificarTrama, leerTrama, MODOS, PARAMETRO_ANIMABLE, type ClaveDeColor, type EstadoDeTrama, type ModoDeDibujo, type TintaElegida } from '@contope/trama';
import { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { generarEnElTaller, paraGuardar } from '../dominio/celulas.js';
import {
  capturaDelEditor,
  coloresDelEditor,
  CONTROLES_DE_TRAMA,
  editorDesdeTrama,
  editorNuevo,
  errorDeLectura,
  FORMATO_IMPORTADO,
  reducirTrama,
  tramaDelEditor,
} from '../dominio/trama.js';
import { dibujarTrama, formatoDeVideo, grabarVideo, pngDeTrama, type GrabacionDeVideo } from '../navegador/trama.js';
import { useTaller } from '../taller.js';

const NOMBRE_DE_MODO: Record<ModoDeDibujo, string> = { puntos: 'Puntos', lineas: 'Líneas', mixto: 'Puntos + líneas' };
const NOMBRE_DE_COLOR: Record<ClaveDeColor, string> = { fondo: 'Fondo', lejos: 'Lejos', cerca: 'Cerca' };
/** Calidad del motor en la vista previa (la exportación va a calidad completa). */
const CALIDAD_PREVIA = 0.6;
const ANCHO_PREVIA = 640;
const ANCHO_VIDEO = 1280;

const segundos = (t: number): string => `${t.toFixed(1).replace('.', ',')} s`;

function quiereQuietud(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function GeneradorDeTrama(props: { volver(): void }) {
  const { sistema, puente, despachar, avisar } = useTaller();
  const set = sistema.designSet;
  const [editor, accion] = useReducer(reducirTrama, set, editorNuevo);
  const trama = useMemo(() => {
    try {
      return { ok: true as const, trama: tramaDelEditor(editor, set) };
    } catch (error) {
      return { ok: false as const, error: (error as Error).message };
    }
  }, [editor, set]);
  // La vista previa vuelve a pintar la pantalla al correr: lo que lee el ADN se calcula sólo cuando cambia.
  const colores = useMemo(() => coloresDelEditor(editor, set), [editor, set]);
  const hayColoresDelAdn = useMemo(() => coloresParaTrama(set).length > 0, [set]);
  const formatos = useMemo(() => formatosParaTrama(set), [set]);

  // --- la vista previa --------------------------------------------------------
  const lienzo = useRef<HTMLCanvasElement | null>(null);
  const [corriendo, setCorriendo] = useState(() => !quiereQuietud());
  const [instante, setInstante] = useState(0);
  const reloj = useRef({ t: 0, ultimo: 0 });
  const cursor = useRef<{ x: number; y: number } | null>(null);
  const estado = useRef<EstadoDeTrama | null>(null);
  const proporcion = trama.ok ? proporcionDeLienzo(trama.trama.lienzo) : 16 / 9;
  const previa = { ancho: ANCHO_PREVIA, alto: Math.round(ANCHO_PREVIA / proporcion) };

  const instanteDeTrama = (t: number): number => {
    if (!trama.ok || trama.trama.tiempo.modo === 'vivo') return t;
    return t % trama.trama.tiempo.duracion;
  };

  const dibujar = (): void => {
    const c = lienzo.current;
    if (!c || !trama.ok) return;
    // Al menos 2 píxeles por px: los puntos de la vista previa son chicos y a 1× se ven apagados.
    const densidad = Math.max(2, Math.min(3, window.devicePixelRatio || 1));
    const entorno = cursor.current ? { cursor: [cursor.current.x, cursor.current.y] as const, presencia: 1 } : {};
    estado.current = dibujarTrama(c, trama.trama, instanteDeTrama(reloj.current.t), { ...previa, densidad, calidad: CALIDAD_PREVIA, entorno });
  };

  useEffect(() => {
    if (!corriendo) {
      dibujar();
      return;
    }
    let pedido = 0;
    reloj.current.ultimo = performance.now();
    const paso = (ahora: number): void => {
      reloj.current.t += Math.min(0.1, (ahora - reloj.current.ultimo) / 1000);
      reloj.current.ultimo = ahora;
      dibujar();
      setInstante(Math.floor(instanteDeTrama(reloj.current.t) * 10) / 10);
      pedido = requestAnimationFrame(paso);
    };
    pedido = requestAnimationFrame(paso);
    return () => cancelAnimationFrame(pedido);
  }, [corriendo, trama, previa.ancho, previa.alto]);

  const alMoverCursor = (ev: React.PointerEvent<HTMLCanvasElement>): void => {
    if (!trama.ok || trama.trama.tiempo.modo !== 'vivo' || !trama.trama.interaccion.cursor) return;
    const r = ev.currentTarget.getBoundingClientRect();
    cursor.current = { x: (ev.clientX - r.left) / r.width, y: 1 - (ev.clientY - r.top) / r.height };
    if (!corriendo) dibujar();
  };
  const alSalirCursor = (): void => {
    cursor.current = null;
    if (!corriendo) dibujar();
  };

  const capturar = (): void => {
    const evolucion = estado.current?.motor.tiempo ?? editor.semilla;
    accion({ tipo: 'capturar', captura: capturaDelEditor(editor, evolucion) });
    avisar('Escena capturada. La trama pasó a secuencia: cada escena es un momento por el que pasa.');
  };

  const alInicio = (): void => {
    reloj.current.t = 0;
    setInstante(0);
    if (!corriendo) dibujar();
  };

  // Al abrir, la pantalla parte desde arriba (el menú pudo haber quedado bajado).
  const seccion = useRef<HTMLElement | null>(null);
  useEffect(() => seccion.current?.scrollIntoView({ block: 'start' }), []);

  // --- importar ----------------------------------------------------------------
  const [receta, setReceta] = useState('');
  const [errorDeImportar, setErrorDeImportar] = useState<string | null>(null);
  const importar = (texto: string): void => {
    const r = leerTrama(texto);
    if (!r.ok) {
      setErrorDeImportar(errorDeLectura(r.errores));
      return;
    }
    setErrorDeImportar(null);
    accion({ tipo: 'cargar', editor: editorDesdeTrama(r.trama, set) });
    reloj.current.t = 0;
    const como = { json: 'archivo de trama', objeto: 'archivo de trama', ct1: 'código CT1', sp1: 'código SP1 de v7' }[r.origen];
    avisar(`Trama leída (${como}).${r.avisos.length ? ` Ojo: ${r.avisos.join('; ')}.` : ''}`);
  };
  const abrirArchivo = async (ev: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
    const archivo = ev.target.files?.[0];
    ev.target.value = '';
    if (!archivo) return;
    if (archivo.size > 2_000_000) {
      setErrorDeImportar('No se pudo leer la trama: el archivo es demasiado grande (máximo 2 MB).');
      return;
    }
    importar(await archivo.text());
  };

  // --- exportar ----------------------------------------------------------------
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [video, setVideo] = useState<{ grabacion: GrabacionDeVideo; avance: number } | null>(null);
  const puedeGrabar = useMemo(() => formatoDeVideo() !== null, []);
  const nombreBase = `${baseDeNombre(sistema.nombre)}.trama`;

  const guardar = async (nombre: string, tipoMime: string, bytes: Uint8Array, que: string): Promise<void> => {
    const destino = await puente.guardarArchivo({ nombre, tipoMime, bytes });
    if (destino !== null) avisar(`${que}: ${nombre} en ${destino}.`);
  };

  const exportarCelula = async (): Promise<void> => {
    if (!trama.ok) return;
    const t = trama.trama;
    const parametros = {
      receta: codificarTrama(t),
      look: editor.look,
      colores: 'adn',
      modo: editor.modo,
      duracion: editor.duracion,
      cerrarCiclo: editor.cerrarCiclo,
      semilla: editor.semilla,
      ...(editor.formato !== FORMATO_IMPORTADO ? { formato: [editor.formato] } : {}),
      ancho: t.lienzo.tipo === 'medida' ? Math.min(4096, t.lienzo.ancho) : 1600,
    };
    const r = generarEnElTaller(sistema, generadorTrama, parametros);
    if (!r.ok) {
      avisar(r.falta, 'error');
      return;
    }
    setOcupado('celula');
    try {
      const destino = await puente.guardarArchivo(paraGuardar(r.zip));
      if (destino === null) return;
      despachar({ tipo: 'registrar-celula', celula: r.celula });
      avisar(`Trama: ${r.zip.nombre} (${r.celula.archivos.map((a) => a.nombre).join(', ')} y su LEEME.md) en ${destino}. Guarda el sistema para que recuerde lo generado.`);
    } catch (error) {
      avisar((error as Error).message, 'error');
    } finally {
      setOcupado(null);
    }
  };

  const medidaDeExportacion = (ancho: number): { ancho: number; alto: number } =>
    trama.ok ? medidaDeCuadro(trama.trama.lienzo, trama.trama.lienzo.tipo === 'medida' ? Math.min(ancho, trama.trama.lienzo.ancho) : ancho) : { ancho, alto: Math.round(ancho / proporcion) };

  const exportarPng = async (): Promise<void> => {
    if (!trama.ok) return;
    setOcupado('png');
    try {
      const m = medidaDeExportacion(4096);
      const bytes = await pngDeTrama(trama.trama, instanteDeTrama(reloj.current.t), m.ancho, m.alto);
      await guardar(`${nombreBase}.png`, 'image/png', bytes, 'Imagen');
    } catch (error) {
      avisar((error as Error).message, 'error');
    } finally {
      setOcupado(null);
    }
  };

  const exportarVideo = async (): Promise<void> => {
    if (!trama.ok) return;
    try {
      const m = medidaDeExportacion(ANCHO_VIDEO);
      // Ancho y alto pares: algunos reproductores no aceptan medidas impares.
      const grabacion = grabarVideo(trama.trama, {
        ancho: m.ancho - (m.ancho % 2),
        alto: m.alto - (m.alto % 2),
        segundosEnVivo: 10,
        alAvanzar: (avance) => setVideo((v) => (v ? { ...v, avance } : v)),
      });
      setVideo({ grabacion, avance: 0 });
      const bytes = await grabacion.terminado;
      setVideo(null);
      if (bytes) await guardar(`${nombreBase}.webm`, 'video/webm', bytes, 'Video');
    } catch (error) {
      setVideo(null);
      avisar((error as Error).message, 'error');
    }
  };

  const enSecuencia = editor.modo === 'secuencia';
  const instantesDeEscenas = trama.ok && trama.trama.tiempo.modo === 'secuencia' ? trama.trama.tiempo.escenas.map((e) => e.t) : [];

  return (
    <section className="cm tr" ref={seccion}>
      <div className="cm-cab">
        <button className="btn chico" onClick={props.volver}>
          ← Células Madre
        </button>
        <h2>Trama</h2>
        <p>
          La superficie de puntos con los colores del sistema. Ajusta la lámina mirándola, guarda momentos como escenas y descarga la Célula Madre: el
          archivo de trama vivo para Publisher, su código de una línea y una imagen quieta. {hayColoresDelAdn ? '' : 'Este sistema todavía no define colores: se usan los del look.'}
        </p>
      </div>

      <div className="tr-cuerpo">
        <div className="tr-previa">
          <div className="tr-marco" style={{ aspectRatio: `${previa.ancho} / ${previa.alto}`, width: `min(100%, ${Math.round(70 * proporcion)}vh)` }}>
            <canvas
              ref={lienzo}
              className="tr-lienzo"
              aria-label="Vista previa de la trama"
              onPointerMove={alMoverCursor}
              onPointerLeave={alSalirCursor}
            />
          </div>
          {!trama.ok ? <p className="tr-error">{trama.error}</p> : null}
          <div className="tr-transporte">
            <button className="btn chico" onClick={alInicio} title="Volver al comienzo">
              ⏮
            </button>
            <button className="btn chico" aria-pressed={corriendo} onClick={() => setCorriendo((c) => !c)}>
              {corriendo ? 'Pausa' : enSecuencia ? 'Reproducir secuencia' : 'Reproducir'}
            </button>
            <span className="mono tenue">
              {segundos(instante)}
              {enSecuencia ? ` de ${segundos(editor.duracion)}` : ' · en vivo, sin final'}
            </span>
            <span className="tr-espacio" />
            <button className="btn chico fuerte" onClick={capturar} disabled={!trama.ok} title="Guarda la forma y el momento en pantalla como una escena">
              Capturar escena
            </button>
          </div>
          {enSecuencia ? (
            <div className="tr-escenas">
              <span className="cm-et">Escenas</span>
              {editor.escenas.length === 0 ? (
                <p className="tenue">Sin escenas: la secuencia evoluciona desde la semilla. Captura momentos para que pase por ellos.</p>
              ) : (
                <ol>
                  {editor.escenas.map((sc, i) => (
                    <li key={sc.clave}>
                      <span className="mono tenue">{segundos(instantesDeEscenas[i] ?? 0)}</span>
                      <input
                        aria-label={`Nombre de la escena ${i + 1}`}
                        value={sc.nombre}
                        onChange={(ev) => accion({ tipo: 'renombrar-escena', clave: sc.clave, nombre: ev.target.value })}
                      />
                      <button className="btn chico" disabled={i === 0} onClick={() => accion({ tipo: 'mover-escena', clave: sc.clave, hacia: -1 })} title="Antes">
                        ↑
                      </button>
                      <button
                        className="btn chico"
                        disabled={i === editor.escenas.length - 1}
                        onClick={() => accion({ tipo: 'mover-escena', clave: sc.clave, hacia: 1 })}
                        title="Después"
                      >
                        ↓
                      </button>
                      <button className="btn chico" onClick={() => accion({ tipo: 'quitar-escena', clave: sc.clave })} title="Quitar la escena">
                        Quitar
                      </button>
                    </li>
                  ))}
                  {editor.cerrarCiclo ? (
                    <li className="tr-cierre">
                      <span className="mono tenue">{segundos(editor.duracion)}</span>
                      <span>Cierre: vuelve a la primera escena</span>
                    </li>
                  ) : null}
                </ol>
              )}
            </div>
          ) : null}
        </div>

        <div className="tr-controles">
          <span className="cm-et">Look</span>
          <div className="tr-fila">
            <select aria-label="Look" value={editor.look} onChange={(ev) => accion({ tipo: 'look', look: ev.target.value })}>
              {LOOKS_DE_TRAMA.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.nombre}
                </option>
              ))}
            </select>
            <select aria-label="Tinta" value={editor.dibujo.tinta} onChange={(ev) => accion({ tipo: 'tinta', tinta: ev.target.value as TintaElegida })}>
              <option value="auto">Tinta automática</option>
              <option value="luz">Luz (suma)</option>
              <option value="tinta">Tinta (oscurece)</option>
            </select>
          </div>
          <div className="tr-seg" role="group" aria-label="Dibujo">
            {MODOS.map((m) => (
              <button key={m} aria-pressed={editor.dibujo.modo === m} onClick={() => accion({ tipo: 'modo-de-dibujo', modo: m })}>
                {NOMBRE_DE_MODO[m]}
              </button>
            ))}
          </div>

          <span className="cm-et">Colores</span>
          <div className="tr-colores">
            {(['fondo', 'lejos', 'cerca'] as const).map((k) => {
              const c = colores[k];
              const rol = c.origen === 'adn' && c.rol ? c.rol.split(':').slice(1).join(' · ') : null;
              return (
                <label key={k} className="tr-color">
                  <input type="color" value={c.hex} onChange={(ev) => accion({ tipo: 'color', clave: k, hex: ev.target.value })} />
                  <span>
                    <b>{NOMBRE_DE_COLOR[k]}</b>
                    <em className={rol ? 'adn' : editor.colores[k] ? 'propio' : ''}>{rol ? `del ADN · ${rol}` : editor.colores[k] ? 'propio' : 'del look'}</em>
                  </span>
                </label>
              );
            })}
          </div>
          <button className="btn chico" disabled={Object.keys(editor.colores).length === 0} onClick={() => accion({ tipo: 'volver-al-adn' })}>
            {hayColoresDelAdn ? 'Volver al ADN' : 'Volver a los del look'}
          </button>

          <span className="cm-et">Forma</span>
          <div className="tr-deslizadores">
            {CONTROLES_DE_TRAMA.map((p) => {
              const info = PARAMETRO_ANIMABLE[p];
              if (!info) return null;
              const v = editor.configuracion[p];
              return (
                <label key={p} className="cm-param">
                  <span className="tr-et">
                    {info.etiqueta} <b className="mono">{Number.isInteger(v) ? v : v.toFixed(2).replace('.', ',')}</b>
                  </span>
                  <input
                    type="range"
                    min={info.min}
                    max={info.max}
                    step={info.paso}
                    value={v}
                    onChange={(ev) => accion({ tipo: 'parametro', parametro: p, valor: Number(ev.target.value) })}
                  />
                </label>
              );
            })}
          </div>

          <span className="cm-et">Formato y tiempo</span>
          <label className="cm-param">
            <span className="tr-et">Formato</span>
            <select value={editor.formato} onChange={(ev) => accion({ tipo: 'formato', formato: ev.target.value })}>
              {formatos.map((f) => (
                <option key={f.valor} value={f.valor}>
                  {f.etiqueta}
                </option>
              ))}
              {editor.formato === FORMATO_IMPORTADO ? <option value={FORMATO_IMPORTADO}>El de la trama importada</option> : null}
            </select>
          </label>
          <label className="cm-param">
            <span className="tr-et">Semilla (momento de partida)</span>
            <input
              type="number"
              min={0}
              max={1000}
              step={0.5}
              value={editor.semilla}
              onChange={(ev) => accion({ tipo: 'semilla', semilla: Number(ev.target.value) })}
            />
          </label>
          <div className="tr-seg" role="group" aria-label="Tiempo">
            <button aria-pressed={!enSecuencia} onClick={() => accion({ tipo: 'modo', modo: 'vivo' })}>
              En vivo
            </button>
            <button aria-pressed={enSecuencia} onClick={() => accion({ tipo: 'modo', modo: 'secuencia' })}>
              Secuencia
            </button>
          </div>
          {enSecuencia ? (
            <>
              <label className="cm-param">
                <span className="tr-et">Duración (s)</span>
                <input type="number" min={1} max={600} step={1} value={editor.duracion} onChange={(ev) => accion({ tipo: 'duracion', duracion: Number(ev.target.value) })} />
              </label>
              <label className="cm-param cm-si-no">
                <input type="checkbox" checked={editor.cerrarCiclo} onChange={(ev) => accion({ tipo: 'cerrar-ciclo', cerrar: ev.target.checked })} />
                <span>
                  Cerrar el ciclo
                  <em>Termina en la primera escena, para repetirse sin costura.</em>
                </span>
              </label>
            </>
          ) : (
            <label className="cm-param cm-si-no">
              <input type="checkbox" checked={editor.interaccion.cursor} onChange={(ev) => accion({ tipo: 'cursor', activo: ev.target.checked })} />
              <span>
                Sigue al cursor
                <em>En vivo, la lámina se deforma bajo el cursor (prueba sobre la vista previa).</em>
              </span>
            </label>
          )}

          <span className="cm-et">Importar</span>
          <textarea
            className="tr-receta mono"
            aria-label="Código o archivo de trama"
            placeholder="Pega un código CT1. o SP1., o un archivo de trama en JSON"
            value={receta}
            onChange={(ev) => setReceta(ev.target.value)}
            rows={3}
          />
          <div className="tr-fila">
            <button className="btn chico" disabled={receta.trim() === ''} onClick={() => importar(receta)}>
              Leer
            </button>
            <label className="btn chico">
              Abrir archivo…
              <input type="file" accept=".json,.txt,application/json,text/plain" hidden onChange={(ev) => void abrirArchivo(ev)} />
            </label>
          </div>
          {errorDeImportar ? <p className="tr-error">{errorDeImportar}</p> : null}

          <span className="cm-et">Descargar</span>
          <div className="tr-salidas">
            <button className="btn fuerte" disabled={!trama.ok || ocupado !== null || video !== null} onClick={() => void exportarCelula()}>
              {ocupado === 'celula' ? 'Generando…' : 'Célula Madre (.zip)'}
            </button>
            <span className="tenue">Archivo de trama para Publisher, código CT1 e imagen SVG, con su LEEME.</span>
            <button className="btn" disabled={!trama.ok || ocupado !== null || video !== null} onClick={() => void exportarPng()}>
              {ocupado === 'png' ? 'Armando…' : 'Imagen PNG'}
            </button>
            <span className="tenue">El instante que está en pantalla, quieto, en la medida del formato.</span>
            {puedeGrabar ? (
              video ? (
                <>
                  <button className="btn" onClick={() => video.grabacion.cancelar()}>
                    Cancelar video
                  </button>
                  <span className="tenue">Grabando… {Math.round(video.avance * 100)} %. Deja esta ventana a la vista hasta que termine.</span>
                </>
              ) : (
                <>
                  <button className="btn" disabled={!trama.ok || ocupado !== null} onClick={() => void exportarVideo()}>
                    Video .webm
                  </button>
                  <span className="tenue">
                    {enSecuencia ? 'Una vuelta de la secuencia' : 'Diez segundos en vivo'}, en tiempo real. Es un formato cerrado: no sigue al cursor.
                  </span>
                </>
              )
            ) : (
              <span className="tenue">Video: este navegador no puede grabarlo; próximamente.</span>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
