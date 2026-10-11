/**
 * La metadata de ancestro: de qué sistema, de qué generador, de qué
 * definiciones del ADN (con su huella) y con qué parámetros salió un archivo.
 * Y la pregunta inversa: con el ADN de hoy, ¿ese archivo sigue vigente?
 */
import type { DesignSetV0 } from '../design-set/types.js';
import { huella, huellaDeContenido } from './huella.js';
import {
  KIND_CELULA_MADRE,
  SCHEMA_CELULA_MADRE,
  type AncestroDeAdn,
  type ArchivoGenerado,
  type ArchivoRegistrado,
  type CambioDeAncestro,
  type FichaDeCelula,
  type Generador,
  type MetadataDeCelula,
  type Parametros,
  type SistemaDeOrigen,
  type ValorDeParametro,
  type Vigencia,
} from './tipos.js';

/** Los ids de requisito que un generador consulta en este set, sin repetir y en orden. */
export function idsQueLee(generador: Pick<Generador, 'lee'>, designSet: DesignSetV0, parametros: Parametros): string[] {
  const ids = typeof generador.lee === 'function' ? generador.lee(designSet, parametros) : generador.lee;
  return [...new Set(ids)];
}

/** Las definiciones de esas preguntas que existen en el set, con su huella. */
export function ancestrosDe(designSet: DesignSetV0, ids: readonly string[]): AncestroDeAdn[] {
  const salida: AncestroDeAdn[] = [];
  for (const id of ids) {
    const entrada = designSet.entries.find((e) => e.requirementId === id);
    if (!entrada) continue;
    salida.push({
      requirementId: entrada.requirementId,
      effectiveDefinitionId: entrada.effectiveDefinitionId,
      revision: entrada.revision,
      huella: huella(entrada.payload),
    });
  }
  return salida;
}

/** La metadata común de una generación (la misma para todos sus archivos). */
export function metadataDeAncestro(entrada: {
  generador: Pick<Generador, 'id' | 'version' | 'nombre' | 'lee'>;
  designSet: DesignSetV0;
  sistema: SistemaDeOrigen;
  parametros: Parametros;
  generadoEn: string;
}): MetadataDeCelula {
  const consulta = idsQueLee(entrada.generador, entrada.designSet, entrada.parametros);
  return {
    kind: KIND_CELULA_MADRE,
    schemaVersion: SCHEMA_CELULA_MADRE,
    sistema: { designId: entrada.sistema.designId, nombre: entrada.sistema.nombre, designSetId: entrada.designSet.designSetId },
    generador: { id: entrada.generador.id, version: entrada.generador.version, nombre: entrada.generador.nombre },
    generadoEn: entrada.generadoEn,
    consulta,
    ancestros: ancestrosDe(entrada.designSet, consulta),
    parametros: entrada.parametros,
  };
}

/** Un archivo generado, sin su contenido y con su huella. */
export function registroDe(archivo: ArchivoGenerado): ArchivoRegistrado {
  return { nombre: archivo.nombre, tipoMime: archivo.tipoMime, huella: huellaDeContenido(archivo.contenido) };
}

/** La ficha que cierra el `LEEME.md`: la metadata común y la huella de cada archivo generado. */
export function fichaDe(metadata: MetadataDeCelula, archivos: readonly ArchivoGenerado[]): FichaDeCelula {
  return { ...metadata, archivos: archivos.map(registroDe) };
}

/**
 * ¿El archivo sigue diciendo lo que dice el ADN de hoy?
 *
 * - `huérfana`: viene de otro set (otro `designSetId`), o ninguna de las
 *   definiciones de las que salió existe ya. No hay de qué actualizarlo.
 * - `desactualizada`: alguna definición cambió (otra huella), se borró, o
 *   apareció una que el generador consulta y que al generar no estaba.
 * - `vigente`: todo igual.
 */
export function vigencia(metadata: MetadataDeCelula, designSetActual: DesignSetV0): Vigencia {
  if (metadata.sistema.designSetId !== designSetActual.designSetId) {
    return { estado: 'huérfana', motivo: `viene de otro sistema («${metadata.sistema.nombre}»)` };
  }
  const actuales = new Map(designSetActual.entries.map((e) => [e.requirementId, e]));
  if (metadata.ancestros.length > 0 && metadata.ancestros.every((a) => !actuales.has(a.requirementId))) {
    return { estado: 'huérfana', motivo: 'ya no existe ninguna de las definiciones de las que salió' };
  }
  const cambios: CambioDeAncestro[] = [];
  const leidos = new Set(metadata.ancestros.map((a) => a.requirementId));
  for (const a of metadata.ancestros) {
    const actual = actuales.get(a.requirementId);
    if (!actual) cambios.push({ requirementId: a.requirementId, motivo: 'borrada' });
    else if (huella(actual.payload) !== a.huella) cambios.push({ requirementId: a.requirementId, motivo: 'cambio' });
  }
  for (const id of metadata.consulta) {
    if (!leidos.has(id) && actuales.has(id)) cambios.push({ requirementId: id, motivo: 'nueva' });
  }
  return cambios.length ? { estado: 'desactualizada', cambios } : { estado: 'vigente' };
}

function esRegistro(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function esValorDeParametro(v: unknown): v is ValorDeParametro {
  return (
    typeof v === 'boolean' ||
    typeof v === 'string' ||
    (typeof v === 'number' && Number.isFinite(v)) ||
    (Array.isArray(v) && v.every((x) => typeof x === 'string'))
  );
}

/**
 * Lee la metadata (la de la ficha de un `LEEME.md` o la guardada en el
 * taller) desde JSON desconocido. Fail-closed: si la forma no calza, dice por
 * qué. Lo que no es de la metadata común (como `archivos`) se descarta.
 */
export function leerMetadataDeCelula(valor: unknown): { ok: true; metadata: MetadataDeCelula } | { ok: false; motivo: string } {
  if (!esRegistro(valor)) return { ok: false, motivo: 'la metadata no es un objeto' };
  if (valor['kind'] !== KIND_CELULA_MADRE) return { ok: false, motivo: `no es metadata de Célula Madre (kind '${String(valor['kind'])}')` };
  if (valor['schemaVersion'] !== SCHEMA_CELULA_MADRE) return { ok: false, motivo: `versión de metadata desconocida: ${String(valor['schemaVersion'])}` };
  const s = valor['sistema'];
  if (!esRegistro(s) || typeof s['designId'] !== 'string' || typeof s['nombre'] !== 'string' || typeof s['designSetId'] !== 'string') {
    return { ok: false, motivo: "'sistema' necesita 'designId', 'nombre' y 'designSetId'" };
  }
  const g = valor['generador'];
  if (!esRegistro(g) || typeof g['id'] !== 'string' || typeof g['version'] !== 'string' || typeof g['nombre'] !== 'string') {
    return { ok: false, motivo: "'generador' necesita 'id', 'version' y 'nombre'" };
  }
  if (typeof valor['generadoEn'] !== 'string') return { ok: false, motivo: "'generadoEn' debe ser texto" };
  const consulta = valor['consulta'];
  if (!Array.isArray(consulta) || !consulta.every((c) => typeof c === 'string')) return { ok: false, motivo: "'consulta' debe ser una lista de ids" };
  const ancestrosCrudos = valor['ancestros'];
  if (!Array.isArray(ancestrosCrudos)) return { ok: false, motivo: "'ancestros' debe ser una lista" };
  const ancestros: AncestroDeAdn[] = [];
  for (const a of ancestrosCrudos) {
    if (
      !esRegistro(a) ||
      typeof a['requirementId'] !== 'string' ||
      typeof a['effectiveDefinitionId'] !== 'string' ||
      typeof a['revision'] !== 'number' ||
      typeof a['huella'] !== 'string'
    ) {
      return { ok: false, motivo: "cada ancestro necesita 'requirementId', 'effectiveDefinitionId', 'revision' y 'huella'" };
    }
    ancestros.push({ requirementId: a['requirementId'], effectiveDefinitionId: a['effectiveDefinitionId'], revision: a['revision'], huella: a['huella'] });
  }
  const p = valor['parametros'];
  if (!esRegistro(p)) return { ok: false, motivo: "'parametros' debe ser un objeto" };
  const parametros: Parametros = {};
  for (const [clave, v] of Object.entries(p)) {
    if (clave === '__proto__' || clave === 'constructor' || clave === 'prototype') return { ok: false, motivo: `parámetro no permitido: '${clave}'` };
    if (!esValorDeParametro(v)) return { ok: false, motivo: `el parámetro '${clave}' tiene un valor que no se entiende` };
    parametros[clave] = v;
  }
  return {
    ok: true,
    metadata: {
      kind: KIND_CELULA_MADRE,
      schemaVersion: SCHEMA_CELULA_MADRE,
      sistema: { designId: s['designId'], nombre: s['nombre'], designSetId: s['designSetId'] },
      generador: { id: g['id'], version: g['version'], nombre: g['nombre'] },
      generadoEn: valor['generadoEn'],
      consulta: [...consulta] as string[],
      ancestros,
      parametros,
    },
  };
}

/** Lee la ficha completa (la metadata y sus archivos) desde JSON desconocido. Fail-closed. */
export function leerFichaDeCelula(valor: unknown): { ok: true; ficha: FichaDeCelula } | { ok: false; motivo: string } {
  const metadata = leerMetadataDeCelula(valor);
  if (!metadata.ok) return metadata;
  const crudos = (valor as Record<string, unknown>)['archivos'];
  if (!Array.isArray(crudos) || crudos.length === 0) return { ok: false, motivo: "'archivos' debe ser una lista con al menos un archivo" };
  const archivos: ArchivoRegistrado[] = [];
  for (const a of crudos) {
    if (!esRegistro(a) || typeof a['nombre'] !== 'string' || typeof a['tipoMime'] !== 'string' || typeof a['huella'] !== 'string') {
      return { ok: false, motivo: "cada archivo necesita 'nombre', 'tipoMime' y 'huella'" };
    }
    archivos.push({ nombre: a['nombre'], tipoMime: a['tipoMime'], huella: a['huella'] });
  }
  return { ok: true, ficha: { ...metadata.metadata, archivos } };
}
