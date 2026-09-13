/**
 * Manifiesto v0 de la Dimensión 5 — Imagen y lenguaje gráfico
 * (spec-c1-dim5-imagen-manifest-2026-08-31.md §2, 3 pasadas adversariales
 * aplicadas antes de esta implementación — 2, 4 y 0 bloqueantes).
 *
 * Los ocho requisitos de §2 fielmente (IDs, ejes, dependsOn, payloadSchemas,
 * mapsToKinds — incluidas las brechas DECLARADAS en mappingNotes).
 *
 * Primera dimensión donde `derivation.of` enlaza con una RECTORA
 * ('mood-wall') en vez de con otro requisito (dim5.req01) — extensión de
 * USO del patrón ya establecido en dim1.req02/dim2.req02, no de la
 * gramática (spec §4, tensión 1).
 *
 * CERO PROSA: cada validityPredicate es AST puro serializable, igual que
 * manifest-v0-dim1.ts/dim2.ts/dim3.ts.
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
// Constructores de AST (mismo patrón que manifest-v0-dim1.ts/dim2.ts/dim3.ts)
// ---------------------------------------------------------------------------

const p = (...parts: PathSegment[]): readonly PathSegment[] => parts;
const op = (...parts: PathSegment[]): Operand => ({ kind: 'path', path: parts });

const str = (value: string): ScalarLiteral => ({ kind: 'string', value });

const eq = (left: Operand, right: Operand): PredicateClause => ({ kind: 'compare', op: '==', left, right });

const exists = (target: readonly PathSegment[]): PredicateClause => ({ kind: 'exists', target });
const each = (target: readonly PathSegment[], condition: PredicateClause): PredicateClause => ({
  kind: 'each',
  target,
  condition,
});
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
const TEXTO: PayloadType = { kind: 'texto' };
const refTo = (reqId: string): PayloadType => ({ kind: 'ref', reqId });
const enumOf = (...values: string[]): PayloadType => ({ kind: 'enum', values });
const lista = (of: PayloadType): PayloadType => ({ kind: 'lista', of });
const objeto = (fields: Record<string, PayloadFieldSchema>): PayloadType => ({ kind: 'objeto', fields });
const slot = (type: PayloadType, optional = false): PayloadFieldSchema =>
  optional ? { type, optional: true } : { type };
const opt = (type: PayloadType): PayloadFieldSchema => ({ type, optional: true });

// ---------------------------------------------------------------------------
// Constantes cerradas de la dimensión (spec §2, tensión 2: cerrados por analogía)
// ---------------------------------------------------------------------------

const MEDIA_ROLES_5 = ['fotografia', 'ilustracion', 'iconografia', 'simbolos', 'marcas'] as const;

// ---------------------------------------------------------------------------
// Los ocho requisitos
// ---------------------------------------------------------------------------

const req01: RequirementV0 = {
  id: 'dim5.req01',
  dimensionId: 'dim5',
  packageId: 'pkg.imagen.fundamento',
  eje: 'completitud',
  pregunta:
    '¿Declara el sistema una dirección visual para la imagen, enlazada explícitamente al mood wall (no solo "inspirada" en él)?',
  estado: 'active',
  dependsOn: [],
  payloadSchema: {
    direccion: slot(
      objeto({
        resumen: slot(TEXTO),
        derivation: slot(
          objeto({
            of: slot(enumOf('mood-wall', 'direct')),
            rule: opt(TEXTO),
          }),
        ),
      }),
    ),
  },
  validityPredicate: [
    exists(p('direccion', 'resumen')),
    or(
      eq(op('direccion', 'derivation', 'of'), str('mood-wall')),
      exists(p('direccion', 'derivation', 'rule')),
    ),
    noConflict('descriptor'),
    noConflict('mood-wall'),
  ],
  rectorBindings: ['descriptor', 'mood-wall'],
  mapsToKinds: [],
  mappingNotes:
    'la dirección visual es el fundamento narrativo, no una regla del compilador — se proyecta indirectamente vía los roles concretos de dim5.req02. Mismo tratamiento que dim1.req01/dim2.req01/dim3.req01.',
};

const req02: RequirementV0 = {
  id: 'dim5.req02',
  dimensionId: 'dim5',
  packageId: 'pkg.imagen.roles',
  eje: 'completitud',
  pregunta:
    '¿Están mapeados con tratamiento efectivo los cinco roles de medios visuales que declara la taxonomía (fotografía, ilustración, iconografía, símbolos, marcas)?',
  estado: 'active',
  dependsOn: ['dim5.req01'],
  payloadSchema: {
    roleMedia: slot(
      lista(
        objeto({
          role: slot(enumOf(...MEDIA_ROLES_5)),
          tratamiento: slot(TEXTO),
          aspectRatio: opt(TEXTO),
          fit: opt(enumOf('cover', 'contain', 'fill')),
          source: slot(TEXTO),
          derivation: slot(
            objeto({
              of: slot(enumOf('dim5.req01', 'direct')),
              rule: opt(TEXTO),
            }),
          ),
        }),
      ),
    ),
  },
  validityPredicate: [
    covers(
      p('roleMedia'),
      ['role'],
      MEDIA_ROLES_5.map((role) => str(role)),
    ),
    each(p('roleMedia'), exists(p('tratamiento'))),
    each(
      p('roleMedia'),
      or(eq(op('derivation', 'of'), str('dim5.req01')), exists(p('derivation', 'rule'))),
    ),
    noConflict('mood-wall'),
  ],
  rectorBindings: ['mood-wall'],
  mapsToKinds: [
    {
      kind: 'media',
      valueNotes:
        'aspectRatio/fit aplicación directa cuando están declarados (D3 §2) — opcionales en el payload porque no todo rol (ej. marcas) necesariamente fija proporción; tratamiento (texto libre) sin campo directo, gap parcial',
    },
  ],
};

const req03: RequirementV0 = {
  id: 'dim5.req03',
  dimensionId: 'dim5',
  packageId: 'pkg.imagen.seleccion',
  eje: 'completitud',
  pregunta: '¿Declara el sistema sus cinco criterios de selección de medios (tema, autenticidad, diversidad, procedencia, calidad)?',
  estado: 'active',
  dependsOn: ['dim5.req02'],
  payloadSchema: {
    criterios: slot(
      objeto({
        tema: slot(TEXTO),
        autenticidad: slot(TEXTO),
        diversidad: slot(TEXTO),
        procedencia: slot(TEXTO),
        calidad: slot(TEXTO),
      }),
    ),
  },
  validityPredicate: [
    exists(p('criterios', 'tema')),
    exists(p('criterios', 'autenticidad')),
    exists(p('criterios', 'diversidad')),
    exists(p('criterios', 'procedencia')),
    exists(p('criterios', 'calidad')),
  ],
  rectorBindings: [],
  mapsToKinds: [],
  mappingNotes:
    'BRECHA DECLARADA: los criterios de selección son curatoriales (guían qué imagen se elige antes de publicarla), no hay kind del designRuleSet para "criterio de selección" — no hay nada que proyectar porque no describen una regla del compilador, describen un proceso editorial previo.',
};

const req04: RequirementV0 = {
  id: 'dim5.req04',
  dimensionId: 'dim5',
  packageId: 'pkg.imagen.encuadre',
  eje: 'completitud',
  pregunta: '¿Tiene el sistema reglas efectivas de encuadre (proporción, punto focal, relación imagen-texto) para al menos un contexto de uso?',
  estado: 'active',
  dependsOn: ['dim5.req02'],
  payloadSchema: {
    encuadres: slot(
      lista(
        objeto({
          contexto: slot(TEXTO),
          role: slot(refTo('dim5.req02')),
          aspectRatio: slot(TEXTO),
          focalPoint: slot(TEXTO),
          relacionTexto: slot(TEXTO),
        }),
      ),
    ),
  },
  validityPredicate: [
    exists(p('encuadres')),
    each(p('encuadres'), reference(p('role'), 'dim5.req02')),
    each(p('encuadres'), exists(p('aspectRatio'))),
    each(p('encuadres'), exists(p('focalPoint'))),
    noConflict('mood-wall'),
  ],
  rectorBindings: ['mood-wall'],
  mapsToKinds: [
    {
      kind: 'media',
      valueNotes: 'aspectRatio/position (punto focal) aplicación directa (D3 §2); relacionTexto sin campo directo, gap parcial',
    },
  ],
};

const req05: RequirementV0 = {
  id: 'dim5.req05',
  dimensionId: 'dim5',
  packageId: 'pkg.imagen.tratamiento',
  eje: 'completitud',
  pregunta:
    '¿Declara el sistema un tratamiento tonal/cromático consistente (o la decisión explícita de no aplicar ninguno) para sus medios visuales?',
  estado: 'active',
  dependsOn: ['dim5.req02'],
  payloadSchema: {
    tratamientos: slot(
      lista(
        objeto({
          role: slot(refTo('dim5.req02')),
          ajuste: slot(TEXTO),
        }),
      ),
    ),
  },
  validityPredicate: [exists(p('tratamientos')), each(p('tratamientos'), reference(p('role'), 'dim5.req02'))],
  rectorBindings: [],
  mapsToKinds: [],
  mappingNotes:
    'BRECHA DECLARADA: el designRuleSet no tiene kind de tratamiento tonal/grano/corrección — es metadato de producción del asset (se resuelve antes de que la imagen entre al sistema), no una regla que el compilador aplique en vivo.',
};

const req06: RequirementV0 = {
  id: 'dim5.req06',
  dimensionId: 'dim5',
  packageId: 'pkg.imagen.overlays',
  eje: 'coherencia',
  pregunta: '¿Declara el sistema sus overlays, filtros y reglas de mezcla permitidos sobre medios visuales, con exclusiones explícitas?',
  estado: 'active',
  dependsOn: ['dim5.req02'],
  payloadSchema: {
    overlays: slot(
      objeto({
        allowed: slot(lista(TEXTO)),
        prohibited: slot(lista(TEXTO)),
      }),
    ),
  },
  validityPredicate: [
    exists(p('overlays', 'allowed')),
    exists(p('overlays', 'prohibited')),
    everyDef(
      'dim5',
      'defReq',
      'defPayload',
      containsNoneOf(p('defPayload'), p('overlays', 'prohibited')),
    ),
  ],
  rectorBindings: [],
  mapsToKinds: [],
  mappingNotes:
    'BRECHA DECLARADA: este payload (allowed/prohibited, solo nombres) no tiene ningún valor numérico ni dato de instancia que proyectar — a diferencia de dim1.req08.relations.overlays ([{color, opacity}], con datos reales por instancia), acá no hay nada concreto que volcar a un campo del compilador. Es gobernanza/exclusión pura, mismo tipo que la mitad allowed/prohibited de dim1.req08, no la mitad overlays que sí proyecta.',
};

const req07: RequirementV0 = {
  id: 'dim5.req07',
  dimensionId: 'dim5',
  packageId: 'pkg.imagen.grafica',
  eje: 'completitud',
  pregunta: '¿Declara el sistema su gramática de ilustración/iconografía (forma, trazo, escala, semántica) de forma consistente?',
  estado: 'active',
  dependsOn: ['dim5.req02'],
  payloadSchema: {
    gramatica: slot(
      objeto({
        forma: slot(TEXTO),
        trazo: slot(TEXTO),
        escala: slot(TEXTO),
        semantica: slot(TEXTO),
      }),
    ),
  },
  validityPredicate: [
    exists(p('gramatica', 'forma')),
    exists(p('gramatica', 'trazo')),
    exists(p('gramatica', 'escala')),
    exists(p('gramatica', 'semantica')),
  ],
  rectorBindings: [],
  mapsToKinds: [],
  mappingNotes:
    'BRECHA DECLARADA: el designRuleSet no tiene kind de gramática de ilustración — vive en el DesignSet (C2) como restricción de coherencia editorial, no como regla emitida. Mismo tipo que dim3.req03 (ritmo).',
};

const req08: RequirementV0 = {
  id: 'dim5.req08',
  dimensionId: 'dim5',
  packageId: 'pkg.imagen.marca',
  eje: 'coherencia',
  pregunta: '¿Están declarados los usos permitidos y prohibidos de marca, con exclusiones vinculantes para el resto de definiciones de la dimensión?',
  estado: 'active',
  dependsOn: ['dim5.req02'],
  payloadSchema: {
    marca: slot(
      objeto({
        allowed: slot(lista(TEXTO)),
        prohibited: slot(lista(TEXTO)),
        ausenciaDeliberada: opt(TEXTO),
      }),
    ),
  },
  validityPredicate: [
    exists(p('marca', 'allowed')),
    exists(p('marca', 'prohibited')),
    everyDef('dim5', 'defReq', 'defPayload', containsNoneOf(p('defPayload'), p('marca', 'prohibited'))),
    noConflict('mood-wall'),
  ],
  rectorBindings: ['mood-wall'],
  mapsToKinds: [],
  mappingNotes:
    'BRECHA DECLARADA: el designRuleSet no tiene kind de reglas de marca — vive en el DesignSet (C2) como restricción transversal de la dimensión, mismo tratamiento que dim1.req08.',
};

export const DIM5_REQUIREMENTS_V0: readonly RequirementV0[] = [
  req01,
  req02,
  req03,
  req04,
  req05,
  req06,
  req07,
  req08,
];

export const DIM5_MANIFEST_V0: RequirementManifestV0 = {
  schemaVersion: 1,
  manifestVersion: '1.0',
  revision: 1,
  requirements: [...DIM5_REQUIREMENTS_V0],
};
