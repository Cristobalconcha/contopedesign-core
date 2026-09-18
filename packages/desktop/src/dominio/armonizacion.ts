/**
 * Armonización, primer dibujo (18-09-2026; ARQUITECTURA.md, paso 5; decisiones
 * 21 y 23). Es una ETAPA, no un aviso en vivo: se entra con el paquete
 * completo, el árbitro del mundo señala, la persona valida, anota o redefine, y
 * se vuelve a pasar. Este módulo no dibuja: calcula las señales de una pasada
 * a partir de la evaluación y del sistema, y define cómo se guarda lo que la
 * persona decidió sobre cada una.
 *
 * Quién arbitra en este dibujo: las reglas con cita del núcleo del mundo
 * (`nucleo/` del repo Core), más los conflictos de origen que la recolección
 * dejó registrados. La lectura de las declaraciones por la IA (decisión 23:
 * «este proceso sí requiere de IA») NO está construida: cuando esté, sus
 * señales entran por acá con el mismo formato.
 *
 * Y la regla que manda sobre todas (decisión 21): si una señal cae sobre una
 * definición que vino de una cortapisa, gana la cortapisa. La señal no pide
 * cambiar esa definición: pide redefinir el resto.
 */
import { findEntry, type DesignSetEntryV0 } from '@contope/core';
import type { Evaluacion } from './evaluacion.js';
import { nucleoDeMundo } from './nucleos.js';
import type { Sistema } from './sistema.js';

export type Senal =
  | {
      id: string;
      tipo: 'regla';
      requirementId: string;
      titulo: string;
      detalle: string;
      cita: string;
      /** La definición señalada vino de una cortapisa: gana ella, se redefine el resto. */
      cortapisa: boolean;
    }
  | {
      id: string;
      tipo: 'conflicto';
      requirementId: string;
      titulo: string;
      detalle: string;
      cortapisa: boolean;
    };

export interface DecisionSobreSenal {
  estado: 'validada' | 'anotada';
  nota?: string;
  en: string;
  pasada: number;
}

export interface Armonizacion {
  /** Cuántas pasadas se han hecho. 0 = no se ha entrado todavía. */
  pasadas: number;
  /** Lo decidido sobre cada señal, por su id (estable entre pasadas). */
  senales: Record<string, DecisionSobreSenal>;
}

export function armonizacionVacia(): Armonizacion {
  return { pasadas: 0, senales: {} };
}

/** ¿La entrada vino de un insumo que entró como cortapisa? */
export function vieneDeCortapisa(sistema: Sistema, entrada: DesignSetEntryV0 | undefined): boolean {
  if (!entrada || entrada.resolutionPath !== 'insumo') return false;
  const insumo = sistema.insumos.find((i) => i.id === entrada.provenance.referenciaId);
  return insumo?.carril === 'cortapisa';
}

/** Las señales de una pasada: lo que el árbitro del mundo objeta y lo que la recolección dejó en conflicto. */
export function senalesDe(sistema: Sistema, evaluacion: Evaluacion): Senal[] {
  const senales: Senal[] = [];
  const nucleo = nucleoDeMundo(sistema.mundo);
  for (const r of evaluacion.nucleo?.reglas ?? []) {
    if (r.resultado !== 'no-cumple') continue;
    const regla = nucleo?.reglas.find((x) => x.id === r.reglaId);
    const entrada = findEntry(sistema.designSet, r.requisitoId);
    senales.push({
      id: `regla:${r.reglaId}`,
      tipo: 'regla',
      requirementId: r.requisitoId,
      titulo: regla?.nombre ?? r.reglaId,
      detalle: r.motivos.map((m) => m.mensaje).join(' '),
      cita: regla?.cita ?? '',
      cortapisa: vieneDeCortapisa(sistema, entrada),
    });
  }
  for (const c of sistema.conflictos) {
    const entrada = findEntry(sistema.designSet, c.requirementId);
    const insumoOrigen = sistema.insumos.find((i) => i.id === c.insumoId);
    const origen = insumoOrigen?.nombre ?? (c.insumoId === 'contope' ? 'una propuesta de ContOpe' : c.insumoId);
    const desplazado =
      insumoOrigen !== undefined
        ? `lo que venía de ${origen}`
        : c.insumoId === 'diseñador'
          ? 'lo que había definido el diseñador'
          : c.insumoId === 'contope'
            ? 'lo que había propuesto ContOpe'
            : `lo que venía de ${origen}`;
    senales.push({
      id: `conflicto:${c.id}`,
      tipo: 'conflicto',
      requirementId: c.requirementId,
      titulo: c.desplazada ? `Una cortapisa desplazó ${desplazado}` : 'Dos orígenes para la misma pregunta',
      detalle: c.desplazada
        ? 'Lo desplazado quedó registrado; si el resto del sistema se apoyaba en ese valor, hay que redefinirlo.'
        : `La pregunta ya estaba resuelta y ${origen} también la resuelve. Cuál manda se decide acá.`,
      cortapisa: vieneDeCortapisa(sistema, entrada),
    });
  }
  return senales;
}

/** Las señales que todavía no tienen decisión. */
export function senalesAbiertas(sistema: Sistema, senales: readonly Senal[]): Senal[] {
  return senales.filter((s) => sistema.armonizacion.senales[s.id] === undefined);
}

/** Las señales ya decididas, con su decisión al lado. */
export function senalesResueltas(
  sistema: Sistema,
  senales: readonly Senal[],
): Array<{ senal: Senal; decision: DecisionSobreSenal }> {
  const salida: Array<{ senal: Senal; decision: DecisionSobreSenal }> = [];
  for (const senal of senales) {
    const decision = sistema.armonizacion.senales[senal.id];
    if (decision !== undefined) salida.push({ senal, decision });
  }
  return salida;
}
