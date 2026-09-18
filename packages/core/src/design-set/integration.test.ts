/**
 * Prueba de integración de C2 con datos reales de punta a punta: construir
 * el DesignSet completo de la Dimensión 1 (13 requisitos) -> exportarlo
 * (serializeDesignSet) -> importarlo de vuelta (parseDesignSet) -> confirmar
 * que sigue resolviendo la dimensión 13/13 a través del evaluador real de
 * C1 -> proyectar sus entradas de color/surface al designRuleSet.
 *
 * Las pruebas unitarias de `adapter.test.ts`, `persistence.test.ts` y
 * `project-to-designruleset.test.ts` prueban cada pieza por separado, con
 * fixtures chicos hechos a mano. Esta prueba existe para confirmar que las
 * piezas SIGUEN funcionando juntas sobre el fixture real y completo — el
 * riesgo real de una suite con muchos módulos pequeños es que cada uno pase
 * solo, pero la integración se rompa en el borde entre dos.
 */
import { describe, expect, it } from 'vitest';
import { evaluateManifest } from '../requirement-manifest/evaluate.js';
import { CORE_ROLES_13 } from '../requirement-manifest/types.js';
import { DIM1_MANIFEST_V0 } from '../requirement-manifest/manifest-v0-dim1.js';
import { findDanglingRefs, findDuplicateEntries, toFullPayloadsMap } from './adapter.js';
import { buildDim1DesignSet, emptyRectoras, VERIFICATIONS } from './dim1-fixture.js';
import { parseDesignSet, serializeDesignSet } from './persistence.js';
import { projectColorEntry, projectSurfaceEntry } from './project-to-designruleset.js';

describe('C2 de punta a punta con el fixture real de dim1 (13 requisitos)', () => {
  it('exportar -> importar -> seguir resolviendo todos los requisitos activos a través del evaluador real de C1', () => {
    const original = buildDim1DesignSet();
    expect(findDanglingRefs(original)).toEqual([]);
    expect(findDuplicateEntries(original)).toEqual([]);

    const json = serializeDesignSet(original);
    const restored = parseDesignSet(json);
    expect(restored).toEqual(original); // round-trip sin pérdida, con los 13 requisitos reales

    const evaluation = evaluateManifest({
      manifest: DIM1_MANIFEST_V0,
      payloads: toFullPayloadsMap(restored),
      rectoras: emptyRectoras(),
      verifications: VERIFICATIONS,
    });
    expect(evaluation.resultado).toBe('resuelto');
    const activos = DIM1_MANIFEST_V0.requirements.filter((r) => r.estado === 'active').length;
    expect(evaluation.contador).toEqual({ resueltos: activos, activos });
  });

  it('proyecta color real (dim1.req02, 13 roles) y surface real (dim1.req05) desde el mismo DesignSet importado', () => {
    const restored = parseDesignSet(serializeDesignSet(buildDim1DesignSet()));

    const req02 = restored.entries.find((e) => e.requirementId === 'dim1.req02')!;
    const colorRules = projectColorEntry(req02);
    expect(colorRules).toHaveLength(CORE_ROLES_13.length);
    expect(colorRules.every((r) => r.kind === 'color')).toBe(true);
    // El fixture real encadena roleColors[i].color -> dim1.req01 (RefValue sin
    // resolver): projectColorEntry no resuelve refs (esa es la diferencia real
    // con projectSurfaceEntry), así que el value.color queda como el objeto
    // RefValue crudo -- comportamiento correcto y ya cubierto por su propio
    // test unitario; acá solo confirmamos que no explota con datos reales.
    expect(colorRules[0]?.value['role']).toBe(CORE_ROLES_13[0]);

    const req05 = restored.entries.find((e) => e.requirementId === 'dim1.req05')!;
    const { rules: surfaceRules, errores } = projectSurfaceEntry(req05, restored);
    // El fixture real encadena backgroundColor -> req02 -> req01 (dos saltos):
    // projectSurfaceEntry solo resuelve UN salto (spec §8, cadenas no
    // soportadas) -- con datos reales de dim1, las 2 superficies deberían
    // fallar por cadena, no por dato faltante. Confirma que el límite
    // declarado del proyector es real, no teórico.
    expect(surfaceRules).toEqual([]);
    expect(errores.length).toBeGreaterThan(0);
    expect(errores.every((e) => /ref-encadenada/.test(e) || /RefValue/i.test(e))).toBe(true);
  });

  it('un DesignSet exportado con datos reales es JSON válido y estable byte a byte en dos exportaciones seguidas', () => {
    const designSet = buildDim1DesignSet();
    const first = serializeDesignSet(designSet);
    const second = serializeDesignSet(parseDesignSet(first));
    expect(second).toBe(first); // idempotencia real: exportar -> importar -> exportar de nuevo no cambia nada
  });
});
