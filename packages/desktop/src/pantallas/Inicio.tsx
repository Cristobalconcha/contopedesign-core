/**
 * Inicio: «¿en qué vas a trabajar?» (INTERFAZ.md §1, pendiente de revisión).
 * Primero el mundo; abrir, con sus recientes; y una tira abajo con los
 * sistemas ya construidos, mostrados por sus primitivas.
 */
import { useState } from 'react';
import { MUNDOS, mundo as mundoDe, type MundoId } from '../dominio/mundos.js';
import { nuevoSistema, type Sistema } from '../dominio/sistema.js';
import type { Reciente } from '../puente/index.js';

const ICONO: Record<MundoId, string> = {
  editorial: 'M3 4h8v16H3zM13 4h8v16h-8zM6 8h2M6 11h2M16 8h2M16 11h2',
  marca: 'M12 2l8 4v6c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6zM9 11a3 3 0 1 0 6 0 3 3 0 1 0-6 0',
  digital: 'M2 5.5A1.5 1.5 0 0 1 3.5 4h17A1.5 1.5 0 0 1 22 5.5v10a1.5 1.5 0 0 1-1.5 1.5h-17A1.5 1.5 0 0 1 2 15.5zM8 21h8M12 17v4M6 8h5M6 11h8',
  campana: 'M3 10v4h4l6 4V6L7 10zM17 8c1.5 1.2 1.5 6.8 0 8M20 5c3 2.5 3 11.5 0 14',
};

interface Props {
  recientes: Reciente[];
  entorno: 'electron' | 'navegador';
  onNuevo(sistema: Sistema): void;
  onAbrir(): void;
  onAbrirReciente(r: Reciente): void;
}

function cuando(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const hoy = new Date();
  const mismoDia = d.toDateString() === hoy.toDateString();
  return mismoDia
    ? `hoy, ${d.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}`
    : d.toLocaleDateString('es-CL', { day: 'numeric', month: 'short' });
}

export function Inicio({ recientes, entorno, onNuevo, onAbrir, onAbrirReciente }: Props) {
  const [elegido, setElegido] = useState<MundoId | null>(null);
  const [nombre, setNombre] = useState('');
  const conVistazo = recientes.filter((r) => r.vistazo !== undefined);

  const empezar = (): void => {
    if (!elegido) return;
    onNuevo(nuevoSistema(elegido, nombre.trim() || `Sistema ${mundoDe(elegido).nombre.toLowerCase()}`));
  };

  return (
    <section className="inicio">
      <div className="inicio-cuerpo">
        <div className="inicio-main">
          <h1 className="pregunta-grande">¿En qué vas a trabajar?</h1>
          <p className="sub">
            Cada mundo trae su propio núcleo de definiciones: lo que no puede faltar para poder construir. Los cuatro
            están medidos sobre cosas reales de Santa Luisa: el digital sobre el sitio, el editorial sobre el folleto (más
            Claude Design e InDesign), la marca sobre su identidad (sin pieza de packaging todavía) y la campaña sobre las
            piezas para redes. Los cuatro comparten el mismo manifiesto de 84 preguntas en diez dimensiones; los cuatro
            mundos siguen siendo una propuesta sin confirmar.
          </p>
          <div className="mundos">
            {MUNDOS.map((m) => (
              <button key={m.id} className="mundo" aria-pressed={elegido === m.id} onClick={() => setElegido(m.id)}>
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
                  <path d={ICONO[m.id]} />
                </svg>
                <b>{m.nombre}</b>
                <span>{m.abarca}</span>
                <em>Su núcleo: {m.nucleo}</em>
              </button>
            ))}
          </div>
          <form
            className={`empezar ${elegido ? 'on' : ''}`}
            onSubmit={(e) => {
              e.preventDefault();
              empezar();
            }}
          >
            <label>
              <span className="rot">Nombre del sistema</span>
              <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder={elegido ? `Sistema ${mundoDe(elegido).nombre.toLowerCase()}` : ''} disabled={!elegido} />
            </label>
            <button className="btn fuerte" type="submit" disabled={!elegido}>
              Empezar en {elegido ? mundoDe(elegido).nombre : '…'} →
            </button>
          </form>
        </div>
        <aside className="inicio-lado">
          <button className="abrir" onClick={onAbrir}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M1.5 4.5h5l1.5 2h6.5v7a1 1 0 0 1-1 1h-11a1 1 0 0 1-1-1z" />
              <path d="M1.5 4.5v-2a1 1 0 0 1 1-1h3l1.5 2" />
            </svg>
            Abrir un sistema
          </button>
          <p className="rot">Recientes</p>
          {recientes.length === 0 ? (
            <p className="tenue">Nada todavía. {entorno === 'navegador' ? 'En el navegador los recientes se guardan en este mismo navegador.' : ''}</p>
          ) : (
            recientes.slice(0, 8).map((r) => (
              <button key={r.ruta} className="reciente" onClick={() => onAbrirReciente(r)} title={r.ruta}>
                <span className="chipc">
                  {(r.vistazo?.colores.length ? r.vistazo.colores : ['transparent']).slice(0, 4).map((c, i) => (
                    <i key={i} style={{ background: c }} />
                  ))}
                </span>
                <span>
                  <b>{r.vistazo?.nombre ?? r.nombre}</b>
                  <span>{cuando(r.abiertoEn)}</span>
                </span>
              </button>
            ))
          )}
        </aside>
      </div>
      <div className="tira">
        <div className="tira-cab">
          <h3>Sistemas que ya construiste</h3>
        </div>
        {conVistazo.length === 0 ? (
          <p className="tenue">Acá van a aparecer, mostrados por sus colores y su tipografía, los sistemas que guardes.</p>
        ) : (
          <div className="sets">
            {conVistazo.slice(0, 6).map((r) => {
              const v = r.vistazo!;
              const fondo = v.colores[v.colores.length - 1] ?? 'var(--panel2)';
              const tinta = v.colores[0] ?? 'var(--tinta)';
              return (
                <button key={r.ruta} className="set" onClick={() => onAbrirReciente(r)}>
                  <div className="muestra" style={{ background: fondo }}>
                    <div className="specimen" style={{ color: tinta, fontFamily: v.familia ? `'${v.familia}', serif` : undefined }}>
                      {v.familia ? 'Aa' : ''}
                    </div>
                    <div className="swatches">
                      {v.colores.map((c, i) => (
                        <i key={i} style={{ background: c }} />
                      ))}
                    </div>
                  </div>
                  <div className="pie">
                    <b>{v.nombre}</b>
                    <span>
                      {mundoDe(v.mundo as MundoId).nombre} · {v.resueltos}/{v.total}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
