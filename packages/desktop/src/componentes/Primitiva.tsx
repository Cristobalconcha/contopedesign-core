/**
 * Dibuja una muestra: cada tipo de parámetro como lo que es. Ver
 * `dominio/primitivas.ts` para qué primitiva le toca a cada requisito.
 */
import { useEffect } from 'react';
import type { Muestra, TonoDeEstado } from '../dominio/primitivas.js';
import { cargarMuestras } from '../navegador/fuentes.js';

export function Primitiva({ muestra, grande = false }: { muestra: Muestra; grande?: boolean }) {
  const clase = grande ? 'pr pr-g' : 'pr';
  const familia = muestra.tipo === 'familia' || muestra.tipo === 'roles' ? muestra.familia : null;
  useEffect(() => {
    if (familia !== null) cargarMuestras([familia]);
  }, [familia]);
  switch (muestra.tipo) {
    case 'color':
      return (
        <span className={`${clase} pr-color`} style={{ gridTemplateColumns: `repeat(${Math.min(muestra.colores.length, 8)}, 1fr)` }}>
          {muestra.colores.slice(0, 8).map((c, i) => (
            <i key={`${c}-${i}`} style={{ background: c }} title={c} />
          ))}
        </span>
      );
    case 'superficie':
      return (
        <span className={`${clase} pr-superficie`}>
          <div style={{ background: muestra.fondo, color: muestra.frente ?? 'inherit' }}>{muestra.frente ? 'Aa' : ''}</div>
        </span>
      );
    case 'familia':
      return (
        <span className={`${clase} pr-familia`} style={{ fontFamily: `'${muestra.familia}', ${muestra.generica}` }}>
          Aa
        </span>
      );
    case 'roles':
      return (
        <span className={`${clase} pr-roles`} style={{ fontFamily: `'${muestra.familia}', ${muestra.generica}` }}>
          <b>{muestra.titulo}</b>
          {muestra.cuerpo ? <s>{muestra.cuerpo}</s> : null}
        </span>
      );
    case 'espacio':
      return (
        <span className={`${clase} pr-espacio`}>
          {muestra.valores.slice(0, 4).map((v, i) => (
            <i key={`${v}-${i}`} style={{ width: anchoDe(v) }} title={v} />
          ))}
        </span>
      );
    case 'radio': {
      // El recuadro lee el payload: radio, borde y sombra van en línea — el
      // CSS sólo pone el tamaño del recuadro.
      const borde = muestra.borde;
      return (
        <span className={`${clase} pr-radio`}>
          <div
            style={{
              borderRadius: muestra.radio ?? '4px',
              border: borde
                ? `${borde.ancho} ${borde.estilo} ${borde.color ?? 'var(--tinta)'}`
                : '1.5px solid var(--acero)',
              ...(muestra.sombra ? { boxShadow: '0 2px 6px rgba(0,0,0,.25)' } : {}),
            }}
          />
        </span>
      );
    }
    case 'estados':
      return (
        <span className={`${clase} pr-estados`}>
          {muestra.estados.slice(0, 6).map((e, i) => (
            <i key={`${e.nombre}-${i}`} style={colorDeTono(e.tono)} title={e.nombre}>
              {e.nombre.slice(0, 5)}
            </i>
          ))}
        </span>
      );
    case 'movimiento':
      return (
        <span className={`${clase} pr-movimiento`}>
          {muestra.movimientos.slice(0, 5).map((m, i) => (
            <i key={`${m.nombre}-${i}`} style={{ width: anchoDeMs(m.ms) }} title={`${m.nombre} · ${m.ms}`} />
          ))}
        </span>
      );
    case 'arquetipos':
      return (
        <span className={`${clase} pr-arquetipos`}>
          {muestra.arquetipos.slice(0, 8).map((a, i) => (
            <i key={`${a.nombre}-${i}`} style={a.noAplica ? { borderStyle: 'dashed' } : {}} title={a.nombre}>
              {Array.from({ length: Math.min(a.slots ?? 0, 4) }, (_, j) => (
                <b
                  key={j}
                  style={{
                    display: 'block',
                    width: '2px',
                    height: '2px',
                    borderRadius: '50%',
                    background: 'var(--apagado)',
                  }}
                />
              ))}
            </i>
          ))}
        </span>
      );
    case 'imagen':
      return (
        <span className={`${clase} pr-imagen`}>
          {muestra.src ? <img src={muestra.src} alt="" /> : <div className="pr-imagen-vacia">{muestra.nota ?? 'imagen'}</div>}
        </span>
      );
    case 'reticula':
      return (
        <span className={`${clase} pr-reticula`}>
          {Array.from({ length: Math.min(muestra.columnas, 8) }, (_, i) => (
            <i key={i} />
          ))}
        </span>
      );
    case 'texto':
      return (
        <span className={`${clase} pr-texto`} title={muestra.texto}>
          {muestra.texto}
        </span>
      );
    case 'nada':
      return <span className={`${clase} pr-nada`}>sin definir</span>;
  }
}

/** Una longitud CSS a un ancho de barra legible (4px → 6px; 64px → 40px). */
function anchoDe(valor: string): string {
  const n = parseFloat(valor);
  if (!Number.isFinite(n)) return '8px';
  const px = valor.endsWith('rem') || valor.endsWith('em') ? n * 16 : valor.endsWith('pt') ? n * 1.333 : n;
  return `${Math.max(3, Math.min(40, Math.round(4 + Math.sqrt(px) * 4)))}px`;
}

/** Una duración en ms a un ancho de barra legible (0 ms → 3px; 5000 ms → 40px). */
function anchoDeMs(ms: number): string {
  const n = Math.max(0, Math.min(5000, ms));
  return `${Math.round(3 + Math.sqrt(n / 5000) * 37)}px`;
}

/** El color de cada tono: texto y borde teñidos; el fondo del panel lo pone el CSS. */
function colorDeTono(tono: TonoDeEstado): { color: string; borderColor: string } {
  switch (tono) {
    case 'ok':
      return { color: 'var(--ok)', borderColor: 'var(--ok)' };
    case 'aviso':
      return { color: 'var(--bronce)', borderColor: 'var(--bronce)' };
    case 'error':
      return { color: 'var(--error)', borderColor: 'var(--error)' };
    case 'acento':
      return { color: 'var(--acero)', borderColor: 'var(--acero)' };
    case 'neutro':
      return { color: 'var(--apagado)', borderColor: 'var(--linea)' };
  }
}
