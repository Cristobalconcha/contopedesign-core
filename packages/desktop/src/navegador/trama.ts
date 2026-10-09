/**
 * Dibujar una trama en un lienzo 2D, guardarla como PNG y grabarla como
 * video. Es la parte de la pantalla de la trama que necesita el navegador.
 *
 * El motor no se toca ni se copia: los puntos salen de `cuadroEn` y el
 * dibujo usa lo compartido de `@contope/trama` (tonos por profundidad,
 * niveles de alfa, tramos de línea, tinta). Es el `drawSheet` de v7: fondo
 * sólido, luego líneas y puntos sumando luz (`lighter`) o tinta
 * (`multiply`), con los puntos agrupados en 48 trazados (tono × alfa).
 */
import {
  alfaDeNivel,
  conLineas,
  conPuntos,
  cuadroEn,
  dimensionesDeLamina,
  grupoDePunto,
  instanteDeCuadro,
  cuadrosDeSecuencia,
  modoDeTinta,
  OPACIDAD_MINIMA_PUNTOS,
  recorrerPuntos,
  tonosPorProfundidad,
  tramosDeLinea,
  trazosDeTramo,
  type Entorno,
  type EstadoDeTrama,
  type Trama,
} from '@contope/trama';

/** Dibuja un cuadro ya calculado. `escala` multiplica las coordenadas (pantallas densas). */
export function dibujarCuadro(ctx: CanvasRenderingContext2D, cuadro: Float32Array, estado: EstadoDeTrama, ancho: number, alto: number, calidad: number): void {
  const cfg = estado.motor.configuracion;
  const cols = tonosPorProfundidad(estado.colores.lejos, estado.colores.cerca);
  ctx.save();
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = estado.colores.fondo;
  ctx.fillRect(0, 0, ancho, alto);
  ctx.globalCompositeOperation = modoDeTinta(estado.tinta, estado.colores.fondo) === 'tinta' ? 'multiply' : 'lighter';
  if (conLineas(estado.modo)) {
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    const puntos = dimensionesDeLamina(cfg, calidad).puntos;
    for (const tramo of tramosDeLinea(cuadro, puntos, cfg)) {
      ctx.strokeStyle = `rgba(${cols[tramo.tono]!.join(',')},${Math.min(1, tramo.alfa)})`;
      ctx.lineWidth = tramo.grosor;
      ctx.beginPath();
      for (const trazo of trazosDeTramo(cuadro, tramo)) {
        trazo.forEach((q, i) => (i === 0 ? ctx.moveTo(cuadro[q]!, cuadro[q + 1]!) : ctx.lineTo(cuadro[q]!, cuadro[q + 1]!)));
      }
      ctx.stroke();
    }
  }
  if (conPuntos(estado.modo) && cfg.opacidadPunto > OPACIDAD_MINIMA_PUNTOS) {
    const trazados = Array.from({ length: 48 }, () => new Path2D());
    recorrerPuntos(cuadro, cfg.opacidadPunto, (k, tono, nivel) => {
      const p = trazados[grupoDePunto(tono, nivel)]!;
      const x = cuadro[k]!, y = cuadro[k + 1]!, r = cuadro[k + 2]!;
      if (r < 0.9) p.rect(x - r, y - r, r * 2, r * 2);
      else {
        p.moveTo(x + r, y);
        p.arc(x, y, r, 0, Math.PI * 2);
      }
    });
    trazados.forEach((p, g) => {
      ctx.fillStyle = `rgba(${cols[Math.floor(g / 4)]!.join(',')},${alfaDeNivel(g % 4)})`;
      ctx.fill(p);
    });
  }
  ctx.restore();
}

/** Calcula y dibuja la trama en el instante t, en un lienzo de `ancho` × `alto` px CSS con `densidad` píxeles por px. */
export function dibujarTrama(
  lienzo: HTMLCanvasElement,
  trama: Trama,
  t: number,
  opciones: { ancho: number; alto: number; densidad?: number; calidad?: number; entorno?: Entorno },
): EstadoDeTrama {
  const densidad = opciones.densidad ?? 1;
  const calidad = opciones.calidad ?? 1;
  const w = Math.max(1, Math.round(opciones.ancho * densidad));
  const h = Math.max(1, Math.round(opciones.alto * densidad));
  if (lienzo.width !== w) lienzo.width = w;
  if (lienzo.height !== h) lienzo.height = h;
  const ctx = lienzo.getContext('2d');
  if (!ctx) throw new Error('Este navegador no tiene dibujo en 2D.');
  // El motor calcula en px del lienzo real: así el grosor de los puntos es el mismo a cualquier densidad.
  const { cuadro, estado } = cuadroEn(trama, t, w, h, calidad, opciones.entorno ?? {});
  dibujarCuadro(ctx, cuadro, estado, w, h, calidad);
  return estado;
}

/** Un PNG del instante t, con el motor a calidad completa. */
export async function pngDeTrama(trama: Trama, t: number, ancho: number, alto: number): Promise<Uint8Array> {
  const lienzo = document.createElement('canvas');
  dibujarTrama(lienzo, trama, t, { ancho, alto, calidad: 1 });
  const blob = await new Promise<Blob | null>((resolver) => lienzo.toBlob(resolver, 'image/png'));
  if (!blob) throw new Error('No se pudo armar el PNG.');
  return new Uint8Array(await blob.arrayBuffer());
}

/** El tipo de video que este navegador sabe grabar, o null. */
export function formatoDeVideo(): string | null {
  if (typeof MediaRecorder === 'undefined' || typeof HTMLCanvasElement.prototype.captureStream !== 'function') return null;
  for (const tipo of ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm']) if (MediaRecorder.isTypeSupported(tipo)) return tipo;
  return null;
}

export interface GrabacionDeVideo {
  /** Se resuelve con el video, o con null si se canceló. */
  terminado: Promise<Uint8Array | null>;
  cancelar(): void;
}

/**
 * Graba un video `.webm` de la trama: una vuelta de la secuencia (o
 * `segundosEnVivo` de una trama en vivo). Se graba en tiempo real: cada
 * cuadro dibuja el instante que marca el reloj, así el video dura lo que
 * dura la trama aunque el computador no alcance todos los cuadros (si no
 * alcanza, el movimiento sale menos fluido, no más lento). El video es un
 * formato cerrado: no sigue al cursor.
 */
export function grabarVideo(
  trama: Trama,
  opciones: { ancho: number; alto: number; fps?: number; segundosEnVivo?: number; alAvanzar?: (fraccion: number) => void },
): GrabacionDeVideo {
  const tipo = formatoDeVideo();
  if (!tipo) throw new Error('Este navegador no puede grabar video.');
  const fps = opciones.fps ?? 30;
  const cuadros = cuadrosDeSecuencia(trama, fps);
  const duracion = cuadros === null ? (opciones.segundosEnVivo ?? 10) : cuadros / fps;
  const lienzo = document.createElement('canvas');
  dibujarTrama(lienzo, trama, 0, { ancho: opciones.ancho, alto: opciones.alto });
  const flujo = lienzo.captureStream(fps);
  const grabador = new MediaRecorder(flujo, { mimeType: tipo, videoBitsPerSecond: 12_000_000 });
  const partes: Blob[] = [];
  let cancelado = false;
  let pedido = 0;
  grabador.ondataavailable = (ev) => {
    if (ev.data.size > 0) partes.push(ev.data);
  };
  const terminado = new Promise<Uint8Array | null>((resolver, rechazar) => {
    grabador.onstop = () => {
      flujo.getTracks().forEach((pista) => pista.stop());
      if (cancelado) return resolver(null);
      new Blob(partes, { type: 'video/webm' }).arrayBuffer().then((b) => resolver(new Uint8Array(b)), rechazar);
    };
    grabador.onerror = () => rechazar(new Error('Falló la grabación del video.'));
  });
  grabador.start(250);
  const inicio = performance.now();
  const paso = (): void => {
    if (cancelado) return;
    const s = (performance.now() - inicio) / 1000;
    if (s >= duracion) {
      opciones.alAvanzar?.(1);
      grabador.stop();
      return;
    }
    const k = Math.floor(s * fps);
    dibujarTrama(lienzo, trama, instanteDeCuadro(trama, k, fps), { ancho: opciones.ancho, alto: opciones.alto });
    opciones.alAvanzar?.(s / duracion);
    pedido = requestAnimationFrame(paso);
  };
  pedido = requestAnimationFrame(paso);
  return {
    terminado,
    cancelar() {
      cancelado = true;
      cancelAnimationFrame(pedido);
      if (grabador.state !== 'inactive') grabador.stop();
    },
  };
}
