/**
 * pdf.js no publica tipos para su worker. Sólo se importa para dejarlo en
 * `globalThis.pdfjsWorker` (ver `pdf.ts`), así que basta declarar el módulo.
 */
declare module 'pdfjs-dist/legacy/build/pdf.worker.mjs' {
  export const WorkerMessageHandler: unknown;
}
