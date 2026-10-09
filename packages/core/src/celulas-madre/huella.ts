/**
 * La huella de una definición: SHA-256 de su JSON canónico.
 *
 * El núcleo no toca el disco ni depende de Node ni del navegador (`lib` es
 * ES2023, sin DOM), así que ni `node:crypto` ni `crypto.subtle` están a la
 * mano; además `crypto.subtle` es asíncrono y los generadores son síncronos.
 * Por eso el SHA-256 está escrito acá, entero (FIPS 180-4), y se prueba
 * contra los vectores conocidos.
 *
 * JSON canónico: claves de objeto ordenadas, sin espacios, `undefined` fuera
 * (igual que `JSON.stringify`). Dos payloads iguales dan la misma huella
 * aunque sus claves vengan en otro orden.
 */

/** Texto → bytes UTF-8 (sin `TextEncoder`, que no está en `lib` ES2023). */
export function utf8(texto: string): Uint8Array {
  const salida: number[] = [];
  for (const caracter of texto) {
    const c = caracter.codePointAt(0) ?? 0;
    if (c < 0x80) salida.push(c);
    else if (c < 0x800) salida.push(0xc0 | (c >> 6), 0x80 | (c & 0x3f));
    else if (c < 0x10000) salida.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 0x3f), 0x80 | (c & 0x3f));
    else salida.push(0xf0 | (c >> 18), 0x80 | ((c >> 12) & 0x3f), 0x80 | ((c >> 6) & 0x3f), 0x80 | (c & 0x3f));
  }
  return Uint8Array.from(salida);
}

const K = Uint32Array.from([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01,
  0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc,
  0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147,
  0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070, 0x19a4c116, 0x1e376c08,
  0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
  0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

const rotr = (x: number, n: number): number => (x >>> n) | (x << (32 - n));

/** SHA-256 de unos bytes, en hexadecimal minúsculo. */
export function sha256(bytes: Uint8Array): string {
  const largoBits = bytes.length * 8;
  const total = Math.ceil((bytes.length + 9) / 64) * 64;
  const m = new Uint8Array(total);
  m.set(bytes);
  m[bytes.length] = 0x80;
  const vista = new DataView(m.buffer);
  // Largo en bits como entero de 64 bits big-endian (los archivos de acá no pasan de 2^53).
  vista.setUint32(total - 8, Math.floor(largoBits / 0x100000000));
  vista.setUint32(total - 4, largoBits >>> 0);

  const h = Uint32Array.from([0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19]);
  const w = new Uint32Array(64);
  for (let bloque = 0; bloque < total; bloque += 64) {
    for (let t = 0; t < 16; t++) w[t] = vista.getUint32(bloque + t * 4);
    for (let t = 16; t < 64; t++) {
      const a = w[t - 15] ?? 0;
      const b = w[t - 2] ?? 0;
      const s0 = rotr(a, 7) ^ rotr(a, 18) ^ (a >>> 3);
      const s1 = rotr(b, 17) ^ rotr(b, 19) ^ (b >>> 10);
      w[t] = ((w[t - 16] ?? 0) + s0 + (w[t - 7] ?? 0) + s1) >>> 0;
    }
    let [a, b, c, d, e, f, g, hh] = [h[0] ?? 0, h[1] ?? 0, h[2] ?? 0, h[3] ?? 0, h[4] ?? 0, h[5] ?? 0, h[6] ?? 0, h[7] ?? 0];
    for (let t = 0; t < 64; t++) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const t1 = (hh + S1 + ch + (K[t] ?? 0) + (w[t] ?? 0)) >>> 0;
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const t2 = (S0 + maj) >>> 0;
      hh = g;
      g = f;
      f = e;
      e = (d + t1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (t1 + t2) >>> 0;
    }
    const nuevos = [a, b, c, d, e, f, g, hh];
    for (let i = 0; i < 8; i++) h[i] = ((h[i] ?? 0) + (nuevos[i] ?? 0)) >>> 0;
  }
  return [...h].map((x) => x.toString(16).padStart(8, '0')).join('');
}

/**
 * JSON canónico: claves ordenadas, sin espacios. Lo que `JSON.stringify`
 * omite (`undefined`, funciones) también se omite acá; un número no finito
 * se escribe `null`, como lo haría `JSON.stringify`.
 */
export function jsonCanonico(valor: unknown): string {
  if (valor === null || typeof valor !== 'object') {
    const plano = JSON.stringify(valor);
    return plano === undefined ? 'null' : plano;
  }
  if (Array.isArray(valor)) {
    return `[${valor.map((v) => (v === undefined || typeof v === 'function' ? 'null' : jsonCanonico(v))).join(',')}]`;
  }
  const registro = valor as Record<string, unknown>;
  const partes: string[] = [];
  for (const clave of Object.keys(registro).sort()) {
    const v = registro[clave];
    if (v === undefined || typeof v === 'function') continue;
    partes.push(`${JSON.stringify(clave)}:${jsonCanonico(v)}`);
  }
  return `{${partes.join(',')}}`;
}

/** La huella de un payload: `sha256:` + el SHA-256 de su JSON canónico. */
export function huella(payload: unknown): string {
  return `sha256:${sha256(utf8(jsonCanonico(payload)))}`;
}

/** La huella de un archivo ya escrito (bytes, o texto que se guarda en UTF-8). */
export function huellaDeContenido(contenido: Uint8Array | string): string {
  return `sha256:${sha256(typeof contenido === 'string' ? utf8(contenido) : contenido)}`;
}
