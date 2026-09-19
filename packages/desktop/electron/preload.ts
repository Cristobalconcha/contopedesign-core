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
  ia: {
    estado: () => ipcRenderer.invoke('ia:estado'),
    guardarProveedor: (proveedor: unknown, secreto: string | null) => ipcRenderer.invoke('ia:guardar-proveedor', proveedor, secreto),
    quitarProveedor: (id: string) => ipcRenderer.invoke('ia:quitar-proveedor', id),
    activar: (id: string | null) => ipcRenderer.invoke('ia:activar', id),
    iniciarSesionCodex: () => ipcRenderer.invoke('ia:codex-iniciar-sesion'),
    cerrarSesionCodex: () => ipcRenderer.invoke('ia:codex-cerrar-sesion'),
    pedir: (proveedorId: string, mensajes: unknown) => ipcRenderer.invoke('ia:pedir', proveedorId, mensajes),
  },
};

contextBridge.exposeInMainWorld('contope', puente);
