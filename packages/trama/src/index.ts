/**
 * @contope/trama — las tramas generativas de ContOpe (decisión 36).
 *
 * Un barril, y nada más que un barril (la regla del repositorio: un archivo
 * declara o reexporta, nunca las dos cosas). Los módulos internos importan
 * del archivo concreto, jamás de este índice.
 */

// el motor: superficie de puntos
export * from './motor/ruido.js';
export * from './motor/camara.js';
export * from './motor/configuracion.js';
export * from './motor/lamina.js';
export * from './motor/espiral.js';

// lo compartido del dibujo
export * from './dibujo/color.js';
export * from './dibujo/modo.js';
export * from './dibujo/puntos.js';
export * from './dibujo/tramos.js';
export * from './dibujo/tiras.js';
export * from './dibujo/mezcla.js';
export * from './dibujo/svg.js';

// la línea de tiempo
export * from './linea-de-tiempo/suavizados.js';
export * from './linea-de-tiempo/parametros.js';
export * from './linea-de-tiempo/evaluar.js';
export * from './linea-de-tiempo/escenas.js';

// el archivo de trama
export * from './formato/tipos.js';
export * from './formato/limites.js';
export * from './formato/por-defecto.js';
export * from './formato/validar.js';
export * from './formato/normalizar.js';
export * from './formato/base64.js';
export * from './formato/codigo.js';
export * from './formato/generador-v7.js';

// una trama en el tiempo
export * from './reproduccion.js';
