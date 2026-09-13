import { describe, expect, it } from 'vitest';
import { isColorCss, isLengthCss, lengthCssToPx } from './css-values';

describe('isColorCss (compiler:187 — colores planos hex/rgb/hsl/oklch)', () => {
  it('acepta hex en sus cuatro formas', () => {
    expect(isColorCss('#1d4ed8')).toBe(true);
    expect(isColorCss('#fff')).toBe(true);
    expect(isColorCss('#fff8')).toBe(true);
    expect(isColorCss('#1d4ed8cc')).toBe(true);
  });

  it('acepta rgb/rgba válidos y rechaza componentes fuera de rango', () => {
    expect(isColorCss('rgb(29, 78, 216)')).toBe(true);
    expect(isColorCss('rgb(100%, 0%, 50%)')).toBe(true);
    expect(isColorCss('rgba(29, 78, 216, 0.5)')).toBe(true);
    expect(isColorCss('rgb(300, 0, 0)')).toBe(false);
    expect(isColorCss('rgba(0, 0, 0, 1.5)')).toBe(false);
  });

  it('acepta hsl/hsla y oklch', () => {
    expect(isColorCss('hsl(220, 60%, 50%)')).toBe(true);
    expect(isColorCss('hsla(220, 60%, 50%, 0.4)')).toBe(true);
    expect(isColorCss('oklch(55% 0.2 250)')).toBe(true);
    expect(isColorCss('oklch(55% 0.2 250 / 0.5)')).toBe(true);
  });

  it('rechaza nombres de color, var() y no-colores', () => {
    expect(isColorCss('red')).toBe(false);
    expect(isColorCss('var(--cod-color-accent)')).toBe(false);
    expect(isColorCss('')).toBe(false);
    expect(isColorCss(123)).toBe(false);
    expect(isColorCss('linear-gradient(red, blue)')).toBe(false);
  });
});

describe('isLengthCss', () => {
  it('acepta cero sin unidad y números con unidad del set cerrado', () => {
    expect(isLengthCss('0')).toBe(true);
    expect(isLengthCss('12px')).toBe(true);
    expect(isLengthCss('1.5rem')).toBe(true);
    expect(isLengthCss('10%')).toBe(true);
    expect(isLengthCss('0.25em')).toBe(true);
  });

  it('rechaza longitudes inválidas', () => {
    expect(isLengthCss('12')).toBe(false);
    expect(isLengthCss('auto')).toBe(false);
    expect(isLengthCss('')).toBe(false);
    expect(isLengthCss('calc(100% - 12px)')).toBe(false);
  });
});

describe('lengthCssToPx (extensión dim2 2026-08-31 — compareCss)', () => {
  it('convierte unidades absolutas sin ambigüedad', () => {
    expect(lengthCssToPx('16px')).toEqual({ ok: true, px: 16 });
    expect(lengthCssToPx('1in')).toEqual({ ok: true, px: 96 });
    expect(lengthCssToPx('0')).toEqual({ ok: true, px: 0 });
    expect(lengthCssToPx('0px')).toEqual({ ok: true, px: 0 });
  });

  it('convierte rem bajo la asunción fija y declarada de raíz = 16px', () => {
    expect(lengthCssToPx('1rem')).toEqual({ ok: true, px: 16 });
    expect(lengthCssToPx('2.5rem')).toEqual({ ok: true, px: 40 });
  });

  it('rechaza unidades relativas fail-closed, nunca adivina', () => {
    for (const rel of ['1em', '50%', '10vh', '10vw', '2ch', '1ex']) {
      const r = lengthCssToPx(rel);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.codigo).toBe('unidad-no-comparable');
    }
  });

  it('rechaza valores que no son longitud-css válida', () => {
    const r = lengthCssToPx('auto');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.codigo).toBe('valor-css-invalido');
  });
});
