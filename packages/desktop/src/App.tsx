import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { proyectarCapsula } from './dominio/capsula.js';
import { evaluar } from './dominio/evaluacion.js';
import { muestraDePayload } from './dominio/primitivas.js';
import { nombreDeArchivo, parsearSistema, serializarSistema } from './dominio/persistencia.js';
import { reducir, type Accion } from './dominio/reductor.js';
import { type Sistema } from './dominio/sistema.js';
import { Instrumentos } from './instrumentos/index.js';
import { Alcance } from './pantallas/Alcance.js';
import { Armonizacion } from './pantallas/Armonizacion.js';
import { Construccion } from './pantallas/Construccion.js';
import { Definicion } from './pantallas/Definicion.js';
import { Inicio } from './pantallas/Inicio.js';
import { Recoleccion } from './pantallas/Recoleccion.js';
import { obtenerPuente, type Reciente, type Vistazo } from './puente/index.js';
import { ContextoTaller, type Archivo, type Contexto, type Instrumento, type Pantalla, type Taller } from './taller.js';

type Evento =
  | { tipo: 'sistema'; sistema: Sistema; archivo: Archivo | null; pantalla: Pantalla }
  | { tipo: 'cerrar-sistema' }
  | { tipo: 'accion'; accion: Accion }
  | { tipo: 'guardado'; archivo: Archivo; guardadoEn: string }
  | { tipo: 'ir'; pantalla: Pantalla }
  | { tipo: 'instrumento'; instrumento: Instrumento | null }
  | { tipo: 'aviso'; aviso: Taller['aviso'] };

const INICIAL: Taller = { sistema: null, archivo: null, guardadoEn: null, pantalla: 'inicio', instrumento: null, aviso: null };

function reducirTaller(t: Taller, e: Evento): Taller {
  switch (e.tipo) {
    case 'sistema':
      return { ...t, sistema: e.sistema, archivo: e.archivo, guardadoEn: e.archivo ? e.sistema.actualizadoEn : null, pantalla: e.pantalla, instrumento: null };
    case 'cerrar-sistema':
      return { ...INICIAL };
    case 'accion':
      return t.sistema ? { ...t, sistema: reducir(t.sistema, e.accion) } : t;
    case 'guardado':
      return { ...t, archivo: e.archivo, guardadoEn: e.guardadoEn };
    case 'ir':
      return { ...t, pantalla: e.pantalla, instrumento: null };
    case 'instrumento':
      return { ...t, instrumento: e.instrumento };
    case 'aviso':
      return { ...t, aviso: e.aviso };
  }
}

function vistazoDe(sistema: Sistema, resueltos: number, total: number): Vistazo {
  const colores = muestraDePayload(sistema.designSet, 'dim1.req01');
  const familia = muestraDePayload(sistema.designSet, 'dim2.req01');
  return {
    mundo: sistema.mundo,
    nombre: sistema.nombre,
    colores: colores.tipo === 'color' ? colores.colores.slice(0, 4) : [],
    ...(familia.tipo === 'familia' ? { familia: familia.familia } : {}),
    resueltos,
    total,
  };
}

export function App() {
  const [taller, emitir] = useReducer(reducirTaller, INICIAL);
  const puente = useMemo(() => obtenerPuente(), []);
  const [recientes, setRecientes] = useState<Reciente[]>([]);
  const temporizadorAviso = useRef<number | null>(null);

  const avisar = useCallback((texto: string, tono: 'normal' | 'error' = 'normal') => {
    emitir({ tipo: 'aviso', aviso: { texto, tono } });
    if (temporizadorAviso.current !== null) window.clearTimeout(temporizadorAviso.current);
    temporizadorAviso.current = window.setTimeout(() => emitir({ tipo: 'aviso', aviso: null }), tono === 'error' ? 8000 : 4000);
  }, []);

  const cargarRecientes = useCallback(() => {
    void puente.listarRecientes().then(setRecientes).catch(() => setRecientes([]));
  }, [puente]);
  useEffect(cargarRecientes, [cargarRecientes]);

  const evaluacion = useMemo(() => (taller.sistema ? evaluar(taller.sistema) : null), [taller.sistema]);
  const sinGuardar = taller.sistema !== null && taller.guardadoEn !== taller.sistema.actualizadoEn;

  useEffect(() => {
    const avisarAntesDeCerrar = (e: BeforeUnloadEvent): void => {
      if (sinGuardar) e.preventDefault();
    };
    window.addEventListener('beforeunload', avisarAntesDeCerrar);
    return () => window.removeEventListener('beforeunload', avisarAntesDeCerrar);
  }, [sinGuardar]);

  const abrirDesde = useCallback(
    async (lector: () => Promise<{ ruta: string | null; nombre: string; texto: string } | null>) => {
      try {
        const archivo = await lector();
        if (!archivo) return;
        const sistema = parsearSistema(archivo.texto);
        const ev = evaluar(sistema);
        emitir({ tipo: 'sistema', sistema, archivo: { ruta: archivo.ruta, nombre: archivo.nombre }, pantalla: 'definicion' });
        await puente.registrarReciente(archivo.ruta, archivo.nombre, vistazoDe(sistema, ev.resueltos, ev.total));
        cargarRecientes();
      } catch (error) {
        avisar((error as Error).message, 'error');
      }
    },
    [avisar, cargarRecientes, puente],
  );

  const guardar = useCallback(
    async (como: boolean) => {
      if (!taller.sistema || !evaluacion) return;
      try {
        const texto = serializarSistema(taller.sistema);
        const sugerido = taller.archivo?.nombre ?? nombreDeArchivo(taller.sistema);
        const vistazo = vistazoDe(taller.sistema, evaluacion.resueltos, evaluacion.total);
        const r = como
          ? await puente.guardarSistemaComo(sugerido, texto, vistazo)
          : await puente.guardarSistema(sugerido, texto, taller.archivo?.ruta ?? null, vistazo);
        if (!r) return;
        emitir({ tipo: 'guardado', archivo: { ruta: r.ruta, nombre: r.nombre }, guardadoEn: taller.sistema.actualizadoEn });
        avisar(puente.entorno === 'navegador' ? `Descargado como ${r.nombre}` : `Guardado en ${r.nombre}`);
        cargarRecientes();
      } catch (error) {
        avisar((error as Error).message, 'error');
      }
    },
    [avisar, cargarRecientes, evaluacion, puente, taller.archivo, taller.sistema],
  );

  const exportarCapsula = useCallback(async () => {
    if (!taller.sistema) return;
    try {
      const capsula = proyectarCapsula(taller.sistema);
      const destino = await puente.exportarCapsula(capsula.archivos);
      if (destino === null) return;
      emitir({ tipo: 'accion', accion: { tipo: 'registrar-capsula', contrato: capsula.contrato } });
      avisar(`Cápsula exportada (revisión ${capsula.contrato.design.revision}) en ${destino}`);
    } catch (error) {
      avisar((error as Error).message, 'error');
    }
  }, [avisar, puente, taller.sistema]);

  useEffect(() => {
    const atajos = (e: KeyboardEvent): void => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        void guardar(e.shiftKey);
      }
      if (e.key === 'Escape' && taller.instrumento) emitir({ tipo: 'instrumento', instrumento: null });
    };
    window.addEventListener('keydown', atajos);
    return () => window.removeEventListener('keydown', atajos);
  }, [guardar, taller.instrumento]);

  const contexto: Contexto | null =
    taller.sistema && evaluacion
      ? {
          taller,
          sistema: taller.sistema,
          evaluacion,
          puente,
          despachar: (accion) => emitir({ tipo: 'accion', accion }),
          ir: (pantalla) => emitir({ tipo: 'ir', pantalla }),
          abrir: (instrumento) => emitir({ tipo: 'instrumento', instrumento }),
          cerrarInstrumento: () => emitir({ tipo: 'instrumento', instrumento: null }),
          avisar,
        }
      : null;

  const cerrarSistema = (): void => {
    if (sinGuardar && !window.confirm('Hay cambios sin guardar. ¿Cerrar igual?')) return;
    emitir({ tipo: 'cerrar-sistema' });
    cargarRecientes();
  };

  return (
    <div className="app">
      <header className="barra">
        <button className="marca" onClick={() => (taller.sistema ? cerrarSistema() : undefined)} title="Volver al inicio">
          ContOpe Design
        </button>
        {taller.sistema && contexto ? (
          <>
            <input
              className="nombre-sistema"
              value={taller.sistema.nombre}
              onChange={(e) => contexto.despachar({ tipo: 'renombrar', nombre: e.target.value })}
              aria-label="Nombre del sistema"
            />
            <span className={`estado-archivo ${sinGuardar ? 'sucio' : ''}`}>
              {taller.archivo ? taller.archivo.nombre : 'sin guardar todavía'}
              {sinGuardar ? ' · cambios sin guardar' : ''}
            </span>
            <nav className="fases">
              {(
                [
                  ['alcance', 'Alcance'],
                  ['recoleccion', 'Recolección'],
                  ['definicion', 'Definición'],
                  ['construccion', 'Construcción'],
                  ['armonizacion', 'Armonización'],
                ] as Array<[Pantalla, string]>
              ).map(([p, n], i) => (
                <span key={p} className="fase-grupo">
                  {i > 0 ? <span className="flechita">›</span> : null}
                  <button
                    className={`fase ${taller.pantalla === p ? 'on' : ''}`}
                    onClick={() => contexto.ir(p)}
                    title={p === 'armonizacion' ? 'Primer dibujo, para conversar' : undefined}
                  >
                    {n}
                  </button>
                </span>
              ))}
            </nav>
            <div className="acciones-barra">
              <button className="btn" onClick={() => void guardar(false)} title="Ctrl+S">
                Guardar
              </button>
              <button className="btn" onClick={() => void guardar(true)} title="Ctrl+Shift+S">
                Guardar como…
              </button>
              <button className="btn fuerte" onClick={() => void exportarCapsula()} title="design-contract.json + DESIGN.md">
                Exportar cápsula
              </button>
            </div>
          </>
        ) : (
          <span className="estado-archivo">{puente.entorno === 'navegador' ? 'en el navegador' : ''}</span>
        )}
      </header>

      <main className="lienzo">
        {taller.sistema && contexto ? (
          <ContextoTaller.Provider value={contexto}>
            {taller.pantalla === 'alcance' ? <Alcance /> : null}
            {taller.pantalla === 'recoleccion' ? <Recoleccion /> : null}
            {taller.pantalla === 'definicion' ? <Definicion /> : null}
            {taller.pantalla === 'construccion' ? <Construccion /> : null}
            {taller.pantalla === 'armonizacion' ? <Armonizacion /> : null}
            {taller.pantalla === 'inicio' ? <Definicion /> : null}
            <Instrumentos />
          </ContextoTaller.Provider>
        ) : (
          <Inicio
            recientes={recientes}
            entorno={puente.entorno}
            onNuevo={(sistema) => emitir({ tipo: 'sistema', sistema, archivo: null, pantalla: 'alcance' })}
            onAbrir={() => void abrirDesde(() => puente.abrirSistema())}
            onAbrirReciente={(r) => void abrirDesde(() => puente.abrirReciente(r))}
          />
        )}
      </main>

      {taller.aviso ? <div className={`aviso-flotante ${taller.aviso.tono}`}>{taller.aviso.texto}</div> : null}
    </div>
  );
}
