import type { ArchivoDeInsumo, Puente, PuenteElectron } from './tipos.js';

function deBase64(texto: string): Uint8Array {
  const binario = atob(texto);
  const bytes = new Uint8Array(binario.length);
  for (let i = 0; i < binario.length; i++) bytes[i] = binario.charCodeAt(i);
  return bytes;
}

/** Por tramos: `String.fromCharCode(...bytes)` revienta la pila con archivos grandes. */
function aBase64(bytes: Uint8Array): string {
  let binario = '';
  for (let i = 0; i < bytes.length; i += 0x8000) binario += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binario);
}

export function puenteElectron(nativo: PuenteElectron): Puente {
  return {
    entorno: 'electron',
    abrirSistema: () => nativo.abrirSistema(),
    abrirReciente: (r) => nativo.leerSistema(r.ruta),
    guardarSistema: (s, t, ruta, vistazo) => nativo.guardarSistema(s, t, ruta, vistazo),
    guardarSistemaComo: (s, t, vistazo) => nativo.guardarSistemaComo(s, t, vistazo),
    registrarReciente: async (ruta, nombre, vistazo) => {
      if (ruta !== null) await nativo.registrarReciente(ruta, nombre, vistazo);
    },
    abrirInsumos: async (): Promise<ArchivoDeInsumo[]> =>
      (await nativo.abrirInsumos()).map((a) => ({
        ruta: a.ruta,
        nombre: a.nombre,
        extension: a.extension,
        bytes: deBase64(a.bytes),
      })),
    abrirPropuestas: () => nativo.abrirPropuestas(),
    guardarArchivo: (archivo) => nativo.guardarArchivo(archivo.nombre, aBase64(archivo.bytes)),
    listarRecientes: () => nativo.listarRecientes(),
    descargarCatalogo: () => nativo.descargarCatalogo(),
    ia: nativo.ia,
  };
}
