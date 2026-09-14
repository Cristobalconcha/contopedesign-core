/**
 * Todo cambio al documento pasa por acá, como una acción con nombre. Nada de
 * la interfaz muta el sistema directamente: así cada gesto queda descrito y
 * se puede probar sin ventana.
 *
 * Reglas que este módulo hace cumplir:
 * - Un requisito tiene a lo sumo UNA entrada en el DesignSet (es invariante
 *   del núcleo). Un segundo insumo para el mismo requisito no la pisa ni se
 *   mezcla con ella: queda como conflicto, para la armonización.
 * - Una definición que viene de insumo entra como `propuesta` y `explorable`
 *   —lo más débil— hasta que la persona la apruebe y le dé fuerza.
 * - Aprobar no cambia el valor; reabrir no lo borra.
 */
import type {
  DesignSetEntryV0,
  DesignSetV0,
  Fuerza,
  ProvenanceV0,
  RequirementV0,
  ResolutionPath,
  VerificationRecordV0,
} from '@contope/core';
import { manifiestoDe, requisito, dimensionDe } from './manifiesto.js';
import { nuevoId, type Candidato, type Conflicto, type Insumo, type Sistema } from './sistema.js';
import type { DesignContractV1 } from '@contope/core';

export type Accion =
  | { tipo: 'renombrar'; nombre: string }
  | { tipo: 'agregar-insumo'; insumo: Insumo }
  | { tipo: 'quitar-insumo'; insumoId: string }
  | { tipo: 'incorporar'; insumoId: string; candidatoIds: string[] }
  | { tipo: 'descartar-candidato'; insumoId: string; candidatoId: string }
  | { tipo: 'asignar-camino'; requirementId: string; camino: ResolutionPath | null }
  | {
      tipo: 'definir';
      requirementId: string;
      payload: Record<string, unknown>;
      camino: ResolutionPath;
      fuerza: Fuerza;
    }
  | { tipo: 'aprobar'; requirementId: string; fuerza: Fuerza }
  | { tipo: 'reabrir'; requirementId: string }
  | { tipo: 'quitar-definicion'; requirementId: string }
  | { tipo: 'encargar-a-contope'; requirementId: string }
  | { tipo: 'registrar-verificacion'; registro: VerificationRecordV0 }
  | { tipo: 'registrar-capsula'; contrato: DesignContractV1 };

function esRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function conManifestRef(set: DesignSetV0, requirementId: string): DesignSetV0 {
  const dim = dimensionDe(requirementId);
  if (set.manifestRefs[dim] !== undefined) return set;
  const m = manifiestoDe(dim);
  if (!m) return set;
  return {
    ...set,
    manifestRefs: { ...set.manifestRefs, [dim]: { manifestVersion: m.manifestVersion, revision: m.revision } },
  };
}

function idDefinicion(requirementId: string, revision: number): string {
  // Provisional: la spec no fija el algoritmo de effectiveDefinitionId
  // (tensión §8.4 de C2). Legible y único dentro del set; nada más.
  return `${requirementId}.def${revision}`;
}

function crearEntrada(
  req: RequirementV0,
  payload: Record<string, unknown>,
  camino: ResolutionPath,
  provenance: ProvenanceV0,
  fuerza: Fuerza,
  cicloDeVida: DesignSetEntryV0['cicloDeVida'],
): DesignSetEntryV0 {
  return {
    requirementId: req.id,
    effectiveDefinitionId: idDefinicion(req.id, 1),
    resolutionPath: camino,
    payload,
    provenance,
    fuerza,
    cicloDeVida,
    revision: 1,
    mapsToKinds: req.mapsToKinds,
  };
}

/**
 * Une un fragmento al payload existente cuando los dos vienen del MISMO
 * insumo (dos extracciones del mismo archivo hacia el mismo requisito). Las
 * listas se concatenan sin repetir; los demás campos se llenan sólo si
 * faltaban. Nunca reemplaza un valor presente: eso sería un conflicto.
 */
export function unirFragmento(
  base: Record<string, unknown>,
  fragmento: Record<string, unknown>,
): Record<string, unknown> {
  const salida: Record<string, unknown> = { ...base };
  for (const [clave, valor] of Object.entries(fragmento)) {
    const actual = salida[clave];
    if (Array.isArray(valor) && Array.isArray(actual)) {
      const vistos = new Set(actual.map((x) => JSON.stringify(x)));
      salida[clave] = [...actual, ...valor.filter((x) => !vistos.has(JSON.stringify(x)))];
    } else if (esRecord(valor) && esRecord(actual)) {
      salida[clave] = unirFragmento(actual, valor);
    } else if (actual === undefined) {
      salida[clave] = valor;
    }
  }
  return salida;
}

function provenanceDe(camino: ResolutionPath, insumoId?: string): ProvenanceV0 {
  if (camino === 'insumo') return insumoId !== undefined ? { fuente: 'referente', referenciaId: insumoId } : { fuente: 'referente' };
  if (camino === 'contope') return { fuente: 'ia' };
  return { fuente: 'usuario' };
}

function sinCamino(caminos: Sistema['caminos'], requirementId: string): Sistema['caminos'] {
  if (!(requirementId in caminos)) return caminos;
  const copia = { ...caminos };
  delete copia[requirementId];
  return copia;
}

function incorporarCandidato(
  sistema: Sistema,
  insumo: Insumo,
  candidato: Candidato,
  ahora: string,
): Sistema {
  const req = requisito(candidato.requirementId);
  if (!req) return sistema;
  const set = conManifestRef(sistema.designSet, req.id);
  const existente = set.entries.find((e) => e.requirementId === req.id);

  if (!existente) {
    const entrada = crearEntrada(
      req,
      candidato.fragmento,
      'insumo',
      provenanceDe('insumo', insumo.id),
      'explorable',
      'propuesta',
    );
    return {
      ...sistema,
      designSet: { ...set, entries: [...set.entries, entrada] },
      caminos: sinCamino(sistema.caminos, req.id),
    };
  }

  const mismoInsumo =
    existente.resolutionPath === 'insumo' && existente.provenance.referenciaId === insumo.id;
  if (mismoInsumo && esRecord(existente.payload)) {
    const entradas = set.entries.map((e) =>
      e === existente ? { ...e, payload: unirFragmento(existente.payload as Record<string, unknown>, candidato.fragmento) } : e,
    );
    return { ...sistema, designSet: { ...set, entries: entradas } };
  }

  const conflicto: Conflicto = {
    id: nuevoId('conflicto'),
    requirementId: req.id,
    insumoId: insumo.id,
    candidatoId: candidato.id,
    fragmento: candidato.fragmento,
    registradoEn: ahora,
  };
  return { ...sistema, designSet: set, conflictos: [...sistema.conflictos, conflicto] };
}

function marcarCandidatos(
  insumos: Insumo[],
  insumoId: string,
  ids: ReadonlySet<string>,
  estado: Candidato['estado'],
): Insumo[] {
  return insumos.map((i) =>
    i.id !== insumoId
      ? i
      : { ...i, candidatos: i.candidatos.map((c) => (ids.has(c.id) ? { ...c, estado } : c)) },
  );
}

export function reducir(sistema: Sistema, accion: Accion, ahora = new Date().toISOString()): Sistema {
  const siguiente = aplicar(sistema, accion, ahora);
  return siguiente === sistema ? sistema : { ...siguiente, actualizadoEn: ahora };
}

function aplicar(sistema: Sistema, accion: Accion, ahora: string): Sistema {
  switch (accion.tipo) {
    case 'renombrar':
      return { ...sistema, nombre: accion.nombre };

    case 'agregar-insumo':
      return { ...sistema, insumos: [...sistema.insumos, accion.insumo] };

    case 'quitar-insumo': {
      // Quitar el archivo no quita lo que ya se incorporó de él: eso ya es
      // parte del set, con su procedencia. Sólo deja de ofrecer candidatos.
      return { ...sistema, insumos: sistema.insumos.filter((i) => i.id !== accion.insumoId) };
    }

    case 'incorporar': {
      const insumo = sistema.insumos.find((i) => i.id === accion.insumoId);
      if (!insumo) return sistema;
      const ids = new Set(accion.candidatoIds);
      let salida = sistema;
      for (const candidato of insumo.candidatos) {
        if (!ids.has(candidato.id) || candidato.estado !== 'pendiente') continue;
        salida = incorporarCandidato(salida, insumo, candidato, ahora);
      }
      return { ...salida, insumos: marcarCandidatos(salida.insumos, insumo.id, ids, 'incorporado') };
    }

    case 'descartar-candidato':
      return {
        ...sistema,
        insumos: marcarCandidatos(sistema.insumos, accion.insumoId, new Set([accion.candidatoId]), 'descartado'),
      };

    case 'asignar-camino': {
      if (accion.camino === null) return { ...sistema, caminos: sinCamino(sistema.caminos, accion.requirementId) };
      return { ...sistema, caminos: { ...sistema.caminos, [accion.requirementId]: accion.camino } };
    }

    case 'definir': {
      const req = requisito(accion.requirementId);
      if (!req) return sistema;
      const set = conManifestRef(sistema.designSet, req.id);
      const existente = set.entries.find((e) => e.requirementId === req.id);
      // Toda definición entra como propuesta, venga de donde venga: aprobar
      // es un acto aparte, y es donde la persona declara la fuerza. Editar
      // una aprobada la devuelve a propuesta: hay que volver a mirarla.
      const cicloDeVida = 'propuesta';
      const entrada: DesignSetEntryV0 = existente
        ? {
            ...existente,
            effectiveDefinitionId: idDefinicion(req.id, existente.revision + 1),
            resolutionPath: accion.camino,
            payload: accion.payload,
            provenance:
              accion.camino === 'insumo' && existente.resolutionPath === 'insumo'
                ? existente.provenance
                : provenanceDe(accion.camino),
            fuerza: accion.fuerza,
            cicloDeVida,
            revision: existente.revision + 1,
          }
        : crearEntrada(req, accion.payload, accion.camino, provenanceDe(accion.camino), accion.fuerza, cicloDeVida);
      const entries = existente ? set.entries.map((e) => (e === existente ? entrada : e)) : [...set.entries, entrada];
      const tareas = sistema.tareas.filter((t) => t.definitionId !== idDefinicion(req.id, existente?.revision ?? 1));
      return {
        ...sistema,
        designSet: { ...set, entries },
        caminos: sinCamino(sistema.caminos, req.id),
        tareas,
      };
    }

    case 'aprobar': {
      const entries = sistema.designSet.entries.map((e) =>
        e.requirementId === accion.requirementId ? { ...e, cicloDeVida: 'aprobada' as const, fuerza: accion.fuerza } : e,
      );
      return { ...sistema, designSet: { ...sistema.designSet, entries } };
    }

    case 'reabrir': {
      const entries = sistema.designSet.entries.map((e) =>
        e.requirementId === accion.requirementId ? { ...e, cicloDeVida: 'reabierta' as const } : e,
      );
      return { ...sistema, designSet: { ...sistema.designSet, entries } };
    }

    case 'quitar-definicion': {
      const entries = sistema.designSet.entries.filter((e) => e.requirementId !== accion.requirementId);
      return { ...sistema, designSet: { ...sistema.designSet, entries } };
    }

    case 'encargar-a-contope': {
      const req = requisito(accion.requirementId);
      if (!req) return sistema;
      const yaEncargado = sistema.tareas.some((t) => t.definitionId === idDefinicion(req.id, 1) && t.state === 'active');
      if (yaEncargado) return sistema;
      // Un encargo es una definición declarada y sin resolver: la tarea
      // apunta al id que tendrá cuando exista, y el contrato la proyecta
      // como `developmentTask` activa. Las restricciones son las
      // dependencias ya resueltas del requisito.
      const restricciones = req.dependsOn
        .map((d) => sistema.designSet.entries.find((e) => e.requirementId === d)?.effectiveDefinitionId)
        .filter((x): x is string => x !== undefined);
      return {
        ...sistema,
        caminos: { ...sistema.caminos, [req.id]: 'contope' },
        tareas: [
          ...sistema.tareas,
          {
            id: nuevoId('tarea'),
            definitionId: idDefinicion(req.id, 1),
            state: 'active',
            constraintDefinitionIds: restricciones,
            candidateDefinitionIds: [],
          },
        ],
      };
    }

    case 'registrar-verificacion': {
      const otras = sistema.verificaciones.filter((v) => v.pruebaId !== accion.registro.pruebaId);
      return { ...sistema, verificaciones: [...otras, accion.registro] };
    }

    case 'registrar-capsula':
      return { ...sistema, capsulaAnterior: accion.contrato };
  }
}
