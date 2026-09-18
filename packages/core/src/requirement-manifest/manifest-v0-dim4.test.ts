/**
 * Prueba del manifiesto v0 de la Dimensión 4 — Forma, borde y profundidad.
 *
 * Aplica y verifica las PASADAS ADVERSARIALES 1 (4 bloqueantes + 5 menores) y
 * 2 (3 bloqueantes + 3 menores):
 *   - HB1: color de filete = unión (`ref` a la paleta del sistema | `color-css`).
 *   - HB2: cada estilo de borde declara sus `roles`.
 *   - HB3: `mecanismoSeparacion` obligatorio (fail-closed).
 *   - HB4: `politica` era decisión declarada (cerrada en la pasada 2).
 *   - HM5: req07 en `completitud`.
 *   - HM6: cruce rol↔definición con eachIn en req02 y req04.
 *   - HM7: `aplicaA` en req06.
 *   - PB1: `tipo` de filete = enum real del compilador (`none|solid|dashed`).
 *   - PB2: `permitido: bool` (fuera el enum permitido|no-permitido).
 *   - PB3: req03 cruza sus `roles` contra los roles reales de req01.
 *   - PM4: mappingNotes de req03 (existencia del destino, no navegación del refPath).
 *   - PM5: `sinExcepciones` como vía de ausencia de req07.
 *   - PM6: mappingNotes de req04 (`backgroundPosition`/`backgroundSize`).
 *
 * Los campos del payloadSchema se leen con CORCHETES (`fields['color']`), nunca
 * con punto: el tipo es un índice (regla TS4111 del repo).
 */
import { describe, expect, it } from 'vitest';
import { evaluateManifest } from './evaluate';
import { parseRequirementManifest } from './graph';
import { DIM4_MANIFEST_V0, DIM4_REQUIREMENTS_V0 } from './manifest-v0-dim4';
import type { PredicateClause } from './predicate';
import { RULE_KINDS } from './types';
import type { RectoraV0, RequirementV0 } from './types';

const emptyRectoras = (): Map<string, RectoraV0> =>
  new Map<string, RectoraV0>([
    ['descriptor', { id: 'descriptor', tagsRequeridos: [], tagsProhibidos: [], exclusiones: [] }],
    ['mood-wall', { id: 'mood-wall', tagsRequeridos: [], tagsProhibidos: [], exclusiones: [] }],
  ]);

const reqDe = (id: string): RequirementV0 => {
  const found = DIM4_REQUIREMENTS_V0.find((r) => r.id === id);
  if (found === undefined) throw new Error(`requisito ausente en DIM4: ${id}`);
  return found;
};

/** Valor `ref` real: `refPath` navega el payload resuelto de `refReqId` (types.ts). */
const refA = (refReqId: string, refPath: ReadonlyArray<string | number>) => ({ refReqId, refPath });

/**
 * Rol n-ésimo declarado por dim4.req01.
 *
 * CONVENCIÓN (spec §3 req02/req03/req04, hallazgos 6 y 3): el `refPath` de
 * `rol`/`roles` apunta a la ENTRADA COMPLETA de `req01.roles` — ['roles', n] —,
 * no al campo `nombre`; por eso las cláusulas de cruce navegan `rol.nombre`
 * DENTRO de la ref resuelta.
 */
const rolDe = (indice: number) => refA('dim4.req01', ['roles', indice]);

/**
 * Color de filete por REFERENCIA a la paleta del sistema (dim1.req02). La rama
 * ref se verifica en C2, no en C1; acá vive para que el payload lea como un set
 * real y para probar la unión.
 */
const colorDePaleta = () => refA('dim1.req02', ['paleta', 0, 'color']);

/** Color de filete LITERAL: la otra rama de la unión (`color-css`). */
const HEX_DE_FILETE = '#8a8a8a';

// ---------------------------------------------------------------------------
// Acceso a la forma del schema (siempre con corchetes: el tipo es un índice)
// ---------------------------------------------------------------------------

type SchemaNode = {
  kind: string;
  of?: unknown;
  fields?: Record<string, { type: SchemaNode; optional?: boolean }>;
  values?: readonly string[];
  reqId?: string;
};

/** `payloadSchema[campo].type` — corchetes obligatorios (TS4111). */
const tipoDeCampo = (req: RequirementV0, campo: string): SchemaNode =>
  (req.payloadSchema[campo] as unknown as { type: SchemaNode }).type;

/** `of` de una `lista(...)`. */
const itemDe = (nodo: SchemaNode): SchemaNode => nodo.of as SchemaNode;

/** Recorre el AST de un predicado y junta los `kind` de sus cláusulas. */
function collectKinds(clause: PredicateClause, out: string[]): void {
  out.push(clause.kind);
  switch (clause.kind) {
    case 'and':
    case 'or':
      clause.clauses.forEach((c) => collectKinds(c, out));
      return;
    case 'not':
      collectKinds(clause.clause, out);
      return;
    case 'each':
    case 'some':
    case 'everyPar':
    case 'eachIn':
    case 'someIn':
    case 'everyDef':
      collectKinds(clause.condition, out);
      return;
    default:
      return;
  }
}

/** Payloads que resuelven las ocho preguntas de la dimensión (fixture de test). */
function resolvedDim4Payloads(): Map<string, unknown> {
  const m = new Map<string, unknown>();

  // La paleta del sistema, referida por dim4.req03 (el color no se reinventa
  // acá). El store de C1 sólo tiene los activos del manifiesto, así que esta
  // entrada no participa de la evaluación: la usa la rama ref de la unión, que
  // se resuelve en C2.
  m.set('dim1.req02', { paleta: [{ rol: 'borde', color: HEX_DE_FILETE }] });

  m.set('dim4.req01', {
    roles: [
      { nombre: 'superficie', descripcion: 'plano base donde se apoya el contenido' },
      { nombre: 'contenedor', descripcion: 'caja que agrupa contenido relacionado y lo separa del fondo' },
      { nombre: 'accion', descripcion: 'objeto apretable que dispara la acción principal' },
      { nombre: 'separador', descripcion: 'filete de un solo trazo que divide dos secciones' },
    ],
  });

  // Cubre los CUATRO roles de req01 (HM6: el cruce eachIn lo exige).
  m.set('dim4.req02', {
    formas: [
      { rol: rolDe(0), vocabulario: 'rectángulo de esquinas duras, sin radio', radio: 'none' },
      {
        rol: rolDe(1),
        vocabulario: 'rectángulo de esquina suave, igual en las cuatro esquinas',
        radio: 'longitud',
        radioValor: '8px',
      },
      { rol: rolDe(2), vocabulario: 'rectángulo redondeado, casi pastilla', radio: 'pill' },
      { rol: rolDe(3), vocabulario: 'trazo recto, sin esquinas ni radio', radio: 'none' },
    ],
  });

  // PB1: los tipos reales del compilador son `none|solid|dashed`. PB3: cada
  // `roles` apunta a un rol REAL de req01.
  m.set('dim4.req03', {
    estilosDeBorde: [
      {
        nombre: 'borde-sutil',
        roles: [rolDe(1)],
        filetes: [
          {
            grosor: '1px',
            tipo: 'solid',
            color: colorDePaleta(), // rama ref de la unión
            posicion: 'dentro del canto del contenedor',
          },
        ],
        limiteConocido: 'un solo filete continuo; no se apila con sombra',
      },
      {
        nombre: 'borde-enfasis',
        roles: [rolDe(2)],
        filetes: [
          {
            grosor: '2px',
            tipo: 'solid',
            color: HEX_DE_FILETE, // rama literal color-css de la unión
            posicion: 'por fuera del contenedor',
          },
        ],
        limiteConocido: 'no se combina con borde-sutil en el mismo objeto',
      },
      {
        nombre: 'borde-guia-doble',
        roles: [rolDe(1), rolDe(3)],
        filetes: [
          { grosor: '1px', tipo: 'dashed', color: colorDePaleta(), posicion: 'centrado en el canto inferior' },
          { grosor: '1px', tipo: 'solid', color: HEX_DE_FILETE, posicion: 'por fuera del contenedor' },
        ],
        limiteConocido: 'el destino web no puede dibujar dos filetes si uno es segmentado',
        degradacion: 'se cae a un único filete continuo de 1px conservando el color',
      },
    ],
  });

  // Cubre los CUATRO roles de req01 (HM6: el cruce eachIn lo exige).
  m.set('dim4.req04', {
    profundidades: [
      {
        rol: rolDe(0),
        nivel: 1,
        stacking: 'orden base del documento, sin z-index explícito',
        oclusion: 'puede quedar tapada por el contenedor y la acción',
      },
      {
        rol: rolDe(1),
        nivel: 2,
        stacking: 'sobre la superficie, bajo los objetos flotantes',
        oclusion: 'nunca tapa la acción',
      },
      {
        rol: rolDe(2),
        nivel: 3,
        stacking: 'sobre cualquier contenedor',
        oclusion: 'siempre visible, nunca tapada',
      },
      {
        rol: rolDe(3),
        nivel: 1,
        stacking: 'en el mismo plano que la superficie que separa',
        oclusion: 'no tapa nada; sólo divide',
      },
    ],
  });

  // PB2: `permitido` es booleano; `false` también declara política y pasa
  // (exists mide presencia, no verdad).
  m.set('dim4.req05', {
    materiales: [
      { efecto: 'sombra', permitido: true, alcance: 'sólo en contenedores y objetos flotantes; nunca en texto' },
      { efecto: 'luz', permitido: false, alcance: 'sin luz direccional en ninguna superficie del set' },
      {
        efecto: 'transparencia',
        permitido: true,
        alcance: 'sólo en overlays sobre medios y en estados deshabilitados',
      },
      { efecto: 'mezcla', permitido: false, alcance: 'sin modos de mezcla en ninguna superficie' },
    ],
  });

  m.set('dim4.req06', {
    recortes: [
      { nombre: 'retrato-circular', mascara: 'circle', proporcion: '1:1', aplicaA: 'foto de persona en tarjetas de perfil' },
      { nombre: 'tarjeta-redondeada', mascara: 'rounded', proporcion: '4:3', aplicaA: 'miniatura de contenido en grillas' },
      { nombre: 'portada-arco', mascara: 'arch', proporcion: '16:9', aplicaA: 'portada de sección destacada' },
      { nombre: 'fondo-completo', mascara: 'none', proporcion: 'cubre el contenedor completo', aplicaA: 'fondo de sección' },
    ],
  });

  m.set('dim4.req07', {
    separaciones: [
      {
        rol: rolDe(0),
        caso: 'sin-sombra',
        mecanismoSeparacion: 'filete de un solo trazo (estilo borde-sutil) sobre el canto',
      },
      {
        rol: rolDe(1),
        caso: 'plano',
        mecanismoSeparacion: 'separación por contraste de superficie y aire alrededor',
      },
      {
        // Sin `caso`: el rol no es plano. El mecanismo es OBLIGATORIO (HB3) y el
        // "no aplica" se escribe dentro de su texto, nunca como campo ausente.
        rol: rolDe(3),
        mecanismoSeparacion: 'no aplica: el separador no es un rol plano, ya es un filete de un solo trazo',
      },
    ],
  });

  m.set('dim4.req08', {
    adaptaciones: [
      {
        contexto: 'pantalla chica, hasta 480px',
        ajuste: 'los radios bajan a 4px y la sombra queda en su nivel más bajo',
      },
      { contexto: 'impreso', ajuste: 'sin adaptación declarada: el set no distingue impreso todavía' },
    ],
  });

  return m;
}

describe('manifiesto v0 de Dimensión 4 — fidelidad a la spec C1-dim4 §3', () => {
  it('el documento parsea limpio (grafo acíclico, IDs estables, sin brechas silenciosas)', () => {
    const result = parseRequirementManifest(DIM4_MANIFEST_V0);
    expect(result.ok).toBe(true);
  });

  it('contiene los ocho requisitos: dim4.req01..req08', () => {
    expect(DIM4_REQUIREMENTS_V0.map((r) => r.id)).toEqual([
      'dim4.req01',
      'dim4.req02',
      'dim4.req03',
      'dim4.req04',
      'dim4.req05',
      'dim4.req06',
      'dim4.req07',
      'dim4.req08',
    ]);
  });

  it('respeta dependsOn y ejes de la spec §3, y dependsOn sólo apunta a ids dim4.*', () => {
    const byId = new Map(DIM4_REQUIREMENTS_V0.map((r) => [r.id, r]));
    expect(byId.get('dim4.req01')?.dependsOn).toEqual([]);
    expect(byId.get('dim4.req01')?.eje).toBe('completitud');
    expect(byId.get('dim4.req04')?.eje).toBe('completitud');
    expect(byId.get('dim4.req05')?.eje).toBe('completitud');
    expect(byId.get('dim4.req06')?.eje).toBe('completitud');
    expect(byId.get('dim4.req02')?.eje).toBe('validez');
    expect(byId.get('dim4.req03')?.eje).toBe('validez');
    // HM5: req07 pasa de `validez` a `completitud` (sin compare ni validCss).
    expect(byId.get('dim4.req07')?.eje).toBe('completitud');
    expect(byId.get('dim4.req08')?.eje).toBe('ciclo-de-vida');
    for (const id of ['dim4.req02', 'dim4.req03', 'dim4.req04', 'dim4.req06', 'dim4.req08']) {
      expect(byId.get(id)?.dependsOn, id).toEqual(['dim4.req01']);
    }
    expect(byId.get('dim4.req05')?.dependsOn).toEqual(['dim4.req04']);
    expect(byId.get('dim4.req07')?.dependsOn).toEqual(['dim4.req01', 'dim4.req05']);
    for (const req of DIM4_REQUIREMENTS_V0) {
      for (const dep of req.dependsOn) expect(dep.startsWith('dim4.'), dep).toBe(true);
    }
  });

  it('los packageId son los de la spec §3', () => {
    const byId = new Map(DIM4_REQUIREMENTS_V0.map((r) => [r.id, r]));
    expect(byId.get('dim4.req01')?.packageId).toBe('pkg.forma.roles');
    expect(byId.get('dim4.req02')?.packageId).toBe('pkg.forma.vocabulario');
    expect(byId.get('dim4.req03')?.packageId).toBe('pkg.forma.borde');
    expect(byId.get('dim4.req04')?.packageId).toBe('pkg.forma.profundidad');
    expect(byId.get('dim4.req05')?.packageId).toBe('pkg.forma.materiales');
    expect(byId.get('dim4.req06')?.packageId).toBe('pkg.forma.mascaras');
    expect(byId.get('dim4.req07')?.packageId).toBe('pkg.forma.excepciones');
    expect(byId.get('dim4.req08')?.packageId).toBe('pkg.forma.adaptacion');
  });

  it('sin rectorBindings en ningún requisito: "forma" no está en los dominios del mood wall (spec §2)', () => {
    for (const req of DIM4_REQUIREMENTS_V0) {
      expect(req.rectorBindings, req.id).toEqual([]);
    }
  });

  it('brechas declaradas: mappingNotes no vacío en cada requisito con mapsToKinds vacío', () => {
    const brechas = DIM4_REQUIREMENTS_V0.filter((r) => r.mapsToKinds.length === 0);
    expect(brechas.map((r) => r.id)).toEqual([
      'dim4.req01',
      'dim4.req04',
      'dim4.req07',
      'dim4.req08',
    ]);
    for (const req of brechas) {
      expect(req.mappingNotes, req.id).toBeDefined();
      expect((req.mappingNotes ?? '').length, req.id).toBeGreaterThan(0);
    }
  });

  it('PM4 y PM6: las redacciones nuevas de la pasada 2 están en los mappingNotes', () => {
    expect(reqDe('dim4.req03').mappingNotes).toContain('findDanglingRefs');
    expect(reqDe('dim4.req03').mappingNotes).toContain('refPath');
    expect(reqDe('dim4.req04').mappingNotes).toContain('backgroundPosition');
    expect(reqDe('dim4.req04').mappingNotes).toContain('backgroundSize');
    expect(reqDe('dim4.req04').mappingNotes).not.toContain('surface.position');
  });

  it('las proyecciones parciales sólo usan kinds de los 14 RULE_KINDS, con valueNotes no vacío', () => {
    const kinds = new Set<string>(RULE_KINDS);
    for (const req of DIM4_REQUIREMENTS_V0) {
      for (const entry of req.mapsToKinds) {
        expect(kinds.has(entry.kind), `${req.id} → ${entry.kind}`).toBe(true);
        expect((entry.valueNotes ?? '').length, req.id).toBeGreaterThan(0);
      }
    }
    const conProyeccion = DIM4_REQUIREMENTS_V0.filter((r) => r.mapsToKinds.length > 0).map((r) => r.id);
    expect(conProyeccion).toEqual(['dim4.req02', 'dim4.req03', 'dim4.req05', 'dim4.req06']);
  });

  it('PB1: el tipo de filete es el enum REAL del compilador (none|solid|dashed) y vive en un `enum`', () => {
    const estilos = tipoDeCampo(reqDe('dim4.req03'), 'estilosDeBorde');
    expect(estilos.kind).toBe('lista');
    const estilo = itemDe(estilos);
    expect(estilo.kind).toBe('objeto');
    const filetes = estilo.fields!['filetes']!.type;
    expect(filetes.kind).toBe('lista');
    const filete = itemDe(filetes);
    expect(filete.kind).toBe('objeto');
    const tipo = filete.fields!['tipo']!.type;
    expect(tipo.kind).toBe('enum');
    expect(tipo.values).toEqual(['none', 'solid', 'dashed']);
    expect(tipo.values).not.toContain('macizo');
    expect(tipo.values).not.toContain('segmentado');
    expect(tipo.values).not.toContain('punteado');
  });

  it('PB1: el valueNotes de `shape` declara que «punteado» no tiene hogar en el compilador', () => {
    const req03 = reqDe('dim4.req03');
    const shape = req03.mapsToKinds.find((entry) => entry.kind === 'shape');
    expect(shape?.valueNotes).toContain('punteado');
    expect(shape?.valueNotes).toContain('solid|dashed|none');
  });

  it('HB1: el color del filete es una UNIÓN (ref | color-css), no un `ref` con validCss', () => {
    const estilos = tipoDeCampo(reqDe('dim4.req03'), 'estilosDeBorde');
    const filetes = itemDe(estilos).fields!['filetes']!.type;
    const color = itemDe(filetes).fields!['color']!.type;
    expect(color.kind).toBe('union');
    const ramas = color.of as readonly SchemaNode[];
    expect(ramas.length).toBe(2);
    expect(ramas[0]!.kind).toBe('ref');
    expect(ramas[0]!.reqId).toBe('dim1.req02');
    expect(ramas[1]!.kind).toBe('color-css');

    const kinds: string[] = [];
    for (const clause of reqDe('dim4.req03').validityPredicate) collectKinds(clause, kinds);
    expect(kinds).not.toContain('validCss');
  });

  it('PB2: `permitido` es `bool` (primitiva de la gramática), no el enum permitido|no-permitido', () => {
    const materiales = tipoDeCampo(reqDe('dim4.req05'), 'materiales');
    const material = itemDe(materiales);
    expect(material.kind).toBe('objeto');
    const permitido = material.fields!['permitido']!.type;
    expect(permitido.kind).toBe('bool');
    expect(permitido.values).toBeUndefined(); // no es un enum: no inventa lista cerrada
    expect(JSON.stringify(reqDe('dim4.req05').payloadSchema)).not.toContain('no-permitido');
  });

  it('PB3: req03 cruza sus `roles` contra los roles reales de req01 (not·some·not·someIn)', () => {
    const kinds: string[] = [];
    for (const clause of reqDe('dim4.req03').validityPredicate) collectKinds(clause, kinds);
    expect(kinds).toContain('someIn');
    expect(kinds).toContain('some');
    const serializado = JSON.stringify(reqDe('dim4.req03').validityPredicate);
    expect(serializado).toContain('"kind":"someIn","reqId":"dim4.req01"');
  });

  it('PM5: req07 declara `sinExcepciones` opcional y un predicado con or/and', () => {
    const sinExcepciones = reqDe('dim4.req07').payloadSchema['sinExcepciones'];
    expect(sinExcepciones?.optional).toBe(true);
    expect(sinExcepciones?.type.kind).toBe('texto');
    const kinds: string[] = [];
    for (const clause of reqDe('dim4.req07').validityPredicate) collectKinds(clause, kinds);
    expect(kinds).toContain('and');
    expect(kinds).toContain('or');
  });

  it('CERO PROSA: la serialización es el dato (round-trip JSON) y cada cláusula es del union conocido', () => {
    const roundTripped = JSON.parse(JSON.stringify(DIM4_MANIFEST_V0));
    expect(roundTripped).toEqual(DIM4_MANIFEST_V0);

    const KNOWN_CLAUSE_KINDS = new Set([
      'exists',
      'singleton',
      'covers',
      'each',
      'some',
      'everyPar',
      'and',
      'or',
      'not',
      'compare',
      'compareCss',
      'reference',
      'validCss',
      'verified',
      'noConflict',
      'eachIn',
      'someIn',
      'everyDef',
      'containsNoneOf',
    ]);
    const visit = (clause: PredicateClause): void => {
      expect(KNOWN_CLAUSE_KINDS.has(clause.kind), clause.kind).toBe(true);
      switch (clause.kind) {
        case 'and':
        case 'or':
          clause.clauses.forEach(visit);
          return;
        case 'not':
          visit(clause.clause);
          return;
        case 'each':
        case 'some':
        case 'everyPar':
        case 'eachIn':
        case 'someIn':
        case 'everyDef':
          visit(clause.condition);
          return;
        default:
          return;
      }
    };
    for (const req of DIM4_REQUIREMENTS_V0) {
      for (const clause of req.validityPredicate) visit(clause);
    }
  });

  it('ningún predicado usa noConflict ni reference; sí eachIn, covers, some y validCss', () => {
    const kinds: string[] = [];
    for (const req of DIM4_REQUIREMENTS_V0) {
      for (const clause of req.validityPredicate) collectKinds(clause, kinds);
    }
    expect(kinds).not.toContain('noConflict');
    expect(kinds).not.toContain('reference');
    expect(kinds).toContain('covers'); // dim4.req05
    expect(kinds).toContain('some'); // dim4.req03 (degradación y cruce) y req02/req04
    expect(kinds).toContain('validCss'); // dim4.req02 (radioValor longitud-css)
    expect(kinds).toContain('eachIn'); // dim4.req02, req03 (PB3) y req04
  });
});

describe('evaluación de la Dimensión 4 completa', () => {
  it('dimensión resuelta cuando las ocho preguntas tienen definición efectiva válida', () => {
    const evaluation = evaluateManifest({
      manifest: DIM4_MANIFEST_V0,
      payloads: resolvedDim4Payloads(),
      rectoras: emptyRectoras(),
    });
    expect(evaluation.resultado).toBe('resuelto');
    expect(evaluation.contador).toEqual({ resueltos: 8, activos: 8 });
    expect(evaluation.resultados.every((r) => r.resultado === 'resuelto')).toBe(true);
  });

  it('AND estricto (§8.1.2): un solo requisito no-resuelto tumba la dimensión', () => {
    // req08 es HOJA (nadie depende de él): el contador no arrastra dependientes,
    // porque `dependsOn` es declaración de grafo y el contador cuenta la
    // evaluación propia de cada requisito.
    const payloads = resolvedDim4Payloads();
    payloads.set('dim4.req08', { adaptaciones: [] }); // lista vacía, no una decisión explícita
    const evaluation = evaluateManifest({
      manifest: DIM4_MANIFEST_V0,
      payloads,
      rectoras: emptyRectoras(),
    });
    expect(evaluation.resultado).toBe('no-resuelto');
    expect(evaluation.contador).toEqual({ resueltos: 7, activos: 8 });
    expect(evaluation.resultados.find((r) => r.requisitoId === 'dim4.req08')?.resultado).toBe(
      'no-resuelto',
    );
  });

  it('req05 "covers": falta uno de los cuatro efectos materiales (transparencia) ⇒ no-resuelto', () => {
    const payloads = resolvedDim4Payloads();
    const materiales = (payloads.get('dim4.req05') as { materiales: Array<{ efecto: string }> })
      .materiales;
    payloads.set('dim4.req05', {
      materiales: materiales.filter((efecto) => efecto.efecto !== 'transparencia'),
    });
    const evaluation = evaluateManifest({
      manifest: DIM4_MANIFEST_V0,
      payloads,
      rectoras: emptyRectoras(),
    });
    expect(evaluation.resultados.find((r) => r.requisitoId === 'dim4.req05')?.resultado).toBe(
      'no-resuelto',
    );
    expect(evaluation.resultado).toBe('no-resuelto');
    expect(evaluation.contador).toEqual({ resueltos: 6, activos: 8 /* req07 cae con req05 */ });
  });

  it('req05 "covers" con lista vacía ⇒ verdad-vacía fail-closed, no-resuelto', () => {
    const payloads = resolvedDim4Payloads();
    payloads.set('dim4.req05', { materiales: [] });
    const evaluation = evaluateManifest({
      manifest: DIM4_MANIFEST_V0,
      payloads,
      rectoras: emptyRectoras(),
    });
    expect(evaluation.resultados.find((r) => r.requisitoId === 'dim4.req05')?.resultado).toBe(
      'no-resuelto',
    );
    expect(evaluation.contador).toEqual({ resueltos: 6, activos: 8 /* req07 cae con req05 */ });
  });

  it('PB2(b) req05: un material sin `permitido` ⇒ no-resuelto (presencia obligatoria)', () => {
    const payloads = resolvedDim4Payloads();
    const materiales = (payloads.get('dim4.req05') as { materiales: unknown[] }).materiales;
    // Todos los efectos siguen cubiertos, pero ninguno declara `permitido`.
    payloads.set('dim4.req05', {
      materiales: materiales.map((material) => {
        const { permitido, ...resto } = material as { permitido: boolean };
        return resto;
      }),
    });
    const evaluation = evaluateManifest({
      manifest: DIM4_MANIFEST_V0,
      payloads,
      rectoras: emptyRectoras(),
    });
    expect(evaluation.resultados.find((r) => r.requisitoId === 'dim4.req05')?.resultado).toBe(
      'no-resuelto',
    );
    expect(evaluation.resultado).toBe('no-resuelto');
    expect(evaluation.contador).toEqual({ resueltos: 6, activos: 8 /* req07 cae con req05 */ });
  });

  it('req02: radio declarado como "longitud" sin radioValor ⇒ no-resuelto', () => {
    const payloads = resolvedDim4Payloads();
    payloads.set('dim4.req02', {
      formas: [
        { rol: rolDe(1), vocabulario: 'rectángulo de esquina suave', radio: 'longitud' },
      ],
    });
    const evaluation = evaluateManifest({
      manifest: DIM4_MANIFEST_V0,
      payloads,
      rectoras: emptyRectoras(),
    });
    expect(evaluation.resultados.find((r) => r.requisitoId === 'dim4.req02')?.resultado).toBe(
      'no-resuelto',
    );
  });

  it('PB1(d) req03: pila de dos filetes con uno `dashed` y sin degradación declarada ⇒ no-resuelto', () => {
    const payloads = resolvedDim4Payloads();
    payloads.set('dim4.req03', {
      estilosDeBorde: [
        {
          nombre: 'borde-guia-doble',
          roles: [rolDe(1)],
          filetes: [
            { grosor: '1px', tipo: 'dashed', color: colorDePaleta(), posicion: 'centrado en el canto inferior' },
            { grosor: '1px', tipo: 'solid', color: HEX_DE_FILETE, posicion: 'por fuera del contenedor' },
          ],
          limiteConocido: 'dos filetes, uno segmentado',
        },
      ],
    });
    const evaluation = evaluateManifest({
      manifest: DIM4_MANIFEST_V0,
      payloads,
      rectoras: emptyRectoras(),
    });
    expect(evaluation.resultados.find((r) => r.requisitoId === 'dim4.req03')?.resultado).toBe(
      'no-resuelto',
    );
  });

  it('PB1(d) req03: la misma pila `dashed` CON degradación declarada ⇒ resuelto', () => {
    const payloads = resolvedDim4Payloads();
    payloads.set('dim4.req03', {
      estilosDeBorde: [
        {
          nombre: 'borde-guia-doble',
          roles: [rolDe(1)],
          filetes: [
            { grosor: '1px', tipo: 'dashed', color: colorDePaleta(), posicion: 'centrado en el canto inferior' },
            { grosor: '1px', tipo: 'solid', color: HEX_DE_FILETE, posicion: 'por fuera del contenedor' },
          ],
          limiteConocido: 'dos filetes, uno segmentado',
          degradacion: 'se cae a un único filete continuo de 1px conservando el color',
        },
      ],
    });
    const evaluation = evaluateManifest({
      manifest: DIM4_MANIFEST_V0,
      payloads,
      rectoras: emptyRectoras(),
    });
    expect(evaluation.resultados.find((r) => r.requisitoId === 'dim4.req03')?.resultado).toBe(
      'resuelto',
    );
    expect(evaluation.contador).toEqual({ resueltos: 8, activos: 8 });
  });

  it('HB1(a) req03: color de filete literal inválido ("#zz") ⇒ no-resuelto (lo rechaza el validador de payload contra la unión)', () => {
    const payloads = resolvedDim4Payloads();
    payloads.set('dim4.req03', {
      estilosDeBorde: [
        {
          nombre: 'borde-sutil',
          roles: [rolDe(1)],
          filetes: [
            { grosor: '1px', tipo: 'solid', color: '#zz', posicion: 'dentro del canto del contenedor' },
          ],
          limiteConocido: 'un solo filete continuo; no se apila con sombra',
        },
      ],
    });
    const evaluation = evaluateManifest({
      manifest: DIM4_MANIFEST_V0,
      payloads,
      rectoras: emptyRectoras(),
    });
    expect(evaluation.resultados.find((r) => r.requisitoId === 'dim4.req03')?.resultado).toBe(
      'no-resuelto',
    );
    expect(evaluation.resultado).toBe('no-resuelto');
    expect(evaluation.contador).toEqual({ resueltos: 7, activos: 8 });
  });

  it('HB2(b) req03: estilo de borde sin `roles` ⇒ no-resuelto', () => {
    const payloads = resolvedDim4Payloads();
    payloads.set('dim4.req03', {
      estilosDeBorde: [
        {
          nombre: 'borde-sutil',
          filetes: [
            { grosor: '1px', tipo: 'solid', color: colorDePaleta(), posicion: 'dentro del canto del contenedor' },
          ],
          limiteConocido: 'un solo filete continuo; no se apila con sombra',
        },
      ],
    });
    const evaluation = evaluateManifest({
      manifest: DIM4_MANIFEST_V0,
      payloads,
      rectoras: emptyRectoras(),
    });
    expect(evaluation.resultados.find((r) => r.requisitoId === 'dim4.req03')?.resultado).toBe(
      'no-resuelto',
    );
    expect(evaluation.contador).toEqual({ resueltos: 7, activos: 8 });
  });

  it('PB3(a) req03: un estilo cuyos `roles` apuntan a [\'roles\', 99] (ref rota) ⇒ no-resuelto', () => {
    const payloads = resolvedDim4Payloads();
    payloads.set('dim4.req03', {
      estilosDeBorde: [
        {
          nombre: 'borde-huerfano',
          roles: [refA('dim4.req01', ['roles', 99])], // rol inexistente en req01
          filetes: [
            { grosor: '1px', tipo: 'solid', color: colorDePaleta(), posicion: 'dentro del canto del contenedor' },
          ],
          limiteConocido: 'un solo filete continuo',
        },
      ],
    });
    const evaluation = evaluateManifest({
      manifest: DIM4_MANIFEST_V0,
      payloads,
      rectoras: emptyRectoras(),
    });
    expect(evaluation.resultados.find((r) => r.requisitoId === 'dim4.req03')?.resultado).toBe(
      'no-resuelto',
    );
    expect(evaluation.resultado).toBe('no-resuelto');
    expect(evaluation.contador).toEqual({ resueltos: 7, activos: 8 });
  });

  it('HB3(c) req07: separación sin `mecanismoSeparacion` ⇒ no-resuelto (fail-closed)', () => {
    const payloads = resolvedDim4Payloads();
    payloads.set('dim4.req07', {
      separaciones: [{ rol: rolDe(0), caso: 'sin-sombra' }],
    });
    const evaluation = evaluateManifest({
      manifest: DIM4_MANIFEST_V0,
      payloads,
      rectoras: emptyRectoras(),
    });
    expect(evaluation.resultados.find((r) => r.requisitoId === 'dim4.req07')?.resultado).toBe(
      'no-resuelto',
    );
    expect(evaluation.contador).toEqual({ resueltos: 7, activos: 8 });
  });

  it('PM5(c) req07: con `sinExcepciones` y sin lista ⇒ resuelto (la ausencia es una decisión escrita)', () => {
    const payloads = resolvedDim4Payloads();
    payloads.set('dim4.req07', {
      sinExcepciones: 'no aplica: ningún rol del set se declara plano, sin sombra ni sin efectos',
    });
    const evaluation = evaluateManifest({
      manifest: DIM4_MANIFEST_V0,
      payloads,
      rectoras: emptyRectoras(),
    });
    expect(evaluation.resultados.find((r) => r.requisitoId === 'dim4.req07')?.resultado).toBe(
      'resuelto',
    );
    expect(evaluation.resultado).toBe('resuelto');
    expect(evaluation.contador).toEqual({ resueltos: 8, activos: 8 });
  });

  it('PM5 req07: ni `separaciones` ni `sinExcepciones` ⇒ no-resuelto (la ausencia silenciosa no pasa)', () => {
    const payloads = resolvedDim4Payloads();
    payloads.set('dim4.req07', {});
    const evaluation = evaluateManifest({
      manifest: DIM4_MANIFEST_V0,
      payloads,
      rectoras: emptyRectoras(),
    });
    expect(evaluation.resultados.find((r) => r.requisitoId === 'dim4.req07')?.resultado).toBe(
      'no-resuelto',
    );
    expect(evaluation.contador).toEqual({ resueltos: 7, activos: 8 });
  });

  it('HM6(d) req02: un rol de req01 sin forma en req02 ⇒ no-resuelto (eachIn)', () => {
    const payloads = resolvedDim4Payloads();
    const formas = (payloads.get('dim4.req02') as { formas: unknown[] }).formas;
    // Se cae la forma del cuarto rol ('separador'): req01 lo declara y req02 no
    // lo define. req02 es HOJA, así que el contador baja en uno exacto.
    payloads.set('dim4.req02', { formas: formas.slice(0, 3) });
    const evaluation = evaluateManifest({
      manifest: DIM4_MANIFEST_V0,
      payloads,
      rectoras: emptyRectoras(),
    });
    expect(evaluation.resultados.find((r) => r.requisitoId === 'dim4.req02')?.resultado).toBe(
      'no-resuelto',
    );
    expect(evaluation.resultado).toBe('no-resuelto');
    expect(evaluation.contador).toEqual({ resueltos: 7, activos: 8 });
  });

  it('HM6 req04: un rol de req01 sin profundidad en req04 ⇒ no-resuelto (eachIn)', () => {
    const payloads = resolvedDim4Payloads();
    const profundidades = (payloads.get('dim4.req04') as { profundidades: unknown[] }).profundidades;
    payloads.set('dim4.req04', { profundidades: profundidades.slice(0, 3) });
    const evaluation = evaluateManifest({
      manifest: DIM4_MANIFEST_V0,
      payloads,
      rectoras: emptyRectoras(),
    });
    expect(evaluation.resultados.find((r) => r.requisitoId === 'dim4.req04')?.resultado).toBe(
      'no-resuelto',
    );
  });

  it('HM7 req06: recorte sin `aplicaA` ⇒ no-resuelto', () => {
    const payloads = resolvedDim4Payloads();
    payloads.set('dim4.req06', {
      recortes: [{ nombre: 'retrato-circular', mascara: 'circle', proporcion: '1:1' }],
    });
    const evaluation = evaluateManifest({
      manifest: DIM4_MANIFEST_V0,
      payloads,
      rectoras: emptyRectoras(),
    });
    expect(evaluation.resultados.find((r) => r.requisitoId === 'dim4.req06')?.resultado).toBe(
      'no-resuelto',
    );
    expect(evaluation.contador).toEqual({ resueltos: 7, activos: 8 });
  });
});
