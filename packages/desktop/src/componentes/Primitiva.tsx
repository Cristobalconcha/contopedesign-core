/**
 * Dibuja una muestra: cada tipo de parámetro como lo que es. Ver
 * `dominio/primitivas.ts` para qué primitiva le toca a cada requisito.
 */
import { useEffect } from 'react';
import type { Muestra } from '../dominio/primitivas.js';
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
    case 'radio':
      return (
        <span className={`${clase} pr-radio`}>
          <div />
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
