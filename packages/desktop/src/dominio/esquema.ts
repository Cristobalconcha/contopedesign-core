/**
 * Ayudas para editar un payload a partir de su payloadSchema: el valor con
 * el que arranca un campo cuando se agrega, cómo se describe un tipo en
 * palabras, y cómo se lee y escribe una ruta dentro del payload sin mutar.
 *
 * «Valor con el que arranca» NO es un valor por defecto de diseño: es el
 * hueco que el editor muestra para que alguien lo llene (texto vacío, lista
 * vacía). El evaluador del núcleo los rechaza hasta que se llenen, y eso es
 * exactamente lo que se quiere ver.
 */
import type { PayloadFieldSchema, PayloadSchema, PayloadType } from '@contope/core';

export type Ruta = ReadonlyArray<string | number>;

export function valorInicial(tipo: PayloadType): unknown {
  switch (tipo.kind) {
    case 'color-css':
    case 'longitud-css':
    case 'texto':
      return '';
    case 'bool':
      return false;
    case 'numero':
      return tipo.min ?? 0;
    case 'enum':
      return '';
    case 'ref':
      return null;
    case 'lista':
      return [];
    case 'objeto':
      return Object.fromEntries(
        Object.entries(tipo.fields)
          .filter(([, f]) => f.optional !== true)
          .map(([k, f]) => [k, valorInicial(f.type)]),
      );
    case 'union':
      return valorInicial(tipo.of[0] ?? { kind: 'texto' });
  }
}

export function payloadInicial(schema: PayloadSchema): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(schema)
      .filter(([, f]) => f.optional !== true)
      .map(([k, f]) => [k, valorInicial(f.type)]),
  );
}

export function describir(tipo: PayloadType): string {
  switch (tipo.kind) {
    case 'color-css':
      return 'color';
    case 'longitud-css':
      return 'longitud (px, rem, pt…)';
    case 'texto':
      return 'texto';
    case 'bool':
      return 'sí/no';
    case 'numero':
      return tipo.min !== undefined || tipo.max !== undefined
        ? `número ${tipo.min ?? ''}…${tipo.max ?? ''}`
        : 'número';
    case 'enum':
      return tipo.values.join(' · ');
    case 'ref':
      return tipo.reqId ? `referencia a ${tipo.reqId}` : 'referencia';
    case 'lista':
      return `lista de ${describir(tipo.of)}`;
    case 'objeto':
      return `objeto (${Object.keys(tipo.fields).join(', ')})`;
    case 'union':
      return tipo.of.map(describir).join(' o ');
  }
}

export function leer(valor: unknown, ruta: Ruta): unknown {
  let actual: unknown = valor;
  for (const seg of ruta) {
    if (typeof seg === 'number') {
      if (!Array.isArray(actual)) return undefined;
      actual = actual[seg];
    } else {
      if (typeof actual !== 'object' || actual === null || Array.isArray(actual)) return undefined;
      actual = (actual as Record<string, unknown>)[seg];
    }
  }
  return actual;
}

/** Devuelve una copia con `nuevo` escrito en `ruta`; `undefined` borra la clave. */
export function escribir(valor: unknown, ruta: Ruta, nuevo: unknown): unknown {
  if (ruta.length === 0) return nuevo;
  const [cabeza, ...resto] = ruta;
  if (typeof cabeza === 'number') {
    const lista = Array.isArray(valor) ? [...valor] : [];
    if (resto.length === 0 && nuevo === undefined) {
      lista.splice(cabeza, 1);
      return lista;
    }
    lista[cabeza] = escribir(lista[cabeza], resto, nuevo);
    return lista;
  }
  const objeto: Record<string, unknown> =
    typeof valor === 'object' && valor !== null && !Array.isArray(valor)
      ? { ...(valor as Record<string, unknown>) }
      : {};
  if (resto.length === 0 && nuevo === undefined) {
    delete objeto[cabeza as string];
    return objeto;
  }
  objeto[cabeza as string] = escribir(objeto[cabeza as string], resto, nuevo);
  return objeto;
}

export function campos(schema: PayloadSchema): Array<[string, PayloadFieldSchema]> {
  return Object.entries(schema);
}
