import { describe, expect, it } from 'vitest';
import { EXPLICACIONES } from './explicaciones.js';
import { REQUISITOS } from './manifiesto.js';

describe('explicaciones', () => {
  it('hay exactamente una por requisito activo del manifiesto, ni más ni menos', () => {
    const ids = REQUISITOS.map((r) => r.id).sort();
    expect(Object.keys(EXPLICACIONES).sort()).toEqual(ids);
    expect(ids).toHaveLength(84);
  });

  it('ninguna está vacía ni repite la pregunta del requisito', () => {
    for (const r of REQUISITOS) {
      const texto = EXPLICACIONES[r.id] ?? '';
      expect(texto.length).toBeGreaterThan(40);
      expect(texto).not.toBe(r.pregunta);
    }
  });
});
