import { findEntry } from '@contope/core';
import { describe, expect, it } from 'vitest';
import { encargosDe, jsonDePropuestas, promptDeEncargo } from './encargo.js';
import { evaluar } from './evaluacion.js';
import { requisito } from './manifiesto.js';
import { leerPropuestas } from './propuestas.js';
import { reducir } from './reductor.js';
import { nuevoSistema, type Sistema } from './sistema.js';

const AHORA = '2026-09-19T12:00:00.000Z';

/** Un sistema real: dim3.req01 definida a mano y dim3.req02 encargada a la IA. */
function conEncargo(): Sistema {
  let s = nuevoSistema('digital', 'Manual de marca', AHORA);
  s = reducir(
    s,
    {
      tipo: 'definir',
      requirementId: 'dim3.req01',
      payload: { unidad: '4px', escala: [{ step: 1, value: '4px' }] },
      camino: 'diseñador',
      fuerza: 'inamovible',
    },
    AHORA,
  );
  s = reducir(s, { tipo: 'encargar-a-contope', requirementId: 'dim3.req02' }, AHORA);
  return s;
}

describe('encargosDe', () => {
  it('lista las preguntas encargadas, ordenadas por id', () => {
    expect(encargosDe(conEncargo())).toEqual(['dim3.req02']);
  });

  it('sin tareas vivas no hay encargos', () => {
    expect(encargosDe(nuevoSistema('digital', 'x', AHORA))).toEqual([]);
  });
});

describe('promptDeEncargo', () => {
  it('sin encargos no hay prompt', () => {
    const s = nuevoSistema('digital', 'x', AHORA);
    expect(promptDeEncargo(s, evaluar(s))).toBeNull();
  });

  it('arma el sistema, lo ya definido y los encargos', () => {
    const s = conEncargo();
    const prompt = promptDeEncargo(s, evaluar(s));
    if (prompt === null) throw new Error('el sistema tiene un encargo y no hubo prompt');
    const { sistema: instrucciones, usuario } = prompt;

    expect(instrucciones).toContain('contope/propuestas');
    expect(instrucciones).toContain('model-proposal');
    expect(instrucciones).toContain('SISTEMAS de diseño');

    expect(usuario).toContain('EL SISTEMA');
    expect(usuario).toContain(`designId: ${s.id}`);
    expect(usuario).toContain('mundo: digital');

    expect(usuario).toContain('LO YA DEFINIDO');
    expect(usuario).toContain('dim3.req01');
    expect(usuario).toContain('fuerza inamovible');
    const definida = findEntry(s.designSet, 'dim3.req01');
    if (definida === undefined) throw new Error('dim3.req01 quedó sin entrada en el designSet');
    expect(usuario).toContain(JSON.stringify(definida.payload));

    expect(usuario).toContain('LOS ENCARGOS');
    expect(usuario).toContain('dim3.req02');
    const pregunta = requisito('dim3.req02')?.pregunta;
    if (pregunta === undefined) throw new Error('dim3.req02 no está en el manifiesto');
    expect(usuario).toContain(pregunta);
    expect(usuario).toContain('payloadSchema:');

    expect(usuario).toContain('LAS RESTRICCIONES');
    expect(usuario).toContain('RECORDATORIO');
  });

  it('marca como imperativas las definiciones que vienen del manual del cliente', () => {
    const base = conEncargo();
    const s: Sistema = {
      ...base,
      imperativas: { 'dim3.req01': { insumoId: 'insumo-1', nombre: 'manual-del-cliente.pdf', en: AHORA } },
    };
    const prompt = promptDeEncargo(s, evaluar(s));
    if (prompt === null) throw new Error('sin prompt');
    expect(prompt.usuario).toContain('imperativa: sí');
    expect(prompt.usuario).toContain('IMPERATIVA');
    expect(prompt.usuario).toContain('NO se contradice');
  });

  it('sin insumos, la sección LOS INSUMOS lo dice y no hay imágenes adjuntas', () => {
    const prompt = promptDeEncargo(conEncargo(), evaluar(conEncargo()));
    if (prompt === null) throw new Error('sin prompt');
    expect(prompt.usuario).toContain('LOS INSUMOS');
    expect(prompt.usuario).toContain('(ninguno todavía)');
    expect(prompt.imagenes).toBeUndefined();
  });

  it('un insumo de imagen con miniatura se adjunta como imagen y se nombra en el texto', () => {
    const base = conEncargo();
    const s: Sistema = {
      ...base,
      insumos: [
        {
          id: 'insumo-img',
          nombre: 'logo.png',
          extension: 'png',
          tipo: 'imagen',
          tamanoBytes: 100,
          incorporadoEn: AHORA,
          miniatura: 'data:image/png;base64,QUJD',
          resumen: '10x10 px',
          carril: 'referente',
          tomar: null,
          candidatos: [],
        },
      ],
    };
    const prompt = promptDeEncargo(s, evaluar(s));
    if (prompt === null) throw new Error('sin prompt');
    expect(prompt.usuario).toContain('LOS INSUMOS');
    expect(prompt.usuario).toContain('logo.png');
    expect(prompt.usuario).toContain('tipo imagen');
    expect(prompt.usuario).toContain('carril referente');
    expect(prompt.usuario).toContain('imagen adjunta 1: logo.png');
    expect(prompt.imagenes).toEqual([{ nombre: 'logo.png', mimeType: 'image/png', base64: 'QUJD' }]);
  });

  it('un insumo que no es imagen, o una imagen sin miniatura, no agrega adjuntos', () => {
    const base = conEncargo();
    const s: Sistema = {
      ...base,
      insumos: [
        { id: 'i1', nombre: 'a.css', extension: 'css', tipo: 'css', tamanoBytes: 1, incorporadoEn: AHORA, resumen: '', carril: 'referente', tomar: null, candidatos: [] },
        { id: 'i2', nombre: 'b.png', extension: 'png', tipo: 'imagen', tamanoBytes: 1, incorporadoEn: AHORA, resumen: '', carril: 'referente', tomar: null, candidatos: [] },
      ],
    };
    const prompt = promptDeEncargo(s, evaluar(s));
    if (prompt === null) throw new Error('sin prompt');
    expect(prompt.usuario).toContain('a.css');
    expect(prompt.usuario).toContain('b.png');
    expect(prompt.usuario).not.toContain('imagen adjunta');
    expect(prompt.imagenes).toBeUndefined();
  });
});

describe('jsonDePropuestas', () => {
  const s = nuevoSistema('digital', 'x', AHORA);
  const bien = { kind: 'contope/propuestas', schemaVersion: 1, designId: s.id, propuestas: [] };

  it('acepta el JSON pelado', () => {
    const r = jsonDePropuestas(JSON.stringify(bien), s);
    expect(r.ok).toBe(true);
    if (!r.ok) throw new Error(r.motivo);
    expect(JSON.parse(r.json) as Record<string, unknown>).toEqual(bien);
  });

  it('acepta el JSON envuelto en un cerco markdown', () => {
    const r = jsonDePropuestas(`\`\`\`json\n${JSON.stringify(bien)}\n\`\`\``, s);
    expect(r.ok).toBe(true);
    if (!r.ok) throw new Error(r.motivo);
    expect(JSON.parse(r.json) as Record<string, unknown>).toEqual(bien);
  });

  it('acepta texto antes y después, y lo que devuelve lo lee leerPropuestas', () => {
    const r = jsonDePropuestas(`Claro, aquí va la propuesta:\n${JSON.stringify(bien)}\nEso es todo.`, s);
    expect(r.ok).toBe(true);
    if (!r.ok) throw new Error(r.motivo);
    expect(leerPropuestas(r.json, s).ok).toBe(true);
  });

  it('completa designId, kind y schemaVersion cuando faltan', () => {
    const r = jsonDePropuestas('{"propuestas": []}', s);
    expect(r.ok).toBe(true);
    if (!r.ok) throw new Error(r.motivo);
    const objeto = JSON.parse(r.json) as Record<string, unknown>;
    expect(objeto['designId']).toBe(s.id);
    expect(objeto['kind']).toBe('contope/propuestas');
    expect(objeto['schemaVersion']).toBe(1);
    expect(leerPropuestas(r.json, s).ok).toBe(true);
  });

  it('sin JSON devuelve un motivo', () => {
    const r = jsonDePropuestas('no tengo nada que proponer', s);
    expect(r).toMatchObject({ ok: false });
    if (r.ok) throw new Error('debería fallar');
    expect(r.motivo).toContain('JSON');
  });

  it('con un JSON roto devuelve un motivo', () => {
    const r = jsonDePropuestas('{ "propuestas": [ }', s);
    expect(r).toMatchObject({ ok: false });
    if (r.ok) throw new Error('debería fallar');
    expect(r.motivo).toContain('JSON');
  });

  it('si el modelo propone para otro sistema, leerPropuestas lo rechaza', () => {
    const r = jsonDePropuestas(JSON.stringify({ ...bien, designId: 'sistema-ajeno' }), s);
    expect(r.ok).toBe(true);
    if (!r.ok) throw new Error(r.motivo);
    expect(leerPropuestas(r.json, s)).toMatchObject({ ok: false, motivo: expect.stringContaining('otro sistema') });
  });
});
