/**
 * Dibujar la primera página de un PDF en el navegador: bytes → píxeles y
 * miniatura, con la misma forma que `decodificarImagen`. Es la parte del
 * extractor de PDF que necesita un lienzo; lo que se mide (colores, tintas
 * planas, fuentes, medida) se lee sin dibujar, en `dominio/extractores/pdf.ts`.
 *
 * Se usa pdf.js (Mozilla, Apache-2.0) en su compilación «legacy», que trae los
 * polyfills de las funciones de JavaScript más nuevas que usa. Se carga sólo
 * cuando entra el primer PDF, y corre en el hilo principal (sin worker): para
 * una página basta, y así no hay un archivo de worker que resolver por ruta
 * dentro de Electron.
 */
import type { ImagenDecodificada } from '../dominio/extractores/index.js';

const LADO_ANALISIS = 160;
/** El mismo lado que la miniatura de una imagen (ver `navegador/imagen.ts`). */
const LADO_MINIATURA = 768;

type PdfJs = typeof import('pdfjs-dist/legacy/build/pdf.mjs');

let cargando: Promise<PdfJs> | undefined;

function cargarPdfJs(): Promise<PdfJs> {
  cargando ??= (async () => {
    const trabajador = await import('pdfjs-dist/legacy/build/pdf.worker.mjs');
    // pdf.js busca este global para correr sin worker («fake worker»).
    (globalThis as { pdfjsWorker?: unknown }).pdfjsWorker = trabajador;
    return import('pdfjs-dist/legacy/build/pdf.mjs');
  })();
  return cargando;
}

export async function rasterizarPdf(bytes: Uint8Array): Promise<ImagenDecodificada> {
  const pdfjs = await cargarPdfJs();
  // pdf.js se queda con el búfer que recibe: se le pasa una copia.
  const tarea = pdfjs.getDocument({ data: bytes.slice() });
  const documento = await tarea.promise;
  try {
    const pagina = await documento.getPage(1);
    const base = pagina.getViewport({ scale: 1 });
    const escala = LADO_MINIATURA / Math.max(base.width, base.height);
    const vista = pagina.getViewport({ scale: escala });

    const lienzo = document.createElement('canvas');
    lienzo.width = Math.max(1, Math.round(vista.width));
    lienzo.height = Math.max(1, Math.round(vista.height));
    await pagina.render({ canvas: lienzo, viewport: vista, background: '#ffffff' }).promise;
    const miniatura = lienzo.toDataURL('image/jpeg', 0.85);

    const escalaAnalisis = Math.min(1, LADO_ANALISIS / Math.max(lienzo.width, lienzo.height));
    const chico = document.createElement('canvas');
    chico.width = Math.max(1, Math.round(lienzo.width * escalaAnalisis));
    chico.height = Math.max(1, Math.round(lienzo.height * escalaAnalisis));
    const ctx = chico.getContext('2d');
    if (!ctx) throw new Error('No hay contexto de dibujo');
    ctx.drawImage(lienzo, 0, 0, chico.width, chico.height);
    const pixeles = ctx.getImageData(0, 0, chico.width, chico.height).data;

    return { ancho: Math.round(base.width), alto: Math.round(base.height), pixeles, miniatura };
  } finally {
    await tarea.destroy();
  }
}
