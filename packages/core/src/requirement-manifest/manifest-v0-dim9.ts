/**
 * Manifiesto v0 de la Dimensión 9 — Patrones reutilizables y representación
 * de información
 * (spec-c1-dim9-patrones-manifest-2026-09-18.md §3, ficha C1-dim9).
 *
 * PASADAS: PASADA ADVERSARIAL 1 (ZCode/GLM) APLICADA — 3+5 (3 bloqueantes y
 * 5 menores), con el cambio exacto que propone cada hallazgo:
 *
 *   - Hallazgo 1 (bloqueante, req02): `slots` pasa a `opt(lista(...))`. El
 *     validador de payload corre ANTES que el predicado (payload.ts:96-97,
 *     127-135) y rechazaba la entrada «no aplica» por campo obligatorio
 *     ausente, arrastrando por dependencia a req03/05/06/07.
 *   - Hallazgo 2 (bloqueante, req03): la lista gana `sinVariantes: opt(texto)`
 *     —canal de ausencia declarada, como `razonNoAplica` de las entradas de
 *     `dim8.req02` (manifest-v0-dim8.ts:190-191), consumido por el `eachIn` de
 *     `dim8.req07` (:450-458)— y el predicado pasa a
 *     `or(and(exists(variantes), each…), exists(sinVariantes))`: exigir ≥1
 *     variante obligaba a inventar una variante falsa para decir «no hay».
 *   - Hallazgo 3 (bloqueante, req04): la lista gana `sinCodificacionColor:
 *     opt(texto)` y la cláusula pasa de `some` con alias a `each` con rutas
 *     RELATIVAS a la entrada (molde `dim7.req02`, manifest-v0-dim7.ts:226-243):
 *     `or(each(codificaciones, or(compare('!=', op('portador'), str('color')),
 *     exists(colorRef))), exists(sinCodificacionColor))`.
 *   - Hallazgo 4 (menor, req02): xor entre `slots` y `noAplica`, porque
 *     `or(exists(slots), exists(noAplica))` dejaba pasar ambos a la vez.
 *   - Hallazgo 5 (menor, req04): CERRADO por la forma `each` del hallazgo 3 —
 *     `some` cortaba en la primera entrada que cumplía (predicate.ts:668-671)
 *     y dejaba pasar dos entradas `color` con una sola `colorRef`.
 *   - Hallazgo 6 (menor, opcional ADOPTADO): `colorRef` se tipa
 *     `refTo(dim1.req02)` para que el validador fije el destino
 *     (payload.ts:76-78; precedente `refTo('dim2.req02')`), y la verificación
 *     diferida a C2 queda declarada en el `mappingNotes` de req03 y req04.
 *   - Hallazgo 7 (menor): evidencia de contexto corregida (dim7 = 8 requisitos
 *     con manifiesto y 4 pasadas; dim8 = 7 requisitos con manifiesto y 2
 *     pasadas) y hermanos de adaptación = `dim2.req06`/`dim3.req06`/
 *     `dim6.req07`/`dim8.req07`.
 *   - Hallazgo 8 (menor, DECISIÓN TOMADA, opción (b), req05): la pregunta se
 *     queda a nivel de sistema («cómo trata cada uno de los cuatro estados»);
 *     `arquetipo` es CONTEXTO, no cobertura, y el `mappingNotes` deja de
 *     prometer el producto arquetipo × estado.
 *
 * PASADA ADVERSARIAL 2 (ZCode/GLM) APLICADA — 0+7 (0 bloqueantes y 7 menores),
 * con el cambio exacto que propone cada hallazgo:
 *
 *   - Hallazgo 1 (menor, req03): exclusión mutua de los dos canales del
 *     requisito —`not(and(exists(p('variantes')), exists(p('sinVariantes'))))`,
 *     la misma forma de la exclusión de `dim8.req02` (manifest-v0-dim8.ts:204);
 *     sin ella un set declaraba variantes y «sin variantes» a la vez.
 *   - Hallazgo 2 (menor, req04): exclusión mutua entre el canal de ausencia y
 *     una entrada `color` con `colorRef` —
 *     `not(and(exists(p('sinCodificacionColor')), some(p('codificaciones'),
 *     'c', and(eq(op('c','portador'), str('color')), exists(p('c','colorRef'))))))`
 *     — «si se declara la ausencia, ninguna entrada color lleva ref».
 *   - Hallazgo 3 (menor, req02): el xor por ENTRADA no cerraba dos entradas del
 *     MISMO arquetipo (una con `slots`, otra con `noAplica`), que pasaban
 *     `covers` y el xor; se agrega el cierre por arquetipo con `some` anidado y
 *     rutas PREFIJADAS POR ALIAS (`a`/`b`, molde dim1.req04/req11): sin el
 *     prefijo la entrada interna sombrea la externa en `resolvePath`
 *     (predicate.ts:250-263).
 *   - Hallazgo 4 (menor, req05): `arquetipo` pasa a `opt(enum(...))` — la
 *     entrada SIN arquetipo ES la declaración a nivel de sistema; no toca
 *     `covers` (que es sobre `estado`) ni la decisión (b) de la pregunta.
 *   - Hallazgo 5 (menor, req03 y req04): los dos `ref` declaran su `refPath`
 *     esperado en el `mappingNotes` — `[]` (la definición completa del
 *     requisito base) para `heredaDe`; `['roleColors', n, 'role']` (la entrada
 *     de dim1.req02 cuyo rol porta la codificación) para `colorRef`.
 *   - Hallazgo 6 (menor, evidencia): dim4 YA existe en el árbol con manifiesto
 *     (8 requisitos, 2 pasadas, `manifest-v0-dim4.ts`, registrado en
 *     `requirement-manifest/index.ts:25`); el `mappingNotes` de req04 nombra
 *     `dim4.req02` (`pkg.forma.vocabulario`) para el portador «forma».
 *   - Hallazgo 7 (menor, evidencia): cita corregida — `razonNoAplica` es campo
 *     de las ENTRADAS de `dim8.req02` (manifest-v0-dim8.ts:190-191, consumido
 *     por el `eachIn` de `dim8.req07`, :450-458) y `sinMovimientoDecorativo` es
 *     el canal hermano de `dim8.req07` (:433-438 y :460-465).
 *
 * Estructura primaria: el "Resuelto cuando" de la taxonomía §9 — "existe una
 * gramática efectiva y el inventario mínimo de arquetipos declarado por el
 * manifiesto" + "cambiar el blueprint requiere una migración explícita y no
 * vuelve incompletos los sets históricos en silencio". Los SIETE paquetes
 * basales de §9 se cierran uno a uno (spec §3): req01 inventario mínimo,
 * req02 gramática de anatomía, req03 variantes/estados/herencia, req04
 * codificación informativa (cinco portadores), req05 restricciones y estados
 * de contenido, req06 composición interna y adaptación, req07 extensión.
 *
 * Dimensión TERMINAL del grafo de dependencias ("→ composición → interacción →
 * movimiento → patrones": ninguna dimensión depende de ella). No declara
 * materia propia nueva (ningún color, ninguna medida, ninguna tipografía) y
 * toda su relación con dim1/dim2/dim3/dim4/dim5/dim6/dim7/dim8 es por
 * REFERENCIA de payload (`ref`, `RefValue`), nunca por valor y nunca vía
 * `dependsOn` (el validador rechaza ids de otra dimensión — spec §2).
 * `dependsOn` sólo contiene ids `dim9.*`.
 *
 * SIN `rectorBindings`, declarado ahora y no corregido después: "patrones" no
 * está entre los dominios que el mood wall gobierna (spec §2), así que
 * `rectorBindings: []` en los siete y ningún `noConflict('mood-wall')` ni
 * `noConflict('descriptor')`.
 *
 * BRECHAS: seis requisitos con `mapsToKinds: []` y `mappingNotes` no vacío
 * (req01, req02, req04, req05, req06, req07); req03 es PARCIAL Y DECLARADO con
 * los cuatro kinds reales que tienen forma de variante (`button`, `gallery`,
 * `table`, `form`). `dim1.req10` prometió "la redundancia se expresa vía
 * dim7/dim9": esa promesa la cumple `dim7.req06` (redundancia no cromática);
 * `dim9.req04` NO la duplica, sólo la referencia en `mappingNotes`.
 *
 * CERO PROSA: cada validityPredicate es AST puro serializable, igual que
 * manifest-v0-dim1.ts/dim2.ts/dim3.ts/dim4.ts/dim5.ts/dim6.ts/dim7.ts/dim8.ts.
 */
import type {
  CompareOp,
  CoverExpected,
  Operand,
  PathSegment,
  PredicateClause,
  ScalarLiteral,
} from './predicate.js';
import type { PayloadFieldSchema, PayloadType, RequirementManifestV0, RequirementV0 } from './types.js';

// ---------------------------------------------------------------------------
// Constructores de AST — misma forma EXACTA que manifest-v0-dim1.ts:
// `and`/`or` variádicos, `op(...parts)`, `eq(left, right)`, `not(clause)`,
// `each(target, condition)`, `some(target, alias, condition)`, más `refTo` del
// payloadSchema. Sólo se declaran los que este manifiesto usa.
// ---------------------------------------------------------------------------

/** Ruta desnuda (targets de cláusulas, colecciones de agregadores). */
const p = (...parts: PathSegment[]): readonly PathSegment[] => parts;

/** Operando de comparación que referencia una ruta del payload. */
const op = (...parts: PathSegment[]): Operand => ({ kind: 'path', path: parts });

const str = (value: string): ScalarLiteral => ({ kind: 'string', value });

const eq = (left: Operand, right: Operand): PredicateClause => ({ kind: 'compare', op: '==', left, right });

const compare = (operator: CompareOp, left: Operand, right: Operand): PredicateClause => ({
  kind: 'compare',
  op: operator,
  left,
  right,
});

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
const and = (...clauses: PredicateClause[]): PredicateClause => ({ kind: 'and', clauses });
const or = (...clauses: PredicateClause[]): PredicateClause => ({ kind: 'or', clauses });
const not = (clause: PredicateClause): PredicateClause => ({ kind: 'not', clause });
const covers = (
  target: readonly PathSegment[],
  key: readonly string[],
  expected: readonly CoverExpected[],
): PredicateClause => ({ kind: 'covers', target, key, expected });

// Constructores del payloadSchema
const TEXTO: PayloadType = { kind: 'texto' };
/** `ref` genérica (`RefValue`): el destino puede vivir en otro manifiesto. */
const REF: PayloadType = { kind: 'ref' };
/** `ref` con destino FIJO: el validador verifica el `reqId` del tipo (payload.ts:76-78). */
const refTo = (reqId: string): PayloadType => ({ kind: 'ref', reqId });
const enumOf = (...values: string[]): PayloadType => ({ kind: 'enum', values });
const lista = (of: PayloadType): PayloadType => ({ kind: 'lista', of });
const objeto = (fields: Record<string, PayloadFieldSchema>): PayloadType => ({ kind: 'objeto', fields });
const slot = (type: PayloadType, optional = false): PayloadFieldSchema =>
  optional ? { type, optional: true } : { type };
const opt = (type: PayloadType): PayloadFieldSchema => ({ type, optional: true });

// ---------------------------------------------------------------------------
// Constantes cerradas de la dimensión (spec §3, tensión 9: sin tildes y con
// guion, siguiendo el precedente de los enums de dim7.req02)
// ---------------------------------------------------------------------------

const ARQUETIPOS_10 = [
  'accion',
  'contenedor',
  'navegacion',
  'feedback',
  'entrada',
  'secuencia-editorial',
  'lista',
  'tabla',
  'metricas',
  'representacion-de-datos',
] as const;

const OBLIGATORIEDAD_2 = ['obligatorio', 'opcional'] as const;
/** Los cuatro estados de contenido nombrados por la taxonomía §9 (cita cerrada). */
const ESTADOS_CONTENIDO_4 = ['overflow', 'vacio', 'faltante', 'error'] as const;
/** Los cinco portadores de codificación informativa de la taxonomía §9 (cita cerrada). */
const PORTADORES_5 = ['posicion', 'longitud', 'color', 'forma', 'textura'] as const;
/** Los cuatro estados reales del envelope (`SCOPE_STATES` de types.ts:78), no la ontología de diez de dim7. */
const SCOPE_STATES_4 = ['default', 'hover', 'focus', 'active'] as const;

const expectedArquetipos = (): CoverExpected[] => ARQUETIPOS_10.map((nombre) => str(nombre));

// ---------------------------------------------------------------------------
// Los siete requisitos
// ---------------------------------------------------------------------------

const req01: RequirementV0 = {
  id: 'dim9.req01',
  dimensionId: 'dim9',
  packageId: 'pkg.patrones.arquetipos',
  eje: 'completitud',
  pregunta:
    '¿Declara el sistema sus diez arquetipos de patrón (acción, contenedor, navegación, feedback, entrada, secuencia editorial, lista, tabla, métricas y representación de datos), con una decisión escrita por cada uno —incluido «no aplica, porque …»—?',
  estado: 'active',
  dependsOn: [],
  payloadSchema: {
    arquetipos: slot(
      lista(
        objeto({
          nombre: slot(enumOf(...ARQUETIPOS_10)),
          decision: slot(TEXTO),
        }),
      ),
    ),
  },
  validityPredicate: [
    covers(p('arquetipos'), ['nombre'], expectedArquetipos()),
    each(p('arquetipos'), exists(p('decision'))),
  ],
  rectorBindings: [],
  mapsToKinds: [],
  mappingNotes:
    'BRECHA DECLARADA: el inventario de arquetipos es una declaración del DesignSet (C2), no una regla del compilador — y de los diez arquetipos, sólo cuatro tienen kind real (`button`, `gallery`, `table`, `form`, D3 §2). La proyección PARCIAL de esos cuatro se declara en `dim9.req03` (donde viven las variantes); los otros seis (contenedor, navegación, feedback, secuencia editorial, lista, métricas) no tienen kind y quedan como brecha de producción, no sólo de este manifiesto. Base del «no aplica» de cada `decision`: la REGLA ESCRITA del proyecto — «declarar la ausencia es válido; omitirla en silencio, no» (spec §1 insumo 16) —; el precedente de `dim7.req02` es SECUNDARIO, porque allí sostiene UNA entrada condicional (`hover`) en una lista de diez y no nueve de diez (pasada 1, hallazgo 2).',
};

const req02: RequirementV0 = {
  id: 'dim9.req02',
  dimensionId: 'dim9',
  packageId: 'pkg.patrones.anatomia',
  eje: 'completitud',
  pregunta:
    '¿Declara el sistema, para cada arquetipo que aplica, sus slots (con obligatoriedad) y la relación de cada slot con los demás —o declara que ese arquetipo no aplica—?',
  estado: 'active',
  dependsOn: ['dim9.req01'],
  payloadSchema: {
    anatomias: slot(
      lista(
        objeto({
          arquetipo: slot(enumOf(...ARQUETIPOS_10)),
          /**
           * Pasada 1, hallazgo 1 (bloqueante): `slots` es `opt(...)`. El
           * validador de payload corre ANTES que el predicado (payload.ts:96-97
           * y 127-135) y una entrada «no aplica» sin `slots` era rechazada por
           * campo obligatorio ausente, arrastrando por dependencia a
           * req03/05/06/07.
           */
          slots: opt(
            lista(
              objeto({
                nombre: slot(TEXTO),
                obligatoriedad: slot(enumOf(...OBLIGATORIEDAD_2)),
                relacion: slot(TEXTO),
              }),
            ),
          ),
          /** Canal de ausencia declarada (spec §1 insumo 16): declararla es válido, omitirla no. */
          noAplica: opt(TEXTO),
        }),
      ),
    ),
  },
  validityPredicate: [
    covers(p('anatomias'), ['arquetipo'], expectedArquetipos()),
    // Pasada 1, hallazgo 4 (menor): XOR por entrada. O trae su gramática de
    // slots, o declara por qué no aplica, NUNCA las dos — el mismo criterio con
    // que `dim7.req02` prohibió mapeos contradictorios
    // (manifest-v0-dim7.ts:223-225).
    each(
      p('anatomias'),
      and(
        or(exists(p('slots')), exists(p('noAplica'))),
        or(not(exists(p('slots'))), not(exists(p('noAplica')))),
      ),
    ),
    // Pasada 2, hallazgo 3 (menor): cierre por ARQUETIPO. El xor por entrada no
    // bastaba: dos entradas del MISMO arquetipo —una con `slots`, otra con
    // `noAplica`— pasaban `covers` (todas presentes) y el xor (cada una, por
    // separado, cumple). `dim7.req02` cerró exactamente esta clase
    // (manifest-v0-dim7.ts:222-225). Las rutas internas van PREFIJADAS POR
    // ALIAS (molde dim1.req04/req11, manifest-v0-dim1.ts:599-603): sin el
    // prefijo, la entrada interna SOMBREA la externa en `resolvePath`
    // (predicate.ts:250-263) y la cláusula no mide lo que dice.
    not(
      some(
        p('anatomias'),
        'a',
        and(
          exists(p('a', 'noAplica')),
          some(
            p('anatomias'),
            'b',
            and(eq(op('a', 'arquetipo'), op('b', 'arquetipo')), exists(p('b', 'slots'))),
          ),
        ),
      ),
    ),
  ],
  rectorBindings: [],
  mapsToKinds: [],
  mappingNotes:
    'BRECHA DECLARADA: el designRuleSet no tiene kind de anatomía ni de slots. `table.header` y `gallery.controls` (D3 §2) son campos FIJOS de un kind concreto, no un sistema de slots declarable por arquetipo. El `relacion: texto` de cada slot absorbe el caso condicional («sin relación con otros slots, porque …») por el mismo mecanismo de texto libre que `dim7.req02`. `slots` es opcional y `noAplica` declara la ausencia (spec §1 insumo 16); el xor impide declarar gramática y no-aplicabilidad a la vez EN LA MISMA ENTRADA (pasada 1, hallazgos 1 y 4) y desde la pasada 2 (hallazgo 3) tampoco ENTRE ENTRADAS del mismo arquetipo, con las rutas internas prefijadas por alias para que `resolvePath` no sombree la entrada externa con la interna.',
};

const req03: RequirementV0 = {
  id: 'dim9.req03',
  dimensionId: 'dim9',
  packageId: 'pkg.patrones.variantes',
  eje: 'completitud',
  pregunta:
    '¿Declara el sistema qué variantes tiene cada arquetipo, de qué definición hereda cada una y qué diferencia introduce —o declara que no hay variantes, y por qué—?',
  estado: 'active',
  dependsOn: ['dim9.req01', 'dim9.req02'],
  payloadSchema: {
    /**
     * Pasada 1, hallazgo 2 (bloqueante): `variantes` es `opt(...)` porque
     * `exists(variantes)` obligaba a declarar ≥1 variante en todo set. El
     * escape honesto es el hermano `sinVariantes` (spec §1 insumo 16, patrón
     * `razonNoAplica` de las entradas de `dim8.req02`).
     */
    variantes: opt(
      lista(
        objeto({
          arquetipo: slot(enumOf(...ARQUETIPOS_10)),
          nombre: slot(TEXTO),
          /**
           * Tensión 7 (§4), RESUELTA a favor de (b): `heredaDe` es un `ref`
           * genérico que puede apuntar a una definición de OTRA dimensión (el
           * Core de color vive en dim1). La regla escrita prohíbe el cruce en
           * `dependsOn`, no en `RefValue.refReqId` (types.ts:94-95,
           * payload.ts:71-79). Pasada 2, hallazgo 5: el `refPath` esperado es
           * `[]` (la definición completa del requisito base).
           */
          heredaDe: slot(REF),
          estadoEnvelope: opt(enumOf(...SCOPE_STATES_4)),
          diferencia: slot(TEXTO),
        }),
      ),
    ),
    sinVariantes: opt(TEXTO),
  },
  validityPredicate: [
    or(
      and(
        exists(p('variantes')),
        each(p('variantes'), exists(p('nombre'))),
        each(p('variantes'), exists(p('heredaDe'))),
        each(p('variantes'), exists(p('diferencia'))),
      ),
      exists(p('sinVariantes')),
    ),
    // Pasada 2, hallazgo 1 (menor): exclusión mutua de los dos canales. Un set
    // no puede declarar variantes y «sin variantes» a la vez; la forma es la de
    // `dim8.req02` (manifest-v0-dim8.ts:204) y sin esta cláusula el calco del
    // patrón queda incompleto.
    not(and(exists(p('variantes')), exists(p('sinVariantes')))),
  ],
  rectorBindings: [],
  mapsToKinds: [
    {
      kind: 'button',
      scopeSuggestion: { state: [...SCOPE_STATES_4] },
      valueNotes:
        '`variant` solid|outline|ghost|text es la forma REAL de una variante del arquetipo acción, y `interaction` es su comportamiento (D3 §2). Los campos `tone`/`size`/`width` pertenecen al mismo kind.',
    },
    {
      kind: 'gallery',
      valueNotes:
        '`mode` grid|metro|masonry|carousel es la forma real de una variante del arquetipo representación de datos; `columns`/`controls` son sus parámetros. Lectura tentativa: también podría corresponder a lista o a métricas.',
    },
    {
      kind: 'table',
      valueNotes:
        '`variant` plain|lined|striped|cards es la forma real de una variante del arquetipo tabla; `header`/`responsive`/`density` son sus parámetros.',
    },
    {
      kind: 'form',
      valueNotes:
        '`surface` none|card|outlined es la única variante del arquetipo entrada, y es SÓLO contenedor (D3 §2: "form es sólo contenedor").',
    },
  ],
  mappingNotes:
    'PARCIAL Y DECLARADO: sólo cuatro de los diez arquetipos tienen kind real (acción→`button`, representación de datos→`gallery`, tabla→`table`, entrada→`form`); el resto es brecha declarada en `dim9.req01`. `estadoEnvelope` usa los cuatro estados reales del envelope (`SCOPE_STATES`); el SIGNIFICADO de cada estado es de `dim7.req02` y no se repite acá. `sinVariantes` es el canal de ausencia declarada (pasada 1, hallazgo 2), calcado del patrón `razonNoAplica` de `dim8.req02`/`req07` (spec §1 insumo 16, atribución corregida en la pasada 2, hallazgo 7: `razonNoAplica` es campo de las entradas de `dim8.req02`, manifest-v0-dim8.ts:190-191, consumido por el `eachIn` de `req07`, :450-458; el canal hermano de `dim8.req07` es `sinMovimientoDecorativo`, :433-438 y :460-465): declarar la ausencia es válido; omitirla en silencio, no. Desde la pasada 2 (hallazgo 1) los dos canales son mutuamente excluyentes: `not(and(exists(variantes), exists(sinVariantes)))`, la misma forma de la exclusión de `dim8.req02`. Sobre `heredaDe`: el `ref` se verifica por presencia en C1; **refPath esperado: `[]` (la definición completa del requisito base)**, contrato declarado en la pasada 2 (hallazgo 5) para que dos sets no apunten a formas distintas; su resolución y la detección de refs colgantes son de C2 (`resolveRefValue`/`findDanglingRefs`, adapter.ts).',
};

const req04: RequirementV0 = {
  id: 'dim9.req04',
  dimensionId: 'dim9',
  packageId: 'pkg.patrones.codificacion',
  eje: 'completitud',
  pregunta:
    '¿Declara el sistema, para cada uno de los cinco portadores (posición, longitud, color, forma, textura), un uso efectivo —y en el caso del color, la referencia a un rol de la dimensión 1 en vez de un valor nuevo?',
  estado: 'active',
  dependsOn: ['dim9.req01'],
  payloadSchema: {
    codificaciones: slot(
      lista(
        objeto({
          portador: slot(enumOf(...PORTADORES_5)),
          uso: slot(TEXTO),
          /**
           * Pasada 1, hallazgo 6 (opcional ADOPTADO): `refTo(dim1.req02)`
           * fija el destino, así el validador verifica el `reqId` del tipo
           * (payload.ts:76-78; precedente `refTo('dim2.req02')` en
           * manifest-v0-dim2.ts:329). El tipo sigue siendo `ref`: un valor
           * cromático nuevo no tiene forma de escribirse acá. Pasada 2,
           * hallazgo 5: el `refPath` esperado es `['roleColors', n, 'role']`.
           */
          colorRef: opt(refTo('dim1.req02')),
        }),
      ),
    ),
    /** Pasada 1, hallazgo 3 (bloqueante): canal de ausencia del portador color. */
    sinCodificacionColor: opt(TEXTO),
  },
  validityPredicate: [
    covers(
      p('codificaciones'),
      ['portador'],
      PORTADORES_5.map((portador) => str(portador)),
    ),
    each(p('codificaciones'), exists(p('uso'))),
    // Pasada 1, hallazgos 3 y 5: `each` con rutas RELATIVAS a la entrada
    // (molde `dim7.req02`, manifest-v0-dim7.ts:226-243) reemplaza la `some`
    // con alias —que cortaba en la primera entrada que cumplía
    // (predicate.ts:668-671) y dejaba pasar dos entradas `color` con una sola
    // `colorRef`— y gana el canal de ausencia declarada `sinCodificacionColor`.
    // Dentro del `each` las rutas son relativas: `op('portador')` y
    // `p('colorRef')`, nunca `op('c','portador')`.
    or(
      each(
        p('codificaciones'),
        or(compare('!=', op('portador'), str('color')), exists(p('colorRef'))),
      ),
      exists(p('sinCodificacionColor')),
    ),
    // Pasada 2, hallazgo 2 (menor): exclusión mutua. `covers` siempre exige una
    // entrada `color`, así que la contradicción real —declarar la ausencia del
    // portador color y a la vez entregar una entrada `color` con `colorRef`—
    // pasaba en silencio: «si se declara la ausencia, ninguna entrada color
    // lleva ref». Rutas prefijadas por alias (molde dim1.req04/req11); sin el
    // prefijo, la entrada interna sombrea la externa en `resolvePath`
    // (predicate.ts:250-263).
    not(
      and(
        exists(p('sinCodificacionColor')),
        some(
          p('codificaciones'),
          'c',
          and(eq(op('c', 'portador'), str('color')), exists(p('c', 'colorRef'))),
        ),
      ),
    ),
  ],
  rectorBindings: [],
  mapsToKinds: [],
  mappingNotes:
    'BRECHA DECLARADA: no existe un kind de «codificación informativa» — el significado-que-viaja-en-un-portador es una decisión del DesignSet (C2). Su materialización toca kinds de OTRAS dimensiones (`color` de dim1 vía `ref` a `CORE_ROLES_13`, `spacing`/`layout` de dim3, el portador «forma», que toca `dim4.req02` (`pkg.forma.vocabulario`; dim4 ya está en el árbol con manifiesto y 2 pasadas — pasada 2, hallazgo 6), `media`/`surface` de dim5) y esta spec NO proyecta a ninguno de ellos a propósito: la proyección pertenece al adaptador. La **redundancia no cromática** no se declara acá: ya vive en `dim7.req06` (los cinco significados de `dim1.req10`, prometidos en su propio `mappingNotes`), y este requisito NO la duplica. `sinCodificacionColor` es el canal de ausencia declarada del portador color (pasada 1, hallazgo 3); `each` con rutas relativas reemplaza la `some` con alias y cierra la entrada duplicada (pasada 1, hallazgos 3 y 5); desde la pasada 2 (hallazgo 2) la ausencia declarada y una entrada `color` con ref son mutuamente excluyentes, con las rutas de la exclusión prefijadas por alias. Sobre `colorRef` (tipado `refTo(dim1.req02)`): el `ref` se verifica por presencia en C1; **refPath esperado: `["roleColors", n, "role"]` — la entrada de dim1.req02 cuyo rol porta la codificación** (contrato declarado en la pasada 2, hallazgo 5); su resolución y la detección de refs colgantes son de C2 (`resolveRefValue`/`findDanglingRefs`, adapter.ts).',
};

const req05: RequirementV0 = {
  id: 'dim9.req05',
  dimensionId: 'dim9',
  packageId: 'pkg.patrones.contenido',
  eje: 'completitud',
  pregunta:
    '¿Declara el sistema cómo trata cada uno de los cuatro estados de contenido que la taxonomía nombra (overflow, vacío, faltante, error)?',
  estado: 'active',
  dependsOn: ['dim9.req01', 'dim9.req02'],
  payloadSchema: {
    estadosContenido: slot(
      lista(
        objeto({
          /**
           * Pasada 2, hallazgo 4 (menor): `arquetipo` es `opt(...)`. La pregunta
           * es de SISTEMA y un tratamiento global no tiene arquetipo testigo
           * honesto; la entrada SIN arquetipo ES la declaración a nivel de
           * sistema (misma clase de «testigo falso» que la «variante falsa» que
           * la pasada 1 eliminó en req03). No toca `covers` —que es sobre
           * `estado`— ni la decisión (b) de la pasada 1.
           */
          arquetipo: opt(enumOf(...ARQUETIPOS_10)),
          estado: slot(enumOf(...ESTADOS_CONTENIDO_4)),
          tratamiento: slot(TEXTO),
        }),
      ),
    ),
  },
  validityPredicate: [
    covers(
      p('estadosContenido'),
      ['estado'],
      ESTADOS_CONTENIDO_4.map((estado) => str(estado)),
    ),
    each(p('estadosContenido'), exists(p('tratamiento'))),
  ],
  rectorBindings: [],
  mapsToKinds: [],
  mappingNotes:
    'DECISIÓN TOMADA (pasada 1, hallazgo 8, opción (b)): la pregunta es de SISTEMA — «cómo trata cada uno de los cuatro estados» — y `covers` la verifica UNA vez sobre la lista completa. El campo `arquetipo` de cada entrada es CONTEXTO (dónde se observó ese tratamiento), NO una cobertura por arquetipo: esta spec no promete el producto arquetipo aplicable × cuatro estados y este `mappingNotes` ya no lo insinúa. Pasada 2 (hallazgo 4): `arquetipo` pasa a `opt(enum(...))` para que la entrada sin arquetipo sea declarable —misma clase de «testigo falso» que la «variante falsa» que la pasada 1 eliminó en req03—; la decisión (b) y el `covers` sobre `estado` quedan intactos, y el hueco (cuatro estados declarados sobre un solo arquetipo) sigue declarado y acotado. Si algún día se cierra por arquetipo, el molde ya existe y está probado — `eachIn` sobre el payload resuelto con escape de no-aplica, como `dim8.req07` (manifest-v0-dim8.ts:450-458; el campo de ausencia es de las entradas de `dim8.req02`, :190-191) —, y exigiría que `dim9.req01` lleve el no-aplica como campo legible por máquina (hoy `decision: texto` es texto libre). BRECHA DECLARADA: ningún kind tiene estados de contenido como campo; `table.responsive scroll|stack` (D3 §2) es un modo de reflujo, no un estado de contenido — brecha de compilador del mismo tipo que los seis estados sin hogar de `dim7.req02`.',
};

const req06: RequirementV0 = {
  id: 'dim9.req06',
  dimensionId: 'dim9',
  packageId: 'pkg.patrones.adaptacion',
  eje: 'ciclo-de-vida',
  pregunta:
    '¿Declara el sistema cómo se adapta un patrón entre contextos —o la decisión explícita de que no cambia—?',
  estado: 'active',
  dependsOn: ['dim9.req01', 'dim9.req02'],
  payloadSchema: {
    adaptaciones: slot(
      lista(
        objeto({
          arquetipo: slot(enumOf(...ARQUETIPOS_10)),
          contexto: slot(TEXTO),
          ajuste: slot(TEXTO),
        }),
      ),
    ),
  },
  validityPredicate: [exists(p('adaptaciones')), each(p('adaptaciones'), exists(p('ajuste')))],
  rectorBindings: [],
  mapsToKinds: [],
  mappingNotes:
    'BRECHA DECLARADA, del mismo tipo que `dim2.req06`/`dim3.req06`/`dim6.req07`/`dim8.req07` (hermanos corregidos en la pasada 1, hallazgo 7, y verificados en la pasada 2: `dim5.req06` es de overlays y `coherencia`, `dim7.req07` de equivalencias estáticas y `completitud`): la adaptación se resuelve en el adaptador de destino. `layout.mobile{}` (dim3) y los modos de reflujo de `table`/`gallery` son ajustes de UN kind concreto, no la política de adaptación de un patrón. Tensión 10 (spec §4) RESUELTA con la decisión escrita en código: «El eje NO cambia por [la forma del predicado]; sigue `ciclo-de-vida` por la pregunta» (manifest-v0-dim8.ts:409-412, citando `dim6.req07`, manifest-v0-dim6.ts:249-263) — req06 y req07 preguntan por cambio entre contextos y versiones, así que el eje se mantiene.',
};

const req07: RequirementV0 = {
  id: 'dim9.req07',
  dimensionId: 'dim9',
  packageId: 'pkg.patrones.extension',
  eje: 'ciclo-de-vida',
  pregunta:
    '¿Declara el sistema cómo se agrega un patrón nuevo sin volver incompletos en silencio los sets históricos?',
  estado: 'active',
  dependsOn: ['dim9.req01', 'dim9.req02', 'dim9.req03'],
  payloadSchema: {
    extension: slot(
      objeto({
        comoSeAgrega: slot(TEXTO),
        migracion: slot(TEXTO),
        efectoEnSetsHistoricos: slot(TEXTO),
      }),
    ),
  },
  validityPredicate: [
    exists(p('extension', 'comoSeAgrega')),
    exists(p('extension', 'migracion')),
    exists(p('extension', 'efectoEnSetsHistoricos')),
  ],
  rectorBindings: [],
  mapsToKinds: [],
  mappingNotes:
    'BRECHA DECLARADA: el ciclo de vida de los patrones vive en el DesignSet (C2) y en el versionado del manifiesto; ningún kind del compilador representa una migración. La regla escrita acá es del SET de diseño, no del formato de este documento (tensión 10, spec §4, resuelta a favor de mantener `ciclo-de-vida`).',
};

export const DIM9_REQUIREMENTS_V0: readonly RequirementV0[] = [
  req01,
  req02,
  req03,
  req04,
  req05,
  req06,
  req07,
];

export const DIM9_MANIFEST_V0: RequirementManifestV0 = {
  schemaVersion: 1,
  manifestVersion: '1.0',
  revision: 1,
  requirements: [...DIM9_REQUIREMENTS_V0],
};
