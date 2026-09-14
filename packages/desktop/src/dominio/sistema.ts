/**
 * El documento del taller: lo que se guarda en un archivo `.contope.json`.
 *
 * El núcleo ya define el DesignSet (la hoja de respuestas al manifiesto) y la
 * memoria de construcción (insumos, definiciones, tareas). Este documento los
 * reúne con lo que la interfaz necesita para retomar el trabajo donde quedó:
 * qué mundo se eligió, qué insumos entraron y qué se extrajo de cada uno, qué
 * camino se asignó a cada requisito pendiente, y los conflictos de origen que
 * la armonización tiene que decidir.
 *
 * El DesignSet se guarda tal cual lo define el núcleo, para que la cápsula
 * que sale de acá sea exactamente la que el resto del sistema sabe leer.
 */
import type { DesignContractV1, DesignSetV0, EditContextDevelopmentTask, VerificationRecordV0 } from '@contope/core';
import type { MundoId } from './mundos.js';
import type { Muestra } from './primitivas.js';

export const KIND_SISTEMA = 'contope/sistema';
export const SCHEMA_SISTEMA = 1;

/** Qué clase de archivo entró; decide qué extractor lo lee. */
export type TipoInsumo = 'css' | 'tokens-w3c' | 'imagen' | 'idml' | 'pdf' | 'texto' | 'otro';

/**
 * Algo que un insumo ofrece incorporar, dirigido a un requisito concreto.
 * `fragmento` es un trozo del payload de ese requisito, con la forma que
 * declara su payloadSchema; al incorporarlo se une al payload existente.
 */
export interface Candidato {
  id: string;
  requirementId: string;
  etiqueta: string;
  detalle: string;
  muestra: Muestra;
  fragmento: Record<string, unknown>;
  estado: 'pendiente' | 'incorporado' | 'descartado';
  /** Qué no pudo leerse del insumo y va a haber que completar a mano. */
  faltante?: string;
}

export interface Insumo {
  id: string;
  nombre: string;
  extension: string;
  tipo: TipoInsumo;
  tamanoBytes: number;
  incorporadoEn: string;
  /** Miniatura en data URL, sólo para imágenes. */
  miniatura?: string;
  /** Resumen de lo que el extractor encontró (o por qué no leyó nada). */
  resumen: string;
  candidatos: Candidato[];
}

/**
 * Un segundo insumo que resuelve un requisito ya resuelto por otro. No se
 * mezcla ni se pisa: se registra y lo decide la armonización
 * (ARQUITECTURA.md, «También los conflictos de origen»).
 */
export interface Conflicto {
  id: string;
  requirementId: string;
  insumoId: string;
  candidatoId: string;
  fragmento: Record<string, unknown>;
  registradoEn: string;
}

export interface Sistema {
  kind: typeof KIND_SISTEMA;
  schemaVersion: typeof SCHEMA_SISTEMA;
  id: string;
  nombre: string;
  mundo: MundoId;
  creadoEn: string;
  actualizadoEn: string;
  insumos: Insumo[];
  designSet: DesignSetV0;
  /** Camino asignado a requisitos que todavía no tienen entrada. */
  caminos: Record<string, 'insumo' | 'diseñador' | 'contope'>;
  conflictos: Conflicto[];
  /** Encargos para ContOpe (camino 3), en la forma que el contrato ya entiende. */
  tareas: EditContextDevelopmentTask[];
  /** Verificaciones registradas para las cláusulas `verified(...)`. */
  verificaciones: VerificationRecordV0[];
  /** La última cápsula exportada, para que la siguiente continúe su linaje. */
  capsulaAnterior: DesignContractV1 | null;
}

export function nuevoId(prefijo: string): string {
  const azar = Math.random().toString(36).slice(2, 8);
  return `${prefijo}-${Date.now().toString(36)}-${azar}`;
}

export function nuevoSistema(mundo: MundoId, nombre: string, ahora = new Date().toISOString()): Sistema {
  return {
    kind: KIND_SISTEMA,
    schemaVersion: SCHEMA_SISTEMA,
    id: nuevoId('sistema'),
    nombre,
    mundo,
    creadoEn: ahora,
    actualizadoEn: ahora,
    insumos: [],
    designSet: {
      schemaVersion: 1,
      designSetId: nuevoId('set'),
      manifestRefs: {},
      entries: [],
    },
    caminos: {},
    conflictos: [],
    tareas: [],
    verificaciones: [],
    capsulaAnterior: null,
  };
}
