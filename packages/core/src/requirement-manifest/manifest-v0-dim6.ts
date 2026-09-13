/**
 * Manifiesto v0 de la Dimensión 6 — Composición y jerarquía visual
 * (spec-c1-dim6-composicion-manifest-2026-08-31.md §3, 3 pasadas
 * adversariales aplicadas antes de esta implementación — 1, 1 y 0
 * bloqueantes).
 *
 * Los siete requisitos de §3 fielmente (IDs, ejes, dependsOn,
 * payloadSchemas, mapsToKinds — incluidas las brechas DECLARADAS en
 * mappingNotes), estructurados sobre el "Resuelto cuando" de la taxonomía
 * §6 (spec §2).
 *
 * Dimensión meta/transversal: organiza las DEMÁS dimensiones, produce
 * solapes reales con `dim3.req03` (ritmo espacial) y `dim3.req06`
 * (densidad espacial) declarados como tensiones sin resolver por decreto
 * (spec §4, tensiones 1-2).
 *
 * `rectorBindings`/`noConflict('mood-wall')` solo en `req01` (fundamento)
 * y `req02` (roles) — la pasada adversarial 2 revirtió su aplicación a
 * los otros cinco tras medir la densidad real del patrón contra
 * dim1/dim2 (no se aplica por pertenencia de dominio, se aplica donde el
 * precedente real lo sostiene).
 *
 * CERO PROSA: cada validityPredicate es AST puro serializable, igual que
 * manifest-v0-dim1.ts/dim2.ts/dim3.ts/dim5.ts.
 */
import type { CoverExpected, PathSegment, PredicateClause } from './predicate.js';
import type { PayloadFieldSchema, PayloadType, RequirementManifestV0, RequirementV0 } from './types.js';

// ---------------------------------------------------------------------------
// Constructores de AST (mismo patrón que las dimensiones anteriores)
// ---------------------------------------------------------------------------

const p = (...parts: PathSegment[]): readonly PathSegment[] => parts;
const str = (value: string): { kind: 'string'; value: string } => ({ kind: 'string', value });

const exists = (target: readonly PathSegment[]): PredicateClause => ({ kind: 'exists', target });
const each = (target: readonly PathSegment[], condition: PredicateClause): PredicateClause => ({
  kind: 'each',
  target,
  condition,
});
const covers = (
  target: readonly PathSegment[],
  key: readonly string[],
  expected: readonly CoverExpected[],
): PredicateClause => ({ kind: 'covers', target, key, expected });
const noConflict = (rectoraId: string): PredicateClause => ({ kind: 'noConflict', rectoraId });

// Constructores del payloadSchema
const TEXTO: PayloadType = { kind: 'texto' };
const enumOf = (...values: string[]): PayloadType => ({ kind: 'enum', values });
const lista = (of: PayloadType): PayloadType => ({ kind: 'lista', of });
const objeto = (fields: Record<string, PayloadFieldSchema>): PayloadType => ({ kind: 'objeto', fields });
const slot = (type: PayloadType, optional = false): PayloadFieldSchema =>
  optional ? { type, optional: true } : { type };

// ---------------------------------------------------------------------------
// Constantes cerradas de la dimensión (spec §3, tensión 3: cerrados por analogía)
// ---------------------------------------------------------------------------

const WEIGHT_ROLES_3 = ['dominante', 'secundario', 'silencio'] as const;
const GROUPING_PRINCIPLES_3 = ['proximidad', 'continuidad', 'separacion'] as const;

// ---------------------------------------------------------------------------
// Los siete requisitos
// ---------------------------------------------------------------------------

const req01: RequirementV0 = {
  id: 'dim6.req01',
  dimensionId: 'dim6',
  packageId: 'pkg.composicion.foco',
  eje: 'completitud',
  pregunta:
    '¿Declara el sistema sus tres niveles de peso visual (dominante, secundario, silencio) y un recorrido de lectura para al menos un contexto?',
  estado: 'active',
  dependsOn: [],
  payloadSchema: {
    pesos: slot(
      lista(
        objeto({
          role: slot(enumOf(...WEIGHT_ROLES_3)),
          aplicaA: slot(TEXTO),
          tecnica: slot(TEXTO),
        }),
      ),
    ),
    recorrido: slot(
      objeto({
        orden: slot(lista(TEXTO)),
        descripcion: slot(TEXTO),
      }),
    ),
  },
  validityPredicate: [
    covers(
      p('pesos'),
      ['role'],
      WEIGHT_ROLES_3.map((role) => str(role)),
    ),
    each(p('pesos'), exists(p('tecnica'))),
    exists(p('recorrido', 'orden')),
    noConflict('descriptor'),
    noConflict('mood-wall'),
  ],
  rectorBindings: ['descriptor', 'mood-wall'],
  mapsToKinds: [],
  mappingNotes:
    'BRECHA DECLARADA: el designRuleSet no tiene kind de peso visual/recorrido — la composición vive enteramente en el DesignSet (C2), nunca como regla individual del compilador.',
};

const req02: RequirementV0 = {
  id: 'dim6.req02',
  dimensionId: 'dim6',
  packageId: 'pkg.composicion.agrupacion',
  eje: 'completitud',
  pregunta: '¿Declara el sistema sus tres principios de agrupación (proximidad, continuidad, separación) con criterios efectivos?',
  estado: 'active',
  dependsOn: ['dim6.req01'],
  payloadSchema: {
    agrupaciones: slot(
      lista(
        objeto({
          principio: slot(enumOf(...GROUPING_PRINCIPLES_3)),
          criterio: slot(TEXTO),
        }),
      ),
    ),
  },
  validityPredicate: [
    covers(
      p('agrupaciones'),
      ['principio'],
      GROUPING_PRINCIPLES_3.map((principio) => str(principio)),
    ),
    each(p('agrupaciones'), exists(p('criterio'))),
    noConflict('mood-wall'),
  ],
  rectorBindings: ['mood-wall'],
  mapsToKinds: [],
  mappingNotes: 'BRECHA DECLARADA, mismo tipo que dim6.req01.',
};

const req03: RequirementV0 = {
  id: 'dim6.req03',
  dimensionId: 'dim6',
  packageId: 'pkg.composicion.balance',
  eje: 'completitud',
  pregunta: '¿Declara el sistema su política de balance (simétrico o asimétrico) y cómo maneja la tensión resultante?',
  estado: 'active',
  dependsOn: ['dim6.req01'],
  payloadSchema: {
    balance: slot(
      objeto({
        tipo: slot(enumOf('simetrico', 'asimetrico')),
        tension: slot(TEXTO),
        alineacion: slot(TEXTO),
      }),
    ),
  },
  validityPredicate: [
    exists(p('balance', 'tipo')),
    exists(p('balance', 'tension')),
    exists(p('balance', 'alineacion')),
  ],
  rectorBindings: [],
  mapsToKinds: [],
  mappingNotes:
    'BRECHA DECLARADA. Nota de solape: layout.align/layout.justify (D3 §2) son campos de UNA retícula concreta (dim3.req04/req05), no de la política de balance compositivo transversal que pide este requisito.',
};

const req04: RequirementV0 = {
  id: 'dim6.req04',
  dimensionId: 'dim6',
  packageId: 'pkg.composicion.ritmo',
  eje: 'completitud',
  pregunta: '¿Declara el sistema un patrón de secuencia/repetición con pausas explícitas para al menos un contexto compositivo?',
  estado: 'active',
  dependsOn: ['dim6.req01'],
  payloadSchema: {
    secuencia: slot(
      objeto({
        patron: slot(TEXTO),
        repeticion: slot(TEXTO),
        pausas: slot(lista(TEXTO)),
      }),
    ),
  },
  validityPredicate: [
    exists(p('secuencia', 'patron')),
    exists(p('secuencia', 'repeticion')),
    exists(p('secuencia', 'pausas')),
  ],
  rectorBindings: [],
  mapsToKinds: [],
  mappingNotes:
    'BRECHA DECLARADA. Nota de solape: dim3.req03 ya declara "ritmo" a nivel de línea base ESPACIAL (baseline/alineación vertical). Este requisito es sobre secuencia/repetición COMPOSITIVA (orden de bloques, pausas editoriales), otro nivel de abstracción.',
};

const req05: RequirementV0 = {
  id: 'dim6.req05',
  dimensionId: 'dim6',
  packageId: 'pkg.composicion.densidad',
  eje: 'completitud',
  pregunta: '¿Declara el sistema su relación entre densidad de contenido y espacio negativo para al menos un contexto?',
  estado: 'active',
  dependsOn: ['dim6.req01'],
  payloadSchema: {
    densidad: slot(
      objeto({
        modo: slot(enumOf('compacto', 'comodo')),
        espacioNegativo: slot(TEXTO),
      }),
    ),
  },
  validityPredicate: [exists(p('densidad', 'modo')), exists(p('densidad', 'espacioNegativo'))],
  rectorBindings: [],
  mapsToKinds: [],
  mappingNotes:
    'BRECHA DECLARADA. Nota de solape FUERTE: dim3.req06 ya declara "densidad y reglas de adaptación/reflujo" para el ESPACIO (paddings/gaps por densidad). Este requisito es sobre la relación COMPOSITIVA densidad-de-contenido/espacio-negativo — solape de nombre y concepto más directo que dim6.req04, sin regla de precedencia entre dimensiones fijada.',
};

const req06: RequirementV0 = {
  id: 'dim6.req06',
  dimensionId: 'dim6',
  packageId: 'pkg.composicion.flujo',
  eje: 'completitud',
  pregunta:
    '¿Declara el sistema su flujo editorial y/o navegacional (cómo se recorre el contenido más allá de una sola pantalla) para al menos un contexto?',
  estado: 'active',
  dependsOn: ['dim6.req01'],
  payloadSchema: {
    flujo: slot(
      objeto({
        tipo: slot(enumOf('editorial', 'navegacional')),
        descripcion: slot(TEXTO),
      }),
    ),
  },
  validityPredicate: [exists(p('flujo', 'tipo')), exists(p('flujo', 'descripcion'))],
  rectorBindings: [],
  mapsToKinds: [],
  mappingNotes: 'BRECHA DECLARADA, mismo tipo que dim6.req01.',
};

const req07: RequirementV0 = {
  id: 'dim6.req07',
  dimensionId: 'dim6',
  packageId: 'pkg.composicion.adaptacion',
  eje: 'ciclo-de-vida',
  pregunta: '¿Declara el sistema cómo se adapta su composición entre formatos/contextos (o la decisión explícita de que no cambia)?',
  estado: 'active',
  dependsOn: ['dim6.req01'],
  payloadSchema: {
    adaptaciones: slot(
      lista(
        objeto({
          contexto: slot(TEXTO),
          ajuste: slot(TEXTO),
        }),
      ),
    ),
  },
  validityPredicate: [exists(p('adaptaciones'))],
  rectorBindings: [],
  mapsToKinds: [],
  mappingNotes:
    'BRECHA DECLARADA, mismo tipo que dim1.req10/dim2.req06/dim3.req06 — campo transversal, se resuelve en el adaptador de destino.',
};

export const DIM6_REQUIREMENTS_V0: readonly RequirementV0[] = [
  req01,
  req02,
  req03,
  req04,
  req05,
  req06,
  req07,
];

export const DIM6_MANIFEST_V0: RequirementManifestV0 = {
  schemaVersion: 1,
  manifestVersion: '1.0',
  revision: 1,
  requirements: [...DIM6_REQUIREMENTS_V0],
};
