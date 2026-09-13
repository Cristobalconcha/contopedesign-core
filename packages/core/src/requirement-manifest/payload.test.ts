import { describe, expect, it } from 'vitest';
import { collectPayloadDomain, collectStringLeaves, validatePayload } from './payload';
import type { PayloadSchema, PayloadType } from './types';

const COLOR: PayloadType = { kind: 'color-css' };
const TEXTO: PayloadType = { kind: 'texto' };
const refTo = (reqId: string): PayloadType => ({ kind: 'ref', reqId });
const enumOf = (...values: string[]): PayloadType => ({ kind: 'enum', values });
const lista = (of: PayloadType): PayloadType => ({ kind: 'lista', of });
const objeto = (fields: Record<string, { type: PayloadType; optional?: boolean }>): PayloadType => ({
  kind: 'objeto',
  fields,
});

const schema: PayloadSchema = {
  institucionales: { type: lista(objeto({ name: { type: TEXTO }, value: { type: COLOR } })) },
  actionColor: {
    type: objeto({
      role: { type: enumOf('accent') },
      source: { type: refTo('dim1.req02') },
    }),
  },
  opcional: { type: TEXTO, optional: true },
  peso: { type: { kind: 'numero', min: 0, max: 1 } },
};

describe('validatePayload', () => {
  it('acepta un payload válido contra el schema', () => {
    const result = validatePayload(
      {
        institucionales: [{ name: 'azul', value: '#1d4ed8' }],
        actionColor: {
          role: 'accent',
          source: { refReqId: 'dim1.req02', refPath: ['roleColors', 0, 'color'] },
        },
        peso: 0.5,
      },
      schema,
    );
    expect(result.ok).toBe(true);
  });

  it('falla con slot obligatorio ausente', () => {
    const result = validatePayload({ actionColor: { role: 'accent', source: { refReqId: 'dim1.req02', refPath: [] } }, peso: 0.5 }, schema);
    expect(result.ok).toBe(false);
    expect(result.motivos.some((m) => m.mensaje.includes("slot obligatorio 'institucionales' ausente"))).toBe(true);
  });

  it('tolera slot opcional ausente y valida el presente', () => {
    const ok = validatePayload({ institucionales: [], actionColor: { role: 'accent', source: { refReqId: 'dim1.req02', refPath: [] } }, peso: 0 }, schema);
    expect(ok.ok).toBe(true);
    const bad = validatePayload({ institucionales: [], actionColor: { role: 'accent', source: { refReqId: 'dim1.req02', refPath: [] } }, peso: 1.5, opcional: 7 }, schema);
    expect(bad.ok).toBe(false);
  });

  it('falla con color inválido, enum fuera de lista, número fuera de rango y ref con reqId equivocado', () => {
    const result = validatePayload(
      {
        institucionales: [{ name: 'azul', value: 'red' }],
        actionColor: { role: 'otro', source: { refReqId: 'dim1.req03', refPath: [] } },
        peso: 1.5,
      },
      schema,
    );
    expect(result.ok).toBe(false);
    const mensajes = result.motivos.map((m) => m.mensaje).join('\n');
    expect(mensajes).toContain('color-css');
    expect(mensajes).toContain('enum(accent)');
    expect(mensajes).toContain("por encima del máximo 1");
    expect(mensajes).toContain("se esperaba 'dim1.req02'");
  });

  it('rechaza un payload que no es objeto', () => {
    const result = validatePayload(null, schema);
    expect(result.ok).toBe(false);
    expect(result.motivos[0]?.codigo).toBe('payload-invalido');
  });

  it('acepta una unión si algún miembro valida', () => {
    const unionSchema: PayloadSchema = {
      color: { type: { kind: 'union', of: [refTo('dim1.req01'), COLOR] } },
    };
    expect(validatePayload({ color: { refReqId: 'dim1.req01', refPath: [] } }, unionSchema).ok).toBe(true);
    expect(validatePayload({ color: '#fff' }, unionSchema).ok).toBe(true);
    expect(validatePayload({ color: 42 }, unionSchema).ok).toBe(false);
  });
});

describe('collectStringLeaves / collectPayloadDomain (dominio de match §8.2)', () => {
  const payload = {
    institucionales: [{ name: 'azul', value: '#1d4ed8' }],
    actionColor: {
      role: 'accent',
      source: { refReqId: 'dim1.req02', refPath: ['roleColors', 0, 'color'] },
    },
    peso: 0.5,
  };

  it('recorre en orden del payloadSchema y respeta la opacidad de los refs', () => {
    const leaves = collectPayloadDomain(payload, schema);
    // Los metadatos del ref (refReqId/refPath) NO son hojas del dominio.
    expect(leaves).toEqual(['azul', '#1d4ed8', 'accent']);
  });

  it('incluye claves extras del payload en orden de inserción', () => {
    const extra = { ...payload, extraSlot: 'nota-extra' };
    const leaves = collectPayloadDomain(extra, schema);
    expect(leaves).toContain('nota-extra');
  });

  it('no desciende dentro de refs aunque tengan hojas string', () => {
    const leaves = collectStringLeaves({ refReqId: 'dim1.req01', refPath: ['institucionales', 0, 'value'] });
    expect(leaves).toEqual([]);
  });
});
