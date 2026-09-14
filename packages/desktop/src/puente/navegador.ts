/**
 * El puente cuando la interfaz corre en un navegador común, sin Electron.
 * Sirve para revisarla y para usarla en un apuro: abrir con el selector de
 * archivos del navegador, guardar como descarga, y recientes en
 * localStorage (guardando el texto entero, porque un navegador no puede
 * volver a leer una ruta del disco).
 */
import type { ArchivoDeInsumo, ArchivoDeSistema, Puente, Reciente, Vistazo } from './tipos.js';

const CLAVE_RECIENTES = 'contope.recientes';
const MAX_RECIENTES = 6;

function elegirArchivos(opciones: { multiple: boolean; aceptar?: string }): Promise<File[]> {
  return new Promise((resolver) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = opciones.multiple;
    if (opciones.aceptar !== undefined) input.accept = opciones.aceptar;
    input.style.display = 'none';
    document.body.appendChild(input);
    const terminar = (archivos: File[]): void => {
      input.remove();
      resolver(archivos);
    };
    input.addEventListener('change', () => terminar([...(input.files ?? [])]));
    input.addEventListener('cancel', () => terminar([]));
    input.click();
  });
}

function descargar(nombre: string, texto: string): void {
  const url = URL.createObjectURL(new Blob([texto], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

interface RecienteGuardado extends Reciente {
  texto: string;
}

function leerRecientes(): RecienteGuardado[] {
  try {
    const crudo = localStorage.getItem(CLAVE_RECIENTES);
    const lista: unknown = crudo === null ? [] : JSON.parse(crudo);
    return Array.isArray(lista) ? (lista as RecienteGuardado[]) : [];
  } catch {
    return [];
  }
}

function recordar(nombre: string, texto: string, vistazo?: Vistazo): void {
  try {
    const previo = leerRecientes().find((r) => r.nombre === nombre);
    const lista = leerRecientes().filter((r) => r.nombre !== nombre);
    const v = vistazo ?? previo?.vistazo;
    lista.unshift({
      ruta: `navegador:${nombre}`,
      nombre,
      abiertoEn: new Date().toISOString(),
      texto,
      ...(v !== undefined ? { vistazo: v } : {}),
    });
    localStorage.setItem(CLAVE_RECIENTES, JSON.stringify(lista.slice(0, MAX_RECIENTES)));
  } catch {
    // Sin almacenamiento no hay recientes; no es un error del trabajo.
  }
}

export function puenteNavegador(): Puente {
  return {
    entorno: 'navegador',
    async abrirSistema(): Promise<ArchivoDeSistema | null> {
      const [archivo] = await elegirArchivos({ multiple: false, aceptar: '.json' });
      if (!archivo) return null;
      const texto = await archivo.text();
      recordar(archivo.name, texto);
      return { ruta: null, nombre: archivo.name, texto };
    },
    async abrirReciente(reciente: Reciente): Promise<ArchivoDeSistema | null> {
      const guardado = leerRecientes().find((r) => r.ruta === reciente.ruta);
      return guardado ? { ruta: null, nombre: guardado.nombre, texto: guardado.texto } : null;
    },
    async guardarSistema(sugerido, texto, _ruta, vistazo) {
      descargar(sugerido, texto);
      recordar(sugerido, texto, vistazo);
      return { ruta: null, nombre: sugerido };
    },
    async guardarSistemaComo(sugerido, texto, vistazo) {
      descargar(sugerido, texto);
      recordar(sugerido, texto, vistazo);
      return { ruta: null, nombre: sugerido };
    },
    async registrarReciente(_ruta, nombre, vistazo) {
      const guardado = leerRecientes().find((r) => r.nombre === nombre);
      if (guardado) recordar(nombre, guardado.texto, vistazo);
    },
    async abrirInsumos(): Promise<ArchivoDeInsumo[]> {
      const archivos = await elegirArchivos({ multiple: true });
      return Promise.all(
        archivos.map(async (a) => ({
          nombre: a.name,
          extension: a.name.split('.').pop()?.toLowerCase() ?? '',
          bytes: new Uint8Array(await a.arrayBuffer()),
        })),
      );
    },
    async exportarCapsula(archivos) {
      for (const a of archivos) descargar(a.nombre, a.texto);
      return 'descargas del navegador';
    },
    async listarRecientes(): Promise<Reciente[]> {
      return leerRecientes().map(({ ruta, nombre, abiertoEn, vistazo }) => ({
        ruta,
        nombre,
        abiertoEn,
        ...(vistazo !== undefined ? { vistazo } : {}),
      }));
    },
    async descargarCatalogo(): Promise<string> {
      // Google Fonts no manda cabeceras CORS: desde un navegador no se puede
      // bajar. En Electron lo hace el proceso principal.
      throw new Error('Actualizar el catálogo sólo funciona en la aplicación de escritorio.');
    },
  };
}
