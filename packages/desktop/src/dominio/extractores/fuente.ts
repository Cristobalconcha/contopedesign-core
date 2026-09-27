/**
 * Lee archivos de fuente (TTF, OTF, TTC) y paquetes de fuentes en ZIP (como
 * los que baja Google Fonts: la variable, las estáticas y el OFL.txt). De
 * cada fuente salen, de sus tablas:
 *
 * - `name`: la familia (la tipográfica, id 16, si está; si no, la id 1), el
 *   estilo, el nombre PostScript y la licencia (ids 13 y 14);
 * - `OS/2`: el peso (usWeightClass) y si es itálica;
 * - `fvar`: los ejes de una fuente variable con su rango.
 *
 * Las fuentes se agrupan por familia. Las estáticas de tamaño óptico que
 * Google publica como familias aparte («Big Shoulders 18pt», «… 60pt») se
 * juntan con su familia cuando el paquete trae la variable con eje `opsz`,
 * que es la misma letra.
 *
 * Con eso se propone dim2.req01: cada familia con su pila (la familia y su
 * genérica), la licencia que declara el archivo (o el texto de licencia del
 * paquete) y, si está en el catálogo de Google Fonts que trae la aplicación,
 * su nombre de catálogo y sus idiomas. Un WOFF o WOFF2 (comprimido para la
 * web) no se lee y se dice.
 */
import { unzipSync } from 'fflate';
import { buscarFamilia, genericaDe } from '../catalogo.js';
import type { Candidato } from '../sistema.js';

export interface EjeVariable {
  tag: string;
  min: number;
  defecto: number;
  max: number;
}

export interface FuenteLeida {
  archivo: string;
  familia: string;
  estilo: string;
  postscript: string | undefined;
  peso: number | undefined;
  italica: boolean;
  ejes: EjeVariable[];
  licencia: string | undefined;
  licenciaUrl: string | undefined;
}

export interface FamiliaLeida {
  nombre: string;
  archivos: string[];
  pesos: number[];
  italica: boolean;
  ejes: EjeVariable[];
  licencia: string | undefined;
  licenciaUrl: string | undefined;
  /** Nombres de tamaño óptico estáticos que se juntaron en esta familia. */
  tamanosOpticos: string[];
}

export interface LecturaFuentes {
  fuentes: FuenteLeida[];
  familias: FamiliaLeida[];
  /** Archivos del paquete que no se pudieron leer, con el motivo. */
  sinLeer: Array<{ archivo: string; motivo: string }>;
  /** El texto de licencia que trae el paquete (OFL.txt, LICENSE…), resumido. */
  licenciaDelPaquete: string | undefined;
}

const EXT_FUENTE = /\.(ttf|otf|ttc)$/i;
const EXT_WEB = /\.(woff2?)$/i;

// --- Tablas ------------------------------------------------------------------

function etiqueta(d: DataView, i: number): string {
  return String.fromCharCode(d.getUint8(i), d.getUint8(i + 1), d.getUint8(i + 2), d.getUint8(i + 3));
}

function tablasDe(d: DataView, inicio: number): Map<string, { desde: number; largo: number }> {
  const tablas = new Map<string, { desde: number; largo: number }>();
  const n = d.getUint16(inicio + 4);
  for (let k = 0; k < n; k += 1) {
    const r = inicio + 12 + k * 16;
    tablas.set(etiqueta(d, r), { desde: d.getUint32(r + 8), largo: d.getUint32(r + 12) });
  }
  return tablas;
}

/** Los textos de la tabla `name`: Windows en inglés (UTF-16) primero, Mac Roman si no hay. */
function nombresDe(d: DataView, desde: number): Map<number, string> {
  const salida = new Map<number, string>();
  const secundarios = new Map<number, string>();
  const cuenta = d.getUint16(desde + 2);
  const textos = desde + d.getUint16(desde + 4);
  for (let k = 0; k < cuenta; k += 1) {
    const r = desde + 6 + k * 12;
    const plataforma = d.getUint16(r);
    const idioma = d.getUint16(r + 4);
    const id = d.getUint16(r + 6);
    const largo = d.getUint16(r + 8);
    const at = textos + d.getUint16(r + 10);
    if (plataforma === 3) {
      let s = '';
      for (let j = 0; j + 1 < largo; j += 2) s += String.fromCharCode(d.getUint16(at + j));
      if (idioma === 0x409) salida.set(id, s);
      else if (!secundarios.has(id)) secundarios.set(id, s);
    } else if (plataforma === 1 && !secundarios.has(id)) {
      let s = '';
      for (let j = 0; j < largo; j += 1) s += String.fromCharCode(d.getUint8(at + j));
      secundarios.set(id, s);
    }
  }
  for (const [id, s] of secundarios) if (!salida.has(id)) salida.set(id, s);
  return salida;
}

function ejesDe(d: DataView, desde: number): EjeVariable[] {
  const offsetEjes = d.getUint16(desde + 4);
  const cantidad = d.getUint16(desde + 8);
  const tamano = d.getUint16(desde + 10);
  const fijo = (i: number) => Math.round((d.getInt32(i) / 65536) * 100) / 100;
  const ejes: EjeVariable[] = [];
  for (let k = 0; k < cantidad; k += 1) {
    const r = desde + offsetEjes + k * tamano;
    ejes.push({ tag: etiqueta(d, r), min: fijo(r + 4), defecto: fijo(r + 8), max: fijo(r + 12) });
  }
  return ejes;
}

function fuenteEn(d: DataView, inicio: number, archivo: string): FuenteLeida {
  const tablas = tablasDe(d, inicio);
  const name = tablas.get('name');
  if (!name) throw new Error('no trae tabla de nombres');
  const nombres = nombresDe(d, name.desde);
  const familia = nombres.get(16) ?? nombres.get(1);
  if (!familia) throw new Error('no declara familia');
  const os2 = tablas.get('OS/2');
  const peso = os2 && os2.largo >= 6 ? d.getUint16(os2.desde + 4) : undefined;
  const seleccion = os2 && os2.largo >= 64 ? d.getUint16(os2.desde + 62) : 0;
  const estilo = nombres.get(17) ?? nombres.get(2) ?? 'Regular';
  const fvar = tablas.get('fvar');
  return {
    archivo,
    familia,
    estilo,
    postscript: nombres.get(6),
    peso,
    italica: (seleccion & 1) === 1 || /italic|oblique/i.test(estilo),
    ejes: fvar ? ejesDe(d, fvar.desde) : [],
    licencia: nombres.get(13),
    licenciaUrl: nombres.get(14),
  };
}

/** Lee un archivo de fuente; un TTC trae varias. */
export function leerFuente(bytes: Uint8Array, archivo: string): FuenteLeida[] {
  const d = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (bytes.byteLength < 12) throw new Error('el archivo es demasiado corto para ser una fuente');
  const firma = etiqueta(d, 0);
  if (firma === 'wOFF' || firma === 'wOF2') {
    throw new Error('es una fuente WOFF comprimida para la web: se lee el TTF u OTF de la misma familia');
  }
  if (firma === 'ttcf') {
    const n = d.getUint32(8);
    return Array.from({ length: n }, (_, k) => fuenteEn(d, d.getUint32(12 + k * 4), archivo));
  }
  if (firma !== '\u0000\u0001\u0000\u0000' && firma !== 'OTTO' && firma !== 'true') {
    throw new Error('no empieza como una fuente TrueType u OpenType');
  }
  return [fuenteEn(d, 0, archivo)];
}

// --- Licencias ---------------------------------------------------------------

/** La licencia en pocas palabras: reconoce las de siempre, y si no, la primera oración. */
export function licenciaCorta(texto: string | undefined): string | undefined {
  if (!texto?.trim()) return undefined;
  if (/SIL Open Font License,?\s*Version 1\.1/i.test(texto)) return 'SIL Open Font License 1.1 (OFL)';
  if (/Apache License,?\s*Version 2\.0/i.test(texto)) return 'Apache License 2.0';
  if (/Ubuntu Font Licen[cs]e/i.test(texto)) return 'Ubuntu Font Licence 1.0';
  const oracion = texto.trim().split(/(?<=\.)\s/)[0] ?? texto.trim();
  return oracion.length > 140 ? `${oracion.slice(0, 137)}…` : oracion;
}

// --- Paquetes y familias -------------------------------------------------------

/** Si un ZIP trae fuentes (mira los nombres sin descomprimir). */
export function zipTraeFuentes(bytes: Uint8Array): boolean {
  let hay = false;
  try {
    unzipSync(bytes, {
      filter: (f) => {
        if (EXT_FUENTE.test(f.name) && !f.name.startsWith('__MACOSX')) hay = true;
        return false;
      },
    });
  } catch {
    return false;
  }
  return hay;
}

export function leerFuentes(bytes: Uint8Array, archivo: string): LecturaFuentes {
  const fuentes: FuenteLeida[] = [];
  const sinLeer: Array<{ archivo: string; motivo: string }> = [];
  let licenciaDelPaquete: string | undefined;
  // Un ZIP se reconoce por su firma (PK\3\4), no por el nombre.
  if (bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04) {
    const entradas = unzipSync(bytes, {
      filter: (f) => !f.name.startsWith('__MACOSX') && (EXT_FUENTE.test(f.name) || EXT_WEB.test(f.name) || /(^|\/)(OFL|LICEN[CS]E)[^/]*$/i.test(f.name)),
    });
    for (const [nombre, datos] of Object.entries(entradas).sort(([a], [b]) => a.localeCompare(b))) {
      if (/(^|\/)(OFL|LICEN[CS]E)[^/]*$/i.test(nombre)) {
        licenciaDelPaquete ??= licenciaCorta(new TextDecoder().decode(datos));
        continue;
      }
      try {
        fuentes.push(...leerFuente(datos, nombre));
      } catch (error) {
        sinLeer.push({ archivo: nombre, motivo: (error as Error).message });
      }
    }
  } else {
    fuentes.push(...leerFuente(bytes, archivo));
  }
  return { fuentes, familias: agrupar(fuentes, licenciaDelPaquete), sinLeer, licenciaDelPaquete };
}

function agrupar(fuentes: readonly FuenteLeida[], licenciaDelPaquete: string | undefined): FamiliaLeida[] {
  // Familias con eje de tamaño óptico: sus estáticas «<familia> 18pt» son la misma letra.
  const conOpsz = new Set(fuentes.filter((f) => f.ejes.some((e) => e.tag === 'opsz')).map((f) => f.familia));
  const porFamilia = new Map<string, FamiliaLeida>();
  // Los pesos de las estáticas cuentan sólo si la familia no trae eje wght:
  // la variable ya cubre el rango, y una estática puede declarar 250 por una
  // vieja convención de Windows para ExtraLight.
  const estaticos = new Map<string, number[]>();
  for (const f of fuentes) {
    const optico = /^(.*)\s+(\d+pt)$/i.exec(f.familia);
    const nombre = optico && conOpsz.has(optico[1] ?? '') ? (optico[1] ?? f.familia) : f.familia;
    const g =
      porFamilia.get(nombre) ??
      ({ nombre, archivos: [], pesos: [], italica: false, ejes: [], licencia: undefined, licenciaUrl: undefined, tamanosOpticos: [] } as FamiliaLeida);
    g.archivos.push(f.archivo);
    const wght = f.ejes.find((e) => e.tag === 'wght');
    if (wght) {
      for (let w = Math.ceil(wght.min / 100) * 100; w <= wght.max; w += 100) if (!g.pesos.includes(w)) g.pesos.push(w);
    } else if (f.peso !== undefined) {
      estaticos.set(nombre, [...(estaticos.get(nombre) ?? []), f.peso]);
    }
    g.italica ||= f.italica;
    for (const e of f.ejes) if (!g.ejes.some((x) => x.tag === e.tag)) g.ejes.push(e);
    g.licencia ??= licenciaCorta(f.licencia);
    g.licenciaUrl ??= f.licenciaUrl;
    if (optico && nombre !== f.familia && !g.tamanosOpticos.includes(optico[2] ?? '')) g.tamanosOpticos.push(optico[2] ?? '');
    porFamilia.set(nombre, g);
  }
  for (const g of porFamilia.values()) {
    if (!g.ejes.some((e) => e.tag === 'wght')) g.pesos = [...new Set(estaticos.get(g.nombre) ?? [])];
    g.pesos.sort((a, b) => a - b);
    g.tamanosOpticos.sort((a, b) => parseInt(a, 10) - parseInt(b, 10));
    g.licencia ??= licenciaDelPaquete;
  }
  return [...porFamilia.values()];
}

// --- Resumen y candidato ---------------------------------------------------------

function textoFamilia(g: FamiliaLeida): string {
  const partes = [`pesos ${g.pesos.join(', ') || 'sin declarar'}`];
  if (g.italica) partes.push('con itálica');
  const variables = g.ejes.map((e) => `${e.tag} ${e.min}–${e.max}`);
  if (variables.length) partes.push(`variable (${variables.join(', ')})`);
  if (g.tamanosOpticos.length) partes.push(`estáticas en tamaños ópticos ${g.tamanosOpticos.join(', ')}`);
  partes.push(`${g.archivos.length} ${g.archivos.length === 1 ? 'archivo' : 'archivos'}`);
  return `${g.nombre}: ${partes.join(', ')}`;
}

export function resumenDeFuentes(l: LecturaFuentes): string {
  const n = l.familias.length;
  let texto = `${n} ${n === 1 ? 'familia' : 'familias'} en ${l.fuentes.length} ${l.fuentes.length === 1 ? 'fuente' : 'fuentes'}: ${l.familias.map((g) => g.nombre).join(', ')}.`;
  if (l.sinLeer.length) texto += ` ${l.sinLeer.length} ${l.sinLeer.length === 1 ? 'archivo no se pudo leer' : 'archivos no se pudieron leer'} (${l.sinLeer[0]?.motivo}).`;
  return texto;
}

export function candidatosDeFuentes(l: LecturaFuentes, idBase: string): Candidato[] {
  if (!l.familias.length) return [];
  const familias: Array<{ name: string; stack: string[]; idiomas?: string[]; licencia?: string }> = [];
  const notas: string[] = [];
  const sinLicencia: string[] = [];
  for (const g of l.familias) {
    const catalogo = buscarFamilia(g.nombre);
    const nombre = catalogo?.f ?? g.nombre;
    const licencia = g.licencia ?? (catalogo?.o === 1 ? 'Código abierto según Google Fonts (el archivo no nombra la licencia)' : undefined);
    if (!licencia) sinLicencia.push(nombre);
    familias.push({
      name: nombre,
      stack: catalogo ? [nombre, genericaDe(catalogo)] : [nombre],
      ...(catalogo ? { idiomas: catalogo.l } : {}),
      ...(licencia ? { licencia } : {}),
    });
    notas.push(`${textoFamilia(g)}${catalogo ? '; está en Google Fonts' : '; no está en Google Fonts'}`);
  }
  const conCatalogo = familias.filter((f) => f.idiomas !== undefined).length;
  const faltas: string[] = [];
  if (sinLicencia.length) faltas.push(`Sin licencia declarada: ${sinLicencia.join(', ')}.`);
  if (conCatalogo < familias.length) faltas.push('Los idiomas sólo se completan para las familias del catálogo de Google Fonts; las demás hay que declararlas a mano.');
  return [
    {
      id: `${idBase}-familias`,
      requirementId: 'dim2.req01',
      etiqueta: 'Familias de los archivos de fuente',
      detalle: `${notas.join('. ')}. La licencia sale del propio archivo; la pila y los idiomas, del catálogo de Google Fonts cuando la familia está ahí.`,
      muestra: { tipo: 'familia', familia: familias[0]?.name ?? '', generica: familias[0]?.stack[1] ?? 'sans-serif' },
      fragmento: { familias },
      estado: 'pendiente',
      ...(faltas.length ? { faltante: faltas.join(' ') } : {}),
    },
  ];
}
