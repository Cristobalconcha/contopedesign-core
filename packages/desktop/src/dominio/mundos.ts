/**
 * Los mundos de la pantalla de inicio.
 *
 * Cristóbal nombró seis (packaging, editorial, campaña de marketing digital,
 * web, libro, revista) y pidió agruparlos en «unos tres o cuatro». Estos
 * cuatro son una PROPUESTA de la IA, sin confirmar (INTERFAZ.md §1). Dos
 * tienen núcleo medido (`nucleoId`): el digital usa el núcleo web (el sitio
 * real, 2026-09-16) y el editorial el núcleo editorial impreso (el folleto
 * real, Claude Design e InDesign, 2026-09-18). Marca y campaña no tienen
 * núcleo desde la tarde del 18-09: marca sobre la identidad real de Santa Luisa
 * (sin pieza de packaging, y se dice) y campaña sobre las piezas para redes.
 */
export type MundoId = 'editorial' | 'marca' | 'digital' | 'campana';

export interface Mundo {
  id: MundoId;
  nombre: string;
  /** Qué clase de trabajo entra acá. */
  abarca: string;
  /** Qué pesa en su núcleo (o qué debería, si no está medido). */
  nucleo: string;
  /** Núcleo medido del repo Core, si existe. */
  nucleoId?: 'web' | 'editorial-impreso' | 'marca' | 'campana';
}

export const MUNDOS: ReadonlyArray<Mundo> = [
  {
    id: 'editorial',
    nombre: 'Editorial',
    abarca: 'Libro, revista, publicación periódica, informe.',
    nucleo: 'Medido el 18-09 sobre el folleto real, Claude Design e InDesign: 40 preguntas y 4 reglas, con la hoja, el sangrado y la reproducción de color.',
    nucleoId: 'editorial-impreso',
  },
  {
    id: 'marca',
    nombre: 'Marca y packaging',
    abarca: 'Identidad, envase, etiqueta, aplicaciones.',
    nucleo: 'Medido el 18-09 sobre la identidad real de Santa Luisa y las referencias de marca de Claude Design: 13 preguntas, con las equivalencias por sistema de color, los usos de marca y la fuerza de cada voz tipográfica. Sin pieza de packaging real: el núcleo es de marca.',
    nucleoId: 'marca',
  },
  {
    id: 'digital',
    nombre: 'Digital',
    abarca: 'Sitio, aplicación, producto en pantalla.',
    nucleo: 'Medido el 16-09 sobre el sitio real: acento, tinta, superficie, títulos, cuerpo, medida, aparecer y responder; contraste 4,5:1.',
    nucleoId: 'web',
  },
  {
    id: 'campana',
    nombre: 'Campaña',
    abarca: 'Difusión, redes, piezas de marketing.',
    nucleo: 'Medido el 18-09 sobre las piezas para redes de Santa Luisa: 10 preguntas, con los formatos soportados, la resolución por medio, las variantes y la dominante; regla de 1080 px de ancho mínimo.',
    nucleoId: 'campana',
  },
];

export function mundo(id: MundoId): Mundo {
  return MUNDOS.find((m) => m.id === id) ?? MUNDOS[0]!;
}

export function esMundoId(valor: unknown): valor is MundoId {
  return typeof valor === 'string' && MUNDOS.some((m) => m.id === valor);
}
