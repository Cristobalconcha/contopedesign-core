import { puenteElectron } from './electron.js';
import { puenteNavegador } from './navegador.js';
import type { Puente } from './tipos.js';

export type { ArchivoDeInsumo, ArchivoDeSistema, Puente, Reciente, Vistazo } from './tipos.js';

export function obtenerPuente(): Puente {
  return window.contope !== undefined ? puenteElectron(window.contope) : puenteNavegador();
}
