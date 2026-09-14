#!/usr/bin/env node
/**
 * Descarga los metadatos públicos de Google Fonts y los compacta al catálogo
 * que usa el selector de tipografías.
 *
 * Fuente:  https://fonts.google.com/metadata/fonts  (público, sin clave)
 * Salida:  datos/catalogo-google-fonts.json
 *
 * Por qué se guarda una copia en el repositorio: el programa tiene que abrir
 * sin red, y el selector no puede quedar vacío porque no hubo conexión. La
 * copia lleva la fecha en que se descargó; «actualizar» desde el programa
 * reemplaza la copia local del usuario, nunca la del repositorio.
 *
 * Uso:
 *   node scripts/actualizar-catalogo-tipografico.mjs            (descarga)
 *   node scripts/actualizar-catalogo-tipografico.mjs <archivo>  (desde una copia ya descargada)
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ORIGEN = 'https://fonts.google.com/metadata/fonts';
const aqui = dirname(fileURLToPath(import.meta.url));
const destino = resolve(aqui, '../datos/catalogo-google-fonts.json');

async function leerCrudo(argumento) {
  if (argumento !== undefined) return readFileSync(argumento, 'utf8');
  const respuesta = await fetch(ORIGEN);
  if (!respuesta.ok) throw new Error(`Google Fonts respondió ${respuesta.status}`);
  return await respuesta.text();
}

/**
 * Compacta una familia a lo que el selector usa. Los nombres de campo son
 * cortos a propósito: el catálogo viaja dentro del programa.
 *
 *   f  family            c  category           s  stroke ('' si no declara)
 *   k  classifications   w  pesos disponibles  i  1 si tiene itálica
 *   v  ejes variables    wd [min,max] del eje wdth, o null
 *   l  subsets           p  popularity         t  trending
 *   d  dateAdded         o  1 si es de código abierto
 */
export function compactar(familia) {
  const claves = Object.keys(familia.fonts ?? {});
  const pesos = [...new Set(claves.map((k) => Number.parseInt(k, 10)).filter((n) => Number.isFinite(n)))].sort(
    (a, b) => a - b,
  );
  const ejes = (familia.axes ?? []).map((a) => a.tag);
  const ancho = (familia.axes ?? []).find((a) => a.tag === 'wdth');
  return {
    f: familia.family,
    c: familia.category ?? '',
    s: familia.stroke ?? '',
    k: familia.classifications ?? [],
    w: pesos,
    i: claves.some((k) => k.endsWith('i')) ? 1 : 0,
    v: ejes,
    wd: ancho ? [ancho.min, ancho.max] : null,
    l: (familia.subsets ?? []).filter((s) => s !== 'menu'),
    p: familia.popularity ?? null,
    t: familia.trending ?? null,
    d: familia.dateAdded ?? null,
    o: familia.isOpenSource ? 1 : 0,
  };
}

export function compactarCatalogo(crudo, descargadoEn) {
  // La respuesta viene con un prefijo anti-XSSI que no es JSON.
  const texto = crudo.replace(/^\)\]\}'\s*/, '');
  const json = JSON.parse(texto);
  const familias = json.familyMetadataList.map(compactar);
  familias.sort((a, b) => a.f.localeCompare(b.f));
  return { origen: ORIGEN, descargadoEn, familias };
}

const esPrincipal = process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (esPrincipal) {
  const crudo = await leerCrudo(process.argv[2]);
  const catalogo = compactarCatalogo(crudo, new Date().toISOString().slice(0, 10));
  mkdirSync(dirname(destino), { recursive: true });
  writeFileSync(destino, JSON.stringify(catalogo) + '\n');
  const sinTrazo = catalogo.familias.filter((f) => !f.s).length;
  console.log(
    `${catalogo.familias.length} familias → ${destino}\n` +
      `${sinTrazo} no declaran trazo (el selector las cuenta aparte al filtrar por trazo).`,
  );
}
