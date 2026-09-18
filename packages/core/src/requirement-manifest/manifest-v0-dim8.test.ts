import { describe, expect, it } from 'vitest';
import { evaluateManifest } from './evaluate';
import { parseRequirementManifest } from './graph';
import { DIM8_MANIFEST_V0, DIM8_REQUIREMENTS_V0 } from './manifest-v0-dim8';
import type { PredicateClause } from './predicate';
import { PACKAGE_ID_PATTERN, RULE_KINDS } from './types';
import type { RectoraV0 } from './types';

/**
 * La Dimensión 8 no declara `rectorBindings` (el mood wall no gobierna el
 * dominio "movimiento", spec §2, insumo 10). Las rectoras se pasan vacías
 * igual que en el molde de dim6, aunque la dimensión no las use.
 */
const emptyRectoras = (): Map<string, RectoraV0> =>
  new Map<string, RectoraV0>([
    ['descriptor', { id: 'descriptor', tagsRequeridos: [], tagsProhibidos: [], exclusiones: [] }],
    ['mood-wall', { id: 'mood-wall', tagsRequeridos: [], tagsProhibidos: [], exclusiones: [] }],
  ]);

const evaluateDim8 = (payloads: Map<string, unknown>) =>
  evaluateManifest({ manifest: DIM8_MANIFEST_V0, payloads, rectoras: emptyRectoras() });

/**
 * Payloads que resuelven las siete preguntas de la dimensión (fixture de test).
 *
 * El `tiempo` de los roles y de los movimientos admite dos formas: la `ref`
 * anclada a la escala (`{ refReqId: 'dim8.req03', refPath: ['escala', índice,
 * 'duracion'] }`) o el literal en ms. Acá conviven las dos: el rol `entrada` y
 * el primer movimiento usan la `ref` (y el predicado la RESUELVE con la
 * cláusula `reference` — fail-closed del hallazgo 1, BLOQUEANTE de la pasada 2:
 * una `refPath` rota no pasa en silencio), mientras el resto usa el literal.
 * Duraciones y amplitudes deliberadamente distintas de 0 (verdad-vacía
 * fail-closed). Sin colores inventados: no hay ni un hex en este fixture.
 */
function resolvedDim8Payloads(): Map<string, unknown> {
  const m = new Map<string, unknown>();

  m.set('dim8.req01', {
    caracter: {
      principios: [
        'el movimiento sirve para explicar qué cambió, no para adornar',
        'nada rebota ni se estira: el sistema se mueve sobrio y directo',
        'la respuesta al toque se siente inmediata o directamente no se siente',
      ],
      descripcion: 'movimiento sobrio y directo: el sistema se mueve para decir de dónde vino algo y a dónde va',
      procedenciaDelCaracter: 'manual de marca del cliente: transiciones breves, sin rebote, sin coreografía decorativa',
    },
  });

  m.set('dim8.req02', {
    roles: [
      {
        nombre: 'entrada',
        significado: 'lo que aparece al entrar en pantalla, calibrado contra la vista',
        // Ref resuelta contra la escala de dim8.req03: navega el payload de
        // req03 y apunta al paso "entrada" (escala[3], 420 ms).
        tiempo: { refReqId: 'dim8.req03', refPath: ['escala', 3, 'duracion'] },
      },
      {
        nombre: 'salida',
        significado: 'lo que se retira cuando deja de ser pertinente',
        duracionMs: 240,
      },
      {
        nombre: 'transicion',
        significado: 'lo que explica el paso de un estado a otro dentro del mismo elemento',
        duracionMs: 320,
      },
      {
        nombre: 'feedback',
        significado: 'lo que confirma que el toque fue recibido, calibrado contra la mano',
        duracionMs: 160,
      },
      {
        nombre: 'orientacion',
        significado: 'lo que señala de dónde vino el contenido y hacia dónde sigue',
        duracionMs: 280,
      },
      {
        nombre: 'enfasis',
        significado: 'lo que subraya lo importante',
        razonNoAplica:
          'no aplica en v0: el énfasis se comunica con peso visual y escala (dim6), no con movimiento; se declara ausente a propósito',
      },
    ],
  });

  m.set('dim8.req03', {
    escala: [
      { nombre: 'inmediata', duracion: 160 },
      { nombre: 'breve', duracion: 240 },
      { nombre: 'media', duracion: 320 },
      { nombre: 'entrada', duracion: 420 },
      { nombre: 'pausada', duracion: 620 },
    ],
    ritmo: {
      descripcion: 'cada movimiento entra rápido y sale más rápido todavía; el sistema desacelera al llegar al reposo',
      pausas: ['entre dos gestos que no se encadenan hay una pausa de al menos un paso de escala'],
    },
  });

  m.set('dim8.req04', {
    movimientos: [
      {
        caso: 'panel que entra desde el borde inferior al abrir un menú',
        curva: 'cubic-bezier(0.2, 0, 0, 1)',
        trayectoria: 'desde 100% por debajo del borde hasta su posición final, sin rebote',
        continuidadEspacial: 'el panel se desplaza sobre la misma retícula que declara dim3; no cambia de ancho al moverse',
        amplitud: '24px',
        // Segunda ref resuelta del fixture: mismo paso "entrada" de la escala (420 ms).
        tiempo: { refReqId: 'dim8.req03', refPath: ['escala', 3, 'duracion'] },
      },
      {
        caso: 'aparición del titular al entrar en la ventana',
        curva: 'ease-out',
        trayectoria: 'fundido de opacidad más 12px de desplazamiento vertical ascendente',
        continuidadEspacial: 'el bloque se queda en la columna donde lo dejó el flujo; no reordena el contenido vecino',
        amplitud: '12px',
        duracionMs: 500,
      },
      {
        caso: 'confirmación de envío: el botón cambia de estado y aparece el mensaje',
        curva: 'linear',
        trayectoria: 'fundido de opacidad del mensaje de confirmación, sin desplazamiento',
        continuidadEspacial: 'el mensaje aparece en el espacio reservado bajo el botón; nada más se mueve',
        duracionMs: 160,
      },
    ],
  });

  m.set('dim8.req05', {
    disparadores: [
      {
        tipo: 'carga de la página',
        condicion: 'al terminar de cargar el documento, sólo para el titular de portada',
        triggerDelKind: 'load',
      },
      {
        tipo: 'entrada en la ventana',
        condicion: 'cuando el bloque alcanza el 20% visible de la ventana',
        triggerDelKind: 'scroll',
      },
      {
        tipo: 'puntero encima',
        condicion: 'al pasar el puntero por una tarjeta, sólo en dispositivos con puntero fino',
        triggerDelKind: 'hover',
      },
      {
        tipo: 'recibir foco',
        condicion:
          'cuando un control recibe foco por teclado: el compilador no tiene trigger para foco, así que vive como texto',
      },
    ],
  });

  m.set('dim8.req06', {
    coreografia: {
      secuencia: [
        { orden: 1, elemento: 'titular de portada', rol: 'entrada', atrasoMs: 80 },
        { orden: 2, elemento: 'bajada de portada', rol: 'entrada', atrasoMs: 160 },
        { orden: 3, elemento: 'botón de acción', rol: 'feedback', atrasoMs: 240 },
      ],
      relaciones: [
        'la bajada entra después del titular, nunca antes ni al mismo tiempo',
        'el botón responde cuando la persona lo toca, sin esperar a que la secuencia termine',
      ],
      sincronia:
        'desfase fijo entre entradas consecutivas; si la persona ya está interactuando, la secuencia se corta y cada elemento queda en reposo',
    },
  });

  m.set('dim8.req07', {
    reduccion: {
      decision: 'reducida',
      criterio:
        'con la preferencia de menos movimiento activada se conservan los cambios de estado, se eliminan los desplazamientos y las duraciones bajan al paso más corto de la escala',
      equivalentes: [
        {
          rol: 'entrada',
          equivalenteEstatico: 'el bloque aparece ya en su posición final, sin desplazamiento ni fundido largo',
        },
        {
          rol: 'salida',
          equivalenteEstatico: 'el bloque desaparece de inmediato; no hay salida animada',
        },
        {
          rol: 'transicion',
          equivalenteEstatico: 'el cambio de estado se marca con el color de acción de dim1, sin interpolar',
        },
        {
          rol: 'feedback',
          equivalenteEstatico: 'el control cambia de estado visible de inmediato y conserva el foco por teclado',
        },
        {
          rol: 'orientacion',
          equivalenteEstatico: 'la dirección se dice en el texto del enlace, no con desplazamiento',
        },
        {
          rol: 'enfasis',
          equivalenteEstatico: 'el énfasis se comunica con peso visual y escala (dim6), su sustituto permanente',
        },
      ],
      sinMovimientoDecorativo: {
        comoSeComunicaCambio:
          'cada cambio se comunica con un cambio visible en el propio elemento: color de acción, borde o texto',
        comoSeComunicaJerarquia:
          'la jerarquía se comunica con escala tipográfica (dim2) y peso visual (dim6), nunca con animación',
      },
    },
  });

  return m;
}

describe('manifiesto v0 de Dimensión 8 — fidelidad a la spec C1-dim8 §3', () => {
  it('el documento parsea limpio (grafo acíclico, IDs estables, sin brechas silenciosas)', () => {
    const result = parseRequirementManifest(DIM8_MANIFEST_V0);
    expect(result.ok).toBe(true);
  });

  it('contiene los siete requisitos: dim8.req01..req07', () => {
    expect(DIM8_REQUIREMENTS_V0.map((r) => r.id)).toEqual([
      'dim8.req01',
      'dim8.req02',
      'dim8.req03',
      'dim8.req04',
      'dim8.req05',
      'dim8.req06',
      'dim8.req07',
    ]);
  });

  it('respeta dependsOn y ejes de la spec §3', () => {
    const byId = new Map(DIM8_REQUIREMENTS_V0.map((r) => [r.id, r]));
    expect(byId.get('dim8.req01')?.dependsOn).toEqual([]);
    expect(byId.get('dim8.req02')?.dependsOn).toEqual(['dim8.req01']);
    expect(byId.get('dim8.req03')?.dependsOn).toEqual(['dim8.req02']);
    expect(byId.get('dim8.req04')?.dependsOn).toEqual(['dim8.req03']);
    expect(byId.get('dim8.req05')?.dependsOn).toEqual(['dim8.req01']);
    expect(byId.get('dim8.req06')?.dependsOn).toEqual(['dim8.req02', 'dim8.req05']);
    expect(byId.get('dim8.req07')?.dependsOn).toEqual(['dim8.req02', 'dim8.req04']);

    expect(byId.get('dim8.req01')?.eje).toBe('completitud');
    expect(byId.get('dim8.req04')?.eje).toBe('validez');
    // El cruce de req07 con req02 no cambia su eje: sigue ciclo-de-vida (dim6.req07).
    expect(byId.get('dim8.req07')?.eje).toBe('ciclo-de-vida');
    for (const id of ['dim8.req02', 'dim8.req03', 'dim8.req05', 'dim8.req06']) {
      expect(byId.get(id)?.eje, id).toBe('completitud');
    }
  });

  it('el dependsOn de req02→req03 y req03→req02 convive sin ciclo: req03 depende de req02 y la ref de tiempo apunta hacia adelante (tensión 2, declarada)', () => {
    const byId = new Map(DIM8_REQUIREMENTS_V0.map((r) => [r.id, r]));
    expect(byId.get('dim8.req03')?.dependsOn).toContain('dim8.req02');
    expect(byId.get('dim8.req02')?.dependsOn).not.toContain('dim8.req03');
    const tiempo = (
      byId.get('dim8.req02')?.payloadSchema['roles']?.type as {
        kind: string;
        of: { kind: string; fields: Record<string, { type: { kind: string; reqId?: string } }> };
      }
    ).of.fields['tiempo'];
    expect(tiempo?.type.kind).toBe('ref');
    expect(tiempo?.type.reqId).toBe('dim8.req03');
  });

  it('la ref de tiempo lleva su cláusula `reference` en req02 y req04 (fail-closed del hallazgo 1, bloqueante de la pasada 2)', () => {
    const byId = new Map(DIM8_REQUIREMENTS_V0.map((r) => [r.id, r]));
    const referencesOf = (id: string): PredicateClause[] => {
      const found: PredicateClause[] = [];
      const visit = (clause: PredicateClause): void => {
        if (clause.kind === 'reference') found.push(clause);
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
      for (const clause of byId.get(id)?.validityPredicate ?? []) visit(clause);
      return found;
    };

    const req02Refs = referencesOf('dim8.req02');
    expect(req02Refs.length).toBe(1);
    expect(req02Refs[0]).toMatchObject({ kind: 'reference', reqId: 'dim8.req03' });

    const req04Refs = referencesOf('dim8.req04');
    expect(req04Refs.length).toBe(1);
    expect(req04Refs[0]).toMatchObject({ kind: 'reference', reqId: 'dim8.req03' });
  });

  it('req06 y req07 cierran `rol` con el enum de los seis roles (D15), no texto libre', () => {
    const byId = new Map(DIM8_REQUIREMENTS_V0.map((r) => [r.id, r]));
    const secuenciaRol = (
      byId.get('dim8.req06')?.payloadSchema['coreografia']?.type as {
        kind: string;
        fields: Record<string, { type: { kind: string; of?: { kind: string; fields: Record<string, { type: { kind: string; values?: string[] } }> } } }>;
      }
    ).fields['secuencia']?.type.of?.fields['rol']?.type;
    expect(secuenciaRol?.kind).toBe('enum');
    expect((secuenciaRol as { values: string[] }).values).toEqual([
      'entrada',
      'salida',
      'transicion',
      'feedback',
      'orientacion',
      'enfasis',
    ]);

    const equivalentesRol = (
      byId.get('dim8.req07')?.payloadSchema['reduccion']?.type as {
        kind: string;
        fields: Record<string, { type: { kind: string; of?: { kind: string; fields: Record<string, { type: { kind: string; values?: string[] } }> } } }>;
      }
    ).fields['equivalentes']?.type.of?.fields['rol']?.type;
    expect(equivalentesRol?.kind).toBe('enum');
    expect((equivalentesRol as { values: string[] }).values).toHaveLength(6);
  });

  it('sin rectorBindings en los siete: el mood wall no gobierna el dominio movimiento (insumo 10)', () => {
    for (const req of DIM8_REQUIREMENTS_V0) {
      expect(req.rectorBindings, req.id).toEqual([]);
    }
  });

  it('ids, packageId y pregunta bien formados, y los kinds proyectados son los 14 reales', () => {
    const kinds = new Set<string>(RULE_KINDS);
    for (const req of DIM8_REQUIREMENTS_V0) {
      expect(PACKAGE_ID_PATTERN.test(req.packageId), `${req.id}:${req.packageId}`).toBe(true);
      expect(req.packageId.startsWith('pkg.movimiento.'), req.id).toBe(true);
      expect(req.pregunta.endsWith('?'), req.id).toBe(true);
      expect(req.estado, req.id).toBe('active');
      for (const dep of req.dependsOn) {
        expect(dep.startsWith('dim8.'), `${req.id}→${dep}`).toBe(true);
      }
      for (const entry of req.mapsToKinds) {
        expect(kinds.has(entry.kind), `${req.id}:${entry.kind}`).toBe(true);
        expect(entry.valueNotes?.length ?? 0, req.id).toBeGreaterThan(0);
      }
    }
  });

  it('las brechas declaradas (mapsToKinds vacío) llevan mappingNotes con "BRECHA DECLARADA"; req03-06 proyectan sólo a `motion`', () => {
    const byId = new Map(DIM8_REQUIREMENTS_V0.map((r) => [r.id, r]));
    for (const id of ['dim8.req01', 'dim8.req02', 'dim8.req07']) {
      const req = byId.get(id);
      expect(req?.mapsToKinds, id).toEqual([]);
      expect(req?.mappingNotes?.length ?? 0, id).toBeGreaterThan(0);
      expect(req?.mappingNotes, id).toContain('BRECHA DECLARADA');
    }
    for (const id of ['dim8.req03', 'dim8.req04', 'dim8.req05', 'dim8.req06']) {
      expect(byId.get(id)?.mapsToKinds.map((e) => e.kind), id).toEqual(['motion']);
    }
    // Ninguna brecha puede quedar en silencio: si no hay kinds, hay nota.
    for (const req of DIM8_REQUIREMENTS_V0) {
      if (req.mapsToKinds.length === 0) {
        expect(req.mappingNotes?.length ?? 0, req.id).toBeGreaterThan(0);
      }
    }
  });

  it('las guías para C2 de las tensiones 4.1 y 4.9 viven en sus notas (hallazgos 6 y 7 de la pasada 2)', () => {
    const byId = new Map(DIM8_REQUIREMENTS_V0.map((r) => [r.id, r]));
    expect(byId.get('dim8.req02')?.mappingNotes).toContain('Guía C2: los dos roles del núcleo web real mapean a entrada');
    expect(byId.get('dim8.req06')?.mapsToKinds[0]?.valueNotes).toContain('delay=0 cuando trigger=load y stagger=0 cuando trigger=hover');
  });

  it('CERO PROSA: la serialización es el dato (round-trip JSON) y cada cláusula es del union conocido', () => {
    const roundTripped = JSON.parse(JSON.stringify(DIM8_MANIFEST_V0));
    expect(roundTripped).toEqual(DIM8_MANIFEST_V0);

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
    for (const req of DIM8_REQUIREMENTS_V0) {
      for (const clause of req.validityPredicate) visit(clause);
    }
  });
});

describe('evaluación de la Dimensión 8 completa', () => {
  it('dimensión resuelta cuando las siete preguntas tienen definición efectiva válida', () => {
    const evaluation = evaluateDim8(resolvedDim8Payloads());
    expect(evaluation.resultado).toBe('resuelto');
    expect(evaluation.contador).toEqual({ resueltos: 7, activos: 7 });
    expect(evaluation.resultados.every((r) => r.resultado === 'resuelto')).toBe(true);
  });

  it('AND estricto (§8.1.2): romper req05 tumba también a su dependiente req06 (5 de 7)', () => {
    const payloads = resolvedDim8Payloads();
    payloads.set('dim8.req05', { disparadores: [] }); // lista vacía: verdad-vacía fail-closed
    const evaluation = evaluateDim8(payloads);
    expect(evaluation.resultado).toBe('no-resuelto');
    // req06 depende de req05 y cae con él (dependencia no resuelta ⇒ no-resuelto): 5 de 7.
    expect(evaluation.contador).toEqual({ resueltos: 5, activos: 7 });
    expect(evaluation.resultados.find((r) => r.requisitoId === 'dim8.req05')?.resultado).toBe(
      'no-resuelto',
    );
    expect(evaluation.resultados.find((r) => r.requisitoId === 'dim8.req06')?.resultado).toBe(
      'no-resuelto',
    );
  });

  it('req02 "covers": falta el rol salida ⇒ no-resuelto, aunque los otros cinco estén completos', () => {
    const payloads = resolvedDim8Payloads();
    const roles = (payloads.get('dim8.req02') as { roles: Array<{ nombre: string }> }).roles;
    payloads.set('dim8.req02', { roles: roles.filter((r) => r.nombre !== 'salida') });
    const evaluation = evaluateDim8(payloads);
    expect(evaluation.resultado).toBe('no-resuelto');
    expect(evaluation.resultados.find((r) => r.requisitoId === 'dim8.req02')?.resultado).toBe(
      'no-resuelto',
    );
  });

  it('req02 "covers": falta el rol enfasis ⇒ no-resuelto (los seis son lista cerrada, D15)', () => {
    const payloads = resolvedDim8Payloads();
    const roles = (payloads.get('dim8.req02') as { roles: Array<{ nombre: string }> }).roles;
    payloads.set('dim8.req02', { roles: roles.filter((r) => r.nombre !== 'enfasis') });
    const evaluation = evaluateDim8(payloads);
    expect(evaluation.resultado).toBe('no-resuelto');
    expect(evaluation.resultados.find((r) => r.requisitoId === 'dim8.req02')?.resultado).toBe(
      'no-resuelto',
    );
  });

  it('req02 "covers": lista de roles vacía ⇒ no resuelve (verdad-vacía fail-closed)', () => {
    const payloads = resolvedDim8Payloads();
    payloads.set('dim8.req02', { roles: [] });
    const evaluation = evaluateDim8(payloads);
    expect(evaluation.resultado).toBe('no-resuelto');
    expect(evaluation.resultados.find((r) => r.requisitoId === 'dim8.req02')?.resultado).toBe(
      'no-resuelto',
    );
  });

  it('req02: un rol no puede declarar "no aplica" y tiempo a la vez ⇒ no-resuelto', () => {
    const payloads = resolvedDim8Payloads();
    const req02 = payloads.get('dim8.req02') as { roles: Array<Record<string, unknown>> };
    req02.roles[5] = { ...req02.roles[5], duracionMs: 200 };
    const evaluation = evaluateDim8(payloads);
    expect(evaluation.resultado).toBe('no-resuelto');
    expect(evaluation.resultados.find((r) => r.requisitoId === 'dim8.req02')?.resultado).toBe(
      'no-resuelto',
    );
  });

  it('req02: un rol sin tiempo y sin razón de ausencia ⇒ no-resuelto (nunca en silencio)', () => {
    const payloads = resolvedDim8Payloads();
    const req02 = payloads.get('dim8.req02') as { roles: Array<Record<string, unknown>> };
    req02.roles[1] = { nombre: 'salida', significado: 'lo que se retira' };
    const evaluation = evaluateDim8(payloads);
    expect(evaluation.resultado).toBe('no-resuelto');
    expect(evaluation.resultados.find((r) => r.requisitoId === 'dim8.req02')?.resultado).toBe(
      'no-resuelto',
    );
  });

  it('req02: una ref de tiempo con `refPath` roto ⇒ no-resuelto (fail-closed del hallazgo 1, bloqueante de la pasada 2)', () => {
    const payloads = resolvedDim8Payloads();
    const req02 = payloads.get('dim8.req02') as { roles: Array<Record<string, unknown>> };
    // `reference` navega la ruta DENTRO del payload de dim8.req03: ['escala', 99, ...] no existe.
    req02.roles[0] = {
      ...req02.roles[0],
      tiempo: { refReqId: 'dim8.req03', refPath: ['escala', 99, 'duracion'] },
    };
    const evaluation = evaluateDim8(payloads);
    expect(evaluation.resultado).toBe('no-resuelto');
    expect(evaluation.resultados.find((r) => r.requisitoId === 'dim8.req02')?.resultado).toBe(
      'no-resuelto',
    );
    // Cascada por dependencia: req06 y req07 dependen de req02 ⇒ 4 de 7.
    // req02 arrastra a req03, req04, req06 y req07 (dependencias); quedan req01 y req05: 2 de 7.
    expect(evaluation.contador).toEqual({ resueltos: 2, activos: 7 });
  });

  it('req04: una ref de tiempo con `refPath` roto ⇒ no-resuelto (mismo fail-closed en los movimientos)', () => {
    const payloads = resolvedDim8Payloads();
    const req04 = payloads.get('dim8.req04') as { movimientos: Array<Record<string, unknown>> };
    req04.movimientos[0] = {
      ...req04.movimientos[0],
      tiempo: { refReqId: 'dim8.req03', refPath: ['escala', 99, 'duracion'] },
    };
    const evaluation = evaluateDim8(payloads);
    expect(evaluation.resultado).toBe('no-resuelto');
    expect(evaluation.resultados.find((r) => r.requisitoId === 'dim8.req04')?.resultado).toBe(
      'no-resuelto',
    );
  });

  it('req03: ritmo sin pausas y sin declarar `sinPausas` ⇒ no-resuelto', () => {
    const payloads = resolvedDim8Payloads();
    const req03 = payloads.get('dim8.req03') as { ritmo: Record<string, unknown> };
    delete req03.ritmo['pausas'];
    const evaluation = evaluateDim8(payloads);
    expect(evaluation.resultado).toBe('no-resuelto');
    expect(evaluation.resultados.find((r) => r.requisitoId === 'dim8.req03')?.resultado).toBe(
      'no-resuelto',
    );
  });

  it('req03: ritmo sin pausas pero con `sinPausas` declarado ⇒ resuelto (vía de ausencia declarada, hallazgo 3)', () => {
    const payloads = resolvedDim8Payloads();
    const req03 = payloads.get('dim8.req03') as { ritmo: Record<string, unknown> };
    delete req03.ritmo['pausas'];
    req03.ritmo['sinPausas'] =
      'este sistema no hace pausas: cada movimiento se encadena con el siguiente sin espera';
    const evaluation = evaluateDim8(payloads);
    expect(evaluation.resultado).toBe('resuelto');
    expect(evaluation.resultados.find((r) => r.requisitoId === 'dim8.req03')?.resultado).toBe(
      'resuelto',
    );
  });

  it('req04: movimientos sin ninguna amplitud y sin "sinAmplitud" declarado ⇒ no-resuelto', () => {
    const payloads = resolvedDim8Payloads();
    payloads.set('dim8.req04', {
      movimientos: [
        {
          caso: 'aparición del titular',
          curva: 'ease-out',
          trayectoria: 'fundido de opacidad',
          continuidadEspacial: 'el bloque no reordena el contenido vecino',
          duracionMs: 500,
        },
      ],
    });
    const evaluation = evaluateDim8(payloads);
    expect(evaluation.resultado).toBe('no-resuelto');
    expect(evaluation.resultados.find((r) => r.requisitoId === 'dim8.req04')?.resultado).toBe(
      'no-resuelto',
    );
  });

  it('req04: "sinAmplitud" declarado cubre los movimientos no espaciales ⇒ resuelto', () => {
    const payloads = resolvedDim8Payloads();
    payloads.set('dim8.req04', {
      movimientos: [
        {
          caso: 'aparición del titular',
          curva: 'ease-out',
          trayectoria: 'fundido de opacidad, sin desplazamiento',
          continuidadEspacial: 'el bloque no reordena el contenido vecino; nada se mueve de lugar',
          duracionMs: 500,
        },
      ],
      sinAmplitud:
        'ningún movimiento de este sistema recorre distancia: son fundidos de opacidad y contadores, no desplazamientos',
    });
    const evaluation = evaluateDim8(payloads);
    expect(evaluation.resultado).toBe('resuelto');
    expect(evaluation.resultados.find((r) => r.requisitoId === 'dim8.req04')?.resultado).toBe(
      'resuelto',
    );
  });

  it('req04: movimiento sin duración ni curva declarada ⇒ no-resuelto (el par no se separa)', () => {
    const payloads = resolvedDim8Payloads();
    payloads.set('dim8.req04', {
      movimientos: [
        {
          caso: 'panel que entra',
          curva: 'cubic-bezier(0.2, 0, 0, 1)',
          trayectoria: 'desde el borde inferior',
          continuidadEspacial: 'sobre la retícula de dim3',
          amplitud: '24px',
        },
      ],
      sinAmplitud: 'no aplica acá: el movimiento sí declara amplitud',
    });
    const evaluation = evaluateDim8(payloads);
    expect(evaluation.resultado).toBe('no-resuelto');
    expect(evaluation.resultados.find((r) => r.requisitoId === 'dim8.req04')?.resultado).toBe(
      'no-resuelto',
    );
  });

  it('req06: una secuencia de un solo elemento ⇒ no-resuelto (la pregunta promete al menos dos, hallazgo 5)', () => {
    const payloads = resolvedDim8Payloads();
    const coreografia = (payloads.get('dim8.req06') as { coreografia: Record<string, unknown> })
      .coreografia;
    coreografia['secuencia'] = [{ orden: 1, elemento: 'titular de portada', rol: 'entrada' }];
    const evaluation = evaluateDim8(payloads);
    expect(evaluation.resultado).toBe('no-resuelto');
    expect(evaluation.resultados.find((r) => r.requisitoId === 'dim8.req06')?.resultado).toBe(
      'no-resuelto',
    );
    // Nada depende de req06: cae sólo él (6 de 7).
    expect(evaluation.contador).toEqual({ resueltos: 6, activos: 7 });
  });

  it('req07: un rol de req02 sin equivalente estático ni razón de ausencia ⇒ no-resuelto (cruce eachIn)', () => {
    const payloads = resolvedDim8Payloads();
    const reduccion = (payloads.get('dim8.req07') as { reduccion: Record<string, unknown> })
      .reduccion;
    reduccion['equivalentes'] = (
      reduccion['equivalentes'] as Array<{ rol: string }>
    ).filter((e) => e.rol !== 'orientacion');
    const evaluation = evaluateDim8(payloads);
    expect(evaluation.resultado).toBe('no-resuelto');
    expect(evaluation.resultados.find((r) => r.requisitoId === 'dim8.req07')?.resultado).toBe(
      'no-resuelto',
    );
    // req07 no tiene dependientes: cae sólo él (6 de 7).
    expect(evaluation.contador).toEqual({ resueltos: 6, activos: 7 });
  });

  it('req07: declarar "sin movimiento decorativo" sin explicar cambio y jerarquía ⇒ no-resuelto', () => {
    const payloads = resolvedDim8Payloads();
    const reduccion = (payloads.get('dim8.req07') as { reduccion: Record<string, unknown> })
      .reduccion;
    reduccion['sinMovimientoDecorativo'] = {
      comoSeComunicaCambio: 'con un cambio visible en el propio control',
    };
    const evaluation = evaluateDim8(payloads);
    expect(evaluation.resultado).toBe('no-resuelto');
    expect(evaluation.resultados.find((r) => r.requisitoId === 'dim8.req07')?.resultado).toBe(
      'no-resuelto',
    );
  });

  it('req07: la explicación sólo se exige si el caso se declara (ausente ⇒ resuelto; completa ⇒ resuelto)', () => {
    const sinCaso = resolvedDim8Payloads();
    const reduccion = (sinCaso.get('dim8.req07') as { reduccion: Record<string, unknown> })
      .reduccion;
    delete reduccion['sinMovimientoDecorativo'];
    expect(
      evaluateDim8(sinCaso).resultados.find((r) => r.requisitoId === 'dim8.req07')?.resultado,
    ).toBe('resuelto');

    const conCaso = resolvedDim8Payloads();
    const completa = (conCaso.get('dim8.req07') as { reduccion: Record<string, unknown> })
      .reduccion;
    completa['sinMovimientoDecorativo'] = {
      comoSeComunicaCambio: 'con un cambio de estado visible en el propio elemento',
      comoSeComunicaJerarquia: 'con escala tipográfica (dim2) y peso visual (dim6)',
    };
    expect(
      evaluateDim8(conCaso).resultados.find((r) => r.requisitoId === 'dim8.req07')?.resultado,
    ).toBe('resuelto');
  });
});
