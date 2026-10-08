/**
 * El registro de Células Madre y cómo se corre un generador.
 *
 * Agregar un generador es escribir su módulo (un `Generador`) y sumarlo a
 * `GENERADORES`. Nada más: el menú del taller los lista desde acá.
 */
import type { DesignSetV0 } from '../design-set/types.js';
import { generadorDegradadosSvg } from './generador-degradados-svg.js';
import { generadorPaletaAse } from './generador-paleta-ase.js';
import { huellaDeContenido } from './huella.js';
import { hermanoDe, metadataDeAncestro } from './metadata.js';
import type { ArchivoGenerado, Generador, MetadataDeCelula, Parametro, Parametros, SistemaDeOrigen, ValorDeParametro } from './tipos.js';

export const GENERADORES: readonly Generador[] = [generadorPaletaAse, generadorDegradadosSvg];

export function generadorPorId(id: string): Generador | undefined {
  return GENERADORES.find((g) => g.id === id);
}

/** Un parámetro con valor válido; lo que falta o no calza, con su valor por defecto. */
function resolverUno(p: Parametro, designSet: DesignSetV0, crudo: unknown): ValorDeParametro {
  switch (p.tipo) {
    case 'si-no':
      return typeof crudo === 'boolean' ? crudo : p.porDefecto;
    case 'numero':
      return typeof crudo === 'number' && Number.isFinite(crudo) ? Math.min(p.max, Math.max(p.min, crudo)) : p.porDefecto;
    case 'opcion':
      return typeof crudo === 'string' && p.opciones.some((o) => o.valor === crudo) ? crudo : p.porDefecto;
    case 'seleccion': {
      const validas = new Set(p.opciones(designSet).map((o) => o.valor));
      const elegidas = Array.isArray(crudo) ? [...new Set(crudo.filter((v): v is string => typeof v === 'string' && validas.has(v)))] : [];
      return elegidas.length >= Math.max(1, p.minimo ?? 1) ? elegidas : p.porDefecto(designSet);
    }
  }
}

/** Todos los parámetros del generador, resueltos contra este ADN. Lo que no es del esquema se ignora. */
export function resolverParametros(generador: Generador, designSet: DesignSetV0, crudos: Readonly<Record<string, unknown>> = {}): Parametros {
  const salida: Parametros = {};
  for (const p of generador.parametros) salida[p.id] = resolverUno(p, designSet, crudos[p.id]);
  return salida;
}

/** Un archivo escrito, como lo recuerda el taller: sin el contenido. */
export interface ArchivoRegistrado {
  nombre: string;
  tipoMime: string;
  huella: string;
}

export type ResultadoDeGeneracion =
  | {
      ok: true;
      /** Cada archivo seguido de su `.contope.json` hermano. */
      archivos: ArchivoGenerado[];
      metadata: MetadataDeCelula;
      /** Los archivos principales (sin los hermanos), para el registro del taller. */
      registrados: ArchivoRegistrado[];
    }
  | { ok: false; falta: string };

/**
 * Corre un generador: comprueba que el ADN alcance, resuelve los parámetros,
 * arma la metadata común, genera y agrega el `.contope.json` de cada archivo.
 * `generadoEn` se inyecta: con el mismo ADN, los mismos parámetros y la misma
 * fecha, los bytes son los mismos.
 */
export function generarCelula(
  generador: Generador,
  designSet: DesignSetV0,
  entrada: { sistema: SistemaDeOrigen; generadoEn: string; parametros?: Readonly<Record<string, unknown>> },
): ResultadoDeGeneracion {
  const disponible = generador.disponible(designSet);
  if (!disponible.ok) return { ok: false, falta: disponible.falta };
  const parametros = resolverParametros(generador, designSet, entrada.parametros);
  const metadata = metadataDeAncestro({ generador, designSet, sistema: entrada.sistema, parametros, generadoEn: entrada.generadoEn });
  let principales: ArchivoGenerado[];
  try {
    principales = generador.generar(designSet, parametros, { sistema: entrada.sistema, generadoEn: entrada.generadoEn, metadata });
  } catch (error) {
    return { ok: false, falta: (error as Error).message };
  }
  const archivos = principales.flatMap((a) => {
    const { metadata: _m, ...hermano } = hermanoDe(metadata, a);
    return [a, hermano];
  });
  return {
    ok: true,
    archivos,
    metadata,
    registrados: principales.map((a) => ({ nombre: a.nombre, tipoMime: a.tipoMime, huella: huellaDeContenido(a.contenido) })),
  };
}
