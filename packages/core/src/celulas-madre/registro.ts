/**
 * El registro de Células Madre y cómo se corre un generador.
 *
 * Agregar un generador es escribir su módulo (un `Generador`) y sumarlo a
 * `GENERADORES`. Nada más: el menú del taller los lista desde acá.
 */
import type { DesignSetV0 } from '../design-set/types.js';
import { generadorDegradadosSvg } from './generador-degradados-svg.js';
import { generadorGrillaSvg } from './generador-grilla-svg.js';
import { generadorPaletaAse } from './generador-paleta-ase.js';
import { generadorTrama } from './generador-trama.js';
import { escribirLeeme } from './leeme.js';
import { metadataDeAncestro, registroDe } from './metadata.js';
import type {
  ArchivoGenerado,
  ArchivoRegistrado,
  Generador,
  MetadataDeCelula,
  Parametro,
  Parametros,
  SistemaDeOrigen,
  ValorDeParametro,
} from './tipos.js';
import { zipDeCelula } from './zip.js';

export const GENERADORES: readonly Generador[] = [generadorPaletaAse, generadorDegradadosSvg, generadorGrillaSvg, generadorTrama];

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
    case 'texto':
      return typeof crudo === 'string' && crudo.trim().length <= p.largoMaximo ? crudo.trim() : p.porDefecto;
    case 'seleccion': {
      const validas = new Set(p.opciones(designSet).map((o) => o.valor));
      const elegidas = Array.isArray(crudo) ? [...new Set(crudo.filter((v): v is string => typeof v === 'string' && validas.has(v)))] : [];
      const acotadas = p.maximo !== undefined ? elegidas.slice(0, Math.max(1, p.maximo)) : elegidas;
      return acotadas.length >= Math.max(1, p.minimo ?? 1) ? acotadas : p.porDefecto(designSet);
    }
  }
}

/** Todos los parámetros del generador, resueltos contra este ADN. Lo que no es del esquema se ignora. */
export function resolverParametros(generador: Generador, designSet: DesignSetV0, crudos: Readonly<Record<string, unknown>> = {}): Parametros {
  const salida: Parametros = {};
  for (const p of generador.parametros) salida[p.id] = resolverUno(p, designSet, crudos[p.id]);
  return salida;
}

export type ResultadoDeGeneracion =
  | {
      ok: true;
      /** Los archivos generados, en su formato. */
      archivos: ArchivoGenerado[];
      /** Su ficha para personas, que termina con la metadata para ContOpe. */
      leeme: ArchivoGenerado & { contenido: string };
      /** Lo que se descarga: los archivos y el `LEEME.md` en un `.zip` (`econut-paleta-ase.zip`). */
      zip: ArchivoGenerado & { contenido: Uint8Array };
      metadata: MetadataDeCelula;
      /** Los archivos generados con su huella, para el registro del taller. */
      registrados: ArchivoRegistrado[];
    }
  | { ok: false; falta: string };

/**
 * Corre un generador: comprueba que el ADN alcance, resuelve los parámetros,
 * arma la metadata común, genera, escribe el `LEEME.md` y empaqueta todo en
 * el `.zip`. `generadoEn` se inyecta: con el mismo ADN, los mismos parámetros
 * y la misma fecha, los bytes (también los del zip) son los mismos.
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
  let archivos: ArchivoGenerado[];
  try {
    archivos = generador.generar(designSet, parametros, { sistema: entrada.sistema, generadoEn: entrada.generadoEn, metadata });
  } catch (error) {
    return { ok: false, falta: (error as Error).message };
  }
  const leeme = escribirLeeme({ generador, designSet, metadata, archivos });
  const zip = zipDeCelula({ archivos, leeme }, { sistema: entrada.sistema, generador, generadoEn: entrada.generadoEn });
  return { ok: true, archivos, leeme, zip, metadata, registrados: archivos.map(registroDe) };
}
