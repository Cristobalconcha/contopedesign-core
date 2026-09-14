/**
 * El editor estructurado: para todo requisito que todavía no tiene su
 * instrumento visual. Sigue el payloadSchema del núcleo campo por campo
 * (un color con su parche, una longitud con su unidad, una lista con sus
 * filas, una referencia eligiendo entre las definiciones ya hechas), y
 * evalúa en vivo con el evaluador real, mostrando por qué algo no está
 * resuelto. No es texto libre: es la forma exacta que el manifiesto pide.
 */
import {
  evaluateRequirement,
  findEntry,
  isRefValue,
  toPayloadsMap,
  type PayloadFieldSchema,
  type PayloadType,
  type RefValue,
  type VerificationRecordV0,
} from '@contope/core';
import { useMemo, useState } from 'react';
import { EXPLICACIONES } from '../dominio/explicaciones.js';
import { rectorasSinRestricciones } from '../dominio/evaluacion.js';
import { describir, escribir, leer, payloadInicial, valorInicial, type Ruta } from '../dominio/esquema.js';
import { dimensionDe, requisito } from '../dominio/manifiesto.js';
import { useTaller } from '../taller.js';
import { Ventana } from './Ventana.js';

function esRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

interface OpcionRef {
  refPath: Array<string | number>;
  etiqueta: string;
}

/** Las rutas dentro de una definición ya hecha a las que se puede apuntar. */
function opcionesDeRef(payload: unknown): OpcionRef[] {
  const salida: OpcionRef[] = [{ refPath: [], etiqueta: '(la definición entera)' }];
  const visitar = (v: unknown, ruta: Array<string | number>, prof: number): void => {
    if (salida.length > 240 || prof > 4) return;
    if (Array.isArray(v)) {
      v.forEach((x, i) => {
        const r = [...ruta, i];
        salida.push({ refPath: r, etiqueta: `${fmt(r)} · ${resumen(x)}` });
        visitar(x, r, prof + 1);
      });
    } else if (esRecord(v)) {
      for (const [k, x] of Object.entries(v)) {
        const r = [...ruta, k];
        if (!Array.isArray(x) && !esRecord(x)) salida.push({ refPath: r, etiqueta: `${fmt(r)} = ${resumen(x)}` });
        visitar(x, r, prof + 1);
      }
    }
  };
  visitar(payload, [], 0);
  return salida;
}

function fmt(ruta: ReadonlyArray<string | number>): string {
  return ruta.map((s) => (typeof s === 'number' ? `[${s}]` : `.${s}`)).join('').replace(/^\./, '');
}

function resumen(v: unknown): string {
  if (typeof v === 'string') return v.length > 24 ? `${v.slice(0, 24)}…` : v;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  if (Array.isArray(v)) return `lista de ${v.length}`;
  if (esRecord(v)) {
    const nombre = v['name'] ?? v['role'] ?? v['nombre'] ?? v['level'] ?? v['contexto'];
    return typeof nombre === 'string' ? nombre : `objeto (${Object.keys(v).join(', ')})`;
  }
  return String(v);
}

function esColor(v: string): boolean {
  return /^#[0-9a-f]{6}$/i.test(v);
}

interface CampoProps {
  tipo: PayloadType;
  valor: unknown;
  ruta: Ruta;
  poner(ruta: Ruta, v: unknown): void;
  refs(reqId: string | undefined): { entradas: Array<{ reqId: string; opciones: OpcionRef[] }> };
}

function Campo({ tipo, valor, ruta, poner, refs }: CampoProps) {
  switch (tipo.kind) {
    case 'texto':
      return <input className="buscar" value={typeof valor === 'string' ? valor : ''} onChange={(e) => poner(ruta, e.target.value)} />;
    case 'color-css': {
      const v = typeof valor === 'string' ? valor : '';
      return (
        <span className="campo-color">
          <input type="color" value={esColor(v) ? v : '#808080'} onChange={(e) => poner(ruta, e.target.value)} />
          <input className="buscar mono" value={v} placeholder="#rrggbb" onChange={(e) => poner(ruta, e.target.value)} />
        </span>
      );
    }
    case 'longitud-css':
      return <input className="buscar mono corto" value={typeof valor === 'string' ? valor : ''} placeholder="16px · 1rem · 12pt" onChange={(e) => poner(ruta, e.target.value)} />;
    case 'bool':
      return <input type="checkbox" checked={valor === true} onChange={(e) => poner(ruta, e.target.checked)} />;
    case 'numero':
      return (
        <input
          type="number"
          className="buscar corto"
          value={typeof valor === 'number' ? valor : ''}
          {...(tipo.min !== undefined ? { min: tipo.min } : {})}
          {...(tipo.max !== undefined ? { max: tipo.max } : {})}
          step="any"
          onChange={(e) => poner(ruta, e.target.value === '' ? undefined : Number(e.target.value))}
        />
      );
    case 'enum':
      return (
        <span className="chips">
          {tipo.values.map((v) => (
            <button key={v} className="chip2" aria-pressed={valor === v} onClick={() => poner(ruta, valor === v ? '' : v)}>
              {v}
            </button>
          ))}
        </span>
      );
    case 'ref': {
      const { entradas } = refs(tipo.reqId);
      const actual = isRefValue(valor) ? valor : null;
      if (!entradas.length) {
        return <span className="tenue">Referencia a {tipo.reqId ?? 'otra definición'}: todavía no hay nada definido ahí a lo que apuntar.</span>;
      }
      const clave = actual ? `${actual.refReqId}|${JSON.stringify(actual.refPath)}` : '';
      return (
        <select
          className="sel"
          value={clave}
          onChange={(e) => {
            if (e.target.value === '') {
              poner(ruta, null);
              return;
            }
            const [reqId, rutaJson] = e.target.value.split('|');
            const ref: RefValue = { refReqId: reqId ?? '', refPath: JSON.parse(rutaJson ?? '[]') as Array<string | number> };
            poner(ruta, ref);
          }}
        >
          <option value="">— elegir a qué apunta —</option>
          {entradas.map((en) => (
            <optgroup key={en.reqId} label={en.reqId}>
              {en.opciones.map((o) => (
                <option key={`${en.reqId}|${JSON.stringify(o.refPath)}`} value={`${en.reqId}|${JSON.stringify(o.refPath)}`}>
                  {o.etiqueta}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      );
    }
    case 'lista': {
      const lista = Array.isArray(valor) ? valor : [];
      return (
        <div className="lista-campo">
          {lista.map((item, i) => (
            <div key={i} className="item-lista">
              <span className="indice">{i + 1}</span>
              <div className="item-cuerpo">
                <Campo tipo={tipo.of} valor={item} ruta={[...ruta, i]} poner={poner} refs={refs} />
              </div>
              <button className="btn chico" title="Quitar" onClick={() => poner([...ruta, i], undefined)}>
                ✕
              </button>
            </div>
          ))}
          <button className="btn chico" onClick={() => poner([...ruta, lista.length], valorInicial(tipo.of))}>
            + Agregar {tipo.of.kind === 'objeto' ? 'uno' : 'valor'}
          </button>
        </div>
      );
    }
    case 'objeto': {
      const obj = esRecord(valor) ? valor : {};
      return (
        <div className="objeto-campo">
          {Object.entries(tipo.fields).map(([k, f]) => (
            <CampoConEtiqueta key={k} nombre={k} campo={f} valor={obj[k]} ruta={[...ruta, k]} poner={poner} refs={refs} />
          ))}
        </div>
      );
    }
    case 'union': {
      const ramas = tipo.of;
      const indiceActual = isRefValue(valor) ? ramas.findIndex((r) => r.kind === 'ref') : ramas.findIndex((r) => r.kind !== 'ref');
      const [rama, setRama] = useState(indiceActual >= 0 ? indiceActual : 0);
      const elegida = ramas[rama] ?? ramas[0];
      if (!elegida) return null;
      return (
        <div className="union-campo">
          <span className="chips">
            {ramas.map((r, i) => (
              <button
                key={i}
                className="chip2"
                aria-pressed={rama === i}
                onClick={() => {
                  setRama(i);
                  poner(ruta, valorInicial(r));
                }}
              >
                {r.kind === 'ref' ? `referencia a ${r.reqId ?? '…'}` : describir(r)}
              </button>
            ))}
          </span>
          <Campo tipo={elegida} valor={valor} ruta={ruta} poner={poner} refs={refs} />
        </div>
      );
    }
  }
}

function CampoConEtiqueta({ nombre, campo, valor, ruta, poner, refs }: { nombre: string; campo: PayloadFieldSchema; valor: unknown; ruta: Ruta; poner: CampoProps['poner']; refs: CampoProps['refs'] }) {
  const ausente = valor === undefined;
  return (
    <div className={`campo ${campo.optional ? 'opcional' : ''}`}>
      <label>
        <b>{nombre}</b>
        <span className="tenue">
          {describir(campo.type)}
          {campo.optional ? ' · opcional' : ''}
        </span>
      </label>
      {campo.optional && ausente ? (
        <button className="btn chico" onClick={() => poner(ruta, valorInicial(campo.type))}>
          + Declarar {nombre}
        </button>
      ) : (
        <div className="campo-valor">
          <Campo tipo={campo.type} valor={valor} ruta={ruta} poner={poner} refs={refs} />
          {campo.optional ? (
            <button className="btn chico" title="Quitar este campo opcional" onClick={() => poner(ruta, undefined)}>
              quitar
            </button>
          ) : null}
        </div>
      )}
    </div>
  );
}

export function EditorEstructurado({ requirementId }: { requirementId: string }) {
  const { sistema, evaluacion, despachar, cerrarInstrumento } = useTaller();
  const req = requisito(requirementId);
  const entrada = findEntry(sistema.designSet, requirementId);
  const [payload, setPayload] = useState<Record<string, unknown>>(() =>
    esRecord(entrada?.payload) ? (entrada.payload as Record<string, unknown>) : req ? payloadInicial(req.payloadSchema) : {},
  );
  const [evidencia, setEvidencia] = useState('');

  const pruebas = useMemo(() => (req?.validityPredicate ?? []).filter((c) => c.kind === 'verified').map((c) => (c as { pruebaId: string }).pruebaId), [req]);
  const verificaciones = useMemo(() => new Map<string, VerificationRecordV0>(sistema.verificaciones.map((v) => [v.pruebaId, v])), [sistema.verificaciones]);

  const resultado = useMemo(() => {
    if (!req) return null;
    const dim = dimensionDe(req.id);
    const store = new Map<string, Record<string, unknown>>();
    for (const [id, p] of toPayloadsMap(sistema.designSet, dim)) if (id !== req.id && esRecord(p)) store.set(id, p);
    return evaluateRequirement({
      requisito: req,
      payload,
      store,
      rectoras: rectorasSinRestricciones(),
      dependencyResults: new Map(evaluacion.porRequisito),
      verifications: verificaciones,
    });
  }, [evaluacion.porRequisito, payload, req, sistema.designSet, verificaciones]);

  if (!req) return null;

  const poner = (ruta: Ruta, v: unknown): void => setPayload((p) => escribir(p, ruta, v) as Record<string, unknown>);

  const refs = (reqId: string | undefined) => {
    const candidatas = reqId ? [reqId] : sistema.designSet.entries.map((e) => e.requirementId).filter((id) => id !== req.id);
    return {
      entradas: candidatas
        .map((id) => findEntry(sistema.designSet, id))
        .filter((e): e is NonNullable<typeof e> => e !== undefined)
        .map((e) => ({ reqId: e.requirementId, opciones: opcionesDeRef(e.payload) })),
    };
  };

  const guardar = (): void => {
    despachar({ tipo: 'definir', requirementId, payload, camino: 'diseñador', fuerza: entrada?.fuerza ?? 'explorable' });
    cerrarInstrumento();
  };

  const motivos = resultado?.motivos.filter((m) => !m.codigo.startsWith('dependencia-')) ?? [];
  const deps = resultado?.motivos.filter((m) => m.codigo.startsWith('dependencia-')) ?? [];

  return (
    <Ventana
      titulo={req.pregunta}
      por={`${req.id} · ${req.packageId.replace(/^pkg\./, '')} · editor estructurado (este parámetro no tiene instrumento visual todavía)`}
      pie={
        <>
          <span className="aviso">
            {resultado?.resultado === 'resuelto'
              ? '✓ Con esto el requisito queda resuelto.'
              : `${motivos.length} motivo${motivos.length === 1 ? '' : 's'} pendiente${motivos.length === 1 ? '' : 's'}${deps.length ? ` y ${deps.length} dependencia${deps.length === 1 ? '' : 's'} sin resolver` : ''}. Se puede guardar igual: queda como definición incompleta.`}
          </span>
          <button className="btn" onClick={cerrarInstrumento}>
            Cancelar
          </button>
          <button className="btn fuerte" onClick={guardar}>
            Guardar la definición
          </button>
        </>
      }
    >
      <div className="editor">
        <div className="editor-campos">
          <p className="expl" style={{ margin: '0 0 1rem' }}>
            <b>Qué quiere decir.</b> {EXPLICACIONES[req.id]}
          </p>
          {Object.entries(req.payloadSchema).map(([k, f]) => (
            <CampoConEtiqueta key={k} nombre={k} campo={f} valor={payload[k]} ruta={[k]} poner={poner} refs={refs} />
          ))}
          {pruebas.length ? (
            <div className="verificacion">
              <b>Verificación registrada</b>
              <p className="tenue">Este requisito exige una prueba registrada ({pruebas.join(', ')}). Se guarda lo que declares como evidencia, con fecha. Medir por vos todavía no está construido.</p>
              {pruebas.map((p) => (
                <div key={p} className="campo">
                  <label>
                    <b>{p}</b>
                    <span className="tenue">{verificaciones.get(p) ? `registrada el ${verificaciones.get(p)?.fecha.slice(0, 10)}` : 'sin registrar'}</span>
                  </label>
                  <div className="campo-valor">
                    <input className="buscar" placeholder="Evidencia: cómo se midió y qué dio" value={evidencia} onChange={(e) => setEvidencia(e.target.value)} />
                    <button
                      className="btn chico"
                      disabled={!evidencia.trim()}
                      onClick={() => {
                        despachar({ tipo: 'registrar-verificacion', registro: { pruebaId: p, fecha: new Date().toISOString(), evidencia: evidencia.trim() } });
                        setEvidencia('');
                      }}
                    >
                      Registrar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </div>
        <aside className="editor-lado">
          <p className="rot" style={{ marginTop: 0 }}>
            Evaluación en vivo
          </p>
          {resultado?.resultado === 'resuelto' ? (
            <p className="ok">✓ resuelto</p>
          ) : (
            <ul className="motivos-lista">
              {motivos.map((m, i) => (
                <li key={i}>{m.mensaje}</li>
              ))}
              {deps.map((m, i) => (
                <li key={`d${i}`} className="tenue">
                  {m.mensaje}
                </li>
              ))}
            </ul>
          )}
          <p className="rot">Forma que pide el manifiesto</p>
          <ul className="forma">
            {Object.entries(req.payloadSchema).map(([k, f]) => (
              <li key={k}>
                <b>{k}</b>
                {f.optional ? '?' : ''} · {describir(f.type)}
              </li>
            ))}
          </ul>
          {req.dependsOn.length ? (
            <>
              <p className="rot">Depende de</p>
              <ul className="forma">
                {req.dependsOn.map((d) => (
                  <li key={d}>
                    {d} · {evaluacion.porRequisito.get(d)?.resultado ?? 'sin evaluar'}
                  </li>
                ))}
              </ul>
            </>
          ) : null}
          <p className="rot">Datos, tal cual</p>
          <pre className="json">{JSON.stringify(payload, null, 2)}</pre>
        </aside>
      </div>
    </Ventana>
  );
}

/** Para leer sin escribir, cuando haga falta desde fuera. */
export { leer };
