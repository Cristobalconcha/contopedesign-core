/**
 * Ruido de Perlin mejorado, con semilla fija.
 *
 * Portado tal cual del generador v7 de la superficie de puntos (`PERM`, `gd`,
 * `noise`): misma semilla (0x2f6b9a1d), mismo generador congruencial con
 * `Math.imul`, misma tabla de gradientes (incluidos los cuatro casos 12–15
 * repetidos de Perlin) y el mismo factor final 0,7. Cambiar un solo número de
 * este archivo cambia la imagen de todas las tramas ya publicadas: la prueba
 * de la huella de referencia lo detecta.
 */

/** Permutación de 512 entradas (256 duplicadas), barajada con semilla fija. */
export const PERMUTACION: Uint8Array = (() => {
  const p = new Uint8Array(256);
  for (let i = 0; i < 256; i++) p[i] = i;
  let semilla = 0x2f6b9a1d;
  for (let i = 255; i > 0; i--) {
    semilla = (Math.imul(semilla, 1664525) + 1013904223) >>> 0;
    const j = semilla % (i + 1);
    const t = p[i]!;
    p[i] = p[j]!;
    p[j] = t;
  }
  const salida = new Uint8Array(512);
  for (let i = 0; i < 512; i++) salida[i] = p[i & 255]!;
  return salida;
})();

/** Producto con el gradiente elegido por los 4 bits bajos de `h` (`gd` en v7). */
function gradiente(h: number, x: number, y: number, z: number): number {
  switch (h & 15) {
    case 0: return x + y; case 1: return -x + y; case 2: return x - y; case 3: return -x - y;
    case 4: return x + z; case 5: return -x + z; case 6: return x - z; case 7: return -x - z;
    case 8: return y + z; case 9: return -y + z; case 10: return y - z; case 11: return -y - z;
    case 12: return x + y; case 13: return -y + z; case 14: return -x + y; default: return -y - z;
  }
}

/** Ruido 3D en [-0,7; 0,7] aprox. (`noise` en v7). Determinista. */
export function ruido(x: number, y: number, z: number): number {
  const P = PERMUTACION;
  const fx = Math.floor(x), fy = Math.floor(y), fz = Math.floor(z);
  const X = fx & 255, Y = fy & 255, Z = fz & 255;
  x -= fx; y -= fy; z -= fz;
  const u = x * x * x * (x * (x * 6 - 15) + 10), v = y * y * y * (y * (y * 6 - 15) + 10), w = z * z * z * (z * (z * 6 - 15) + 10);
  const A = P[X]! + Y, AA = P[A]! + Z, AB = P[A + 1]! + Z, B = P[X + 1]! + Y, BA = P[B]! + Z, BB = P[B + 1]! + Z;
  const a = gradiente(P[AA]!, x, y, z), b = gradiente(P[BA]!, x - 1, y, z), c = gradiente(P[AB]!, x, y - 1, z), d = gradiente(P[BB]!, x - 1, y - 1, z);
  const e = gradiente(P[AA + 1]!, x, y, z - 1), f = gradiente(P[BA + 1]!, x - 1, y, z - 1), g = gradiente(P[AB + 1]!, x, y - 1, z - 1), h = gradiente(P[BB + 1]!, x - 1, y - 1, z - 1);
  const ab = a + u * (b - a), cd = c + u * (d - c), ef = e + u * (f - e), gh = g + u * (h - g);
  const l1 = ab + v * (cd - ab), l2 = ef + v * (gh - ef);
  return (l1 + w * (l2 - l1)) * 0.7;
}
