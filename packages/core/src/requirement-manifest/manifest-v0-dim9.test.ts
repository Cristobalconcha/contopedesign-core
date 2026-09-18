import { describe, expect, it } from 'vitest';
import { evaluateManifest } from './evaluate';
import { parseRequirementManifest } from './graph';
import { DIM9_MANIFEST_V0, DIM9_REQUIREMENTS_V0 } from './manifest-v0-dim9';
import type { PredicateClause } from './predicate';
import { RULE_KINDS, type RectoraV0, type RequirementV0 } from './types';

/**
 * Las rectoras se pasan vacías igual que en el molde de dim6: esta dimensión no
 * usa ninguna (spec C1-dim9 §2: "patrones" no está entre los dominios que el
 * mood wall gobierna, así que `rectorBindings: []` en los siete).
 */
const emptyRectoras = (): Map<string, RectoraV0> =>
  new Map<string, RectoraV0>([
    ['descriptor', { id: 'descriptor', tagsRequeridos: [], tagsProhibidos: [], exclusiones: [] }],
    ['mood-wall', { id: 'mood-wall', tagsRequeridos: [], tagsProhibidos: [], exclusiones: [] }],
  ]);

/**
 * Payloads que resuelven las siete preguntas de la dimensión (fixture de test).
 * Caso realista: landing de inscripción a cursos. Seis arquetipos aplican con
 * slots y cuatro declaran «no aplica, porque …» (el otro camino válido del xor
 * de la pasada 1, hallazgo 4). El único valor de color es un `ref` con destino
 * fijo al requisito de roles de color (`refTo('dim1.req02')`, pasada 1,
 * hallazgo 6 adoptado) cuyo `refPath` sigue el contrato declarado en la pasada
 * 2 (hallazgo 5): `['roleColors', n, 'role']`. Los `heredaDe` usan el `refPath`
 * esperado de req03 (pasada 2, hallazgo 5): `[]`, la definición completa del
 * requisito base. La entrada de req05 sin `arquetipo` es la declaración a nivel
 * de sistema (pasada 2, hallazgo 4). No se inventa ninguna paleta.
 */
function resolvedDim9Payloads(): Map<string, unknown> {
  const m = new Map<string, unknown>();

  m.set('dim9.req01', {
    arquetipos: [
      { nombre: 'accion', decision: 'botón de inscripción; una sola acción dominante por pantalla' },
      { nombre: 'contenedor', decision: 'tarjeta de curso, con superficie propia y título' },
      { nombre: 'navegacion', decision: 'barra superior con anclas a las secciones de la landing' },
      { nombre: 'feedback', decision: 'aviso en línea después de enviar el formulario' },
      { nombre: 'entrada', decision: 'formulario de inscripción: nombre y correo' },
      {
        nombre: 'secuencia-editorial',
        decision: 'no aplica, porque esta entrega no tiene piezas de lectura larga',
      },
      { nombre: 'lista', decision: 'listado de cursos disponibles' },
      { nombre: 'tabla', decision: 'no aplica, porque no hay datos tabulares en esta entrega' },
      { nombre: 'metricas', decision: 'no aplica, porque no se muestran cifras destacadas' },
      { nombre: 'representacion-de-datos', decision: 'galería de imágenes de los cursos' },
    ],
  });

  m.set('dim9.req02', {
    anatomias: [
      {
        arquetipo: 'accion',
        slots: [
          {
            nombre: 'etiqueta',
            obligatoriedad: 'obligatorio',
            relacion: 'sin relación con otros slots, porque es el texto que nombra la acción',
          },
          {
            nombre: 'icono',
            obligatoriedad: 'opcional',
            relacion: 'va a la izquierda de la etiqueta y nunca la reemplaza',
          },
        ],
      },
      {
        arquetipo: 'contenedor',
        slots: [
          { nombre: 'cuerpo', obligatoriedad: 'obligatorio', relacion: 'contiene los demás slots' },
          {
            nombre: 'titulo',
            obligatoriedad: 'opcional',
            relacion: 'va arriba del cuerpo y lo rotula',
          },
        ],
      },
      {
        arquetipo: 'navegacion',
        slots: [
          {
            nombre: 'enlaces',
            obligatoriedad: 'obligatorio',
            relacion: 'se ordena según la secuencia de lectura declarada',
          },
          {
            nombre: 'marca',
            obligatoriedad: 'opcional',
            relacion: 'va a la izquierda de los enlaces y no compite con ellos',
          },
        ],
      },
      {
        arquetipo: 'feedback',
        slots: [
          {
            nombre: 'mensaje',
            obligatoriedad: 'obligatorio',
            relacion: 'sin relación con otros slots, porque es el texto del aviso',
          },
          {
            nombre: 'cierre',
            obligatoriedad: 'opcional',
            relacion: 'va después del mensaje y no lo tapa',
          },
        ],
      },
      {
        arquetipo: 'entrada',
        slots: [
          {
            nombre: 'campos',
            obligatoriedad: 'obligatorio',
            relacion: 'se apilan en el orden en que se piden',
          },
          {
            nombre: 'ayuda',
            obligatoriedad: 'opcional',
            relacion: 'va debajo del campo que ayuda y sólo de ese',
          },
          {
            nombre: 'accion-principal',
            obligatoriedad: 'obligatorio',
            relacion: 'va después de todos los campos y cierra el formulario',
          },
        ],
      },
      {
        arquetipo: 'secuencia-editorial',
        noAplica: 'no aplica, porque esta entrega no tiene piezas de lectura larga',
      },
      {
        arquetipo: 'lista',
        slots: [
          {
            nombre: 'item',
            obligatoriedad: 'obligatorio',
            relacion: 'se repite; el orden lo fija la política de composición',
          },
          {
            nombre: 'separador',
            obligatoriedad: 'opcional',
            relacion: 'va entre items y nunca abre ni cierra la lista',
          },
        ],
      },
      { arquetipo: 'tabla', noAplica: 'no aplica, porque no hay datos tabulares en esta entrega' },
      { arquetipo: 'metricas', noAplica: 'no aplica, porque no se muestran cifras destacadas' },
      {
        arquetipo: 'representacion-de-datos',
        slots: [
          {
            nombre: 'imagen',
            obligatoriedad: 'obligatorio',
            relacion: 'sin relación con otros slots, porque es el contenido de la pieza',
          },
          {
            nombre: 'pie',
            obligatoriedad: 'opcional',
            relacion: 'va debajo de la imagen y no la cubre',
          },
        ],
      },
    ],
  });

  m.set('dim9.req03', {
    variantes: [
      {
        arquetipo: 'accion',
        nombre: 'solido',
        // Pasada 2, hallazgo 5: refPath esperado `[]` (la definición completa
        // del requisito base). C1 sólo verifica la presencia del ref; C2 lo
        // resuelve con `resolveRefValue` y detecta colgantes con
        // `findDanglingRefs` (adapter.ts).
        heredaDe: { refReqId: 'dim9.req01', refPath: [] },
        estadoEnvelope: 'default',
        diferencia: 'relleno pleno con el rol de acción; es la forma base',
      },
      {
        arquetipo: 'accion',
        nombre: 'contorno',
        heredaDe: { refReqId: 'dim9.req03', refPath: [] },
        estadoEnvelope: 'default',
        diferencia: 'quita el relleno y deja sólo un borde; se usa cuando la acción es secundaria',
      },
      {
        arquetipo: 'accion',
        nombre: 'hover',
        heredaDe: { refReqId: 'dim9.req03', refPath: [] },
        estadoEnvelope: 'hover',
        diferencia: 'oscurece el relleno un paso del mismo rol de color',
      },
      {
        arquetipo: 'representacion-de-datos',
        nombre: 'rejilla',
        heredaDe: { refReqId: 'dim9.req01', refPath: [] },
        estadoEnvelope: 'default',
        diferencia: 'mode grid de tres columnas en escritorio',
      },
      {
        arquetipo: 'entrada',
        nombre: 'tarjeta',
        heredaDe: { refReqId: 'dim9.req02', refPath: [] },
        estadoEnvelope: 'default',
        diferencia: 'surface card; el formulario es sólo contenedor, sus campos no cambian',
      },
      {
        arquetipo: 'lista',
        nombre: 'compacta',
        heredaDe: { refReqId: 'dim9.req02', refPath: [] },
        diferencia: 'reduce la separación entre items; sin estado de envelope propio',
      },
    ],
  });

  m.set('dim9.req04', {
    codificaciones: [
      {
        portador: 'posicion',
        uso: 'el curso destacado va siempre primero en el listado',
      },
      {
        portador: 'longitud',
        uso: 'la barra de avance de la inscripción crece según los pasos completados',
      },
      {
        portador: 'color',
        uso: 'el estado de cada curso usa los roles de color ya declarados, sin valores nuevos',
        // Destino fijo `dim1.req02` (roles de color): pasada 1, hallazgo 6
        // adoptado. refPath según el contrato de la pasada 2 (hallazgo 5):
        // `['roleColors', n, 'role']`, la entrada cuyo rol porta la
        // codificación.
        colorRef: { refReqId: 'dim1.req02', refPath: ['roleColors', 0, 'role'] },
      },
      {
        portador: 'forma',
        uso: 'esquinas redondeadas sólo en las tarjetas de curso',
      },
      {
        portador: 'textura',
        uso: 'no se usa hoy; queda declarado como decisión, no como omisión',
      },
    ],
  });

  m.set('dim9.req05', {
    estadosContenido: [
      {
        arquetipo: 'lista',
        estado: 'overflow',
        tratamiento: 'la lista se recorta a doce items y ofrece un enlace «ver todos»',
      },
      {
        arquetipo: 'representacion-de-datos',
        estado: 'overflow',
        tratamiento: 'la galería pagina de a seis imágenes, sin recortar ninguna',
      },
      {
        arquetipo: 'lista',
        estado: 'vacio',
        tratamiento: 'se muestra un texto breve que dice que no hay cursos disponibles',
      },
      {
        arquetipo: 'accion',
        estado: 'faltante',
        tratamiento: 'si falta el texto del botón no se dibuja el botón; no hay etiqueta vacía',
      },
      {
        // Sin `arquetipo`: pasada 2, hallazgo 4 — la entrada sin arquetipo ES
        // la declaración a nivel de sistema.
        estado: 'error',
        tratamiento: 'el error va junto al campo que lo produce y el formulario no se borra',
      },
    ],
  });

  m.set('dim9.req06', {
    adaptaciones: [
      {
        arquetipo: 'navegacion',
        contexto: 'pantalla angosta (mobile)',
        ajuste: 'las anclas se colapsan en un menú desplegable',
      },
      {
        arquetipo: 'representacion-de-datos',
        contexto: 'pantalla angosta (mobile)',
        ajuste: 'la galería pasa de tres columnas a una',
      },
      {
        arquetipo: 'tabla',
        contexto: 'este set no usa el arquetipo tabla',
        ajuste: 'sin adaptación: se declara que no hay nada que adaptar porque el arquetipo no aplica',
      },
    ],
  });

  m.set('dim9.req07', {
    extension: {
      comoSeAgrega:
        'se agrega una entrada al inventario de arquetipos con su anatomía y sus variantes, y se publica una revisión nueva del manifiesto',
      migracion:
        'la migración es un documento que dice qué sets existentes se revisan y cómo se traduce el patrón nuevo; no hay migración automática',
      efectoEnSetsHistoricos:
        'los sets históricos conservan su manifiesto original y quedan marcados como «revisión pendiente»; nunca se vuelven incompletos en silencio',
    },
  });

  return m;
}

// ---------------------------------------------------------------------------
// Lectura estructural del payloadSchema (sin acoplarse a los tipos del AST:
// se serializa y se lee el dato, igual que hace el evaluador). Los campos se
// leen SIEMPRE con corchetes y con `?.`/`!` donde el tipo pueda ser undefined
// (reglas TS4111/TS2532 del repo).
// ---------------------------------------------------------------------------

type JsonField = {
  optional?: boolean;
  type?: { kind?: string; reqId?: string; of?: { kind?: string; fields?: Record<string, JsonField> } };
};

const fieldOf = (req: RequirementV0, name: string): JsonField =>
  JSON.parse(JSON.stringify((req.payloadSchema as Record<string, unknown>)[name])) as JsonField;

const byId = (): Map<string, RequirementV0> =>
  new Map(DIM9_REQUIREMENTS_V0.map((r) => [r.id, r]));

describe('manifiesto v0 de Dimensión 9 — fidelidad a la spec C1-dim9 §3 (pasadas 1 y 2 aplicadas)', () => {
  it('el documento parsea limpio (grafo acíclico, IDs estables, sin brechas silenciosas)', () => {
    const result = parseRequirementManifest(DIM9_MANIFEST_V0);
    expect(result.ok).toBe(true);
  });

  it('contiene los siete requisitos: dim9.req01..req07', () => {
    expect(DIM9_REQUIREMENTS_V0.map((r) => r.id)).toEqual([
      'dim9.req01',
      'dim9.req02',
      'dim9.req03',
      'dim9.req04',
      'dim9.req05',
      'dim9.req06',
      'dim9.req07',
    ]);
  });

  it('respeta dependsOn y ejes de la spec §3', () => {
    const reqs = byId();
    expect(reqs.get('dim9.req01')?.dependsOn).toEqual([]);
    expect(reqs.get('dim9.req01')?.eje).toBe('completitud');
    expect(reqs.get('dim9.req02')?.dependsOn).toEqual(['dim9.req01']);
    expect(reqs.get('dim9.req03')?.dependsOn).toEqual(['dim9.req01', 'dim9.req02']);
    expect(reqs.get('dim9.req04')?.dependsOn).toEqual(['dim9.req01']);
    expect(reqs.get('dim9.req05')?.dependsOn).toEqual(['dim9.req01', 'dim9.req02']);
    expect(reqs.get('dim9.req06')?.dependsOn).toEqual(['dim9.req01', 'dim9.req02']);
    expect(reqs.get('dim9.req07')?.dependsOn).toEqual([
      'dim9.req01',
      'dim9.req02',
      'dim9.req03',
    ]);
    for (const id of ['dim9.req02', 'dim9.req03', 'dim9.req04', 'dim9.req05']) {
      expect(reqs.get(id)?.eje, id).toBe('completitud');
    }
    expect(reqs.get('dim9.req06')?.eje).toBe('ciclo-de-vida');
    expect(reqs.get('dim9.req07')?.eje).toBe('ciclo-de-vida');
  });

  it('dimensión terminal: dependsOn sólo contiene ids dim9.* (nunca cruce de dimensión)', () => {
    for (const req of DIM9_REQUIREMENTS_V0) {
      for (const dep of req.dependsOn) {
        expect(dep.startsWith('dim9.'), `${req.id} → ${dep}`).toBe(true);
      }
    }
  });

  it('sin rectoras: rectorBindings vacío en los siete, declarado ahora y no corregido después', () => {
    for (const req of DIM9_REQUIREMENTS_V0) {
      expect(req.rectorBindings, req.id).toEqual([]);
    }
  });

  it('brechas declaradas: seis mapsToKinds vacíos con mappingNotes no vacío; req03 es PARCIAL', () => {
    const reqs = byId();
    expect(reqs.get('dim9.req03')?.mapsToKinds.map((entry) => entry.kind)).toEqual([
      'button',
      'gallery',
      'table',
      'form',
    ]);
    for (const req of DIM9_REQUIREMENTS_V0) {
      expect(req.mappingNotes, req.id).toBeDefined();
      // `exactOptionalPropertyTypes`: nunca `mappingNotes: undefined`; se lee
      // con `?.`/`!` porque el campo es opcional en el tipo.
      expect(req.mappingNotes!.length, req.id).toBeGreaterThan(0);
      if (req.mapsToKinds.length === 0) {
        expect(req.mappingNotes!.length, req.id).toBeGreaterThan(0);
      }
    }
  });

  it('tensión 3 (pasada 1): el valueNotes de gallery quedó suavizado a lectura tentativa', () => {
    const gallery = byId()
      .get('dim9.req03')
      ?.mapsToKinds.find((entry) => entry.kind === 'gallery');
    expect(gallery?.valueNotes).toContain('Lectura tentativa');
    expect(gallery?.valueNotes).toContain('lista');
  });

  it('pasada 2, hallazgo 5: los dos refPath esperados quedaron declarados en los mappingNotes', () => {
    const reqs = byId();
    expect(reqs.get('dim9.req03')?.mappingNotes).toContain('refPath esperado: `[]`');
    expect(reqs.get('dim9.req03')?.mappingNotes).toContain('dim8.req02');
    expect(reqs.get('dim9.req04')?.mappingNotes).toContain("refPath esperado: `[\"roleColors\", n, \"role\"]`");
    expect(reqs.get('dim9.req04')?.mappingNotes).toContain('dim4.req02');
    expect(reqs.get('dim9.req04')?.mappingNotes).toContain('pkg.forma.vocabulario');
  });

  it('pasada 1, hallazgos 1/2/3/6 y pasada 2, hallazgo 4: los canales de ausencia y el ref fijo están en el payloadSchema', () => {
    const reqs = byId();

    const anatomia = fieldOf(reqs.get('dim9.req02') as RequirementV0, 'anatomias');
    const anatomiaFields = anatomia.type?.of?.fields ?? {};
    expect(anatomiaFields['slots']?.optional).toBe(true); // pasada 1, hallazgo 1
    expect(anatomiaFields['noAplica']?.optional).toBe(true); // pasada 1, hallazgo 4
    expect(anatomiaFields['arquetipo']?.optional).toBeUndefined(); // req02 lo mantiene obligatorio

    const req03 = reqs.get('dim9.req03') as RequirementV0;
    expect(fieldOf(req03, 'variantes').optional).toBe(true); // pasada 1, hallazgo 2
    expect(fieldOf(req03, 'sinVariantes').optional).toBe(true); // pasada 1, hallazgo 2

    const req04 = reqs.get('dim9.req04') as RequirementV0;
    expect(fieldOf(req04, 'codificaciones').optional).toBeUndefined();
    expect(fieldOf(req04, 'sinCodificacionColor').optional).toBe(true); // pasada 1, hallazgo 3
    const codificacionFields = fieldOf(req04, 'codificaciones').type?.of?.fields ?? {};
    expect(codificacionFields['colorRef']?.optional).toBe(true); // pasada 1, hallazgo 6 (sigue siendo opcional)
    expect(codificacionFields['colorRef']?.type?.kind).toBe('ref');
    expect(codificacionFields['colorRef']?.type?.reqId).toBe('dim1.req02'); // pasada 1, hallazgo 6 adoptado

    // Pasada 2, hallazgo 4: `arquetipo` es opcional en req05 (la entrada sin
    // arquetipo es la declaración a nivel de sistema) y `covers` sigue siendo
    // sobre `estado`, que es obligatorio.
    const req05 = reqs.get('dim9.req05') as RequirementV0;
    const estadosFields = fieldOf(req05, 'estadosContenido').type?.of?.fields ?? {};
    expect(estadosFields['arquetipo']?.optional).toBe(true);
    expect(estadosFields['estado']?.optional).toBeUndefined();
    expect(estadosFields['tratamiento']?.optional).toBeUndefined();
  });

  it('pasada 1, hallazgos 3/4/5: el predicado de req04 usa each con rutas relativas y el xor de req02 sigue ahí', () => {
    const reqs = byId();
    const req02 = JSON.stringify(reqs.get('dim9.req02')?.validityPredicate);
    const req03 = JSON.stringify(reqs.get('dim9.req03')?.validityPredicate);
    const req04 = JSON.stringify(reqs.get('dim9.req04')?.validityPredicate);

    expect(req02).toContain('"not"'); // xor de la pasada 1, hallazgo 4
    expect(req03).toContain('"sinVariantes"'); // pasada 1, hallazgo 2
    expect(req04).toContain('"sinCodificacionColor"'); // pasada 1, hallazgo 3
    expect(req04).toContain('"each"'); // la cláusula del portador color sigue siendo each con rutas relativas
    expect(req04).not.toContain('"alias":"c","target":["codificaciones"]'); // el each NO lleva alias
    expect(req04).toContain('"!="');
  });

  it('pasada 2, hallazgos 1/2/3: las exclusiones mutuas nuevas están en el AST (req03, req04 y cierre por arquetipo de req02)', () => {
    const reqs = byId();
    const req02 = JSON.stringify(reqs.get('dim9.req02')?.validityPredicate);
    const req03 = JSON.stringify(reqs.get('dim9.req03')?.validityPredicate);
    const req04 = JSON.stringify(reqs.get('dim9.req04')?.validityPredicate);

    // req03: not(and(exists(variantes), exists(sinVariantes)))
    expect(req03).toContain('{"kind":"not","clause":{"kind":"and","clauses":[{"kind":"exists"');
    // req04: not(and(exists(sinCodificacionColor), some(codificaciones, c, …)))
    expect(req04).toContain('{"kind":"not","clause":{"kind":"and","clauses":[{"kind":"exists"');
    expect(req04).toContain('"alias":"c"'); // some con alias SOLO en la exclusión mutua
    // req02: el cierre por arquetipo usa los alias `a` y `b` con rutas prefijadas
    expect(req02).toContain('"alias":"a"');
    expect(req02).toContain('"alias":"b"');
    expect(req02).toContain('"path":["a","arquetipo"]');
    expect(req02).toContain('"path":["b","arquetipo"]');
    expect(req02).toContain('"target":["a","noAplica"]');
    expect(req02).toContain('"target":["b","slots"]');
  });

  it('los kinds de mapsToKinds son sólo los 14 RULE_KINDS del compilador', () => {
    const knownKinds = new Set<string>(RULE_KINDS);
    for (const req of DIM9_REQUIREMENTS_V0) {
      for (const entry of req.mapsToKinds) {
        expect(knownKinds.has(entry.kind), `${req.id} → ${entry.kind}`).toBe(true);
      }
    }
  });

  it('CERO PROSA: la serialización es el dato (round-trip JSON) y cada cláusula es del union conocido', () => {
    const roundTripped = JSON.parse(JSON.stringify(DIM9_MANIFEST_V0));
    expect(roundTripped).toEqual(DIM9_MANIFEST_V0);

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
    for (const req of DIM9_REQUIREMENTS_V0) {
      for (const clause of req.validityPredicate) visit(clause);
    }
  });
});

describe('evaluación de la Dimensión 9 completa (pasadas 1 y 2 aplicadas)', () => {
  it('dimensión resuelta cuando las siete preguntas tienen definición efectiva válida', () => {
    const evaluation = evaluateManifest({
      manifest: DIM9_MANIFEST_V0,
      payloads: resolvedDim9Payloads(),
      rectoras: emptyRectoras(),
    });
    expect(evaluation.resultado).toBe('resuelto');
    expect(evaluation.contador).toEqual({ resueltos: 7, activos: 7 });
    expect(evaluation.resultados.every((r) => r.resultado === 'resuelto')).toBe(true);
  });

  it('AND estricto (§8.1.2): un solo requisito no-resuelto tumba la dimensión (req06, sin dependientes)', () => {
    const payloads = resolvedDim9Payloads();
    payloads.set('dim9.req06', { adaptaciones: [] }); // lista vacía, no una decisión explícita
    const evaluation = evaluateManifest({
      manifest: DIM9_MANIFEST_V0,
      payloads,
      rectoras: emptyRectoras(),
    });
    expect(evaluation.resultado).toBe('no-resuelto');
    expect(evaluation.contador).toEqual({ resueltos: 6, activos: 7 });
    expect(evaluation.resultados.find((r) => r.requisitoId === 'dim9.req06')?.resultado).toBe(
      'no-resuelto',
    );
  });

  it('cascada por dependencias: req01 sin «tabla» arrastra a los seis dependientes ⇒ 0/7', () => {
    const payloads = resolvedDim9Payloads();
    const actual = payloads.get('dim9.req01') as {
      arquetipos: { nombre: string; decision: string }[];
    };
    payloads.set('dim9.req01', {
      arquetipos: actual.arquetipos.filter((a) => a.nombre !== 'tabla'),
    });
    const evaluation = evaluateManifest({
      manifest: DIM9_MANIFEST_V0,
      payloads,
      rectoras: emptyRectoras(),
    });
    expect(evaluation.resultado).toBe('no-resuelto');
    expect(evaluation.resultados.find((r) => r.requisitoId === 'dim9.req01')?.resultado).toBe(
      'no-resuelto',
    );
    // req02, req03, req04, req05, req06 y req07 dependen (directa o
    // transitivamente) de req01: la cascada deja la dimensión en cero.
    expect(evaluation.contador).toEqual({ resueltos: 0, activos: 7 });
  });

  it('verdad-vacía fail-closed: req03 con variantes vacías y sin sinVariantes ⇒ no-resuelto', () => {
    const payloads = resolvedDim9Payloads();
    payloads.set('dim9.req03', { variantes: [] });
    const evaluation = evaluateManifest({
      manifest: DIM9_MANIFEST_V0,
      payloads,
      rectoras: emptyRectoras(),
    });
    expect(evaluation.resultados.find((r) => r.requisitoId === 'dim9.req03')?.resultado).toBe(
      'no-resuelto',
    );
  });

  it('(b) pasada 1, hallazgo 2: un set sin variantes que declara sinVariantes resuelve req03', () => {
    const payloads = resolvedDim9Payloads();
    payloads.set('dim9.req03', {
      sinVariantes:
        'este set no declara variantes porque cada arquetipo se usa en su forma base, sin alternativas',
    });
    const evaluation = evaluateManifest({
      manifest: DIM9_MANIFEST_V0,
      payloads,
      rectoras: emptyRectoras(),
    });
    expect(evaluation.resultados.find((r) => r.requisitoId === 'dim9.req03')?.resultado).toBe(
      'resuelto',
    );
    expect(evaluation.resultado).toBe('resuelto');
    expect(evaluation.contador).toEqual({ resueltos: 7, activos: 7 });
  });

  it('(a) pasada 2, hallazgo 1: variantes y sinVariantes declarados a la vez ⇒ no-resuelto, y la cascada deja 5/7', () => {
    const payloads = resolvedDim9Payloads();
    const actual = payloads.get('dim9.req03') as { variantes: unknown[] };
    payloads.set('dim9.req03', {
      variantes: actual.variantes,
      sinVariantes: 'no hay variantes, porque cada arquetipo se usa en su forma base',
    });
    const evaluation = evaluateManifest({
      manifest: DIM9_MANIFEST_V0,
      payloads,
      rectoras: emptyRectoras(),
    });
    expect(evaluation.resultado).toBe('no-resuelto');
    expect(evaluation.resultados.find((r) => r.requisitoId === 'dim9.req03')?.resultado).toBe(
      'no-resuelto',
    );
    // req07 es el único dependiente de req03: la cascada deja req01, req02,
    // req04, req05 y req06 resueltos.
    expect(evaluation.contador).toEqual({ resueltos: 5, activos: 7 });
    expect(evaluation.resultados.find((r) => r.requisitoId === 'dim9.req07')?.resultado).toBe(
      'no-resuelto',
    );
  });

  it('(b) pasada 2, hallazgo 2: sinCodificacionColor junto a una entrada color con colorRef ⇒ no-resuelto, 6/7', () => {
    const payloads = resolvedDim9Payloads();
    const actual = payloads.get('dim9.req04') as {
      codificaciones: { portador: string; uso: string; colorRef?: unknown }[];
    };
    // El portador color CONSERVA su colorRef: la contradicción es declarar la
    // ausencia del canal y a la vez entregar la entrada color con ref.
    expect(actual.codificaciones.some((c) => c.portador === 'color' && c.colorRef !== undefined)).toBe(
      true,
    );
    payloads.set('dim9.req04', {
      codificaciones: actual.codificaciones,
      sinCodificacionColor: 'en este set el color no codifica nada, porque todos los cursos comparten rol',
    });
    const evaluation = evaluateManifest({
      manifest: DIM9_MANIFEST_V0,
      payloads,
      rectoras: emptyRectoras(),
    });
    expect(evaluation.resultado).toBe('no-resuelto');
    expect(evaluation.resultados.find((r) => r.requisitoId === 'dim9.req04')?.resultado).toBe(
      'no-resuelto',
    );
    // req04 no tiene dependientes: el resto de la dimensión sigue resuelta.
    expect(evaluation.contador).toEqual({ resueltos: 6, activos: 7 });
  });

  it('(c) pasada 2, hallazgo 3: dos entradas del mismo arquetipo, una con slots y otra con noAplica ⇒ no-resuelto, 2/7', () => {
    const payloads = resolvedDim9Payloads();
    const actual = payloads.get('dim9.req02') as {
      anatomias: { arquetipo: string; slots?: unknown; noAplica?: string }[];
    };
    payloads.set('dim9.req02', {
      anatomias: [
        ...actual.anatomias,
        // «lista» ya trae su gramática de slots en el fixture: esta segunda
        // entrada del MISMO arquetipo declara que no aplica, que es justo lo
        // que el xor por entrada no medía.
        { arquetipo: 'lista', noAplica: 'no aplica, porque el listado se resuelve en la navegación' },
      ],
    });
    const evaluation = evaluateManifest({
      manifest: DIM9_MANIFEST_V0,
      payloads,
      rectoras: emptyRectoras(),
    });
    expect(evaluation.resultado).toBe('no-resuelto');
    expect(evaluation.resultados.find((r) => r.requisitoId === 'dim9.req02')?.resultado).toBe(
      'no-resuelto',
    );
    // req03, req05, req06 y req07 dependen de req02: sólo quedan resueltos
    // req01 y req04.
    expect(evaluation.contador).toEqual({ resueltos: 2, activos: 7 });
  });

  it('(d) pasada 1, hallazgo 4: un arquetipo con slots y noAplica a la vez ⇒ no-resuelto', () => {
    const payloads = resolvedDim9Payloads();
    const actual = payloads.get('dim9.req02') as {
      anatomias: { arquetipo: string; slots?: unknown; noAplica?: unknown }[];
    };
    payloads.set('dim9.req02', {
      anatomias: actual.anatomias.map((a) =>
        a.arquetipo === 'lista'
          ? {
              arquetipo: 'lista',
              slots: [
                {
                  nombre: 'item',
                  obligatoriedad: 'obligatorio',
                  relacion: 'se repite',
                },
              ],
              noAplica: 'no aplica, porque no hay listado en esta entrega',
            }
          : a,
      ),
    });
    const evaluation = evaluateManifest({
      manifest: DIM9_MANIFEST_V0,
      payloads,
      rectoras: emptyRectoras(),
    });
    expect(evaluation.resultados.find((r) => r.requisitoId === 'dim9.req02')?.resultado).toBe(
      'no-resuelto',
    );
    expect(evaluation.resultado).toBe('no-resuelto');
    // req03, req05, req06 y req07 dependen de req02: sólo quedan resueltos
    // req01 y req04.
    expect(evaluation.contador).toEqual({ resueltos: 2, activos: 7 });
  });

  it('(e) pasada 1: muchos arquetipos con noAplica y sin slots ⇒ la dimensión queda resuelta', () => {
    const payloads = resolvedDim9Payloads();
    const conSlots = new Set(['accion', 'entrada', 'lista']);
    payloads.set('dim9.req02', {
      anatomias: [
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
      ].map((arquetipo) =>
        conSlots.has(arquetipo)
          ? {
              arquetipo,
              slots: [
                {
                  nombre: 'cuerpo',
                  obligatoriedad: 'obligatorio',
                  relacion: 'sin relación con otros slots, porque es la pieza principal',
                },
              ],
            }
          : { arquetipo, noAplica: `no aplica, porque este set no usa el arquetipo ${arquetipo}` },
      ),
    });
    const evaluation = evaluateManifest({
      manifest: DIM9_MANIFEST_V0,
      payloads,
      rectoras: emptyRectoras(),
    });
    expect(evaluation.contador).toEqual({ resueltos: 7, activos: 7 });
    expect(evaluation.resultado).toBe('resuelto');
  });

  it('req02 "each + or": una anatomía sin slots y sin noAplica ⇒ no-resuelto', () => {
    const payloads = resolvedDim9Payloads();
    const actual = payloads.get('dim9.req02') as {
      anatomias: { arquetipo: string; slots?: unknown; noAplica?: unknown }[];
    };
    payloads.set('dim9.req02', {
      anatomias: actual.anatomias.map((a) =>
        a.arquetipo === 'lista' ? { arquetipo: 'lista' } : a,
      ),
    });
    const evaluation = evaluateManifest({
      manifest: DIM9_MANIFEST_V0,
      payloads,
      rectoras: emptyRectoras(),
    });
    expect(evaluation.resultados.find((r) => r.requisitoId === 'dim9.req02')?.resultado).toBe(
      'no-resuelto',
    );
    expect(evaluation.contador).toEqual({ resueltos: 2, activos: 7 });
  });

  it('req04 "covers": falta uno de los cinco portadores (textura) ⇒ no-resuelto', () => {
    const payloads = resolvedDim9Payloads();
    const actual = payloads.get('dim9.req04') as {
      codificaciones: { portador: string; uso: string; colorRef?: unknown }[];
    };
    payloads.set('dim9.req04', {
      codificaciones: actual.codificaciones.filter((c) => c.portador !== 'textura'),
    });
    const evaluation = evaluateManifest({
      manifest: DIM9_MANIFEST_V0,
      payloads,
      rectoras: emptyRectoras(),
    });
    expect(evaluation.resultados.find((r) => r.requisitoId === 'dim9.req04')?.resultado).toBe(
      'no-resuelto',
    );
    expect(evaluation.contador).toEqual({ resueltos: 6, activos: 7 });
  });

  it('req05 "covers": falta uno de los cuatro estados de contenido (faltante) ⇒ no-resuelto', () => {
    const payloads = resolvedDim9Payloads();
    const actual = payloads.get('dim9.req05') as {
      estadosContenido: { arquetipo?: string; estado: string; tratamiento: string }[];
    };
    payloads.set('dim9.req05', {
      estadosContenido: actual.estadosContenido.filter((e) => e.estado !== 'faltante'),
    });
    const evaluation = evaluateManifest({
      manifest: DIM9_MANIFEST_V0,
      payloads,
      rectoras: emptyRectoras(),
    });
    expect(evaluation.resultados.find((r) => r.requisitoId === 'dim9.req05')?.resultado).toBe(
      'no-resuelto',
    );
    expect(evaluation.contador).toEqual({ resueltos: 6, activos: 7 });
  });

  it('(d) pasada 2, hallazgo 4: una entrada de req05 SIN arquetipo ES la declaración de sistema ⇒ resuelto, 7/7', () => {
    const payloads = resolvedDim9Payloads();
    payloads.set('dim9.req05', {
      estadosContenido: [
        // Sin arquetipo: declaración a nivel de sistema, ahora declarable.
        { estado: 'overflow', tratamiento: 'la lista se recorta a doce items y ofrece un enlace «ver todos»' },
        {
          arquetipo: 'lista',
          estado: 'vacio',
          tratamiento: 'se muestra un texto breve que dice que no hay cursos disponibles',
        },
        {
          arquetipo: 'accion',
          estado: 'faltante',
          tratamiento: 'si falta el texto del botón no se dibuja el botón; no hay etiqueta vacía',
        },
        {
          arquetipo: 'entrada',
          estado: 'error',
          tratamiento: 'el error va junto al campo que lo produce y el formulario no se borra',
        },
      ],
    });
    const evaluation = evaluateManifest({
      manifest: DIM9_MANIFEST_V0,
      payloads,
      rectoras: emptyRectoras(),
    });
    expect(evaluation.resultados.find((r) => r.requisitoId === 'dim9.req05')?.resultado).toBe(
      'resuelto',
    );
    expect(evaluation.resultado).toBe('resuelto');
    expect(evaluation.contador).toEqual({ resueltos: 7, activos: 7 });
  });

  it('(c) pasada 1, hallazgo 3: portador color sin colorRef y sin sinCodificacionColor ⇒ no-resuelto', () => {
    const payloads = resolvedDim9Payloads();
    const actual = payloads.get('dim9.req04') as {
      codificaciones: { portador: string; uso: string; colorRef?: unknown }[];
    };
    payloads.set('dim9.req04', {
      codificaciones: actual.codificaciones.map((c) =>
        c.portador === 'color' ? { portador: c.portador, uso: c.uso } : c,
      ),
    });
    const evaluation = evaluateManifest({
      manifest: DIM9_MANIFEST_V0,
      payloads,
      rectoras: emptyRectoras(),
    });
    expect(evaluation.resultados.find((r) => r.requisitoId === 'dim9.req04')?.resultado).toBe(
      'no-resuelto',
    );
    expect(evaluation.contador).toEqual({ resueltos: 6, activos: 7 });
  });

  it('pasada 1, hallazgo 3 (escape): el portador color sin colorRef, con sinCodificacionColor declarado, resuelve', () => {
    const payloads = resolvedDim9Payloads();
    const actual = payloads.get('dim9.req04') as {
      codificaciones: { portador: string; uso: string; colorRef?: unknown }[];
    };
    payloads.set('dim9.req04', {
      codificaciones: actual.codificaciones.map((c) =>
        c.portador === 'color' ? { portador: c.portador, uso: c.uso } : c,
      ),
      sinCodificacionColor:
        'en este set el color no codifica información: todos los cursos usan el mismo rol de superficie',
    });
    const evaluation = evaluateManifest({
      manifest: DIM9_MANIFEST_V0,
      payloads,
      rectoras: emptyRectoras(),
    });
    expect(evaluation.resultados.find((r) => r.requisitoId === 'dim9.req04')?.resultado).toBe(
      'resuelto',
    );
    expect(evaluation.resultado).toBe('resuelto');
  });
});
