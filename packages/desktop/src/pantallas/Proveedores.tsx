/**
 * La configuración de la IA del taller (decisión 32): qué proveedor y qué
 * modelo resuelven las preguntas asignadas a ContOpe. La persona elige un
 * preajuste (Claude, ChatGPT/Codex, DeepSeek, Z.ai, Ollama) o escribe el
 * suyo; la clave se cifra en el proceso principal y acá sólo se ve su máscara.
 * En el navegador (sin Electron) la configuración vive en localStorage y las
 * llamadas al modelo no están disponibles: la pantalla lo dice.
 */
import { useEffect, useState } from 'react';
import { PREAJUSTES, mascaraDe, nuevoIdDeProveedor, type Proveedor } from '../dominio/proveedores.js';
import type { EstadoDeIA, Puente } from '../puente/tipos.js';

/** Qué mostrar por la credencial de un proveedor en la lista, sin secretos. */
function textoDeCredencial(p: Proveedor, estado: EstadoDeIA): string {
  if (p.credencial === 'sesion-codex') {
    return estado.codex.sesion ? `sesión de ChatGPT${estado.codex.email ? ` · ${estado.codex.email}` : ''}` : 'sin sesión de ChatGPT';
  }
  if (p.credencial === 'ninguna') return 'sin clave';
  if (p.mascara !== undefined) return p.mascara;
  if (p.credencial === 'clave' && p.claveDeEntorno !== undefined) {
    return estado.entorno[p.id] === true
      ? `clave del equipo (${p.claveDeEntorno})`
      : `sin clave: pégala en Editar o define ${p.claveDeEntorno}`;
  }
  return 'clave guardada';
}

export function Proveedores({ puente, onVolver }: { puente: Puente; onVolver: () => void }) {
  const [estado, setEstado] = useState<EstadoDeIA | null>(null);
  const [editando, setEditando] = useState<Proveedor | null>(null);
  const [secreto, setSecreto] = useState('');
  const [aviso, setAviso] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  const cargar = async (): Promise<void> => {
    try {
      setEstado(await puente.ia.estado());
    } catch (error) {
      setAviso((error as Error).message);
    }
  };
  useEffect(() => {
    void cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const correr = async (accion: () => Promise<EstadoDeIA>, hecho?: string): Promise<void> => {
    setOcupado(true);
    setAviso(null);
    try {
      setEstado(await accion());
      if (hecho) setAviso(hecho);
    } catch (error) {
      setAviso((error as Error).message);
    } finally {
      setOcupado(false);
    }
  };

  const nuevoDesde = (i: number): void => {
    const p = PREAJUSTES[i];
    if (!p) return;
    setSecreto('');
    setEditando({
      id: nuevoIdDeProveedor(),
      nombre: p.nombre,
      clase: p.clase,
      baseUrl: p.baseUrl,
      modelo: p.modelo,
      credencial: p.credencial,
      ...(p.claveDeEntorno !== undefined ? { claveDeEntorno: p.claveDeEntorno } : {}),
      ...(p.vision !== undefined ? { vision: p.vision } : {}),
      creadoEn: new Date().toISOString(),
    });
  };

  const guardar = async (): Promise<void> => {
    if (!editando) return;
    const conMascara: Proveedor = secreto.trim() !== '' ? { ...editando, mascara: mascaraDe(secreto.trim()) } : editando;
    await correr(() => puente.ia.guardarProveedor(conMascara, secreto.trim() !== '' ? secreto.trim() : null), 'Proveedor guardado.');
    setEditando(null);
    setSecreto('');
  };

  const probar = async (p: Proveedor): Promise<void> => {
    setOcupado(true);
    setAviso(null);
    try {
      const r = await puente.ia.pedir(p.id, {
        sistema: 'Responde en español de Chile, en una sola palabra.',
        usuario: 'Di «listo» si me lees.',
      });
      setAviso(r.ok ? `${p.nombre} respondió: «${r.texto.trim().slice(0, 80)}»` : `${p.nombre} no respondió: ${r.motivo}`);
    } catch (error) {
      setAviso((error as Error).message);
    } finally {
      setOcupado(false);
    }
  };

  const activo = estado?.configuracion.activo ?? null;

  return (
    <section className="stub prov">
      <span className="marca-stub">IA del taller</span>
      <h2>Qué modelo resuelve lo que le asignas a ContOpe</h2>
      <p>
        La IA que construye las definiciones asignadas a ContOpe vive en este programa y trabaja con la base de
        conocimiento propia. Elige un proveedor y un modelo; la clave se guarda cifrada en este equipo y nunca viaja
        dentro del archivo del sistema. Esta IA no es la de escritorio: la de escritorio toma el sistema terminado y
        hace el trabajo en el destino.
      </p>
      {puente.entorno === 'navegador' ? (
        <p className="tenue">
          En el navegador la configuración se guarda sin cifrar en este mismo navegador y las llamadas al modelo no están
          disponibles (los proveedores no aceptan llamadas desde una página): úsalo para revisar la pantalla. En la
          aplicación de escritorio funciona completo.
        </p>
      ) : estado && !estado.puedeCifrar ? (
        <p className="tenue">Este equipo no puede cifrar claves: se pueden usar proveedores sin clave (Ollama) o la sesión de ChatGPT.</p>
      ) : null}

      {aviso ? <p className="expl">{aviso}</p> : null}

      <h3>Proveedores configurados</h3>
      {estado === null ? (
        <p className="tenue">Leyendo…</p>
      ) : estado.configuracion.proveedores.length === 0 ? (
        <p className="tenue">Ninguno todavía. Agrega uno abajo.</p>
      ) : (
        <ul className="prov-lista">
          {estado.configuracion.proveedores.map((p) => (
            <li key={p.id} className={activo === p.id ? 'on' : ''}>
              <div className="prov-fila">
                <b>{p.nombre}</b>
                <span className="mono">{p.modelo}</span>
                {p.vision ? <span className="tenue">ve imágenes</span> : null}
                <span className="tenue">{p.baseUrl}</span>
                <span className="mono tenue">{textoDeCredencial(p, estado)}</span>
              </div>
              <div className="caminos">
                {activo === p.id ? (
                  <span className="resuelto">✓ en uso</span>
                ) : (
                  <button className="via v-ok" disabled={ocupado} onClick={() => void correr(() => puente.ia.activar(p.id))}>
                    Usar este
                  </button>
                )}
                {p.credencial === 'sesion-codex' ? (
                  estado.codex.sesion ? (
                    <button className="via" disabled={ocupado} onClick={() => void correr(() => puente.ia.cerrarSesionCodex(), 'Sesión cerrada.')}>
                      Cerrar sesión
                    </button>
                  ) : (
                    <button className="via v-ok" disabled={ocupado} onClick={() => void correr(() => puente.ia.iniciarSesionCodex(), 'Sesión iniciada.')}>
                      Iniciar sesión con ChatGPT
                    </button>
                  )
                ) : null}
                <button
                  className="via"
                  disabled={ocupado}
                  onClick={() => {
                    setSecreto('');
                    setEditando(p);
                  }}
                >
                  Editar
                </button>
                <button className="via" disabled={ocupado || puente.entorno === 'navegador'} onClick={() => void probar(p)}>
                  Probar
                </button>
                <button className="via peligro" disabled={ocupado} onClick={() => void correr(() => puente.ia.quitarProveedor(p.id), 'Proveedor quitado.')}>
                  Quitar
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <h3>Agregar un proveedor</h3>
      <div className="chips">
        {PREAJUSTES.map((p, i) => (
          <button key={p.nombre} className="chip2" title={p.nota} onClick={() => nuevoDesde(i)}>
            {p.nombre}
          </button>
        ))}
      </div>

      {editando ? (
        <div className="expl prov-form" style={{ borderLeftColor: 'var(--ia)' }}>
          <div className="rot">Nombre</div>
          <input value={editando.nombre} onChange={(e) => setEditando({ ...editando, nombre: e.target.value })} aria-label="Nombre del proveedor" />
          <div className="rot">Modelo</div>
          <input value={editando.modelo} onChange={(e) => setEditando({ ...editando, modelo: e.target.value })} aria-label="Modelo" />
          <div className="rot">Dirección base de la API</div>
          <input value={editando.baseUrl} onChange={(e) => setEditando({ ...editando, baseUrl: e.target.value })} aria-label="Dirección base" />
          {editando.credencial === 'clave' || editando.credencial === 'token-claude' ? (
            <>
              <div className="rot">{editando.credencial === 'token-claude' ? 'Token OAuth de Claude Code (sk-ant-oat…)' : 'Clave de API'}</div>
              <input
                type="password"
                value={secreto}
                placeholder={
                  editando.mascara
                    ? `guardada: ${editando.mascara} (escribe otra para reemplazarla)`
                    : editando.claveDeEntorno
                      ? `opcional: si no la pegas, se usa ${editando.claveDeEntorno} del equipo`
                      : ''
                }
                onChange={(e) => setSecreto(e.target.value)}
                aria-label="Clave"
              />
            </>
          ) : editando.credencial === 'sesion-codex' ? (
            <p className="tenue">La sesión de ChatGPT se inicia desde la lista, después de guardar.</p>
          ) : (
            <p className="tenue">Sin clave.</p>
          )}
          <div className="caminos" style={{ marginTop: '0.5rem' }}>
            <button className="via v-ok" disabled={ocupado || editando.nombre.trim() === '' || editando.modelo.trim() === '' || editando.baseUrl.trim() === ''} onClick={() => void guardar()}>
              Guardar
            </button>
            <button className="via" onClick={() => setEditando(null)}>
              Cancelar
            </button>
          </div>
        </div>
      ) : null}

      <p style={{ marginTop: '1.5rem' }}>
        <button className="btn" onClick={onVolver}>
          ← Volver
        </button>
      </p>
    </section>
  );
}
