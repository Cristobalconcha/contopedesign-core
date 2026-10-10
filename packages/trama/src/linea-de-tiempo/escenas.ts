/**
 * Escenas → keyframes (`regenerateScenes` de v7).
 *
 * Una ESCENA es una captura puesta en un instante, con su transición de
 * llegada: `corte` (cambio seco en ese instante) o `morph` (la lámina viaja
 * desde el estado anterior durante `duracion` segundos con una curva de
 * tiempo y llega exacta al instante marcado). Las escenas generan keyframes
 * sólo en las rutas que cambian; los keyframes hechos a mano no se tocan.
 *
 * CERRAR EL CICLO (decisión 36: «si se quiere que quede circular, partes y
 * terminas con el mismo snapshot»): se agrega una escena de cierre (id 0)
 * en el instante `duracion` cuya captura es el estado completo del instante
 * 0, evolución incluida. Así el último cuadro es el primero y la secuencia
 * se repite sin costura. Una escena del usuario en ese mismo instante queda
 * reemplazada por la de cierre.
 */
import type { Captura, ClaveDeColor, Escena, Keyframe, Pistas, RutaAnimable, TiempoSecuencia } from '../formato/tipos.js';
import type { ConfiguracionMotor } from '../motor/configuracion.js';
import { evolucionEn, valorEn, type DocumentoDeLinea } from './evaluar.js';
import { ajustarAGrilla, CUADROS_POR_SEGUNDO_LINEA, PARAMETROS_ANIMABLES, type ParametroAnimable } from './parametros.js';

/** Id reservado de la escena de cierre. */
export const ID_ESCENA_DE_CIERRE = 0;

/** El valor que una captura pide para una ruta, o `undefined` si no dice nada (`snapValue`). */
export function valorDeCaptura(c: Captura, ruta: RutaAnimable): number | string | undefined {
  if (ruta === 'evolucion') return c.evolucion;
  if (ruta === 'cursor.x') return c.cursor?.x;
  if (ruta === 'cursor.y') return c.cursor?.y;
  if (ruta === 'cursor.presencia') return c.cursor?.presencia;
  if (ruta.startsWith('color.')) return c.color?.[ruta.slice(6) as ClaveDeColor];
  return c.configuracion?.[ruta as keyof ConfiguracionMotor];
}

/** ¿Son el mismo valor, a la precisión del parámetro? (`sameVal`). */
export function mismoValor(a: number | string, b: number | string, p: Pick<ParametroAnimable, 'paso' | 'color'>): boolean {
  return p.color ? String(a).toLowerCase() === String(b).toLowerCase() : Math.abs(+a - +b) < Math.max(p.paso / 2, 1e-6);
}

/** La captura completa del estado de un documento en t (lo que «capturar» guardaría). */
export function capturaEn(doc: DocumentoDeLinea, t: number): Captura {
  const configuracion: Partial<ConfiguracionMotor> = {};
  const color: Partial<Record<ClaveDeColor, string>> = {};
  const cursor: { x?: number; y?: number; presencia?: number } = {};
  for (const p of PARAMETROS_ANIMABLES) {
    if (p.ruta === 'evolucion') continue;
    const v = valorEn(doc, p.ruta, t);
    if (p.ruta.startsWith('cursor.')) cursor[p.ruta.slice(7) as 'x' | 'y' | 'presencia'] = v as number;
    else if (p.color) color[p.ruta.slice(6) as ClaveDeColor] = v as string;
    else configuracion[p.ruta as keyof ConfiguracionMotor] = p.entero ? Math.round(v as number) : (v as number);
  }
  return { evolucion: evolucionEn(doc, t).tiempo, cursor, configuracion, color };
}

type BaseDeDocumento = Pick<DocumentoDeLinea, 'configuracion' | 'colores'>;

/** Lo que el aplicador de escenas necesita de un parámetro (los de `PARAMETROS_ANIMABLES` lo cumplen). */
export interface ParametroDeEscena {
  ruta: string;
  paso: number;
  entero?: true;
  color?: true;
}

/** Lo que el aplicador necesita de una escena. */
export type EscenaParaKeyframes = Pick<Escena, 'id' | 't' | 'transicion' | 'duracion' | 'curva' | 'evolucion'>;

/**
 * El corazón de `regenerateScenes` de v7: devuelve `aplicar(escena)`, que
 * pone en `pistas` los keyframes de cada escena (en orden de t), sólo en
 * los parámetros cuyo valor cambia. `antes(p, t0)` es el valor de un
 * parámetro donde empieza la transición; `destino(escena, p)` el que pide
 * la escena (`undefined`: no dice nada). La ruta `evolucion` sólo entra si
 * la escena lleva la evolución. Sirve igual para rutas que no están en el
 * formato (las de otro generador de v7).
 */
export function aplicadorDeEscenas<E extends EscenaParaKeyframes>(
  parametros: readonly ParametroDeEscena[],
  pistas: Record<string, Keyframe[]>,
  antes: (p: ParametroDeEscena, t0: number) => number | string,
  destino: (sc: E, p: ParametroDeEscena) => number | string | undefined | null,
): (sc: E) => void {
  const fr = 1 / CUADROS_POR_SEGUNDO_LINEA;
  let prevT = -Infinity;
  return (sc: E) => {
    const t = ajustarAGrilla(sc.t), corte = sc.transicion === 'corte';
    const espacio = Number.isFinite(prevT) ? Math.max(0, t - prevT - fr) : t;
    const dur = corte ? 0 : Math.min(sc.duracion, espacio);
    const t0 = ajustarAGrilla(Math.max(0, t - Math.max(dur, fr)));
    for (const p of parametros) {
      if (p.ruta === 'evolucion' && !sc.evolucion) continue;
      const meta = destino(sc, p);
      if (meta === undefined || meta === null) continue;
      const previo = antes(p, t0);
      if (mismoValor(previo, meta, p)) continue;
      const keys = pistas[p.ruta] ?? (pistas[p.ruta] = []);
      const poner = (k: Keyframe) => {
        const i = keys.findIndex((x) => Math.abs(x.t - k.t) < fr / 2);
        if (i >= 0) keys[i] = k; else keys.push(k);
      };
      if (t < fr) { // escena en el inicio: rige desde 0
        poner({ t: 0, v: meta, ease: 'lineal', escena: sc.id });
        continue;
      }
      if (corte || p.entero || dur < fr) {
        poner({ t: ajustarAGrilla(t - fr), v: previo, ease: 'mantener', escena: sc.id });
        poner({ t, v: meta, ease: 'lineal', escena: sc.id });
      } else {
        poner({ t: t0, v: previo, ease: 'curva', curva: [...sc.curva], escena: sc.id });
        poner({ t, v: meta, ease: 'lineal', escena: sc.id });
      }
      keys.sort((a, b) => a.t - b.t);
    }
    prevT = t;
  };
}

/**
 * Las pistas de una secuencia con los keyframes de sus escenas regenerados:
 * se quitan los que traían `escena` y se vuelven a generar en orden.
 */
export function regenerarPistas(tiempo: TiempoSecuencia, base: BaseDeDocumento): Pistas {
  const fr = 1 / CUADROS_POR_SEGUNDO_LINEA;
  const pistas: Pistas = {};
  for (const [ruta, keys] of Object.entries(tiempo.pistas) as [RutaAnimable, Keyframe[]][]) {
    const manuales = keys.filter((k) => k.escena === undefined).map((k) => ({ ...k }));
    if (manuales.length) pistas[ruta] = manuales;
  }
  const doc: DocumentoDeLinea = { ...base, pistas, inicio: tiempo.inicio, cursor: tiempo.cursor };
  let lista = tiempo.escenas.slice().sort((a, b) => a.t - b.t);
  const fin = ajustarAGrilla(tiempo.duracion);
  if (tiempo.cerrarCiclo) lista = lista.filter((sc) => Math.abs(ajustarAGrilla(sc.t) - fin) >= fr / 2);
  const aplicar = aplicadorDeEscenas<Escena>(
    PARAMETROS_ANIMABLES,
    pistas as Record<string, Keyframe[]>,
    (p, t0) => (p.ruta === 'evolucion' ? evolucionEn(doc, t0).tiempo : valorEn(doc, p.ruta as RutaAnimable, t0)),
    (sc, p) => valorDeCaptura(sc.captura, p.ruta as RutaAnimable),
  );
  for (const sc of lista) aplicar(sc);
  if (tiempo.cerrarCiclo) {
    aplicar({
      id: ID_ESCENA_DE_CIERRE, t: fin, captura: capturaEn(doc, 0), evolucion: true,
      transicion: tiempo.cierre.transicion, duracion: tiempo.cierre.duracion, curva: tiempo.cierre.curva,
    });
  }
  return pistas;
}
