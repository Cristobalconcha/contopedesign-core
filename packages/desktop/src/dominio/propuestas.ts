/**
 * Traer al taller lo que la IA propuso (ARQUITECTURA.md, paso 4; primer
 * dibujo del 18-09-2026 por la tarde). La IA no vive dentro del programa: lee
 * la cápsula con el skill `leer-contrato-de-diseno`, construye lo encargado y
 * lo devuelve en un archivo de propuestas. Este módulo valida ese archivo en
 * la frontera, igual que `persistencia.ts` con el sistema: forma inesperada,
 * archivo rechazado entero, con el motivo.
 *
 * Lo que entra nunca gana autoridad sola (orden `human-confirmed >
 * approved-guideline > deterministic-extraction > model-proposal`): cada
 * propuesta se vuelve una entrada de ContOpe en estado `propuesta` y fuerza
 * `explorable`, y si la pregunta ya estaba resuelta por una persona o un
 * insumo, queda como conflicto de origen para la armonización. Eso lo hace
 * el reductor (`traer-propuesta`); acá sólo se lee.
 */
import { findEntry } from '@contope/core';
import { refsDe } from './apoyos.js';
import { requisito } from './manifiesto.js';
import type { Sistema } from './sistema.js';

export const KIND_PROPUESTAS = 'contope/propuestas';
export const SCHEMA_PROPUESTAS = 1;

export interface Propuesta {
  requirementId: string;
  payload: Record<string, unknown>;
  /** Por qué se propone así, con la evidencia que la IA tuvo a mano. */
  nota?: string;
}

export interface ArchivoDePropuestas {
  kind: typeof KIND_PROPUESTAS;
  schemaVersion: typeof SCHEMA_PROPUESTAS;
  /** `design.id` del contrato que la IA leyó: el id del sistema. */
  designId: string;
  /** `design.revision` de ese contrato, para saber sobre qué cápsula se propuso. */
  contractRevision?: number;
  /** Quién propuso (texto libre: el modelo, el skill, la sesión). */
  por?: string;
  generadaEn?: string;
  propuestas: Propuesta[];
}

function esRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

export type LecturaDePropuestas =
  | { ok: true; archivo: ArchivoDePropuestas; avisos: string[] }
  | { ok: false; motivo: string };

/** Lee y valida un archivo de propuestas contra el sistema abierto. */
export function leerPropuestas(texto: string, sistema: Sistema): LecturaDePropuestas {
  let valor: unknown;
  try {
    valor = JSON.parse(texto);
  } catch (error) {
    return { ok: false, motivo: `El archivo no es JSON legible: ${(error as Error).message}` };
  }
  if (!esRecord(valor)) return { ok: false, motivo: 'el archivo no contiene un objeto' };
  if (valor['kind'] !== KIND_PROPUESTAS) return { ok: false, motivo: `no es un archivo de propuestas de ContOpe (kind '${String(valor['kind'])}')` };
  if (valor['schemaVersion'] !== SCHEMA_PROPUESTAS) return { ok: false, motivo: `versión de propuestas desconocida: ${String(valor['schemaVersion'])}` };
  if (typeof valor['designId'] !== 'string') return { ok: false, motivo: "falta 'designId'" };
  if (valor['designId'] !== sistema.id) {
    return { ok: false, motivo: `estas propuestas son para otro sistema ('${valor['designId']}', y el abierto es '${sistema.id}')` };
  }
  if (!Array.isArray(valor['propuestas'])) return { ok: false, motivo: "'propuestas' debe ser una lista" };
  const propuestas: Propuesta[] = [];
  const vistas = new Set<string>();
  for (const [i, p] of valor['propuestas'].entries()) {
    if (!esRecord(p)) return { ok: false, motivo: `la propuesta ${i + 1} debe ser un objeto` };
    const requirementId = p['requirementId'];
    if (typeof requirementId !== 'string') return { ok: false, motivo: `la propuesta ${i + 1} no dice a qué pregunta responde` };
    if (!requisito(requirementId)) return { ok: false, motivo: `la propuesta ${i + 1} apunta a una pregunta que no existe: ${requirementId}` };
    if (!esRecord(p['payload'])) return { ok: false, motivo: `la propuesta ${i + 1} (${requirementId}) no trae un payload` };
    if (vistas.has(requirementId)) {
      return { ok: false, motivo: `hay dos propuestas para ${requirementId}; el formato admite una por pregunta (varias candidatas es una decisión pendiente)` };
    }
    vistas.add(requirementId);
    const colgantes = refsDe(p['payload']).filter((id) => id !== requirementId && !findEntry(sistema.designSet, id));
    if (colgantes.length) {
      return { ok: false, motivo: `la propuesta ${i + 1} (${requirementId}) referencia preguntas sin entrada en este sistema: ${[...new Set(colgantes)].join(', ')}` };
    }
    if (p['nota'] !== undefined && typeof p['nota'] !== 'string') return { ok: false, motivo: `la nota de la propuesta ${i + 1} debe ser texto` };
    propuestas.push({ requirementId, payload: p['payload'], ...(typeof p['nota'] === 'string' ? { nota: p['nota'] } : {}) });
  }
  const avisos: string[] = [];
  const revision = valor['contractRevision'];
  if (typeof revision === 'number' && sistema.capsulaAnterior !== null && revision !== sistema.capsulaAnterior.design.revision) {
    avisos.push(
      `Las propuestas se hicieron sobre la revisión ${revision} de la cápsula y la última exportada es la ${sistema.capsulaAnterior.design.revision}: conviene mirarlas con eso en mente.`,
    );
  }
  if (typeof revision === 'number' && sistema.capsulaAnterior === null) {
    avisos.push('Este sistema no tiene una cápsula exportada registrada; las propuestas dicen venir de una revisión que acá no consta.');
  }
  return {
    ok: true,
    avisos,
    archivo: {
      kind: KIND_PROPUESTAS,
      schemaVersion: SCHEMA_PROPUESTAS,
      designId: valor['designId'],
      ...(typeof revision === 'number' ? { contractRevision: revision } : {}),
      ...(typeof valor['por'] === 'string' ? { por: valor['por'] } : {}),
      ...(typeof valor['generadaEn'] === 'string' ? { generadaEn: valor['generadaEn'] } : {}),
      propuestas,
    },
  };
}
