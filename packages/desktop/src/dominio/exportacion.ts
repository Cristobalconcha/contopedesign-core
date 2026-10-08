/**
 * Exportar el ADN (decisión 35, «Exportar el ADN»): *«al exportar el ADN se
 * exporta junto con sus archivos fuente en el mismo zip»*.
 *
 * Un solo `.zip` (`<sistema>-adn.zip`) con:
 * - la cápsula de siempre en la raíz (`design-contract.json`, `DESIGN.md`);
 * - `celulas-madre/<sistema>-<generador>/`: cada Célula Madre del registro
 *   («Lo generado»), con sus archivos y su `LEEME.md`, igual que su zip suelto
 *   (la misma función de empaquetado del núcleo, `entradasDeCelula`);
 * - un `LEEME.md` en la raíz que dice qué trae el paquete y qué quedó fuera.
 *
 * Las Células Madre se GENERAN DE NUEVO con el ADN que se exporta y los
 * parámetros guardados, para que vayan al día con él (los generadores son
 * deterministas). Si a un generador ya no le alcanza el ADN, o ya no existe
 * en esta versión de la app, queda fuera y se dice por qué. El registro del
 * taller no se toca: anota lo que se generó desde Células Madre.
 */
import {
  armarZip,
  baseDeNombre,
  entradasDeCelula,
  fechaEnPalabras,
  generadorPorId,
  nombreCortoDePregunta,
  nombreDePaquete,
  type ArchivoGenerado,
  type EntradaDeZip,
  type Vigencia,
} from '@contope/core';
import { proyectarCapsula, type Capsula } from './capsula.js';
import { generarEnElTaller, vigenciaDe, type CelulaGenerada } from './celulas.js';
import type { Sistema } from './sistema.js';

export const CARPETA_CELULAS = 'celulas-madre';

/** Una Célula Madre que entró al paquete, hecha de nuevo con este ADN. */
export interface CelulaExportada {
  /** La carpeta dentro del zip (`celulas-madre/econut-paleta-ase`). */
  carpeta: string;
  /** La generación recién hecha (su metadata ya tiene las huellas del ADN exportado). */
  celula: CelulaGenerada;
  /** Cómo estaba lo registrado en «Lo generado» frente a este ADN, antes de regenerarlo. */
  antes: Vigencia;
}

/** Una Célula Madre del registro que no entró, con el motivo dicho para el diseñador. */
export interface CelulaOmitida {
  nombre: string;
  motivo: string;
}

export interface ExportacionDelAdn {
  zip: ArchivoGenerado & { contenido: Uint8Array };
  capsula: Capsula;
  incluidas: CelulaExportada[];
  omitidas: CelulaOmitida[];
}

const QUE_ES_DE_LA_CAPSULA: Readonly<Record<string, string>> = {
  'design-contract.json': 'las definiciones del sistema, completas y trazables, para que las lea una herramienta o una IA',
  'DESIGN.md': 'las mismas definiciones, escritas para leerlas',
};

function vigenciaEnPalabras(v: Vigencia): string {
  if (v.estado === 'vigente') return 'ya estaba al día';
  if (v.estado === 'huérfana') return `lo anotado no tenía ancestro (${v.motivo})`;
  const MOTIVO = { cambio: 'cambió', borrada: 'se borró', nueva: 'se definió después' } as const;
  return `estaba desactualizado: ${v.cambios.map((c) => `${MOTIVO[c.motivo]} «${nombreCortoDePregunta(c.requirementId)}»`).join('; ')}`;
}

function leemeDeLaRaiz(sistema: Sistema, capsula: Capsula, incluidas: CelulaExportada[], omitidas: CelulaOmitida[], ahora: string): string {
  const nombre = sistema.nombre.trim() || 'Sistema';
  const lineas = [
    `# ${nombre} · ADN exportado`,
    '',
    `Este paquete trae el ADN del sistema «${nombre}» —sus definiciones— y sus Células Madre: los archivos hechos con ese ADN, listos para abrir en otra herramienta.`,
    '',
    `- Exportado el ${fechaEnPalabras(ahora)}`,
    `- Revisión ${capsula.contrato.design.revision} de la cápsula`,
    '',
    '## La cápsula',
    '',
    ...capsula.archivos.map((a) => `- \`${a.nombre}\`${QUE_ES_DE_LA_CAPSULA[a.nombre] ? `: ${QUE_ES_DE_LA_CAPSULA[a.nombre]}` : ''}`),
    '',
    '## Células Madre',
    '',
  ];
  if (incluidas.length === 0) {
    lineas.push(omitidas.length === 0 ? 'Este sistema todavía no tiene Células Madre generadas.' : 'Ninguna entró en este paquete (ver abajo).', '');
  } else {
    lineas.push(
      'Cada una se hizo de nuevo al exportar, con este mismo ADN y los parámetros con que se había generado, así que todas van al día con él. Cada carpeta trae sus archivos y un `LEEME.md` que explica qué son y cómo usarlos.',
      '',
      ...incluidas.map(
        (c) =>
          `- \`${c.carpeta}/\`: ${c.celula.metadata.generador.nombre} (versión ${c.celula.metadata.generador.version}), con ${c.celula.archivos
            .map((a) => `\`${a.nombre}\``)
            .join(', ')}. Al día con este ADN; lo anotado en «Lo generado» ${vigenciaEnPalabras(c.antes)}.`,
      ),
      '',
    );
  }
  if (omitidas.length > 0) {
    lineas.push('## Lo que quedó fuera', '', ...omitidas.map((o) => `- ${o.nombre}: ${o.motivo}`), '');
  }
  return lineas.join('\n');
}

/** Arma el zip del ADN. `ahora` se inyecta: con el mismo sistema y la misma fecha, los mismos bytes. */
export function exportarAdn(sistema: Sistema, ahora = new Date().toISOString()): ExportacionDelAdn {
  const capsula = proyectarCapsula(sistema);
  const entradas: EntradaDeZip[] = capsula.archivos.map((a) => ({ ruta: a.nombre, contenido: a.texto }));
  const incluidas: CelulaExportada[] = [];
  const omitidas: CelulaOmitida[] = [];
  const carpetas = new Set<string>();
  for (const registrada of sistema.celulasMadre) {
    const nombre = registrada.metadata.generador.nombre;
    const generador = generadorPorId(registrada.metadata.generador.id);
    if (!generador) {
      omitidas.push({ nombre, motivo: 'este generador ya no existe en esta versión de la app.' });
      continue;
    }
    const r = generarEnElTaller(sistema, generador, registrada.metadata.parametros, ahora);
    if (!r.ok) {
      omitidas.push({ nombre, motivo: `no se pudo generar con este ADN. ${r.falta}` });
      continue;
    }
    const base = `${CARPETA_CELULAS}/${nombreDePaquete(sistema, generador)}`;
    let carpeta = base;
    for (let n = 2; carpetas.has(carpeta); n++) carpeta = `${base}-${n}`;
    carpetas.add(carpeta);
    entradas.push(...entradasDeCelula(r, carpeta));
    incluidas.push({ carpeta, celula: r.celula, antes: vigenciaDe(registrada, sistema) });
  }
  entradas.unshift({ ruta: 'LEEME.md', contenido: leemeDeLaRaiz(sistema, capsula, incluidas, omitidas, ahora) });
  return {
    zip: { nombre: `${baseDeNombre(sistema.nombre)}-adn.zip`, tipoMime: 'application/zip', contenido: armarZip(entradas, ahora) },
    capsula,
    incluidas,
    omitidas,
  };
}
