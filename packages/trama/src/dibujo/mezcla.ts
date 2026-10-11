/**
 * Mezcla lineal de dos cuadros del buffer: lo que hace la pantalla entre dos
 * cuadros calculados (a 12 por segundo en Publisher) para verse a 60.
 * Los cuadros deben medir lo mismo (misma configuración y calidad).
 *
 * Un punto que está detrás de la cámara en un cuadro y delante en el otro
 * se mezcla con ceros, como hoy en Publisher: su radio pasa por valores
 * chicos y el punto aparece o desaparece en ese intervalo.
 */
export function mezclarCuadros(a: ArrayLike<number>, b: ArrayLike<number>, u: number, destino?: Float32Array): Float32Array {
  if (a.length !== b.length) throw new RangeError(`no se pueden mezclar cuadros de ${a.length} y ${b.length} valores`);
  const o = destino && destino.length === a.length ? destino : new Float32Array(a.length);
  for (let i = 0; i < a.length; i++) o[i] = a[i]! + (b[i]! - a[i]!) * u;
  return o;
}
