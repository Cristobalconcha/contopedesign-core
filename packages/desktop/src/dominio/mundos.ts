/**
 * Los mundos de la pantalla de inicio.
 *
 * Cristóbal nombró seis (packaging, editorial, campaña de marketing digital,
 * web, libro, revista) y pidió agruparlos en «unos tres o cuatro». Estos
 * cuatro son una PROPUESTA de la IA, sin confirmar (INTERFAZ.md §1). Cada
 * uno debería traer su propio núcleo; ese núcleo todavía no se investigó, así
 * que hoy los cuatro usan el mismo manifiesto. La interfaz lo dice en
 * pantalla en vez de fingir que ya está.
 */
export type MundoId = 'editorial' | 'marca' | 'digital' | 'campana';

export interface Mundo {
  id: MundoId;
  nombre: string;
  /** Qué clase de trabajo entra acá. */
  abarca: string;
  /** Qué debería pesar en su núcleo, cuando exista. */
  nucleo: string;
}

export const MUNDOS: ReadonlyArray<Mundo> = [
  {
    id: 'editorial',
    nombre: 'Editorial',
    abarca: 'Libro, revista, publicación periódica, informe.',
    nucleo: 'Retícula, jerarquía de lectura, ritmo de página.',
  },
  {
    id: 'marca',
    nombre: 'Marca y packaging',
    abarca: 'Identidad, envase, etiqueta, aplicaciones.',
    nucleo: 'Fundamento cromático, materialidad, escalas de reproducción.',
  },
  {
    id: 'digital',
    nombre: 'Digital',
    abarca: 'Sitio, aplicación, producto en pantalla.',
    nucleo: 'Roles de color, estados, respuesta al tamaño.',
  },
  {
    id: 'campana',
    nombre: 'Campaña',
    abarca: 'Difusión, redes, piezas de marketing.',
    nucleo: 'Sistema de variantes, formatos, consistencia entre piezas.',
  },
];

export function mundo(id: MundoId): Mundo {
  return MUNDOS.find((m) => m.id === id) ?? MUNDOS[0]!;
}

export function esMundoId(valor: unknown): valor is MundoId {
  return typeof valor === 'string' && MUNDOS.some((m) => m.id === valor);
}
