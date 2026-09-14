/**
 * Ir y volver del archivo `.contope.json`, validando en la frontera: un
 * archivo con forma inesperada se rechaza entero, con el motivo, en vez de
 * abrirse a medias. El DesignSet de adentro lo valida el núcleo.
 */
import { validateDesignSetShape } from '@contope/core';
import { esMundoId } from './mundos.js';
import { KIND_SISTEMA, SCHEMA_SISTEMA, type Sistema } from './sistema.js';

function esRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
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
  const set = validateDesignSetShape(valor['designSet']);
  if (!set.ok) return { ok: false, motivo: `DesignSet inválido: ${set.errores.map((e) => e.mensaje).join('; ')}` };
  return { ok: true, sistema: valor as unknown as Sistema };
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
