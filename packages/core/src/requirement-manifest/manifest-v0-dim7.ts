/**
 * Manifiesto v0 de la Dimensión 7 — Interacción, estados, navegación y feedback
 * (spec-c1-dim7-interaccion-manifest-2026-08-31.md §3/§9, ficha C1-dim7; cuatro
 * pasadas adversariales aplicadas antes de esta implementación — pasada 1: 0
 * correcciones; pasada 2: 3 correcciones; pasada 3: 3 bloqueantes resueltos + 4
 * menores aplicados; pasada 4: 1 bloqueante resuelto + 5 menores aplicados.
 * Este archivo implementa el texto de §3 tal como quedó tras la pasada 4).
 *
 * Los ocho requisitos de §3 fielmente: IDs, ejes, dependsOn, packageIds,
 * preguntas, payloadSchemas, predicados y mapsToKinds/mappingNotes — incluidas
 * las brechas DECLARADAS (nunca silenciosas). Los siete primeros se estructuran
 * sobre el "Resuelto cuando" de la taxonomía §7 (spec §2); el octavo
 * (`dim7.req08`) no sale de ahí: es I1 de la spec maestra C1 §5, reformulado
 * intra-dimensión (spec §2/§3, pasada 3).
 *
 * Pasada 4 en este código: `dim7.req02` cierra `scopeStateReal` con un solo
 * `each` de diez brazos (rutas relativas a la entrada), reemplazando las tres
 * `some` de la pasada 3 (§9, hallazgo 2); `dim7.req08` acepta únicamente el rol
 * `accent` y lo exige por cláusula, no sólo por el enum del payload (§9,
 * hallazgo 1).
 *
 * `rectorBindings: []` en los ocho requisitos, VERIFICADO y no por descuido
 * (misma lección que la pasada 2 de dim6): "interacción" no está en la lista de
 * dominios que mood-wall gobierna (color, tipografía, imagen, composición), tal
 * como ocurre con dim3 (espacio). Por eso esta dimensión tampoco emite
 * `noConflict(...)` en ningún predicado.
 *
 * La relación dim1↔dim7 no se codifica como cláusula acá: un `reference` o un
 * `dependsOn` cruzado entre documentos no resuelve (graph.ts:749 exige
 * resolución dentro del mismo documento y el `store` del predicado es por
 * dimensión, predicate.ts:133-134 / evaluate.ts:171-175). Se verifica en la
 * proyección C2. Al implementar, el texto de `manifest-v0-dim1.ts:269` se
 * reescribirá exactamente así: «tone=primary consume var(--cod-color-accent)
 * (class-cod-canvas-mcp-recipe-compiler.php:3011). El puente completo (I1) se
 * exige en dim7.req08.» (spec §2), y `DIM1_MANIFEST_V0` pasa a
 * `manifestVersion: '1.1'` y `revision: 2` (spec §2, pasada 4); la edición de
 * dim1 no se hace desde acá.
 *
 * CERO PROSA: cada validityPredicate es AST puro serializable, igual que
 * manifest-v0-dim1.ts/dim2.ts/dim3.ts/dim5.ts/dim6.ts.
 */
import type { CoverExpected, PathSegment, PredicateClause } from './predicate.js';
import type { PayloadFieldSchema, PayloadType, RequirementManifestV0, RequirementV0 } from './types.js';

// ---------------------------------------------------------------------------
// Constructores de AST (mismo patrón que las dimensiones anteriores)
// ---------------------------------------------------------------------------

const p = (...parts: PathSegment[]): readonly PathSegment[] => parts;
const str = (value: string): { kind: 'string'; value: string } => ({ kind: 'string', value });
const litBool = (value: boolean): { kind: 'boolean'; value: boolean } => ({ kind: 'boolean', value });

/** Operando de `compare`: subconjunto de `Operand` (path + literales escalares). */
type Operando =
  | { kind: 'path'; path: readonly PathSegment[] }
  | { kind: 'string'; value: string }
  | { kind: 'boolean'; value: boolean }
  | { kind: 'number'; value: number };

const op = (...path: PathSegment[]): Operando => ({ kind: 'path', path });
const eq = (left: Operando, right: Operando): PredicateClause => ({
  kind: 'compare',
  op: '==',
  left,
  right,
});
const and = (...clauses: PredicateClause[]): PredicateClause => ({ kind: 'and', clauses });
const or = (...clauses: PredicateClause[]): PredicateClause => ({ kind: 'or', clauses });
const not = (clause: PredicateClause): PredicateClause => ({ kind: 'not', clause });

const exists = (target: readonly PathSegment[]): PredicateClause => ({ kind: 'exists', target });
const each = (target: readonly PathSegment[], condition: PredicateClause): PredicateClause => ({
  kind: 'each',
  target,
  condition,
});
// Declarado por paridad con el molde (dim1.req04/dim6). Tras la pasada 4 esta
// dimensión no lo usa: `dim7.req02` cerró su espacio negativo con un solo
// `each` de diez brazos, no con `some`s (spec §9, hallazgo 2).
const some = (
  target: readonly PathSegment[],
  alias: string,
  condition: PredicateClause,
): PredicateClause => ({ kind: 'some', target, alias, condition });
const covers = (
  target: readonly PathSegment[],
  key: readonly string[],
  expected: readonly CoverExpected[],
): PredicateClause => ({ kind: 'covers', target, key, expected });
// Declarado por paridad con el molde (dim6). Esta dimensión no vincula rectoras
// (spec §2) y por eso ningún predicado de acá lo usa.
const noConflict = (rectoraId: string): PredicateClause => ({ kind: 'noConflict', rectoraId });

// Constructores del payloadSchema
const TEXTO: PayloadType = { kind: 'texto' };
const BOOL: PayloadType = { kind: 'bool' };
const enumOf = (...values: string[]): PayloadType => ({ kind: 'enum', values });
const lista = (of: PayloadType): PayloadType => ({ kind: 'lista', of });
const objeto = (fields: Record<string, PayloadFieldSchema>): PayloadType => ({ kind: 'objeto', fields });
const slot = (type: PayloadType, optional = false): PayloadFieldSchema =>
  optional ? { type, optional: true } : { type };
const opt = (type: PayloadType): PayloadFieldSchema => ({ type, optional: true });

// ---------------------------------------------------------------------------
// Constantes cerradas de la dimensión (spec §3; citas explícitas de la
// taxonomía §7 y de types.ts, normalizadas a ASCII sin tildes — spec §1, cuya
// justificación quedó reescrita en la pasada 4: es decisión de esta dimensión,
// no una regla del formato, porque el formato SÍ admite tildes)
// ---------------------------------------------------------------------------

/** Los diez estados de la ontología (taxonomía §7, cita EXPLÍCITA). */
const ESTADOS_10 = [
  'normal',
  'hover',
  'foco',
  'activo',
  'seleccionado',
  'inactivo',
  'bloqueado',
  'carga',
  'exito',
  'error',
] as const;

/** Los cuatro estados reales del envelope (`scope.state`, D3 §1): subconjunto de ESTADOS_10. */
const SCOPE_STATES_REALES_4 = ['default', 'hover', 'focus', 'active'] as const;

/** Los cuatro tipos de feedback de la taxonomía (normalizados sin tildes, spec §1). */
const TIPOS_FEEDBACK_4 = ['confirmacion', 'advertencia', 'error', 'recuperacion'] as const;

/** MEANINGS_5: los cinco significados que ya usa `dim1.req10` — la promesa que cumple `dim7.req06`. */
const MEANINGS_5 = ['success', 'warning', 'error', 'active', 'inactive'] as const;

/** CORE_ROLES_13 (types.ts, lista cerrada): los trece roles Core de color. */
const ROLES_DE_COLOR_13 = [
  'background',
  'surface',
  'text',
  'border',
  'accent',
  'action',
  'info',
  'success',
  'warning',
  'error',
  'active',
  'inactive',
  'focus',
] as const;

/**
 * El único rol que el puente I1 acepta (spec §3, pasada 4/hallazgo 1): uno de
 * los trece. El enum del payload no ofrece los trece porque el puente fija UN
 * rol — ofrecer los demás sería ofrecer lo que no se pidió (con
 * `rolDeColor: 'background'` el requisito se cumpliría y el I1 obligatorio de
 * C1 §5 quedaría incumplido en sustancia).
 */
const ROL_ACCENT: (typeof ROLES_DE_COLOR_13)[number] = 'accent';

// ---------------------------------------------------------------------------
// Los ocho requisitos
// ---------------------------------------------------------------------------

const req01: RequirementV0 = {
  id: 'dim7.req01',
  dimensionId: 'dim7',
  packageId: 'pkg.interaccion.fundamento',
  eje: 'completitud',
  pregunta:
    '¿Declara el sistema cómo se reconoce que un elemento es accionable o recorrible, para al menos un tipo de elemento?',
  estado: 'active',
  dependsOn: [],
  payloadSchema: {
    affordances: slot(
      lista(
        objeto({
          elemento: slot(TEXTO),
          senal: slot(TEXTO),
        }),
      ),
    ),
  },
  validityPredicate: [exists(p('affordances')), each(p('affordances'), exists(p('senal')))],
  rectorBindings: [],
  mapsToKinds: [],
  mappingNotes:
    'BRECHA DECLARADA: el designRuleSet no tiene kind de affordance en abstracto — el `behavior` de `interaction` (D3 §2) cubre patrones concretos (scroll-threshold, nav-toggle...), no la señal de reconocimiento general que pide este requisito. Se proyecta indirectamente, si acaso, vía controles concretos de dim7.req05.',
};

const req02: RequirementV0 = {
  id: 'dim7.req02',
  dimensionId: 'dim7',
  packageId: 'pkg.interaccion.estados',
  eje: 'completitud',
  pregunta:
    '¿Declara el sistema el significado de sus diez estados (normal, hover, foco, activo, seleccionado, inactivo, bloqueado, carga, éxito, error), señalando explícitamente cuáles de ellos mapean a un `scope.state` real?',
  estado: 'active',
  dependsOn: ['dim7.req01'],
  payloadSchema: {
    estados: slot(
      lista(
        objeto({
          nombre: slot(enumOf(...ESTADOS_10)),
          significado: slot(TEXTO),
          scopeStateReal: opt(enumOf(...SCOPE_STATES_REALES_4)),
        }),
      ),
    ),
  },
  validityPredicate: [
    covers(
      p('estados'),
      ['nombre'],
      ESTADOS_10.map((estado) => str(estado)),
    ),
    each(p('estados'), exists(p('significado'))),
    // Cierre TOTAL de `scopeStateReal` (spec §3, pasada 4/hallazgo 2): un solo
    // `each` de diez brazos reemplaza las tres `some` de la pasada 3. Las rutas
    // dentro del `each` son RELATIVAS a la entrada — como
    // `each(p('pesos'), exists(p('tecnica')))` en el molde —, por eso se escribe
    // `op('nombre')` y `p('scopeStateReal')`, nunca `op('e','nombre')`. Como
    // `covers` ya garantiza las diez entradas, esto implica las tres `some`
    // anteriores y además prohíbe que los seis estados sin hogar (ni un `hover`
    // con otro valor) declaren `scopeStateReal`, y que dos entradas `normal`
    // con mapeos contradictorios pasen.
    each(
      p('estados'),
      or(
        and(eq(op('nombre'), str('normal')), eq(op('scopeStateReal'), str('default'))),
        and(
          eq(op('nombre'), str('hover')),
          or(eq(op('scopeStateReal'), str('hover')), not(exists(p('scopeStateReal')))),
        ),
        and(eq(op('nombre'), str('foco')), eq(op('scopeStateReal'), str('focus'))),
        and(eq(op('nombre'), str('activo')), eq(op('scopeStateReal'), str('active'))),
        and(eq(op('nombre'), str('seleccionado')), not(exists(p('scopeStateReal')))),
        and(eq(op('nombre'), str('inactivo')), not(exists(p('scopeStateReal')))),
        and(eq(op('nombre'), str('bloqueado')), not(exists(p('scopeStateReal')))),
        and(eq(op('nombre'), str('carga')), not(exists(p('scopeStateReal')))),
        and(eq(op('nombre'), str('exito')), not(exists(p('scopeStateReal')))),
        and(eq(op('nombre'), str('error')), not(exists(p('scopeStateReal')))),
      ),
    ),
  ],
  rectorBindings: [],
  mapsToKinds: [],
  mappingNotes:
    'BRECHA DECLARADA A PROPÓSITO: esta es la ontología FUENTE — de los diez estados, solo cuatro (scopeStateReal presente) tienen hogar real en `scope.state` del envelope (D3 §1). Los otros seis (seleccionado, inactivo, bloqueado, carga, éxito, error) no tienen forma de expresarse como `scope.state` de una regla hoy — viven en el DesignSet como intención, brecha real de producción, no solo de este manifiesto; por eso el predicado les prohíbe declarar `scopeStateReal` (pasada 4, hallazgo 2).',
};

const req03: RequirementV0 = {
  id: 'dim7.req03',
  dimensionId: 'dim7',
  packageId: 'pkg.interaccion.navegacion',
  eje: 'completitud',
  pregunta:
    '¿Declara el sistema sus mecanismos de ubicación, progresión, retorno y referencias cruzadas para al menos un contexto?',
  estado: 'active',
  dependsOn: ['dim7.req01'],
  payloadSchema: {
    navegacion: slot(
      objeto({
        contexto: slot(TEXTO),
        ubicacion: slot(TEXTO),
        progresion: slot(TEXTO),
        retorno: slot(TEXTO),
        referencias: slot(TEXTO),
      }),
    ),
  },
  validityPredicate: [
    exists(p('navegacion', 'contexto')),
    exists(p('navegacion', 'ubicacion')),
    exists(p('navegacion', 'progresion')),
    exists(p('navegacion', 'retorno')),
    exists(p('navegacion', 'referencias')),
  ],
  rectorBindings: [],
  mapsToKinds: [],
  mappingNotes:
    'BRECHA DECLARADA: `interaction.behavior: nav-toggle` (D3 §2) es un patrón concreto de UI (abrir/cerrar un menú), no la declaración abstracta de ubicación/progresión/retorno que pide este requisito.',
};

const req04: RequirementV0 = {
  id: 'dim7.req04',
  dimensionId: 'dim7',
  packageId: 'pkg.interaccion.feedback',
  eje: 'completitud',
  pregunta:
    '¿Están mapeados con tratamiento efectivo los cuatro tipos de feedback que declara la taxonomía (confirmación, advertencia, error, recuperación)?',
  estado: 'active',
  dependsOn: ['dim7.req01'],
  payloadSchema: {
    feedback: slot(
      lista(
        objeto({
          tipo: slot(enumOf(...TIPOS_FEEDBACK_4)),
          tratamiento: slot(TEXTO),
        }),
      ),
    ),
  },
  validityPredicate: [
    covers(
      p('feedback'),
      ['tipo'],
      TIPOS_FEEDBACK_4.map((tipo) => str(tipo)),
    ),
    each(p('feedback'), exists(p('tratamiento'))),
  ],
  rectorBindings: [],
  mapsToKinds: [],
  mappingNotes:
    'BRECHA DECLARADA: el tratamiento de feedback probablemente SE APOYA en color/surface (dim1) para su expresión visual final, pero este requisito declara la relación tipo-de-feedback→tratamiento en abstracto, no un valor de compilador — mismo tipo de indirección que dim6.req01/dim1.req02.',
};

const req05: RequirementV0 = {
  id: 'dim7.req05',
  dimensionId: 'dim7',
  packageId: 'pkg.interaccion.controles',
  eje: 'completitud',
  pregunta:
    '¿Declara el sistema sus controles de ingreso, edición y selección con comportamiento efectivo para al menos un contexto?',
  estado: 'active',
  dependsOn: ['dim7.req01'],
  payloadSchema: {
    controles: slot(
      lista(
        objeto({
          contexto: slot(TEXTO),
          tipo: slot(TEXTO),
          comportamiento: slot(TEXTO),
        }),
      ),
    ),
  },
  validityPredicate: [
    exists(p('controles')),
    each(p('controles'), exists(p('contexto'))),
    each(p('controles'), exists(p('comportamiento'))),
  ],
  rectorBindings: [],
  mapsToKinds: [
    {
      kind: 'form',
      valueNotes:
        'maxWidth/surface (este último es un CAMPO propio de form — none|card|outlined —, no el kind `surface` de dim1) aplican al CONTENEDOR de controles (D3 §2, "form es solo contenedor") — brecha parcial: form no describe el comportamiento de ingreso/edición/selección en sí, solo el envoltorio',
    },
  ],
  mappingNotes:
    'BRECHA PARCIAL (declarada en el valueNotes del único kind mapeado): `form` cubre el contenedor de controles, no el comportamiento de ingreso/edición/selección; lista abierta (`tipo: texto`) porque la taxonomía no enumera un conjunto cerrado de tipos de control (tensión 4).',
};

const req06: RequirementV0 = {
  id: 'dim7.req06',
  dimensionId: 'dim7',
  packageId: 'pkg.interaccion.redundancia',
  eje: 'completitud',
  pregunta:
    '¿Declara el sistema el portador no cromático de cada significado que normalmente se comunica con color (los mismos cinco que ya usa `dim1.req10`: éxito, advertencia, error, activo, inactivo)?',
  estado: 'active',
  dependsOn: ['dim7.req02', 'dim7.req04'],
  payloadSchema: {
    redundancias: slot(
      lista(
        objeto({
          meaning: slot(enumOf(...MEANINGS_5)),
          portador: slot(TEXTO),
        }),
      ),
    ),
  },
  validityPredicate: [
    covers(
      p('redundancias'),
      ['meaning'],
      MEANINGS_5.map((meaning) => str(meaning)),
    ),
    each(p('redundancias'), exists(p('portador'))),
  ],
  rectorBindings: [],
  mapsToKinds: [],
  mappingNotes:
    'BRECHA DECLARADA: mismo tipo que `dim1.req10` — la redundancia se materializa en OTROS kinds (ícono, texto, forma), no tiene un kind propio del compilador. Eje `completitud` (no `coherencia`): el predicado es covers+each-exists, sin cruce real entre definiciones (corregido en la pasada adversarial 2 de la spec); fidelidad literal a MEANINGS_5 de dim1.req10, no a los diez estados de dim7.req02 (tensión 2).',
};

const req07: RequirementV0 = {
  id: 'dim7.req07',
  dimensionId: 'dim7',
  packageId: 'pkg.interaccion.equivalencias',
  eje: 'completitud',
  pregunta:
    '¿Declara el sistema el equivalente estático/editorial de al menos una interacción, para contextos que no emiten interacción (impreso, PDF, perfil estático)?',
  estado: 'active',
  dependsOn: ['dim7.req01'],
  payloadSchema: {
    equivalencias: slot(
      lista(
        objeto({
          interaccion: slot(TEXTO),
          equivalenteEstatico: slot(TEXTO),
        }),
      ),
    ),
  },
  validityPredicate: [
    exists(p('equivalencias')),
    each(p('equivalencias'), exists(p('equivalenteEstatico'))),
  ],
  rectorBindings: [],
  mapsToKinds: [],
  mappingNotes:
    'BRECHA DECLARADA: vive enteramente en el DesignSet (C2) como intención resuelta; un perfil estático que no emite interacción no tiene una regla del compilador que mostrar, por diseño de la taxonomía misma.',
};

const req08: RequirementV0 = {
  id: 'dim7.req08',
  dimensionId: 'dim7',
  packageId: 'pkg.interaccion.puente-accion',
  eje: 'completitud',
  pregunta:
    '¿Declara el sistema que su control de acción primaria consume el rol accent (la fuente de `--cod-color-accent`) sin un valor de color propio duplicado, y qué respaldo declara?',
  estado: 'active',
  dependsOn: ['dim7.req05'],
  payloadSchema: {
    accionPrimaria: slot(
      objeto({
        rolDeColor: slot(enumOf(ROL_ACCENT)),
        sinValorPropio: slot(BOOL),
        respaldos: slot(lista(TEXTO)),
      }),
    ),
  },
  validityPredicate: [
    exists(p('accionPrimaria', 'rolDeColor')),
    // Misma forma completa que el medio-puente de dim1 (manifest-v0-dim1.ts:248/:256):
    // el enum del payload no basta, el rol se exige por cláusula (pasada 4, hallazgo 1).
    eq(op('accionPrimaria', 'rolDeColor'), str(ROL_ACCENT)),
    eq(op('accionPrimaria', 'sinValorPropio'), litBool(true)),
    exists(p('accionPrimaria', 'respaldos')),
  ],
  rectorBindings: [],
  mapsToKinds: [
    {
      kind: 'button',
      valueNotes:
        'tone=primary consume var(--cod-color-accent) (class-cod-canvas-mcp-recipe-compiler.php:3011); el rol declarado acá es el que esa variable emite',
    },
    {
      kind: 'color',
      valueNotes: 'role=accent es el emisor de la variable (class-cod-theme-definitions.php)',
    },
  ],
  mappingNotes:
    'mappingNotes (nota de la reformulación): es I1 de la spec maestra C1 §5 ("El puente hallado por D3 es obligatorio (I1)"), reformulado intra-dimensión — la forma tentativa de C1 §5 (`dependsOn: [dim1.req03]` + `reference` a dim1) no es construible: `dependsOn` debe resolver en el mismo documento (graph.ts:749) y el `store` del predicado es por dimensión (predicate.ts:133-134, evaluate.ts:171-175). El rol se declara por `enum` (`accent`, de CORE_ROLES_13, types.ts) y no por `ref` cruzada: aceptar los trece ofrecería lo que no se pidió, porque `accent` y `action` son roles distintos (types.ts:280-294) y el I1 obligatorio fija uno solo (pasada 4, hallazgo 1). La relación dim1↔dim7 se verifica en la proyección C2, no como cláusula de este manifiesto. Eje anotado: sería `coherencia` si la gramática permitiera `reference` cruzada.',
};

export const DIM7_REQUIREMENTS_V0: readonly RequirementV0[] = [
  req01,
  req02,
  req03,
  req04,
  req05,
  req06,
  req07,
  req08,
];

export const DIM7_MANIFEST_V0: RequirementManifestV0 = {
  schemaVersion: 1,
  manifestVersion: '1.0',
  revision: 1,
  requirements: [...DIM7_REQUIREMENTS_V0],
};
