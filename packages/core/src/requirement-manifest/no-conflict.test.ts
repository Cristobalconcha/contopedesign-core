import { describe, expect, it } from 'vitest';
import { evaluateNoConflict } from './no-conflict';
import type { PayloadSchema, RectoraV0 } from './types';

const schema: PayloadSchema = {
  color: { type: { kind: 'texto' } },
  tags: { type: { kind: 'lista', of: { kind: 'texto' } } },
};

function rectora(overrides: Partial<RectoraV0>): RectoraV0 {
  return { id: 'mood-wall', tagsRequeridos: [], tagsProhibidos: [], exclusiones: [], ...overrides };
}

describe('evaluateNoConflict (§8.2 — match determinista)', () => {
  it('pasa con las tres listas vacías (una rectora sin listas no restringe nada)', () => {
    const res = evaluateNoConflict({
      rectoraId: 'mood-wall',
      rectora: rectora({}),
      payload: { color: '#fff', tags: ['sobrio'] },
      payloadSchema: schema,
    });
    expect(res.ok).toBe(true);
  });

  it('falla por exclusión con match substring, reportando el primer incumplimiento', () => {
    const res = evaluateNoConflict({
      rectoraId: 'mood-wall',
      rectora: rectora({ exclusiones: ['neón', 'otra'] }),
      payload: { color: 'paleta neón corporativa', tags: [] },
      payloadSchema: schema,
    });
    expect(res.ok).toBe(false);
    expect(res.motivo?.codigo).toBe('no-conflict-exclusion');
    expect(res.motivo?.mensaje).toBe("contradicción con mood-wall: exclusión 'neón'");
  });

  it('evalúa exclusiones antes que tagsProhibidos (orden fijo)', () => {
    const res = evaluateNoConflict({
      rectoraId: 'mood-wall',
      rectora: rectora({ exclusiones: ['saturado'], tagsProhibidos: ['saturado'] }),
      payload: { color: 'rojo saturado', tags: [] },
      payloadSchema: schema,
    });
    expect(res.motivo?.codigo).toBe('no-conflict-exclusion');
  });

  it('anti-tag por igualdad exacta, sensible a mayúsculas, tras recorte de espacios', () => {
    const ok = evaluateNoConflict({
      rectoraId: 'mood-wall',
      rectora: rectora({ tagsProhibidos: ['neón'] }),
      payload: { color: '#fff', tags: ['Neón'] },
      payloadSchema: schema,
    });
    expect(ok.ok).toBe(true); // 'Neón' ≠ 'neón' (case-sensitive)

    const trimmed = evaluateNoConflict({
      rectoraId: 'mood-wall',
      rectora: rectora({ tagsProhibidos: ['neón'] }),
      payload: { color: '#fff', tags: ['  neón  '] },
      payloadSchema: schema,
    });
    expect(trimmed.ok).toBe(false); // tras trim, igualdad exacta
    expect(trimmed.motivo?.mensaje).toBe("contradicción con mood-wall: anti-tag 'neón'");
  });

  it('tag requerido ausente ⇒ fallo con el primer tag faltante', () => {
    const res = evaluateNoConflict({
      rectoraId: 'descriptor',
      rectora: rectora({ id: 'descriptor', tagsRequeridos: ['institucional', 'sobrio'] }),
      payload: { color: '#fff', tags: ['sobrio'] },
      payloadSchema: schema,
    });
    expect(res.ok).toBe(false);
    expect(res.motivo?.codigo).toBe('no-conflict-tag-ausente');
    expect(res.motivo?.mensaje).toBe("contradicción con descriptor: tag requerido ausente 'institucional'");
  });

  it('tag requerido presente (con espacios alrededor) pasa', () => {
    const res = evaluateNoConflict({
      rectoraId: 'descriptor',
      rectora: rectora({ id: 'descriptor', tagsRequeridos: ['institucional'] }),
      payload: { color: '#fff', tags: [' institucional '] },
      payloadSchema: schema,
    });
    expect(res.ok).toBe(true);
  });

  it('rectora sin restricciones registradas ⇒ fail-closed', () => {
    const res = evaluateNoConflict({
      rectoraId: 'mood-wall',
      rectora: undefined,
      payload: { color: '#fff', tags: [] },
      payloadSchema: schema,
    });
    expect(res.ok).toBe(false);
    expect(res.motivo?.codigo).toBe('rectora-sin-restricciones');
  });

  it('ignora los metadatos de refs en el dominio (hojas de contenido, no plomería)', () => {
    const refSchema: PayloadSchema = {
      actionColor: {
        type: {
          kind: 'objeto',
          fields: {
            role: { type: { kind: 'enum', values: ['accent'] } },
            source: { type: { kind: 'ref', reqId: 'dim1.req02' } },
          },
        },
      },
    };
    const res = evaluateNoConflict({
      rectoraId: 'mood-wall',
      rectora: rectora({ tagsRequeridos: ['dim1.req02'] }),
      payload: {
        actionColor: {
          role: 'accent',
          source: { refReqId: 'dim1.req02', refPath: ['roleColors', 0, 'color'] },
        },
      },
      payloadSchema: refSchema,
    });
    expect(res.ok).toBe(false);
    expect(res.motivo?.mensaje).toContain("tag requerido ausente 'dim1.req02'");
  });
});
