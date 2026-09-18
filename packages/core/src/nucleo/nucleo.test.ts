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
import { DIM10_MANIFEST_V0 } from '../requirement-manifest/manifest-v0-dim10';
import type { RequirementResultV0 } from '../requirement-manifest/types';
import { evaluarNucleo, validarNucleo } from './evaluate';
import { NUCLEO_WEB } from './nucleo-web';
import { NUCLEO_EDITORIAL } from './nucleo-editorial';
import { NUCLEO_MARCA } from './nucleo-marca';
import { NUCLEO_CAMPANA } from './nucleo-campana';
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
  DIM10_MANIFEST_V0,
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

describe('núcleo del mundo editorial impreso', () => {
  it('cada id existe y está activo; las reglas apuntan a entradas, traen cita y su condición existe', () => {
    const v = validarNucleo(NUCLEO_EDITORIAL, TODOS);
    expect(v.errores).toEqual([]);
    expect(v.ok).toBe(true);
  });

  it('incluye las seis preguntas nuevas de la adenda y las dos estáticas de interacción y movimiento', () => {
    const ids = NUCLEO_EDITORIAL.entradas.map((e) => e.requisitoId);
    for (const id of ['dim1.req14', 'dim3.req08', 'dim3.req09', 'dim5.req09', 'dim6.req08', 'dim6.req09', 'dim7.req07', 'dim8.req07']) {
      expect(ids, id).toContain(id);
    }
    expect(ids).not.toContain('dim8.req02'); // el impreso no emite movimiento
  });

  /** Un set mínimo: sólo lo que las reglas de tipografía miran, con la hoja declarada. */
  function setTipografico(modo: 'pagina-fija' | 'contenido-corrido', cuerpoPx: string, lineHeight: number) {
    const resultados = new Map<string, RequirementResultV0>([
      ['dim2.req02', { requisitoId: 'dim2.req02', resultado: 'resuelto', motivos: [] }],
      ['dim3.req08', { requisitoId: 'dim3.req08', resultado: 'resuelto', motivos: [] }],
    ]);
    const payloads = new Map<string, unknown>([
      ['dim2.req02', { roleStyles: [{ role: 'cuerpo', fontSize: cuerpoPx, lineHeight }, { role: 'nota', fontSize: '12px', lineHeight: 1.3 }] }],
      ['dim3.req08', { formatos: [{ nombre: 'carta', formato: 'letter', orientacion: 'vertical', modo }] }],
    ]);
    return { resultados, payloads };
  }

  it('un sistema que sólo soporta página fija (el folleto real, cuerpo 10 pt) NO cae por las reglas de documento de Claude Design: no aplican', () => {
    const { resultados, payloads } = setTipografico('pagina-fija', '10pt', 1.2);
    const ev = evaluarNucleo({ nucleo: NUCLEO_EDITORIAL, resultados, payloads, manifests: TODOS, rectoras: emptyRectoras() });
    const cuerpo = ev.reglas.find((r) => r.reglaId === 'editorial.cuerpo-documento-12pt');
    const notas = ev.reglas.find((r) => r.reglaId === 'editorial.notas-documento-9pt');
    expect(cuerpo?.resultado).toBe('no-aplica');
    expect(notas?.resultado).toBe('no-aplica');
    expect(cuerpo?.motivos[0]?.mensaje).toContain('dim3.req08.formatos.*.modo = contenido-corrido');
  });

  it('si el sistema soporta contenido corrido, un cuerpo de 10 pt no cumple la regla de 12 pt; uno de 16 px a 1,5 sí', () => {
    const malo = setTipografico('contenido-corrido', '10pt', 1.2);
    const evMalo = evaluarNucleo({ nucleo: NUCLEO_EDITORIAL, resultados: malo.resultados, payloads: malo.payloads, manifests: TODOS, rectoras: emptyRectoras() });
    expect(evMalo.reglas.find((r) => r.reglaId === 'editorial.cuerpo-documento-12pt')?.resultado).toBe('no-cumple');
    const bueno = setTipografico('contenido-corrido', '16px', 1.5);
    const evBueno = evaluarNucleo({ nucleo: NUCLEO_EDITORIAL, resultados: bueno.resultados, payloads: bueno.payloads, manifests: TODOS, rectoras: emptyRectoras() });
    expect(evBueno.reglas.find((r) => r.reglaId === 'editorial.cuerpo-documento-12pt')?.resultado).toBe('cumple');
    expect(evBueno.reglas.find((r) => r.reglaId === 'editorial.notas-documento-9pt')?.resultado).toBe('cumple');
    // Y el núcleo sigue sin cubrirse: faltan casi todas las preguntas.
    expect(evBueno.resultado).toBe('no-cubierto');
    expect(evBueno.contador.total).toBe(NUCLEO_EDITORIAL.entradas.length);
  });

  it('una condición que apunta a un requisito inexistente es error de programa, no ausencia del set', () => {
    const roto: NucleoDeMundoV0 = { ...NUCLEO_EDITORIAL, reglas: [{ ...NUCLEO_EDITORIAL.reglas[1]!, condicion: { requisitoId: 'dim3.req99', ruta: ['modo'], igualA: 'x' } }] };
    expect(validarNucleo(roto, TODOS).errores.join('; ')).toContain('dim3.req99');
  });
});

describe('núcleos de marca y campaña (medidos el 18-09 sobre Santa Luisa)', () => {
  it('cada id existe y está activo; las reglas apuntan a entradas y traen cita', () => {
    for (const n of [NUCLEO_MARCA, NUCLEO_CAMPANA]) {
      const v = validarNucleo(n, TODOS);
      expect(v.errores).toEqual([]);
      expect(v.ok).toBe(true);
    }
  });

  it('marca exige lo que hace viajar una identidad: equivalencias por sistema, usos de marca, fuerza de cada voz', () => {
    const ids = NUCLEO_MARCA.entradas.map((e) => e.requisitoId);
    expect(ids).toContain('dim1.req14');
    expect(ids).toContain('dim5.req08');
    expect(ids).toContain('dim2.req08');
    expect(NUCLEO_MARCA.entradas.find((e) => e.requisitoId === 'dim5.req02')?.roles).toEqual(['marcas', 'simbolos']);
    expect(NUCLEO_MARCA.fuente).toContain('Sin pieza de packaging');
  });

  it('campaña: un formato con medida declarada de menos de 1080 px de ancho no cumple; 1080 sí; una hoja cerrada no se compara', () => {
    const conFormatos = (formatos: unknown[]) => {
      const resultados = new Map<string, RequirementResultV0>([['dim3.req08', { requisitoId: 'dim3.req08', resultado: 'resuelto', motivos: [] }]]);
      const payloads = new Map<string, unknown>([['dim3.req08', { formatos }]]);
      return evaluarNucleo({ nucleo: NUCLEO_CAMPANA, resultados, payloads, manifests: TODOS, rectoras: emptyRectoras() }).reglas.find(
        (r) => r.reglaId === 'campana.ancho-minimo-1080',
      )?.resultado;
    };
    const post = { nombre: 'post', formato: 'medida-declarada', medida: { ancho: '1080px', alto: '1350px' }, orientacion: 'vertical', modo: 'pagina-fija' };
    const video = { nombre: 'video', formato: 'medida-declarada', medida: { ancho: '1280px', alto: '720px' }, orientacion: 'apaisada', modo: 'pagina-fija' };
    const chico = { nombre: 'chico', formato: 'medida-declarada', medida: { ancho: '720px', alto: '1280px' }, orientacion: 'vertical', modo: 'pagina-fija' };
    const carta = { nombre: 'carta', formato: 'letter', orientacion: 'vertical', modo: 'pagina-fija' };
    expect(conFormatos([post, video])).toBe('cumple');
    expect(conFormatos([post, chico])).toBe('no-cumple');
    expect(conFormatos([carta])).toBe('cumple');
  });
});
