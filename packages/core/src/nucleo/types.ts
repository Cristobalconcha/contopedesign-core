/**
 * Núcleos por mundo — ficha C1-núcleo.
 *
 * El manifiesto es el catálogo de preguntas: todo lo que un set PUEDE
 * responder. El núcleo de un mundo es lo que un set de ese mundo NO PUEDE
 * dejar sin responder (ARQUITECTURA.md, «El core no es uno solo»): un
 * packaging, una revista y un sitio no exigen el mismo mínimo.
 *
 * Un núcleo tiene dos partes, que Cristóbal pidió por separado el 18-09:
 *
 * 1. **Las preguntas** (`entradas`): qué hay que definir. Una lista de ids de
 *    requisito, no de valores: lo que importa es que EXISTA una definición
 *    para cada uno («no importa cuál es la tipografía, no importa cuál es el
 *    color, lo que importa es que existe una definición», 2026-09-16).
 * 2. **Las reglas** (`reglas`): cómo se sabe que una definición está bien
 *    según la base de conocimiento. Umbrales con cita sobre preguntas que ya
 *    existen —contraste ≥ 4,5:1, cuerpo impreso ≥ 12 pt, filetes ≥ 1 px—,
 *    que cambian por mundo aunque la pregunta sea la misma («los tamaños
 *    tipográficos, los filetes, el contraste, las zonas seguras se consideran
 *    en web también», 18-09). Una regla se evalúa con el mismo evaluador de
 *    predicados, encima del predicado del requisito, y nunca lo modifica.
 *
 * Este módulo no reimplementa nada: la validez de cada respuesta ya la decide
 * `evaluateManifest`; acá sólo se pregunta si las respuestas que el mundo
 * exige están todas y si cumplen sus umbrales.
 *
 * Cada núcleo declara de dónde salió (`fuente`, `medidoEn`): un núcleo se
 * cierra midiendo algo real —el sitio que funciona, las reglas de impreso de
 * Claude Design, la pieza impresa que existe—, nunca razonando en abstracto.
 * Un núcleo sin fuente medida no se escribe; una regla sin cita, tampoco.
 */
import type { PredicateClause } from '../requirement-manifest/predicate.js';
import type { Motivo } from '../requirement-manifest/types.js';

/** Una pregunta que el mundo exige, con el porqué medido. */
export interface NucleoEntradaV0 {
  /** Id de requisito del manifiesto (`dimN.reqNN`); debe existir y estar activo. */
  requisitoId: string;
  /** Por qué este mundo no puede dejarla sin responder, con la fuente medida. */
  porque: string;
  /**
   * Cuando el requisito agrupa varios roles y el mundo sólo exige algunos,
   * se nombran acá (por ejemplo, del rol de color: acento, tinta,
   * superficie). Es información para la interfaz y para C2; C1 sigue
   * evaluando el requisito entero.
   */
  roles?: readonly string[];
}

/**
 * Una regla de la base de conocimiento para este mundo: un umbral con cita,
 * escrito como cláusulas del mismo AST que los predicados del manifiesto, y
 * evaluado sobre el payload del requisito que nombra. No cambia el
 * requisito: un set que no cumple la regla resuelve la pregunta pero no
 * cubre el núcleo del mundo.
 */
export interface ReglaDeMundoV0 {
  /** Identificador estable, `<mundoId>.<nombre-corto>`. */
  id: string;
  /** Requisito cuyo payload evalúa; debe estar entre las `entradas` del núcleo. */
  requisitoId: string;
  nombre: string;
  /** La cita textual de la base de conocimiento de la que sale el umbral. */
  cita: string;
  clausulas: readonly PredicateClause[];
}

export interface NucleoDeMundoV0 {
  schemaVersion: 1;
  /** Identificador estable del mundo (`web`, `editorial-impreso`, …). */
  mundoId: string;
  nombre: string;
  /** Qué se midió para cerrarlo (un sitio real, una pieza real, una fuente de reglas). */
  fuente: string;
  /** Fecha ISO-8601 de la medición. */
  medidoEn: string;
  entradas: readonly NucleoEntradaV0[];
  reglas: readonly ReglaDeMundoV0[];
}

export interface ReglaResultV0 {
  reglaId: string;
  requisitoId: string;
  resultado: 'cumple' | 'no-cumple';
  motivos: Motivo[];
}

/**
 * Resultado binario del núcleo (misma disciplina que el manifiesto: nunca un
 * tercer estado). `contador` es diagnóstico de interfaz, no un estado.
 */
export interface NucleoEvaluationV0 {
  mundoId: string;
  resultado: 'cubierto' | 'no-cubierto';
  /** Ids del núcleo cuyo requisito no está resuelto (o no fue evaluado). */
  faltantes: string[];
  /** Una entrada por regla del núcleo, en orden. */
  reglas: ReglaResultV0[];
  contador: {
    cubiertos: number;
    total: number;
    reglasCumplidas: number;
    reglasTotal: number;
  };
}
