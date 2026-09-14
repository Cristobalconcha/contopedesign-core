/**
 * De un archivo a un insumo con candidatos. Decide el extractor por la
 * extensión y, cuando no hay extractor, registra el archivo igual como
 * referente, diciendo que de ahí no se lee nada todavía. Registrar sin
 * leer es honesto; leer a medias y callar, no.
 */
import { nuevoId, type Insumo, type TipoInsumo } from '../sistema.js';
import { candidatosDeCss, leerCss } from './css.js';
import { candidatosDeIdml, leerIdml } from './idml.js';
import { candidatosDeImagen, paletaDePixeles } from './imagen.js';
import { candidatosDeTokens, leerTokens } from './tokens-w3c.js';

export interface ArchivoEntrante {
  nombre: string;
  extension: string;
  bytes: Uint8Array;
}

export interface ImagenDecodificada {
  ancho: number;
  alto: number;
  pixeles: Uint8ClampedArray;
  miniatura: string;
}

export interface OpcionesExtraccion {
  /** Lo pone el navegador: decodificar bytes de imagen a píxeles y miniatura. */
  decodificarImagen?: (bytes: Uint8Array, extension: string) => Promise<ImagenDecodificada>;
  ahora?: string;
}

const EXT_IMAGEN = new Set(['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp', 'avif']);

export function tipoDeArchivo(extension: string, bytes?: Uint8Array): TipoInsumo {
  const e = extension.toLowerCase();
  if (e === 'css' || e === 'scss') return 'css';
  if (e === 'idml') return 'idml';
  if (e === 'pdf') return 'pdf';
  if (EXT_IMAGEN.has(e)) return 'imagen';
  if (e === 'json') {
    if (bytes && /"\$value"|"\$type"/.test(new TextDecoder().decode(bytes.slice(0, 200_000)))) return 'tokens-w3c';
    return 'otro';
  }
  if (['txt', 'md', 'html', 'htm'].includes(e)) return 'texto';
  return 'otro';
}

export async function extraer(archivo: ArchivoEntrante, opciones: OpcionesExtraccion = {}): Promise<Insumo> {
  const id = nuevoId('insumo');
  const tipo = tipoDeArchivo(archivo.extension, archivo.bytes);
  const base: Omit<Insumo, 'resumen' | 'candidatos'> = {
    id,
    nombre: archivo.nombre,
    extension: archivo.extension.toLowerCase(),
    tipo,
    tamanoBytes: archivo.bytes.byteLength,
    incorporadoEn: opciones.ahora ?? new Date().toISOString(),
  };

  try {
    switch (tipo) {
      case 'css': {
        const lectura = leerCss(new TextDecoder().decode(archivo.bytes));
        return {
          ...base,
          resumen: `${lectura.colores.length} colores, ${lectura.familias.length} familias, ${lectura.longitudes.length} longitudes distintas.`,
          candidatos: candidatosDeCss(lectura, id),
        };
      }
      case 'tokens-w3c': {
        const lectura = leerTokens(JSON.parse(new TextDecoder().decode(archivo.bytes)));
        return {
          ...base,
          resumen: `${lectura.total} tokens: ${lectura.colores.length} de color, ${lectura.familias.length} de familia, ${lectura.longitudes.length} de dimensión.`,
          candidatos: candidatosDeTokens(lectura, id),
        };
      }
      case 'idml': {
        const lectura = leerIdml(archivo.bytes);
        return {
          ...base,
          resumen: `${lectura.colores.length} muestras de color, ${lectura.familias.length} familias, ${lectura.estilos.length} estilos de párrafo.`,
          candidatos: candidatosDeIdml(lectura, id),
        };
      }
      case 'imagen': {
        if (!opciones.decodificarImagen) {
          return { ...base, resumen: 'Imagen registrada como referente; no hay decodificador en este entorno.', candidatos: [] };
        }
        const img = await opciones.decodificarImagen(archivo.bytes, base.extension);
        const paleta = paletaDePixeles(img.pixeles);
        return {
          ...base,
          miniatura: img.miniatura,
          resumen: `${img.ancho}×${img.alto} px. Paleta dominante de ${paleta.length} colores.`,
          candidatos: candidatosDeImagen(paleta, id, archivo.nombre),
        };
      }
      case 'pdf':
        return {
          ...base,
          resumen: 'PDF registrado como referente. Leer sus tipografías y colores todavía no está construido.',
          candidatos: [],
        };
      case 'texto':
      case 'otro':
        return { ...base, resumen: 'Registrado como referente; de este tipo de archivo no se extrae nada todavía.', candidatos: [] };
    }
  } catch (error) {
    return {
      ...base,
      resumen: `No se pudo leer: ${(error as Error).message}. Queda registrado como referente.`,
      candidatos: [],
    };
  }
}
