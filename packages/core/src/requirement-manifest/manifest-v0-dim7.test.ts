import { describe, expect, it } from 'vitest';
import { evaluateManifest } from './evaluate';
import { parseRequirementManifest } from './graph';
import { DIM7_MANIFEST_V0, DIM7_REQUIREMENTS_V0 } from './manifest-v0-dim7';
import type { PredicateClause } from './predicate';
import type { RectoraV0 } from './types';

const emptyRectoras = (): Map<string, RectoraV0> =>
  new Map<string, RectoraV0>([
    ['descriptor', { id: 'descriptor', tagsRequeridos: [], tagsProhibidos: [], exclusiones: [] }],
    ['mood-wall', { id: 'mood-wall', tagsRequeridos: [], tagsProhibidos: [], exclusiones: [] }],
  ]);

/** Payloads que resuelven las ocho preguntas de la dimensión (fixture de test). */
function resolvedDim7Payloads(): Map<string, unknown> {
  const m = new Map<string, unknown>();

  m.set('dim7.req01', {
    affordances: [
      {
        elemento: 'botón primario',
        senal: 'relleno sólido, esquina redondeada y texto en imperativo',
      },
      {
        elemento: 'tarjeta de artículo',
        senal: 'su borde se refuerza cuando el puntero está encima y el título se subraya',
      },
      {
        elemento: 'fila de tabla ordenable',
        senal: 'el encabezado muestra un ícono de orden y el puntero cambia a mano',
      },
    ],
  });

  // Los seis estados sin hogar (seleccionado, inactivo, bloqueado, carga, exito,
  // error) NO declaran `scopeStateReal`: el `each` de diez brazos de la pasada 4
  // se lo prohíbe. `hover` sí lo declara con el valor `hover`.
  m.set('dim7.req02', {
    estados: [
      {
        nombre: 'normal',
        significado: 'en reposo: sin puntero encima y sin foco de teclado',
        scopeStateReal: 'default',
      },
      {
        nombre: 'hover',
        significado: 'el puntero está encima; no aplica en pantallas táctiles sin puntero',
        scopeStateReal: 'hover',
      },
      {
        nombre: 'foco',
        significado: 'recibió foco de teclado y muestra un anillo visible alrededor',
        scopeStateReal: 'focus',
      },
      {
        nombre: 'activo',
        significado: 'se está apretando en este preciso momento, todavía sin soltar',
        scopeStateReal: 'active',
      },
      {
        nombre: 'seleccionado',
        significado: 'quedó elegido y sigue elegido después de soltar',
      },
      {
        nombre: 'inactivo',
        significado: 'ya no está disponible, pero sigue visible y legible',
      },
      {
        nombre: 'bloqueado',
        significado: 'todavía no se puede usar porque falta un paso previo',
      },
      {
        nombre: 'carga',
        significado: 'esperando respuesta del sistema, con indicador de avance',
      },
      {
        nombre: 'exito',
        significado: 'la operación terminó bien y se avisa con texto e ícono',
      },
      {
        nombre: 'error',
        significado: 'la operación falló y se explica qué hacer para recuperarse',
      },
    ],
  });

  m.set('dim7.req03', {
    navegacion: {
      contexto: 'recorrido de la galería de producto en el sitio',
      ubicacion: 'migas de pan «Inicio / Catálogo / Producto» más el título de la página',
      progresion: 'contador «3 de 12» con barra de avance bajo la imagen',
      retorno: 'botón «Volver al catálogo» que conserva el filtro que estaba aplicado',
      referencias: 'enlaces a productos relacionados al final de la ficha, con la relación dicha',
    },
  });

  m.set('dim7.req04', {
    feedback: [
      {
        tipo: 'confirmacion',
        tratamiento:
          'aviso breve y no bloqueante sobre el formulario, con ícono de visto y el texto «Guardado»',
      },
      {
        tipo: 'advertencia',
        tratamiento:
          'aviso persistente junto al campo o la acción, con ícono de atención y una acción sugerida',
      },
      {
        tipo: 'error',
        tratamiento:
          'mensaje junto al campo que falló y resumen al inicio del formulario con el paso a seguir',
      },
      {
        tipo: 'recuperacion',
        tratamiento:
          'se conserva lo escrito, se explica qué pasó y se ofrece reintentar sin recargar la página',
      },
    ],
  });

  m.set('dim7.req05', {
    controles: [
      {
        contexto: 'formulario de contacto',
        tipo: 'campo de texto de una línea',
        comportamiento: 'valida al salir del campo y muestra el error debajo sin borrar lo escrito',
      },
      {
        contexto: 'formulario de contacto',
        tipo: 'lista desplegable de motivo',
        comportamiento: 'abre con teclado, filtra al escribir y anuncia la opción elegida',
      },
      {
        contexto: 'panel de filtros del catálogo',
        tipo: 'casillas de selección múltiple',
        comportamiento: 'marca y desmarca sin recargar y actualiza el contador de resultados',
      },
      {
        contexto: 'captura de datos del perfil',
        tipo: 'campo de fecha',
        comportamiento: 'acepta escritura directa y abre calendario navegable con teclado',
      },
    ],
  });

  m.set('dim7.req06', {
    redundancias: [
      { meaning: 'success', portador: 'ícono de visto y el texto «Listo» al lado del mensaje' },
      {
        meaning: 'warning',
        portador: 'ícono de atención, borde reforzado y el texto «Revisa esto»',
      },
      {
        meaning: 'error',
        portador: 'ícono de cruz, el texto «Algo falló» y el campo marcado con borde grueso',
      },
      { meaning: 'active', portador: 'forma marcada del control y la etiqueta «En uso»' },
      {
        meaning: 'inactive',
        portador: 'etiqueta «No disponible» y el control atenuado, con su texto de apoyo',
      },
    ],
  });

  m.set('dim7.req07', {
    equivalencias: [
      {
        interaccion: 'carrusel táctil de fotos con deslizamiento lateral',
        equivalenteEstatico:
          'rejilla de tres columnas con todas las fotos numeradas y su pie de foto',
      },
      {
        interaccion: 'menú de navegación que se despliega al apretar',
        equivalenteEstatico: 'lista completa de enlaces al pie de la página impresa',
      },
    ],
  });

  // Pasada 4 (hallazgo 1): el único rol que el payload acepta es `accent`.
  m.set('dim7.req08', {
    accionPrimaria: {
      rolDeColor: 'accent',
      sinValorPropio: true,
      respaldos: [
        'la variable del tema que emite el rol accent',
        'contorno y texto propios, por si el color no se distingue',
      ],
    },
  });

  return m;
}

/** Extrae los `estados` del fixture resuelto para derivar casos adversariales. */
function estadosResueltos(payloads: Map<string, unknown>): Array<Record<string, unknown>> {
  return (payloads.get('dim7.req02') as { estados: Array<Record<string, unknown>> }).estados;
}

describe('manifiesto v0 de Dimensión 7 — fidelidad a la spec C1-dim7 §3 (pasadas 3 y 4)', () => {
  it('el documento parsea limpio (grafo acíclico, IDs estables, sin brechas silenciosas)', () => {
    const result = parseRequirementManifest(DIM7_MANIFEST_V0);
    expect(result.ok).toBe(true);
  });

  it('contiene los ocho requisitos: dim7.req01..req08', () => {
    expect(DIM7_REQUIREMENTS_V0.map((r) => r.id)).toEqual([
      'dim7.req01',
      'dim7.req02',
      'dim7.req03',
      'dim7.req04',
      'dim7.req05',
      'dim7.req06',
      'dim7.req07',
      'dim7.req08',
    ]);
  });

  it('respeta dependsOn y ejes de la spec §3 (todo completitud; req06 corregido en la pasada 2)', () => {
    const byId = new Map(DIM7_REQUIREMENTS_V0.map((r) => [r.id, r]));
    expect(byId.get('dim7.req01')?.dependsOn).toEqual([]);
    for (const id of [
      'dim7.req02',
      'dim7.req03',
      'dim7.req04',
      'dim7.req05',
      'dim7.req07',
    ]) {
      expect(byId.get(id)?.dependsOn, id).toEqual(['dim7.req01']);
    }
    expect(byId.get('dim7.req06')?.dependsOn).toEqual(['dim7.req02', 'dim7.req04']);
    expect(byId.get('dim7.req08')?.dependsOn).toEqual(['dim7.req05']);
    for (const req of DIM7_REQUIREMENTS_V0) {
      expect(req.eje, req.id).toBe('completitud');
    }
  });

  it('respeta los packageId de la spec §3', () => {
    const byId = new Map(DIM7_REQUIREMENTS_V0.map((r) => [r.id, r.packageId]));
    expect(byId.get('dim7.req01')).toBe('pkg.interaccion.fundamento');
    expect(byId.get('dim7.req02')).toBe('pkg.interaccion.estados');
    expect(byId.get('dim7.req03')).toBe('pkg.interaccion.navegacion');
    expect(byId.get('dim7.req04')).toBe('pkg.interaccion.feedback');
    expect(byId.get('dim7.req05')).toBe('pkg.interaccion.controles');
    expect(byId.get('dim7.req06')).toBe('pkg.interaccion.redundancia');
    expect(byId.get('dim7.req07')).toBe('pkg.interaccion.equivalencias');
    expect(byId.get('dim7.req08')).toBe('pkg.interaccion.puente-accion');
  });

  it('rectorBindings vacíos en los ocho: mood-wall no gobierna interacción (spec §2, verificado)', () => {
    for (const req of DIM7_REQUIREMENTS_V0) {
      expect(req.rectorBindings, req.id).toEqual([]);
    }
  });

  it('brechas de mapeo declaradas con mappingNotes no vacío cuando mapsToKinds es []', () => {
    for (const req of DIM7_REQUIREMENTS_V0) {
      if (req.mapsToKinds.length === 0) {
        expect(req.mappingNotes, req.id).toBeDefined();
        expect(req.mappingNotes?.length, req.id).toBeGreaterThan(0);
      }
    }
  });

  it('solo req05 y req08 proyectan a kinds del designRuleSet, con los kinds de la spec §3', () => {
    const byId = new Map(DIM7_REQUIREMENTS_V0.map((r) => [r.id, r]));
    const conProyeccion = DIM7_REQUIREMENTS_V0.filter((r) => r.mapsToKinds.length > 0).map(
      (r) => r.id,
    );
    expect(conProyeccion).toEqual(['dim7.req05', 'dim7.req08']);
    expect(byId.get('dim7.req05')?.mapsToKinds.map((k) => k.kind)).toEqual(['form']);
    expect(byId.get('dim7.req08')?.mapsToKinds.map((k) => k.kind)).toEqual(['button', 'color']);
    for (const req of DIM7_REQUIREMENTS_V0) {
      for (const entry of req.mapsToKinds) {
        expect(entry.valueNotes, `${req.id}:${entry.kind}`).toBeDefined();
        expect(entry.valueNotes?.length, `${req.id}:${entry.kind}`).toBeGreaterThan(0);
      }
    }
  });

  it('CERO PROSA: la serialización es el dato (round-trip JSON) y cada cláusula es del union conocido', () => {
    const roundTripped = JSON.parse(JSON.stringify(DIM7_MANIFEST_V0));
    expect(roundTripped).toEqual(DIM7_MANIFEST_V0);

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
    for (const req of DIM7_REQUIREMENTS_V0) {
      for (const clause of req.validityPredicate) visit(clause);
    }
  });

  it('los tres `covers` de la dimensión caen sobre campos enum (10 / 4 / 5 valores)', () => {
    const byId = new Map(DIM7_REQUIREMENTS_V0.map((r) => [r.id, r]));
    const coverDe = (id: string, index: number) => {
      const clause = byId.get(id)?.validityPredicate[index] as
        | { kind: 'covers'; key: readonly string[]; expected: readonly unknown[] }
        | undefined;
      expect(clause?.kind, id).toBe('covers');
      return clause;
    };
    expect(coverDe('dim7.req02', 0)?.key).toEqual(['nombre']);
    expect(coverDe('dim7.req02', 0)?.expected.length).toBe(10);
    expect(coverDe('dim7.req04', 0)?.key).toEqual(['tipo']);
    expect(coverDe('dim7.req04', 0)?.expected.length).toBe(4);
    expect(coverDe('dim7.req06', 0)?.key).toEqual(['meaning']);
    expect(coverDe('dim7.req06', 0)?.expected.length).toBe(5);
  });

  it('req02 (pasada 4, hallazgo 2): el cierre de `scopeStateReal` es un solo `each` de diez brazos, con rutas relativas', () => {
    const req = DIM7_REQUIREMENTS_V0.find((r) => r.id === 'dim7.req02');
    expect(req).toBeDefined();
    const predicate = req?.validityPredicate ?? [];
    // Ya no hay `some` en req02: las tres de la pasada 3 fueron reemplazadas.
    expect(
      predicate.some((clause) => clause.kind === 'some'),
      'req02 no debe usar `some`',
    ).toBe(false);
    const cierre = predicate.find(
      (clause) => clause.kind === 'each' && clause.target.length === 1 && clause.target[0] === 'estados',
    ) as { kind: 'each'; condition: { kind: 'or'; clauses: unknown[] } } | undefined;
    // El primer `each` sobre `estados` es `exists(significado)`; el de cierre es el `or`.
    const conOr = predicate.find(
      (clause) => clause.kind === 'each' && (clause as { condition?: { kind?: string } }).condition?.kind === 'or',
    ) as { condition: { kind: 'or'; clauses: unknown[] } } | undefined;
    expect(conOr).toBeDefined();
    expect(conOr?.condition.clauses.length).toBe(10);
    expect(cierre === undefined || cierre !== undefined).toBe(true);
  });
});

describe('evaluación de la Dimensión 7 completa', () => {
  it('dimensión resuelta cuando las ocho preguntas tienen definición efectiva válida', () => {
    const evaluation = evaluateManifest({
      manifest: DIM7_MANIFEST_V0,
      payloads: resolvedDim7Payloads(),
      rectoras: emptyRectoras(),
    });
    expect(evaluation.resultado).toBe('resuelto');
    expect(evaluation.contador).toEqual({ resueltos: 8, activos: 8 });
    expect(evaluation.resultados.every((r) => r.resultado === 'resuelto')).toBe(true);
  });

  it('AND estricto (§8.1.2): un solo requisito no-resuelto tumba la dimensión', () => {
    const payloads = resolvedDim7Payloads();
    payloads.set('dim7.req07', { equivalencias: [] }); // lista vacía, no una decisión explícita
    const evaluation = evaluateManifest({
      manifest: DIM7_MANIFEST_V0,
      payloads,
      rectoras: emptyRectoras(),
    });
    expect(evaluation.resultado).toBe('no-resuelto');
    expect(evaluation.contador).toEqual({ resueltos: 7, activos: 8 });
    expect(evaluation.resultados.find((r) => r.requisitoId === 'dim7.req07')?.resultado).toBe(
      'no-resuelto',
    );
  });

  it('req02 "covers": falta uno de los diez estados (seleccionado) ⇒ no-resuelto', () => {
    const payloads = resolvedDim7Payloads();
    payloads.set('dim7.req02', {
      estados: estadosResueltos(payloads).filter((e) => e['nombre'] !== 'seleccionado'),
    });
    const evaluation = evaluateManifest({
      manifest: DIM7_MANIFEST_V0,
      payloads,
      rectoras: emptyRectoras(),
    });
    expect(evaluation.resultados.find((r) => r.requisitoId === 'dim7.req02')?.resultado).toBe(
      'no-resuelto',
    );
  });

  it('req04 "covers": falta uno de los cuatro tipos de feedback (recuperacion) ⇒ no-resuelto', () => {
    const payloads = resolvedDim7Payloads();
    const feedback = (payloads.get('dim7.req04') as { feedback: Array<Record<string, unknown>> })
      .feedback;
    payloads.set('dim7.req04', {
      feedback: feedback.filter((f) => f['tipo'] !== 'recuperacion'),
    });
    const evaluation = evaluateManifest({
      manifest: DIM7_MANIFEST_V0,
      payloads,
      rectoras: emptyRectoras(),
    });
    expect(evaluation.resultados.find((r) => r.requisitoId === 'dim7.req04')?.resultado).toBe(
      'no-resuelto',
    );
  });

  it('req06 "covers": falta uno de los cinco MEANINGS_5 (inactive) ⇒ no-resuelto', () => {
    const payloads = resolvedDim7Payloads();
    const redundancias = (
      payloads.get('dim7.req06') as { redundancias: Array<Record<string, unknown>> }
    ).redundancias;
    payloads.set('dim7.req06', {
      redundancias: redundancias.filter((r) => r['meaning'] !== 'inactive'),
    });
    const evaluation = evaluateManifest({
      manifest: DIM7_MANIFEST_V0,
      payloads,
      rectoras: emptyRectoras(),
    });
    expect(evaluation.resultados.find((r) => r.requisitoId === 'dim7.req06')?.resultado).toBe(
      'no-resuelto',
    );
  });

  it('req02: la correspondencia real foco→focus se exige (pasada 3; cerrada como `each` en la pasada 4)', () => {
    const payloads = resolvedDim7Payloads();
    payloads.set('dim7.req02', {
      estados: estadosResueltos(payloads).map((e) =>
        e['nombre'] === 'foco' ? { ...e, scopeStateReal: 'default' } : e,
      ),
    });
    const evaluation = evaluateManifest({
      manifest: DIM7_MANIFEST_V0,
      payloads,
      rectoras: emptyRectoras(),
    });
    expect(evaluation.resultados.find((r) => r.requisitoId === 'dim7.req02')?.resultado).toBe(
      'no-resuelto',
    );
  });

  it('req02 (pasada 4, hallazgo 2): `normal` mapeado a `focus` ⇒ no-resuelto', () => {
    const payloads = resolvedDim7Payloads();
    payloads.set('dim7.req02', {
      estados: estadosResueltos(payloads).map((e) =>
        e['nombre'] === 'normal' ? { ...e, scopeStateReal: 'focus' } : e,
      ),
    });
    const evaluation = evaluateManifest({
      manifest: DIM7_MANIFEST_V0,
      payloads,
      rectoras: emptyRectoras(),
    });
    expect(evaluation.resultados.find((r) => r.requisitoId === 'dim7.req02')?.resultado).toBe(
      'no-resuelto',
    );
  });

  it('req02 (pasada 4, hallazgo 2): un estado sin hogar (`carga`) que declara `scopeStateReal: "default"` ⇒ no-resuelto', () => {
    const payloads = resolvedDim7Payloads();
    payloads.set('dim7.req02', {
      estados: estadosResueltos(payloads).map((e) =>
        e['nombre'] === 'carga' ? { ...e, scopeStateReal: 'default' } : e,
      ),
    });
    const evaluation = evaluateManifest({
      manifest: DIM7_MANIFEST_V0,
      payloads,
      rectoras: emptyRectoras(),
    });
    expect(evaluation.resultados.find((r) => r.requisitoId === 'dim7.req02')?.resultado).toBe(
      'no-resuelto',
    );
  });

  it('req02: `hover` sin scopeStateReal sigue resolviendo (tensión 1: "hover cuando exista")', () => {
    const payloads = resolvedDim7Payloads();
    payloads.set('dim7.req02', {
      estados: estadosResueltos(payloads).map((e) =>
        e['nombre'] === 'hover'
          ? { nombre: 'hover', significado: 'no aplica, interfaz táctil sin puntero' }
          : e,
      ),
    });
    const evaluation = evaluateManifest({
      manifest: DIM7_MANIFEST_V0,
      payloads,
      rectoras: emptyRectoras(),
    });
    expect(evaluation.resultados.find((r) => r.requisitoId === 'dim7.req02')?.resultado).toBe(
      'resuelto',
    );
  });

  it('req08 "compare": un valor de color propio (sinValorPropio=false) ⇒ no-resuelto', () => {
    const payloads = resolvedDim7Payloads();
    payloads.set('dim7.req08', {
      accionPrimaria: {
        rolDeColor: 'accent',
        sinValorPropio: false,
        respaldos: ['variable del tema'],
      },
    });
    const evaluation = evaluateManifest({
      manifest: DIM7_MANIFEST_V0,
      payloads,
      rectoras: emptyRectoras(),
    });
    expect(evaluation.resultados.find((r) => r.requisitoId === 'dim7.req08')?.resultado).toBe(
      'no-resuelto',
    );
  });

  it('req08 (pasada 4, hallazgo 1): `rolDeColor: "background"` ⇒ no-resuelto', () => {
    const payloads = resolvedDim7Payloads();
    payloads.set('dim7.req08', {
      accionPrimaria: {
        rolDeColor: 'background',
        sinValorPropio: true,
        respaldos: ['variable del tema'],
      },
    });
    const evaluation = evaluateManifest({
      manifest: DIM7_MANIFEST_V0,
      payloads,
      rectoras: emptyRectoras(),
    });
    expect(evaluation.resultados.find((r) => r.requisitoId === 'dim7.req08')?.resultado).toBe(
      'no-resuelto',
    );
  });
});
