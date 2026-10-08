/**
 * El `LEEME.md` de una Célula Madre (decisión 35, «Cómo se entrega»): la
 * ficha que baja en el `.zip` junto a los archivos generados.
 *
 * Se escribe para una persona, en español de Chile y sin jerga: qué es, de
 * qué sistema y de qué definiciones viene, con qué parámetros, cómo se usa y
 * que queda desactualizado si el ADN cambia. Al final, la misma metadata
 * (`contope/celula-madre` v1, con la huella de cada archivo) en un bloque
 * ```json, para que ContOpe la lea: `leerMetadataDeLeeme`.
 */
import type { DesignSetV0 } from '../design-set/types.js';
import { fichaDe, leerFichaDeCelula } from './metadata.js';
import type { ArchivoGenerado, FichaDeCelula, Generador, MetadataDeCelula, ValorDeParametro } from './tipos.js';

export const NOMBRE_DEL_LEEME = 'LEEME.md';

/**
 * Nombre corto, para personas, de las preguntas que leen los generadores. Al
 * sumar un generador que lea otras, se agregan acá; lo que no esté se nombra
 * por su id.
 */
export const NOMBRE_CORTO_DE_PREGUNTA: Readonly<Record<string, string>> = {
  'dim1.req01': 'Fundamento cromático',
  'dim1.req02': 'Colores por rol',
  'dim1.req04': 'Rampas',
  'dim1.req14': 'Reproducción en imprenta',
};

export function nombreCortoDePregunta(id: string): string {
  return NOMBRE_CORTO_DE_PREGUNTA[id] ?? `Pregunta ${id}`;
}

/** Cómo se usa cada formato, en pasos de programa. La clave es la extensión, sin punto. */
const COMO_USAR: Readonly<Record<string, string>> = {
  ase:
    'Es una biblioteca de muestras de color. En Illustrator: ventana Muestras → menú del panel → Abrir biblioteca de muestras → Otra biblioteca…, y eliges el archivo. ' +
    'En InDesign: menú del panel Muestras → Cargar muestras… En Photoshop: ventana Muestras → menú del panel → Importar muestras…',
  svg:
    'Es un dibujo vectorial. Ábrelo en Illustrator (Archivo → Abrir) o colócalo en un documento (Archivo → Colocar); en Figma, arrástralo al lienzo o usa Importar. ' +
    'También se ve tal cual en cualquier navegador.',
  png: 'Es una imagen. Colócala en Illustrator o InDesign (Archivo → Colocar), ábrela en Photoshop o arrástrala al lienzo de Figma.',
  mp4: 'Es un video. Se reproduce en cualquier reproductor y se coloca en Premiere, After Effects, Keynote o PowerPoint.',
  mjs: 'Es un programa en JavaScript. Se carga desde una página web (como módulo) o se corre en el computador con Node.',
};

function extension(nombre: string): string {
  const i = nombre.lastIndexOf('.');
  return i < 0 ? '' : nombre.slice(i + 1).toLowerCase();
}

export function comoUsarArchivo(nombre: string): string {
  return COMO_USAR[extension(nombre)] ?? 'Ábrelo con el programa que corresponda a su formato.';
}

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

/** «8 de octubre de 2026, 09:00 (hora de Chile)». Si no hay datos de zona horaria, en UTC. */
export function fechaEnPalabras(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  try {
    const partes = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Santiago',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(d);
    const p = (tipo: Intl.DateTimeFormatPartTypes): string => partes.find((x) => x.type === tipo)?.value ?? '';
    const mes = MESES[Number(p('month')) - 1];
    if (mes !== undefined) return `${Number(p('day'))} de ${mes} de ${p('year')}, ${p('hour').padStart(2, '0')}:${p('minute')} (hora de Chile)`;
  } catch {
    // Sin la zona horaria: se dice en UTC.
  }
  const dosCifras = (n: number): string => String(n).padStart(2, '0');
  return `${d.getUTCDate()} de ${MESES[d.getUTCMonth()]} de ${d.getUTCFullYear()}, ${dosCifras(d.getUTCHours())}:${dosCifras(d.getUTCMinutes())} (UTC)`;
}

/** Un parámetro ya elegido, en palabras: «Incluir las rampas: sí», «Colores, en orden: azul → verde». */
export function parametrosEnPalabras(generador: Pick<Generador, 'parametros'>, parametros: MetadataDeCelula['parametros'], designSet: DesignSetV0): string[] {
  return generador.parametros.flatMap((p) => {
    const v: ValorDeParametro | undefined = parametros[p.id];
    if (v === undefined) return [];
    if (p.tipo === 'si-no') return [`${p.etiqueta}: ${v === true ? 'sí' : 'no'}`];
    if (p.tipo === 'opcion') return [`${p.etiqueta}: ${p.opciones.find((o) => o.valor === v)?.etiqueta ?? String(v)}`];
    if (p.tipo === 'numero') return [`${p.etiqueta}: ${String(v)}${p.unidad ?? ''}`];
    const etiquetas = new Map(p.opciones(designSet).map((o) => [o.valor, o.etiqueta.split(' · ')[0] ?? o.etiqueta]));
    const lista = Array.isArray(v) ? v.map((k) => etiquetas.get(k) ?? k) : [String(v)];
    return [`${p.etiqueta}: ${lista.join(p.ordenada ? ' → ' : ', ')}`];
  });
}

/** Una cerca de código más larga que cualquier racha de comillas invertidas del texto. */
function cercaPara(texto: string): string {
  const racha = Math.max(0, ...(texto.match(/`+/g) ?? []).map((r) => r.length));
  return '`'.repeat(Math.max(3, racha + 1));
}

/**
 * Escribe el `LEEME.md` de una generación. Un solo LEEME describe todos los
 * archivos del generador. Determinista: la fecha sale de la metadata.
 */
export function escribirLeeme(entrada: {
  generador: Pick<Generador, 'nombre' | 'descripcion' | 'formato' | 'parametros'>;
  designSet: DesignSetV0;
  metadata: MetadataDeCelula;
  archivos: readonly ArchivoGenerado[];
}): ArchivoGenerado & { contenido: string } {
  const { generador, designSet, metadata, archivos } = entrada;
  const ficha = fichaDe(metadata, archivos);
  const sistema = metadata.sistema.nombre.trim() || 'Sistema';
  const uno = archivos.length === 1;
  const leidos = new Map(metadata.ancestros.map((a) => [a.requirementId, a]));
  const definiciones = metadata.consulta.map((id) => {
    const a = leidos.get(id);
    const nombre = `**${nombreCortoDePregunta(id)}** (\`${id}\`)`;
    return a
      ? `- ${nombre}: revisión ${a.revision}, huella \`${a.huella.replace(/^sha256:/, '').slice(0, 12)}\``
      : `- ${nombre}: no estaba definida al generar. Si se define, ${uno ? 'este archivo queda desactualizado' : 'estos archivos quedan desactualizados'}.`;
  });
  const parametros = parametrosEnPalabras(generador, metadata.parametros, designSet);
  const json = JSON.stringify(ficha, null, 2);
  const cerca = cercaPara(json);
  const lineas = [
    `# ${generador.nombre} · ${sistema}`,
    '',
    '## Qué es',
    '',
    generador.descripcion,
    '',
    uno ? 'Trae un archivo:' : 'Trae estos archivos:',
    '',
    ...archivos.map((a) => `- \`${a.nombre}\``),
    '',
    `Formato: ${generador.formato}.`,
    '',
    '## De dónde viene',
    '',
    `- Sistema: **${sistema}**`,
    `- Generador: ${metadata.generador.nombre}, versión ${metadata.generador.version}`,
    `- Generado el ${fechaEnPalabras(metadata.generadoEn)}`,
    '',
    '## Qué definiciones del ADN usó',
    '',
    ...(definiciones.length ? definiciones : ['- Ninguna en particular.']),
    '',
    '## Con qué parámetros',
    '',
    ...(parametros.length ? parametros.map((p) => `- ${p}`) : ['- Sin parámetros.']),
    '',
    '## Cómo usarlo',
    '',
    ...archivos.flatMap((a) => [`**\`${a.nombre}\`**. ${comoUsarArchivo(a.nombre)}`, '']),
    '## Ojo: nace del ADN',
    '',
    `${uno ? 'Este archivo se hizo' : 'Estos archivos se hicieron'} con las definiciones del sistema «${sistema}» tal como estaban ese día. ` +
      `Si esas definiciones cambian, ${uno ? 'queda desactualizado: no se corrige solo' : 'quedan desactualizados: no se corrigen solos'}. ` +
      'Para ponerlo al día, vuelve a generarlo en ContOpe Design: Células Madre → Lo generado → Regenerar.',
    '',
    '## Ficha para ContOpe',
    '',
    'Este bloque es para que ContOpe lo lea y sepa de dónde viene y si sigue al día con el ADN. No hace falta tocarlo.',
    '',
    `${cerca}json`,
    json,
    cerca,
    '',
  ];
  return { nombre: NOMBRE_DEL_LEEME, tipoMime: 'text/markdown', contenido: lineas.join('\n') };
}

/**
 * Lee la ficha desde el texto de un `LEEME.md`: el último bloque ```json.
 * Fail-closed: si no hay bloque, no es JSON o la forma no calza, dice por qué.
 */
export function leerMetadataDeLeeme(texto: string): { ok: true; metadata: FichaDeCelula } | { ok: false; motivo: string } {
  const bloques = [...texto.replace(/\r\n/g, '\n').matchAll(/^(`{3,})json[ \t]*\n([\s\S]*?)\n\1[ \t]*$/gm)];
  const ultimo = bloques[bloques.length - 1];
  if (ultimo === undefined) return { ok: false, motivo: 'el LEEME no trae el bloque json con la ficha' };
  let valor: unknown;
  try {
    valor = JSON.parse(ultimo[2] ?? '');
  } catch {
    return { ok: false, motivo: 'el bloque json del LEEME no se puede leer' };
  }
  const r = leerFichaDeCelula(valor);
  return r.ok ? { ok: true, metadata: r.ficha } : r;
}
