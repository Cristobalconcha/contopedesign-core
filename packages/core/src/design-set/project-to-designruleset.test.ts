import { describe, expect, it } from 'vitest';
import { CORE_ROLES_13, CORE_ROLES_9 } from '../requirement-manifest/types.js';
import {
  projectColorEntry,
  projectReadingRulesEntry,
  projectSurfaceEntry,
  projectTypographyEntry,
} from './project-to-designruleset.js';
import type { DesignSetEntryV0, DesignSetV0 } from './types.js';

function req02Entry(): DesignSetEntryV0 {
  return {
    requirementId: 'dim1.req02',
    effectiveDefinitionId: 'def-dim1-req02',
    resolutionPath: 'diseñador',
    payload: {
      roleColors: CORE_ROLES_13.map((role) => ({
        role,
        color: '#1d4ed8',
        source: 'paleta-institucional',
        derivation: { of: 'direct', rule: 'fijo' },
      })),
    },
    provenance: { fuente: 'usuario' },
    fuerza: 'inamovible',
    cicloDeVida: 'aprobada',
    revision: 1,
    mapsToKinds: [
      {
        kind: 'color',
        scopeSuggestion: { breakpoint: ['all'], state: ['default'] },
        valueNotes: 'roleColors -> role/color directo',
      },
    ],
  };
}

describe('projectColorEntry (C2 -> designRuleSet, spec §4)', () => {
  it('proyecta una regla color por cada rol del payload real de dim1.req02', () => {
    const rules = projectColorEntry(req02Entry());
    expect(rules).toHaveLength(CORE_ROLES_13.length);
    expect(rules[0]).toEqual({
      id: 'def-dim1-req02',
      kind: 'color',
      scope: { breakpoint: ['all'], state: ['default'] },
      provenance: { sources: [{ kind: 'user' }] },
      status: 'reviewed',
      value: { role: CORE_ROLES_13[0], color: '#1d4ed8' },
    });
  });

  it('cicloDeVida "propuesta" proyecta status "session" (spec §9.2)', () => {
    const entry = req02Entry();
    entry.cicloDeVida = 'propuesta';
    const rules = projectColorEntry(entry);
    expect(rules.every((r) => r.status === 'session')).toBe(true);
  });

  it('cicloDeVida "reabierta"/"reemplazada" proyectan status "reviewed" igual que "aprobada"', () => {
    const reabierta = req02Entry();
    reabierta.cicloDeVida = 'reabierta';
    expect(projectColorEntry(reabierta)[0]?.status).toBe('reviewed');
  });

  it('provenance.fuente se traduce al vocabulario de producción (spec §9.3, sin mapeo 1:1 con sources en general, pero SI hay traduccion puntual aqui)', () => {
    const referente = req02Entry();
    referente.provenance = { fuente: 'referente' };
    expect(projectColorEntry(referente)[0]?.provenance.sources).toEqual([{ kind: 'reference' }]);

    const ia = req02Entry();
    ia.provenance = { fuente: 'ia' };
    expect(projectColorEntry(ia)[0]?.provenance.sources).toEqual([{ kind: 'ai' }]);
  });

  it('mapsToKinds vacío no produce ninguna regla (brecha declarada, spec §2)', () => {
    const entry = req02Entry();
    entry.mapsToKinds = [];
    expect(projectColorEntry(entry)).toEqual([]);
  });

  it('lanza explícito ante un kind no soportado, en vez de adivinar una forma', () => {
    const entry = req02Entry();
    entry.mapsToKinds = [{ kind: 'typography' }];
    expect(() => projectColorEntry(entry)).toThrow(/sin cobertura todavía/);
  });

  it('un payload sin roleColors reconocible produce cero reglas, no basura', () => {
    const entry = req02Entry();
    entry.payload = { institucionales: [] }; // forma de req01, no de req02
    expect(projectColorEntry(entry)).toEqual([]);
  });
});

function req05Entry(): DesignSetEntryV0 {
  return {
    requirementId: 'dim1.req05',
    effectiveDefinitionId: 'def-dim1-req05',
    resolutionPath: 'diseñador',
    payload: {
      surfaces: [
        {
          level: 'canvas',
          backgroundColor: { refReqId: 'dim1.req02', refPath: ['roleColors', 0, 'color'] },
          foregroundColor: { refReqId: 'dim1.req02', refPath: ['roleColors', 1, 'color'] },
          shadow: 'md',
        },
        {
          level: 'card',
          backgroundColor: { refReqId: 'dim1.req02', refPath: ['roleColors', 1, 'color'] },
          borderColor: { refReqId: 'dim1.req02', refPath: ['roleColors', 2, 'color'] },
          borderWidth: '1px',
        },
      ],
    },
    provenance: { fuente: 'usuario' },
    fuerza: 'inamovible',
    cicloDeVida: 'aprobada',
    revision: 1,
    mapsToKinds: [{ kind: 'surface', scopeSuggestion: { breakpoint: ['all'] } }],
  };
}

/** req02 con colores DIRECTOS (no encadenados a req01) — resolución de un solo salto. */
function req02DirectColorsEntry(): DesignSetEntryV0 {
  const entry = req02Entry();
  entry.payload = {
    roleColors: CORE_ROLES_13.map((role, i) => ({
      role,
      color: `#00${i}${i}${i}${i}`.slice(0, 7),
      source: 'directo',
      derivation: { of: 'direct', rule: 'fijo' },
    })),
  };
  return entry;
}

function surfaceDesignSet(): DesignSetV0 {
  return {
    schemaVersion: 1,
    designSetId: 'ds-surface-test',
    manifestRefs: {},
    entries: [req02DirectColorsEntry(), req05Entry()],
  };
}

describe('projectSurfaceEntry (C2 -> designRuleSet, spec §4) — resuelve RefValue hacia otra entrada', () => {
  it('proyecta una regla surface por cada elemento, resolviendo backgroundColor/foregroundColor/borderColor', () => {
    const designSet = surfaceDesignSet();
    const req05 = designSet.entries.find((e) => e.requirementId === 'dim1.req05')!;
    const { rules, errores } = projectSurfaceEntry(req05, designSet);
    expect(errores).toEqual([]);
    expect(rules).toHaveLength(2);
    expect(rules[0]?.value).toEqual({
      backgroundColor: '#000000',
      foregroundColor: '#001111',
      shadow: 'md',
    });
    expect(rules[1]?.value).toEqual({
      backgroundColor: '#001111',
      borderColor: '#002222',
      borderWidth: '1px',
    });
    expect(rules[0]?.kind).toBe('surface');
  });

  it('una cadena de referencias (backgroundColor -> req02 -> req01) omite esa superficie y registra el motivo, no la sigue a ciegas', () => {
    const designSet: DesignSetV0 = {
      schemaVersion: 1,
      designSetId: 'ds-chain',
      manifestRefs: {},
      entries: [
        // req02 encadenado a req01, como el fixture completo de dim1.
        {
          ...req02Entry(),
          payload: {
            roleColors: CORE_ROLES_13.map((role) => ({
              role,
              color: { refReqId: 'dim1.req01', refPath: ['institucionales', 0, 'value'] },
              source: 'x',
              derivation: { of: 'dim1.req01' },
            })),
          },
        },
        req05Entry(),
      ],
    };
    const req05 = designSet.entries.find((e) => e.requirementId === 'dim1.req05')!;
    const { rules, errores } = projectSurfaceEntry(req05, designSet);
    expect(rules).toEqual([]); // ambas superficies dependen de la cadena rota
    expect(errores.length).toBeGreaterThan(0);
    expect(errores[0]).toMatch(/ref-encadenada|RefValue/i);
  });

  it('lanza explícito ante un kind no soportado', () => {
    const entry = req05Entry();
    entry.mapsToKinds = [{ kind: 'color' }];
    expect(() => projectSurfaceEntry(entry, surfaceDesignSet())).toThrow(/sin cobertura todavía/);
  });
});

function dim2Req01Entry(): DesignSetEntryV0 {
  return {
    requirementId: 'dim2.req01',
    effectiveDefinitionId: 'def-dim2-req01',
    resolutionPath: 'diseñador',
    payload: {
      familias: [{ name: 'Fuente Institucional', stack: ['Fuente Institucional', 'sans-serif'], idiomas: ['es'], licencia: 'comercial' }],
    },
    provenance: { fuente: 'usuario' },
    fuerza: 'inamovible',
    cicloDeVida: 'aprobada',
    revision: 1,
    mapsToKinds: [],
  };
}

function dim2Req02Entry(): DesignSetEntryV0 {
  return {
    requirementId: 'dim2.req02',
    effectiveDefinitionId: 'def-dim2-req02',
    resolutionPath: 'diseñador',
    payload: {
      roleStyles: CORE_ROLES_9.map((role, i) => ({
        role,
        family:
          role === 'control'
            ? 'ui-monospace, monospace'
            : { refReqId: 'dim2.req01', refPath: ['familias', 0, 'name'] },
        fontSize: `${16 + i}px`,
        fontWeight: 400,
        lineHeight: 1.5,
        ...(role === 'display' ? { letterSpacing: '-0.02em' } : {}),
        source: `escala-${role}`,
        derivation: role === 'control' ? { of: 'direct', rule: 'sin familia institucional' } : { of: 'dim2.req01' },
      })),
    },
    provenance: { fuente: 'usuario' },
    fuerza: 'inamovible',
    cicloDeVida: 'aprobada',
    revision: 1,
    mapsToKinds: [{ kind: 'typography', scopeSuggestion: { breakpoint: ['all'], state: ['default'] } }],
  };
}

function typographyDesignSet(): DesignSetV0 {
  return {
    schemaVersion: 1,
    designSetId: 'ds-typography-test',
    manifestRefs: {},
    entries: [dim2Req01Entry(), dim2Req02Entry()],
  };
}

describe('projectTypographyEntry (C2 -> designRuleSet, spec §4) — resuelve RefValue de family', () => {
  it('proyecta una regla typography por cada rol, resolviendo family (ref) y dejando family (string) directa', () => {
    const designSet = typographyDesignSet();
    const req02 = designSet.entries.find((e) => e.requirementId === 'dim2.req02')!;
    const { rules, errores } = projectTypographyEntry(req02, designSet);
    expect(errores).toEqual([]);
    expect(rules).toHaveLength(CORE_ROLES_9.length);

    const displayRule = rules.find((r) => r.value['role'] === 'display')!;
    expect(displayRule.value).toEqual({
      role: 'display',
      family: 'Fuente Institucional',
      fontSize: '16px',
      fontWeight: 400,
      lineHeight: 1.5,
      letterSpacing: '-0.02em',
    });
    expect(displayRule.kind).toBe('typography');

    const controlRule = rules.find((r) => r.value['role'] === 'control')!;
    expect(controlRule.value['family']).toBe('ui-monospace, monospace');
    expect(controlRule.value).not.toHaveProperty('letterSpacing');
  });

  it('una cadena de referencias (family -> otra entrada -> otra ref) omite esa entrada y registra el motivo', () => {
    const designSet: DesignSetV0 = {
      schemaVersion: 1,
      designSetId: 'ds-typography-chain',
      manifestRefs: {},
      entries: [
        {
          ...dim2Req02Entry(),
          payload: {
            roleStyles: [
              {
                role: 'display',
                family: { refReqId: 'dim2.req99', refPath: [] },
                fontSize: '48px',
                fontWeight: 700,
                lineHeight: 1.1,
                source: 'x',
                derivation: { of: 'dim2.req01' },
              },
            ],
          },
        },
      ],
    };
    const req02 = designSet.entries[0]!;
    const { rules, errores } = projectTypographyEntry(req02, designSet);
    expect(rules).toEqual([]);
    expect(errores.length).toBeGreaterThan(0);
    expect(errores[0]).toMatch(/no hay entrada/i);
  });

  it('lanza explícito ante un kind no soportado', () => {
    const entry = dim2Req02Entry();
    entry.mapsToKinds = [{ kind: 'spacing' }];
    expect(() => projectTypographyEntry(entry, typographyDesignSet())).toThrow(/sin cobertura todavía/);
  });

  it('un payload sin roleStyles reconocible produce cero reglas, no basura', () => {
    const entry = dim2Req02Entry();
    entry.payload = { familias: [] }; // forma de dim2.req01, no de dim2.req02
    expect(projectTypographyEntry(entry, typographyDesignSet())).toEqual({ rules: [], errores: [] });
  });
});

function dim2Req04Entry(): DesignSetEntryV0 {
  return {
    requirementId: 'dim2.req04',
    effectiveDefinitionId: 'def-dim2-req04',
    resolutionPath: 'diseñador',
    payload: {
      reglas: [
        { role: 'cuerpo', measure: '70ch', paragraphSpacing: '1rem', align: 'left' },
        { role: 'cita', measure: '60ch', paragraphSpacing: '1.2rem', align: 'left' },
        { role: 'nota', measure: '50ch', paragraphSpacing: '0.5rem', align: 'left' },
      ],
    },
    provenance: { fuente: 'usuario' },
    fuerza: 'inamovible',
    cicloDeVida: 'aprobada',
    revision: 1,
    mapsToKinds: [{ kind: 'typography' }],
  };
}

describe('projectReadingRulesEntry (C2 -> designRuleSet, spec §4) — dim2.req04, sin RefValue', () => {
  it('proyecta una regla typography por cada regla de lectura, sin paragraphSpacing (gap parcial declarado)', () => {
    const rules = projectReadingRulesEntry(dim2Req04Entry());
    expect(rules).toHaveLength(3);
    expect(rules[0]).toEqual({
      id: 'def-dim2-req04',
      kind: 'typography',
      scope: {},
      provenance: { sources: [{ kind: 'user' }] },
      status: 'reviewed',
      value: { role: 'cuerpo', measure: '70ch', align: 'left' },
    });
    for (const rule of rules) {
      expect(rule.value).not.toHaveProperty('paragraphSpacing');
    }
  });

  it('mapsToKinds vacío no produce ninguna regla', () => {
    const entry = dim2Req04Entry();
    entry.mapsToKinds = [];
    expect(projectReadingRulesEntry(entry)).toEqual([]);
  });

  it('lanza explícito ante un kind no soportado', () => {
    const entry = dim2Req04Entry();
    entry.mapsToKinds = [{ kind: 'surface' }];
    expect(() => projectReadingRulesEntry(entry)).toThrow(/sin cobertura todavía/);
  });

  it('un payload sin reglas reconocible produce cero reglas, no basura', () => {
    const entry = dim2Req04Entry();
    entry.payload = { roleStyles: [] }; // forma de dim2.req02, no de dim2.req04
    expect(projectReadingRulesEntry(entry)).toEqual([]);
  });
});

describe("camino de resolución 'nulo'", () => {
  // Cristóbal, 2026-09-13: «hay cuatro asignaciones, no tres. La primera es
  // referente, la segunda es usuario, la tercera es IA, y la cuarta es nulo.
  // Relevante cuando se deja voluntariamente indefinida una variable que el
  // sistema, por defecto, incluye.»
  //
  // Lo que se comprueba acá es la consecuencia operativa: un requisito
  // resuelto como 'nulo' NO EMITE NADA al destino. Si emitiera una regla
  // vacía, el destino le pondría su propio valor por defecto — justo lo que
  // este camino declara que no debe pasar.

  // Cada caso CONSERVA su payload completo. Si se vaciara el payload, la
  // proyección daría lista vacía por falta de contenido y la prueba pasaría
  // aunque la salvaguarda no existiera. Lo que se mide es que mande el
  // camino, no el contenido: por eso cada prueba comprueba además que la
  // MISMA entrada, por su camino original, sí emite.

  it('color: no emite, aunque el payload esté entero', () => {
    expect(projectColorEntry({ ...req02Entry(), resolutionPath: 'nulo' })).toEqual([]);
    expect(projectColorEntry(req02Entry()).length).toBeGreaterThan(0);
  });

  it('superficie: no emite, aunque el payload esté entero', () => {
    const designSet = surfaceDesignSet();
    expect(projectSurfaceEntry({ ...req05Entry(), resolutionPath: 'nulo' }, designSet)).toEqual({
      rules: [],
      errores: [],
    });
    expect(projectSurfaceEntry(req05Entry(), designSet).rules.length).toBeGreaterThan(0);
  });

  it('tipografía: no emite, aunque el payload esté entero', () => {
    const designSet = typographyDesignSet();
    expect(
      projectTypographyEntry({ ...dim2Req02Entry(), resolutionPath: 'nulo' }, designSet),
    ).toEqual({ rules: [], errores: [] });
    expect(projectTypographyEntry(dim2Req02Entry(), designSet).rules.length).toBeGreaterThan(0);
  });

  it('lectura: no emite, aunque el payload esté entero', () => {
    expect(projectReadingRulesEntry({ ...dim2Req04Entry(), resolutionPath: 'nulo' })).toEqual([]);
    expect(projectReadingRulesEntry(dim2Req04Entry()).length).toBeGreaterThan(0);
  });
});
