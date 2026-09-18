/**
 * Manifiesto v0 de la Dimensión 1 — Color y superficies (spec §7).
 *
 * Los 12 requisitos de la fixture §7.1 FIELMENTE (IDs, ejes, dependsOn,
 * payloadSchemas, mapsToKinds — incluidos los 6 vacíos DECLARADOS en
 * mappingNotes) más el implícito I5 (spec §5) como dim1.req13, con slots
 * formales sin nombres con espacios (condición R1 de la auditoría).
 *
 * CERO PROSA: cada validityPredicate es AST puro serializable. La
 * serialización del manifiesto es el propio dato (decisión 1 de la ficha).
 * La formalización de cada predicado en prosa de la fixture está documentada
 * en vault_contope-design/c1-implementacion-extension-gramatica-2026-08-30.md.
 */
import type {
  CoverExpected,
  Operand,
  PathSegment,
  PredicateClause,
  ScalarLiteral,
} from './predicate.js';
import {
  CORE_ROLES_13,
  type PayloadFieldSchema,
  type PayloadType,
  type RequirementManifestV0,
  type RequirementV0,
} from './types.js';

// ---------------------------------------------------------------------------
// Constructores de AST (mantienen el dato serializable y tipado)
// ---------------------------------------------------------------------------

/** Ruta desnuda (targets de cláusulas, colecciones de agregadores). */
const p = (...parts: PathSegment[]): readonly PathSegment[] => parts;

/** Operando de comparación que referencia una ruta del payload. */
const op = (...parts: PathSegment[]): Operand => ({ kind: 'path', path: parts });

const num = (value: number): ScalarLiteral => ({ kind: 'number', value });
const str = (value: string): ScalarLiteral => ({ kind: 'string', value });

const eq = (left: Operand, right: Operand): PredicateClause => ({ kind: 'compare', op: '==', left, right });
const gte = (left: Operand, right: Operand): PredicateClause => ({ kind: 'compare', op: '>=', left, right });

const exists = (target: readonly PathSegment[]): PredicateClause => ({ kind: 'exists', target });
const singleton = (target: readonly PathSegment[]): PredicateClause => ({ kind: 'singleton', target });
const each = (target: readonly PathSegment[], condition: PredicateClause): PredicateClause => ({
  kind: 'each',
  target,
  condition,
});
const some = (
  target: readonly PathSegment[],
  alias: string,
  condition: PredicateClause,
): PredicateClause => ({ kind: 'some', target, alias, condition });
const everyPar = (
  target: readonly PathSegment[],
  components: readonly string[],
  condition: PredicateClause,
): PredicateClause => ({ kind: 'everyPar', target, components, condition });
const and = (...clauses: PredicateClause[]): PredicateClause => ({ kind: 'and', clauses });
const or = (...clauses: PredicateClause[]): PredicateClause => ({ kind: 'or', clauses });
const not = (clause: PredicateClause): PredicateClause => ({ kind: 'not', clause });
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
  cssType: 'color-css',
});
const verified = (pruebaId: string): PredicateClause => ({ kind: 'verified', pruebaId });
const noConflict = (rectoraId: string): PredicateClause => ({ kind: 'noConflict', rectoraId });
const count = (target: readonly PathSegment[]): Operand => ({ kind: 'count', target });
const sum = (collection: readonly PathSegment[], field: string): Operand => ({
  kind: 'sum',
  collection,
  field,
});
const eachIn = (
  reqId: string,
  path: readonly PathSegment[],
  alias: string,
  condition: PredicateClause,
): PredicateClause => ({ kind: 'eachIn', reqId, path, alias, condition });
const everyDef = (
  dimensionId: string,
  reqAlias: string,
  payloadAlias: string,
  condition: PredicateClause,
): PredicateClause => ({ kind: 'everyDef', dimensionId, reqAlias, payloadAlias, condition });
const containsNoneOf = (
  target: readonly PathSegment[],
  literalsPath: readonly PathSegment[],
): PredicateClause => ({ kind: 'containsNoneOf', target, literalsPath });

// Constructores del payloadSchema
const COLOR_CSS: PayloadType = { kind: 'color-css' };
const LONGITUD_CSS: PayloadType = { kind: 'longitud-css' };
const TEXTO: PayloadType = { kind: 'texto' };
const REF: PayloadType = { kind: 'ref' };
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
// Constantes cerradas de la dimensión (spec §7)
// ---------------------------------------------------------------------------

const INTERACTIVE_ROLES = ['action', 'focus', 'active', 'inactive'] as const;
const INTERACTIVE_STATES = ['default', 'hover', 'focus', 'active'] as const;

/**
 * Matriz roles × estados de dim1.req06. La fixture escribe "matriz roles x
 * estados aplicables" sin enumerarla; ninguna fuente enumera qué pares son
 * "aplicables". Decisión declarada: matriz COMPLETA 4×4 (16 pares) — la
 * lectura más conservadora (fail-closed); si el set debe reducirla, es una
 * edición explícita del manifiesto, no un default silencioso.
 */
const STATE_PAIRS = INTERACTIVE_ROLES.flatMap((role) =>
  INTERACTIVE_STATES.map(
    (state): { kind: 'tuple'; items: readonly ScalarLiteral[] } => ({
      kind: 'tuple',
      items: [str(role), str(state)],
    }),
  ),
);

const MEANINGS_5 = ['success', 'warning', 'error', 'active', 'inactive'] as const;

// ---------------------------------------------------------------------------
// Los trece requisitos
// ---------------------------------------------------------------------------

const req01: RequirementV0 = {
  id: 'dim1.req01',
  dimensionId: 'dim1',
  packageId: 'pkg.color.fundamento',
  eje: 'completitud',
  pregunta:
    '¿Cuenta el sistema con un fundamento cromático efectivo: colores institucionales y neutrales, con procedencia declarada?',
  estado: 'active',
  dependsOn: [],
  payloadSchema: {
    institucionales: slot(lista(objeto({ name: slot(TEXTO), value: slot(COLOR_CSS) }))),
    neutros: slot(lista(objeto({ name: slot(TEXTO), value: slot(COLOR_CSS) }))),
  },
  validityPredicate: [
    exists(p('institucionales')),
    exists(p('neutros')),
    each(p('institucionales'), validCss(p('value'))),
    each(p('neutros'), validCss(p('value'))),
    noConflict('descriptor'),
    noConflict('mood-wall'),
  ],
  rectorBindings: ['descriptor', 'mood-wall'],
  mapsToKinds: [
    {
      kind: 'color',
      scopeSuggestion: { breakpoint: ['all'], state: ['default'] },
      valueNotes:
        'institucionales -> roles background|canvas; neutrales -> text|ink; aplicación directa solo para esos roles (class-cod-canvas-mcp-recipe-compiler.php:2738)',
    },
  ],
};

const req02: RequirementV0 = {
  id: 'dim1.req02',
  dimensionId: 'dim1',
  packageId: 'pkg.color.roles',
  eje: 'completitud',
  pregunta: '¿Están mapeados con color efectivo los 13 roles Core del sistema?',
  estado: 'active',
  dependsOn: ['dim1.req01'],
  payloadSchema: {
    roleColors: slot(
      lista(
        objeto({
          role: slot(enumOf(...CORE_ROLES_13)),
          color: slot(union([refTo('dim1.req01'), COLOR_CSS])),
          source: slot(TEXTO),
          // "Deriva de" como DATO (decisión documentada en la nota R1):
          // la derivación se declara en el payload y se compara con ==.
          derivation: slot(
            objeto({
              of: slot(enumOf('dim1.req01', 'direct')),
              rule: opt(TEXTO),
            }),
          ),
        }),
      ),
    ),
  },
  validityPredicate: [
    covers(
      p('roleColors'),
      ['role'],
      CORE_ROLES_13.map((role) => str(role)),
    ),
    each(p('roleColors'), or(reference(p('color'), 'dim1.req01'), validCss(p('color')))),
    each(
      p('roleColors'),
      or(eq(op('derivation', 'of'), str('dim1.req01')), exists(p('derivation', 'rule'))),
    ),
    noConflict('mood-wall'),
  ],
  rectorBindings: ['mood-wall'],
  mapsToKinds: [
    {
      kind: 'color',
      scopeSuggestion: { breakpoint: ['all'], state: ['default'] },
      valueNotes:
        'background|surface|canvas -> background-color; text|foreground|ink|muted -> color; el resto de roles solo emite variable --cod-color-<rol> (class-cod-canvas-mcp-recipe-compiler.php:2738)',
    },
  ],
};

const req03: RequirementV0 = {
  id: 'dim1.req03',
  dimensionId: 'dim1',
  packageId: 'pkg.color.roles',
  eje: 'coherencia',
  pregunta:
    '¿El color del rol de acción (accent) es LA fuente única de las acciones primarias del sistema, sin duplicados?',
  estado: 'active',
  dependsOn: ['dim1.req02'],
  payloadSchema: {
    actionColor: slot(
      objeto({
        role: slot(enumOf('accent')),
        source: slot(refTo('dim1.req02')),
      }),
    ),
  },
  validityPredicate: [
    exists(p('actionColor')),
    singleton(p('actionColor')),
    eq(op('actionColor', 'role'), str('accent')),
    reference(p('actionColor', 'source'), 'dim1.req02'),
    noConflict('mood-wall'),
  ],
  rectorBindings: ['mood-wall'],
  mapsToKinds: [
    {
      kind: 'color',
      valueNotes: 'role=accent -> variable --cod-color-accent (class-cod-theme-definitions.php:72,268)',
    },
    {
      kind: 'button',
      valueNotes:
        'tone=primary consume var(--cod-color-accent) (class-cod-canvas-mcp-recipe-compiler.php:3011). El puente completo (I1) se exige en dim7.req08',
    },
  ],
};

const req04: RequirementV0 = {
  id: 'dim1.req04',
  dimensionId: 'dim1',
  packageId: 'pkg.color.fundamento',
  eje: 'completitud',
  pregunta: '¿Cada color institucional posee una rampa (escala de pasos) declarada?',
  estado: 'active',
  dependsOn: ['dim1.req01'],
  payloadSchema: {
    ramps: slot(
      lista(
        objeto({
          family: slot(refTo('dim1.req01')),
          name: slot(TEXTO),
          scale: slot(
            lista(
              objeto({
                step: slot(numero(1)),
                value: slot(COLOR_CSS),
              }),
            ),
          ),
        }),
      ),
    ),
  },
  validityPredicate: [
    exists(p('ramps')),
    // "Every familia institucional de dim1.req01 con rampa declarada"
    // (EXTENSIÓN R1: cuantificación cruzada + some sobre el propio payload).
    eachIn(
      'dim1.req01',
      ['institucionales'],
      'familia',
      some(p('ramps'), 'rampa', eq(op('rampa', 'family', 'name'), op('familia', 'name'))),
    ),
    each(p('ramps'), each(p('scale'), validCss(p('value')))),
  ],
  rectorBindings: [],
  mapsToKinds: [
    {
      kind: 'color',
      valueNotes: 'un rol por paso de rampa (roles de rampa propios del set)',
    },
  ],
};

const req05: RequirementV0 = {
  id: 'dim1.req05',
  dimensionId: 'dim1',
  packageId: 'pkg.color.superficies',
  eje: 'validez',
  pregunta:
    '¿El sistema declara sus niveles de superficie y la relación figura-fondo con tratamientos efectivos?',
  estado: 'active',
  dependsOn: ['dim1.req02'],
  payloadSchema: {
    surfaces: slot(
      lista(
        objeto({
          level: slot(TEXTO),
          backgroundColor: slot(refTo('dim1.req02')),
          foregroundColor: opt(refTo('dim1.req02')),
          shadow: opt(enumOf('none', 'sm', 'md', 'lg')),
          borderColor: opt(refTo('dim1.req02')),
          borderWidth: opt(LONGITUD_CSS),
        }),
      ),
    ),
  },
  validityPredicate: [
    gte(count(p('surfaces')), num(2)),
    each(p('surfaces'), reference(p('backgroundColor'), 'dim1.req02')),
    each(
      p('surfaces'),
      or(not(exists(p('foregroundColor'))), reference(p('foregroundColor'), 'dim1.req02')),
    ),
    each(
      p('surfaces'),
      or(not(exists(p('borderColor'))), reference(p('borderColor'), 'dim1.req02')),
    ),
    // "Al menos un tratamiento efectivo" = sombra declarada o borde con ancho
    // (decisión declarada: shadow | borderWidth — sin ancho no hay borde efectivo).
    each(p('surfaces'), or(exists(p('shadow')), exists(p('borderWidth')))),
    noConflict('mood-wall'),
  ],
  rectorBindings: ['mood-wall'],
  mapsToKinds: [
    {
      kind: 'surface',
      valueNotes: 'backgroundColor/foregroundColor/shadow/borderColor/borderWidth (compiler:213-220, 815-867)',
    },
  ],
};

const req06: RequirementV0 = {
  id: 'dim1.req06',
  dimensionId: 'dim1',
  packageId: 'pkg.color.estados',
  eje: 'completitud',
  pregunta:
    '¿Los roles interactivos (acción, foco, activo, inactivo) tienen color efectivo por cada estado aplicable (default, hover, focus, active)?',
  estado: 'active',
  dependsOn: ['dim1.req02', 'dim1.req03'],
  payloadSchema: {
    stateColors: slot(
      lista(
        objeto({
          role: slot(enumOf(...INTERACTIVE_ROLES)),
          state: slot(enumOf(...INTERACTIVE_STATES)),
          color: slot(union([refTo('dim1.req02'), COLOR_CSS])),
        }),
      ),
    ),
  },
  validityPredicate: [
    covers(p('stateColors'), ['role', 'state'], STATE_PAIRS),
    each(p('stateColors'), or(reference(p('color'), 'dim1.req02'), validCss(p('color')))),
  ],
  rectorBindings: [],
  mapsToKinds: [
    {
      kind: 'color',
      scopeSuggestion: { state: ['hover', 'focus', 'active'] },
      valueNotes:
        'el estado vive en scope.state del envelope, no en el value (compiler:105-109, 572-595)',
    },
  ],
};

const req07: RequirementV0 = {
  id: 'dim1.req07',
  dimensionId: 'dim1',
  packageId: 'pkg.color.relaciones',
  eje: 'validez',
  pregunta:
    '¿Están verificadas las parejas de contraste texto/superficie contra un umbral declarado, con evidencia registrada?',
  estado: 'active',
  dependsOn: ['dim1.req02', 'dim1.req05', 'dim1.req06'],
  payloadSchema: {
    contrast: slot(
      objeto({
        umbral: slot(numero()),
        matriz: slot(
          lista(
            objeto({
              fg: slot(REF),
              bg: slot(REF),
              ratio: slot(numero()),
              standard: slot(TEXTO),
            }),
          ),
        ),
      }),
    ),
  },
  validityPredicate: [
    exists(p('contrast', 'umbral')),
    // Parejas texto/superficie de dim1.req05 verificadas contra el umbral.
    everyPar(p('contrast', 'matriz'), ['fg', 'bg'], gte(op('ratio'), op('contrast', 'umbral'))),
    verified('contrast-matrix'),
  ],
  rectorBindings: [],
  mapsToKinds: [],
  mappingNotes:
    'BRECHA DECLARADA: no hay kind de verificación en el designRuleSet; la verificación vive en el DesignSet (C2) y no emite regla del compilador.',
};

const req08: RequirementV0 = {
  id: 'dim1.req08',
  dimensionId: 'dim1',
  packageId: 'pkg.color.relaciones',
  eje: 'coherencia',
  pregunta:
    '¿Están declaradas las relaciones cromáticas permitidas y prohibidas (alpha, tinta, mezcla, overlay, gradiente) y las exclusiones?',
  estado: 'active',
  dependsOn: ['dim1.req02', 'dim1.req04'],
  payloadSchema: {
    relations: slot(
      objeto({
        allowed: slot(lista(TEXTO)),
        prohibited: slot(lista(TEXTO)),
        overlays: slot(
          lista(
            objeto({
              color: slot(refTo('dim1.req02')),
              opacity: slot(numero(0, 1)),
            }),
          ),
        ),
        gradients: slot(lista(TEXTO)),
      }),
    ),
  },
  validityPredicate: [
    exists(p('relations', 'allowed')),
    exists(p('relations', 'prohibited')),
    // "Ninguna definición efectiva de la dimensión viola prohibited"
    // (EXTENSIÓN R1: everyDef + containsNoneOf, match substring conservador).
    everyDef(
      'dim1',
      'defReq',
      'defPayload',
      containsNoneOf(p('defPayload'), p('relations', 'prohibited')),
    ),
    noConflict('mood-wall'),
  ],
  rectorBindings: ['mood-wall'],
  mapsToKinds: [
    {
      kind: 'surface',
      valueNotes: 'overlayColor/overlayOpacity (compiler:213-219, 848-853)',
    },
  ],
  mappingNotes:
    'BRECHA DECLARADA: el designRuleSet no tiene kind de gradiente; los colores admitidos son planos (hex/rgb/hsl/oklch, compiler:187).',
};

const req09: RequirementV0 = {
  id: 'dim1.req09',
  dimensionId: 'dim1',
  packageId: 'pkg.color.composicion',
  eje: 'validez',
  pregunta:
    '¿Los contextos canónicos declarados poseen composición cromática con preponderancia explícita por contexto?',
  estado: 'active',
  dependsOn: ['dim1.req02', 'dim1.req05', 'dim1.req08'],
  payloadSchema: {
    contexts: slot(
      lista(
        objeto({
          contextId: slot(TEXTO),
          preponderance: slot(
            lista(
              objeto({
                role: slot(refTo('dim1.req02')),
                weight: slot(numero(0, 1)),
              }),
            ),
          ),
        }),
      ),
    ),
  },
  validityPredicate: [
    exists(p('contexts')),
    each(p('contexts'), eq(sum(p('preponderance'), 'weight'), num(1))),
    each(p('contexts'), each(p('preponderance'), reference(p('role'), 'dim1.req02'))),
  ],
  rectorBindings: [],
  mapsToKinds: [],
  mappingNotes:
    'BRECHA DECLARADA: no hay kind de preponderancia cromática por contexto; la taxonomía exige preponderancia por contexto, nunca porcentaje global (181).',
};

const req10: RequirementV0 = {
  id: 'dim1.req10',
  dimensionId: 'dim1',
  packageId: 'pkg.color.estados',
  eje: 'coherencia',
  pregunta:
    '¿Cada significado que el sistema codifica con color declara su portador no cromático (el color no es el único portador)?',
  estado: 'active',
  dependsOn: ['dim1.req02'],
  payloadSchema: {
    redundancy: slot(
      lista(
        objeto({
          meaning: slot(enumOf(...MEANINGS_5)),
          nonColorCarrier: slot(TEXTO),
        }),
      ),
    ),
  },
  validityPredicate: [
    covers(
      p('redundancy'),
      ['meaning'],
      MEANINGS_5.map((meaning) => str(meaning)),
    ),
    each(p('redundancy'), exists(p('nonColorCarrier'))),
  ],
  rectorBindings: [],
  mapsToKinds: [],
  mappingNotes:
    'BRECHA DECLARADA: la redundancia se expresa vía dim7/dim9; la taxonomía exige redundancia no cromática como contrato transversal (443-448); el designRuleSet no tiene kind para declararla.',
};

const req11: RequirementV0 = {
  id: 'dim1.req11',
  dimensionId: 'dim1',
  packageId: 'pkg.color.fundamento',
  eje: 'ciclo-de-vida',
  pregunta:
    '¿Toda definición cromática efectiva declara procedencia (al menos una fuente), autoría y revisión vigente?',
  estado: 'active',
  dependsOn: ['dim1.req01', 'dim1.req02'],
  payloadSchema: {
    provenance: slot(
      lista(
        objeto({
          definition: slot(REF),
          sources: slot(
            lista(
              objeto({
                kind: slot(enumOf('reference', 'user', 'ai')),
                label: slot(TEXTO),
                reference: slot(TEXTO),
                rationale: slot(TEXTO),
              }),
            ),
          ),
          author: slot(TEXTO),
          revision: slot(TEXTO),
        }),
      ),
    ),
  },
  validityPredicate: [
    // "Every definición efectiva de la dimensión con procedencia"
    // (EXTENSIÓN R1: everyDef + some sobre el propio payload).
    everyDef(
      'dim1',
      'defReq',
      'defPayload',
      some(
        p('provenance'),
        'entry',
        eq(op('entry', 'definition', 'refReqId'), op('defReq')),
      ),
    ),
    each(p('provenance'), exists(p('sources'))),
    each(p('provenance'), exists(p('author'))),
    each(p('provenance'), exists(p('revision'))),
  ],
  rectorBindings: ['descriptor'],
  mapsToKinds: [],
  mappingNotes:
    'No es un kind: se materializa en el campo provenance de CADA regla; el envelope obliga provenance con sources 1-16 y confidence 0..1 (compiler:102-104, 601-641).',
};

const req12: RequirementV0 = {
  id: 'dim1.req12',
  dimensionId: 'dim1',
  packageId: 'pkg.color.fundamento',
  eje: 'fuerza',
  pregunta: '¿Cada definición cromática declara su fuerza (inamovible, prioritaria o explorable)?',
  estado: 'active',
  dependsOn: ['dim1.req02', 'dim1.req04', 'dim1.req05'],
  payloadSchema: {
    forces: slot(
      lista(
        objeto({
          definition: slot(REF),
          force: slot(enumOf('inamovible', 'prioritaria', 'explorable')),
        }),
      ),
    ),
  },
  validityPredicate: [
    everyDef(
      'dim1',
      'defReq',
      'defPayload',
      some(p('forces'), 'entry', eq(op('entry', 'definition', 'refReqId'), op('defReq'))),
    ),
    some(p('forces'), 'entry', eq(op('entry', 'force'), str('inamovible'))),
  ],
  rectorBindings: [],
  mapsToKinds: [],
  mappingNotes:
    'BRECHA DECLARADA: el designRuleSet no tiene campo de fuerza; status proposed|reviewed del envelope cubre solo una parte del ciclo de vida, no la fuerza (compiler:68, 101-104); la fuerza vive en el hogar escritorio del set.',
};

/**
 * I5 (spec §5): "¿El rol primario declara su consumidor efectivo?"
 * ID fijado como dim1.req13 al enumerar el manifiesto v0 (el ordinal final
 * lo fija la enumeración; spec §5 usaba dim1.req13 tentativo). Slot formal
 * sin nombres con espacios (condición R1).
 */
const req13: RequirementV0 = {
  id: 'dim1.req13',
  dimensionId: 'dim1',
  packageId: 'pkg.color.roles',
  eje: 'coherencia',
  pregunta: '¿El rol primario declara su consumidor efectivo?',
  estado: 'active',
  dependsOn: ['dim1.req02'],
  payloadSchema: {
    primaryConsumers: slot(
      lista(
        objeto({
          role: slot(enumOf('primary')),
          consumer: slot(TEXTO),
        }),
      ),
    ),
  },
  validityPredicate: [
    exists(p('primaryConsumers')),
    each(p('primaryConsumers'), eq(op('role'), str('primary'))),
    each(p('primaryConsumers'), exists(p('consumer'))),
  ],
  rectorBindings: [],
  mapsToKinds: [
    {
      kind: 'color',
      valueNotes:
        'solo emite variable --cod-color-primary sin consumidor nativo (class-cod-theme-definitions.php:71,265; D3 §3a línea 52); el consumidor lo declara otro kind. Tensión de nomenclatura: el plano llama al rol primary, la taxonomía "acción" (spec §5 I5).',
    },
  ],
};

export const DIM1_REQUIREMENTS_V0: readonly RequirementV0[] = [
  req01,
  req02,
  req03,
  req04,
  req05,
  req06,
  req07,
  req08,
  req09,
  req10,
  req11,
  req12,
  req13,
];

// 1.1 / revisión 2 (2026-09-18): edición publicada del valueNotes de req03 —
// el puente I1 vive en dim7.req08, no en un dim7.req10 que nunca existió.
// Ningún requisito cambia de forma; sólo la nota. Ver decisión 12 del vault.
export const DIM1_MANIFEST_V0: RequirementManifestV0 = {
  schemaVersion: 1,
  manifestVersion: '1.1',
  revision: 2,
  requirements: [...DIM1_REQUIREMENTS_V0],
};
