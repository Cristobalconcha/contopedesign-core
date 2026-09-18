import { describe, expect, it } from 'vitest';
import { emptyRectoras, VERIFICATIONS, buildDim1DesignSet } from '../design-set/dim1-fixture';
import { toFullPayloadsMap, toPayloadsMap } from '../design-set/adapter';
import { evaluateManifest } from '../requirement-manifest/evaluate';
import { DIM1_MANIFEST_V0 } from '../requirement-manifest/manifest-v0-dim1';
import { DIM2_MANIFEST_V0 } from '../requirement-manifest/manifest-v0-dim2';
import { DIM3_MANIFEST_V0 } from '../requirement-manifest/manifest-v0-dim3';
import { DIM4_MANIFEST_V0 } from '../requirement-manifest/manifest-v0-dim4';
import { DIM5_MANIFEST_V0 } from '../requirement-manifest/manifest-v0-dim5';
import { DIM6_MANIFEST_V0 } from '../requirement-manifest/manifest-v0-dim6';
import { DIM7_MANIFEST_V0 } from '../requirement-manifest/manifest-v0-dim7';
import { DIM8_MANIFEST_V0 } from '../requirement-manifest/manifest-v0-dim8';
import { DIM9_MANIFEST_V0 } from '../requirement-manifest/manifest-v0-dim9';
import type { RequirementResultV0 } from '../requirement-manifest/types';
import { evaluarNucleo, validarNucleo } from './evaluate';
import { NUCLEO_WEB } from './nucleo-web';
import type { NucleoDeMundoV0 } from './types';

const TODOS = [
  DIM1_MANIFEST_V0,
  DIM2_MANIFEST_V0,
  DIM3_MANIFEST_V0,
  DIM4_MANIFEST_V0,
  DIM5_MANIFEST_V0,
  DIM6_MANIFEST_V0,
  DIM7_MANIFEST_V0,
  DIM8_MANIFEST_V0,
  DIM9_MANIFEST_V0,
];

/** Evalúa dim1 con la fixture que la resuelve entera y devuelve resultados + payloads. */
function dim1Resuelta(): { resultados: Map<string, RequirementResultV0>; payloads: Map<string, unknown> } {
  const set = buildDim1DesignSet();
  const ev = evaluateManifest({
    manifest: DIM1_MANIFEST_V0,
    payloads: toPayloadsMap(set, 'dim1'),
    rectoras: emptyRectoras(),
    verifications: VERIFICATIONS,
  });
  const resultados = new Map(ev.resultados.map((r) => [r.requisitoId, r]));
  return { resultados, payloads: toFullPayloadsMap(set) };
}

describe('núcleo del mundo web', () => {
  it('cada id existe y está activo en los manifiestos; cada regla apunta a una entrada y trae cita', () => {
    const v = validarNucleo(NUCLEO_WEB, TODOS);
    expect(v.errores).toEqual([]);
    expect(v.ok).toBe(true);
  });

  it('son los ocho roles del plugin dichos como preguntas: color, contraste, tipografía, medida y movimiento', () => {
    expect(NUCLEO_WEB.entradas.map((e) => e.requisitoId)).toEqual([
      'dim1.req02',
      'dim1.req07',
      'dim2.req02',
      'dim2.req04',
      'dim8.req02',
    ]);
    const roles = NUCLEO_WEB.entradas.flatMap((e) => e.roles ?? []);
    expect(roles).toEqual(['accent', 'text', 'background', 'título', 'cuerpo', 'entrada', 'feedback']);
  });

  it('la fixture de dim1 cumple la regla del contraste (umbral 4,5) pero el núcleo no queda cubierto sin dim2 y dim8', () => {
    const { resultados, payloads } = dim1Resuelta();
    const ev = evaluarNucleo({ nucleo: NUCLEO_WEB, resultados, payloads, manifests: TODOS, rectoras: emptyRectoras(), verifications: VERIFICATIONS });
    expect(ev.reglas).toHaveLength(1);
    expect(ev.reglas[0]?.resultado).toBe('cumple');
    expect(ev.resultado).toBe('no-cubierto');
    expect(ev.faltantes).toEqual(['dim2.req02', 'dim2.req04', 'dim8.req02']);
    expect(ev.contador).toEqual({ cubiertos: 2, total: 5, reglasCumplidas: 1, reglasTotal: 1 });
  });

  it('un umbral de contraste por debajo de 4,5 resuelve la pregunta pero no cumple la regla del mundo', () => {
    const { resultados, payloads } = dim1Resuelta();
    const req07 = payloads.get('dim1.req07') as { contrast: Record<string, unknown> };
    payloads.set('dim1.req07', { contrast: { ...req07.contrast, umbral: 3 } });
    const ev = evaluarNucleo({ nucleo: NUCLEO_WEB, resultados, payloads, manifests: TODOS, rectoras: emptyRectoras(), verifications: VERIFICATIONS });
    expect(ev.reglas[0]?.resultado).toBe('no-cumple');
    expect(ev.reglas[0]?.motivos[0]?.mensaje).toContain('web.contraste-4-5');
  });

  it('fail-closed: un requisito sin evaluar es faltante, y una regla sobre un requisito no resuelto no se cumple', () => {
    const ev = evaluarNucleo({
      nucleo: NUCLEO_WEB,
      resultados: new Map(),
      payloads: new Map(),
      manifests: TODOS,
      rectoras: emptyRectoras(),
    });
    expect(ev.resultado).toBe('no-cubierto');
    expect(ev.faltantes).toHaveLength(5);
    expect(ev.reglas[0]?.resultado).toBe('no-cumple');
    expect(ev.reglas[0]?.motivos[0]?.codigo).toBe('requisito-no-resuelto');
  });
});

describe('validarNucleo', () => {
  it('rechaza ids inexistentes, repetidos, reglas huérfanas y reglas sin cita', () => {
    const malo: NucleoDeMundoV0 = {
      schemaVersion: 1,
      mundoId: 'prueba',
      nombre: 'Prueba',
      fuente: 'ninguna real',
      medidoEn: '2026-09-18',
      entradas: [
        { requisitoId: 'dim1.req99', porque: 'no existe' },
        { requisitoId: 'dim1.req01', porque: 'existe' },
        { requisitoId: 'dim1.req01', porque: 'repetido' },
      ],
      reglas: [
        { id: 'prueba.huerfana', requisitoId: 'dim2.req01', nombre: 'x', cita: 'y', clausulas: [{ kind: 'exists', target: ['a'] }] },
        { id: 'prueba.sin-cita', requisitoId: 'dim1.req01', nombre: 'x', cita: '  ', clausulas: [] },
      ],
    };
    const v = validarNucleo(malo, TODOS);
    expect(v.ok).toBe(false);
    expect(v.errores.join('\n')).toContain("'dim1.req99' no existe");
    expect(v.errores.join('\n')).toContain("'dim1.req01' repetido");
    expect(v.errores.join('\n')).toContain('no es una entrada del núcleo');
    expect(v.errores.join('\n')).toContain('sin cita');
    expect(v.errores.join('\n')).toContain('sin cláusulas');
  });

  it('un núcleo vacío no es un núcleo', () => {
    const vacio: NucleoDeMundoV0 = { schemaVersion: 1, mundoId: 'v', nombre: 'V', fuente: 'x', medidoEn: '2026-09-18', entradas: [], reglas: [] };
    expect(validarNucleo(vacio, TODOS).ok).toBe(false);
    const ev = evaluarNucleo({ nucleo: vacio, resultados: new Map(), payloads: new Map(), manifests: TODOS, rectoras: emptyRectoras() });
    expect(ev.resultado).toBe('no-cubierto');
  });
});
