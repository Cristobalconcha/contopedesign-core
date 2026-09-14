/**
 * La cápsula: lo que el programa entrega cuando termina (README, «Qué no
 * hace»). Es el contrato de diseño del núcleo más su proyección DESIGN.md,
 * calculados por los proyectores del núcleo a partir de una memoria de
 * construcción armada desde el documento del taller.
 *
 * La traducción del set al contrato es la única decisión de este módulo:
 * - una entrada `aprobada` es una definición confirmada por una persona;
 * - una entrada de insumo sin aprobar es un hecho extraído (`fact`);
 * - una entrada de ContOpe sin aprobar es una propuesta;
 * - los encargos a ContOpe salen como `developmentTasks` activas.
 *
 * Nada de esto inventa autoridad: el proyector del núcleo sólo marca como
 * `confirmed` lo que viene en `active`, y `active` son las aprobadas.
 */
import {
  projectDesignContract,
  renderDesignContractDesignMd,
  stampDesignMdProjection,
  type ContractRoundSource,
  type DesignContractV1,
  type DesignSetEntryV0,
  type EditContext,
  type EditContextDefinition,
  type EditContextMaterial,
} from '@contope/core';
import { requisito } from './manifiesto.js';
import type { Insumo, Sistema, TipoInsumo } from './sistema.js';

export interface Capsula {
  contrato: DesignContractV1;
  designMd: string;
  archivos: Array<{ nombre: string; texto: string }>;
}

const KIND_MATERIAL: Record<TipoInsumo, NonNullable<EditContextMaterial['kind']>> = {
  css: 'text',
  'tokens-w3c': 'document',
  imagen: 'image',
  idml: 'idml',
  pdf: 'document',
  texto: 'text',
  otro: 'document',
};

const MIME: Record<TipoInsumo, string> = {
  css: 'text/css',
  'tokens-w3c': 'application/json',
  imagen: 'image/*',
  idml: 'application/vnd.adobe.indesign-idml-package',
  pdf: 'application/pdf',
  texto: 'text/plain',
  otro: 'application/octet-stream',
};

function categoriaDe(requirementId: string): string {
  const req = requisito(requirementId);
  const paquete = req?.packageId.replace(/^pkg\./, '') ?? requirementId;
  // El renderizador de DESIGN.md agrupa por palabras en inglés; se le da la
  // categoría del paquete más la palabra que reconoce, sin perder la propia.
  const cabeza = paquete.split('.')[0] ?? '';
  const traduccion: Record<string, string> = {
    color: 'color',
    tipografia: 'typography',
    espacio: 'spacing',
    imagen: 'media',
    composicion: 'layout',
  };
  return `${paquete} (${traduccion[cabeza] ?? cabeza})`;
}

function material(insumo: Insumo): EditContextMaterial {
  return {
    id: insumo.id,
    path: insumo.nombre,
    type: MIME[insumo.tipo],
    role: insumo.tipo === 'imagen' ? 'reference-image' : 'reference',
    kind: KIND_MATERIAL[insumo.tipo],
    locator: insumo.nombre,
    description: insumo.resumen,
  };
}

function definicion(entrada: DesignSetEntryV0): EditContextDefinition {
  const req = requisito(entrada.requirementId);
  const aprobada = entrada.cicloDeVida === 'aprobada';
  const authority: EditContextDefinition['authority'] = aprobada
    ? 'confirmed'
    : entrada.resolutionPath === 'insumo'
      ? 'fact'
      : 'proposal';
  const materialId =
    entrada.resolutionPath === 'insumo' ? (entrada.provenance.referenciaId ?? 'user') : 'user';
  return {
    id: entrada.effectiveDefinitionId,
    category: categoriaDe(entrada.requirementId),
    label: req?.pregunta ?? entrada.requirementId,
    value: (entrada.payload ?? {}) as Record<string, unknown>,
    resolution: 'preserve',
    authority,
    confidence: aprobada || entrada.resolutionPath === 'insumo' ? 'high' : 'medium',
    source: `${entrada.resolutionPath}:${entrada.requirementId}`,
    evidence: `${entrada.requirementId} · fuerza ${entrada.fuerza} · ${entrada.cicloDeVida} · revisión ${entrada.revision}`,
    provenance: [{ materialId, excerpt: entrada.requirementId }],
    appliesTo: entrada.mapsToKinds.map((k) => k.kind),
  };
}

/**
 * Un encargo a ContOpe apunta a una definición que todavía no tiene valor.
 * En la memoria eso es una definición DECLARADA y sin resolver (`develop`,
 * sin `value`): existe, para que la tarea tenga a qué apuntar, y está vacía,
 * para que nadie la tome por una decisión.
 */
function definicionEncargada(definitionId: string): EditContextDefinition {
  const requirementId = definitionId.replace(/\.def\d+$/, '');
  const req = requisito(requirementId);
  return {
    id: definitionId,
    category: categoriaDe(requirementId),
    label: req?.pregunta ?? requirementId,
    value: {},
    resolution: 'develop',
    authority: 'unknown',
    confidence: 'low',
    source: `contope:encargo:${requirementId}`,
    provenance: [],
    appliesTo: req?.mapsToKinds.map((k) => k.kind) ?? [],
  };
}

export function memoriaDe(sistema: Sistema): EditContext {
  const detected = sistema.designSet.entries.map(definicion);
  const existentes = new Set(detected.map((d) => d.id));
  for (const tarea of sistema.tareas) {
    if (!existentes.has(tarea.definitionId)) {
      detected.push(definicionEncargada(tarea.definitionId));
      existentes.add(tarea.definitionId);
    }
  }
  return {
    schemaVersion: 3,
    materials: sistema.insumos.map(material),
    detected,
    active: sistema.designSet.entries
      .filter((e) => e.cicloDeVida === 'aprobada')
      .map((e) => e.effectiveDefinitionId),
    open: [],
    developmentTasks: sistema.tareas,
    generatedAt: sistema.actualizadoEn,
  };
}

export function proyectarCapsula(sistema: Sistema): Capsula {
  const roundSources: ContractRoundSource[] = sistema.insumos.map((i) => ({
    id: i.id,
    technicalKind: KIND_MATERIAL[i.tipo],
    purpose: 'observation',
    label: i.nombre,
    locator: i.nombre,
  }));
  const base = projectDesignContract({
    designId: sistema.id,
    editContext: memoriaDe(sistema),
    roundSources,
    previousContract: sistema.capsulaAnterior,
  });
  const contrato = stampDesignMdProjection(base);
  const designMd = renderDesignContractDesignMd(contrato);
  return {
    contrato,
    designMd,
    archivos: [
      { nombre: 'design-contract.json', texto: JSON.stringify(contrato, null, 2) + '\n' },
      { nombre: 'DESIGN.md', texto: designMd },
    ],
  };
}
