/**
 * La pantalla de la trama (decisión 36): el generador de tramas v7, tal
 * cual, dentro de Células Madre.
 *
 * Core genera las tramas; Publisher sólo las reproduce. El generador es la
 * página de v7 (`public/trama/generador-v7.html`) en un iframe que llena la
 * pantalla: presets, controles, galería de capturas, línea de tiempo con
 * escenas y pasadas grabadas, audio y video MP4 son los de v7, sin tocar.
 * Calcula con el motor único (`ContopeTrama`).
 *
 * Esta pantalla sólo hace de puente (ver `dominio/trama.ts`):
 * - le pasa al generador los colores del ADN como valores de partida y los
 *   formatos de hoja del ADN; «Volver al ADN» se los vuelve a pasar;
 * - abre una trama (archivo de trama, código CT1 o SP1) y se la pasa;
 * - cuando v7 guarda su trama («Exportar trama»), ofrece también su Célula
 *   Madre;
 * - pide la trama en pantalla y hace la Célula Madre (`.zip`: archivo de
 *   trama, código CT1 e imagen SVG, con su LEEME y la metadata de ancestro)
 *   por el mismo camino que los demás generadores.
 * Funciona también con un sistema sin ADN: v7 usa sus colores.
 */
import { generadorTrama } from '@contope/core';
import { leerTrama, type Trama } from '@contope/trama';
import { useEffect, useMemo, useRef, useState } from 'react';
import { generarEnElTaller, paraGuardar } from '../dominio/celulas.js';
import {
  coloresParaElGenerador,
  errorDeLectura,
  esMensajeDelGenerador,
  formatosParaElGenerador,
  FUENTE_DEL_GENERADOR,
  PAGINA_DEL_GENERADOR,
  parametrosDeCelula,
  type MensajeAlGenerador,
} from '../dominio/trama.js';
import { useTaller } from '../taller.js';

type SinFuente<T> = T extends unknown ? Omit<T, 'fuente'> : never;

function quiereQuietud(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function GeneradorDeTrama(props: { volver(): void }) {
  const { sistema, puente, despachar, avisar } = useTaller();
  const set = sistema.designSet;
  const colores = useMemo(() => coloresParaElGenerador(set), [set]);
  const formatos = useMemo(() => formatosParaElGenerador(set), [set]);
  const hayColoresDelAdn = Object.keys(colores).length > 0;

  const marco = useRef<HTMLIFrameElement | null>(null);
  /** La última trama guardada con «Exportar trama» de v7: se ofrece su Célula Madre. */
  const [exportada, setExportada] = useState<Trama | null>(null);
  const [listo, setListo] = useState(false);
  const pedidos = useRef(new Map<number, (r: { trama: Trama } | { error: string }) => void>());
  const siguiente = useRef(1);

  const enviar = (m: SinFuente<MensajeAlGenerador>): void => {
    marco.current?.contentWindow?.postMessage({ fuente: FUENTE_DEL_GENERADOR, ...m }, '*');
  };

  // Lo que dice el generador: «listo» (se le pasa el ADN) y las tramas pedidas.
  useEffect(() => {
    const alRecibir = (ev: MessageEvent): void => {
      if (ev.source !== marco.current?.contentWindow || !esMensajeDelGenerador(ev.data)) return;
      const m = ev.data;
      if (m.tipo === 'listo') {
        setListo(true);
        enviar({ tipo: 'iniciar', colores, formatos, quietud: quiereQuietud() });
        marco.current?.contentWindow?.focus();
        return;
      }
      if (m.tipo === 'trama-exportada') {
        setExportada(m.trama);
        return;
      }
      const resolver = pedidos.current.get(m.pedido);
      pedidos.current.delete(m.pedido);
      resolver?.('error' in m ? { error: m.error } : { trama: m.trama });
    };
    window.addEventListener('message', alRecibir);
    return () => window.removeEventListener('message', alRecibir);
  }, [colores, formatos]);

  const pedirTrama = (): Promise<Trama> =>
    new Promise((resolver, rechazar) => {
      const pedido = siguiente.current++;
      const plazo = window.setTimeout(() => {
        pedidos.current.delete(pedido);
        rechazar(new Error('El generador no respondió. Vuelve a intentarlo.'));
      }, 10_000);
      pedidos.current.set(pedido, (r) => {
        window.clearTimeout(plazo);
        if ('error' in r) rechazar(new Error(`No se pudo armar la trama: ${r.error}`));
        else resolver(r.trama);
      });
      enviar({ tipo: 'pedir-trama', pedido });
    });

  // El iframe llena lo que queda de la ventana bajo la cabecera.
  const [alto, setAlto] = useState(640);
  const medir = (): void => {
    const arriba = marco.current?.getBoundingClientRect().top ?? 0;
    setAlto(Math.max(512, Math.round(window.innerHeight - Math.max(0, arriba) - 16)));
  };
  // después de cada render (un aviso arriba lo corre hacia abajo) y al cambiar la ventana
  useEffect(medir);
  useEffect(() => {
    window.addEventListener('resize', medir);
    return () => window.removeEventListener('resize', medir);
  }, []);

  // Al abrir, la pantalla parte desde arriba (el menú pudo haber quedado bajado).
  const seccion = useRef<HTMLElement | null>(null);
  useEffect(() => seccion.current?.scrollIntoView({ block: 'start' }), []);

  // --- abrir una trama ----------------------------------------------------------
  const [errorDeAbrir, setErrorDeAbrir] = useState<string | null>(null);
  const abrirArchivo = async (ev: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
    const archivo = ev.target.files?.[0];
    ev.target.value = '';
    if (!archivo) return;
    if (archivo.size > 2_000_000) {
      setErrorDeAbrir('No se pudo leer la trama: el archivo es demasiado grande (máximo 2 MB).');
      return;
    }
    const r = leerTrama(await archivo.text());
    if (!r.ok) {
      setErrorDeAbrir(errorDeLectura(r.errores));
      return;
    }
    setErrorDeAbrir(null);
    enviar({ tipo: 'importar', trama: r.trama });
    const como = { json: 'archivo de trama', objeto: 'archivo de trama', ct1: 'código CT1', sp1: 'código SP1 de v7' }[r.origen];
    avisar(`Trama abierta (${como}).${r.avisos.length ? ` Ojo: ${r.avisos.join('; ')}.` : ''}`);
  };

  // --- la Célula Madre ----------------------------------------------------------
  const [ocupado, setOcupado] = useState(false);
  const exportarCelula = async (dada?: Trama): Promise<void> => {
    setOcupado(true);
    try {
      const trama = dada ?? (await pedirTrama());
      const r = generarEnElTaller(sistema, generadorTrama, parametrosDeCelula(trama));
      if (!r.ok) {
        avisar(r.falta, 'error');
        return;
      }
      const destino = await puente.guardarArchivo(paraGuardar(r.zip));
      if (destino === null) return;
      despachar({ tipo: 'registrar-celula', celula: r.celula });
      if (dada) setExportada(null);
      avisar(`Trama: ${r.zip.nombre} (${r.celula.archivos.map((a) => a.nombre).join(', ')} y su LEEME.md) en ${destino}. Guarda el sistema para que recuerde lo generado.`);
    } catch (error) {
      avisar((error as Error).message, 'error');
    } finally {
      setOcupado(false);
    }
  };

  return (
    <section className="cm tr" ref={seccion}>
      <div className="tr-cab">
        <div className="cm-cab">
          <button className="btn chico" onClick={props.volver}>
            ← Células Madre
          </button>
          <h2>Trama</h2>
          <p>
            El generador de la superficie de puntos{hayColoresDelAdn ? ', con los colores del ADN como punto de partida' : ''}. Captura momentos, ármalos en la
            línea de tiempo, graba video y descarga la Célula Madre: el archivo de trama vivo para Publisher, su código de una línea y una imagen quieta.
            {hayColoresDelAdn ? '' : ' Este sistema todavía no define colores: se usan los del generador.'}
          </p>
        </div>
        <div className="tr-acciones">
          <button className="btn chico" disabled={!listo || !hayColoresDelAdn} onClick={() => enviar({ tipo: 'colores', colores })} title="Vuelve a poner los colores del ADN">
            Volver al ADN
          </button>
          <label className="btn chico" aria-disabled={!listo} title="Un archivo de trama (.json) o un código CT1. o SP1. en un .txt">
            Abrir trama…
            <input type="file" accept=".json,.txt,application/json,text/plain" hidden disabled={!listo} onChange={(ev) => void abrirArchivo(ev)} />
          </label>
          <button className="btn fuerte" disabled={!listo || ocupado} onClick={() => void exportarCelula()} title="Archivo de trama para Publisher, código CT1 e imagen SVG, con su LEEME">
            {ocupado ? 'Generando…' : 'Célula Madre (.zip)'}
          </button>
        </div>
      </div>
      {errorDeAbrir ? <p className="tr-error">{errorDeAbrir}</p> : null}
      {exportada ? (
        <div className="tr-exportada" role="status">
          <span>
            Trama exportada desde el generador{exportada.nombre ? ` («${exportada.nombre}»)` : ''}, {exportada.tiempo.modo === 'secuencia' ? `secuencia de ${exportada.tiempo.duracion} s` : 'en vivo'}.
            Puedes bajarla también como Célula Madre, con su LEEME y su procedencia.
          </span>
          <button className="btn chico fuerte" disabled={ocupado} onClick={() => void exportarCelula(exportada)}>
            Célula Madre de esta trama
          </button>
          <button className="btn chico" onClick={() => setExportada(null)}>
            No, gracias
          </button>
        </div>
      ) : null}
      <iframe ref={marco} className="tr-generador" src={PAGINA_DEL_GENERADOR} title="Generador de tramas" style={{ height: `${alto}px` }} />
    </section>
  );
}
