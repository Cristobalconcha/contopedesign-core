/**
 * Manifiesto v0 de la Dimensión 3 — Espacio, ritmo, retícula y contenedores
 * (spec-c1-dim3-espacio-manifest-2026-08-31.md §3, 2 pasadas adversariales
 * aplicadas antes de esta implementación).
 *
 * Los siete requisitos de §3 fielmente (IDs, ejes, dependsOn, payloadSchemas,
 * mapsToKinds — incluidas las brechas DECLARADAS en mappingNotes).
 *
 * ADENDA 2026-09-18 (spec-c1-adenda-nucleo-editorial-2026-09-18.md §3): se AGREGAN
 * dim3.req08 (formatos de hoja que el SISTEMA soporta) y dim3.req09 (sangrado y
 * zona segura por formato soportado). Nada de lo anterior cambia: ningún id,
 * payloadSchema ni cláusula de los siete predicados vigentes se toca.
 *
 * Alcance (corrección de Cristóbal, 2026-09-18): ContOpe Design genera SISTEMAS de
 * diseño, no piezas. Un sistema no tiene «la hoja de la pieza»: declara qué formatos
 * soporta y cómo se comporta en cada uno. Las piezas concretas las arma el destino
 * (InDesign, WordPress) con lo que el sistema declaró. Por eso los dos requisitos de
 * la adenda están escritos a nivel de sistema.
 *
 * Diferencia deliberada frente a dim1/dim2 (spec §2): ningún requisito
 * declara `rectorBindings`/`noConflict('mood-wall')` — la taxonomía nombra
 * expresamente color/tipografía/imagen/composición como los dominios que
 * mood-wall gobierna, espacio no aparece ahí. La adenda mantiene la decisión
 * (adenda §2: ningún requisito de la adenda declara rectorBindings).
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

// Constructores con la forma EXACTA de dim1 que dim3 todavía no tenía: `not`,
// `compareCss` sobre longitud-css, y los agregadores con alias `some`/`eachIn`
// (dim1.req04 es el patrón real de la cobertura entre requisitos).
const not = (clause: PredicateClause): PredicateClause => ({ kind: 'not', clause });
const gteCss = (left: Operand, right: Operand): PredicateClause => ({
  kind: 'compareCss',
  cssType: 'longitud-css',
  op: '>=',
  left,
  right,
});
const lteCss = (left: Operand, right: Operand): PredicateClause => ({
  kind: 'compareCss',
  cssType: 'longitud-css',
  op: '<=',
  left,
  right,
});
const some = (
  target: readonly PathSegment[],
  alias: string,
  condition: PredicateClause,
): PredicateClause => ({ kind: 'some', target, alias, condition });
const eachIn = (
  reqId: string,
  path: readonly PathSegment[],
  alias: string,
  condition: PredicateClause,
): PredicateClause => ({ kind: 'eachIn', reqId, path, alias, condition });

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

/**
 * Las seis hojas cerradas + la medida declarada (adenda §3 dim3.req08, cita insumo 1:
 * «Letter 816×1056 · A4 794×1123 · Legal 816×1344 · Tabloid 1056×1632 · A5 559×794 ·
 * A3 1123×1587 (px a 96/in); apaisado = intercambiar; afiche a la medida dada = pulgadas
 * × 96, lado ≤ 8000. Sin medida: Letter/A4, nunca una hoja inventada.»).
 */
const HOJAS_CERRADAS_3 = ['letter', 'a4', 'legal', 'tabloid', 'a5', 'a3', 'medida-declarada'] as const;

/** El tope de lado declarado por la cita del insumo 1 (adenda §3 dim3.req08). */
const LADO_MAXIMO_HOJA = '8000px';

// ---------------------------------------------------------------------------
// Los nueve requisitos (req01..req07 originales, intactos + req08/req09 de la
// adenda del núcleo editorial 2026-09-18, reescritos a nivel de SISTEMA)
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

/**
 * dim3.req08 — Formatos de hoja que el SISTEMA soporta (adenda del núcleo editorial
 * 2026-09-18 §3, hueco H1). Eje validez, sin dependencias, packageId pkg.espacio.hoja,
 * rectorBindings [] (adenda §2).
 *
 * A nivel de sistema: un sistema de diseño NO tiene una hoja; declara qué formatos
 * soporta y cómo se comporta en cada uno (orientación y modo de paginación). Cada
 * entrada se nombra como la llama el sistema («carta vertical», «A5 apaisado»).
 * «Nunca una hoja inventada» (insumo 1) = si `formato` es `medida-declarada`, la
 * medida tiene que existir; si no, es una de las seis de la lista cerrada.
 */
const req08: RequirementV0 = {
  id: 'dim3.req08',
  dimensionId: 'dim3',
  packageId: 'pkg.espacio.hoja',
  eje: 'validez',
  pregunta:
    '¿Declara el sistema los formatos de hoja que soporta —cada uno de una lista cerrada o con medida declarada, con su orientación y su modo de paginación— sin inventar una hoja que nadie pidió?',
  estado: 'active',
  dependsOn: [],
  payloadSchema: {
    formatos: slot(
      lista(
        objeto({
          // cómo lo llama el sistema («carta vertical», «A5 apaisado»)
          nombre: slot(TEXTO),
          // cita insumo 1: las seis hojas cerradas + medida-declarada
          formato: slot(enumOf(...HOJAS_CERRADAS_3)),
          // obligatoria si formato = medida-declarada (la implicación se escribe en el predicado)
          medida: opt(
            objeto({
              ancho: slot(LONGITUD_CSS),
              alto: slot(LONGITUD_CSS),
            }),
          ),
          // cita insumo 1: «apaisado = intercambiar»
          orientacion: slot(enumOf('vertical', 'apaisada')),
          // cita insumo 2: Fixed (página fija) / Flow (contenido corrido)
          modo: slot(enumOf('pagina-fija', 'contenido-corrido')),
        }),
      ),
    ),
  },
  validityPredicate: [
    exists(p('formatos')),
    // cada formato soportado se nombra, se ubica en la lista cerrada y declara orientación y modo
    each(
      p('formatos'),
      and(
        exists(p('nombre')),
        exists(p('formato')),
        exists(p('orientacion')),
        exists(p('modo')),
      ),
    ),
    // «nunca una hoja inventada»: medida-declarada exige los dos lados
    each(
      p('formatos'),
      or(
        not(eq(op('formato'), str('medida-declarada'))),
        and(exists(p('medida', 'ancho')), exists(p('medida', 'alto'))),
      ),
    ),
    // cita insumo 1: lado ≤ 8000 (se compara sólo si la medida existe)
    each(
      p('formatos'),
      or(not(exists(p('medida', 'ancho'))), lteCss(op('medida', 'ancho'), str(LADO_MAXIMO_HOJA))),
    ),
    each(
      p('formatos'),
      or(not(exists(p('medida', 'alto'))), lteCss(op('medida', 'alto'), str(LADO_MAXIMO_HOJA))),
    ),
  ],
  rectorBindings: [],
  mapsToKinds: [],
  mappingNotes:
    'BRECHA DECLARADA: no hay kind de formato de hoja, página ni soporte en los 14 kinds del `designRuleSet` (todos son de reglas CSS); el compilador web no imprime. `layout` gobierna retícula interna y `spacing` pasos de espacio, no los formatos que el sistema soporta — mismo tipo de brecha que `dim3.req05` declara para la relación con el soporte impreso.',
};

/**
 * dim3.req09 — Sangrado y zona segura por formato soportado (adenda del núcleo
 * editorial 2026-09-18 §3, hueco H2). Eje validez, dependsOn ['dim3.req08'],
 * packageId pkg.espacio.sangrado, rectorBindings [].
 *
 * A nivel de sistema: por cada formato que el sistema declara soportar (ref a la
 * ENTRADA del formato en dim3.req08, no a la pieza) se declara sangrado, zona segura,
 * margen del texto corrido y qué elementos pueden ir a sangre. Umbrales citados:
 * zonaSegura ≥ 40 px (insumo 3) y margenTextoCorrido ≥ 72 px (insumos 3 y 4).
 * `sangrado` queda como longitud-css SIN umbral: la Fuente A no cita ninguna cifra
 * (tensión 6). Cobertura: todo formato soportado tiene su sangrado (eachIn/some).
 */
const req09: RequirementV0 = {
  id: 'dim3.req09',
  dimensionId: 'dim3',
  packageId: 'pkg.espacio.sangrado',
  eje: 'validez',
  pregunta:
    '¿Declara el sistema, para cada formato que soporta, cuánto sangra el fondo, cuánto queda libre para el contenido en cada borde, el margen del texto corrido y qué elementos pueden ir a sangre —o la razón escrita de su excepción?',
  estado: 'active',
  dependsOn: ['dim3.req08'],
  payloadSchema: {
    porFormato: slot(
      lista(
        objeto({
          // ref a la ENTRADA del formato declarado en dim3.req08: refPath ['formatos', n]
          formato: slot(refTo('dim3.req08')),
          sangrado: slot(LONGITUD_CSS),
          zonaSegura: slot(LONGITUD_CSS),
          margenTextoCorrido: slot(LONGITUD_CSS),
          // "ninguno" escrito satisface exists; una lista vacía no (fail-closed, tensión 13)
          aSangre: slot(lista(TEXTO)),
          excepcion: opt(TEXTO),
        }),
      ),
    ),
  },
  validityPredicate: [
    exists(p('porFormato')),
    each(
      p('porFormato'),
      and(
        exists(p('formato')),
        validCss(p('sangrado')),
        validCss(p('zonaSegura')),
        validCss(p('margenTextoCorrido')),
        exists(p('aSangre')),
      ),
    ),
    // o se cumplen los dos umbrales citados, o hay razón escrita
    each(
      p('porFormato'),
      or(
        and(gteCss(op('zonaSegura'), str('40px')), gteCss(op('margenTextoCorrido'), str('72px'))),
        exists(p('excepcion')),
      ),
    ),
    // exclusión mutua: cumplir y exceptuar a la vez no es una declaración válida
    each(
      p('porFormato'),
      not(
        and(
          exists(p('excepcion')),
          and(gteCss(op('zonaSegura'), str('40px')), gteCss(op('margenTextoCorrido'), str('72px'))),
        ),
      ),
    ),
    // cobertura: todo formato soportado en dim3.req08 tiene su sangrado declarado.
    // El alias `pf` resuelve la ref de req09 y navega `formato.nombre` (patrón real de dim1.req04).
    eachIn(
      'dim3.req08',
      ['formatos'],
      'f',
      some(
        p('porFormato'),
        'pf',
        eq(op('pf', 'formato', 'nombre'), op('f', 'nombre')),
      ),
    ),
  ],
  rectorBindings: [],
  mapsToKinds: [],
  mappingNotes:
    'BRECHA DECLARADA, mismo tipo que `dim3.req08`: el `designRuleSet` no tiene kind de sangrado, zona segura ni margen de página, y el compilador web no imprime; `spacing` declara pasos con uso, no el recorte físico del soporte ni los formatos que el sistema soporta.',
};

export const DIM3_REQUIREMENTS_V0: readonly RequirementV0[] = [
  req01,
  req02,
  req03,
  req04,
  req05,
  req06,
  req07,
  req08,
  req09,
];

// 1.1 / revisión 2 — adenda del núcleo editorial (2026-09-18): se AGREGAN dim3.req08 (formatos
// de hoja que el sistema soporta) y dim3.req09 (sangrado y zona segura por formato soportado)
// al final, sin tocar los siete previos (spec-c1-adenda-nucleo-editorial-2026-09-18.md §3).
export const DIM3_MANIFEST_V0: RequirementManifestV0 = {
  schemaVersion: 1,
  manifestVersion: '1.1',
  revision: 2,
  requirements: [...DIM3_REQUIREMENTS_V0],
};
