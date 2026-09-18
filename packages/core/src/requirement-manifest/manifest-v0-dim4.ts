/**
 * Manifiesto v0 de la Dimensión 4 — Forma, borde y profundidad
 * (spec-c1-dim4-forma-manifest-2026-09-18.md §3, ficha C1-dim4).
 *
 * Pasadas: PASADA ADVERSARIAL 1 (ZCode/GLM) APLICADA — 4 bloqueantes + 5
 * menores — y PASADA ADVERSARIAL 2 (ZCode/GLM) APLICADA — 3 bloqueantes + 3
 * menores. La spec quedó en estado "pasada 2 aplicada — aprobada para
 * implementar", así que este archivo implementa §3 YA CORREGIDA:
 *
 * PASADA 1 (4+5):
 *   - HB1: el color del filete es `union([refTo('dim1.req02'), color-css])` y
 *     el predicado sólo exige `exists(color)`; FUERA el `validCss`, que resolvía
 *     la ref contra un store de una sola dimensión y fallaba siempre.
 *   - HB2: cada estilo de borde declara `roles: lista(refTo('dim4.req01'))`
 *     obligatorio + `each(estilosDeBorde, exists(roles))`.
 *   - HB3: `mecanismoSeparacion: texto` obligatorio y `caso: opt(enum(...))` —
 *     fail-closed de verdad, sin "no aplica" silencioso.
 *   - HB4: la política material (`permitido|no-permitido`) era DECISIÓN
 *     DECLARADA de la spec, no cita (queda como tensión 13, cerrada en la
 *     pasada 2).
 *   - HM5: req07 pasa a `eje: completitud`.
 *   - HM6: req02 y req04 cruzan rol↔definición con eachIn+some+eq+op; el
 *     `refPath` de `rol` apunta a la ENTRADA COMPLETA de req01.roles
 *     (['roles', n]) y la cláusula navega `rol.nombre` dentro de la ref.
 *   - HM7: `aplicaA: texto` obligatorio en req06.
 *   - HM8: §2 corregida (precedentes de adaptación, dim7 y dim8).
 *   - HM9: la spec declaraba la lectura del enum de tipos de filete.
 *
 * PASADA 2 (3+3):
 *   - PB1: `tipo: enum('none','solid','dashed')`, el enum REAL del compilador
 *     (`compiler:226` `'borderStyle' => ['none','solid','dashed']`, validado con
 *     `in_array` en `:978`). El gatillo de degradación de req03 compara sólo
 *     contra `dashed`. El `valueNotes` de `shape` declara que «punteado» no
 *     tiene hogar en el compilador: brecha declarada.
 *   - PB2: `permitido: bool` (primitiva `bool`, types.ts:91; precedente
 *     `sinValorPropio: slot(BOOL)`, manifest-v0-dim7.ts:429) +
 *     `each(materiales, exists(permitido))`. FUERA el enum
 *     `permitido|no-permitido`, que era un valor cerrado sin cita: cierra la
 *     tensión 13. `exists(false)` pasa — la cláusula mide presencia, no verdad.
 *   - PB3: req03 agrega el cruce de sus propios `roles` contra los roles reales
 *     de req01 (`each(estilosDeBorde, some(roles, 'rl', eachIn(...)))`): un
 *     estilo no puede colgar de `['roles', 99]`.
 *   - PM4: redacción — C2 verifica que el requisito destino EXISTA
 *     (`findDanglingRefs`, adapter.ts:81-94); el `refPath` no lo navega nadie
 *     hoy (mappingNotes de req03, spec §2 y tensión 6).
 *   - PM5: `sinExcepciones: opt(texto)` al nivel superior de req07 y predicado
 *     `or(and(exists(separaciones), ...), exists(sinExcepciones))`; el
 *     fail-closed de `each` sobre lista vacía (predicate.ts:629-634) impide el
 *     "no aplica" enterrado en un rol dummy.
 *   - PM6: mappingNotes de req04 — `backgroundPosition`/`backgroundSize`
 *     posicionan el fondo del elemento, no el objeto.
 *
 * Sin `rectorBindings`: "forma" no está entre los dominios del mood wall
 * (spec §2, insumo 5) — verificado, no asumido. Por eso este archivo tampoco
 * declara `noConflict` (nadie lo llama acá). Los ejes no cambiaron: `eachIn`
 * no dispara `coherencia`.
 *
 * CERO PROSA: cada validityPredicate es AST puro serializable, igual que
 * manifest-v0-dim1/2/3/5/6/7/8.ts. Los constructores `p`, `op`, `str`, `num`,
 * `eq`, `gte`, `exists`, `each`, `some`, `and`, `covers`, `or`, `not`,
 * `eachIn`, `count`, `refTo`, `enumOf`, `lista`, `objeto`, `union`, `slot`,
 * `opt` son la forma EXACTA de manifest-v0-dim1.ts; ninguna cláusula es
 * extensión nueva.
 *
 * `exactOptionalPropertyTypes`: cuando `mapsToKinds` no está vacío y no hay
 * brecha que declarar, la propiedad `mappingNotes` se OMITE (nunca
 * `mappingNotes: undefined`).
 */
import type { CoverExpected, Operand, PathSegment, PredicateClause, ScalarLiteral } from './predicate.js';
import type { PayloadFieldSchema, PayloadType, RequirementManifestV0, RequirementV0 } from './types.js';

// ---------------------------------------------------------------------------
// Constructores de AST (forma EXACTA de manifest-v0-dim1.ts)
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
const validCss = (
  target: readonly PathSegment[],
  cssType: 'color-css' | 'longitud-css',
): PredicateClause => ({ kind: 'validCss', target, cssType });
const count = (target: readonly PathSegment[]): Operand => ({ kind: 'count', target });
const eachIn = (
  reqId: string,
  path: readonly PathSegment[],
  alias: string,
  condition: PredicateClause,
): PredicateClause => ({ kind: 'eachIn', reqId, path, alias, condition });
const someIn = (
  reqId: string,
  path: readonly PathSegment[],
  alias: string,
  condition: PredicateClause,
): PredicateClause => ({ kind: 'someIn', reqId, path, alias, condition });

// Constructores del payloadSchema
const COLOR_CSS: PayloadType = { kind: 'color-css' };
const LONGITUD_CSS: PayloadType = { kind: 'longitud-css' };
const TEXTO: PayloadType = { kind: 'texto' };
const REF: PayloadType = { kind: 'ref' };
const NUMERO: PayloadType = { kind: 'numero' };
/** Primitiva booleana de la gramática (types.ts:91); dim7.req08 la usa: `sinValorPropio: slot(BOOL)`. */
const BOOL: PayloadType = { kind: 'bool' };
const refTo = (reqId: string): PayloadType => ({ kind: 'ref', reqId });
const enumOf = (...values: string[]): PayloadType => ({ kind: 'enum', values });
const lista = (of: PayloadType): PayloadType => ({ kind: 'lista', of });
const objeto = (fields: Record<string, PayloadFieldSchema>): PayloadType => ({ kind: 'objeto', fields });
const union = (of: PayloadType[]): PayloadType => ({ kind: 'union', of });
const slot = (type: PayloadType, optional = false): PayloadFieldSchema =>
  optional ? { type, optional: true } : { type };
const opt = (type: PayloadType): PayloadFieldSchema => ({ type, optional: true });

// ---------------------------------------------------------------------------
// Constantes cerradas de la dimensión (spec §3; cada valor con su cita)
// ---------------------------------------------------------------------------

/** kind real `shape.radius` (insumo 9). */
const RADIOS_4 = ['longitud', 'none', 'pill', 'circle'] as const;
/** kind real `shape.mask` (insumo 9). */
const MASCARAS_4 = ['none', 'rounded', 'circle', 'arch'] as const;
/**
 * Enum REAL del compilador (insumo 13): `compiler:226` declara
 * `'borderStyle' => ['none','solid','dashed']` y `:978` lo valida con
 * `in_array`. Reemplaza la lectura declarada de la pasada 1
 * (`macizo|segmentado|punteado`), que la spec se había comprometido a cambiar
 * en cuanto apareciera el enum real. La decisión 10 nombra «segmentados o
 * punteados», pero el kind sostiene sólo estos tres: «punteado» no tiene hogar
 * en el compilador — brecha declarada (spec §1 y §4, tensión 5).
 */
const TIPOS_DE_FILETE_3 = ['none', 'solid', 'dashed'] as const;
/** taxonomía §4, paquete basal (insumo 2): "sombras, luz, transparencia, mezcla y efectos materiales". */
const EFECTOS_4 = ['sombra', 'luz', 'transparencia', 'mezcla'] as const;
/** taxonomía §4, "Resuelto cuando" (insumo 1). */
const CASOS_3 = ['plano', 'sin-sombra', 'sin-efectos'] as const;

// ---------------------------------------------------------------------------
// Los ocho requisitos
// ---------------------------------------------------------------------------

/** Los roles geométricos son el SUJETO de "cada rol geométrico basal" (spec §2). */
const req01: RequirementV0 = {
  id: 'dim4.req01',
  dimensionId: 'dim4',
  packageId: 'pkg.forma.roles',
  eje: 'completitud',
  pregunta:
    '¿Qué roles geométricos declara el set, cada uno con nombre propio y descripción, para poder asignarles forma, borde y profundidad?',
  estado: 'active',
  dependsOn: [],
  payloadSchema: {
    roles: slot(
      lista(
        objeto({
          nombre: slot(TEXTO),
          descripcion: slot(TEXTO),
        }),
      ),
    ),
  },
  validityPredicate: [
    exists(p('roles')),
    each(p('roles'), exists(p('nombre'))),
    each(p('roles'), exists(p('descripcion'))),
  ],
  rectorBindings: [],
  mapsToKinds: [],
  mappingNotes:
    'BRECHA DECLARADA: ningún kind del designRuleSet representa un rol geométrico — los roles viven en el DesignSet (C2) y se proyectan sólo cuando un requisito concreto los usa (`shape`/`surface`, req02-req07). La lista queda ABIERTA por D12: lo cerrado es el SET (lo que el diseñador declaró es todo lo que hay), no el vocabulario que el manifiesto acepta; la taxonomía no enumera roles geométricos basales y no se inventa un catálogo (insumo 8).',
};

/**
 * Forma y radio. Eje `validez`: el predicado no es sólo `covers`+`each`+`exists`
 * — compara el radio declarado y exige el valor de longitud cuando el radio ES
 * una medida (spec §3, regla "completitud salvo umbral/comparación").
 *
 * CONVENCIÓN (spec §3, hallazgo 6): el `refPath` de `rol` apunta a la ENTRADA
 * COMPLETA de req01.roles (p. ej. ['roles', 0]), no al campo `nombre`; así
 * `op('fm','rol','nombre')` navega dentro de la ref resuelta (predicate.ts:194-213).
 */
const req02: RequirementV0 = {
  id: 'dim4.req02',
  dimensionId: 'dim4',
  packageId: 'pkg.forma.vocabulario',
  eje: 'validez',
  pregunta:
    '¿Declara el set la forma de cada rol geométrico —su vocabulario y su radio de esquina— y con qué valor?',
  estado: 'active',
  dependsOn: ['dim4.req01'],
  payloadSchema: {
    formas: slot(
      lista(
        objeto({
          rol: slot(REF),
          vocabulario: slot(TEXTO),
          radio: slot(enumOf(...RADIOS_4)),
          radioValor: opt(LONGITUD_CSS),
        }),
      ),
    ),
  },
  validityPredicate: [
    exists(p('formas')),
    each(p('formas'), exists(p('rol'))),
    each(p('formas'), exists(p('vocabulario'))),
    each(p('formas'), exists(p('radio'))),
    each(
      p('formas'),
      or(
        not(eq(op('radio'), str('longitud'))),
        validCss(p('radioValor'), 'longitud-css'),
      ),
    ),
    // Cruce rol↔definición (hallazgo 6, opción A): TODO rol declarado en
    // req01 tiene una forma acá. El eje NO cambia (eachIn no dispara coherencia).
    eachIn(
      'dim4.req01',
      ['roles'],
      'r',
      some(p('formas'), 'fm', eq(op('fm', 'rol', 'nombre'), op('r', 'nombre'))),
    ),
  ],
  rectorBindings: [],
  mapsToKinds: [
    {
      kind: 'shape',
      valueNotes:
        'radius es el único campo real de la forma (longitud|none|pill|circle, insumo 9); el "vocabulario geométrico" y la relación de forma entre roles no tienen campo en ningún kind — proyección parcial declarada.',
    },
  ],
};

/**
 * Estilos de borde. Eje `validez`: contiene la condición de degradación con
 * `gte`/`count`/`some` sobre el número y el tipo de filetes (spec §3). Los
 * divisores NO reciben requisito propio: son un estilo de borde de un solo
 * filete cuyo rol es separar (spec §4, tensión 3). El umbral "varios filetes"
 * no está definido en la decisión 10: `>= 2` es la lectura conservadora
 * declarada (spec §4, tensión 5).
 *
 * HB1 (pasada 1): el color es `union([refTo('dim1.req02'), color-css])` y el
 * predicado sólo exige `exists(color)`. La rama literal la valida el validador
 * de payload contra la unión (payload.ts:104-112); la rama ref queda cubierta
 * por C2 con la precisión de PM4.
 * HB2 (pasada 1): `roles: lista(refTo('dim4.req01'))` obligatorio por estilo.
 *
 * PB1 (pasada 2): `tipo` es el enum REAL del compilador (`none|solid|dashed`,
 * compiler:226/:978) y el gatillo de degradación compara sólo contra `dashed`
 * — «punteado» no existe en el compilador.
 * PB3 (pasada 2): además, cada rol que un estilo cita tiene que existir de
 * verdad en req01; antes un estilo podía colgar de `['roles', 99]` y quedar
 * resuelto. `some` es `{kind:'some', target, alias, condition}` y `eachIn` es
 * `{kind:'eachIn', reqId, path, alias, condition}` (campo `path`, no `target`).
 * PM4 (pasada 2): C2 verifica que el requisito destino EXISTA
 * (`findDanglingRefs`, adapter.ts:81-94); el `refPath` no lo navega nadie hoy.
 */
const req03: RequirementV0 = {
  id: 'dim4.req03',
  dimensionId: 'dim4',
  packageId: 'pkg.forma.borde',
  eje: 'validez',
  pregunta:
    '¿Declara el set sus estilos de borde con nombre —cada uno con su lista ordenada de filetes y con los roles a los que sirve— y qué se degrada cuando el destino no puede cumplirla?',
  estado: 'active',
  dependsOn: ['dim4.req01'],
  payloadSchema: {
    estilosDeBorde: slot(
      lista(
        objeto({
          nombre: slot(TEXTO),
          roles: slot(lista(refTo('dim4.req01'))),
          filetes: slot(
            lista(
              objeto({
                grosor: slot(LONGITUD_CSS),
                tipo: slot(enumOf(...TIPOS_DE_FILETE_3)),
                color: slot(union([refTo('dim1.req02'), COLOR_CSS])),
                posicion: slot(TEXTO),
              }),
            ),
          ),
          limiteConocido: slot(TEXTO),
          degradacion: opt(TEXTO),
        }),
      ),
    ),
  },
  validityPredicate: [
    exists(p('estilosDeBorde')),
    each(p('estilosDeBorde'), exists(p('nombre'))),
    each(p('estilosDeBorde'), exists(p('roles'))),
    each(p('estilosDeBorde'), exists(p('filetes'))),
    each(p('estilosDeBorde'), each(p('filetes'), exists(p('grosor')))),
    each(p('estilosDeBorde'), each(p('filetes'), exists(p('tipo')))),
    each(p('estilosDeBorde'), each(p('filetes'), exists(p('color')))),
    each(p('estilosDeBorde'), each(p('filetes'), exists(p('posicion')))),
    each(p('estilosDeBorde'), exists(p('limiteConocido'))),
    // PB1: el destino web no puede dibujar dos filetes si alguno es segmentado;
    // el único tipo segmentado del compilador es `dashed`.
    each(
      p('estilosDeBorde'),
      or(
        not(gte(count(p('filetes')), num(2))),
        not(some(p('filetes'), 'f', eq(op('f', 'tipo'), str('dashed')))),
        exists(p('degradacion')),
      ),
    ),
    // PB3: cada rol citado por un estilo tiene que resolver a un rol real de
    // req01. Se escribe como «no existe un rol citado que NO coincida con
    // alguno de req01» (not·some·not·someIn), porque la gramática no tiene
    // `each` con alias y la forma dictada en la pasada 2 (some·eachIn) exigía
    // que un rol citado fuera igual a TODOS los de req01 — medido: falla con
    // dos roles. El alias `rl` resuelve la ref (patrón dim1.req04); una ref
    // rota da `referencia-fuera-de-rango`.
    each(
      p('estilosDeBorde'),
      not(
        some(
          p('roles'),
          'rl',
          not(
            someIn(
              'dim4.req01',
              ['roles'],
              'r',
              eq(op('rl', 'nombre'), op('r', 'nombre')),
            ),
          ),
        ),
      ),
    ),
  ],
  rectorBindings: [],
  mapsToKinds: [
    {
      kind: 'shape',
      valueNotes:
        'borderStyle/borderWidth existen, pero el kind sostiene UN borde, no un estilo con nombre ni una lista ordenada de filetes: la proyección es parcial — el compilador puede emitir un filete por regla, no la pila con nombre. Sobre el tipo: decisión 10 nombra «segmentados o punteados»; el kind sostiene sólo solid|dashed|none — «punteado» no tiene hogar en el compilador, brecha declarada.',
    },
    {
      kind: 'surface',
      valueNotes:
        'borderColor/borderWidth, misma limitación (un borde, un color); decisión 10: "el núcleo es lo que un diseño TIENE QUE DECLARAR, no lo que el destino PUEDE hacer".',
    },
  ],
  mappingNotes:
    'C2 verifica que el requisito destino exista en el set (`findDanglingRefs`, `adapter.ts:81-94`); el `refPath` no lo navega nadie hoy — brecha declarada.',
};

/**
 * Profundidad. Cruce rol↔definición (hallazgo 6, opción A) con alias `pf`
 * sobre `profundidades`; el eje NO cambia.
 *
 * PM6 (pasada 2): el `mappingNotes` nombra los campos REALES del compilador.
 */
const req04: RequirementV0 = {
  id: 'dim4.req04',
  dimensionId: 'dim4',
  packageId: 'pkg.forma.profundidad',
  eje: 'completitud',
  pregunta:
    '¿Declara el set la profundidad de cada rol geométrico —su nivel, su orden de apilado y su oclusión—?',
  estado: 'active',
  dependsOn: ['dim4.req01'],
  payloadSchema: {
    profundidades: slot(
      lista(
        objeto({
          rol: slot(REF),
          nivel: slot(NUMERO),
          stacking: slot(TEXTO),
          oclusion: slot(TEXTO),
        }),
      ),
    ),
  },
  validityPredicate: [
    exists(p('profundidades')),
    each(p('profundidades'), exists(p('rol'))),
    each(p('profundidades'), exists(p('nivel'))),
    each(p('profundidades'), exists(p('stacking'))),
    each(p('profundidades'), exists(p('oclusion'))),
    eachIn(
      'dim4.req01',
      ['roles'],
      'r',
      some(p('profundidades'), 'pf', eq(op('pf', 'rol', 'nombre'), op('r', 'nombre'))),
    ),
  ],
  rectorBindings: [],
  mapsToKinds: [],
  mappingNotes:
    'BRECHA DECLARADA: ningún kind tiene z-index, orden de apilado ni oclusión. `backgroundPosition`/`backgroundSize` posicionan el fondo del elemento, no el nivel de profundidad del objeto, y `surface.shadow` (la única expresión de elevación que existe, req05) declara el efecto, no la relación de orden entre roles.',
};

/**
 * Política material. `permitido: bool` (PB2 de la pasada 2): la primitiva
 * booleana de la gramática (types.ts:91), con el precedente real
 * `sinValorPropio: slot(BOOL)` de manifest-v0-dim7.ts:429. Reemplaza el enum
 * `permitido|no-permitido`, que era un valor cerrado sin cita (tensión 13,
 * ahora cerrada): `exists` mide PRESENCIA, no verdad, así que `permitido: false`
 * declara política y pasa (predicate.ts:722-737).
 *
 * Nota de la spec §4 tensión 7: los degradados NO tienen slot en este payload
 * cerrado (no se ofrecen como valor, reglas del proyecto y D12).
 */
const req05: RequirementV0 = {
  id: 'dim4.req05',
  dimensionId: 'dim4',
  packageId: 'pkg.forma.materiales',
  eje: 'completitud',
  pregunta:
    '¿Declara el set su política sobre sombra, luz, transparencia y mezcla (permitida o no, y dónde)?',
  estado: 'active',
  dependsOn: ['dim4.req04'],
  payloadSchema: {
    materiales: slot(
      lista(
        objeto({
          efecto: slot(enumOf(...EFECTOS_4)),
          permitido: slot(BOOL),
          alcance: slot(TEXTO),
        }),
      ),
    ),
  },
  validityPredicate: [
    exists(p('materiales')),
    covers(
      p('materiales'),
      ['efecto'],
      EFECTOS_4.map((efecto) => str(efecto)),
    ),
    each(p('materiales'), exists(p('permitido'))),
    each(p('materiales'), exists(p('alcance'))),
  ],
  rectorBindings: [],
  mapsToKinds: [
    {
      kind: 'surface',
      valueNotes:
        'shadow none|sm|md|lg es la única expresión real de la sombra y overlayOpacity cubre parte de la transparencia; "luz" y "mezcla" (blend) NO tienen campo en ningún kind de los 14 — brecha parcial declarada.',
    },
  ],
};

/** `aplicaA` cierra la pregunta "y a qué aplican" (hallazgo 7). */
const req06: RequirementV0 = {
  id: 'dim4.req06',
  dimensionId: 'dim4',
  packageId: 'pkg.forma.mascaras',
  eje: 'completitud',
  pregunta: '¿Declara el set sus proporciones, máscaras y recortes, y a qué aplican?',
  estado: 'active',
  dependsOn: ['dim4.req01'],
  payloadSchema: {
    recortes: slot(
      lista(
        objeto({
          nombre: slot(TEXTO),
          mascara: slot(enumOf(...MASCARAS_4)),
          proporcion: slot(TEXTO),
          aplicaA: slot(TEXTO),
        }),
      ),
    ),
  },
  validityPredicate: [
    exists(p('recortes')),
    each(p('recortes'), exists(p('nombre'))),
    each(p('recortes'), exists(p('mascara'))),
    each(p('recortes'), exists(p('proporcion'))),
    each(p('recortes'), exists(p('aplicaA'))),
  ],
  rectorBindings: [],
  mapsToKinds: [
    {
      kind: 'shape',
      valueNotes:
        'mask none|rounded|circle|arch es el único campo real de recorte; la PROPORCIÓN no vive acá — la relación de aspecto es campo de media (dim5), no se proyecta desde esta dimensión.',
    },
  ],
};

/**
 * Excepciones. Eje `completitud` (hallazgo 5, pasada 1), fail-closed por
 * presencia obligatoria del mecanismo (hallazgo 3, pasada 1) y vía de ausencia
 * explícita (PM5, pasada 2): `sinExcepciones: opt(texto)` al nivel superior y
 * `or(and(exists(separaciones), each(rol), each(mecanismoSeparacion)),
 * exists(sinExcepciones))`. Con el fail-closed de `each` sobre lista vacía
 * (predicate.ts:629-634), la lista vacía silenciosa no pasa: o hay entradas
 * completas, o está la frase que declara que no hay excepciones. Mismo patrón
 * que `sinAmplitud` en manifest-v0-dim8.ts.
 */
const req07: RequirementV0 = {
  id: 'dim4.req07',
  dimensionId: 'dim4',
  packageId: 'pkg.forma.excepciones',
  eje: 'completitud',
  pregunta:
    'Cuando un rol se declara plano, sin sombra o sin efectos, ¿declara el set cómo se expresa entonces la separación?',
  estado: 'active',
  dependsOn: ['dim4.req01', 'dim4.req05'],
  payloadSchema: {
    // Opcional (PM5): si el set declara `sinExcepciones`, no hay lista que escribir.
    separaciones: opt(
      lista(
        objeto({
          rol: slot(REF),
          caso: opt(enumOf(...CASOS_3)),
          mecanismoSeparacion: slot(TEXTO),
        }),
      ),
    ),
    sinExcepciones: opt(TEXTO),
  },
  validityPredicate: [
    or(
      and(
        exists(p('separaciones')),
        each(p('separaciones'), exists(p('rol'))),
        each(p('separaciones'), exists(p('mecanismoSeparacion'))),
      ),
      exists(p('sinExcepciones')),
    ),
  ],
  rectorBindings: [],
  mapsToKinds: [],
  mappingNotes:
    'BRECHA DECLARADA: el mecanismo alternativo de separación no es un valor del compilador — es una DECISIÓN que se materializa con los filetes de req03 o la superficie de req05. El compilador no tiene kind de "mecanismo de separación"; mismo tipo de brecha que dim6.req01 (composición vive en el DesignSet).',
};

const req08: RequirementV0 = {
  id: 'dim4.req08',
  dimensionId: 'dim4',
  packageId: 'pkg.forma.adaptacion',
  eje: 'ciclo-de-vida',
  pregunta:
    '¿Declara el set cómo se adaptan sus formas, bordes y profundidades entre contextos, o la decisión explícita de que no cambian?',
  estado: 'active',
  dependsOn: ['dim4.req01'],
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
  validityPredicate: [
    exists(p('adaptaciones')),
    each(p('adaptaciones'), exists(p('contexto'))),
    each(p('adaptaciones'), exists(p('ajuste'))),
  ],
  rectorBindings: [],
  mapsToKinds: [],
  mappingNotes:
    'BRECHA DECLARADA, mismo tipo que `dim2.req06`/`dim3.req06`/`dim6.req07`: campo transversal; los breakpoints y estados viven en el `scope` del envelope (C2), no en un kind. "Sin adaptación declarada" es válido sólo si se explicita como decisión, nunca como lista vacía.',
};

export const DIM4_REQUIREMENTS_V0: readonly RequirementV0[] = [
  req01,
  req02,
  req03,
  req04,
  req05,
  req06,
  req07,
  req08,
];

export const DIM4_MANIFEST_V0: RequirementManifestV0 = {
  schemaVersion: 1,
  manifestVersion: '1.0',
  revision: 1,
  requirements: [...DIM4_REQUIREMENTS_V0],
};
