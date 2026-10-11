/**
 * Escritor de Adobe Swatch Exchange (`.ase`), la paleta que abren
 * Illustrator, InDesign y Photoshop. Binario, big-endian:
 *
 *   'ASEF' · versión 1.0 (2 × uint16) · cantidad de bloques (uint32)
 *   bloque: tipo (uint16) · largo de los datos (uint32) · datos
 *     0xC001 abre grupo: nombre (uint16 con el largo en unidades UTF-16,
 *            nulo incluido · UTF-16BE terminado en nulo)
 *     0xC002 cierra grupo (sin datos)
 *     0x0001 color: nombre (igual que el grupo) · modelo (4 bytes: 'RGB ',
 *            'CMYK') · componentes en float32 0..1 · tipo (uint16: 0 global,
 *            1 plana, 2 normal)
 *
 * El lector equivalente está en el escritorio
 * (`packages/desktop/src/dominio/extractores/ase.ts`); la prueba de este
 * módulo trae su propio lector mínimo para no acoplar los paquetes.
 */

export interface MuestraAse {
  nombre: string;
  modelo: 'RGB' | 'CMYK';
  /** RGB o CMYK en 0..1. */
  valores: readonly number[];
  tipo: 'global' | 'plana' | 'normal';
}

export interface GrupoAse {
  nombre: string;
  muestras: readonly MuestraAse[];
}

const CLAVE_MODELO = { RGB: 'RGB ', CMYK: 'CMYK' } as const;
const CODIGO_TIPO = { global: 0, plana: 1, normal: 2 } as const;

class Escritor {
  private bytes: number[] = [];
  u8(v: number): void {
    this.bytes.push(v & 0xff);
  }
  u16(v: number): void {
    this.u8(v >> 8);
    this.u8(v);
  }
  u32(v: number): void {
    this.u16(v >>> 16);
    this.u16(v & 0xffff);
  }
  f32(v: number): void {
    const b = new DataView(new ArrayBuffer(4));
    b.setFloat32(0, v);
    for (let i = 0; i < 4; i++) this.u8(b.getUint8(i));
  }
  ascii(s: string): void {
    for (const c of s) this.u8(c.charCodeAt(0));
  }
  /** Largo (uint16, en unidades UTF-16 contando el nulo) + UTF-16BE + nulo. */
  nombre(s: string): void {
    this.u16(s.length + 1);
    for (let i = 0; i < s.length; i++) this.u16(s.charCodeAt(i));
    this.u16(0);
  }
  agregar(otro: Escritor): void {
    for (const b of otro.bytes) this.bytes.push(b);
  }
  get largo(): number {
    return this.bytes.length;
  }
  final(): Uint8Array {
    return Uint8Array.from(this.bytes);
  }
}

function bloque(salida: Escritor, tipo: number, datos: Escritor): void {
  salida.u16(tipo);
  salida.u32(datos.largo);
  salida.agregar(datos);
}

/** Escribe los grupos como `.ase` 1.0. Un nombre vacío se escribe tal cual (Adobe lo acepta). */
export function escribirAse(grupos: readonly GrupoAse[]): Uint8Array {
  const cuerpo = new Escritor();
  let cantidad = 0;
  for (const g of grupos) {
    const nombre = new Escritor();
    nombre.nombre(g.nombre);
    bloque(cuerpo, 0xc001, nombre);
    cantidad++;
    for (const m of g.muestras) {
      const datos = new Escritor();
      datos.nombre(m.nombre);
      datos.ascii(CLAVE_MODELO[m.modelo]);
      for (const v of m.valores) datos.f32(Math.min(1, Math.max(0, v)));
      datos.u16(CODIGO_TIPO[m.tipo]);
      bloque(cuerpo, 0x0001, datos);
      cantidad++;
    }
    bloque(cuerpo, 0xc002, new Escritor());
    cantidad++;
  }
  const salida = new Escritor();
  salida.ascii('ASEF');
  salida.u16(1);
  salida.u16(0);
  salida.u32(cantidad);
  salida.agregar(cuerpo);
  return salida.final();
}
