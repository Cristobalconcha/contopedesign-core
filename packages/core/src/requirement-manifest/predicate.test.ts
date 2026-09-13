import { describe, expect, it } from 'vitest';
import { evaluatePredicate, type PredicateClause, type PredicateEvalContext } from './predicate';
import type { PayloadSchema, RectoraV0, VerificationRecordV0 } from './types';

function evalPred(
  clauses: readonly PredicateClause[],
  payload: Record<string, unknown>,
  opts: {
    selfId?: string;
    store?: Map<string, Record<string, unknown>>;
    rectoras?: Map<string, RectoraV0>;
    payloadSchema?: PayloadSchema;
    verifications?: Map<string, VerificationRecordV0>;
  } = {},
) {
  const ctx: PredicateEvalContext = {
    selfId: opts.selfId ?? 'dim1.req99',
    payload,
    payloadSchema: opts.payloadSchema ?? {},
    store: opts.store ?? new Map(),
    rectoras: opts.rectoras ?? new Map(),
    ...(opts.verifications !== undefined ? { verifications: opts.verifications } : {}),
  };
  return evaluatePredicate(clauses, ctx);
}

const str = (value: string) => ({ kind: 'string' as const, value });
const num = (value: number) => ({ kind: 'number' as const, value });
const path = (...parts: (string | number)[]) => ({ kind: 'path' as const, path: parts });

describe('gramática del validityPredicate — cláusulas base (§2.1)', () => {
  it('exists: presente y no vacío', () => {
    expect(evalPred([{ kind: 'exists', target: ['a'] }], { a: [1] }).ok).toBe(true);
    expect(evalPred([{ kind: 'exists', target: ['a'] }], { a: [] }).ok).toBe(false);
    expect(evalPred([{ kind: 'exists', target: ['b'] }], { b: '' }).ok).toBe(false);
    const missing = evalPred([{ kind: 'exists', target: ['x'] }], {});
    expect(missing.ok).toBe(false);
    expect(missing.motivos[0]?.codigo).toBe('referencia-no-resoluble');
  });

  it('singleton: exactamente un valor, sin segundo valor', () => {
    expect(evalPred([{ kind: 'singleton', target: ['s'] }], { s: { role: 'accent' } }).ok).toBe(true);
    expect(evalPred([{ kind: 'singleton', target: ['s'] }], { s: ['unico'] }).ok).toBe(true);
    const second = evalPred([{ kind: 'singleton', target: ['s'] }], { s: ['a', 'b'] });
    expect(second.ok).toBe(false);
    expect(second.motivos[0]?.codigo).toBe('segundo-valor');
    expect(evalPred([{ kind: 'singleton', target: ['s'] }], {}).ok).toBe(false);
  });

  it('covers: cubre toda la lista cerrada (key simple)', () => {
    const clause: PredicateClause = {
      kind: 'covers',
      target: ['roles'],
      key: ['role'],
      expected: [str('a'), str('b')],
    };
    expect(evalPred([clause], { roles: [{ role: 'a' }, { role: 'b' }] }).ok).toBe(true);
    const missing = evalPred([clause], { roles: [{ role: 'a' }] });
    expect(missing.ok).toBe(false);
    expect(missing.motivos[0]?.mensaje).toContain("no cubre 'b'");
    const empty = evalPred([clause], { roles: [] });
    expect(empty.ok).toBe(false);
    expect(empty.motivos[0]?.codigo).toBe('coleccion-vacia');
  });

  it('covers: key compuesta exige tuplas', () => {
    const clause: PredicateClause = {
      kind: 'covers',
      target: ['sc'],
      key: ['role', 'state'],
      expected: [
        { kind: 'tuple', items: [str('action'), str('default')] },
        { kind: 'tuple', items: [str('focus'), str('hover')] },
      ],
    };
    expect(
      evalPred(
        [clause],
        {
          sc: [
            { role: 'action', state: 'default' },
            { role: 'focus', state: 'hover' },
          ],
        },
      ).ok,
    ).toBe(true);
    const missing = evalPred([clause], { sc: [{ role: 'action', state: 'default' }] });
    expect(missing.ok).toBe(false);
    expect(missing.motivos[0]?.mensaje).toContain("no cubre ('focus', 'hover')");
  });

  it('each: toda entrada cumple; vacío ⇒ fail-closed; primera entrada fallida reportada', () => {
    const clause: PredicateClause = { kind: 'each', target: ['xs'], condition: { kind: 'exists', target: ['name'] } };
    expect(evalPred([clause], { xs: [{ name: 'a' }, { name: 'b' }] }).ok).toBe(true);
    const fail = evalPred([clause], { xs: [{ name: 'a' }, {}] });
    expect(fail.ok).toBe(false);
    expect(fail.motivos[0]?.mensaje).toContain("each('xs')[1]");
    const empty = evalPred([clause], { xs: [] });
    expect(empty.ok).toBe(false);
    expect(empty.motivos[0]?.codigo).toBe('sin-entradas-que-verificar');
  });

  it('some (extensión): existe al menos una entrada; vacío ⇒ fail-closed', () => {
    const clause: PredicateClause = {
      kind: 'some',
      target: ['xs'],
      alias: 'x',
      condition: { kind: 'compare', op: '==', left: path('x', 'name'), right: str('b') },
    };
    expect(evalPred([clause], { xs: [{ name: 'a' }, { name: 'b' }] }).ok).toBe(true);
    expect(evalPred([clause], { xs: [{ name: 'a' }] }).ok).toBe(false);
    expect(evalPred([clause], { xs: [] }).ok).toBe(false);
  });

  it('everyPar: componentes declaradas deben existir; cond sobre campos de tupla y slots', () => {
    const clause: PredicateClause = {
      kind: 'everyPar',
      target: ['m'],
      components: ['fg', 'bg'],
      condition: { kind: 'compare', op: '>=', left: path('ratio'), right: path('umbral') },
    };
    expect(
      evalPred([clause], {
        umbral: 4.5,
        m: [{ fg: '#111', bg: '#fff', ratio: 9.1 }, { fg: '#111', bg: '#eee', ratio: 12 }],
      }).ok,
    ).toBe(true);
    const missingComponent = evalPred([clause], { umbral: 4.5, m: [{ fg: '#111', ratio: 9.1 }] });
    expect(missingComponent.ok).toBe(false);
    expect(missingComponent.motivos[0]?.codigo).toBe('componente-ausente');
    const empty = evalPred([clause], { umbral: 4.5, m: [] });
    expect(empty.ok).toBe(false);
    expect(empty.motivos[0]?.codigo).toBe('sin-entradas-que-verificar');
  });

  it('and: pasa solo si todas pasan; recoge TODOS los motivos; vacío prohibido', () => {
    const clause: PredicateClause = {
      kind: 'and',
      clauses: [{ kind: 'exists', target: ['a'] }, { kind: 'exists', target: ['b'] }],
    };
    expect(evalPred([clause], { a: 1, b: 2 }).ok).toBe(true);
    const fail = evalPred([clause], {});
    expect(fail.ok).toBe(false);
    expect(fail.motivos.length).toBe(2);
    expect(evalPred([{ kind: 'and', clauses: [] }], {}).ok).toBe(false);
  });

  it('or: primer operando true gana; todos false ⇒ motivos del primero; mínimo 2 operandos', () => {
    const clause: PredicateClause = {
      kind: 'or',
      clauses: [{ kind: 'exists', target: ['x'] }, { kind: 'exists', target: ['y'] }],
    };
    expect(evalPred([clause], { y: 1 }).ok).toBe(true);
    const fail = evalPred([clause], {});
    expect(fail.ok).toBe(false);
    expect(fail.motivos.length).toBe(1);
    expect(evalPred([{ kind: 'or', clauses: [{ kind: 'exists', target: ['x'] }] }], {}).ok).toBe(false);
  });

  it('not: invierte; falla con motivo cuando la interna se cumple', () => {
    expect(evalPred([{ kind: 'not', clause: { kind: 'exists', target: ['x'] } }], {}).ok).toBe(true);
    const fail = evalPred([{ kind: 'not', clause: { kind: 'exists', target: ['x'] } }], { x: 1 });
    expect(fail.ok).toBe(false);
    expect(fail.motivos[0]?.codigo).toBe('not');
  });

  it('compare: los seis operadores numéricos con tolerancia para sumas', () => {
    const mk = (op: '==' | '!=' | '<' | '<=' | '>' | '>=') =>
      ({ kind: 'compare', op, left: path('n'), right: num(2) }) as PredicateClause;
    expect(evalPred([mk('==')], { n: 2 }).ok).toBe(true);
    expect(evalPred([mk('!=')], { n: 3 }).ok).toBe(true);
    expect(evalPred([mk('<')], { n: 1 }).ok).toBe(true);
    expect(evalPred([mk('<=')], { n: 2 }).ok).toBe(true);
    expect(evalPred([mk('>')], { n: 3 }).ok).toBe(true);
    expect(evalPred([mk('>=')], { n: 2 }).ok).toBe(true);
    expect(evalPred([mk('>')], { n: 1 }).ok).toBe(false);
    const eps = evalPred(
      [{ kind: 'compare', op: '==', left: path('n'), right: num(0.3) } as PredicateClause],
      { n: 0.1 + 0.2 },
    );
    expect(eps.ok).toBe(true); // 0.3 vs 0.1+0.2 (0.30000000000000004) con tolerancia 1e-9
  });

  it('compare: tipos — texto/enum/bool solo ==/!=; tipos incompatibles ⇒ false con motivo', () => {
    const mk = (op: '==' | '!=' | '<', left: unknown, right: unknown) =>
      ({ kind: 'compare', op, left, right }) as PredicateClause;
    expect(evalPred([mk('==', path('t'), str('x'))], { t: 'x' }).ok).toBe(true);
    expect(evalPred([mk('!=', path('t'), str('x'))], { t: 'y' }).ok).toBe(true);
    const textOrder = evalPred([mk('<', path('t'), str('x'))], { t: 'y' });
    expect(textOrder.ok).toBe(false);
    expect(textOrder.motivos[0]?.codigo).toBe('tipo-incompatible');
    const mixed = evalPred([mk('==', path('t'), num(1))], { t: '1' });
    expect(mixed.ok).toBe(false);
    expect(mixed.motivos[0]?.codigo).toBe('tipo-incompatible');
    const bools = evalPred([mk('==', path('b'), { kind: 'boolean', value: true })], { b: true });
    expect(bools.ok).toBe(true);
  });

  it('compareCss: unidades absolutas y rem (fijo 16px) comparan por valor en px', () => {
    const mk = (op: '==' | '!=' | '<' | '<=' | '>' | '>=', left: string, right: string) =>
      ({ kind: 'compareCss', cssType: 'longitud-css', op, left: str(left), right: str(right) }) as PredicateClause;
    expect(evalPred([mk('>=', '24px', '16px')], {}).ok).toBe(true);
    expect(evalPred([mk('>=', '16px', '24px')], {}).ok).toBe(false);
    expect(evalPred([mk('==', '1rem', '16px')], {}).ok).toBe(true); // rem fijo a 16px
    expect(evalPred([mk('>', '2rem', '16px')], {}).ok).toBe(true); // 32px > 16px
    expect(evalPred([mk('<=', '1in', '96px')], {}).ok).toBe(true); // 1in = 96px exacto
    expect(evalPred([mk('!=', '10px', '20px')], {}).ok).toBe(true);
    expect(evalPred([mk('==', '0', '0px')], {}).ok).toBe(true); // cero sin unidad
  });

  it('compareCss: unidades relativas (em/%/vh/vw/ch/ex) fallan fail-closed, nunca adivinan', () => {
    const relatives = ['1em', '50%', '10vh', '10vw', '2ch', '1ex'];
    for (const rel of relatives) {
      const r = evalPred(
        [{ kind: 'compareCss', cssType: 'longitud-css', op: '>=', left: str(rel), right: str('16px') } as PredicateClause],
        {},
      );
      expect(r.ok).toBe(false);
      expect(r.motivos[0]?.codigo).toBe('unidad-no-comparable');
    }
  });

  it('compareCss: valor no longitud-css válida ⇒ false con motivo dedicado', () => {
    const r = evalPred(
      [{ kind: 'compareCss', cssType: 'longitud-css', op: '>=', left: str('no-es-css'), right: str('16px') } as PredicateClause],
      {},
    );
    expect(r.ok).toBe(false);
    expect(r.motivos[0]?.codigo).toBe('valor-css-invalido');
  });

  it('sum: suma campos numéricos; vacío ⇒ fail-closed; entrada no numérica ⇒ false', () => {
    const clause = { kind: 'compare', op: '==' as const, left: { kind: 'sum', collection: ['xs'], field: 'w' }, right: num(1) } as PredicateClause;
    expect(evalPred([clause], { xs: [{ w: 0.4 }, { w: 0.6 }] }).ok).toBe(true);
    const empty = evalPred([clause], { xs: [] });
    expect(empty.ok).toBe(false);
    expect(empty.motivos[0]?.codigo).toBe('coleccion-vacia');
    const nonNumeric = evalPred([clause], { xs: [{ w: 'x' }] });
    expect(nonNumeric.ok).toBe(false);
    expect(nonNumeric.motivos[0]?.codigo).toBe('sum-no-numerico');
  });

  it('count: cardinal; vacío ⇒ fail-closed (decisión 2, no "0")', () => {
    const clause = { kind: 'compare', op: '>=' as const, left: { kind: 'count', target: ['xs'] }, right: num(2) } as PredicateClause;
    expect(evalPred([clause], { xs: [1, 2, 3] }).ok).toBe(true);
    const empty = evalPred([clause], { xs: [] });
    expect(empty.ok).toBe(false);
    expect(empty.motivos[0]?.codigo).toBe('coleccion-vacia');
  });

  it('reference: exige ref al reqId, resoluble en el store; duplicar el valor prohibido', () => {
    const store = new Map([['dim1.req01', { v: '#fff' }]]);
    const clause: PredicateClause = { kind: 'reference', target: ['color'], reqId: 'dim1.req01' };
    expect(evalPred([clause], { color: { refReqId: 'dim1.req01', refPath: ['v'] } }, { store }).ok).toBe(true);
    const duplicated = evalPred([clause], { color: '#fff' }, { store });
    expect(duplicated.ok).toBe(false);
    expect(duplicated.motivos[0]?.codigo).toBe('referencia-no-es-ref');
    const wrongReq = evalPred([clause], { color: { refReqId: 'dim1.req02', refPath: [] } }, { store });
    expect(wrongReq.motivos[0]?.codigo).toBe('referencia-reqid');
    const broken = evalPred([clause], { color: { refReqId: 'dim1.req01', refPath: ['v'] } }, {});
    expect(broken.motivos[0]?.codigo).toBe('referencia-rota');
  });

  it('validCss: valida color-css plano, incluso resolviendo refs por el store', () => {
    const clause: PredicateClause = { kind: 'validCss', target: ['c'], cssType: 'color-css' };
    expect(evalPred([clause], { c: '#fff' }).ok).toBe(true);
    expect(evalPred([clause], { c: 'red' }).ok).toBe(false);
    const store = new Map([['dim1.req01', { v: '#1d4ed8' }]]);
    expect(evalPred([clause], { c: { refReqId: 'dim1.req01', refPath: ['v'] } }, { store }).ok).toBe(true);
  });

  it('verified: exige verificación registrada', () => {
    const clause: PredicateClause = { kind: 'verified', pruebaId: 'contrast-matrix' };
    expect(evalPred([clause], {}).ok).toBe(false);
    const verifications = new Map<string, VerificationRecordV0>([
      ['contrast-matrix', { pruebaId: 'contrast-matrix', fecha: '2026-08-30', evidencia: 'matriz auditada' }],
    ]);
    expect(evalPred([clause], {}, { verifications }).ok).toBe(true);
  });

  it('noConflict (cláusula): delega en §8.2 contra el dominio del payload', () => {
    const schema: PayloadSchema = { nota: { type: { kind: 'texto' } } };
    const rectoras = new Map<string, RectoraV0>([
      ['mood-wall', { id: 'mood-wall', tagsRequeridos: [], tagsProhibidos: ['neón'], exclusiones: [] }],
    ]);
    const clause: PredicateClause = { kind: 'noConflict', rectoraId: 'mood-wall' };
    expect(evalPred([clause], { nota: 'paleta sobria' }, { rectoras, payloadSchema: schema }).ok).toBe(true);
    const fail = evalPred([clause], { nota: 'neón' }, { rectoras, payloadSchema: schema });
    expect(fail.ok).toBe(false);
    expect(fail.motivos[0]?.codigo).toBe('no-conflict-anti-tag');
  });
});

describe('EXTENSIÓN R1 — cuantificación cruzada entre requisitos', () => {
  const store = new Map<string, Record<string, unknown>>([
    ['dim1.req01', { institucionales: [{ name: 'azul' }, { name: 'verde' }] }],
    ['dim1.req02', { roleColors: [{ role: 'background' }] }],
  ]);

  it('eachIn: cada entrada del slot RESUELTO de otro requisito cumple; store ausente ⇒ fail-closed', () => {
    const clause: PredicateClause = {
      kind: 'eachIn',
      reqId: 'dim1.req01',
      path: ['institucionales'],
      alias: 'f',
      condition: { kind: 'exists', target: ['f', 'name'] },
    };
    expect(evalPred([clause], {}, { store }).ok).toBe(true);
    const absent = evalPred([clause], {}, {});
    expect(absent.ok).toBe(false);
    expect(absent.motivos[0]?.codigo).toBe('definicion-ausente');
    const emptyStore = new Map<string, Record<string, unknown>>([['dim1.req01', { institucionales: [] }]]);
    const empty = evalPred([clause], {}, { store: emptyStore });
    expect(empty.ok).toBe(false);
    expect(empty.motivos[0]?.codigo).toBe('sin-entradas-que-verificar');
  });

  it('someIn: existencia sobre el payload resuelto de otro requisito', () => {
    const clause: PredicateClause = {
      kind: 'someIn',
      reqId: 'dim1.req01',
      path: ['institucionales'],
      alias: 'f',
      condition: { kind: 'compare', op: '==', left: path('f', 'name'), right: str('verde') },
    };
    expect(evalPred([clause], {}, { store }).ok).toBe(true);
    expect(
      evalPred(
        [{ ...clause, condition: { kind: 'compare', op: '==', left: path('f', 'name'), right: str('rojo') } }],
        {},
        { store },
      ).ok,
    ).toBe(false);
  });

  it('everyDef: cuantifica sobre definiciones resueltas de la dimensión (excluye self); vacío ⇒ fail-closed', () => {
    const always: PredicateClause = { kind: 'exists', target: ['pl'] };
    const clause: PredicateClause = {
      kind: 'everyDef',
      dimensionId: 'dim1',
      reqAlias: 'rid',
      payloadAlias: 'pl',
      condition: always,
    };
    expect(evalPred([clause], {}, { store, selfId: 'dim1.req09' }).ok).toBe(true);

    const onlySelf = new Map<string, Record<string, unknown>>([['dim1.req09', {}]]);
    const empty = evalPred([clause], {}, { store: onlySelf, selfId: 'dim1.req09' });
    expect(empty.ok).toBe(false);
    expect(empty.motivos[0]?.codigo).toBe('sin-definiciones-que-verificar');

    const failing: PredicateClause = {
      ...clause,
      condition: { kind: 'compare', op: '==', left: path('rid'), right: str('dim1.req02') },
    };
    const fail = evalPred([failing], {}, { store, selfId: 'dim1.req09' });
    expect(fail.ok).toBe(false);
    expect(fail.motivos[0]?.mensaje).toContain('everyDef(dim1.req01)');
  });

  it('containsNoneOf: ninguna hoja string contiene los literales (substring); resuelve aliases y listas del propio payload', () => {
    const clause: PredicateClause = {
      kind: 'everyDef',
      dimensionId: 'dim1',
      reqAlias: 'rid',
      payloadAlias: 'pl',
      condition: { kind: 'containsNoneOf', target: ['pl'], literalsPath: ['relations', 'prohibited'] },
    };
    const payload = { relations: { prohibited: ['neón'] } };
    const storeWithViolation = new Map<string, Record<string, unknown>>([
      ['dim1.req01', { institucionales: [{ name: 'azul' }] }],
      ['dim1.req02', { roleColors: [{ role: 'background', source: 'paleta neón' }] }],
    ]);
    const fail = evalPred([clause], payload, { store: storeWithViolation, selfId: 'dim1.req09' });
    expect(fail.ok).toBe(false);
    expect(fail.motivos[0]?.codigo).toBe('literal-prohibido');

    const cleanStore = new Map<string, Record<string, unknown>>([
      ['dim1.req01', { institucionales: [{ name: 'azul' }] }],
    ]);
    expect(evalPred([clause], payload, { store: cleanStore, selfId: 'dim1.req09' }).ok).toBe(true);
  });
});

describe('verdad-vacía FAIL-CLOSED (decisión 2 de la ficha)', () => {
  it('ningún cuantificador pasa con colección ausente o vacía', () => {
    const cuantificadores: PredicateClause[] = [
      { kind: 'covers', target: ['xs'], key: ['k'], expected: [str('a')] },
      { kind: 'each', target: ['xs'], condition: { kind: 'exists', target: ['k'] } },
      { kind: 'some', target: ['xs'], alias: 'x', condition: { kind: 'exists', target: ['x'] } },
      { kind: 'everyPar', target: ['xs'], components: ['k'], condition: { kind: 'exists', target: ['k'] } },
    ];
    for (const clause of cuantificadores) {
      const vacia = evalPred([clause], { xs: [] });
      expect(vacia.ok, JSON.stringify(clause.kind)).toBe(false);
      const ausente = evalPred([clause], {});
      expect(ausente.ok, JSON.stringify(clause.kind)).toBe(false);
    }
  });

  it('and vacío, or con un solo operando y covers con lista esperada vacía no pasan', () => {
    expect(evalPred([{ kind: 'and', clauses: [] }], {}).ok).toBe(false);
    expect(
      evalPred([{ kind: 'or', clauses: [{ kind: 'exists', target: ['x'] }] }], { x: 1 }).ok,
    ).toBe(false);
    expect(evalPred([{ kind: 'covers', target: ['xs'], key: [], expected: [] }], { xs: [1] }).ok).toBe(false);
  });
});
