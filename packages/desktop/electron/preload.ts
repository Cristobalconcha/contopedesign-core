/**
 * El puente entre la ventana y el proceso principal. Expone en `window.contope`
 * sólo las operaciones que el renderizador necesita, con la misma forma que
 * declara `src/puente/tipos.ts`. Nada de Node llega al renderizador.
 */
import { contextBridge, ipcRenderer } from 'electron';

const puente = {
  abrirSistema: () => ipcRenderer.invoke('dialogo:abrir-sistema'),
  leerSistema: (ruta: string) => ipcRenderer.invoke('archivo:leer-sistema', ruta),
  guardarSistema: (sugerido: string, texto: string, rutaActual: string | null, vistazo: unknown) =>
    ipcRenderer.invoke('dialogo:guardar-sistema', sugerido, texto, rutaActual, vistazo),
  guardarSistemaComo: (sugerido: string, texto: string, vistazo: unknown) =>
    ipcRenderer.invoke('dialogo:guardar-como', sugerido, texto, vistazo),
  registrarReciente: (ruta: string, nombre: string, vistazo: unknown) =>
    ipcRenderer.invoke('recientes:registrar', ruta, nombre, vistazo),
  abrirInsumos: () => ipcRenderer.invoke('dialogo:abrir-insumos'),
  abrirPropuestas: () => ipcRenderer.invoke('dialogo:abrir-propuestas'),
  exportarCapsula: (archivos: Array<{ nombre: string; texto: string }>) =>
    ipcRenderer.invoke('dialogo:exportar-capsula', archivos),
  listarRecientes: () => ipcRenderer.invoke('recientes:listar'),
  descargarCatalogo: () => ipcRenderer.invoke('catalogo:descargar'),
};

contextBridge.exposeInMainWorld('contope', puente);
