/**
 * Proyección de una entrada del DesignSet al `designRuleSet` de producción
 * (spec-c2-designset-2026-08-31.md §4). El `designRuleSet` es una
 * PROYECCIÓN de consumo, no el hogar de verdad (§9.1, corrección de
 * Cristobal) — este módulo NO persiste nada, solo transforma.
 *
 * Cobertura: `color` y `surface` (dim1, D3 §2 `compiler:2065-2072`,
 * `:213-220,815-867`) más `typography` desde DOS formas de payload
 * distintas (dim2.req02 roleStyles y dim2.req04 reglas de lectura — cada
 * forma tiene su propia función, mismo criterio que color/surface: una
 * función por FORMA de payload evidenciada, nunca una función que adivina
 * entre formas). `dim2.req05` (énfasis) también mapea a `typography` pero
 * su payload es un objeto único sin roles ni scope por rol — necesita una
 * convención de proyección que todavía no existe, queda pausado como
 * `spacing`/`layout` más abajo. Los demás kinds necesitan su propio mapeo
 * payload->value cuando exista evidencia de la dimensión correspondiente —
 * llamar a un proyector con una entrada de otro kind lanza explícito en vez
 * de adivinar una forma.
 *
 * `spacing` y `layout` (dim3) NO tienen proyector todavía, a propósito:
 * - `spacing` (dim3.req02): el mapeo role -> paddingBlock/paddingInline/gap
 *   no es 1:1 fijo (mismo tipo de brecha que dim1.req04/06/13) — inventar la
 *   convención aquí sería fabricar dato, no proyectarlo.
 * - `layout` (dim3.req04/req05): el kind exige `mode` (D3 §2, campo con "+",
 *   no opcional) y ningún requisito de dim3 lo declara — cualquier regla
 *   `layout` emitida sin `mode` sería estructuralmente inválida para el
 *   compilador real, peor que no emitirla.
 * Ambos quedan pausados hasta que exista la convención/decisión de producto
 * correspondiente, mismo criterio que el resto de brechas de este módulo.
 *
 * DOS PIEZAS TODAVÍA NO DECIDIDAS (spec §8, tensiones 8.2 y "algoritmo de
 * effectiveDefinitionId" — NO se deciden aquí, se asume lo mínimo y se
 * declara):
 * - `id` de la regla: se usa `effectiveDefinitionId` tal cual. Es
 *   PROVISIONAL — la spec no fija un algoritmo (tensión §8.4); cambiar esto
 *   más adelante no debería sorprender a nadie.
 * - `status`: mapeo ya resuelto por Z en spec §9.2 (propuesta -> session;
 *   aprobada|reabierta|reemplazada -> reviewed) — ESE sí es un hecho
 *   documentado, no una suposición de este módulo.
 */
import { resolveRefValue } from './adapter.js';
import { isRefValue } from '../requirement-manifest/types.js';
import type { DesignSetEntryV0, DesignSetV0 } from './types.js';

/** Forma mínima de una regla del designRuleSet (D3 §2): id · kind · scope · provenance · status · value. */
export interface DesignRuleSetRule {
  id: string;
  kind: string;
  scope: {
    breakpoint?: readonly string[];
    state?: readonly string[];
  };
  provenance: {
    /** Vocabulario de D3 §2: reference | user | ai. NO es 1:1 con provenance.fuente (spec §9.3) — se traduce acá. */
    sources: ReadonlyArray<{ kind: 'reference' | 'user' | 'ai' }>;
  };
  status: 'session' | 'reviewed';
  value: Record<string, unknown>;
}

const FUENTE_A_SOURCE_KIND: Record<DesignSetEntryV0['provenance']['fuente'], 'reference' | 'user' | 'ai'> = {
  referente: 'reference',
  usuario: 'user',
  ia: 'ai',
};

/** cicloDeVida (4 fases) -> status (2 valores), spec §9.2. */
function statusFromCicloDeVida(cicloDeVida: DesignSetEntryV0['cicloDeVida']): 'session' | 'reviewed' {
  return cicloDeVida === 'propuesta' ? 'session' : 'reviewed';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Arma la parte común de una regla (id/scope/provenance/status) — solo `value` cambia por kind. */
function buildRule(
  entry: DesignSetEntryV0,
  mapping: DesignSetEntryV0['mapsToKinds'][number],
  value: Record<string, unknown>,
): DesignRuleSetRule {
  const scope: DesignRuleSetRule['scope'] = {};
  if (mapping.scopeSuggestion?.breakpoint !== undefined) {
    scope.breakpoint = mapping.scopeSuggestion.breakpoint;
  }
  if (mapping.scopeSuggestion?.state !== undefined) {
    scope.state = mapping.scopeSuggestion.state;
  }
  return {
    id: entry.effectiveDefinitionId, // PROVISIONAL, ver docblock del módulo.
    kind: mapping.kind,
    scope,
    provenance: { sources: [{ kind: FUENTE_A_SOURCE_KIND[entry.provenance.fuente] }] },
    status: statusFromCicloDeVida(entry.cicloDeVida),
    value,
  };
}

/**
 * Proyecta UNA entrada a las reglas del kind `color` que su `mapsToKinds`
 * declara. Una entrada puede proyectar a más de una regla (una por cada
 * elemento de `mapsToKinds`), o a ninguna (`mapsToKinds: []`, brecha
 * declarada — spec §2, "sin proyección actual").
 *
 * El `value` de cada regla se arma leyendo el payload de la entrada bajo
 * las convenciones YA verificadas en manifest-v0-dim1.ts (req01:
 * institucionales/neutros; req02: roleColors con role/color) — no inventa
 * campos nuevos del compilador.
 */
export function projectColorEntry(entry: DesignSetEntryV0): DesignRuleSetRule[] {
  // Camino 'nulo': la variable se dejó indefinida a propósito. No se emite
  // nada; una regla vacía haría que el destino aplicara su propio defecto.
  if (entry.resolutionPath === 'nulo') return [];
  const rules: DesignRuleSetRule[] = [];
  const payload = isRecord(entry.payload) ? entry.payload : {};

  for (const mapping of entry.mapsToKinds) {
    if (mapping.kind !== 'color') {
      throw new Error(
        `projectColorEntry solo soporta kind 'color'; la entrada '${entry.requirementId}' declara '${mapping.kind}' — sin cobertura todavía.`,
      );
    }

    const values = extractColorValues(payload);
    for (const value of values) {
      rules.push(buildRule(entry, mapping, value));
    }
  }
  return rules;
}

/**
 * Extrae valores {role, color} del payload de dim1.req02 (roleColors) —
 * la forma con más evidencia real (manifest-v0-dim1.ts). Otras formas de
 * payload de color (req01 fundamento, req04 rampas...) todavía no tienen
 * mapeo aquí: devuelve lista vacía en vez de adivinar, para no fabricar una
 * regla con datos incorrectos.
 */
function extractColorValues(payload: Record<string, unknown>): Array<{ role: string; color: unknown }> {
  const roleColors = payload['roleColors'];
  if (!Array.isArray(roleColors)) return [];
  const out: Array<{ role: string; color: unknown }> = [];
  for (const entry of roleColors) {
    if (isRecord(entry) && typeof entry['role'] === 'string' && 'color' in entry) {
      out.push({ role: entry['role'], color: entry['color'] });
    }
  }
  return out;
}

/**
 * Resuelve un campo que puede venir como valor plano o como RefValue hacia
 * otra entrada (patrón real de `dim1.req05` — `backgroundColor`/
 * `foregroundColor`/`borderColor` son `refTo('dim1.req02')` — y de
 * `dim2.req02.roleStyles[].family` — `union([refTo('dim2.req01'), texto])`).
 * Cadenas de referencias (el valor referenciado es OTRA RefValue) se
 * propagan como error explícito — no se siguen a ciegas (mismo criterio que
 * `resolveRefValue`, adapter.ts).
 */
function resolveFieldMaybeRef(
  designSet: DesignSetV0,
  field: unknown,
): { ok: true; value: unknown } | { ok: false; mensaje: string } {
  if (field === undefined) return { ok: true, value: undefined };
  if (!isRefValue(field)) return { ok: true, value: field };
  const resolved = resolveRefValue(designSet, field);
  if (!resolved.ok) return { ok: false, mensaje: resolved.error.mensaje };
  return { ok: true, value: resolved.value };
}

/**
 * Proyecta UNA entrada de `surface` (forma real de `dim1.req05`:
 * `surfaces: [{level, backgroundColor, foregroundColor?, shadow?,
 * borderColor?, borderWidth?}]`, D3 §2 `compiler:213-220,815-867`) a una
 * regla por cada elemento de `surfaces`. Necesita el DesignSet completo
 * (no solo la entrada) porque `backgroundColor`/`foregroundColor`/
 * `borderColor` son `RefValue` hacia `dim1.req02` — a diferencia de
 * `projectColorEntry`, que nunca necesita resolver una referencia.
 *
 * Si CUALQUIER campo de una superficie no resuelve (ref colgante, cadena de
 * referencias), esa superficie completa se omite y el motivo se acumula en
 * `errores` — no se emite una regla a medias con datos faltantes en
 * silencio.
 */
export function projectSurfaceEntry(
  entry: DesignSetEntryV0,
  designSet: DesignSetV0,
): { rules: DesignRuleSetRule[]; errores: string[] } {
  // Camino 'nulo': la variable se dejó indefinida a propósito. No se emite
  // nada; una regla vacía haría que el destino aplicara su propio defecto.
  if (entry.resolutionPath === 'nulo') return { rules: [], errores: [] };
  const rules: DesignRuleSetRule[] = [];
  const errores: string[] = [];
  const payload = isRecord(entry.payload) ? entry.payload : {};
  const surfaces = Array.isArray(payload['surfaces']) ? payload['surfaces'] : [];

  for (const mapping of entry.mapsToKinds) {
    if (mapping.kind !== 'surface') {
      throw new Error(
        `projectSurfaceEntry solo soporta kind 'surface'; la entrada '${entry.requirementId}' declara '${mapping.kind}' — sin cobertura todavía.`,
      );
    }

    surfaces.forEach((surface: unknown, index: number) => {
      if (!isRecord(surface)) return;
      const value: Record<string, unknown> = {};
      let fallo = false;
      for (const field of ['backgroundColor', 'foregroundColor', 'borderColor'] as const) {
        const resolved = resolveFieldMaybeRef(designSet, surface[field]);
        if (!resolved.ok) {
          errores.push(`${entry.requirementId}.surfaces[${index}].${field}: ${resolved.mensaje}`);
          fallo = true;
          continue;
        }
        if (resolved.value !== undefined) value[field] = resolved.value;
      }
      if ('shadow' in surface) value['shadow'] = surface['shadow'];
      if ('borderWidth' in surface) value['borderWidth'] = surface['borderWidth'];
      if (fallo) return; // superficie omitida, motivo ya registrado en errores.
      rules.push(buildRule(entry, mapping, value));
    });
  }
  return { rules, errores };
}

/**
 * Proyecta UNA entrada de `typography` (forma real de `dim2.req02`:
 * `roleStyles: [{role, family, fontSize, fontWeight, lineHeight,
 * letterSpacing?}]`, D3 §2) a una regla por cada elemento de `roleStyles`.
 * Necesita el DesignSet completo porque `family` puede ser un `RefValue`
 * hacia `dim2.req01` (`union([refTo('dim2.req01'), texto])` en el schema) —
 * mismo criterio de resolución y de "una cadena de referencias rompe la
 * entrada, no se sigue a ciegas" que `projectSurfaceEntry`.
 *
 * `letterSpacing` es opcional en el payload (dim2.req02) — se incluye en la
 * regla solo si está presente, nunca como `undefined` explícito.
 */
export function projectTypographyEntry(
  entry: DesignSetEntryV0,
  designSet: DesignSetV0,
): { rules: DesignRuleSetRule[]; errores: string[] } {
  // Camino 'nulo': la variable se dejó indefinida a propósito. No se emite
  // nada; una regla vacía haría que el destino aplicara su propio defecto.
  if (entry.resolutionPath === 'nulo') return { rules: [], errores: [] };
  const rules: DesignRuleSetRule[] = [];
  const errores: string[] = [];
  const payload = isRecord(entry.payload) ? entry.payload : {};
  const roleStyles = Array.isArray(payload['roleStyles']) ? payload['roleStyles'] : [];

  for (const mapping of entry.mapsToKinds) {
    if (mapping.kind !== 'typography') {
      throw new Error(
        `projectTypographyEntry solo soporta kind 'typography'; la entrada '${entry.requirementId}' declara '${mapping.kind}' — sin cobertura todavía.`,
      );
    }

    roleStyles.forEach((style: unknown, index: number) => {
      if (!isRecord(style)) return;
      const value: Record<string, unknown> = {};

      const familyResolved = resolveFieldMaybeRef(designSet, style['family']);
      if (!familyResolved.ok) {
        errores.push(`${entry.requirementId}.roleStyles[${index}].family: ${familyResolved.mensaje}`);
        return; // entrada omitida, motivo ya registrado en errores.
      }
      if (familyResolved.value !== undefined) value['family'] = familyResolved.value;

      if (typeof style['role'] === 'string') value['role'] = style['role'];
      for (const field of ['fontSize', 'fontWeight', 'lineHeight', 'letterSpacing'] as const) {
        if (field in style) value[field] = style[field];
      }
      rules.push(buildRule(entry, mapping, value));
    });
  }
  return { rules, errores };
}

/**
 * Proyecta UNA entrada de reglas de lectura (forma real de `dim2.req04`:
 * `reglas: [{role, measure, paragraphSpacing, align}]`, D3 §2) a una regla
 * `typography` por cada elemento. `paragraphSpacing` NO se incluye en el
 * `value` — su `mappingNotes` declara "sin campo directo, gap parcial": no
 * hay un campo real de `typography` para volcarlo, e inventar uno sería
 * fabricar contrato del compilador que no existe. Ningún campo de esta
 * forma es `RefValue`, así que no hace falta el DesignSet completo (a
 * diferencia de `projectTypographyEntry`).
 */
export function projectReadingRulesEntry(entry: DesignSetEntryV0): DesignRuleSetRule[] {
  // Camino 'nulo': la variable se dejó indefinida a propósito. No se emite
  // nada; una regla vacía haría que el destino aplicara su propio defecto.
  if (entry.resolutionPath === 'nulo') return [];
  const rules: DesignRuleSetRule[] = [];
  const payload = isRecord(entry.payload) ? entry.payload : {};
  const reglas = Array.isArray(payload['reglas']) ? payload['reglas'] : [];

  for (const mapping of entry.mapsToKinds) {
    if (mapping.kind !== 'typography') {
      throw new Error(
        `projectReadingRulesEntry solo soporta kind 'typography'; la entrada '${entry.requirementId}' declara '${mapping.kind}' — sin cobertura todavía.`,
      );
    }

    for (const regla of reglas) {
      if (!isRecord(regla)) continue;
      const value: Record<string, unknown> = {};
      if (typeof regla['role'] === 'string') value['role'] = regla['role'];
      if ('measure' in regla) value['measure'] = regla['measure'];
      if ('align' in regla) value['align'] = regla['align'];
      rules.push(buildRule(entry, mapping, value));
    }
  }
  return rules;
}
