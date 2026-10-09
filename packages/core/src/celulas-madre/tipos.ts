/**
 * Células Madre — los tipos (decisión 35 del vault, 08-10-2026).
 *
 * Core tiene dos partes: el ADN (las definiciones del sistema, que son
 * descripción) y las Células Madre (material hecho con ese ADN, en archivos
 * que se importan tal cual en otra herramienta: la paleta como `.ase`, un
 * archivo de degradados, una retícula, una textura, una animación vectorial).
 *
 * Las Células Madre son un SET DE GENERADORES. Cada generador es una
 * EXTENSIÓN: declara qué preguntas del manifiesto lee, dice si el ADN le
 * alcanza (y si no, qué falta, en palabras de diseñador), ofrece unos pocos
 * parámetros con valor por defecto y construye los archivos.
 *
 * Requisito de Cristóbal: cada archivo lleva la metadata que lo relaciona con
 * su ancestro de ADN (ver `MetadataDeCelula`).
 */
import type { DesignSetV0 } from '../design-set/types.js';

/** Un archivo que sale de un generador, listo para guardarse tal cual. */
export interface ArchivoGenerado {
  /** Nombre de archivo, sin carpetas (`econut-paleta.ase`). */
  nombre: string;
  tipoMime: string;
  contenido: Uint8Array | string;
  /**
   * Qué trae este archivo, en palabras («Retícula «artículo» en carta
   * vertical: 8 columnas de…»). Opcional: el `LEEME.md` lo pone junto al
   * nombre del archivo. No entra en la huella ni en el registro.
   */
  detalle?: string;
}

/** Una opción que el diseñador elige; `muestra` es un color CSS para dibujarla, si tiene. */
export interface OpcionDeParametro {
  valor: string;
  etiqueta: string;
  muestra?: string;
}

interface ParametroBase {
  id: string;
  /** Lo que ve el diseñador («Incluir las rampas»). */
  etiqueta: string;
  ayuda?: string;
}

/**
 * El esquema de un parámetro. Cuatro clases bastan por ahora; las opciones de
 * `seleccion` pueden depender del ADN (los colores que hay definidos).
 */
export type Parametro =
  | (ParametroBase & { tipo: 'si-no'; porDefecto: boolean })
  | (ParametroBase & { tipo: 'numero'; porDefecto: number; min: number; max: number; paso?: number; unidad?: string })
  | (ParametroBase & { tipo: 'opcion'; porDefecto: string; opciones: readonly OpcionDeParametro[] })
  | (ParametroBase & {
      tipo: 'seleccion';
      /** Lista vacía = el generador decide (lo dice en `ayuda`). */
      porDefecto: (designSet: DesignSetV0) => string[];
      opciones: (designSet: DesignSetV0) => OpcionDeParametro[];
      /** Si el orden de lo elegido importa (una secuencia de degradado sí). */
      ordenada?: boolean;
      /** Con menos de esto elegido (o que siga existiendo en el ADN), vale el valor por defecto. */
      minimo?: number;
      /** Lo más que se puede elegir; con `1`, el menú la muestra como elección de una sola opción. */
      maximo?: number;
    });

export type ValorDeParametro = boolean | number | string | string[];

/** Los parámetros ya resueltos: cada id con su valor (los que faltaban, con su valor por defecto). */
export type Parametros = Record<string, ValorDeParametro>;

export type Disponibilidad = { ok: true } | { ok: false; falta: string };

/** Qué sistema se está generando: su id y su nombre, como los guarda el taller. */
export interface SistemaDeOrigen {
  designId: string;
  nombre: string;
}

/** Lo que un generador recibe además del ADN y los parámetros. */
export interface ContextoDeGeneracion {
  sistema: SistemaDeOrigen;
  /** Fecha ISO de la generación. Se inyecta para que generar sea determinista. */
  generadoEn: string;
  /**
   * La metadata común de esta generación, ya armada. El generador la mete
   * DENTRO del archivo cuando el formato lo permite (SVG `<metadata>`, PNG
   * `iTXt`, `meta` de un JSON). El `LEEME.md` que acompaña a los archivos
   * en el `.zip` lo escribe `generarCelula`, no el generador.
   */
  metadata: MetadataDeCelula;
}

/** Una Célula Madre: la extensión que hace archivos desde el ADN. */
export interface Generador {
  /** Estable y en minúsculas: `paleta-ase`. No cambia nunca. */
  id: string;
  /** Semver. Se sube cuando cambia lo que el generador escribe. */
  version: string;
  nombre: string;
  /** Qué hace, en palabras de diseñador. */
  descripcion: string;
  /** El formato que entrega y dónde se abre («.ase · Illustrator, InDesign, Photoshop»). */
  formato: string;
  /** Qué lee del ADN, dicho para el diseñador («los colores del fundamento y los roles»). */
  queLee: string;
  /**
   * Qué preguntas del manifiesto lee: ids de requisito, o una función sobre el
   * set (y los parámetros ya resueltos) cuando depende de lo que haya definido
   * o de lo que se eligió: si las rampas no se incluyen, cambiar una rampa no
   * deja la paleta desactualizada. De acá salen los ancestros.
   */
  lee: readonly string[] | ((designSet: DesignSetV0, parametros: Parametros) => string[]);
  disponible(designSet: DesignSetV0): Disponibilidad;
  parametros: readonly Parametro[];
  /**
   * Cómo se usan sus archivos, si el generador sabe decirlo mejor que la
   * receta del formato (`comoUsarArchivo`): una grilla se coloca y se bloquea,
   * no sólo se abre. El `LEEME.md` lo pone en «Cómo usarlo», una vez para
   * todos los archivos.
   */
  comoUsar?: string;
  generar(designSet: DesignSetV0, parametros: Parametros, contexto: ContextoDeGeneracion): ArchivoGenerado[];
}

export const KIND_CELULA_MADRE = 'contope/celula-madre';
export const SCHEMA_CELULA_MADRE = 1;

/** Una definición del ADN que el generador leyó: el ancestro del archivo. */
export interface AncestroDeAdn {
  requirementId: string;
  effectiveDefinitionId: string;
  revision: number;
  /** `sha256:` + SHA-256 del JSON canónico del payload. */
  huella: string;
}

/**
 * La metadata que relaciona un archivo con su ancestro de ADN. Va dentro del
 * archivo cuando el formato lo permite y SIEMPRE al final del `LEEME.md` que
 * baja con él en el `.zip` (el `.ase` no tiene dónde guardarla).
 */
export interface MetadataDeCelula {
  kind: typeof KIND_CELULA_MADRE;
  schemaVersion: typeof SCHEMA_CELULA_MADRE;
  sistema: SistemaDeOrigen & { designSetId: string };
  generador: { id: string; version: string; nombre: string };
  generadoEn: string;
  /** Las preguntas que el generador consulta, estén o no definidas al generar. */
  consulta: string[];
  /** Las definiciones que existían y se leyeron, con su huella. */
  ancestros: AncestroDeAdn[];
  parametros: Parametros;
}

/** Un archivo generado como lo recuerdan la ficha y el taller: sin el contenido, con su huella. */
export interface ArchivoRegistrado {
  nombre: string;
  tipoMime: string;
  /** `sha256:` + SHA-256 de los bytes del archivo. */
  huella: string;
}

/**
 * La ficha de una generación, la que cierra el `LEEME.md`: la metadata común
 * más la identidad de cada archivo que la acompaña en el `.zip`. No puede ir
 * dentro del archivo mismo (su huella se mordería la cola).
 */
export interface FichaDeCelula extends MetadataDeCelula {
  archivos: ArchivoRegistrado[];
}

/** Un cambio en el ADN desde que se generó el archivo. */
export interface CambioDeAncestro {
  requirementId: string;
  motivo: 'cambio' | 'borrada' | 'nueva';
}

export type Vigencia =
  | { estado: 'vigente' }
  | { estado: 'desactualizada'; cambios: CambioDeAncestro[] }
  | { estado: 'huérfana'; motivo: string };
