/**
 * Mecanismo de rechazo por contradicción con definiciones rectoras
 * (spec §8.2, corrección H4). Tres listas literales como datos, match
 * determinista y orden fijo de evaluación: exclusiones → tagsProhibidos →
 * tagsRequeridos, con el PRIMER incumplimiento reportado.
 *
 * La vía de escape `requiere-veredicto-humano-registrado` vive en la
 * evaluación del requisito (evaluate.ts): aquí solo se evalúa el match
 * literal. El resultado de este módulo es un booleano con motivo — nunca un
 * tercer estado.
 */
import { collectPayloadDomain } from './payload.js';
import type { Motivo, PayloadSchema, RectoraV0 } from './types.js';

export interface NoConflictInput {
  /** id de la rectora (descriptor | referente:<id> | mood-wall). */
  rectoraId: string;
  /** Restricciones formales registradas; ausente = fail-closed. */
  rectora?: RectoraV0 | undefined;
  payload: Record<string, unknown>;
  payloadSchema: PayloadSchema;
}

export interface NoConflictResult {
  ok: boolean;
  /** Presente solo cuando ok === false. */
  motivo?: Motivo | undefined;
}

/**
 * Match de tag (spec §8.2): igualdad EXACTA, sensible a mayúsculas, tras
 * recortar espacios de ambos lados (el literal declarado y la hoja del
 * dominio). Las exclusiones usan SUBSTRING (sobre-casar es un error en
 * dirección segura: no-resuelto visible, nunca un falso resuelto).
 */
function tagMatches(leaf: string, literal: string): boolean {
  return leaf.trim() === literal.trim();
}

function exclusionMatches(leaf: string, literal: string): boolean {
  return leaf.includes(literal);
}

export function evaluateNoConflict(input: NoConflictInput): NoConflictResult {
  const { rectoraId, payload, payloadSchema } = input;
  const rectora = input.rectora;
  if (rectora === undefined) {
    return {
      ok: false,
      motivo: {
        codigo: 'rectora-sin-restricciones',
        mensaje: `rectora '${rectoraId}' vinculada sin restricciones formales registradas en el contexto`,
      },
    };
  }
  const domain = collectPayloadDomain(payload, payloadSchema);

  // (1) exclusiones, en orden: la primera que aparezca (substring) ⇒ false.
  for (const exclusion of rectora.exclusiones) {
    const leaf = domain.find((d) => exclusionMatches(d, exclusion));
    if (leaf !== undefined) {
      return {
        ok: false,
        motivo: {
          codigo: 'no-conflict-exclusion',
          mensaje: `contradicción con ${rectoraId}: exclusión '${exclusion}'`,
        },
      };
    }
  }

  // (2) tagsProhibidos, en orden: el primero que aparezca (igualdad exacta) ⇒ false.
  for (const tag of rectora.tagsProhibidos) {
    const leaf = domain.find((d) => tagMatches(d, tag));
    if (leaf !== undefined) {
      return {
        ok: false,
        motivo: {
          codigo: 'no-conflict-anti-tag',
          mensaje: `contradicción con ${rectoraId}: anti-tag '${tag}'`,
        },
      };
    }
  }

  // (3) tagsRequeridos, en orden: el primero que NO aparezca ⇒ false.
  for (const tag of rectora.tagsRequeridos) {
    const leaf = domain.find((d) => tagMatches(d, tag));
    if (leaf === undefined) {
      return {
        ok: false,
        motivo: {
          codigo: 'no-conflict-tag-ausente',
          mensaje: `contradicción con ${rectoraId}: tag requerido ausente '${tag}'`,
        },
      };
    }
  }

  return { ok: true };
}
