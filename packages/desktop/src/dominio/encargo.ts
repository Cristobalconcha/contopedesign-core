/**
 * El encargo: lo que le pedimos a la IA del taller y lo que ella devuelve.
 *
 * Un encargo es una pregunta del manifiesto que la persona mandó por el camino
 * «ContOpe» (camino 3). La IA del taller vive dentro de la aplicación (ver
 * `proveedores.ts`), así que el encargo se arma acá, sin red: se le da el
 * sistema entero —qué mundo es, qué exige su núcleo, qué hay ya definido— más
 * las preguntas encargadas con su `payloadSchema` y las restricciones que las
 * amarran, y se le pide un JSON de propuestas.
 *
 * El prompt es largo a propósito: el modelo no tiene el repositorio ni la
 * cápsula a la vista, y una propuesta que ignore una definición anterior o una
 * restricción del manual del cliente no sirve de nada (el reductor la vuelve
 * conflicto o la rechaza). Lo que el taller ya sabe y no está en el prompt, el
 * modelo lo inventa.
 *
 * `jsonDePropuestas` es la vuelta: el modelo responde texto libre (a veces con
 * un cerco markdown de más), así que se rescata el objeto JSON y se completa
 * lo que el formato exige, para que `leerPropuestas` lo valide y el taller lo
 * traiga con `traer-propuesta`.
 */
import type { Evaluacion } from './evaluacion.js';
import { EXPLICACIONES } from './explicaciones.js';
import { requisito } from './manifiesto.js';
import { nucleoDeMundo } from './nucleos.js';
import { KIND_PROPUESTAS, SCHEMA_PROPUESTAS } from './propuestas.js';
import type { Mensajes } from './proveedores.js';
import type { Sistema } from './sistema.js';

/**
 * Los ids del manifiesto son `dimN.reqNN`. Las tareas de desarrollo cuelgan su
 * `definitionId` de ahí (`dim3.req02.…`), así que basta reconocer el patrón
 * para saber de qué pregunta es una tarea.
 */
const PATRON_REQUISITO = /dim\d+\.req\d+/;

type Requisito = NonNullable<ReturnType<typeof requisito>>;

/** Los encargos vivos: preguntas con tarea `active` o `proposed`, ordenadas por id. */
export function encargosDe(sistema: Sistema): string[] {
  const ids = new Set<string>();
  for (const tarea of sistema.tareas) {
    if (tarea.state !== 'active' && tarea.state !== 'proposed') continue;
    const id = requisitoDeTarea(tarea.definitionId);
    if (id !== undefined) ids.add(id);
  }
  return [...ids].sort();
}

function requisitoDeTarea(definitionId: string): string | undefined {
  const encontrado = PATRON_REQUISITO.exec(definitionId);
  const id = encontrado?.[0];
  return id !== undefined && requisito(id) !== undefined ? id : undefined;
}

function estaDefinida(evaluacion: Evaluacion, requirementId: string): boolean {
  return evaluacion.porRequisito.get(requirementId)?.resultado === 'resuelto';
}

const INSTRUCCIONES = [
  'Eres la IA del taller de ContOpe Design. ContOpe Design produce SISTEMAS de diseño, nunca «piezas»: un sistema queda descrito por definiciones (valores, escalas, reglas y umbrales) y la pieza la arma quien use el sistema. Nunca hables de «la pieza».',
  '',
  'Recibes las preguntas del manifiesto que una persona te encargó, junto con lo que ese sistema ya tiene definido y las restricciones que lo amarran. Tu trabajo es proponer una respuesta para cada pregunta encargada.',
  '',
  'ORDEN DE AUTORIDAD (de mayor a menor): human-confirmed > approved-guideline > deterministic-extraction > model-proposal. Lo que entregas es una PROPUESTA: una persona la revisa y decide, así que nunca puede contradecir algo de más autoridad que tú (lo que definió una persona, un manual aprobado, o lo extraído de un insumo). Si tu propuesta choca con algo así, dilo en la nota en vez de imponerla.',
  '',
  'Responde SOLO con un JSON válido, sin markdown y sin texto antes ni después, con esta forma exacta:',
  '{ "kind": "contope/propuestas", "schemaVersion": 1, "designId": "<id del sistema>", "por": "<modelo>", "propuestas": [ { "requirementId": "dimN.reqNN", "payload": { }, "nota": "por qué, con la evidencia y las restricciones que respetó" } ] }',
  '',
  'Reglas del formato:',
  '- Una propuesta por pregunta encargada, y para TODAS las preguntas encargadas.',
  '- El payload sigue EXACTAMENTE el payloadSchema de esa pregunta: los mismos nombres de campo, los mismos valores de enum, las mismas listas.',
  '- Los `ref` a otras preguntas sólo pueden apuntar a preguntas que ya tienen definición en el sistema (te las listamos en LO YA DEFINIDO).',
  '- Nunca inventes un valor que contradiga una restricción.',
  '- Si una pregunta no se puede resolver con lo que hay, devuelve igual una propuesta con el mejor payload posible y dilo en la nota.',
  '- Las notas van en español de Chile.',
].join('\n');

/**
 * Arma el prompt para que el modelo resuelva los encargos; null si no hay
 * ninguno vivo.
 */
export function promptDeEncargo(sistema: Sistema, evaluacion: Evaluacion): Mensajes | null {
  const encargos = encargosDe(sistema);
  if (encargos.length === 0) return null;
  const { texto: seccionInsumosTexto, imagenes } = seccionInsumos(sistema);
  const secciones: string[] = [seccionSistema(sistema)];
  const nucleo = seccionNucleo(sistema);
  if (nucleo !== null) secciones.push(nucleo);
  secciones.push(seccionInsumosTexto);
  secciones.push(seccionDefinido(sistema));
  secciones.push(seccionDeclaraciones(sistema));
  secciones.push(seccionEncargos(sistema, evaluacion, encargos));
  secciones.push(seccionRestricciones(sistema, encargos));
  secciones.push(seccionRecordatorio(sistema));
  const mensajes: Mensajes = { sistema: INSTRUCCIONES, usuario: secciones.join('\n\n') };
  return imagenes.length > 0 ? { ...mensajes, imagenes } : mensajes;
}

/** El `mimeType` y el `base64` de un data URL (`data:<mime>;base64,<datos>`); undefined si no calza. */
function partesDeDataUrl(dataUrl: string): { mimeType: string; base64: string } | undefined {
  const m = /^data:([^;,]+);base64,(.+)$/s.exec(dataUrl);
  if (m === null) return undefined;
  const mimeType = m[1];
  const base64 = m[2];
  if (mimeType === undefined || base64 === undefined) return undefined;
  return { mimeType, base64 };
}

function textoDeTomar(tomar: readonly string[] | null): string {
  return tomar === null ? 'todas' : tomar.length === 0 ? 'ninguna' : tomar.join(', ');
}

/**
 * Los insumos del sistema, en texto (nombre, tipo, carril, qué dimensiones se
 * toman) y las imágenes que se adjuntan al mensaje (una por insumo de tipo
 * `imagen` con miniatura). El texto numera cada imagen adjunta para que el
 * modelo pueda referirse a ella («imagen adjunta N»).
 */
function seccionInsumos(sistema: Sistema): { texto: string; imagenes: NonNullable<Mensajes['imagenes']> } {
  const lineas: string[] = ['LOS INSUMOS'];
  const imagenes: NonNullable<Mensajes['imagenes']> = [];
  if (sistema.insumos.length === 0) lineas.push('(ninguno todavía)');
  for (const insumo of sistema.insumos) {
    lineas.push(`- ${insumo.nombre} · tipo ${insumo.tipo} · carril ${insumo.carril} · dimensiones que toma: ${textoDeTomar(insumo.tomar)}`);
    if (insumo.tipo === 'imagen' && insumo.miniatura !== undefined) {
      const partes = partesDeDataUrl(insumo.miniatura);
      if (partes !== undefined) {
        imagenes.push({ nombre: insumo.nombre, mimeType: partes.mimeType, base64: partes.base64 });
        lineas.push(`  imagen adjunta ${imagenes.length}: ${insumo.nombre}`);
      }
    }
  }
  return { texto: lineas.join('\n'), imagenes };
}

function seccionSistema(sistema: Sistema): string {
  const proposito = sistema.alcance?.proposito ?? 'sin declarar';
  return [
    'EL SISTEMA',
    `nombre: ${sistema.nombre}`,
    `mundo: ${sistema.mundo}`,
    `propósito: ${proposito}`,
    `designId: ${sistema.id}`,
  ].join('\n');
}

function seccionNucleo(sistema: Sistema): string | null {
  const nucleo = nucleoDeMundo(sistema.mundo);
  if (nucleo === undefined) return null;
  const lineas: string[] = ['EL NÚCLEO DEL MUNDO', `nombre: ${nucleo.nombre}`, `fuente: ${nucleo.fuente}`];
  if (nucleo.reglas.length === 0) {
    lineas.push('reglas: (este mundo no tiene reglas medidas)');
    return lineas.join('\n');
  }
  lineas.push('reglas:');
  for (const regla of nucleo.reglas) {
    const condicion = regla.condicion;
    const sufijo =
      condicion === undefined
        ? ''
        : ` · condición: rige sólo si ${condicion.requisitoId} ${condicion.ruta.join('.')} = ${condicion.igualA}`;
    lineas.push(`- ${regla.id} · ${regla.nombre} · pregunta ${regla.requisitoId} · «${regla.cita}»${sufijo}`);
  }
  return lineas.join('\n');
}

function seccionDefinido(sistema: Sistema): string {
  const lineas: string[] = ['LO YA DEFINIDO'];
  const entradas = sistema.designSet.entries;
  if (entradas.length === 0) lineas.push('(todavía no hay ninguna definición en este sistema)');
  for (const entrada of entradas) {
    const pregunta = requisito(entrada.requirementId)?.pregunta ?? 'pregunta desconocida';
    const imperativa = sistema.imperativas[entrada.requirementId] !== undefined;
    const marca = imperativa ? ' · IMPERATIVA (viene del manual del cliente: NO se contradice)' : '';
    lineas.push(
      `- ${entrada.requirementId} · ${pregunta} · fuerza ${entrada.fuerza} · ${entrada.cicloDeVida} · imperativa: ${imperativa ? 'sí' : 'no'}${marca}`,
    );
    lineas.push(`  ${JSON.stringify(entrada.payload)}`);
  }
  return lineas.join('\n');
}

function textoDeDeclaracion(payload: unknown): string | undefined {
  if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) return undefined;
  const p = payload as Record<string, unknown>;
  const declaracion = p['declaracion'];
  if (typeof declaracion === 'string') return declaracion;
  const noAplica = p['noAplica'];
  if (typeof noAplica === 'string') return noAplica;
  return undefined;
}

function seccionDeclaraciones(sistema: Sistema): string {
  const lineas: string[] = ['LAS DECLARACIONES'];
  let hay = false;
  for (const entrada of sistema.designSet.entries) {
    const texto = textoDeDeclaracion(entrada.payload);
    if (texto === undefined) continue;
    hay = true;
    lineas.push(`- ${entrada.requirementId}: «${texto}»`);
  }
  if (!hay) lineas.push('(ninguna)');
  return lineas.join('\n');
}

function seccionEncargos(sistema: Sistema, evaluacion: Evaluacion, encargos: readonly string[]): string {
  const lineas: string[] = ['LOS ENCARGOS'];
  for (const id of encargos) {
    const req = requisito(id);
    lineas.push(`- ${id}`);
    lineas.push(`  pregunta: ${req?.pregunta ?? 'sin pregunta en el manifiesto'}`);
    const explicacion = EXPLICACIONES[id];
    if (explicacion !== undefined) lineas.push(`  explicación: ${explicacion}`);
    if (req === undefined) continue;
    lineas.push(`  eje: ${req.eje ?? 'sin eje'}`);
    lineas.push(`  packageId: ${req.packageId ?? 'sin paquete'}`);
    lineas.push(`  dependsOn: ${dependenciasLegibles(req, evaluacion)}`);
    lineas.push(`  payloadSchema: ${JSON.stringify(req.payloadSchema ?? null)}`);
  }
  return lineas.join('\n');
}

function dependenciasLegibles(req: Requisito, evaluacion: Evaluacion): string {
  const dependencias = req.dependsOn ?? [];
  if (dependencias.length === 0) return 'ninguna';
  return dependencias.map((d) => `${d} (${estaDefinida(evaluacion, d) ? 'definida' : 'sin definir'})`).join(', ');
}

function seccionRestricciones(sistema: Sistema, encargos: readonly string[]): string {
  const lineas: string[] = ['LAS RESTRICCIONES'];
  let hay = false;
  for (const id of encargos) {
    for (const tarea of sistema.tareas) {
      if (!tarea.definitionId.startsWith(`${id}.`)) continue;
      for (const restriccionId of tarea.constraintDefinitionIds ?? []) {
        hay = true;
        const entrada = sistema.designSet.entries.find((e) => e.effectiveDefinitionId === restriccionId);
        if (entrada === undefined) {
          lineas.push(`- ${id} · ${restriccionId} (esa definición ya no está en el sistema)`);
          continue;
        }
        const pregunta = requisito(entrada.requirementId)?.pregunta ?? 'pregunta desconocida';
        lineas.push(`- ${id} · ${entrada.requirementId} · ${pregunta}`);
        lineas.push(`  ${JSON.stringify(entrada.payload)}`);
      }
    }
  }
  if (!hay) lineas.push('(ninguna declarada)');
  return lineas.join('\n');
}

function seccionRecordatorio(sistema: Sistema): string {
  return `RECORDATORIO: responde sólo con el JSON de propuestas (kind "${KIND_PROPUESTAS}", schemaVersion ${SCHEMA_PROPUESTAS}, designId "${sistema.id}"), una propuesta por cada pregunta encargada, sin markdown y sin nada más.`;
}

/**
 * Del texto que devolvió el modelo al JSON de propuestas: acepta el JSON
 * pelado, o envuelto en ```json … ```, o con texto antes/después (se toma
 * desde la primera `{` hasta la última `}`).
 */
export function jsonDePropuestas(texto: string, sistema: Sistema): { ok: true; json: string } | { ok: false; motivo: string } {
  const desde = texto.indexOf('{');
  const hasta = texto.lastIndexOf('}');
  if (desde === -1 || hasta === -1 || hasta <= desde) {
    return { ok: false, motivo: 'la respuesta del modelo no trae un objeto JSON' };
  }
  let valor: unknown;
  try {
    valor = JSON.parse(texto.slice(desde, hasta + 1));
  } catch (error) {
    return { ok: false, motivo: `la respuesta del modelo no es JSON legible: ${(error as Error).message}` };
  }
  if (typeof valor !== 'object' || valor === null || Array.isArray(valor)) {
    return { ok: false, motivo: 'la respuesta del modelo no contiene un objeto JSON' };
  }
  const objeto: Record<string, unknown> = { ...(valor as Record<string, unknown>) };
  if (typeof objeto['designId'] !== 'string') objeto['designId'] = sistema.id;
  if (objeto['kind'] === undefined) objeto['kind'] = KIND_PROPUESTAS;
  if (objeto['schemaVersion'] === undefined) objeto['schemaVersion'] = SCHEMA_PROPUESTAS;
  return { ok: true, json: JSON.stringify(objeto) };
}
