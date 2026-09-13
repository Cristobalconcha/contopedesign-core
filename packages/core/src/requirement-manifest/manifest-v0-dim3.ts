/**
 * Manifiesto v0 de la Dimensión 3 — Espacio, ritmo, retícula y contenedores
 * (spec-c1-dim3-espacio-manifest-2026-08-31.md §3, 2 pasadas adversariales
 * aplicadas antes de esta implementación).
 *
 * Los siete requisitos de §3 fielmente (IDs, ejes, dependsOn, payloadSchemas,
 * mapsToKinds — incluidas las brechas DECLARADAS en mappingNotes).
 *
 * Diferencia deliberada frente a dim1/dim2 (spec §2): ningún requisito
 * declara `rectorBindings`/`noConflict('mood-wall')` — la taxonomía nombra
 * expresamente color/tipografía/imagen/composición como los dominios que
 * mood-wall gobierna, espacio no aparece ahí.
 *
 * CERO PROSA: cada validityPredicate es AST puro serializable, igual que
 * manifest-v0-dim1.ts/dim2.ts.
 */
import type {
  CoverExpected,
  Operand,
  PathSegment,
  PredicateClause,
  ScalarLiteral,
} from './predicate.js';
import type { PayloadFieldSchema, PayloadType, RequirementManifestV0, RequirementV0 } from './types.js';

// ---------------------------------------------------------------------------
// Constructores de AST (mismo patrón que manifest-v0-dim1.ts/dim2.ts)
// ---------------------------------------------------------------------------

const p = (...parts: PathSegment[]): readonly PathSegment[] => parts;
const op = (...parts: PathSegment[]): Operand => ({ kind: 'path', path: parts });

const num = (value: number): ScalarLiteral => ({ kind: 'number', value });
const str = (value: string): ScalarLiteral => ({ kind: 'string', value });

const eq = (left: Operand, right: Operand): PredicateClause => ({ kind: 'compare', op: '==', left, right });
const gte = (left: Operand, right: Operand): PredicateClause => ({ kind: 'compare', op: '>=', left, right });

const exists = (target: readonly PathSegment[]): PredicateClause => ({ kind: 'exists', target });
const each = (target: readonly PathSegment[], condition: PredicateClause): PredicateClause => ({
  kind: 'each',
  target,
  condition,
});
const and = (...clauses: PredicateClause[]): PredicateClause => ({ kind: 'and', clauses });
const or = (...clauses: PredicateClause[]): PredicateClause => ({ kind: 'or', clauses });
const covers = (
  target: readonly PathSegment[],
  key: readonly string[],
  expected: readonly CoverExpected[],
): PredicateClause => ({ kind: 'covers', target, key, expected });
const reference = (target: readonly PathSegment[], reqId: string): PredicateClause => ({
  kind: 'reference',
  target,
  reqId,
});
const validCss = (target: readonly PathSegment[]): PredicateClause => ({
  kind: 'validCss',
  target,
  cssType: 'longitud-css',
});
const count = (target: readonly PathSegment[]): Operand => ({ kind: 'count', target });

// Constructores del payloadSchema
const LONGITUD_CSS: PayloadType = { kind: 'longitud-css' };
const TEXTO: PayloadType = { kind: 'texto' };
const refTo = (reqId: string): PayloadType => ({ kind: 'ref', reqId });
const enumOf = (...values: string[]): PayloadType => ({ kind: 'enum', values });
const numero = (min?: number, max?: number): PayloadType => ({
  kind: 'numero',
  ...(min !== undefined ? { min } : {}),
  ...(max !== undefined ? { max } : {}),
});
const lista = (of: PayloadType): PayloadType => ({ kind: 'lista', of });
const objeto = (fields: Record<string, PayloadFieldSchema>): PayloadType => ({ kind: 'objeto', fields });
const union = (of: PayloadType[]): PayloadType => ({ kind: 'union', of });
const slot = (type: PayloadType, optional = false): PayloadFieldSchema =>
  optional ? { type, optional: true } : { type };
const opt = (type: PayloadType): PayloadFieldSchema => ({ type, optional: true });

// ---------------------------------------------------------------------------
// Constantes cerradas de la dimensión (spec §2-3)
// ---------------------------------------------------------------------------

/** Los tres roles espaciales semánticos (spec §3 dim3.req02, tensión 2: cerrados por analogía). */
const SPATIAL_ROLES_3 = ['intraelemento', 'interelemento', 'entre-secciones'] as const;

/** Las diez claves del almacén plano relevantes a esta dimensión (spec §3 dim3.req07). */
const FLAT_STORE_FIELD = 'spacing';

// ---------------------------------------------------------------------------
// Los siete requisitos
// ---------------------------------------------------------------------------

const req01: RequirementV0 = {
  id: 'dim3.req01',
  dimensionId: 'dim3',
  packageId: 'pkg.espacio.fundamento',
  eje: 'completitud',
  pregunta: '¿Cuenta el sistema con una unidad espacial base y una escala de pasos derivada de ella?',
  estado: 'active',
  dependsOn: [],
  payloadSchema: {
    unidad: slot(LONGITUD_CSS),
    escala: slot(lista(objeto({ step: slot(numero(1)), value: slot(LONGITUD_CSS) }))),
  },
  validityPredicate: [
    exists(p('unidad')),
    validCss(p('unidad')),
    exists(p('escala')),
    each(p('escala'), validCss(p('value'))),
  ],
  rectorBindings: [],
  mapsToKinds: [],
  mappingNotes:
    'el fundamento es la escala de origen; se proyecta indirectamente vía los valores concretos que cada rol espacial de dim3.req02 deriva de ella. Mismo tratamiento que dim1.req01/dim2.req01.',
};

const req02: RequirementV0 = {
  id: 'dim3.req02',
  dimensionId: 'dim3',
  packageId: 'pkg.espacio.roles',
  eje: 'completitud',
  pregunta:
    '¿Están mapeados con valor espacial efectivo los tres roles semánticos que declara la taxonomía (intraelemento, interelemento, entre secciones)?',
  estado: 'active',
  dependsOn: ['dim3.req01'],
  payloadSchema: {
    roleSpacing: slot(
      lista(
        objeto({
          role: slot(enumOf(...SPATIAL_ROLES_3)),
          value: slot(union([refTo('dim3.req01'), LONGITUD_CSS])),
          source: slot(TEXTO),
          derivation: slot(
            objeto({
              of: slot(enumOf('dim3.req01', 'direct')),
              rule: opt(TEXTO),
            }),
          ),
        }),
      ),
    ),
  },
  validityPredicate: [
    covers(
      p('roleSpacing'),
      ['role'],
      SPATIAL_ROLES_3.map((role) => str(role)),
    ),
    each(p('roleSpacing'), or(reference(p('value'), 'dim3.req01'), validCss(p('value')))),
    each(
      p('roleSpacing'),
      or(eq(op('derivation', 'of'), str('dim3.req01')), exists(p('derivation', 'rule'))),
    ),
  ],
  rectorBindings: [],
  mapsToKinds: [
    {
      kind: 'spacing',
      valueNotes:
        'role -> uno o más de paddingBlock/paddingInline/gap según el contexto de aplicación (D3 §2, atLeastOneOf) — el mapeo exacto role→campo no es 1:1 fijo, se resuelve en C2/proyector según dónde se aplique cada instancia; brecha parcial declarada, mismo tipo que dim2.req04 (measure/align sí, paragraphSpacing no)',
    },
  ],
};

const req03: RequirementV0 = {
  id: 'dim3.req03',
  dimensionId: 'dim3',
  packageId: 'pkg.espacio.ritmo',
  eje: 'completitud',
  pregunta: '¿Declara el sistema un ritmo vertical (línea base) derivado de la unidad espacial, y a qué elementos se aplica?',
  estado: 'active',
  dependsOn: ['dim3.req01'],
  payloadSchema: {
    ritmo: slot(
      objeto({
        baseline: slot(refTo('dim3.req01')),
        aplicaA: slot(lista(TEXTO)),
        alineacion: slot(enumOf('start', 'center', 'end', 'justify', 'baseline')),
      }),
    ),
  },
  validityPredicate: [
    exists(p('ritmo', 'baseline')),
    reference(p('ritmo', 'baseline'), 'dim3.req01'),
    exists(p('ritmo', 'aplicaA')),
    exists(p('ritmo', 'alineacion')),
  ],
  rectorBindings: [],
  mapsToKinds: [],
  mappingNotes:
    'BRECHA DECLARADA: el designRuleSet no tiene kind de ritmo/línea base; el compilador no verifica alineación a grilla vertical. El ritmo vive en el DesignSet (C2) como restricción de coherencia, no como regla emitida.',
};

const req04: RequirementV0 = {
  id: 'dim3.req04',
  dimensionId: 'dim3',
  packageId: 'pkg.espacio.reticula',
  eje: 'validez',
  pregunta: '¿Tiene el sistema retículas efectivas (columnas, medianiles, anchos de módulo) para al menos un contexto de composición?',
  estado: 'active',
  dependsOn: ['dim3.req01'],
  payloadSchema: {
    reticulas: slot(
      lista(
        objeto({
          contexto: slot(TEXTO),
          columns: slot(numero(1, 8)),
          gap: slot(refTo('dim3.req01')),
          minColumnWidth: opt(LONGITUD_CSS),
          align: opt(TEXTO),
          justify: opt(TEXTO),
        }),
      ),
    ),
  },
  validityPredicate: [
    exists(p('reticulas')),
    each(p('reticulas'), exists(p('columns'))),
    each(p('reticulas'), reference(p('gap'), 'dim3.req01')),
  ],
  rectorBindings: [],
  mapsToKinds: [
    {
      kind: 'layout',
      scopeSuggestion: { breakpoint: ['all'] },
      valueNotes:
        'columns/gap/minColumnWidth/align/justify aplicación directa (D3 §2); GAP PARCIAL: mode (stack|columns|grid|metro|masonry|cluster|carousel) es obligatorio para una regla layout completa y este requisito no lo declara — decisión de instancia, se resuelve en C2 al proyectar',
    },
  ],
};

const req05: RequirementV0 = {
  id: 'dim3.req05',
  dimensionId: 'dim3',
  packageId: 'pkg.espacio.contenedores',
  eje: 'validez',
  pregunta: '¿Declara el sistema al menos dos contenedores con ancho máximo, padding efectivo y relación explícita con el soporte (viewport/impreso)?',
  estado: 'active',
  dependsOn: ['dim3.req02', 'dim3.req04'],
  payloadSchema: {
    contenedores: slot(
      lista(
        objeto({
          nombre: slot(TEXTO),
          maxWidth: slot(LONGITUD_CSS),
          padding: slot(refTo('dim3.req02')),
          relacionSoporte: slot(TEXTO),
        }),
      ),
    ),
  },
  validityPredicate: [
    gte(count(p('contenedores')), num(2)),
    each(p('contenedores'), validCss(p('maxWidth'))),
    each(p('contenedores'), reference(p('padding'), 'dim3.req02')),
    each(p('contenedores'), exists(p('relacionSoporte'))),
  ],
  rectorBindings: [],
  mapsToKinds: [
    {
      kind: 'layout',
      valueNotes:
        'maxWidth aplicación directa (D3 §2); padding se resuelve vía dim3.req02, no vía un campo propio de layout — gap parcial, mismo tipo que dim3.req02',
    },
  ],
};

const req06: RequirementV0 = {
  id: 'dim3.req06',
  dimensionId: 'dim3',
  packageId: 'pkg.espacio.densidad',
  eje: 'ciclo-de-vida',
  pregunta: '¿Declara el sistema cómo cambian sus reglas espaciales entre densidades (compacto/cómodo) y en reflujo (stacking, orden)?',
  estado: 'active',
  dependsOn: ['dim3.req02'],
  payloadSchema: {
    adaptaciones: slot(
      lista(
        objeto({
          contexto: slot(TEXTO),
          roleAfectado: slot(refTo('dim3.req02')),
          ajuste: slot(TEXTO),
        }),
      ),
    ),
  },
  validityPredicate: [exists(p('adaptaciones'))],
  rectorBindings: [],
  mapsToKinds: [],
  mappingNotes:
    "adaptación contextual es campo transversal de la taxonomía ('Adaptación contextual'), no vive en el designRuleSet como regla individual — se resuelve en el adaptador de destino, no aquí. Brecha declarada, mismo tipo que dim1.req10/dim2.req06.",
};

const req07: RequirementV0 = {
  id: 'dim3.req07',
  dimensionId: 'dim3',
  packageId: 'pkg.espacio.fundamento',
  eje: 'coherencia',
  pregunta:
    '¿Está declarada la relación entre la escala espacial de este manifiesto y el único campo espacial del almacén plano de WordPress (spacing, número 0-64px)?',
  estado: 'active',
  dependsOn: ['dim3.req01'],
  payloadSchema: {
    correspondencia: slot(
      objeto({
        campoPlano: slot(enumOf(FLAT_STORE_FIELD)),
        escalaRelacionada: slot(refTo('dim3.req01')),
        nota: slot(TEXTO),
      }),
    ),
  },
  validityPredicate: [
    exists(p('correspondencia')),
    eq(op('correspondencia', 'campoPlano'), str(FLAT_STORE_FIELD)),
    reference(p('correspondencia', 'escalaRelacionada'), 'dim3.req01'),
  ],
  rectorBindings: [],
  mapsToKinds: [],
  mappingNotes:
    'este requisito documenta una relación con el ALMACÉN PLANO, no con el designRuleSet — no hay kind porque no es una regla nueva, es trazabilidad de una dependencia ya existente (y hoy sin consumidor) en producción. Brecha declarada (mismo tipo que dim1.req11/dim2.req07, provenance).',
};

export const DIM3_REQUIREMENTS_V0: readonly RequirementV0[] = [
  req01,
  req02,
  req03,
  req04,
  req05,
  req06,
  req07,
];

export const DIM3_MANIFEST_V0: RequirementManifestV0 = {
  schemaVersion: 1,
  manifestVersion: '1.0',
  revision: 1,
  requirements: [...DIM3_REQUIREMENTS_V0],
};
