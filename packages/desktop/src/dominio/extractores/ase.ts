/**
 * Lee un Adobe Swatch Exchange (`.ase`): la paleta que exportan Illustrator,
 * InDesign y Photoshop. Es binario y chico:
 *
 *   'ASEF' · versión (2 × uint16) · cantidad de bloques (uint32)
 *   bloque: tipo (uint16) · largo (uint32) · datos
 *     0xC001 abre grupo (nombre) · 0xC002 cierra grupo
 *     0x0001 color: nombre (uint16 + UTF-16BE con nulo) · modelo (4 bytes:
 *            'CMYK', 'RGB ', 'LAB ', 'Gray') · componentes (float32 BE) ·
 *            tipo (uint16: 0 global, 1 plana, 2 normal)
 *     0x0002 tinte (lo escribe Illustrator): float32 del tinte y después un
 *            color con la forma de 0x0001
 *
 * Todo en big-endian. De ahí salen
 *
 * - los colores base → dim1.req01, con su modelo y sus valores en el nombre
 *   (el CMYK se muestra aproximado y se dice, como en el IDML y el PDF);
 * - la rampa de cada color que trae tintes → dim1.req04, en la escala de
 *   pesos que fijó Cristóbal el 27-09 con la paleta de Econut: el tinte por
 *   400 (25 % → 100, 50 % → 200, 75 % → 300) y la tinta llena es 500. El
 *   valor de cada paso es el color aclarado hacia el papel, aproximado.
 *
 * La rampa apunta a su color por la posición en la paleta de este mismo
 * insumo. Si dim1.req01 ya venía de otro insumo, la posición puede no ser la
 * misma; el predicado compara los nombres y la deja sin resolver en vez de
 * aceptar una rampa colgada del color equivocado.
 *
 * Un color Lab no se convierte: se nombra como faltante.
 */
import type { Candidato } from '../sistema.js';
import { aHex, cmykARgb, esNeutro, type Rgb } from './color.js';

export type ModeloAse = 'CMYK' | 'RGB' | 'LAB' | 'Gris';

export interface ColorAse {
  nombre: string;
  modelo: ModeloAse;
  /** Componentes tal como vienen: CMYK/RGB/Gris en 0..1; Lab con L en 0..1 y a, b en su escala. */
  valores: number[];
  tipo: 'global' | 'plana' | 'normal';
  /** El grupo en que viene, si viene en uno. */
  grupo: string | undefined;
  /** El tinte (0..1) cuando es una variante aclarada de otro color; undefined en un color base. */
  tinte: number | undefined;
  /** Hex para mirar; undefined en Lab. */
  hex: string | undefined;
}

export interface LecturaAse {
  version: string;
  colores: ColorAse[];
  grupos: string[];
}

const MODELOS: Record<string, { modelo: ModeloAse; componentes: number }> = {
  CMYK: { modelo: 'CMYK', componentes: 4 },
  'RGB ': { modelo: 'RGB', componentes: 3 },
  'LAB ': { modelo: 'LAB', componentes: 3 },
  Gray: { modelo: 'Gris', componentes: 1 },
};

const TIPOS = ['global', 'plana', 'normal'] as const;

function rgbDe(modelo: ModeloAse, v: readonly number[]): Rgb | undefined {
  const c = (i: number) => Math.max(0, Math.min(1, v[i] ?? 0));
  if (modelo === 'RGB') return { r: c(0) * 255, g: c(1) * 255, b: c(2) * 255 };
  if (modelo === 'Gris') return { r: c(0) * 255, g: c(0) * 255, b: c(0) * 255 };
  if (modelo === 'CMYK') return cmykARgb(c(0) * 100, c(1) * 100, c(2) * 100, c(3) * 100);
  return undefined;
}

/** Lee el color que empieza en `desde` dentro de `datos`; devuelve undefined si no calza. */
function colorEn(datos: DataView, desde: number, grupo: string | undefined, tinte: number | undefined): ColorAse | undefined {
  let i = desde;
  const largoNombre = datos.getUint16(i);
  i += 2;
  let nombre = '';
  for (let k = 0; k < largoNombre; k += 1) {
    const u = datos.getUint16(i + k * 2);
    if (u !== 0) nombre += String.fromCharCode(u);
  }
  i += largoNombre * 2;
  const clave = String.fromCharCode(datos.getUint8(i), datos.getUint8(i + 1), datos.getUint8(i + 2), datos.getUint8(i + 3));
  i += 4;
  const modelo = MODELOS[clave];
  if (!modelo) return undefined;
  const valores: number[] = [];
  for (let k = 0; k < modelo.componentes; k += 1) valores.push(Math.round(datos.getFloat32(i + k * 4) * 10000) / 10000);
  i += modelo.componentes * 4;
  const tipo = TIPOS[datos.getUint16(i)] ?? 'normal';
  const rgb = rgbDe(modelo.modelo, valores);
  return { nombre, modelo: modelo.modelo, valores, tipo, grupo, tinte, hex: rgb ? aHex(rgb) : undefined };
}

export function leerAse(bytes: Uint8Array): LecturaAse {
  const datos = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (bytes.byteLength < 12 || String.fromCharCode(...bytes.subarray(0, 4)) !== 'ASEF') {
    throw new Error('el archivo no empieza como un .ase (falta la firma ASEF)');
  }
  const version = `${datos.getUint16(4)}.${datos.getUint16(6)}`;
  const colores: ColorAse[] = [];
  const grupos: string[] = [];
  let grupo: string | undefined;
  let i = 12;
  while (i + 6 <= bytes.byteLength) {
    const tipo = datos.getUint16(i);
    const largo = datos.getUint32(i + 2);
    const inicio = i + 6;
    if (inicio + largo > bytes.byteLength) break;
    try {
      if (tipo === 0xc001) {
        const largoNombre = datos.getUint16(inicio);
        let nombre = '';
        for (let k = 0; k < largoNombre; k += 1) {
          const u = datos.getUint16(inicio + 2 + k * 2);
          if (u !== 0) nombre += String.fromCharCode(u);
        }
        grupo = nombre;
        grupos.push(nombre);
      } else if (tipo === 0xc002) {
        grupo = undefined;
      } else if (tipo === 0x0001) {
        const c = colorEn(datos, inicio, grupo, undefined);
        if (c) colores.push(c);
      } else if (tipo === 0x0002) {
        const tinte = Math.round(datos.getFloat32(inicio) * 1000) / 1000;
        const c = colorEn(datos, inicio + 4, grupo, tinte);
        if (c) colores.push(c);
      }
    } catch {
      // Un bloque mal formado no tumba la paleta: se salta.
    }
    i = inicio + largo;
  }
  return { version, colores, grupos };
}

function textoValores(c: ColorAse): string {
  const pct = (v: number) => Math.round(v * 100);
  const [a = 0, b = 0, d = 0, e = 0] = c.valores;
  if (c.modelo === 'CMYK') return `C${pct(a)} M${pct(b)} Y${pct(d)} K${pct(e)}`;
  if (c.modelo === 'RGB') return `R${Math.round(a * 255)} G${Math.round(b * 255)} B${Math.round(d * 255)}`;
  if (c.modelo === 'Gris') return `gris ${pct(a)} %`;
  return `L${Math.round(a * 100)} a${Math.round(b)} b${Math.round(d)}`;
}

export function resumenDeAse(lectura: LecturaAse): string {
  const base = lectura.colores.filter((c) => c.tinte === undefined);
  const tintes = lectura.colores.length - base.length;
  const planas = base.filter((c) => c.tipo === 'plana').length;
  const partes = [`${base.length} ${base.length === 1 ? 'color' : 'colores'}`];
  if (planas) partes.push(`${planas} ${planas === 1 ? 'tinta plana' : 'tintas planas'}`);
  if (tintes) partes.push(`${tintes} ${tintes === 1 ? 'tinte' : 'tintes'}`);
  if (lectura.grupos.length) partes.push(`${lectura.grupos.length} ${lectura.grupos.length === 1 ? 'grupo' : 'grupos'}`);
  return `Paleta de Adobe (ASE ${lectura.version}): ${partes.join(', ')}.`;
}

export function candidatosDeAse(lectura: LecturaAse, idBase: string): Candidato[] {
  const base = lectura.colores.filter((c) => c.tinte === undefined);
  const conHex = base.filter((c): c is ColorAse & { hex: string } => c.hex !== undefined);
  const lab = base.filter((c) => c.hex === undefined);
  if (!conHex.length) {
    return lab.length
      ? [
          {
            id: `${idBase}-colores`,
            requirementId: 'dim1.req01',
            etiqueta: 'Colores de la paleta',
            detalle: `${lab.length} colores en Lab: ${lab.map((c) => `${c.nombre} (${textoValores(c)})`).join(', ')}.`,
            muestra: { tipo: 'nada' },
            fragmento: {},
            estado: 'pendiente',
            faltante: 'Los colores Lab no se convierten a un valor de pantalla: hay que definirlos a mano.',
          },
        ]
      : [];
  }
  const institucionales: Array<{ name: string; value: string }> = [];
  const neutros: Array<{ name: string; value: string }> = [];
  for (const c of conHex) {
    const rgb = rgbDe(c.modelo, c.valores);
    const entrada = { name: `${c.nombre} · ${c.modelo} ${textoValores(c)}`, value: c.hex };
    (rgb && esNeutro(rgb) ? neutros : institucionales).push(entrada);
  }
  const detalle: string[] = [
    `${conHex.length} ${conHex.length === 1 ? 'color' : 'colores'} de la paleta, con su modelo y sus valores tal como los exportó el programa de Adobe`,
  ];
  const planas = conHex.filter((c) => c.tipo === 'plana');
  if (planas.length) detalle.push(`${planas.length === 1 ? 'uno es tinta plana' : `${planas.length} son tintas planas`}: ${planas.map((c) => c.nombre).join(', ')}`);
  const tintes = lectura.colores.filter((c) => c.tinte !== undefined);
  if (tintes.length) detalle.push('los tintes se proponen aparte, como rampa de pesos');
  let texto = `${detalle.join('; ')}.`;
  if (conHex.some((c) => c.modelo === 'CMYK')) texto += ' Los CMYK se muestran convertidos a hex de forma aproximada: el valor de imprenta es el CMYK, que va en el nombre.';
  const salida: Candidato[] = [
    {
      id: `${idBase}-colores`,
      requirementId: 'dim1.req01',
      etiqueta: 'Colores de la paleta',
      detalle: texto,
      muestra: { tipo: 'color', colores: conHex.map((c) => c.hex).slice(0, 8) },
      fragmento: { institucionales, neutros },
      estado: 'pendiente',
      ...(lab.length ? { faltante: `Colores en Lab sin convertir: ${lab.map((c) => c.nombre).join(', ')}.` } : {}),
    },
  ];
  const rampas = rampasDe(lectura, conHex, institucionales, neutros);
  if (rampas.length) {
    salida.push({
      id: `${idBase}-rampas`,
      requirementId: 'dim1.req04',
      etiqueta: 'Rampas de la paleta',
      detalle:
        `${rampas.map((r) => `${r.name}: ${r.scale.map((p) => p.step).join(', ')}`).join('; ')}. ` +
        'Escala de pesos: el tinte por 400 (25 % → 100, 50 % → 200, 75 % → 300) y la tinta llena es 500. ' +
        'Cada paso es el color aclarado hacia el papel, de forma aproximada: en imprenta manda el tinte de la tinta.',
      muestra: { tipo: 'color', colores: rampas.flatMap((r) => r.scale.map((p) => p.value)).slice(0, 8) },
      fragmento: { ramps: rampas },
      estado: 'pendiente',
      faltante:
        'Cada rampa apunta a su color por la posición en la paleta de este insumo: si los colores base vienen de otro insumo, revísalas en el editor.',
    });
  }
  return salida;
}

/** Un paso de rampa: el tinte por 400; la tinta llena es 500 (Cristóbal, 27-09-2026). */
export function pesoDeTinte(tinte: number): number {
  return tinte >= 1 ? 500 : Math.max(1, Math.round(tinte * 400));
}

/** El color aclarado hacia el papel: en RGB y gris se mezcla con blanco; en CMYK se escalan las tintas. */
function hexDeTinte(c: ColorAse, tinte: number): string | undefined {
  if (c.modelo === 'CMYK') {
    const [a = 0, b = 0, d = 0, e = 0] = c.valores.map((v) => v * tinte);
    return aHex(cmykARgb(a * 100, b * 100, d * 100, e * 100));
  }
  const rgb = rgbDe(c.modelo, c.valores);
  if (!rgb) return undefined;
  const mezcla = (v: number) => 255 - tinte * (255 - v);
  return aHex({ r: mezcla(rgb.r), g: mezcla(rgb.g), b: mezcla(rgb.b) });
}

function rampasDe(
  lectura: LecturaAse,
  base: ReadonlyArray<ColorAse & { hex: string }>,
  institucionales: ReadonlyArray<{ name: string }>,
  neutros: ReadonlyArray<{ name: string }>,
): Array<{ family: { refReqId: string; refPath: [string, number] }; name: string; scale: Array<{ step: number; value: string }> }> {
  const salida = [];
  for (const c of base) {
    const tintes = lectura.colores.filter((t) => t.tinte !== undefined && t.nombre === c.nombre && t.tinte > 0 && t.tinte < 1);
    if (!tintes.length) continue;
    const nombreEnPaleta = `${c.nombre} · ${c.modelo} ${textoValores(c)}`;
    const i = institucionales.findIndex((e) => e.name === nombreEnPaleta);
    const j = neutros.findIndex((e) => e.name === nombreEnPaleta);
    const refPath: [string, number] | undefined = i >= 0 ? ['institucionales', i] : j >= 0 ? ['neutros', j] : undefined;
    if (!refPath) continue;
    const pasos = new Map<number, string>();
    for (const t of tintes) {
      const valor = hexDeTinte(c, t.tinte ?? 0);
      if (valor) pasos.set(pesoDeTinte(t.tinte ?? 0), valor);
    }
    pasos.set(500, c.hex);
    salida.push({
      family: { refReqId: 'dim1.req01', refPath },
      name: nombreEnPaleta,
      scale: [...pasos].sort(([a], [b]) => a - b).map(([step, value]) => ({ step, value })),
    });
  }
  return salida;
}
