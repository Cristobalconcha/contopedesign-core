/**
 * El fundamento cromático (dim1.req01), definido mirando parches y no
 * códigos. Dos grupos: institucionales y neutros. Cada color se elige con
 * el selector del sistema, se nombra, y se ve grande al lado de los demás.
 */
import { findEntry } from '@contope/core';
import { useMemo, useState } from 'react';
import { useTaller } from '../taller.js';
import { Ventana } from './Ventana.js';

interface Parche {
  name: string;
  value: string;
}

function parches(v: unknown): Parche[] {
  return Array.isArray(v)
    ? v.filter((x): x is Parche => typeof x === 'object' && x !== null && typeof (x as Parche).value === 'string').map((x) => ({ name: String(x.name ?? ''), value: x.value }))
    : [];
}

function esHexValido(v: string): boolean {
  return /^#[0-9a-f]{6}$/i.test(v);
}

export function ColorFundamento({ requirementId }: { requirementId: string }) {
  const { sistema, despachar, cerrarInstrumento } = useTaller();
  const entrada = findEntry(sistema.designSet, requirementId);
  const inicial = useMemo(() => {
    const p = (entrada?.payload as Record<string, unknown> | undefined) ?? {};
    return { institucionales: parches(p['institucionales']), neutros: parches(p['neutros']) };
  }, [entrada]);
  const [inst, setInst] = useState<Parche[]>(inicial.institucionales);
  const [neu, setNeu] = useState<Parche[]>(inicial.neutros);

  const grupos: Array<{ clave: 'institucionales' | 'neutros'; titulo: string; nota: string; lista: Parche[]; poner: (l: Parche[]) => void; otro: (l: Parche[]) => void; otraLista: Parche[] }> = [
    { clave: 'institucionales', titulo: 'Institucionales', nota: 'Los de la marca. Cada uno con su nombre, no sólo su código.', lista: inst, poner: setInst, otro: setNeu, otraLista: neu },
    { clave: 'neutros', titulo: 'Neutros', nota: 'Papel, tinta, grises: los que sostienen a los demás.', lista: neu, poner: setNeu, otro: setInst, otraLista: inst },
  ];

  const invalidos = [...inst, ...neu].filter((p) => !esHexValido(p.value) || !p.name.trim()).length;

  const guardar = (): void => {
    const payload = {
      ...((entrada?.payload as Record<string, unknown> | undefined) ?? {}),
      institucionales: inst.map((p) => ({ name: p.name.trim(), value: p.value.toLowerCase() })),
      neutros: neu.map((p) => ({ name: p.name.trim(), value: p.value.toLowerCase() })),
    };
    despachar({ tipo: 'definir', requirementId, payload, camino: 'diseñador', fuerza: entrada?.fuerza ?? 'explorable' });
    cerrarInstrumento();
  };

  return (
    <Ventana
      titulo="Definir el fundamento cromático"
      por={`${requirementId} · color.fundamento`}
      pie={
        <>
          <span className="aviso">
            {invalidos ? `${invalidos} parche${invalidos === 1 ? '' : 's'} sin nombre o sin color válido.` : !inst.length || !neu.length ? 'El requisito pide al menos un institucional y un neutro.' : 'Se guarda lo que estás viendo, con su procedencia: diseñador.'}
          </span>
          <button className="btn" onClick={cerrarInstrumento}>
            Cancelar
          </button>
          <button className="btn fuerte" onClick={guardar} disabled={invalidos > 0}>
            Guardar la definición
          </button>
        </>
      }
    >
      <div className="lienzo-color">
        <div className="escena">
          <div className="parches-grandes">
            {[...inst, ...neu].length === 0 ? <p className="tenue">Todavía no hay colores. Agrega el primero abajo.</p> : null}
            {inst.map((p, i) => (
              <div key={`i${i}`} className="parche" style={{ background: p.value }}>
                <span style={{ color: contraste(p.value) }}>
                  {p.name || 'sin nombre'}
                  <small>{p.value}</small>
                </span>
              </div>
            ))}
            {neu.map((p, i) => (
              <div key={`n${i}`} className="parche neutro" style={{ background: p.value }}>
                <span style={{ color: contraste(p.value) }}>
                  {p.name || 'sin nombre'}
                  <small>{p.value}</small>
                </span>
              </div>
            ))}
          </div>
          {inst.length && neu.length ? (
            <div className="sobre">
              {inst.map((c, i) =>
                neu.map((n, j) => (
                  <div key={`${i}-${j}`} className="sobre-celda" style={{ background: n.value, color: c.value }} title={`${c.name} sobre ${n.name}`}>
                    Aa
                  </div>
                )),
              )}
            </div>
          ) : null}
        </div>
        <div className="mandos mandos-color">
          {grupos.map((g) => (
            <div key={g.clave} className="grupo-color">
              <div className="grupo-cab">
                <b>{g.titulo}</b>
                <span className="tenue">{g.nota}</span>
                <button className="btn chico" onClick={() => g.poner([...g.lista, { name: '', value: '#808080' }])}>
                  + Agregar
                </button>
              </div>
              {g.lista.map((p, i) => (
                <div key={i} className="fila-color">
                  <input type="color" value={esHexValido(p.value) ? p.value : '#808080'} onChange={(e) => g.poner(g.lista.map((x, k) => (k === i ? { ...x, value: e.target.value } : x)))} aria-label="Color" />
                  <input className="buscar" placeholder="Nombre (oliva-700, papel…)" value={p.name} onChange={(e) => g.poner(g.lista.map((x, k) => (k === i ? { ...x, name: e.target.value } : x)))} />
                  <input className="buscar mono" value={p.value} onChange={(e) => g.poner(g.lista.map((x, k) => (k === i ? { ...x, value: e.target.value } : x)))} aria-label="Hex" />
                  <button
                    className="btn chico"
                    title={g.clave === 'institucionales' ? 'Mover a neutros' : 'Mover a institucionales'}
                    onClick={() => {
                      g.poner(g.lista.filter((_, k) => k !== i));
                      g.otro([...g.otraLista, p]);
                    }}
                  >
                    ⇄
                  </button>
                  <button className="btn chico" title="Quitar" onClick={() => g.poner(g.lista.filter((_, k) => k !== i))}>
                    ✕
                  </button>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </Ventana>
  );
}

/** Blanco o negro, lo que se lea encima; sólo para la etiqueta del parche. */
function contraste(hex: string): string {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m || m[1] === undefined) return '#000';
  const r = parseInt(m[1].slice(0, 2), 16);
  const g = parseInt(m[1].slice(2, 4), 16);
  const b = parseInt(m[1].slice(4, 6), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 140 ? '#1a1f23' : '#ffffff';
}
