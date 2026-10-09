/**
 * Base64 y UTF-8 escritos a mano: el paquete es puro (sin `atob`, sin
 * `TextEncoder`, sin `Buffer`), así corre igual en un worker, en Node y en
 * la página. Decodifica los dos alfabetos (estándar y URL) con o sin relleno.
 */

const ALFABETO = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const ALFABETO_URL = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
const VALOR: Record<string, number> = {};
for (let i = 0; i < 64; i++) { VALOR[ALFABETO[i]!] = i; VALOR[ALFABETO_URL[i]!] = i; }

export function utf8ABytes(texto: string): Uint8Array {
  const salida: number[] = [];
  for (const caracter of texto) {
    const c = caracter.codePointAt(0)!;
    if (c < 0x80) salida.push(c);
    else if (c < 0x800) salida.push(0xc0 | (c >> 6), 0x80 | (c & 63));
    else if (c < 0x10000) salida.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
    else salida.push(0xf0 | (c >> 18), 0x80 | ((c >> 12) & 63), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
  }
  return Uint8Array.from(salida);
}

/** UTF-8 → texto. Lanza ante una secuencia inválida. */
export function bytesAUtf8(b: Uint8Array): string {
  let s = '';
  for (let i = 0; i < b.length;) {
    const c = b[i]!;
    let cp: number, n: number;
    if (c < 0x80) { cp = c; n = 0; }
    else if (c >= 0xc2 && c < 0xe0) { cp = c & 31; n = 1; }
    else if (c >= 0xe0 && c < 0xf0) { cp = c & 15; n = 2; }
    else if (c >= 0xf0 && c < 0xf5) { cp = c & 7; n = 3; }
    else throw new Error('UTF-8 inválido');
    for (let j = 1; j <= n; j++) {
      const d = b[i + j];
      if (d === undefined || (d & 0xc0) !== 0x80) throw new Error('UTF-8 inválido');
      cp = (cp << 6) | (d & 63);
    }
    i += n + 1;
    s += String.fromCodePoint(cp);
  }
  return s;
}

export function bytesABase64(b: Uint8Array, url = false): string {
  const A = url ? ALFABETO_URL : ALFABETO;
  let s = '';
  for (let i = 0; i < b.length; i += 3) {
    const n = (b[i]! << 16) | ((b[i + 1] ?? 0) << 8) | (b[i + 2] ?? 0);
    s += A[(n >> 18) & 63]! + A[(n >> 12) & 63]!;
    s += i + 1 < b.length ? A[(n >> 6) & 63]! : url ? '' : '=';
    s += i + 2 < b.length ? A[n & 63]! : url ? '' : '=';
  }
  return s;
}

/** Base64 (estándar o URL, con o sin relleno) → bytes. Lanza ante un carácter inválido. */
export function base64ABytes(s: string): Uint8Array {
  const limpio = s.replace(/=+$/, '');
  if (limpio.length % 4 === 1) throw new Error('base64 inválido');
  const salida: number[] = [];
  let acumulado = 0, bits = 0;
  for (const ch of limpio) {
    const v = VALOR[ch];
    if (v === undefined) throw new Error('base64 inválido');
    acumulado = ((acumulado << 6) | v) & 0xffffff;
    bits += 6;
    if (bits >= 8) { bits -= 8; salida.push((acumulado >> bits) & 255); }
  }
  return Uint8Array.from(salida);
}
