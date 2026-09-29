import { TIPOS_DE_PRODUCTO } from '@contope/core';
import { describe, expect, it } from 'vitest';
import {
  entradasPertinentes,
  ESTADOS_EN_PROMPT,
  seccionBiblia,
  TEMAS_POR_PAQUETE,
  temasDeEncargos,
  temasDePaquete,
  TIPOS_POR_MUNDO,
  TOPE_CARACTERES,
  TOPE_ENTRADAS,
} from './biblia.js';
import { REQUISITOS } from './manifiesto.js';
import { MUNDOS } from './mundos.js';
import { nuevoSistema } from './sistema.js';

const AHORA = '2026-09-29T12:00:00.000Z';
/** Preguntas de color de dim1 (pkg.color.*). */
const COLOR = REQUISITOS.filter((r) => r.packageId.startsWith('pkg.color.')).map((r) => r.id);

describe('las tablas de búsqueda', () => {
  it('cada mundo tiene al menos un tipo, y todos son tipos canónicos', () => {
    for (const m of MUNDOS) {
      const tipos = TIPOS_POR_MUNDO[m.id];
      expect(tipos.length).toBeGreaterThan(0);
      for (const t of tipos) expect(TIPOS_DE_PRODUCTO).toContain(t);
    }
  });

  it('toda pregunta del manifiesto recibe al menos un tema', () => {
    const sinTema = REQUISITOS.filter((r) => temasDePaquete(r.packageId).length === 0).map((r) => r.id);
    expect(sinTema).toEqual([]);
  });

  it('ninguna clave de TEMAS_POR_PAQUETE está muerta: todas calzan con un packageId real', () => {
    const paquetes = REQUISITOS.map((r) => r.packageId);
    const muertas = Object.keys(TEMAS_POR_PAQUETE).filter(
      (clave) => !paquetes.some((p) => p === clave || p.startsWith(`${clave}.`)),
    );
    expect(muertas).toEqual([]);
  });

  it('un paquete suma los temas de su familia y los propios, sin repetir y en orden', () => {
    expect(temasDePaquete('pkg.color.reproduccion')).toEqual(['04', '05', '14']);
    expect(temasDePaquete('pkg.color.roles')).toEqual(['04', '05']);
    expect(temasDePaquete('pkg.composicion.flujo')).toEqual(['06', '07']);
    expect(temasDePaquete('pkg.patrones.anatomia')).toEqual(['06', '13']);
    // Límite de punto: «pkg.colorido» no es de la familia «pkg.color».
    expect(temasDePaquete('pkg.colorido')).toEqual([]);
  });

  it('el mundo suma su capítulo propio sólo si hay encargos conocidos', () => {
    expect(temasDeEncargos('editorial', ['dim1.req01'])).toContain('12');
    expect(temasDeEncargos('marca', ['dim1.req01'])).toContain('11');
    expect(temasDeEncargos('digital', ['dim1.req01'])).toEqual(['04', '05']);
    expect(temasDeEncargos('editorial', [])).toEqual([]);
    expect(temasDeEncargos('editorial', ['dim99.req01'])).toEqual([]);
  });
});

describe('entradasPertinentes', () => {
  it('sólo trae filas del tipo del mundo, sin «no aplica» ni celdas mudas, sin repetir entradas', () => {
    const r = entradasPertinentes('digital', COLOR);
    expect(r.length).toBeGreaterThan(0);
    const ids = r.map((e) => e.entrada.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const { filas } of r) {
      expect(filas.length).toBeGreaterThan(0);
      for (const f of filas) {
        expect(f.tipos).toContain('web');
        expect(f.fuerzas.some((x) => x !== 'no-aplica')).toBe(true);
      }
    }
  });

  it('ordena por fuerza: cortapisas, luego recomendaciones, luego divergencias', () => {
    const rangos = entradasPertinentes('editorial', [...COLOR, 'dim2.req01', 'dim3.req01']).map((e) => e.rango);
    expect(rangos).toEqual([...rangos].sort((a, b) => a - b));
    expect(rangos).toContain(0);
  });

  it('sólo trae temas en los estados que entran al prompt (los borradores quedan fuera)', () => {
    // No depende de qué temas estén hoy en borrador: vale para cualquier estado del vault.
    const todos = REQUISITOS.map((r) => r.id);
    for (const mundo of ['editorial', 'marca', 'digital', 'campana'] as const) {
      for (const { entrada } of entradasPertinentes(mundo, todos)) {
        expect(ESTADOS_EN_PROMPT).toContain(entrada.tema.estado);
      }
    }
  });
});

describe('seccionBiblia', () => {
  it('con un mundo y encargos de color, aparece con encabezado, fuerzas e ids', () => {
    const texto = seccionBiblia(nuevoSistema('digital', 'x', AHORA), COLOR);
    if (texto === null) throw new Error('la sección debía aparecer');
    expect(texto.startsWith('LA BIBLIA DEL DISEÑO\n')).toBe(true);
    expect(texto).toContain('cortapisa: respétala');
    expect(texto).toContain('ORDEN DE AUTORIDAD');
    expect(texto).toContain('cita los ids de la Biblia');
    expect(texto).toMatch(/^- 05\.E01 · tema 05 .* · por revisar · /m);
    expect(texto).toMatch(/^ {2}· .* → cortapisa/m);
    // Ninguna fila que sólo diga «no aplica».
    expect(texto).not.toMatch(/→ no aplica( —| ·|$)/m);
  });

  it('no aparece sin encargos pertinentes', () => {
    const s = nuevoSistema('digital', 'x', AHORA);
    expect(seccionBiblia(s, [])).toBeNull();
    expect(seccionBiblia(s, ['dim99.req01'])).toBeNull();
  });

  it('respeta el orden por fuerza en el texto', () => {
    const encargos = [...COLOR, 'dim2.req01'];
    const texto = seccionBiblia(nuevoSistema('marca', 'x', AHORA), encargos) ?? '';
    const enTexto = [...texto.matchAll(/^- (\d\d\.E\d+) /gm)].map((m) => m[1]);
    const esperado = entradasPertinentes('marca', encargos)
      .map((e) => e.entrada.id)
      .filter((id) => enTexto.includes(id));
    expect(enTexto).toEqual(esperado);
  });

  it('con muchos encargos recorta divergencias y recomendaciones, nunca cortapisas, y lo dice', () => {
    const todos = REQUISITOS.map((r) => r.id);
    const texto = seccionBiblia(nuevoSistema('editorial', 'x', AHORA), todos) ?? '';
    const pertinentes = entradasPertinentes('editorial', todos);
    const enTexto = [...texto.matchAll(/^- (\d\d\.E\d+) /gm)].map((m) => m[1]);
    expect(pertinentes.length).toBeGreaterThan(enTexto.length);
    expect(enTexto.length).toBeLessThanOrEqual(TOPE_ENTRADAS);
    for (const p of pertinentes.filter((e) => e.rango === 0)) expect(enTexto).toContain(p.entrada.id);
    expect(texto).toMatch(/^\(Por tamaño se omitieron \d+ entradas de \d+: /m);
    // Si quedó alguna recomendación o divergencia, el texto cabe en el tope.
    const quedanNoCortapisas = pertinentes.some((p) => p.rango > 0 && enTexto.includes(p.entrada.id));
    if (quedanNoCortapisas) expect(texto.length).toBeLessThanOrEqual(TOPE_CARACTERES + 200);
  });

  it('es determinística: mismos datos, mismo texto; no depende del nombre ni del id del sistema', () => {
    const a = seccionBiblia(nuevoSistema('campana', 'Uno', AHORA), COLOR);
    const b = seccionBiblia(nuevoSistema('campana', 'Otro', '2027-01-01T00:00:00.000Z'), [...COLOR].reverse());
    expect(a).not.toBeNull();
    expect(b).toBe(a);
  });
});
