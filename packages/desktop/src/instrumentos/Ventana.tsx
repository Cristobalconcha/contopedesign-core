import type { ReactNode } from 'react';
import { useTaller } from '../taller.js';

interface Props {
  titulo: string;
  por: string;
  pie: ReactNode;
  children: ReactNode;
  ancho?: 'normal' | 'angosto';
}

/** La ventana de un instrumento, sobre el taller. Escape y el velo la cierran. */
export function Ventana({ titulo, por, pie, children, ancho = 'normal' }: Props) {
  const { cerrarInstrumento } = useTaller();
  return (
    <>
      <div className="velo on" onClick={cerrarInstrumento} />
      <div className={`inst on ${ancho}`} role="dialog" aria-label={titulo}>
        <div className="inst-barra">
          <b>{titulo}</b>
          <span className="por">{por}</span>
          <button className="cerrar" onClick={cerrarInstrumento} title="Cerrar (Esc)">
            ✕
          </button>
        </div>
        <div className="inst-cuerpo">{children}</div>
        <div className="inst-pie">{pie}</div>
      </div>
    </>
  );
}
