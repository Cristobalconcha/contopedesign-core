/**
 * El manifiesto que la interfaz muestra: los cinco cortes de dimensión que el
 * núcleo publica hoy, aplanados para poder listarlos y buscarlos por id.
 *
 * Los mundos de la pantalla de inicio todavía no tienen núcleo propio (ver
 * ARQUITECTURA.md, «El core no es uno solo»): hasta que exista esa
 * investigación, todos usan este mismo manifiesto y la interfaz lo dice.
 */
import {
  DIM1_MANIFEST_V0,
  DIM2_MANIFEST_V0,
  DIM3_MANIFEST_V0,
  DIM5_MANIFEST_V0,
  DIM6_MANIFEST_V0,
  DIM7_MANIFEST_V0,
  DIM8_MANIFEST_V0,
  type DimensionId,
  type RequirementManifestV0,
  type RequirementV0,
} from '@contope/core';

export const MANIFIESTOS: ReadonlyArray<RequirementManifestV0> = [
  DIM1_MANIFEST_V0,
  DIM2_MANIFEST_V0,
  DIM3_MANIFEST_V0,
  DIM5_MANIFEST_V0,
  DIM6_MANIFEST_V0,
  DIM7_MANIFEST_V0,
  DIM8_MANIFEST_V0,
];

export const NOMBRE_DIMENSION: Partial<Record<DimensionId, string>> = {
  dim1: 'Color y superficies',
  dim2: 'Tipografía y jerarquía',
  dim3: 'Espacio, ritmo y retícula',
  dim5: 'Imagen y lenguaje gráfico',
  dim6: 'Composición',
  dim7: 'Interacción y estados',
  dim8: 'Movimiento y temporalidad',
};

export const DIMENSIONES: ReadonlyArray<DimensionId> = MANIFIESTOS.map(
  (m) => m.requirements[0]?.dimensionId ?? 'dim1',
);

export const REQUISITOS: ReadonlyArray<RequirementV0> = MANIFIESTOS.flatMap((m) =>
  m.requirements.filter((r) => r.estado === 'active'),
);

const POR_ID = new Map(REQUISITOS.map((r) => [r.id, r]));

export function requisito(id: string): RequirementV0 | undefined {
  return POR_ID.get(id);
}

export function manifiestoDe(dimensionId: DimensionId): RequirementManifestV0 | undefined {
  return MANIFIESTOS.find((m) => m.requirements[0]?.dimensionId === dimensionId);
}

export function dimensionDe(requirementId: string): DimensionId {
  const cabeza = requirementId.split('.')[0];
  return (cabeza ?? 'dim1') as DimensionId;
}

/** Requisitos que dependen (directamente) del dado: qué se cae si éste se quita. */
export function dependientesDe(requirementId: string): RequirementV0[] {
  return REQUISITOS.filter((r) => r.dependsOn.includes(requirementId));
}
