/**
 * ContOpeDesign Core — la superficie pública del paquete.
 *
 * Un barril, y nada más que un barril: no declara tipos propios. Esto no es
 * cosmético. En el repositorio anterior las interfaces de la memoria de
 * construcción vivían DENTRO del índice, y el índice reexportaba el motor
 * entero; por eso un solo `import type` hacía aparecer 17.608 líneas como
 * «alcanzables» y costó dos días de medición entender que no se usaban.
 *
 * Regla que sale de ahí: un archivo declara o reexporta, nunca las dos cosas.
 * Los módulos internos importan del archivo concreto, jamás de este índice.
 */

export * from './memoria-de-construccion.js';
export * from './design-contract.js';
export * from './design-contract-design-md.js';
export * from './design-contract-portable.js';
export * from './requirement-manifest/index.js';
export * from './design-set/index.js';
