/**
 * Qué núcleo le toca a cada mundo de la pantalla de inicio.
 *
 * Los núcleos viven en el núcleo del repo (`nucleo/`): web, medido sobre el
 * sitio real; editorial impreso, medido sobre el folleto real, las reglas de
 * impreso de Claude Design y el inventario de InDesign; marca, sobre la
 * identidad real de Santa Luisa y las referencias de marca de Claude Design;
 * campaña, sobre las piezas para redes. Los cuatro medidos el 18-09.
 */
import { NUCLEO_CAMPANA, NUCLEO_EDITORIAL, NUCLEO_MARCA, NUCLEO_WEB, type NucleoDeMundoV0 } from '@contope/core';
import { mundo, type MundoId } from './mundos.js';

const POR_ID: Readonly<Record<string, NucleoDeMundoV0>> = {
  web: NUCLEO_WEB,
  'editorial-impreso': NUCLEO_EDITORIAL,
  marca: NUCLEO_MARCA,
  campana: NUCLEO_CAMPANA,
};

export function nucleoDeMundo(id: MundoId): NucleoDeMundoV0 | undefined {
  const nucleoId = mundo(id).nucleoId;
  return nucleoId === undefined ? undefined : POR_ID[nucleoId];
}

/** ¿Este requisito es de los que el mundo elegido no puede dejar sin responder? */
export function enNucleo(id: MundoId, requirementId: string): boolean {
  return nucleoDeMundo(id)?.entradas.some((e) => e.requisitoId === requirementId) ?? false;
}
