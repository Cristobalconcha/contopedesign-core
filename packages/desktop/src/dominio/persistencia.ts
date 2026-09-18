/**
 * Ir y volver del archivo `.contope.json`, validando en la frontera: un
 * archivo con forma inesperada se rechaza entero, con el motivo, en vez de
 * abrirse a medias. El DesignSet de adentro lo valida el núcleo.
 *
 * `alcance` es lo único que se normaliza al leer: si falta (archivo viejo) se
 * pone `null`, que significa «sin acotar: todas las preguntas del manifiesto».
 * No se sube `SCHEMA_SISTEMA` por eso: un archivo sin el campo abre igual.
 *
 * Desde el 18-09-2026 cada insumo lleva además su CARRIL (`referente` o
 * `cortapisa`) y las DIMENSIONES que se toman de él (`tomar`; `null` = todas).
 * Los dos se completan al leer —un archivo viejo abre como referente que toma
 * todo—, pero un carril que no sea uno de los dos, o una dimensión
 * desconocida en `tomar`, rechazan el archivo entero.
 *
 * Y `armonizacion` (desde la tarde del 18-09): si falta, el archivo abre con
 * cero pasadas y sin señales decididas; si viene con otra forma, se rechaza.
 */
import { DIMENSION_IDS, validateDesignSetShape, type DimensionId } from '@contope/core';
import type { Alcance } from './alcance.js';
import { armonizacionVacia, type Armonizacion, type DecisionSobreSenal } from './armonizacion.js';
import { esMundoId } from './mundos.js';
import { KIND_SISTEMA, SCHEMA_SISTEMA, type Carril, type Insumo, type Sistema } from './sistema.js';

function esRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function validarAlcance(valor: unknown): { ok: true; alcance: Alcance | null } | { ok: false; motivo: string } {
  if (valor === undefined || valor === null) return { ok: true, alcance: null };
  if (!esRecord(valor)) return { ok: false, motivo: "'alcance' debe ser un objeto o null" };
  if (typeof valor['proposito'] !== 'string') return { ok: false, motivo: "'alcance.proposito' debe ser texto" };
  if (!Array.isArray(valor['dimensiones'])) return { ok: false, motivo: "'alcance.dimensiones' debe ser una lista" };
  const dimensiones: DimensionId[] = [];
  for (const d of valor['dimensiones']) {
    if (typeof d !== 'string' || !(DIMENSION_IDS as readonly string[]).includes(d)) {
      return { ok: false, motivo: `dimensión desconocida en el alcance: ${String(d)}` };
    }
    dimensiones.push(d as DimensionId);
  }
  if (typeof valor['declaradoEn'] !== 'string') return { ok: false, motivo: "'alcance.declaradoEn' debe ser texto" };
  return { ok: true, alcance: { proposito: valor['proposito'], dimensiones, declaradoEn: valor['declaradoEn'] } };
}

function esCarril(valor: unknown): valor is Carril {
  return valor === 'referente' || valor === 'cortapisa';
}

/**
 * Completa lo que un archivo viejo no traía: carril `referente` y `tomar`
 * `null` (todas las dimensiones). Lo que sí viene se valida.
 */
function normalizarInsumos(valor: unknown): { ok: true; insumos: Insumo[] } | { ok: false; motivo: string } {
  if (!Array.isArray(valor)) return { ok: false, motivo: "'insumos' debe ser una lista" };
  const insumos: Insumo[] = [];
  for (const crudo of valor) {
    if (!esRecord(crudo)) return { ok: false, motivo: 'cada insumo debe ser un objeto' };
    const carrilCrudo = crudo['carril'];
    if (carrilCrudo !== undefined && !esCarril(carrilCrudo)) {
      return { ok: false, motivo: `carril desconocido en un insumo: ${String(carrilCrudo)}` };
    }
    const tomarCrudo = crudo['tomar'];
    if (tomarCrudo !== undefined && tomarCrudo !== null && !Array.isArray(tomarCrudo)) {
      return { ok: false, motivo: "'tomar' debe ser null o una lista de dimensiones" };
    }
    let tomar: DimensionId[] | null = null;
    if (Array.isArray(tomarCrudo)) {
      const dimensiones: DimensionId[] = [];
      for (const d of tomarCrudo) {
        if (typeof d !== 'string' || !(DIMENSION_IDS as readonly string[]).includes(d)) {
          return { ok: false, motivo: `dimensión desconocida en 'tomar': ${String(d)}` };
        }
        dimensiones.push(d as DimensionId);
      }
      tomar = dimensiones;
    }
    insumos.push({
      ...(crudo as unknown as Insumo),
      carril: esCarril(carrilCrudo) ? carrilCrudo : 'referente',
      tomar,
    });
  }
  return { ok: true, insumos };
}

function validarArmonizacion(valor: unknown): { ok: true; armonizacion: Armonizacion } | { ok: false; motivo: string } {
  if (valor === undefined || valor === null) return { ok: true, armonizacion: armonizacionVacia() };
  if (!esRecord(valor)) return { ok: false, motivo: "'armonizacion' debe ser un objeto" };
  const pasadas = valor['pasadas'];
  if (typeof pasadas !== 'number' || !Number.isInteger(pasadas) || pasadas < 0) {
    return { ok: false, motivo: "'armonizacion.pasadas' debe ser un entero no negativo" };
  }
  if (!esRecord(valor['senales'])) return { ok: false, motivo: "'armonizacion.senales' debe ser un objeto" };
  const senales: Record<string, DecisionSobreSenal> = {};
  for (const [id, d] of Object.entries(valor['senales'])) {
    if (!esRecord(d)) return { ok: false, motivo: `la señal '${id}' debe ser un objeto` };
    const estado = d['estado'];
    if (estado !== 'validada' && estado !== 'anotada') return { ok: false, motivo: `estado desconocido en la señal '${id}': ${String(estado)}` };
    if (typeof d['en'] !== 'string' || typeof d['pasada'] !== 'number') return { ok: false, motivo: `la señal '${id}' necesita 'en' y 'pasada'` };
    if (d['nota'] !== undefined && typeof d['nota'] !== 'string') return { ok: false, motivo: `la nota de la señal '${id}' debe ser texto` };
    senales[id] = { estado, en: d['en'], pasada: d['pasada'], ...(typeof d['nota'] === 'string' ? { nota: d['nota'] } : {}) };
  }
  return { ok: true, armonizacion: { pasadas, senales } };
}

export function validarSistema(valor: unknown): { ok: true; sistema: Sistema } | { ok: false; motivo: string } {
  if (!esRecord(valor)) return { ok: false, motivo: 'el archivo no contiene un objeto' };
  if (valor['kind'] !== KIND_SISTEMA) return { ok: false, motivo: `no es un sistema de ContOpe Design (kind '${String(valor['kind'])}')` };
  if (valor['schemaVersion'] !== SCHEMA_SISTEMA) return { ok: false, motivo: `versión de archivo desconocida: ${String(valor['schemaVersion'])}` };
  if (typeof valor['id'] !== 'string' || typeof valor['nombre'] !== 'string') return { ok: false, motivo: 'falta id o nombre' };
  if (!esMundoId(valor['mundo'])) return { ok: false, motivo: `mundo desconocido: ${String(valor['mundo'])}` };
  for (const campo of ['insumos', 'conflictos', 'tareas', 'verificaciones'] as const) {
    if (!Array.isArray(valor[campo])) return { ok: false, motivo: `'${campo}' debe ser una lista` };
  }
  if (!esRecord(valor['caminos'])) return { ok: false, motivo: "'caminos' debe ser un objeto" };
  const alcance = validarAlcance(valor['alcance']);
  if (!alcance.ok) return { ok: false, motivo: alcance.motivo };
  const insumos = normalizarInsumos(valor['insumos']);
  if (!insumos.ok) return { ok: false, motivo: insumos.motivo };
  const armonizacion = validarArmonizacion(valor['armonizacion']);
  if (!armonizacion.ok) return { ok: false, motivo: armonizacion.motivo };
  const set = validateDesignSetShape(valor['designSet']);
  if (!set.ok) return { ok: false, motivo: `DesignSet inválido: ${set.errores.map((e) => e.mensaje).join('; ')}` };
  return {
    ok: true,
    sistema: {
      ...(valor as unknown as Sistema),
      alcance: alcance.alcance,
      insumos: insumos.insumos,
      armonizacion: armonizacion.armonizacion,
    },
  };
}

export function serializarSistema(sistema: Sistema): string {
  const v = validarSistema(sistema);
  if (!v.ok) throw new Error(`No se guarda un sistema inválido: ${v.motivo}`);
  return JSON.stringify(sistema, null, 2) + '\n';
}

export function parsearSistema(texto: string): Sistema {
  let valor: unknown;
  try {
    valor = JSON.parse(texto);
  } catch (error) {
    throw new Error(`El archivo no es JSON legible: ${(error as Error).message}`);
  }
  const v = validarSistema(valor);
  if (!v.ok) throw new Error(`No se puede abrir: ${v.motivo}`);
  return v.sistema;
}

export function nombreDeArchivo(sistema: Sistema): string {
  const base = sistema.nombre
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
  return `${base || 'sistema'}.contope.json`;
}
