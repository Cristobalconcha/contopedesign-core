/**
 * Manifiesto v0 de la Dimensión 2 — Tipografía y jerarquía escrita
 * (spec-c1-dim2-tipografia-manifest-2026-08-31.md §3).
 *
 * Los ocho requisitos de §3 fielmente (IDs, ejes, dependsOn, payloadSchemas,
 * mapsToKinds — incluidas las brechas DECLARADAS en mappingNotes) más el
 * implícito de §3 "dim2.req08" (voces y contextos), con slots formales sin
 * nombres con espacios (misma condición R1 que dim1).
 *
 * CERO PROSA: cada validityPredicate es AST puro serializable, igual que
 * manifest-v0-dim1.ts.
 *
 * Corrección de implementación (2026-08-31, no estaba en la spec original):
 * `dim2.req08.voces[].role` se declaró en la spec como `ref(dim2.req02)`,
 * pero eso hace que `covers(voces, ['role'], ...)` sea estructuralmente
 * inexpresable — `covers` compara el campo clave con `scalarEquals` (string/
 * número/bool), nunca contra un `RefValue` (objeto `{refReqId, refPath}`).
 * Corregido a `role: enumOf(...CORE_ROLES_9)`, el mismo patrón que ya usa
 * `dim1.req06` (`stateColors[].role`) y el propio `dim2.req02`: la identidad
 * de un rol Core es su nombre cerrado, no una referencia — los refs se
 * reservan para VALORES que de otro modo se duplicarían (ver C1 §2.1).
 */
import type {
  CompareOp,
  CoverExpected,
  Operand,
  PathSegment,
  PredicateClause,
  ScalarLiteral,
} from './predicate.js';
import {
  CORE_ROLES_9,
  type PayloadFieldSchema,
  type PayloadType,
  type RequirementManifestV0,
  type RequirementV0,
} from './types.js';

// ---------------------------------------------------------------------------
// Constructores de AST (mismo patrón que manifest-v0-dim1.ts, redeclarados
// localmente para mantener cada manifiesto de dimensión autocontenido)
// ---------------------------------------------------------------------------

const p = (...parts: PathSegment[]): readonly PathSegment[] => parts;
const op = (...parts: PathSegment[]): Operand => ({ kind: 'path', path: parts });

const num = (value: number): ScalarLiteral => ({ kind: 'number', value });
const str = (value: string): ScalarLiteral => ({ kind: 'string', value });

const eq = (left: Operand, right: Operand): PredicateClause => ({ kind: 'compare', op: '==', left, right });
const compareCss = (op_: CompareOp, left: Operand, right: Operand): PredicateClause => ({
  kind: 'compareCss',
  cssType: 'longitud-css',
  op: op_,
  left,
  right,
});

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
const noConflict = (rectoraId: string): PredicateClause => ({ kind: 'noConflict', rectoraId });
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
// Constantes cerradas de la dimensión (spec §3-4)
// ---------------------------------------------------------------------------

const FLAT_STORE_FIELDS = [
  'font_heading',
  'font_body',
  'font_accent',
  'size_base',
  'h1_size',
  'h2_size',
  'h3_size',
  'h4_size',
  'h5_size',
  'h6_size',
] as const;

// ---------------------------------------------------------------------------
// Los ocho requisitos
// ---------------------------------------------------------------------------

const req01: RequirementV0 = {
  id: 'dim2.req01',
  dimensionId: 'dim2',
  packageId: 'pkg.tipografia.fundamento',
  eje: 'completitud',
  pregunta:
    '¿Cuenta el sistema con un fundamento tipográfico efectivo: familias con fallbacks, cobertura de idiomas/caracteres y disponibilidad o licencia declarada?',
  estado: 'active',
  dependsOn: [],
  payloadSchema: {
    familias: slot(
      lista(
        objeto({
          name: slot(TEXTO),
          stack: slot(lista(TEXTO)),
          idiomas: slot(lista(TEXTO)),
          licencia: slot(TEXTO),
        }),
      ),
    ),
  },
  validityPredicate: [
    exists(p('familias')),
    each(p('familias'), and(exists(p('stack')), { kind: 'compare', op: '>=', left: count(p('stack')), right: num(1) })),
    each(p('familias'), exists(p('licencia'))),
    noConflict('descriptor'),
    noConflict('mood-wall'),
  ],
  rectorBindings: ['descriptor', 'mood-wall'],
  mapsToKinds: [],
  mappingNotes:
    'el fundamento es el catálogo de origen; se proyecta indirectamente vía family en cada regla typography que lo referencia (dim2.req02).',
};

const req02: RequirementV0 = {
  id: 'dim2.req02',
  dimensionId: 'dim2',
  packageId: 'pkg.tipografia.roles',
  eje: 'completitud',
  pregunta: '¿Están mapeados con estilo tipográfico efectivo los nueve roles Core del sistema?',
  estado: 'active',
  dependsOn: ['dim2.req01'],
  payloadSchema: {
    roleStyles: slot(
      lista(
        objeto({
          role: slot(enumOf(...CORE_ROLES_9)),
          family: slot(union([refTo('dim2.req01'), TEXTO])),
          fontSize: slot(LONGITUD_CSS),
          fontWeight: slot(numero(100, 900)),
          lineHeight: slot(numero(0.8, 3)),
          letterSpacing: opt(LONGITUD_CSS),
          source: slot(TEXTO),
          derivation: slot(
            objeto({
              of: slot(enumOf('dim2.req01', 'direct')),
              rule: opt(TEXTO),
            }),
          ),
        }),
      ),
    ),
  },
  validityPredicate: [
    covers(
      p('roleStyles'),
      ['role'],
      CORE_ROLES_9.map((role) => str(role)),
    ),
    each(p('roleStyles'), or(reference(p('family'), 'dim2.req01'), exists(p('family')))),
    each(
      p('roleStyles'),
      or(eq(op('derivation', 'of'), str('dim2.req01')), exists(p('derivation', 'rule'))),
    ),
    noConflict('mood-wall'),
  ],
  rectorBindings: ['mood-wall'],
  mapsToKinds: [
    {
      kind: 'typography',
      scopeSuggestion: { breakpoint: ['all'], state: ['default'] },
      valueNotes:
        'role -> typography.role; family/fontSize/fontWeight/lineHeight/letterSpacing aplicación directa (D3 §2)',
    },
  ],
};

const req03: RequirementV0 = {
  id: 'dim2.req03',
  dimensionId: 'dim2',
  packageId: 'pkg.tipografia.escala',
  eje: 'coherencia',
  pregunta:
    '¿Son distinguibles entre sí los niveles jerárquicos definidos por los roles (nadie confunde subtítulo con cuerpo por tamaño o peso iguales)?',
  estado: 'active',
  dependsOn: ['dim2.req02'],
  payloadSchema: {
    pares: slot(
      lista(
        objeto({
          mayor: slot(refTo('dim2.req02')),
          menor: slot(refTo('dim2.req02')),
          distincion: slot(enumOf('tamaño', 'peso', 'ambos')),
        }),
      ),
    ),
  },
  validityPredicate: [
    exists(p('pares')),
    // "cuando distincion incluye tamaño" = distincion !== 'peso'; compareCss
    // (extensión de gramática 2026-08-31, commit 0dad04c) porque fontSize es
    // longitud-css, no numero — ver corrección de la spec §3 dim2.req03.
    each(
      p('pares'),
      or(
        eq(op('distincion'), str('peso')),
        compareCss('>=', op('mayor', 'fontSize'), op('menor', 'fontSize')),
      ),
    ),
  ],
  rectorBindings: [],
  mapsToKinds: [],
  mappingNotes:
    'la relación entre roles no tiene kind propio en el designRuleSet; cada rol se aplica independiente (D3 §2) — la coherencia jerárquica es responsabilidad de este manifiesto, no del compilador. Brecha declarada.',
};

const req04: RequirementV0 = {
  id: 'dim2.req04',
  dimensionId: 'dim2',
  packageId: 'pkg.tipografia.lectura',
  eje: 'validez',
  pregunta:
    '¿Tiene el sistema reglas efectivas de medida, interlineado, tracking, espaciado de párrafo y alineación para los roles de lectura prolongada (cuerpo, cita, nota)?',
  estado: 'active',
  dependsOn: ['dim2.req02'],
  payloadSchema: {
    reglas: slot(
      lista(
        objeto({
          role: slot(enumOf('cuerpo', 'cita', 'nota')),
          measure: slot(LONGITUD_CSS),
          paragraphSpacing: slot(LONGITUD_CSS),
          align: slot(enumOf('left', 'right', 'center', 'justify')),
        }),
      ),
    ),
  },
  validityPredicate: [
    covers(p('reglas'), ['role'], [str('cuerpo'), str('cita'), str('nota')]),
    each(p('reglas'), and(exists(p('measure')), exists(p('paragraphSpacing')))),
  ],
  rectorBindings: [],
  mapsToKinds: [
    {
      kind: 'typography',
      valueNotes:
        'measure/align -> typography.measure/align; paragraphSpacing sin campo directo, se declara gap parcial',
    },
  ],
};

const req05: RequirementV0 = {
  id: 'dim2.req05',
  dimensionId: 'dim2',
  packageId: 'pkg.tipografia.enfasis',
  eje: 'completitud',
  pregunta:
    '¿Declara el sistema cómo se expresan énfasis (negrita/cursiva/subrayado), números y tablas dentro del flujo de texto?',
  estado: 'active',
  dependsOn: ['dim2.req02'],
  payloadSchema: {
    enfasis: slot(
      objeto({
        negrita: slot(objeto({ fontWeight: slot(numero(100, 900)) })),
        cursiva: slot(objeto({ style: slot(enumOf('italic', 'oblique')) })),
        subrayado: slot(objeto({ decoration: slot(TEXTO) })),
      }),
    ),
    numeros: slot(enumOf('proporcional', 'tabular')),
    tablas: slot(TEXTO),
  },
  validityPredicate: [
    exists(p('enfasis', 'negrita')),
    exists(p('enfasis', 'cursiva')),
    exists(p('enfasis', 'subrayado')),
    exists(p('numeros')),
  ],
  rectorBindings: [],
  mapsToKinds: [
    {
      kind: 'typography',
      valueNotes:
        'fontWeight/style/decoration ya son campos directos (D3 §2); numeros/tablas sin campo, gap parcial',
    },
  ],
};

const req06: RequirementV0 = {
  id: 'dim2.req06',
  dimensionId: 'dim2',
  packageId: 'pkg.tipografia.editorial',
  eje: 'ciclo-de-vida',
  pregunta:
    '¿Declara el sistema cómo cambian sus reglas tipográficas entre formatos (pantalla/impreso) y densidades (compacto/cómodo)?',
  estado: 'active',
  dependsOn: ['dim2.req02'],
  payloadSchema: {
    adaptaciones: slot(
      lista(
        objeto({
          contexto: slot(TEXTO),
          roleAfectado: slot(refTo('dim2.req02')),
          ajuste: slot(TEXTO),
        }),
      ),
    ),
  },
  validityPredicate: [exists(p('adaptaciones'))],
  rectorBindings: [],
  mapsToKinds: [],
  mappingNotes:
    "adaptación contextual es campo transversal de la taxonomía ('Adaptación contextual'), no vive en el designRuleSet como regla individual — se resuelve en el adaptador de destino, no aquí. Brecha declarada.",
};

const req07: RequirementV0 = {
  id: 'dim2.req07',
  dimensionId: 'dim2',
  packageId: 'pkg.tipografia.fundamento',
  eje: 'coherencia',
  pregunta:
    '¿Está declarada la relación entre los nueve roles de este manifiesto y los siete campos tipográficos del almacén plano de WordPress (font_heading, font_body, font_accent, size_base, h1_size…h6_size)?',
  estado: 'active',
  dependsOn: ['dim2.req01', 'dim2.req02'],
  payloadSchema: {
    correspondencias: slot(
      lista(
        objeto({
          campoPlano: slot(enumOf(...FLAT_STORE_FIELDS)),
          role: slot(refTo('dim2.req02')),
          nota: slot(TEXTO),
        }),
      ),
    ),
  },
  validityPredicate: [
    covers(
      p('correspondencias'),
      ['campoPlano'],
      FLAT_STORE_FIELDS.map((campo) => str(campo)),
    ),
  ],
  rectorBindings: [],
  mapsToKinds: [],
  mappingNotes:
    'este requisito documenta una relación con el ALMACÉN PLANO, no con el designRuleSet — no hay kind porque no es una regla nueva, es trazabilidad de una dependencia ya existente en producción. Brecha declarada (mismo tipo que dim1.req11, provenance).',
};

/**
 * dim2.req08 (implícito, spec §3): "comparación de voces, fallbacks y
 * contextos" mencionado en la taxonomía pero sin requisito operativo
 * explícito arriba — análogo a dim1.req13 (I5).
 *
 * Corrección de implementación: `role` es `enumOf(...CORE_ROLES_9)`, no
 * `ref(dim2.req02)` como decía la spec original (ver docblock del archivo).
 */
const req08: RequirementV0 = {
  id: 'dim2.req08',
  dimensionId: 'dim2',
  packageId: 'pkg.tipografia.voces',
  eje: 'fuerza',
  pregunta:
    '¿Declara el sistema qué tan fija o explorable es cada combinación rol+familia (una "voz" tipográfica), para saber si puede sustituirse sin romper la identidad?',
  estado: 'active',
  dependsOn: ['dim2.req02'],
  payloadSchema: {
    voces: slot(
      lista(
        objeto({
          role: slot(enumOf(...CORE_ROLES_9)),
          fuerza: slot(enumOf('inamovible', 'prioritaria', 'explorable')),
        }),
      ),
    ),
  },
  validityPredicate: [
    covers(
      p('voces'),
      ['role'],
      CORE_ROLES_9.map((role) => str(role)),
    ),
  ],
  rectorBindings: [],
  mapsToKinds: [],
  mappingNotes:
    "fuerza es un eje transversal del manifiesto (Puerta 0), no un campo del designRuleSet — vive en el propio DesignSetEntryV0.fuerza (C2), no se proyecta a producción. Brecha declarada por diseño, no por carencia.",
};

export const DIM2_REQUIREMENTS_V0: readonly RequirementV0[] = [
  req01,
  req02,
  req03,
  req04,
  req05,
  req06,
  req07,
  req08,
];

export const DIM2_MANIFEST_V0: RequirementManifestV0 = {
  schemaVersion: 1,
  manifestVersion: '1.0',
  revision: 1,
  requirements: [...DIM2_REQUIREMENTS_V0],
};
