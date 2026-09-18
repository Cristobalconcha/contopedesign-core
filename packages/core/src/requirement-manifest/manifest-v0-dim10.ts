/**
 * Manifiesto v0 de la Dimensión 10 — Salida física (materialidad, acabado,
 * terminaciones, encuadernación)
 * (spec-c1-dim10-salida-fisica-2026-09-18.md §2/§3, decisiones 25 y 26 del vault).
 *
 * Cinco requisitos, todos de payload en texto: la salida física no cabe en una
 * primitiva (un sistema de encuadernación «libro de 48 páginas en pliegos de 8
 * con corchete y hotmelt» abarca demasiadas cosas indefinidas), así que la
 * definición PASA COMO PROMPT y la ejecuta el destino (InDesign, la imprenta),
 * que la guarda en su memoria propia (la cápsula, DESIGN.md). No la valida un
 * predicado: la lee la IA en la armonización y la confirma quien la ejecuta
 * (`verified`, dim10.req05).
 *
 * Forma «por declaración» (ARQUITECTURA.md, paso 3): texto + qué acota (sobre
 * qué dimensiones manda) + quién la ejecuta. Alfa cero: se parte con este set
 * de preguntas y se amplía cuando haga falta.
 *
 * CERO PROSA: cada validityPredicate es AST puro serializable, igual que
 * manifest-v0-dim1.ts … manifest-v0-dim9.ts. El predicado común es
 * `or(and(exists(declaracion), exists(ejecuta)), exists(noAplica))`: verdad
 * vacía cerrada — sin declaración ejecutable ni «no aplica» escrito, no resuelto.
 *
 * DimensionId del documento: `dim10`; nombre de la dimensión: «Salida física».
 * Este manifiesto es la primera dimensión fuera del patrón
 * `^dim[1-9]\.req[0-9]{2}$` (pasa a `^dim(?:[1-9]|10)\.req[0-9]{2}$` — cambio
 * MAYOR de formato de ids que aplica el integrador, no esta implementación).
 *
 * Regla «sistema, no pieza» (decisión 19): cada pregunta habla de lo que el
 * sistema soporta o exige, nunca de «la pieza». Regla de «no aplica» escrito
 * (decisión 15): un sistema que no tiene salida física (sólo pantalla) lo dice,
 * no lo deja vacío — por eso los campos de la forma común son OPCIONALES en el
 * schema: el validador de payload corre ANTES que el predicado (payload.ts:96-97)
 * y un payload `{ noAplica }` debe poder validar (misma lección que dim9 hallazgo 1);
 * el predicado común, no el schema, cierra la verdad vacía.
 *
 * `acota` es texto, no `ref`: una referencia a otra dimensión no se valida en
 * C1 (MAPA.md, trampas); se acepta como texto y lo cruza la armonización. Sin
 * umbrales ni valores cerrados: ninguna fuente cita un gramaje o un acabado
 * obligatorio; lo que no tiene cita no es regla (decisión 17).
 */
import type { PathSegment, PredicateClause } from './predicate.js';
import type { PayloadFieldSchema, PayloadType, RequirementManifestV0, RequirementV0 } from './types.js';

// ---------------------------------------------------------------------------
// Constructores de AST (mismo patrón que manifest-v0-dim1.ts … manifest-v0-dim9.ts)
// ---------------------------------------------------------------------------

const p = (...parts: PathSegment[]): readonly PathSegment[] => parts;

const exists = (target: readonly PathSegment[]): PredicateClause => ({ kind: 'exists', target });
const or = (...clauses: PredicateClause[]): PredicateClause => ({ kind: 'or', clauses });
const and = (...clauses: PredicateClause[]): PredicateClause => ({ kind: 'and', clauses });
const verified = (pruebaId: string): PredicateClause => ({ kind: 'verified', pruebaId });

// Constructores del payloadSchema
const TEXTO: PayloadType = { kind: 'texto' };
const enumOf = (...values: string[]): PayloadType => ({ kind: 'enum', values });
const lista = (of: PayloadType): PayloadType => ({ kind: 'lista', of });
const opt = (type: PayloadType): PayloadFieldSchema => ({ type, optional: true });

// ---------------------------------------------------------------------------
// Constantes cerradas de la dimensión (spec §2: el enum de quién ejecuta)
// ---------------------------------------------------------------------------

const EJECUTORES_10 = ['destino', 'proveedor', 'disenador'] as const;

/** Nombre de la dimensión (el tipo del documento no lo lleva: viaja en el código). */
export const DIM10_DIMENSION_NAME: string = 'Salida física';

/** Nota de brecha idéntica en las cinco: la salida física viaja en prosa. */
const BRECHA_DECLARADA =
  'BRECHA DECLARADA: la salida física no tiene kind en el DesignRuleSet; viaja en prosa por DESIGN.md y la ejecuta el destino';

// ---------------------------------------------------------------------------
// Forma común de una declaración (spec §2): declaración + qué acota + quién la
// ejecuta, o «no aplica» escrito. Todos los campos opcionales a propósito: el
// predicado común, no el schema, cierra la verdad vacía (payload.ts:96-97).
// ---------------------------------------------------------------------------

const formaDeclaracion = (): Record<string, PayloadFieldSchema> => ({
  declaracion: opt(TEXTO),
  acota: opt(lista(TEXTO)),
  ejecuta: opt(enumOf(...EJECUTORES_10)),
  noAplica: opt(TEXTO),
});

const predicadoComun = (): readonly PredicateClause[] => [
  or(and(exists(p('declaracion')), exists(p('ejecuta'))), exists(p('noAplica'))),
];

// ---------------------------------------------------------------------------
// Los cinco requisitos (spec §3)
// ---------------------------------------------------------------------------

const req01: RequirementV0 = {
  id: 'dim10.req01',
  dimensionId: 'dim10',
  packageId: 'pkg.salida.materialidad',
  eje: 'completitud',
  pregunta:
    '¿Qué soportes y materiales exige el sistema (papel, gramaje, sustrato, tela, vinilo), o declara que no tiene salida física?',
  estado: 'active',
  dependsOn: [],
  payloadSchema: formaDeclaracion(),
  validityPredicate: predicadoComun(),
  rectorBindings: [],
  mapsToKinds: [],
  mappingNotes: BRECHA_DECLARADA,
};

const req02: RequirementV0 = {
  id: 'dim10.req02',
  dimensionId: 'dim10',
  packageId: 'pkg.salida.acabado',
  eje: 'completitud',
  pregunta:
    '¿Qué acabados de superficie exige el sistema (laminado, barniz, reserva UV, estampado, relieve), o «no aplica» escrito?',
  estado: 'active',
  dependsOn: ['dim10.req01'],
  payloadSchema: formaDeclaracion(),
  validityPredicate: predicadoComun(),
  rectorBindings: [],
  mapsToKinds: [],
  mappingNotes: BRECHA_DECLARADA,
};

const req03: RequirementV0 = {
  id: 'dim10.req03',
  dimensionId: 'dim10',
  packageId: 'pkg.salida.terminaciones',
  eje: 'completitud',
  pregunta:
    '¿Qué terminaciones exige el sistema (troquel, corte, plegado especial, perforado, numerado), o «no aplica» escrito?',
  estado: 'active',
  dependsOn: ['dim10.req01'],
  payloadSchema: formaDeclaracion(),
  validityPredicate: predicadoComun(),
  rectorBindings: [],
  mapsToKinds: [],
  mappingNotes: BRECHA_DECLARADA,
};

const req04: RequirementV0 = {
  id: 'dim10.req04',
  dimensionId: 'dim10',
  packageId: 'pkg.salida.encuadernacion',
  eje: 'completitud',
  pregunta:
    '¿Qué sistema de encuadernación o armado exige el sistema (pliegos, corchete, hotmelt, cosido, espiral, anillado), o «no aplica» escrito?',
  estado: 'active',
  dependsOn: ['dim10.req01'],
  payloadSchema: formaDeclaracion(),
  validityPredicate: predicadoComun(),
  rectorBindings: [],
  mapsToKinds: [],
  mappingNotes: BRECHA_DECLARADA,
};

const req05: RequirementV0 = {
  id: 'dim10.req05',
  dimensionId: 'dim10',
  packageId: 'pkg.salida.confirmacion',
  eje: 'validez',
  pregunta:
    '¿Quien ejecuta la salida física confirmó que las declaraciones son realizables tal como están escritas?',
  estado: 'active',
  dependsOn: ['dim10.req01', 'dim10.req02', 'dim10.req03', 'dim10.req04'],
  payloadSchema: {
    confirmadoPor: opt(TEXTO),
    nota: opt(TEXTO),
  },
  validityPredicate: [verified('salida-fisica-confirmada')],
  rectorBindings: [],
  mapsToKinds: [],
  mappingNotes: BRECHA_DECLARADA,
};

export const DIM10_REQUIREMENTS_V0: readonly RequirementV0[] = [
  req01,
  req02,
  req03,
  req04,
  req05,
];

// 1.0 / rev 1 — la dimensión nace completa con sus cinco preguntas (alfa cero).
// dimensionId: 'dim10'; nombre: «Salida física» (DIM10_DIMENSION_NAME).
export const DIM10_MANIFEST_V0: RequirementManifestV0 = {
  schemaVersion: 1,
  manifestVersion: '1.0',
  revision: 1,
  requirements: [...DIM10_REQUIREMENTS_V0],
};
