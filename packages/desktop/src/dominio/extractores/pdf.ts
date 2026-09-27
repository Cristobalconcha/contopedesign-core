/**
 * Lee un PDF sin dibujarlo. De ahí salen
 *
 * - los colores que el documento pinta (operadores `rg`/`RG`, `k`/`K`, `g`/`G`
 *   y `sc`/`scn` sobre espacios de dispositivo), contados por uso → dim1.req01;
 * - las tintas planas declaradas (`/Separation`, típicamente un Pantone), con su
 *   nombre y, cuando el PDF lo trae a la vista, su equivalente → dim1.req01;
 * - las familias de las fuentes (`/BaseFont`, sin el prefijo de subconjunto
 *   `ABCDEF+`) → dim2.req01;
 * - la medida de la primera página (caja de corte si la hay, y la del soporte)
 *   y cuántas páginas tiene, como detalle para mirar.
 *
 * Se lee el archivo tal cual, como el IDML: expresiones regulares sobre el
 * texto del PDF y sobre sus flujos descomprimidos (FlateDecode, con fflate).
 * No se usa un motor de PDF porque el que dibuja (pdf.js) convierte todo a RGB
 * y pierde lo que a un impreso le importa: el CMYK de imprenta y el nombre de
 * la tinta plana. Dibujar la página para la miniatura es otra cosa y vive en
 * el navegador (`navegador/pdf.ts`).
 *
 * Límites, dichos en el resumen del insumo y no escondidos: un PDF cifrado no
 * se lee; un color pintado sobre un espacio con nombre (ICC, Lab, indexado)
 * no se cuenta; el equivalente de una tinta plana se lee de una función de
 * tipo 2 (`/C1`) o de tipo 4 (PostScript), no de una muestreada; los flujos
 * con filtros que no son Flate, ASCII85 o ASCIIHex (LZW, RunLength…) se
 * saltan. Un CMYK se muestra convertido a hex de forma aproximada, y se dice.
 */
import { inflateSync, unzlibSync } from 'fflate';
import type { Candidato } from '../sistema.js';
import { aHex, cmykARgb, esNeutro, type Rgb } from './color.js';

export type EspacioPdf = 'RGB' | 'CMYK' | 'Gris';

export interface ColorPdf {
  espacio: EspacioPdf;
  /** Componentes en la escala del PDF: 0..1. */
  componentes: number[];
  hex: string;
  /** Cuántas veces el documento fija este color como relleno o trazo. */
  usos: number;
}

export interface TintaPlanaPdf {
  nombre: string;
  /** Espacio del equivalente declarado por el PDF. */
  alternativo: EspacioPdf | undefined;
  /** El equivalente a tinta llena (`/C1`), si el PDF lo trae a la vista. */
  componentes: number[] | undefined;
  hex: string | undefined;
}

export interface MedidaPdf {
  /** En milímetros, redondeado a la décima. */
  ancho: number;
  alto: number;
  /** De qué caja salió: la de corte (`TrimBox`) o la del soporte (`MediaBox`). */
  caja: 'TrimBox' | 'MediaBox';
}

export interface LecturaPdf {
  cifrado: boolean;
  paginas: number;
  /** La medida de la primera página; la de corte cuando existe. */
  medida: MedidaPdf | undefined;
  /** La del soporte, cuando es distinta de la de corte (el sangrado). */
  soporte: MedidaPdf | undefined;
  colores: ColorPdf[];
  tintasPlanas: TintaPlanaPdf[];
  /** Familias, sin repetir, en orden de aparición. */
  familias: string[];
  /** Los nombres PostScript tal cual (sin prefijo de subconjunto): el detalle para mirar. */
  fuentes: string[];
  /** Flujos que no se pudieron descomprimir o traían un filtro que no se lee. */
  flujosSinLeer: number;
}

/** Cuántos colores se proponen como máximo; el resto se cuenta en el detalle. */
const MAX_COLORES = 12;
/** Un flujo descomprimido más grande que esto no es texto de página: se salta. */
const MAX_FLUJO = 8 * 1024 * 1024;

const PT_A_MM = 25.4 / 72;

// --- Flujos ------------------------------------------------------------------

interface Flujo {
  diccionario: string;
  datos: Uint8Array;
}

/** Todo el archivo como texto de un byte por carácter, para buscar sin perder posiciones. */
function comoLatin1(bytes: Uint8Array): string {
  return new TextDecoder('latin1').decode(bytes);
}

/** El diccionario que precede a `stream`: desde el `obj` anterior, o los últimos 4 KB. */
function diccionarioAntesDe(texto: string, fin: number): string {
  const desde = Math.max(0, fin - 4096);
  const trozo = texto.slice(desde, fin);
  const obj = trozo.lastIndexOf(' obj');
  return obj >= 0 ? trozo.slice(obj + 4) : trozo;
}

function descomprimir(datos: Uint8Array): Uint8Array | undefined {
  try {
    return unzlibSync(datos);
  } catch {
    try {
      return inflateSync(datos);
    } catch {
      return undefined;
    }
  }
}

/** ASCII85 (`<~ … ~>`), como lo escriben ReportLab y PostScript. */
function desdeAscii85(datos: Uint8Array): Uint8Array | undefined {
  const salida: number[] = [];
  let grupo: number[] = [];
  const volcar = (n: number): void => {
    let valor = 0;
    for (const c of grupo) valor = valor * 85 + c;
    const bytes = [(valor >>> 24) & 255, (valor >>> 16) & 255, (valor >>> 8) & 255, valor & 255];
    salida.push(...bytes.slice(0, n));
  };
  let i = 0;
  if (datos[0] === 0x3c && datos[1] === 0x7e) i = 2;
  for (; i < datos.length; i += 1) {
    const c = datos[i] ?? 0;
    if (c === 0x7e) break; // `~>`
    if (c <= 0x20) continue;
    if (c === 0x7a && grupo.length === 0) {
      salida.push(0, 0, 0, 0);
      continue;
    }
    if (c < 0x21 || c > 0x75) return undefined;
    grupo.push(c - 33);
    if (grupo.length === 5) {
      volcar(4);
      grupo = [];
    }
  }
  if (grupo.length > 0) {
    const faltan = 5 - grupo.length;
    for (let k = 0; k < faltan; k += 1) grupo.push(84);
    volcar(4 - faltan);
  }
  return new Uint8Array(salida);
}

/** ASCIIHex (`… >`): pares hexadecimales; un dígito suelto al final vale como `X0`. */
function desdeAsciiHex(datos: Uint8Array): Uint8Array {
  const texto = new TextDecoder('latin1').decode(datos).split('>')[0]?.replace(/[^0-9a-fA-F]/g, '') ?? '';
  const par = texto.length % 2 ? `${texto}0` : texto;
  const salida = new Uint8Array(par.length / 2);
  for (let k = 0; k < salida.length; k += 1) salida[k] = parseInt(par.slice(k * 2, k * 2 + 2), 16);
  return salida;
}

/**
 * Aplica la cadena de filtros que declara el diccionario, en orden. Lee
 * FlateDecode, ASCII85Decode y ASCIIHexDecode (y sus abreviaturas); con
 * cualquier otro filtro, o si algo falla, devuelve undefined.
 */
export function decodificarFlujo(diccionario: string, crudo: Uint8Array): Uint8Array | undefined {
  const declarado = /\/Filter\s*(\[[^\]]*\]|\/\w+)/.exec(diccionario)?.[1];
  const filtros = declarado === undefined ? [] : [...declarado.matchAll(/\/(\w+)/g)].map((m) => m[1] ?? '');
  let datos: Uint8Array | undefined = crudo;
  for (const filtro of filtros) {
    if (datos === undefined) return undefined;
    if (filtro === 'FlateDecode' || filtro === 'Fl') datos = descomprimir(datos);
    else if (filtro === 'ASCII85Decode' || filtro === 'A85') datos = desdeAscii85(datos);
    else if (filtro === 'ASCIIHexDecode' || filtro === 'AHx') datos = desdeAsciiHex(datos);
    else return undefined;
  }
  return datos;
}

/** Los bytes entre `stream` y `endstream`, sin el fin de línea que precede a `endstream`. */
function crudoDeFlujo(bytes: Uint8Array, comienzo: number, fin: number): Uint8Array {
  let crudo = bytes.subarray(comienzo, fin);
  while (crudo.length > 0 && (crudo[crudo.length - 1] === 0x0a || crudo[crudo.length - 1] === 0x0d)) {
    crudo = crudo.subarray(0, crudo.length - 1);
  }
  return crudo;
}

const NO_ES_TEXTO =
  /\/Subtype\s*\/Image\b|\/Alternate\s*\/Device|\/FunctionType\b|\/Type\s*\/EmbeddedFile\b|\/Length[123]\b|\/Subtype\s*\/(?:Type1C|CIDFontType0C|OpenType)\b|\/Type\s*\/XRef\b/;

/**
 * Recorre los flujos del archivo. Salta los que no son texto (imágenes,
 * archivos de fuente, perfiles ICC, funciones, tablas de referencias) sin
 * descomprimirlos, y cuenta los que no se pudieron leer.
 */
function flujosDe(bytes: Uint8Array, texto: string): { flujos: Flujo[]; sinLeer: number } {
  const flujos: Flujo[] = [];
  let sinLeer = 0;
  const inicio = /stream\r?\n/g;
  for (let m = inicio.exec(texto); m !== null; m = inicio.exec(texto)) {
    // `endstream` también calza con /stream/: se descarta mirando lo que precede.
    if (texto.slice(Math.max(0, m.index - 3), m.index) === 'end') continue;
    const comienzo = m.index + m[0].length;
    const fin = texto.indexOf('endstream', comienzo);
    if (fin < 0) break;
    inicio.lastIndex = fin + 'endstream'.length;
    const diccionario = diccionarioAntesDe(texto, m.index);
    if (NO_ES_TEXTO.test(diccionario)) continue;
    const datos = decodificarFlujo(diccionario, crudoDeFlujo(bytes, comienzo, fin));
    if (datos === undefined || datos.length > MAX_FLUJO) {
      sinLeer += 1;
      continue;
    }
    flujos.push({ diccionario, datos });
  }
  return { flujos, sinLeer };
}

// --- Operadores de color -------------------------------------------------------

const ESPACIOS_DISPOSITIVO: Record<string, EspacioPdf> = {
  DeviceRGB: 'RGB',
  DeviceCMYK: 'CMYK',
  DeviceGray: 'Gris',
  RGB: 'RGB',
  CMYK: 'CMYK',
  G: 'Gris',
};

function hexDePdf(espacio: EspacioPdf, comp: number[]): string {
  const c = (i: number) => Math.max(0, Math.min(1, comp[i] ?? 0));
  if (espacio === 'RGB') return aHex({ r: c(0) * 255, g: c(1) * 255, b: c(2) * 255 });
  if (espacio === 'Gris') return aHex({ r: c(0) * 255, g: c(0) * 255, b: c(0) * 255 });
  return aHex(cmykARgb(c(0) * 100, c(1) * 100, c(2) * 100, c(3) * 100));
}

function rgbDePdf(espacio: EspacioPdf, comp: number[]): Rgb {
  const hex = hexDePdf(espacio, comp);
  return { r: parseInt(hex.slice(1, 3), 16), g: parseInt(hex.slice(3, 5), 16), b: parseInt(hex.slice(5, 7), 16) };
}

const DELIMITADOR = new Set(['(', ')', '<', '>', '[', ']', '{', '}', '/', '%']);
function esBlanco(c: string): boolean {
  return c === ' ' || c === '\n' || c === '\r' || c === '\t' || c === '\f' || c === '\0';
}

/**
 * Recorre los operadores de un flujo de contenido y anota cada color que se
 * fija. Salta las cadenas (con sus paréntesis anidados y escapes), las cadenas
 * hexadecimales, los comentarios y las imágenes en línea (`BI … ID … EI`),
 * porque ahí adentro puede haber cualquier cosa que parezca un operador.
 */
export function coloresDeContenido(contenido: string, cuenta: Map<string, ColorPdf>): void {
  const numeros: number[] = [];
  const espacioActual: { relleno: EspacioPdf | undefined; trazo: EspacioPdf | undefined } = { relleno: 'Gris', trazo: 'Gris' };
  let ultimoNombre: string | undefined;
  const anotar = (espacio: EspacioPdf, comp: number[]): void => {
    const redondeados = comp.map((n) => Math.round(n * 1000) / 1000);
    const clave = `${espacio}:${redondeados.join(',')}`;
    const previo = cuenta.get(clave);
    if (previo) previo.usos += 1;
    else cuenta.set(clave, { espacio, componentes: redondeados, hex: hexDePdf(espacio, redondeados), usos: 1 });
  };
  const n = contenido.length;
  let i = 0;
  while (i < n) {
    const c = contenido[i] ?? '';
    if (esBlanco(c)) {
      i += 1;
      continue;
    }
    if (c === '%') {
      while (i < n && contenido[i] !== '\n' && contenido[i] !== '\r') i += 1;
      continue;
    }
    if (c === '(') {
      let nivel = 1;
      i += 1;
      while (i < n && nivel > 0) {
        const d = contenido[i];
        if (d === '\\') i += 2;
        else {
          if (d === '(') nivel += 1;
          else if (d === ')') nivel -= 1;
          i += 1;
        }
      }
      numeros.length = 0;
      continue;
    }
    if (c === '<' && contenido[i + 1] !== '<') {
      const fin = contenido.indexOf('>', i);
      i = fin < 0 ? n : fin + 1;
      numeros.length = 0;
      continue;
    }
    if (c === '/') {
      let j = i + 1;
      while (j < n && !esBlanco(contenido[j] ?? '') && !DELIMITADOR.has(contenido[j] ?? '')) j += 1;
      ultimoNombre = contenido.slice(i + 1, j);
      numeros.length = 0;
      i = j;
      continue;
    }
    if (DELIMITADOR.has(c)) {
      i += 1;
      continue;
    }
    let j = i;
    while (j < n && !esBlanco(contenido[j] ?? '') && !DELIMITADOR.has(contenido[j] ?? '')) j += 1;
    const palabra = contenido.slice(i, j);
    i = j;
    const numero = Number(palabra);
    if (palabra !== '' && Number.isFinite(numero) && /^[-+]?(?:\d+\.?\d*|\.\d+)$/.test(palabra)) {
      numeros.push(numero);
      continue;
    }
    const ultimos = (k: number): number[] | undefined => (numeros.length >= k ? numeros.slice(numeros.length - k) : undefined);
    switch (palabra) {
      case 'rg':
      case 'RG': {
        const v = ultimos(3);
        if (v) anotar('RGB', v);
        const e: EspacioPdf = 'RGB';
        if (palabra === 'rg') espacioActual.relleno = e;
        else espacioActual.trazo = e;
        break;
      }
      case 'k':
      case 'K': {
        const v = ultimos(4);
        if (v) anotar('CMYK', v);
        if (palabra === 'k') espacioActual.relleno = 'CMYK';
        else espacioActual.trazo = 'CMYK';
        break;
      }
      case 'g':
      case 'G': {
        const v = ultimos(1);
        if (v) anotar('Gris', v);
        if (palabra === 'g') espacioActual.relleno = 'Gris';
        else espacioActual.trazo = 'Gris';
        break;
      }
      case 'cs':
      case 'CS': {
        const e = ultimoNombre !== undefined ? ESPACIOS_DISPOSITIVO[ultimoNombre] : undefined;
        if (palabra === 'cs') espacioActual.relleno = e;
        else espacioActual.trazo = e;
        break;
      }
      case 'sc':
      case 'scn':
      case 'SC':
      case 'SCN': {
        const e = palabra === 'sc' || palabra === 'scn' ? espacioActual.relleno : espacioActual.trazo;
        const k = e === 'RGB' ? 3 : e === 'CMYK' ? 4 : e === 'Gris' ? 1 : 0;
        const v = k > 0 ? ultimos(k) : undefined;
        if (e && v) anotar(e, v);
        break;
      }
      case 'BI': {
        // Imagen en línea: sus datos binarios van entre ID y EI.
        const id = contenido.indexOf('ID', i);
        const ei = id < 0 ? -1 : contenido.indexOf('EI', id + 2);
        i = ei < 0 ? n : ei + 2;
        break;
      }
      default:
        break;
    }
    numeros.length = 0;
  }
}

// --- Tintas planas, fuentes, páginas -----------------------------------------

/** `#20` y compañía, como los escribe un nombre PDF. */
function desescaparNombre(nombre: string): string {
  return nombre.replace(/#([0-9a-fA-F]{2})/g, (_, h: string) => String.fromCharCode(parseInt(h, 16)));
}

/** Dónde empieza y termina el objeto `n 0 obj … endobj`, si está a la vista en el archivo. */
function objeto(texto: string, numero: string): { desde: number; hasta: number } | undefined {
  const m = new RegExp(`(?:^|[\\s>])${numero}\\s+0\\s+obj\\b`).exec(texto);
  if (!m) return undefined;
  const fin = texto.indexOf('endobj', m.index);
  return { desde: m.index, hasta: fin < 0 ? texto.length : fin };
}

function numerosDe(lista: string): number[] {
  return lista
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map(Number)
    .filter((n) => Number.isFinite(n));
}

/**
 * Evalúa una función PostScript de tipo 4 (`{ dup 0.9 mul exch … }`) con la
 * tinta llena (entrada 1). Sólo entiende la aritmética y el manejo de pila que
 * usan las funciones de tinta; ante cualquier otro operador devuelve undefined.
 */
export function evaluarFuncionTipo4(programa: string, entrada: number): number[] | undefined {
  const pila: number[] = [entrada];
  const cuerpo = programa.replace(/^[^{]*\{/, '').replace(/\}[^}]*$/, '');
  const sacar = (): number => {
    const v = pila.pop();
    if (v === undefined) throw new Error('pila vacía');
    return v;
  };
  try {
    for (const palabra of cuerpo.split(/\s+/).filter(Boolean)) {
      const numero = Number(palabra);
      if (Number.isFinite(numero)) {
        pila.push(numero);
        continue;
      }
      switch (palabra) {
        case 'dup': {
          const v = sacar();
          pila.push(v, v);
          break;
        }
        case 'exch': {
          const b = sacar();
          const a = sacar();
          pila.push(b, a);
          break;
        }
        case 'pop':
          sacar();
          break;
        case 'mul':
          pila.push(sacar() * sacar());
          break;
        case 'add':
          pila.push(sacar() + sacar());
          break;
        case 'sub': {
          const b = sacar();
          pila.push(sacar() - b);
          break;
        }
        case 'div': {
          const b = sacar();
          pila.push(sacar() / b);
          break;
        }
        case 'neg':
          pila.push(-sacar());
          break;
        case 'index': {
          const n = sacar();
          const v = pila[pila.length - 1 - n];
          if (v === undefined) return undefined;
          pila.push(v);
          break;
        }
        default:
          return undefined;
      }
    }
  } catch {
    return undefined;
  }
  return pila.every((v) => Number.isFinite(v)) ? pila : undefined;
}

/**
 * El equivalente a tinta llena de una función de tinta, si se puede leer: de
 * `/C1` en una función de tipo 2, o evaluando una de tipo 4. Los otros tipos
 * (muestreada, cosida) quedan sin valor, y el candidato lo declara.
 */
function equivalenteDeFuncion(funcion: string, programa: string | undefined): number[] | undefined {
  const c1 = /\/C1\s*\[([^\]]*)\]/.exec(funcion)?.[1];
  if (/\/FunctionType\s*2\b/.test(funcion) || (c1 !== undefined && !/\/FunctionType/.test(funcion))) {
    return c1 !== undefined ? numerosDe(c1) : undefined;
  }
  if (/\/FunctionType\s*4\b/.test(funcion) && programa !== undefined) return evaluarFuncionTipo4(programa, 1);
  return undefined;
}

export function tintasPlanasDe(textos: readonly string[], todo: string, bytes?: Uint8Array): TintaPlanaPdf[] {
  const porNombre = new Map<string, TintaPlanaPdf>();
  const patron = /\/Separation\s*\/([^\s/[\]<>()]+)\s*\/(DeviceCMYK|DeviceRGB|DeviceGray)\b/g;
  for (const texto of textos) {
    for (const m of texto.matchAll(patron)) {
      const nombre = desescaparNombre(m[1] ?? '');
      if (!nombre || nombre === 'All' || nombre === 'None') continue;
      const alternativo = ESPACIOS_DISPOSITIVO[m[2] ?? ''];
      // La función de tinta viene a continuación, en línea o por referencia.
      const resto = texto.slice((m.index ?? 0) + m[0].length, (m.index ?? 0) + m[0].length + 600);
      const referencia = /^\s*(\d+)\s+0\s+R/.exec(resto)?.[1];
      let funcion = resto;
      let programa: string | undefined;
      if (referencia !== undefined) {
        const donde = objeto(todo, referencia);
        funcion = donde ? todo.slice(donde.desde, donde.hasta) : '';
        const flujo = /stream\r?\n/.exec(funcion);
        if (donde && flujo && bytes) {
          const comienzo = donde.desde + flujo.index + flujo[0].length;
          const fin = todo.indexOf('endstream', comienzo);
          const datos = fin < 0 ? undefined : decodificarFlujo(funcion.slice(0, flujo.index), crudoDeFlujo(bytes, comienzo, fin));
          if (datos) programa = new TextDecoder('latin1').decode(datos);
          funcion = funcion.slice(0, flujo.index);
        }
      } else if (/^\s*\{/.test(resto)) {
        // Una función de tipo 4 no puede ir en línea: un `{` acá no es función.
        funcion = '';
      }
      const componentes = equivalenteDeFuncion(funcion, programa);
      const esperados = alternativo === 'CMYK' ? 4 : alternativo === 'RGB' ? 3 : 1;
      const validos = alternativo !== undefined && componentes !== undefined && componentes.length === esperados;
      const previa = porNombre.get(nombre);
      if (previa && previa.hex !== undefined) continue;
      const redondeados = validos ? componentes.map((n) => Math.round(n * 1000) / 1000) : undefined;
      porNombre.set(nombre, {
        nombre,
        alternativo,
        componentes: redondeados,
        hex: redondeados && alternativo ? hexDePdf(alternativo, redondeados) : undefined,
      });
    }
  }
  return [...porNombre.values()];
}

/**
 * La familia de un nombre PostScript: sin el prefijo de subconjunto y sin el
 * estilo (`Anton-Regular` → `Anton`, `ABCDEF+Montserrat-Bold` → `Montserrat`).
 * Un nombre PostScript no lleva espacios (`HelveticaNeue`), así que puede no
 * calzar letra por letra con el nombre de la familia: eso lo resuelve el
 * selector tipográfico, y el candidato lo dice.
 */
export function familiaDeFuente(nombrePostScript: string): string {
  const sinPrefijo = nombrePostScript.replace(/^[A-Z]{6}\+/, '');
  return sinPrefijo.split(/[-,]/)[0] || sinPrefijo;
}

export function fuentesDe(textos: readonly string[]): string[] {
  const nombres = new Set<string>();
  for (const texto of textos) {
    for (const m of texto.matchAll(/\/BaseFont\s*\/([^\s/[\]<>()]+)/g)) {
      const nombre = desescaparNombre(m[1] ?? '').replace(/^[A-Z]{6}\+/, '');
      if (nombre) nombres.add(nombre);
    }
  }
  return [...nombres];
}

function caja(diccionario: string, nombre: 'TrimBox' | 'MediaBox'): MedidaPdf | undefined {
  const lista = new RegExp(`/${nombre}\\s*\\[([^\\]]*)\\]`).exec(diccionario)?.[1];
  if (lista === undefined) return undefined;
  const v = numerosDe(lista);
  if (v.length !== 4) return undefined;
  const [x0 = 0, y0 = 0, x1 = 0, y1 = 0] = v;
  const mm = (pt: number) => Math.round(Math.abs(pt) * PT_A_MM * 10) / 10;
  return { ancho: mm(x1 - x0), alto: mm(y1 - y0), caja: nombre };
}

/**
 * Las páginas: cuántos diccionarios `/Type /Page` hay, y las cajas de la
 * primera. Si la primera página hereda su MediaBox del árbol de páginas, se
 * toma la primera MediaBox del archivo.
 */
function paginasDe(textos: readonly string[]): { paginas: number; medida: MedidaPdf | undefined; soporte?: MedidaPdf } {
  let paginas = 0;
  let primera: string | undefined;
  for (const texto of textos) {
    for (const m of texto.matchAll(/\/Type\s*\/Page(?![a-zA-Z])/g)) {
      paginas += 1;
      if (primera === undefined) {
        // El diccionario de la página rodea a `/Type /Page`: se mira alrededor.
        const desde = texto.lastIndexOf('<<', m.index ?? 0);
        primera = texto.slice(Math.max(0, desde), (m.index ?? 0) + 1500);
      }
    }
  }
  const todas = textos.join('\n');
  const soporte = (primera !== undefined ? caja(primera, 'MediaBox') : undefined) ?? caja(todas, 'MediaBox');
  const corte = primera !== undefined ? caja(primera, 'TrimBox') : undefined;
  if (corte && soporte && (corte.ancho !== soporte.ancho || corte.alto !== soporte.alto)) {
    return { paginas, medida: corte, soporte };
  }
  return { paginas, medida: corte ?? soporte };
}

// --- Lectura completa -----------------------------------------------------------

export function leerPdf(bytes: Uint8Array): LecturaPdf {
  const todo = comoLatin1(bytes);
  const cabecera = todo.indexOf('%PDF-');
  if (cabecera < 0 || cabecera > 1024) throw new Error('el archivo no empieza como un PDF');
  const cifrado = /\/Encrypt\s*(?:\d+\s+0\s+R|<<)/.test(todo);
  if (cifrado) {
    return { cifrado, paginas: 0, medida: undefined, soporte: undefined, colores: [], tintasPlanas: [], familias: [], fuentes: [], flujosSinLeer: 0 };
  }
  const { flujos, sinLeer } = flujosDe(bytes, todo);
  const textosDeFlujos = flujos.map((f) => comoLatin1(f.datos));
  // Los diccionarios pueden estar a la vista o dentro de flujos de objetos (PDF 1.5+).
  const textos = [todo, ...flujos.filter((f) => /\/Type\s*\/ObjStm\b/.test(f.diccionario)).map((f) => comoLatin1(f.datos))];

  const cuenta = new Map<string, ColorPdf>();
  flujos.forEach((f, i) => {
    if (/\/Type\s*\/(?:ObjStm|Metadata)\b|\/Subtype\s*\/XML\b/.test(f.diccionario)) return;
    coloresDeContenido(textosDeFlujos[i] ?? '', cuenta);
  });
  const colores = [...cuenta.values()].sort((a, b) => b.usos - a.usos);

  const fuentes = fuentesDe(textos);
  const familias = [...new Set(fuentes.map(familiaDeFuente))];
  const { paginas, medida, soporte } = paginasDe(textos);
  return {
    cifrado,
    paginas,
    medida,
    soporte,
    colores,
    tintasPlanas: tintasPlanasDe(textos, todo, bytes),
    familias,
    fuentes,
    flujosSinLeer: sinLeer,
  };
}

// --- Resumen y candidatos --------------------------------------------------------

function textoMedida(m: MedidaPdf): string {
  const n = (v: number) => String(v).replace('.', ',');
  return `${n(m.ancho)} × ${n(m.alto)} mm`;
}

function textoComponentes(espacio: EspacioPdf, comp: readonly number[]): string {
  const pct = (v: number) => `${Math.round(v * 100)}`;
  if (espacio === 'CMYK') return `C${pct(comp[0] ?? 0)} M${pct(comp[1] ?? 0)} Y${pct(comp[2] ?? 0)} K${pct(comp[3] ?? 0)}`;
  if (espacio === 'RGB') return `R${Math.round((comp[0] ?? 0) * 255)} G${Math.round((comp[1] ?? 0) * 255)} B${Math.round((comp[2] ?? 0) * 255)}`;
  return `gris ${pct(comp[0] ?? 0)} %`;
}

export function resumenDePdf(lectura: LecturaPdf): string {
  if (lectura.cifrado) return 'PDF cifrado: no se puede leer su contenido. Queda registrado como referente.';
  const partes: string[] = [];
  if (lectura.paginas > 0) {
    const medida = lectura.medida ? `: ${textoMedida(lectura.medida)}${lectura.medida.caja === 'TrimBox' ? ' al corte' : ''}` : '';
    const soporte = lectura.soporte ? ` (${textoMedida(lectura.soporte)} con sangrado)` : '';
    partes.push(`${lectura.paginas} ${lectura.paginas === 1 ? 'página' : 'páginas'}${medida}${soporte}`);
  }
  partes.push(`${lectura.colores.length} ${lectura.colores.length === 1 ? 'color pintado' : 'colores pintados'}`);
  if (lectura.tintasPlanas.length) partes.push(`${lectura.tintasPlanas.length} ${lectura.tintasPlanas.length === 1 ? 'tinta plana' : 'tintas planas'}`);
  partes.push(`${lectura.familias.length} ${lectura.familias.length === 1 ? 'familia' : 'familias'}`);
  let texto = `${partes.join(', ')}.`;
  if (lectura.paginas > 1) texto += ' La miniatura es de la primera página; los colores y las fuentes, de todas.';
  if (lectura.flujosSinLeer > 0) texto += ` ${lectura.flujosSinLeer === 1 ? 'Un flujo no se pudo leer' : `${lectura.flujosSinLeer} flujos no se pudieron leer`}.`;
  return texto;
}

export function candidatosDePdf(lectura: LecturaPdf, idBase: string): Candidato[] {
  const salida: Candidato[] = [];
  const planas = lectura.tintasPlanas.filter((t): t is TintaPlanaPdf & { hex: string } => t.hex !== undefined);
  const sinValor = lectura.tintasPlanas.filter((t) => t.hex === undefined);
  const propuestos = lectura.colores.slice(0, MAX_COLORES);
  if (propuestos.length || planas.length) {
    const institucionales: Array<{ name: string; value: string }> = [];
    const neutros: Array<{ name: string; value: string }> = [];
    for (const t of planas) institucionales.push({ name: t.nombre, value: t.hex });
    for (const c of propuestos) {
      const entrada = { name: `${c.espacio} ${textoComponentes(c.espacio, c.componentes)}`, value: c.hex };
      (esNeutro(rgbDePdf(c.espacio, c.componentes)) ? neutros : institucionales).push(entrada);
    }
    const cmyk = propuestos.filter((c) => c.espacio === 'CMYK').length + planas.filter((t) => t.alternativo === 'CMYK').length;
    const detalle: string[] = [];
    if (planas.length) {
      const nombres = planas.map((t) => t.nombre).join(', ');
      detalle.push(
        planas.length === 1
          ? `una tinta plana con su nombre (${nombres}), mostrada por el equivalente que declara el PDF`
          : `${planas.length} tintas planas con su nombre (${nombres}), mostradas por el equivalente que declara el PDF`,
      );
    }
    if (propuestos.length) detalle.push(`los ${propuestos.length} colores más usados del documento, con su espacio original`);
    let texto = `${detalle.join('; ')}.`;
    if (lectura.colores.length > propuestos.length) texto += ` Quedan ${lectura.colores.length - propuestos.length} colores menos usados sin proponer.`;
    if (cmyk) texto += ' Los CMYK se muestran convertidos a hex de forma aproximada: el valor de imprenta es el CMYK, que va en el nombre.';
    salida.push({
      id: `${idBase}-colores`,
      requirementId: 'dim1.req01',
      etiqueta: 'Colores del documento',
      detalle: texto,
      muestra: { tipo: 'color', colores: [...planas.map((t) => t.hex), ...propuestos.map((c) => c.hex)].slice(0, 8) },
      fragmento: { institucionales, neutros },
      estado: 'pendiente',
      ...(sinValor.length
        ? { faltante: `Tintas planas sin equivalente legible en el PDF: ${sinValor.map((t) => t.nombre).join(', ')}. Su valor hay que tomarlo de la guía de la tinta.` }
        : {}),
    });
  }
  if (lectura.familias.length) {
    salida.push({
      id: `${idBase}-familias`,
      requirementId: 'dim2.req01',
      etiqueta: 'Familias usadas en el documento',
      detalle: `${lectura.familias.join(', ')}. Leídas de los nombres de las fuentes del documento: ${lectura.fuentes.join(', ')}.`,
      muestra: { tipo: 'familia', familia: lectura.familias[0] ?? '', generica: 'sans-serif' },
      fragmento: { familias: lectura.familias.map((name) => ({ name, stack: [name] })) },
      estado: 'pendiente',
      faltante:
        'El nombre sale del nombre PostScript de la fuente, que no lleva espacios (HelveticaNeue): puede no calzar con el de la familia. El PDF tampoco dice la licencia; el selector busca la familia o su equivalencia.',
    });
  }
  return salida;
}
