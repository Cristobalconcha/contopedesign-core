/**
 * Cámara: matrices 4×4 en orden de columnas, como en v7 (`mul`, `rotX`,
 * `rotY`, `rotZ`, `translate`). El orden de las sumas dentro de `multiplicar`
 * es el de v7, a propósito: en coma flotante, sumar en otro orden cambia los
 * últimos bits y, con ellos, la huella.
 */

export type Matriz4 = number[];

export function multiplicar(a: Matriz4, b: Matriz4): Matriz4 {
  const o: number[] = new Array(16);
  for (let c = 0; c < 4; c++) {
    for (let r = 0; r < 4; r++) {
      o[c * 4 + r] = a[r]! * b[c * 4]! + a[4 + r]! * b[c * 4 + 1]! + a[8 + r]! * b[c * 4 + 2]! + a[12 + r]! * b[c * 4 + 3]!;
    }
  }
  return o;
}

export function rotacionX(a: number): Matriz4 { const c = Math.cos(a), s = Math.sin(a); return [1, 0, 0, 0, 0, c, s, 0, 0, -s, c, 0, 0, 0, 0, 1]; }
export function rotacionY(a: number): Matriz4 { const c = Math.cos(a), s = Math.sin(a); return [c, 0, -s, 0, 0, 1, 0, 0, s, 0, c, 0, 0, 0, 0, 1]; }
export function rotacionZ(a: number): Matriz4 { const c = Math.cos(a), s = Math.sin(a); return [c, s, 0, 0, -s, c, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]; }
export function traslacion(x: number, y: number, z: number): Matriz4 { return [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, x, y, z, 1]; }

/** Interpolación de Hermite entre dos bordes (`smooth` en v7). Admite a > b. */
export function suavizado(a: number, b: number, x: number): number {
  const t = Math.min(Math.max((x - a) / (b - a), 0), 1);
  return t * t * (3 - 2 * t);
}
