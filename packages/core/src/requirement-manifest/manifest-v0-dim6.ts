/**
 * Manifiesto v0 de la Dimensión 6 — Composición y jerarquía visual
 * (spec-c1-dim6-composicion-manifest-2026-08-31.md §3, 3 pasadas
 * adversariales aplicadas antes de esta implementación — 1, 1 y 0
 * bloqueantes).
 *
 * Los siete requisitos originales de §3 fielmente (IDs, ejes, dependsOn,
 * payloadSchemas, mapsToKinds — incluidas las brechas DECLARADAS en
 * mappingNotes), estructurados sobre el "Resuelto cuando" de la taxonomía
 * §6 (spec §2).
 *
 * Adenda C1 «núcleo editorial impreso»
 * (spec-c1-adenda-nucleo-editorial-2026-09-18.md §3, 2026-09-18): AGREGA
 * `dim6.req08` (estructura física de la pieza) y `dim6.req09` (dominante de
 * lectura a distancia). Los siete anteriores quedan intactos: sus
 * predicados son el dato serializado del manifiesto y tocarlos rompería los
 * sets ya emitidos. Ver el comentario de versión sobre `DIM6_MANIFEST_V0`.
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
 * precedente real lo sostiene). La adenda respeta la misma lección: `req08`
 * y `req09` llevan `rectorBindings: []` (adenda §2).
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
// Constructores adicionales de la adenda C1 (umbrales impresos de `req09`;
// misma forma exacta que manifest-v0-dim1.ts)
// ---------------------------------------------------------------------------

/** Operando de comparación: subconjunto estructural del `Operand` de dim1.ts. */
type OperandoComparable =
  | { kind: 'path'; path: PathSegment[] }
  | { kind: 'number'; value: number }
  | { kind: 'string'; value: string };

/** Operando que referencia una ruta del payload. */
const op = (...parts: PathSegment[]): { kind: 'path'; path: PathSegment[] } => ({
  kind: 'path',
  path: parts,
});
const num = (value: number): { kind: 'number'; value: number } => ({ kind: 'number', value });

const lte = (left: OperandoComparable, right: OperandoComparable): PredicateClause => ({
  kind: 'compare',
  op: '<=',
  left,
  right,
});
const gteCss = (left: OperandoComparable, right: OperandoComparable): PredicateClause => ({
  kind: 'compareCss',
  cssType: 'longitud-css',
  op: '>=',
  left,
  right,
});

const and = (...clauses: PredicateClause[]): PredicateClause => ({ kind: 'and', clauses });
const or = (...clauses: PredicateClause[]): PredicateClause => ({ kind: 'or', clauses });
const not = (clause: PredicateClause): PredicateClause => ({ kind: 'not', clause });

const LONGITUD_CSS: PayloadType = { kind: 'longitud-css' };
const numero = (min?: number, max?: number): PayloadType => ({
  kind: 'numero',
  ...(min !== undefined ? { min } : {}),
  ...(max !== undefined ? { max } : {}),
});
const opt = (type: PayloadType): PayloadFieldSchema => ({ type, optional: true });

// ---------------------------------------------------------------------------
// Constantes cerradas de la dimensión (spec §3, tensión 3: cerrados por analogía)
// ---------------------------------------------------------------------------

const WEIGHT_ROLES_3 = ['dominante', 'secundario', 'silencio'] as const;
const GROUPING_PRINCIPLES_3 = ['proximidad', 'continuidad', 'separacion'] as const;
// Adenda §3 (`dim6.req09`): las cinco preguntas del flyer, agrupadas y no en prosa (insumo 8).
const FIVE_QUESTIONS_5 = ['que', 'cuando', 'donde', 'cuanto', 'como-actuar'] as const;

// ---------------------------------------------------------------------------
// Los nueve requisitos (los siete de la spec C1-dim6 + los dos de la adenda C1)
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

// Adenda C1, 2026-09-18 (spec-c1-adenda-nucleo-editorial-2026-09-18.md §3):
// estructura física de la pieza — hueco H3. Eje completitud, rectorBindings [] (§2).
const req08: RequirementV0 = {
  id: 'dim6.req08',
  dimensionId: 'dim6',
  packageId: 'pkg.composicion.estructura',
  eje: 'completitud',
  pregunta:
    '¿Declara el sistema la estructura física de la pieza —caras y paneles con su contenido y su orden, el plegado, el orden de despliegue y lo que se repite en cada hoja?',
  estado: 'active',
  dependsOn: ['dim6.req06'],
  payloadSchema: {
    paneles: slot(
      lista(
        objeto({
          nombre: slot(TEXTO),
          contenido: slot(TEXTO),
          orden: slot(numero()),
        }),
      ),
    ),
    plegado: slot(TEXTO), // "sin plegado" escrito es válido (adenda, tensión 13)
    ordenDespliegue: slot(lista(TEXTO)), // cita insumo 10 ("en orden de lectura")
    repetidosPorHoja: slot(lista(TEXTO)), // folio, cabecera, membrete (insumo 10); "ninguno" escrito satisface
  },
  validityPredicate: [
    exists(p('paneles')),
    each(p('paneles'), exists(p('nombre'))),
    each(p('paneles'), exists(p('contenido'))),
    each(p('paneles'), exists(p('orden'))),
    exists(p('plegado')),
    exists(p('ordenDespliegue')),
    exists(p('repetidosPorHoja')),
  ],
  rectorBindings: [],
  mapsToKinds: [],
  mappingNotes:
    'BRECHA DECLARADA, mismo tipo que dim6.req06: la estructura física de la pieza (caras, paneles, plegado, folios por hoja) no tiene kind en el designRuleSet y el compilador web no la emite; vive en el adaptador editorial y en el DesignSet (C2).',
};

// Adenda C1, 2026-09-18 (spec-c1-adenda-nucleo-editorial-2026-09-18.md §3):
// dominante de lectura a distancia — umbrales impresos del flyer (insumo 7).
// Eje validez, rectorBindings [] (§2); no toca el predicado de dim6.req01.
const req09: RequirementV0 = {
  id: 'dim6.req09',
  dimensionId: 'dim6',
  packageId: 'pkg.composicion.dominante',
  eje: 'validez',
  pregunta:
    '¿Declara el sistema, para las piezas que se leen desde lejos, su única línea dominante con su número de palabras y su tamaño, y las cinco preguntas agrupadas —o la razón escrita de que la pieza se lee de cerca?',
  estado: 'active',
  dependsOn: ['dim6.req01'],
  payloadSchema: {
    // Opcionales (integrador, 18-09): si la pieza se lee de cerca, se escribe
    // noAplica y no hay dominante que declarar; el predicado exige una de las dos.
    dominante: opt(TEXTO), // "una sola línea" = valor único, no lista
    palabrasDominante: opt(numero(undefined, 6)), // cita insumo 7: "≤ 6 palabras"
    tamanoDominante: opt(LONGITUD_CSS), // cita insumo 7: "80 px / 60 pt o más"
    cincoPreguntas: opt(
      lista(
        objeto({
          pregunta: slot(enumOf(...FIVE_QUESTIONS_5)), // cita insumo 8 (agrupadas, no en prosa)
          contenido: slot(TEXTO),
        }),
      ),
    ),
    noAplica: opt(TEXTO), // piezas de lectura cercana, con razón escrita
  },
  validityPredicate: [
    or(
      and(
        exists(p('dominante')),
        lte(op('palabrasDominante'), num(6)),
        gteCss(op('tamanoDominante'), str('80px')),
        covers(
          p('cincoPreguntas'),
          ['pregunta'],
          FIVE_QUESTIONS_5.map((pregunta) => str(pregunta)),
        ),
        each(p('cincoPreguntas'), exists(p('contenido'))),
      ),
      exists(p('noAplica')),
    ),
    not(and(exists(p('noAplica')), exists(p('dominante')))), // exclusión mutua canal/contenido
  ],
  rectorBindings: [],
  mapsToKinds: [],
  mappingNotes:
    'BRECHA DECLARADA, mismo tipo que dim6.req01: el designRuleSet no tiene kind de jerarquía ni de dominante tipográfica; la pieza es una definición del DesignSet (C2) y no emite regla individual del compilador.',
};

export const DIM6_REQUIREMENTS_V0: readonly RequirementV0[] = [
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

// v1.1 / revisión 2 (adenda del núcleo editorial, 2026-09-18): se AGREGAN dim6.req08 (estructura física: paneles, plegado, despliegue) y dim6.req09 (dominante de lectura a distancia: ≤ 6 palabras, ≥ 80 px, cinco preguntas);
// los siete requisitos previos quedan intactos — cambiar un predicado publicado rompería los sets ya emitidos. Fuente: spec-c1-adenda-nucleo-editorial-2026-09-18.md §3 (insumos 7, 8, 10 y 11).
export const DIM6_MANIFEST_V0: RequirementManifestV0 = {
  schemaVersion: 1,
  manifestVersion: '1.1',
  revision: 2,
  requirements: [...DIM6_REQUIREMENTS_V0],
};
