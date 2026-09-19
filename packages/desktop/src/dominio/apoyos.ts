/**
 * Qué definiciones se APOYAN en otra: las que la referencian de verdad, con
 * un `ref` dentro de su payload (no las que sólo declaran `dependsOn` en el
 * manifiesto, que es una dependencia de evaluación, no de datos). Quitar una
 * definición referenciada deja refs colgantes y el archivo no se puede guardar
 * (`validateDesignSetShape` las rechaza), así que el reductor no la quita sola:
 * o se reemplaza, o se reduce el set quitando también lo que se apoyaba en
 * ella (Cristóbal, 19-09: «se ofrece reemplazar o reducir»).
 */
import type { Sistema } from './sistema.js';

function esRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** Los `refReqId` que aparecen en cualquier profundidad de un valor. */
export function refsDe(v: unknown, salida: string[] = []): string[] {
  if (Array.isArray(v)) for (const x of v) refsDe(x, salida);
  else if (esRecord(v)) {
    if (typeof v['refReqId'] === 'string') salida.push(v['refReqId']);
    for (const x of Object.values(v)) refsDe(x, salida);
  }
  return salida;
}

/** Las definiciones que referencian directamente a `requirementId`. */
export function apoyadasDirectas(sistema: Sistema, requirementId: string): string[] {
  return sistema.designSet.entries
    .filter((e) => e.requirementId !== requirementId && refsDe(e.payload).includes(requirementId))
    .map((e) => e.requirementId);
}

/**
 * Todas las definiciones que caerían si se quita `requirementId`: las que la
 * referencian, las que referencian a ésas, y así. En orden de descubrimiento,
 * sin repetir y sin incluir la propia.
 */
export function apoyadasEn(sistema: Sistema, requirementId: string): string[] {
  const vistas = new Set<string>([requirementId]);
  const salida: string[] = [];
  const cola = [requirementId];
  while (cola.length) {
    const actual = cola.shift() as string;
    for (const id of apoyadasDirectas(sistema, actual)) {
      if (vistas.has(id)) continue;
      vistas.add(id);
      salida.push(id);
      cola.push(id);
    }
  }
  return salida;
}
