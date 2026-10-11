/**
 * Color y tinta: lo que generador, SVG y reproductor dibujan igual.
 *
 * La paleta fija tres colores de partida (lejos, cerca, fondo); la mezcla por
 * profundidad es parte del dibujo, no un color nuevo del sistema (decisión
 * 36: «es como tratar de que una fotografía sólo tenga los colores de la
 * paleta»). La mezcla va en 12 tonos (`BUCKETS` de v7) y el alfa de cada
 * punto en 4 niveles, para dibujar con pocas llamadas.
 */

export type Rgb = [number, number, number];

/** Cuántos tonos hay entre el color lejano y el cercano (`BUCKETS` en v7). */
export const TONOS = 12;
/** Cuántos niveles de alfa se usan para los puntos. */
export const NIVELES_DE_ALFA = 4;
/** Luminancia del fondo desde la cual la tinta automática pasa a «tinta». */
export const UMBRAL_TINTA = 0.4;
/** Un punto con alfa menor que esto no se dibuja. */
export const ALFA_MINIMO_PUNTO = 0.02;

/** `#rrggbb` → [r, g, b] en 0..255 (`hexToRgb` de v7). */
export function hexARgb(hex: string): Rgb {
  return [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
}

/** Mezcla dos `#rrggbb` en proporción k, redondeando y acotando (`lerpHex` de v7). */
export function mezclarHex(a: string, b: string, k: number): string {
  const A = hexARgb(a), B = hexARgb(b);
  return '#' + A.map((x, i) => Math.min(255, Math.max(0, Math.round(x + (B[i]! - x) * k))).toString(16).padStart(2, '0')).join('');
}

/** Luminancia relativa (WCAG) de un `#rrggbb`. */
export function luminancia(hex: string): number {
  const [r, g, b] = hexARgb(hex).map((v) => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  }) as Rgb;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Cómo se acumulan los puntos: `luz` suma (fondo oscuro), `tinta` oscurece (papel). */
export type Tinta = 'luz' | 'tinta';
export type TintaElegida = Tinta | 'auto';
export const TINTAS: readonly TintaElegida[] = ['luz', 'tinta', 'auto'];

/** Resuelve `auto` según el fondo (`inkModeOf` de v7). */
export function modoDeTinta(tinta: TintaElegida | undefined, fondo: string | undefined): Tinta {
  if (tinta === 'luz' || tinta === 'tinta') return tinta;
  return luminancia(fondo || '#000000') > UMBRAL_TINTA ? 'tinta' : 'luz';
}

/** Los 12 tonos de lejos a cerca, en 0..255 (`bucketColor` de v7). */
export function tonosPorProfundidad(lejos: string, cerca: string): Rgb[] {
  const D = hexARgb(lejos), A = hexARgb(cerca);
  return Array.from({ length: TONOS }, (_, b) => {
    const k = b / (TONOS - 1);
    return D.map((d, i) => Math.round(d + (A[i]! - d) * k)) as Rgb;
  });
}

/** Tono (0..11) que le toca a una cercanía (0..1). */
export function tonoDeCercania(cercania: number): number {
  return Math.min(TONOS - 1, Math.round(cercania * (TONOS - 1)));
}

/** Nivel de alfa (0..3) de un alfa ya multiplicado por la opacidad. */
export function nivelDeAlfa(alfa: number): number {
  return Math.min(NIVELES_DE_ALFA - 1, Math.floor(alfa * NIVELES_DE_ALFA));
}

/** Alfa con que se pinta un nivel: el centro del intervalo, (n + 0,5) / 4. */
export function alfaDeNivel(nivel: number): number {
  return (nivel + 0.5) / NIVELES_DE_ALFA;
}
