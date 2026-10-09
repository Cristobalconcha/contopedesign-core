/**
 * Fixture de espacio (Dimensión 3) para las Células Madre de grilla: un
 * sistema editorial impreso, en mm, con su retícula, sus formatos de hoja y
 * su sangrado. Los colores son los de la fixture de la Dimensión 1 (el color
 * de la guía puede salir de un rol).
 *
 * Los payloads validan contra `DIM3_MANIFEST_V0` (lo comprueba la prueba del
 * generador). No es un `.test.ts` a propósito, como `dim1-fixture.ts`.
 *
 * - Unidad 1 mm; escala en mm y un paso de 12 pt (la línea base del folleto
 *   del núcleo editorial: «retícula base de 12 pt»).
 * - Dos retículas: «texto corrido» (6 columnas, medianil 4 mm) y «portada»
 *   (2 columnas, medianil 8 mm).
 * - Tres formatos: A4 vertical (página fija), A5 apaisado (página fija) y
 *   carta en contenido corrido (se dibuja en px).
 * - Por formato: sangrado 3 mm, zona segura 12 mm y margen de 20 mm (en la
 *   carta corrida: 9px, 48px y 72px).
 */
import { DIM1_MANIFEST_V0 } from '../requirement-manifest/manifest-v0-dim1.js';
import { DIM3_MANIFEST_V0, DIM3_REQUIREMENTS_V0 } from '../requirement-manifest/manifest-v0-dim3.js';
import { buildDim1DesignSet } from './dim1-fixture.js';
import type { DesignSetEntryV0, DesignSetV0 } from './types.js';

const escala = (i: number) => ({ refReqId: 'dim3.req01', refPath: ['escala', i] });
const formato = (i: number) => ({ refReqId: 'dim3.req08', refPath: ['formatos', i] });

export function resolvedDim3EspacioPayloads(): Map<string, unknown> {
  const m = new Map<string, unknown>();
  m.set('dim3.req01', {
    unidad: '1mm',
    escala: [
      { step: 1, value: '1mm' }, // 0
      { step: 2, value: '2mm' }, // 1
      { step: 3, value: '3mm' }, // 2
      { step: 4, value: '4mm' }, // 3
      { step: 6, value: '6mm' }, // 4
      { step: 8, value: '8mm' }, // 5
      { step: 12, value: '12pt' }, // 6: la línea base
      { step: 20, value: '20mm' }, // 7
    ],
  });
  m.set('dim3.req03', {
    ritmo: { baseline: escala(6), aplicaA: ['párrafo', 'lista'], alineacion: 'baseline' },
  });
  m.set('dim3.req04', {
    reticulas: [
      { contexto: 'texto corrido', columns: 6, gap: escala(3), minColumnWidth: '20mm', align: 'stretch', justify: 'start' },
      { contexto: 'portada', columns: 2, gap: escala(5) },
    ],
  });
  m.set('dim3.req08', {
    formatos: [
      { nombre: 'A4 vertical', formato: 'a4', orientacion: 'vertical', modo: 'pagina-fija' },
      { nombre: 'A5 apaisado', formato: 'a5', orientacion: 'apaisada', modo: 'pagina-fija' },
      { nombre: 'carta corrida', formato: 'letter', orientacion: 'vertical', modo: 'contenido-corrido' },
    ],
  });
  m.set('dim3.req09', {
    porFormato: [
      { formato: formato(0), sangrado: '3mm', zonaSegura: '12mm', margenTextoCorrido: '20mm', aSangre: ['fondos', 'fotografías'] },
      { formato: formato(1), sangrado: '3mm', zonaSegura: '12mm', margenTextoCorrido: '20mm', aSangre: ['fondos'] },
      { formato: formato(2), sangrado: '9px', zonaSegura: '48px', margenTextoCorrido: '72px', aSangre: ['ninguno'] },
    ],
  });
  return m;
}

/** El espacio de arriba más los colores de la fixture de la Dimensión 1, en un solo set. */
export function buildDim3EspacioDesignSet(): DesignSetV0 {
  const byId = new Map(DIM3_REQUIREMENTS_V0.map((r) => [r.id, r]));
  const espacio: DesignSetEntryV0[] = [...resolvedDim3EspacioPayloads().entries()].map(([requirementId, payload]) => {
    const requisito = byId.get(requirementId);
    if (!requisito) throw new Error(`fixture inconsistente: ${requirementId} no está en DIM3_REQUIREMENTS_V0`);
    return {
      requirementId,
      effectiveDefinitionId: `def-${requirementId}`,
      resolutionPath: 'diseñador',
      payload,
      provenance: { fuente: 'usuario' },
      fuerza: 'inamovible',
      cicloDeVida: 'aprobada',
      revision: 1,
      mapsToKinds: requisito.mapsToKinds,
    };
  });
  return {
    schemaVersion: 1,
    designSetId: 'ds-fixture-dim3',
    manifestRefs: {
      dim1: { manifestVersion: DIM1_MANIFEST_V0.manifestVersion, revision: DIM1_MANIFEST_V0.revision },
      dim3: { manifestVersion: DIM3_MANIFEST_V0.manifestVersion, revision: DIM3_MANIFEST_V0.revision },
    },
    entries: [...buildDim1DesignSet().entries, ...espacio],
  };
}
