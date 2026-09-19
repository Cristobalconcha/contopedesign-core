/**
 * Decodificar una imagen en el navegador: bytes → píxeles y miniatura. Es
 * la parte del extractor de imágenes que necesita un lienzo, y por eso vive
 * fuera del dominio.
 */
import type { ImagenDecodificada } from '../dominio/extractores/index.js';

const LADO_ANALISIS = 160;
/**
 * Lado máximo de la miniatura que se manda a la IA del taller como imagen
 * adjunta (`promptDeEncargo`, `dominio/encargo.ts`): 240px es legible para una
 * persona pero deja poco detalle para que un modelo lea colores o
 * proporciones finas, así que se sube a 768px (el lado que aceptan sin
 * volver a escalar los proveedores medidos).
 */
const LADO_MINIATURA = 768;

export async function decodificarImagen(bytes: Uint8Array, extension: string): Promise<ImagenDecodificada> {
  const tipo = extension === 'svg' ? 'image/svg+xml' : `image/${extension === 'jpg' ? 'jpeg' : extension}`;
  const mapa = await createImageBitmap(new Blob([bytes as BlobPart], { type: tipo }));
  const escala = Math.min(1, LADO_ANALISIS / Math.max(mapa.width, mapa.height));
  const w = Math.max(1, Math.round(mapa.width * escala));
  const h = Math.max(1, Math.round(mapa.height * escala));

  const lienzo = document.createElement('canvas');
  lienzo.width = w;
  lienzo.height = h;
  const ctx = lienzo.getContext('2d');
  if (!ctx) throw new Error('No hay contexto de dibujo');
  ctx.drawImage(mapa, 0, 0, w, h);
  const pixeles = ctx.getImageData(0, 0, w, h).data;

  const escalaMini = Math.min(1, LADO_MINIATURA / Math.max(mapa.width, mapa.height));
  const mini = document.createElement('canvas');
  mini.width = Math.max(1, Math.round(mapa.width * escalaMini));
  mini.height = Math.max(1, Math.round(mapa.height * escalaMini));
  mini.getContext('2d')?.drawImage(mapa, 0, 0, mini.width, mini.height);
  const miniatura = mini.toDataURL('image/jpeg', 0.85);
  mapa.close();

  return { ancho: mapa.width, alto: mapa.height, pixeles, miniatura };
}
