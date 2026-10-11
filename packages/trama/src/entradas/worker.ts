/**
 * Entrada de `dist/contope-trama-worker.js`: un worker AUTÓNOMO. Es un
 * archivo propio que trae el motor adentro; se crea con
 * `new Worker('…/contope-trama-worker.js')`. No se arma con el texto de una
 * función ni con una URL `blob:` (que una política de seguridad estricta
 * prohíbe). El protocolo está en `worker/atendedor.ts`.
 */
import { crearAtendedor, type MensajeDelWorker } from '../worker/atendedor.js';

/** Lo mínimo del ámbito de un worker que se usa (el paquete no carga los tipos del DOM). */
interface AmbitoDeWorker {
  postMessage(m: MensajeDelWorker, transferir?: ArrayBuffer[]): void;
  onmessage: ((e: { data: unknown }) => void) | null;
}
declare const self: AmbitoDeWorker;
declare function setTimeout(fn: () => void, ms: number): unknown;

const atender = crearAtendedor(
  (m, transferir) => self.postMessage(m, transferir ?? []),
  (fn) => { setTimeout(fn, 0); },
);
self.onmessage = (e) => atender(e.data);
