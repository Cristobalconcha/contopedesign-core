/**
 * Lo que el renderizador necesita del mundo exterior: abrir y guardar el
 * sistema, traer insumos, escribir la cápsula, recordar recientes y bajar
 * el catálogo. Dos implementaciones: Electron (por IPC al proceso
 * principal) y navegador (para revisar la interfaz sin ventana nativa).
 */
export interface ArchivoDeSistema {
  ruta: string | null;
  nombre: string;
  texto: string;
}

export interface ArchivoDeInsumo {
  ruta?: string;
  nombre: string;
  extension: string;
  bytes: Uint8Array;
}

/**
 * Lo que la portada muestra de un sistema sin abrirlo: su mundo, sus
 * colores, su familia y cuánto lleva resuelto. Se registra al guardar y al
 * abrir, para que la tira de inicio no tenga que leer archivos.
 */
export interface Vistazo {
  mundo: string;
  nombre: string;
  colores: string[];
  familia?: string;
  resueltos: number;
  total: number;
}

export interface Reciente {
  ruta: string;
  nombre: string;
  abiertoEn: string;
  vistazo?: Vistazo;
}

export interface Puente {
  /** Dónde corre: decide qué controles tienen sentido. */
  entorno: 'electron' | 'navegador';
  abrirSistema(): Promise<ArchivoDeSistema | null>;
  abrirReciente(reciente: Reciente): Promise<ArchivoDeSistema | null>;
  guardarSistema(
    sugerido: string,
    texto: string,
    rutaActual: string | null,
    vistazo: Vistazo,
  ): Promise<{ ruta: string | null; nombre: string } | null>;
  guardarSistemaComo(sugerido: string, texto: string, vistazo: Vistazo): Promise<{ ruta: string | null; nombre: string } | null>;
  registrarReciente(ruta: string | null, nombre: string, vistazo: Vistazo): Promise<void>;
  abrirInsumos(): Promise<ArchivoDeInsumo[]>;
  /** Un archivo `*.propuestas.json` hecho por la IA para este sistema; no entra a recientes. */
  abrirPropuestas(): Promise<ArchivoDeSistema | null>;
  exportarCapsula(archivos: Array<{ nombre: string; texto: string }>): Promise<string | null>;
  listarRecientes(): Promise<Reciente[]>;
  descargarCatalogo(): Promise<string>;
}

/** La forma exacta que expone el preload de Electron en `window.contope`. */
export interface PuenteElectron {
  abrirSistema(): Promise<{ ruta: string; nombre: string; texto: string } | null>;
  leerSistema(ruta: string): Promise<{ ruta: string; nombre: string; texto: string }>;
  guardarSistema(sugerido: string, texto: string, rutaActual: string | null, vistazo: Vistazo): Promise<{ ruta: string; nombre: string } | null>;
  guardarSistemaComo(sugerido: string, texto: string, vistazo: Vistazo): Promise<{ ruta: string; nombre: string } | null>;
  registrarReciente(ruta: string, nombre: string, vistazo: Vistazo): Promise<void>;
  abrirInsumos(): Promise<Array<{ ruta: string; nombre: string; extension: string; bytes: string }>>;
  abrirPropuestas(): Promise<{ ruta: string; nombre: string; texto: string } | null>;
  exportarCapsula(archivos: Array<{ nombre: string; texto: string }>): Promise<string | null>;
  listarRecientes(): Promise<Reciente[]>;
  descargarCatalogo(): Promise<string>;
}

declare global {
  interface Window {
    contope?: PuenteElectron;
  }
}
