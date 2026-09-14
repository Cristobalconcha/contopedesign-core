/**
 * La unidad espacial base y su escala (dim3.req01), mirando cajas con
 * texto adentro y no números sueltos. Una progresión lineal o geométrica
 * genera la escala; cada paso se puede corregir a mano.
 */
import { findEntry } from '@contope/core';
import { useMemo, useState } from 'react';
import { useTaller } from '../taller.js';
import { Ventana } from './Ventana.js';

type Unidad = 'px' | 'pt' | 'rem';
interface Paso {
  step: number;
  value: string;
}

function generar(base: number, unidad: Unidad, pasos: number, modo: 'lineal' | 'geometrica', razon: number): Paso[] {
  const salida: Paso[] = [];
  for (let i = 1; i <= pasos; i++) {
    const n = modo === 'lineal' ? base * i : base * Math.pow(razon, i - 1);
    const redondo = unidad === 'rem' ? Math.round(n * 1000) / 1000 : Math.round(n * 10) / 10;
    salida.push({ step: i, value: `${redondo}${unidad}` });
  }
  return salida;
}

function aPx(valor: string): number {
  const n = parseFloat(valor);
  if (!Number.isFinite(n)) return 0;
  if (valor.endsWith('rem') || valor.endsWith('em')) return n * 16;
  if (valor.endsWith('pt')) return n * (96 / 72);
  return n;
}

export function EscalaEspacial({ requirementId }: { requirementId: string }) {
  const { sistema, despachar, cerrarInstrumento } = useTaller();
  const entrada = findEntry(sistema.designSet, requirementId);
  const existente = useMemo(() => {
    const p = (entrada?.payload as { unidad?: string; escala?: Paso[] } | undefined) ?? {};
    return { unidad: typeof p.unidad === 'string' ? p.unidad : undefined, escala: Array.isArray(p.escala) ? p.escala : undefined };
  }, [entrada]);

  const unidadInicial = existente.unidad ?? '4px';
  const [base, setBase] = useState<number>(parseFloat(unidadInicial) || 4);
  const [unidad, setUnidad] = useState<Unidad>(unidadInicial.endsWith('rem') ? 'rem' : unidadInicial.endsWith('pt') ? 'pt' : 'px');
  const [pasos, setPasos] = useState<number>(existente.escala?.length ?? 6);
  const [modo, setModo] = useState<'lineal' | 'geometrica'>('lineal');
  const [razon, setRazon] = useState(1.5);
  const [escala, setEscala] = useState<Paso[]>(existente.escala ?? generar(4, 'px', 6, 'lineal', 1.5));

  const regenerar = (b = base, u = unidad, p = pasos, m = modo, r = razon): void => setEscala(generar(b, u, p, m, r));

  const guardar = (): void => {
    const payload = { ...((entrada?.payload as Record<string, unknown> | undefined) ?? {}), unidad: `${base}${unidad}`, escala };
    despachar({ tipo: 'definir', requirementId, payload, camino: 'diseñador', fuerza: entrada?.fuerza ?? 'explorable' });
    cerrarInstrumento();
  };

  return (
    <Ventana
      titulo="Definir la unidad y la escala espacial"
      por={`${requirementId} · espacio.fundamento`}
      pie={
        <>
          <span className="aviso">Se guarda la unidad ({base}{unidad}) y los {escala.length} pasos que estás viendo.</span>
          <button className="btn" onClick={cerrarInstrumento}>
            Cancelar
          </button>
          <button className="btn fuerte" onClick={guardar} disabled={!escala.length || !(base > 0)}>
            Guardar la definición
          </button>
        </>
      }
    >
      <div className="lienzo-esp">
        <div className="escena">
          <div className="regla">
            {escala.map((p) => {
              const px = aPx(p.value);
              return (
                <div key={p.step} className="paso-caja" style={{ padding: `${Math.min(px, 96)}px` }} title={`paso ${p.step}: ${p.value}`}>
                  <span className="paso-texto">Aa</span>
                  <em>
                    {p.step} · {p.value}
                  </em>
                </div>
              );
            })}
          </div>
          <div className="regla-lineal">
            {escala.map((p) => (
              <i key={p.step} style={{ width: `${Math.min(aPx(p.value), 320)}px` }}>
                <span>{p.value}</span>
              </i>
            ))}
          </div>
        </div>
        <div className="mandos">
          <div className="mando">
            <label htmlFor="e-base">Unidad base</label>
            <input
              id="e-base"
              type="number"
              min={0.125}
              step={unidad === 'rem' ? 0.125 : 1}
              value={base}
              onChange={(e) => {
                const b = Number(e.target.value);
                setBase(b);
                regenerar(b);
              }}
            />
            <select
              className="sel corto"
              value={unidad}
              onChange={(e) => {
                const u = e.target.value as Unidad;
                setUnidad(u);
                regenerar(base, u);
              }}
            >
              <option value="px">px</option>
              <option value="pt">pt</option>
              <option value="rem">rem</option>
            </select>
          </div>
          <div className="mando">
            <label htmlFor="e-pasos">Pasos</label>
            <input
              id="e-pasos"
              type="range"
              min={2}
              max={12}
              value={pasos}
              onChange={(e) => {
                const p = Number(e.target.value);
                setPasos(p);
                regenerar(base, unidad, p);
              }}
            />
            <output>{pasos}</output>
          </div>
          <div className="mando">
            <label>Progresión</label>
            <span className="chips">
              <button
                className="chip2"
                aria-pressed={modo === 'lineal'}
                onClick={() => {
                  setModo('lineal');
                  regenerar(base, unidad, pasos, 'lineal');
                }}
              >
                Múltiplos
              </button>
              <button
                className="chip2"
                aria-pressed={modo === 'geometrica'}
                onClick={() => {
                  setModo('geometrica');
                  regenerar(base, unidad, pasos, 'geometrica');
                }}
              >
                Geométrica
              </button>
            </span>
            {modo === 'geometrica' ? (
              <>
                <input
                  type="range"
                  min={1.1}
                  max={2}
                  step={0.05}
                  value={razon}
                  onChange={(e) => {
                    const r = Number(e.target.value);
                    setRazon(r);
                    regenerar(base, unidad, pasos, 'geometrica', r);
                  }}
                />
                <output>×{razon.toFixed(2)}</output>
              </>
            ) : null}
          </div>
          <div className="mando pasos-editables">
            <label>Cada paso</label>
            <span className="chips">
              {escala.map((p, i) => (
                <input key={p.step} className="buscar mono corto" value={p.value} onChange={(e) => setEscala(escala.map((x, k) => (k === i ? { ...x, value: e.target.value } : x)))} aria-label={`paso ${p.step}`} />
              ))}
            </span>
          </div>
        </div>
      </div>
    </Ventana>
  );
}
