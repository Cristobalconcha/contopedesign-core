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
 *
 * Desde el 18-09-2026 el documento también guarda el ALCANCE: qué preguntas
 * del manifiesto este sistema declara necesitar. Es opcional en el archivo
 * (`alcance` ausente se lee como `null`, que significa «todas»), así que un
 * archivo viejo sigue abriendo igual.
 *
 * Desde la misma fecha cada insumo guarda su CARRIL (`referente` o
 * `cortapisa`) y qué DIMENSIONES se toman de él (`tomar`, `null` = todas).
 * Los dos campos también son opcionales en el archivo: un archivo viejo abre
 * como referente que toma todo (ver persistencia.ts). El carril lo pone quien
 * incorpora el insumo, no el extractor.
 */
import type { DesignContractV1, DesignSetV0, DimensionId, EditContextDevelopmentTask, VerificationRecordV0 } from '@contope/core';
import type { Alcance } from './alcance.js';
import type { MundoId } from './mundos.js';
import { armonizacionVacia, type Armonizacion } from './armonizacion.js';
import type { Muestra } from './primitivas.js';

export const KIND_SISTEMA = 'contope/sistema';
export const SCHEMA_SISTEMA = 1;

/** Qué clase de archivo entró; decide qué extractor lo lee. */
export type TipoInsumo = 'css' | 'tokens-w3c' | 'imagen' | 'idml' | 'pdf' | 'texto' | 'otro';

/**
 * Los dos carriles de un insumo. El referente es lo normal: se toma y se
 * decide después. La cortapisa (manual de estilo, logotipo, paleta
 * institucional, el sistema anterior cuando lo nuevo es una variante) trae
 * algo que no se discute (Decisión 21).
 */
export type Carril = 'referente' | 'cortapisa';

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
  /**
   * Cómo entró: como referente (lo que se toma queda como propuesta, para
   * decidir después) o como cortapisa (lo que trae no se discute). El
   * extractor no lo decide: lo pone quien incorpora el insumo.
   */
  carril: Carril;
  /**
   * Qué dimensiones se toman de este insumo; `null` = todas. Lo no marcado no
   * se ofrece: sus candidatos quedan ocultos, sin descartarse.
   */
  tomar: DimensionId[] | null;
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
  /**
   * Cuando una cortapisa desplaza una entrada anterior, acá queda el rastro de
   * lo que se dejó de lado: `fragmento` es el payload anterior y este campo lo
   * marca. Ausente, el conflicto es el de siempre (dos orígenes que la
   * armonización decide).
   */
  desplazada?: boolean;
}

export interface Sistema {
  kind: typeof KIND_SISTEMA;
  schemaVersion: typeof SCHEMA_SISTEMA;
  id: string;
  nombre: string;
  mundo: MundoId;
  /** Qué preguntas declara necesitar este sistema; `null` = sin acotar (todas). */
  alcance: Alcance | null;
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
  /** Pasadas de armonización y lo decidido sobre cada señal (etapa, decisión 23). */
  armonizacion: Armonizacion;
  /**
   * La nota con que la IA justificó cada propuesta traída, por id de la
   * pregunta (la última propuesta manda). Es la evidencia que la armonización
   * lee y la materia prima del modo sombra (decisión 22); no viaja en el
   * DesignSet porque el núcleo no tiene campo para ella.
   */
  notasDePropuesta: Record<string, { texto: string; en: string }>;
  /**
   * Qué preguntas quedaron resueltas por el canal imperativo (Cristóbal,
   * 19-09: «un canal imperativo que haga lo mismo que cargar un insumo pero se
   * marca como imperativo: manual de estilos del cliente, branding del
   * cliente»). La marca se estampa al incorporar desde una cortapisa y vive
   * acá, en el sistema: sobrevive a quitar el insumo. Se borra sólo cuando
   * una persona redefine o quita esa definición.
   */
  imperativas: Record<string, { insumoId: string; nombre: string; en: string }>;
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
    alcance: null,
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
    armonizacion: armonizacionVacia(),
    notasDePropuesta: {},
    imperativas: {},
  };
}
