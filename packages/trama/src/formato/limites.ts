/**
 * Límites duros del formato. No son gustos de diseño (los rangos de los
 * controles del generador son más estrechos): son la frontera que protege
 * al reproductor de un archivo que lo congele o lo llene de memoria.
 * Un archivo de trama viene de afuera y se trata como dato no confiable.
 */
export const LIMITES = Object.freeze({
  /** Tamaño máximo del texto que `leerTrama` acepta (JSON o código). */
  textoMaximo: 2_000_000,
  lineasMin: 2,
  lineasMax: 1000,
  puntosMin: 8,
  puntosMax: 4000,
  /** Puntos por cuadro (líneas × puntos por línea). 500.000 puntos = 10 MB por cuadro en Float32. */
  puntosPorCuadroMax: 500_000,
  /** Cota para cualquier otro número de la configuración, en valor absoluto. */
  numeroMax: 1e6,
  duracionMax: 600,
  keyframesPorPistaMax: 5000,
  keyframesMax: 50_000,
  escenasMax: 1000,
  textoCortoMax: 200,
  /** Bytes de `procedencia` serializada. */
  procedenciaMax: 65_536,
  procedenciaProfundidadMax: 32,
  proporcionMin: 0.05,
  proporcionMax: 20,
  medidaMax: 16_384,
  duracionTransicionMin: 0.04,
  duracionTransicionMax: 30,
});
