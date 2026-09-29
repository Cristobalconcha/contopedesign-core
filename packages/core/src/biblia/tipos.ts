/**
 * La Biblia del diseño, como datos que ContOpe consulta.
 *
 * La Biblia vive en el vault (`vault_contope-design/biblia/`, un capítulo por
 * tema) y se compila con `pnpm biblia:compilar` a `biblia.generada.json`. Estos
 * son los tipos de ese archivo. Ver `README.md` en esta carpeta.
 *
 * La spec de tipos de producto (§5.2) fija las cuatro fuerzas y dice que
 * consultar la Biblia es «una búsqueda por tipo y rol, sin juicio en tiempo de
 * uso». Por eso acá no hay reglas: sólo lo que el capítulo dice, con el tipo de
 * producto normalizado para poder buscar.
 *
 * Ojo con el nombre: `Fuerza` ya existe en `design-set/types.ts` y es otra cosa
 * (inamovible / prioritaria / explorable, la fuerza de una definición del set).
 * La de la Biblia se llama `FuerzaBiblia`.
 */

/** Los ocho tipos de producto canónicos (spec de tipos de producto §7.3). */
export const TIPOS_DE_PRODUCTO = [
  'marca',
  'editorial-libro',
  'revista',
  'afiche',
  'campana-digital',
  'web',
  'packaging',
  'senaletica',
] as const;
export type TipoDeProducto = (typeof TIPOS_DE_PRODUCTO)[number];

/**
 * Las cuatro fuerzas de la spec §5.2:
 * - `cortapisa`: ContOpe la exige; apartarse es excepción con porqué.
 * - `recomendacion-fuerte`: ContOpe la propone por defecto y explica.
 * - `divergencia`: ContOpe presenta las posturas y el diseñador elige.
 * - `no-aplica`: ContOpe no la menciona.
 */
export const FUERZAS_BIBLIA = ['cortapisa', 'recomendacion-fuerte', 'divergencia', 'no-aplica'] as const;
export type FuerzaBiblia = (typeof FUERZAS_BIBLIA)[number];

/**
 * Estado del tema según `ESTADO.md`: `aprobado` (lo aprobó Cristóbal),
 * `por-revisar` (síntesis y verificación hechas, falta su revisión) o
 * `borrador` (todavía no pasa la síntesis).
 */
export const ESTADOS_BIBLIA = ['aprobado', 'por-revisar', 'borrador'] as const;
export type EstadoBiblia = (typeof ESTADOS_BIBLIA)[number];

/** Una fila de la tabla «Fuerza por tipo y rol» de una entrada. */
export interface FilaDeFuerza {
  /** La primera columna tal cual («packaging, cara principal», «resto», «todos»…). */
  etiqueta: string;
  /**
   * Los tipos que la etiqueta nombra, normalizados por la tabla del compilador.
   * «todos» vale por los ocho; «resto», por los que la tabla no nombró. Vacío si
   * la etiqueta no se reconoció (queda en el informe).
   */
  tipos: TipoDeProducto[];
  /** Lo que sigue a los tipos en la etiqueta («cara principal»), o `null`. */
  rol: string | null;
  /** Las fuerzas de la celda en orden de aparición; vacío si no nombra ninguna. */
  fuerzas: FuerzaBiblia[];
  /** La celda de fuerza cruda (markdown). */
  texto: string;
  /** La columna «porqué», cruda. */
  porque: string;
}

/** Una entrada (`## ENN. Título`) de un capítulo. */
export interface EntradaBiblia {
  /** `05.E04`: tema y entrada. */
  id: string;
  /** `E04`. */
  numero: string;
  titulo: string;
  /** El enunciado, en una línea. */
  enunciado: string;
  /** «Hecho medible», «Postura»…, en una línea. */
  tipo: string;
  /** Las posturas, en markdown crudo, o `null` si la entrada no tiene. */
  posturas: string | null;
  /** «Para aprender», en markdown crudo. */
  paraAprender: string;
  /** «Fuentes», en markdown crudo. */
  fuentes: string;
  /** «Contradicciones abiertas», en markdown crudo, o `null`. */
  contradicciones: string | null;
  /** La prosa del bloque de fuerza que no es tabla (algunas entradas sólo tienen esto). */
  notaFuerza: string | null;
  fuerzas: FilaDeFuerza[];
}

export interface TemaBiblia {
  /** `05`. */
  numero: string;
  /** `color-contraste`, del nombre del archivo. */
  slug: string;
  titulo: string;
  estado: EstadoBiblia;
  entradas: EntradaBiblia[];
}

/** Lo que el compilador no pudo leer sin adivinar. */
export interface InformeBiblia {
  entradas: number;
  filas: number;
  celdasConUnaFuerza: number;
  celdasConVariasFuerzas: number;
  celdasSinFuerza: Array<{ id: string; etiqueta: string; texto: string }>;
  etiquetasSinTipo: Array<{ id: string; etiqueta: string }>;
  comodinesExpandidos: Array<{ id: string; etiqueta: string; comodin: 'todos' | 'resto'; tipos: TipoDeProducto[] }>;
  fuerzasNegadas: Array<{ id: string; etiqueta: string; texto: string; negadas: FuerzaBiblia[] }>;
  entradasSinTablaDeFuerza: string[];
  camposFaltantes: Array<{ id: string; campo: string }>;
  etiquetasDeParrafoNoLeidas: Record<string, number>;
  temasSinEstado: string[];
  avisos: string[];
}

/** El archivo `biblia.generada.json` completo. */
export interface BibliaGenerada {
  fuente: {
    /** La carpeta leída, relativa a la raíz del repo. */
    carpeta: string;
    /** `git rev-parse HEAD` del repo de la Biblia, o `null` si no se pudo. */
    commit: string | null;
    /** Cuándo se compiló (ISO 8601). */
    generadoEn: string;
  };
  temas: TemaBiblia[];
  informe: InformeBiblia;
}

/** Una entrada devuelta por `consultarBiblia`, con su tema a la vista. */
export interface EntradaConsultada extends EntradaBiblia {
  tema: Pick<TemaBiblia, 'numero' | 'slug' | 'titulo' | 'estado'>;
}

export interface ConsultaBiblia {
  /** Números de tema (`'05'`); sin esto, todos. */
  temas?: readonly string[];
  /**
   * Tipos de producto; sin esto, todas las filas. Con esto, sólo las filas que
   * nombran alguno de esos tipos, y sólo las entradas que conservan al menos una.
   */
  tipos?: readonly TipoDeProducto[];
  /** Estados admitidos; sin esto, todos. */
  soloEstados?: readonly EstadoBiblia[];
}
