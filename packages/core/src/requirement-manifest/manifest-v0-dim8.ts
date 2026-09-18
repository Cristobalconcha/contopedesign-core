/**
 * Manifiesto v0 de la Dimensión 8 — Movimiento y temporalidad
 * (spec-c1-dim8-movimiento-manifest-2026-09-18.md §3, ficha C1-dim8;
 * pasadas adversariales 1 y 2 aplicadas — pasada 1: 0 bloqueantes + 9 menores;
 * pasada 2: 1 bloqueante + 6 menores —, spec aprobada para implementar).
 *
 * Los siete requisitos de §3 fielmente (IDs, ejes, dependsOn, packageId,
 * pregunta, payloadSchema, validityPredicate, mapsToKinds y mappingNotes
 * — incluidas las brechas DECLARADAS), estructurados 1:1 sobre el
 * "Resuelto cuando" de la taxonomía §8 (spec §2: siete cláusulas, siete
 * requisitos, sin fusiones; a diferencia de dim6 no hay bullet absorbido).
 *
 * SIN `rectorBindings` ni `noConflict(...)`: ningún requisito declara
 * rectoras. El mood wall no gobierna el dominio "movimiento" (insumo 10:
 * su lista no incluye movimiento), igual que "interacción" en dim7 y
 * "espacio" en dim3 — la ausencia es decisión de redacción, no olvido.
 *
 * Cierres de esta dimensión, todos con cita: los SEIS roles de movimiento
 * (MOTION_ROLES_6; taxonomía §8 paquetes basales + D15) por `covers` sobre
 * enum —mecanismo implementado en manifest-v0-dim1.ts:213 y
 * manifest-v0-dim2.ts:182— y, desde la pasada 2, también como enum cerrado en
 * `req06.secuencia.rol` y `req07.equivalentes.rol`; `load|scroll|hover` (kind
 * `motion`, inventario D3 §2, insumo 5); `duration 0-5000` (insumo 5, una
 * sola fuente de verdad: el schema `numero(0,5000)` — sin `compare` que
 * duplique el rango, hallazgo 8 de la pasada 1); `reducida|estatica` (display
 * de taller, insumo 4). Todo disparador sin cita queda como texto abierto
 * (`tipo`/`condicion`), nunca como enum inventado (tensión 4).
 *
 * La `ref` de tiempo de `req02`/`req04` apunta HACIA ADELANTE, a
 * `dim8.req03` (tensión 2, declarada): va anclada al destino
 * (`{ kind: 'ref', reqId: 'dim8.req03' }`, hallazgo 3 de la pasada 1), con
 * `refPath` esperado `['escala', índice, 'duracion']`, y desde la pasada 2 su
 * resolución se EXIGE con la cláusula `reference(tiempo, 'dim8.req03')`
 * (hallazgo 1, BLOQUEANTE: `exists` no resuelve la ref — sólo `reference`
 * navega la ruta, predicate.ts:899, y payload.ts:71-79 nunca valida el
 * `refPath`), de modo que una ref rota no pasa en silencio; resuelve porque
 * el store incluye todos los payloads de la dimensión sin importar el orden
 * (evaluate.ts:170-176).
 *
 * CERO PROSA: cada validityPredicate es AST puro serializable, igual que
 * manifest-v0-dim1.ts/dim2.ts/dim3.ts/dim5.ts/dim6.ts/dim7.ts.
 */
import type { CoverExpected, Operand, PathSegment, PredicateClause } from './predicate.js';
import type { PayloadFieldSchema, PayloadType, RequirementManifestV0, RequirementV0 } from './types.js';

// ---------------------------------------------------------------------------
// Constructores de AST (mismo patrón que las dimensiones anteriores)
// ---------------------------------------------------------------------------

/** Ruta desnuda (targets de cláusulas, colecciones de agregadores). */
const p = (...parts: PathSegment[]): readonly PathSegment[] => parts;

const str = (value: string): { kind: 'string'; value: string } => ({ kind: 'string', value });

/** Operando de comparación que referencia una ruta del payload. */
const op = (...parts: PathSegment[]): Operand => ({ kind: 'path', path: parts });
/** Operando agregado: cuenta las entradas de una colección (precedente dim1.req05:345). */
const count = (target: readonly PathSegment[]): Operand => ({ kind: 'count', target });
/** Literal numérico como operando (p. ej. el 2 de "al menos dos elementos", dim1.req05:345). */
const num = (value: number): Operand => ({ kind: 'number', value });

const eq = (left: Operand, right: Operand): PredicateClause => ({ kind: 'compare', op: '==', left, right });
const gte = (left: Operand, right: Operand): PredicateClause => ({ kind: 'compare', op: '>=', left, right });

const exists = (target: readonly PathSegment[]): PredicateClause => ({ kind: 'exists', target });
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
/** Cuantificación cruzada: la colección vive en OTRO requisito (patrón dim1.req04, manifest-v0-dim1.ts:304-309). */
const eachIn = (
  reqId: string,
  path: readonly PathSegment[],
  alias: string,
  condition: PredicateClause,
): PredicateClause => ({ kind: 'eachIn', reqId, path, alias, condition });
/** Cláusula que RESUELVE una `ref` del payload contra el payload del destino (sólo ella navega la ruta). */
const reference = (target: readonly PathSegment[], reqId: string): PredicateClause => ({
  kind: 'reference',
  target,
  reqId,
});
const covers = (
  target: readonly PathSegment[],
  key: readonly string[],
  expected: readonly CoverExpected[],
): PredicateClause => ({ kind: 'covers', target, key, expected });
const and = (...clauses: PredicateClause[]): PredicateClause => ({ kind: 'and', clauses });
const or = (...clauses: PredicateClause[]): PredicateClause => ({ kind: 'or', clauses });
const not = (clause: PredicateClause): PredicateClause => ({ kind: 'not', clause });
const validCss = (
  target: readonly PathSegment[],
  cssType: 'color-css' | 'longitud-css',
): PredicateClause => ({ kind: 'validCss', target, cssType });
const noConflict = (rectoraId: string): PredicateClause => ({ kind: 'noConflict', rectoraId });

// Constructores del payloadSchema
const TEXTO: PayloadType = { kind: 'texto' };
const LONGITUD_CSS: PayloadType = { kind: 'longitud-css' };
const enumOf = (...values: string[]): PayloadType => ({ kind: 'enum', values });
const numero = (min?: number, max?: number): PayloadType => ({
  kind: 'numero',
  ...(min !== undefined ? { min } : {}),
  ...(max !== undefined ? { max } : {}),
});
const lista = (of: PayloadType): PayloadType => ({ kind: 'lista', of });
const objeto = (fields: Record<string, PayloadFieldSchema>): PayloadType => ({ kind: 'objeto', fields });
/** `ref` anclada al destino: el patrón implementado de `refTo(...)` (dim1:110, dim5). */
const refTo = (reqId: string): PayloadType => ({ kind: 'ref', reqId });
const slot = (type: PayloadType, optional = false): PayloadFieldSchema =>
  optional ? { type, optional: true } : { type };
const opt = (type: PayloadType): PayloadFieldSchema => ({ type, optional: true });

// ---------------------------------------------------------------------------
// Constantes cerradas de la dimensión (spec §1: cada valor tiene su fila)
// ---------------------------------------------------------------------------

/** Los seis roles de movimiento, lista explícita de la taxonomía §8 (insumo 2), cerrados por D15 (insumo 15). */
const MOTION_ROLES_6 = ['entrada', 'salida', 'transicion', 'feedback', 'orientacion', 'enfasis'] as const;

/** Los tres `trigger` reales del kind `motion` (inventario D3 §2, insumo 5): lo único que se cierra. */
const MOTION_TRIGGERS_3 = ['load', 'scroll', 'hover'] as const;

/** `reducida|estatica`: display del taller (insumo 4). "Sin movimiento decorativo" es campo aparte (insumo 3). */
const REDUCTION_DECISIONS_2 = ['reducida', 'estatica'] as const;

/** Rango real de `duration` en el kind `motion` (insumo 5); fuente única: el schema. */
const DURACION_MS: readonly [number, number] = [0, 5000];

/** Mínimo de elementos exigido a una coreografía: la pregunta promete "al menos dos" (hallazgo 5, pasada 2). */
const MIN_ELEMENTOS_COREOGRAFIA = 2;

// ---------------------------------------------------------------------------
// Los siete requisitos
// ---------------------------------------------------------------------------

const req01: RequirementV0 = {
  id: 'dim8.req01',
  dimensionId: 'dim8',
  packageId: 'pkg.movimiento.caracter',
  eje: 'completitud',
  pregunta:
    '¿Declara el sistema el carácter de su movimiento —qué debe expresar el tiempo en este diseño— y los principios que lo gobiernan?',
  estado: 'active',
  dependsOn: [],
  payloadSchema: {
    caracter: slot(
      objeto({
        principios: slot(lista(TEXTO)),
        descripcion: slot(TEXTO),
        procedenciaDelCaracter: slot(TEXTO),
      }),
    ),
  },
  validityPredicate: [
    exists(p('caracter', 'principios')),
    exists(p('caracter', 'descripcion')),
    exists(p('caracter', 'procedenciaDelCaracter')),
  ],
  rectorBindings: [],
  mapsToKinds: [],
  mappingNotes:
    'BRECHA DECLARADA: el designRuleSet no tiene kind de carácter ni de principios — `motion.effect` (D3 §2) nombra un efecto concreto sobre un nodo, no la declaración de carácter del sistema. Mismo tipo de brecha que `dim6.req01`.',
};

const req02: RequirementV0 = {
  id: 'dim8.req02',
  dimensionId: 'dim8',
  packageId: 'pkg.movimiento.roles',
  eje: 'completitud',
  pregunta:
    '¿Declara el sistema el significado de cada uno de sus seis roles de movimiento (entrada, salida, transición, feedback, orientación, énfasis) y, además, su tiempo —por referencia a la escala o en ms— o la razón por la que ese rol no aplica?',
  estado: 'active',
  dependsOn: ['dim8.req01'],
  payloadSchema: {
    roles: slot(
      lista(
        objeto({
          nombre: slot(enumOf(...MOTION_ROLES_6)),
          significado: slot(TEXTO),
          // `ref` ANCLADA al destino (no genérica): la escala vive en dim8.req03.
          tiempo: opt(refTo('dim8.req03')),
          duracionMs: opt(numero(...DURACION_MS)),
          // Campo propio para declarar la ausencia del rol (tensión 8: más chequeable que el precedente literal de dim7).
          razonNoAplica: opt(TEXTO),
        }),
      ),
    ),
  },
  validityPredicate: [
    covers(
      p('roles'),
      ['nombre'],
      MOTION_ROLES_6.map((role) => str(role)),
    ),
    each(p('roles'), exists(p('significado'))),
    each(p('roles'), or(or(exists(p('tiempo')), exists(p('duracionMs'))), exists(p('razonNoAplica')))),
    each(p('roles'), not(and(exists(p('razonNoAplica')), or(exists(p('tiempo')), exists(p('duracionMs')))))),
    // Fail-closed de la ref (hallazgo 1, BLOQUEANTE de la pasada 2): si el rol
    // declara `tiempo`, la ref DEBE resolver contra la escala de dim8.req03 —
    // una `refPath` rota o vacía no pasa en silencio. Forma exacta del ref
    // opcional en dim1.req05 (manifest-v0-dim1.ts:347-349); el eje sigue
    // `completitud` (precedente dim1.req02, que lleva `reference` bajo completitud).
    each(p('roles'), or(not(exists(p('tiempo'))), reference(p('tiempo'), 'dim8.req03'))),
  ],
  rectorBindings: [],
  mapsToKinds: [],
  mappingNotes:
    'BRECHA DECLARADA: el kind `motion` no tiene campo de rol — sus campos son trigger/effect/duration/delay/stagger/easing/threshold. Los seis roles son los NOMBRES que organizan las reglas `motion` en C2 (qué regla existe para qué propósito), no un valor que el compilador guarde. La proyección real de esta dimensión empieza en `dim8.req03` (duration), `dim8.req04` (easing) y `dim8.req05` (trigger). Guía C2: los dos roles del núcleo web real mapean a entrada (enter, aparecer) y feedback (response, responder) — propuesta de la tensión 4.1, no equivalencia demostrada.',
};

const req03: RequirementV0 = {
  id: 'dim8.req03',
  dimensionId: 'dim8',
  packageId: 'pkg.movimiento.tiempo',
  eje: 'completitud',
  pregunta: '¿Declara el sistema una escala nombrada de duraciones, dentro del rango real de 0 a 5000 ms, de la que sus roles toman su tiempo?',
  estado: 'active',
  dependsOn: ['dim8.req02'],
  payloadSchema: {
    escala: slot(
      lista(
        objeto({
          nombre: slot(TEXTO),
          // Rango 0..5000: una sola fuente de verdad (insumo 5). payload.ts ya rechaza fuera-de-rango; no se duplica con `compare`.
          duracion: slot(numero(...DURACION_MS)),
        }),
      ),
    ),
    ritmo: slot(
      objeto({
        descripcion: slot(TEXTO),
        // Vía de ausencia declarada (hallazgo 3, pasada 2): un ritmo sin pausas
        // declara `sinPausas` en vez de quedar irresoluble (predicate.ts:728
        // hace fallar la lista vacía). Mismo patrón que `sinAmplitud` en req04.
        pausas: opt(lista(TEXTO)),
        sinPausas: opt(TEXTO),
      }),
    ),
  },
  validityPredicate: [
    exists(p('escala')),
    each(p('escala'), and(exists(p('nombre')), exists(p('duracion')))),
    exists(p('ritmo', 'descripcion')),
    or(exists(p('ritmo', 'pausas')), exists(p('ritmo', 'sinPausas'))),
  ],
  rectorBindings: [],
  mapsToKinds: [
    {
      kind: 'motion',
      valueNotes:
        'el campo `duration` (0-5000) de cada regla `motion` recibe la duración del paso de escala que el rol referencie; `escala.nombre` no tiene campo en el kind — es el nombre con que C2 elige, no un valor que se compile',
    },
  ],
};

const req04: RequirementV0 = {
  id: 'dim8.req04',
  dimensionId: 'dim8',
  packageId: 'pkg.movimiento.trayectoria',
  eje: 'validez',
  pregunta:
    '¿Declara el sistema, para cada movimiento que define, su curva junto con su duración, su trayectoria, su amplitud y cómo continúa el espacio que recorre?',
  estado: 'active',
  dependsOn: ['dim8.req03'],
  payloadSchema: {
    movimientos: slot(
      lista(
        objeto({
          caso: slot(TEXTO),
          curva: slot(TEXTO),
          trayectoria: slot(TEXTO),
          continuidadEspacial: slot(TEXTO),
          amplitud: opt(LONGITUD_CSS),
          // `ref` anclada al destino, igual que en dim8.req02 (refPath esperado ['escala', índice, 'duracion']).
          tiempo: opt(refTo('dim8.req03')),
          duracionMs: opt(numero(...DURACION_MS)),
        }),
      ),
    ),
    // Vía de ausencia declarada (tensión 6, RESUELTA por la pasada 1, hallazgo 5): los movimientos no espaciales declaran por qué no tienen amplitud.
    sinAmplitud: opt(TEXTO),
  },
  validityPredicate: [
    exists(p('movimientos')),
    each(
      p('movimientos'),
      and(
        exists(p('caso')),
        exists(p('curva')),
        exists(p('trayectoria')),
        exists(p('continuidadEspacial')),
      ),
    ),
    // Duración Y curva juntas (tensión 5): el par se exige dentro del mismo movimiento; qué emita C2 es asunto del compilador.
    each(p('movimientos'), or(exists(p('tiempo')), exists(p('duracionMs')))),
    // Fail-closed de la ref (hallazgo 1, BLOQUEANTE de la pasada 2): idéntico a req02 — la ref de tiempo DEBE resolver contra la escala de dim8.req03.
    each(p('movimientos'), or(not(exists(p('tiempo'))), reference(p('tiempo'), 'dim8.req03'))),
    or(some(p('movimientos'), 'm', exists(p('amplitud'))), exists(p('sinAmplitud'))),
    each(p('movimientos'), or(not(exists(p('amplitud'))), validCss(p('amplitud'), 'longitud-css'))),
  ],
  rectorBindings: [],
  mapsToKinds: [
    {
      kind: 'motion',
      valueNotes:
        'el campo `easing` recibe la curva declarada en `curva` — es la mitad del par duración+curva, y la otra mitad es `duration` (ver dim8.req03); la amplitud y la continuidad espacial NO tienen campo en el kind (el compilador mueve con `effect`/`easing`/`duration`, no con distancias declaradas). La amplitud se escribe en `longitud-css` y se valida como tal, sin fijar valores: las distancias son de dim3',
    },
  ],
};

const req05: RequirementV0 = {
  id: 'dim8.req05',
  dimensionId: 'dim8',
  packageId: 'pkg.movimiento.disparadores',
  eje: 'completitud',
  pregunta: '¿Declara el sistema qué dispara cada movimiento, señalando explícitamente cuáles de esos disparadores corresponden a un `trigger` real del compilador?',
  estado: 'active',
  dependsOn: ['dim8.req01'],
  payloadSchema: {
    disparadores: slot(
      lista(
        objeto({
          tipo: slot(TEXTO),
          condicion: slot(TEXTO),
          // Sólo `load|scroll|hover` se cierran (insumo 5). Foco, entrada de datos o tiempo quedan en `tipo`/`condicion` como texto abierto (tensión 4).
          triggerDelKind: opt(enumOf(...MOTION_TRIGGERS_3)),
        }),
      ),
    ),
  },
  validityPredicate: [
    exists(p('disparadores')),
    each(p('disparadores'), and(exists(p('tipo')), exists(p('condicion')))),
  ],
  rectorBindings: [],
  mapsToKinds: [
    {
      kind: 'motion',
      valueNotes:
        'el campo `trigger` del kind (load|scroll|hover) recibe el valor de `triggerDelKind` cuando el disparador declarado es uno de los tres citados; para cualquier otro disparador (foco, entrada de datos, tiempo) `triggerDelKind` queda ausente y el disparador vive sólo en `tipo`/`condicion` como texto abierto — el compilador hoy no lo sabe expresar',
    },
  ],
};

const req06: RequirementV0 = {
  id: 'dim8.req06',
  dimensionId: 'dim8',
  packageId: 'pkg.movimiento.coreografia',
  eje: 'completitud',
  pregunta:
    '¿Declara el sistema cómo se ordenan y se relacionan los movimientos de al menos dos elementos en una misma secuencia, y cómo se sincronizan?',
  estado: 'active',
  dependsOn: ['dim8.req02', 'dim8.req05'],
  payloadSchema: {
    coreografia: slot(
      objeto({
        secuencia: slot(
          lista(
            objeto({
              // Sin cotas: el rango 0-100 no tenía fila de cita en §1 (pasada 1, hallazgo 4).
              orden: slot(numero()),
              elemento: slot(TEXTO),
              // Los seis roles cerrados, D15 (hallazgo 4 de la pasada 2): no texto libre.
              rol: slot(enumOf(...MOTION_ROLES_6)),
              atrasoMs: opt(numero()),
            }),
          ),
        ),
        relaciones: slot(lista(TEXTO)),
        sincronia: slot(TEXTO),
      }),
    ),
  },
  validityPredicate: [
    exists(p('coreografia', 'secuencia')),
    // Hallazgo 5 de la pasada 2: la pregunta promete "al menos dos elementos" y
    // el `exists` sólo rechazaba la lista vacía. Forma real de la cláusula:
    // { kind: 'compare', op: '>=', left: { kind: 'count', target: [...] }, right: { kind: 'number', value: 2 } }
    // (precedente dim1.req05:345).
    gte(count(p('coreografia', 'secuencia')), num(MIN_ELEMENTOS_COREOGRAFIA)),
    each(
      p('coreografia', 'secuencia'),
      and(exists(p('elemento')), exists(p('rol')), exists(p('orden'))),
    ),
    exists(p('coreografia', 'relaciones')),
    exists(p('coreografia', 'sincronia')),
  ],
  rectorBindings: [],
  mapsToKinds: [
    {
      kind: 'motion',
      valueNotes:
        'por cada entrada de `secuencia` sale una regla `motion`: `delay` recibe `atrasoMs`, `stagger` recibe el desfase entre entradas consecutivas, y si la secuencia se dispara por scroll, `threshold` recibe el punto de entrada; la relación entre elementos y la sincronía declarada no tienen campo — una regla `motion` es de UN nodo, no del conjunto, y ahí el kind queda corto; ojo: el compilador exige delay=0 cuando trigger=load y stagger=0 cuando trigger=hover (D3 §2)',
    },
  ],
};

const req07: RequirementV0 = {
  id: 'dim8.req07',
  dimensionId: 'dim8',
  packageId: 'pkg.movimiento.reduccion',
  // El eje NO cambia por el cruce de definiciones que agregó la pasada 2: sigue
  // `ciclo-de-vida` por la pregunta —una variante del sistema entre contextos
  // (normal → reducida/estática), el caso de dim6.req07 (manifest-v0-dim6.ts:249-263)—,
  // no por la forma del predicado; dim7.req07 (completitud) pregunta otra cosa.
  eje: 'ciclo-de-vida',
  pregunta:
    '¿Declara el sistema su versión reducida o estática, el equivalente estático de cada rol, y —cuando declara que no hay movimiento decorativo— cómo se comunican entonces el cambio y la jerarquía?',
  estado: 'active',
  dependsOn: ['dim8.req02', 'dim8.req04'],
  payloadSchema: {
    reduccion: slot(
      objeto({
        decision: slot(enumOf(...REDUCTION_DECISIONS_2)),
        criterio: slot(TEXTO),
        equivalentes: slot(
          lista(
            objeto({
              // Los seis roles cerrados, D15 (hallazgo 4 de la pasada 2): no texto libre.
              rol: slot(enumOf(...MOTION_ROLES_6)),
              equivalenteEstatico: slot(TEXTO),
            }),
          ),
        ),
        // Campo propio (pasada 1, hallazgo 2): la cita del "Resuelto cuando" (insumo 3) vive acá, separada del enum del display de taller (insumo 4).
        sinMovimientoDecorativo: opt(
          objeto({
            comoSeComunicaCambio: slot(TEXTO),
            comoSeComunicaJerarquia: slot(TEXTO),
          }),
        ),
      }),
    ),
  },
  validityPredicate: [
    exists(p('reduccion', 'decision')),
    exists(p('reduccion', 'criterio')),
    exists(p('reduccion', 'equivalentes')),
    each(p('reduccion', 'equivalentes'), and(exists(p('rol')), exists(p('equivalenteEstatico')))),
    // Cruce de definiciones (hallazgo 4 de la pasada 2): cada rol declarado en
    // dim8.req02 tiene su equivalente estático acá, salvo que ese rol declare
    // `razonNoAplica`. Patrón implementado de dim1.req04 (manifest-v0-dim1.ts:304-309).
    eachIn(
      'dim8.req02',
      ['roles'],
      'r',
      or(
        exists(p('razonNoAplica')),
        some(p('reduccion', 'equivalentes'), 'e', eq(op('e', 'rol'), op('r', 'nombre'))),
      ),
    ),
    // La explicación se exige SÓLO cuando el caso "sin movimiento decorativo" se declara: declarar la ausencia es válido, omitirla en silencio no (mismo principio que dim1.req10/dim2.req06/dim6.req07).
    or(
      not(exists(p('reduccion', 'sinMovimientoDecorativo'))),
      and(
        exists(p('reduccion', 'sinMovimientoDecorativo', 'comoSeComunicaCambio')),
        exists(p('reduccion', 'sinMovimientoDecorativo', 'comoSeComunicaJerarquia')),
      ),
    ),
  ],
  rectorBindings: [],
  mapsToKinds: [],
  mappingNotes:
    'BRECHA DECLARADA: el kind `motion` no tiene campo de variante reducida/estática ni de equivalente estático — la reducción vive en el adaptador/perfil de destino, que declara la degradación, no en una regla del compilador. Mismo tipo de brecha que `dim7.req07`. Tensión 10: la reducción puede necesitar un portador no cromático del cambio y de la jerarquía (dim2/dim3/dim6), cruce no declarado en ningún insumo; la promesa de `dim1.req10` no incluye a dim8 y no se toca.',
};

export const DIM8_REQUIREMENTS_V0: readonly RequirementV0[] = [
  req01,
  req02,
  req03,
  req04,
  req05,
  req06,
  req07,
];

export const DIM8_MANIFEST_V0: RequirementManifestV0 = {
  schemaVersion: 1,
  manifestVersion: '1.0',
  revision: 1,
  requirements: [...DIM8_REQUIREMENTS_V0],
};
