// Compila la Biblia del diseño (el vault, en markdown) a datos que ContOpe consulta.
//
// Uso:
//   node scripts/biblia/compilar.mjs [--vault <carpeta de la Biblia>] [--salida <archivo.json>]
//   pnpm biblia:compilar
//
// La carpeta se toma, en este orden, de --vault, de la variable BIBLIA_VAULT o, por
// defecto, de ../contope-design/vault_contope-design/biblia relativo a la raíz del repo.
// Escribe packages/core/src/biblia/biblia.generada.json. Sin dependencias: sólo Node.
//
// Qué lee (formato medido el 29-09-2026 sobre los catorce capítulos):
//   - `NN-slug.md`: el título sale de `# NN — Título`; cada entrada es una sección
//     `## ENN. Título` que termina en el siguiente `## `. Las notas transversales
//     (`### N1.` …) y las secciones de ronda, vocabulario y fuentes quedan fuera.
//   - Dentro de la entrada, párrafos que abren con una etiqueta en negrita
//     (`**Enunciado.**`, `**Tipo.**`, `**Posturas.**`, `**Fuerza por tipo y rol.**`…).
//     Un campo va desde su etiqueta hasta la siguiente etiqueta al comienzo de línea.
//   - La fuerza, en una tabla markdown cuyo encabezado tiene una columna «fuerza».
//   - `ESTADO.md`: el estado de cada tema (aprobado / por revisar / borrador).
//
// Regla de la casa: nada ambiguo se resuelve en silencio. Lo que no se reconoce
// (etiquetas de tipo, celdas sin fuerza, negaciones, entradas sin tabla) va al
// `informe` del JSON y al resumen que se imprime.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

// ---------------------------------------------------------------------------
// Argumentos
// ---------------------------------------------------------------------------

function argumento(nombre) {
  const i = process.argv.indexOf(nombre);
  if (i === -1) return undefined;
  const valor = process.argv[i + 1];
  if (!valor || valor.startsWith('--')) throw new Error(`${nombre} necesita un valor`);
  return valor;
}

const VAULT = path.resolve(
  RAIZ,
  argumento('--vault') ?? process.env.BIBLIA_VAULT ?? '../contope-design/vault_contope-design/biblia',
);
const SALIDA = path.resolve(RAIZ, argumento('--salida') ?? 'packages/core/src/biblia/biblia.generada.json');

// ---------------------------------------------------------------------------
// Normalización de tipos de producto: la tabla escrita a mano
// ---------------------------------------------------------------------------

/** Los ocho tipos canónicos (spec de tipos de producto §7.3 y README de la Biblia). */
const TIPOS = ['marca', 'editorial-libro', 'revista', 'afiche', 'campana-digital', 'web', 'packaging', 'senaletica'];

/**
 * Prefijo (en minúsculas y sin tildes) → tipos canónicos. Se compara contra el
 * comienzo de cada tramo de la etiqueta, con límite de palabra, y gana el prefijo
 * más largo. Todo lo que no empiece con uno de estos prefijos NO es tipo: pasa a
 * ser el rol, o, si es lo primero de la etiqueta, va al informe como etiqueta sin tipo.
 *
 * Decisiones que conviene revisar (marcadas con «decisión»):
 */
const PREFIJOS = [
  ['marca/identidad', ['marca']],
  ['marca', ['marca']],
  ['editorial libro', ['editorial-libro']],
  // decisión: «editorial» a secas (p. ej. «editorial, afiche, packaging») nombra al libro y a la revista.
  ['editorial', ['editorial-libro', 'revista']],
  ['libro', ['editorial-libro']],
  ['revista', ['revista']],
  ['afiche/campana impresa', ['afiche']],
  ['afiche', ['afiche']],
  ['campana digital/redes', ['campana-digital']],
  ['campana digital', ['campana-digital']],
  ['web', ['web']],
  ['packaging', ['packaging']],
  ['senaletica', ['senaletica']],
  ['senalizacion', ['senaletica']],
  // decisión: las funciones de la señalética (tema 10, N1: identificación, dirección,
  // interpretación/información, seguridad y regulación; más evacuación e incendio)
  // aparecen solas como etiqueta en tablas de señalética. Se leen como señalética,
  // pero sólo al comienzo de la etiqueta: en «señalética: identificación de salas»
  // la función es el rol, no otro tipo.
  ['identificacion', ['senaletica'], 'solo-al-inicio'],
  ['direccion', ['senaletica'], 'solo-al-inicio'],
  ['interpretacion', ['senaletica'], 'solo-al-inicio'],
  ['evacuacion', ['senaletica'], 'solo-al-inicio'],
  ['seguridad', ['senaletica'], 'solo-al-inicio'],
  ['regulacion', ['senaletica'], 'solo-al-inicio'],
  // decisión: «todos los impresos» (tema 14) son los tipos que salen a imprenta.
  ['todos los impresos', ['editorial-libro', 'revista', 'afiche', 'packaging']],
].sort((a, b) => b[0].length - a[0].length);

/**
 * Comodines: etiquetas que no nombran un tipo sino un conjunto. Se comparan contra
 * el primer tramo de la etiqueta, después de los prefijos (así «todos los impresos»
 * sigue siendo el prefijo de arriba). Cada expansión queda en el informe.
 *
 * decisión (se aparta del encargo, que pedía expandir los dos a «los no nombrados»):
 * medido en los catorce capítulos, «todos» significa literalmente todos. En 02.E07
 * «todos | cortapisa técnica: la fuente debe contener ñ…» convive con filas de
 * packaging y marca que agregan algo, no que lo excluyan; en 04.E03 y 09.E11–E13
 * igual. En cambio «resto» siempre es «lo que la tabla no nombró» (01.E06, 02.E09,
 * 03.E11, 10.E08–E10). Por eso:
 *   - TODOS → los ocho tipos (las filas específicas se muestran junto, con su etiqueta);
 *   - RESTO → los tipos que ninguna otra fila de la misma tabla nombra.
 */
const TODOS = ['todos los tipos', 'todos', 'cualquier tipo', 'cualquier pieza', 'piezas'];
const RESTO = ['resto', 'lo demas'];

// ---------------------------------------------------------------------------
// Utilidades de texto
// ---------------------------------------------------------------------------

/** Minúsculas, sin tildes ni eñes, espacios colapsados. Sólo para comparar. */
function plano(s) {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/** Une las líneas de un párrafo envuelto en una sola línea. */
function unirLineas(s) {
  return s
    .split('\n')
    .map((l) => l.trim())
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** `true` si `texto` (plano) empieza con `prefijo` y lo que sigue no es una letra. */
function empiezaCon(texto, prefijo) {
  if (!texto.startsWith(prefijo)) return false;
  const siguiente = texto.charAt(prefijo.length);
  return siguiente === '' || !/[a-z0-9]/.test(siguiente);
}

/**
 * Tipos que nombra el comienzo de un tramo, o `null` si no empieza con un tipo.
 * Con `alInicio` en falso se ignoran los prefijos marcados «solo-al-inicio».
 */
function tiposDelTramo(tramo, alInicio = true) {
  const p = plano(tramo);
  for (const [prefijo, tipos, marca] of PREFIJOS) {
    if (!alInicio && marca === 'solo-al-inicio') continue;
    if (empiezaCon(p, prefijo)) return tipos;
  }
  return null;
}

/**
 * Parte una etiqueta en tramos separados por coma o dos puntos que estén fuera de
 * paréntesis. Devuelve cada tramo con su posición en el texto original.
 */
function tramos(etiqueta) {
  const salida = [];
  let profundidad = 0;
  let inicio = 0;
  for (let i = 0; i < etiqueta.length; i++) {
    const c = etiqueta[i];
    if (c === '(') profundidad++;
    else if (c === ')') profundidad = Math.max(0, profundidad - 1);
    else if ((c === ',' || c === ':') && profundidad === 0) {
      salida.push({ texto: etiqueta.slice(inicio, i), inicio });
      inicio = i + 1;
    }
  }
  salida.push({ texto: etiqueta.slice(inicio), inicio });
  return salida.map((t) => {
    const recorte = t.texto.length - t.texto.trimStart().length;
    return { texto: t.texto.trim(), inicio: t.inicio + recorte };
  });
}

/**
 * Lee los tipos de una etiqueta de fila. Consume tramos mientras empiecen con un
 * tipo; dentro de un tramo, los pedazos unidos por « / » o « y » que también
 * empiecen con un tipo se suman («editorial libro y revista»). Lo que queda
 * desde el primer tramo que no es tipo es el rol.
 *
 * @returns {{ tipos: string[], rol: string|null, comodin: 'todos'|'resto'|null }}
 */
function leerEtiqueta(etiqueta) {
  const lista = tramos(etiqueta);
  const primero = lista[0] ? lista[0].texto : '';
  if (tiposDelTramo(primero) === null) {
    const p = plano(primero);
    const comodin = TODOS.some((c) => empiezaCon(p, c)) ? 'todos' : RESTO.some((c) => empiezaCon(p, c)) ? 'resto' : null;
    if (comodin) {
      const resto = lista.slice(1);
      const rol = resto.length > 0 ? etiqueta.slice(resto[0].inicio).trim() : null;
      return { tipos: [], rol: rol || null, comodin };
    }
  }
  const tipos = [];
  let i = 0;
  for (; i < lista.length; i++) {
    const tramo = lista[i].texto;
    const delTramo = [];
    for (const pedazo of tramo.split(/ \/ | y | e /)) {
      const t = tiposDelTramo(pedazo, i === 0);
      if (t) for (const x of t) if (!delTramo.includes(x)) delTramo.push(x);
    }
    // El primer tramo tiene que empezar con un tipo. Los siguientes cuentan como
    // tipo sólo si empiezan con uno y agregan un tipo nuevo: en «marca/identidad,
    // marca centrada en vertical» el segundo tramo es el rol.
    if (tiposDelTramo(tramo, i === 0) === null) break;
    if (i > 0 && delTramo.every((x) => tipos.includes(x))) break;
    for (const x of delTramo) if (!tipos.includes(x)) tipos.push(x);
  }
  const rol = i < lista.length ? etiqueta.slice(lista[i].inicio).trim() : null;
  return { tipos: TIPOS.filter((t) => tipos.includes(t)), rol: rol || null, comodin: null };
}

// ---------------------------------------------------------------------------
// Fuerzas
// ---------------------------------------------------------------------------

const FUERZAS = [
  ['cortapisa', 'cortapisa'],
  ['recomendacion fuerte', 'recomendacion-fuerte'],
  ['divergencia', 'divergencia'],
  ['no aplica', 'no-aplica'],
];

/** Palabras que, justo antes de una fuerza, la niegan («no es cortapisa», «sin cortapisa»). */
const NEGACIONES = /(?:\bno es|\bno son|\bsin|\bni|\bno hay|\bnunca|\bdeja de ser|\bno llega a)\s+(?:una\s+|la\s+|el\s+)?$/;

/**
 * Las fuerzas de una celda, en orden de aparición y sin repetir. Se buscan en el
 * texto plano (con o sin negrita: el 70 % de las celdas no la lleva). Las que
 * aparecen negadas no cuentan y se devuelven aparte para el informe.
 */
function leerFuerzas(celda) {
  const p = plano(celda.replace(/\*/g, ''));
  const halladas = [];
  const negadas = [];
  for (const [palabra, fuerza] of FUERZAS) {
    let desde = 0;
    for (;;) {
      const i = p.indexOf(palabra, desde);
      if (i === -1) break;
      desde = i + palabra.length;
      const antes = p.charAt(i - 1);
      const despues = p.charAt(i + palabra.length);
      if ((antes && /[a-z]/.test(antes)) || (despues && /[a-z]/.test(despues))) continue;
      if (NEGACIONES.test(p.slice(Math.max(0, i - 20), i))) negadas.push(fuerza);
      else halladas.push({ i, fuerza });
    }
  }
  halladas.sort((a, b) => a.i - b.i);
  const fuerzas = [];
  for (const { fuerza } of halladas) if (!fuerzas.includes(fuerza)) fuerzas.push(fuerza);
  return { fuerzas, negadas };
}

// ---------------------------------------------------------------------------
// Tablas markdown
// ---------------------------------------------------------------------------

function celdas(linea) {
  let s = linea.trim();
  if (s.startsWith('|')) s = s.slice(1);
  if (s.endsWith('|')) s = s.slice(0, -1);
  // Barras escapadas (\|) no se usan en la Biblia (medido); igual se respetan.
  return s.split(/(?<!\\)\|/).map((c) => c.replace(/\\\|/g, '|').trim());
}

/** Bloques de líneas de tabla consecutivas dentro de un texto. */
function tablas(texto) {
  const salida = [];
  let actual = null;
  for (const linea of texto.split('\n')) {
    if (linea.trim().startsWith('|')) {
      if (!actual) salida.push((actual = []));
      actual.push(linea);
    } else actual = null;
  }
  return salida.map((lineas) => {
    const [encabezado, separador, ...filas] = lineas;
    const esSeparador = separador !== undefined && /^\|?\s*:?-{2,}/.test(separador.trim());
    return {
      encabezado: celdas(encabezado ?? ''),
      filas: (esSeparador ? filas : [separador, ...filas]).filter(Boolean).map(celdas),
    };
  });
}

// ---------------------------------------------------------------------------
// Entradas
// ---------------------------------------------------------------------------

/** Etiqueta en negrita al comienzo de línea: `**Enunciado.**`, `**Hechos y citas.**`… */
const ETIQUETA = /^\*\*([^*\n]+?[.:])\*\*\s*/;

function campoDeEtiqueta(etiqueta) {
  const e = plano(etiqueta).replace(/[.:]$/, '');
  if (e === 'enunciado') return 'enunciado';
  if (e === 'tipo') return 'tipo';
  if (e.startsWith('fuerza')) return 'fuerza';
  if (e.startsWith('para aprender')) return 'paraAprender';
  if (e === 'fuentes') return 'fuentes';
  if (e.startsWith('contradicciones abiertas')) return 'contradicciones';
  if (e.startsWith('postura') || e === 'no hay posturas' || e === 'no hay ganador') return 'posturas';
  if (e.startsWith('hecho')) return 'hechos';
  return null;
}

/** Parte el cuerpo de una entrada en campos por etiqueta. */
function camposDeEntrada(cuerpo) {
  /** @type {Array<{ etiqueta: string, campo: string|null, texto: string }>} */
  const bloques = [];
  let actual = null;
  for (const linea of cuerpo.split('\n')) {
    const m = linea.match(ETIQUETA);
    if (m) {
      actual = { etiqueta: m[1], campo: campoDeEtiqueta(m[1]), lineas: [linea.slice(m[0].length)] };
      bloques.push(actual);
    } else if (actual) actual.lineas.push(linea);
  }
  return bloques.map((b) => ({
    etiqueta: b.etiqueta,
    campo: b.campo,
    texto: b.lineas.join('\n').replace(/\n-{3,}\s*$/, '').trim(),
  }));
}

function leerTema(archivo, estados, informe) {
  const nombre = path.basename(archivo, '.md');
  const [, numero, slug] = nombre.match(/^(\d\d)-(.+)$/);
  const texto = fs.readFileSync(archivo, 'utf8').replace(/\r\n/g, '\n');
  const lineas = texto.split('\n');
  const tituloLinea = lineas.find((l) => l.startsWith('# ')) ?? '';
  const titulo = tituloLinea.replace(/^#\s+\d\d\s*[—–-]\s*/, '').trim();

  const estado = estados.get(numero);
  if (!estado) informe.temasSinEstado.push(numero);

  // Secciones de nivel 2: cada `## ENN.` es una entrada hasta el siguiente `## `.
  const entradas = [];
  let actual = null;
  for (const linea of lineas) {
    if (linea.startsWith('## ')) {
      const m = linea.match(/^## (E\d+)\.\s*(.*)$/);
      actual = m ? { numero: m[1], titulo: m[2].trim(), lineas: [] } : null;
      if (m) entradas.push(actual);
    } else if (actual) actual.lineas.push(linea);
  }

  return {
    numero,
    slug,
    titulo,
    estado: estado ?? 'borrador',
    entradas: entradas.map((e) => leerEntrada(numero, e, informe)),
  };
}

function leerEntrada(numeroTema, e, informe) {
  const id = `${numeroTema}.${e.numero}`;
  const bloques = camposDeEntrada(e.lineas.join('\n'));
  const juntar = (campo) => {
    const partes = bloques.filter((b) => b.campo === campo);
    if (partes.length === 0) return null;
    return partes
      .map((b, i) => (i === 0 || campo !== 'posturas' ? b.texto : `**${b.etiqueta}** ${b.texto}`))
      .join('\n\n');
  };
  for (const b of bloques) {
    if (b.campo === null) {
      informe.etiquetasDeParrafoNoLeidas[b.etiqueta] = (informe.etiquetasDeParrafoNoLeidas[b.etiqueta] ?? 0) + 1;
    }
  }

  const enunciado = juntar('enunciado');
  const tipo = juntar('tipo');
  const fuentes = juntar('fuentes');
  const paraAprender = juntar('paraAprender');
  for (const [campo, valor] of [
    ['enunciado', enunciado],
    ['tipo', tipo],
    ['paraAprender', paraAprender],
    ['fuentes', fuentes],
  ]) {
    if (valor === null) informe.camposFaltantes.push({ id, campo });
  }

  // Fuerza: tablas con una columna «fuerza» dentro del bloque de fuerza; la prosa
  // que no es tabla queda como nota.
  const bloqueFuerza = juntar('fuerza') ?? '';
  const tablasFuerza = tablas(bloqueFuerza).filter((t) => t.encabezado.some((c) => plano(c) === 'fuerza'));
  const notaFuerza = unirLineas(
    bloqueFuerza
      .split('\n')
      .filter((l) => !l.trim().startsWith('|'))
      .join('\n'),
  );
  if (tablasFuerza.length === 0) informe.entradasSinTablaDeFuerza.push(id);

  const fuerzas = [];
  for (const t of tablasFuerza) {
    const iFuerza = t.encabezado.findIndex((c) => plano(c) === 'fuerza');
    const iPorque = t.encabezado.findIndex((c) => plano(c).startsWith('porque'));
    // Primera pasada: los tipos que la tabla nombra, para expandir «todos» y «resto».
    const leidas = t.filas.map((fila) => ({ fila, lectura: leerEtiqueta(fila[0] ?? '') }));
    const nombrados = new Set(leidas.flatMap((l) => l.lectura.tipos));
    for (const { fila, lectura } of leidas) {
      const etiqueta = fila[0] ?? '';
      const texto = fila[iFuerza] ?? '';
      const porque = iPorque === -1 ? '' : (fila[iPorque] ?? '');
      let tipos = lectura.tipos;
      if (lectura.comodin) {
        tipos = lectura.comodin === 'todos' ? [...TIPOS] : TIPOS.filter((x) => !nombrados.has(x));
        informe.comodinesExpandidos.push({ id, etiqueta, comodin: lectura.comodin, tipos });
      }
      if (tipos.length === 0) informe.etiquetasSinTipo.push({ id, etiqueta });
      const { fuerzas: fz, negadas } = leerFuerzas(texto);
      if (fz.length === 0) informe.celdasSinFuerza.push({ id, etiqueta, texto });
      if (negadas.length > 0) informe.fuerzasNegadas.push({ id, etiqueta, texto, negadas });
      fuerzas.push({ etiqueta, tipos, rol: lectura.rol, fuerzas: fz, texto, porque });
    }
  }

  return {
    id,
    numero: e.numero,
    titulo: e.titulo,
    enunciado: enunciado ? unirLineas(enunciado) : '',
    tipo: tipo ? unirLineas(tipo) : '',
    posturas: juntar('posturas'),
    paraAprender: paraAprender ?? '',
    fuentes: fuentes ?? '',
    contradicciones: juntar('contradicciones'),
    notaFuerza: notaFuerza || null,
    fuerzas,
  };
}

// ---------------------------------------------------------------------------
// Estado por tema (ESTADO.md)
// ---------------------------------------------------------------------------

function leerEstados(archivo, informe) {
  const estados = new Map();
  if (!fs.existsSync(archivo)) {
    informe.avisos.push('No hay ESTADO.md: todos los temas quedan como borrador.');
    return estados;
  }
  const texto = fs.readFileSync(archivo, 'utf8').replace(/\r\n/g, '\n');
  for (const t of tablas(texto)) {
    const iPaso = t.encabezado.findIndex((c) => plano(c) === 'paso');
    if (iPaso === -1) continue;
    for (const fila of t.filas) {
      const m = (fila[0] ?? '').match(/^(\d\d)\b/);
      if (!m) continue;
      const paso = plano((fila[iPaso] ?? '').replace(/\*/g, ''));
      const estado = paso.includes('aprobado por cristobal')
        ? 'aprobado'
        : paso.includes('sintesis y verificacion hechas')
          ? 'por-revisar'
          : 'borrador';
      estados.set(m[1], estado);
    }
  }
  return estados;
}

function commitDe(carpeta) {
  try {
    return execFileSync('git', ['-C', carpeta, 'rev-parse', 'HEAD'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Principal
// ---------------------------------------------------------------------------

if (!fs.existsSync(VAULT)) {
  throw new Error(`No encuentro la Biblia en ${VAULT}. Usa --vault <carpeta> o BIBLIA_VAULT.`);
}

const informe = {
  entradas: 0,
  filas: 0,
  celdasConUnaFuerza: 0,
  celdasConVariasFuerzas: 0,
  celdasSinFuerza: [],
  etiquetasSinTipo: [],
  comodinesExpandidos: [],
  fuerzasNegadas: [],
  entradasSinTablaDeFuerza: [],
  camposFaltantes: [],
  etiquetasDeParrafoNoLeidas: {},
  temasSinEstado: [],
  avisos: [],
};

const estados = leerEstados(path.join(VAULT, 'ESTADO.md'), informe);
const archivos = fs
  .readdirSync(VAULT)
  .filter((f) => /^\d\d-.+\.md$/.test(f))
  .sort();
const temas = archivos.map((f) => leerTema(path.join(VAULT, f), estados, informe));

for (const tema of temas) {
  for (const e of tema.entradas) {
    informe.entradas++;
    for (const f of e.fuerzas) {
      informe.filas++;
      if (f.fuerzas.length === 1) informe.celdasConUnaFuerza++;
      if (f.fuerzas.length > 1) informe.celdasConVariasFuerzas++;
    }
  }
}
// Las etiquetas de párrafo no leídas, en orden estable.
informe.etiquetasDeParrafoNoLeidas = Object.fromEntries(
  Object.entries(informe.etiquetasDeParrafoNoLeidas).sort(([a], [b]) => a.localeCompare(b, 'es')),
);

const biblia = {
  fuente: {
    carpeta: path.relative(RAIZ, VAULT).split(path.sep).join('/'),
    commit: commitDe(VAULT),
    generadoEn: new Date().toISOString(),
  },
  temas,
  informe,
};

fs.mkdirSync(path.dirname(SALIDA), { recursive: true });
fs.writeFileSync(SALIDA, `${JSON.stringify(biblia, null, 2)}\n`);

// Resumen
const pct = (n) => (informe.filas === 0 ? '0' : ((100 * n) / informe.filas).toFixed(1).replace('.', ','));
const etiquetasSinTipoUnicas = [...new Set(informe.etiquetasSinTipo.map((e) => e.etiqueta))];
const kb = Math.round(fs.statSync(SALIDA).size / 1024);
console.log(`Biblia compilada → ${path.relative(RAIZ, SALIDA)} (${kb} KB)`);
console.log(`  fuente: ${biblia.fuente.carpeta} @ ${biblia.fuente.commit ?? '(sin git)'}`);
console.log(
  `  temas: ${temas.length} (${temas.map((t) => `${t.numero} ${t.estado}`).join(', ')})`,
);
console.log(`  entradas: ${informe.entradas}; filas de fuerza: ${informe.filas}`);
console.log(
  `  celdas con una sola fuerza: ${informe.celdasConUnaFuerza} (${pct(informe.celdasConUnaFuerza)} %); con varias: ${informe.celdasConVariasFuerzas} (${pct(informe.celdasConVariasFuerzas)} %); sin fuerza: ${informe.celdasSinFuerza.length} (${pct(informe.celdasSinFuerza.length)} %)`,
);
console.log(`  entradas sin tabla de fuerza: ${informe.entradasSinTablaDeFuerza.length} (${informe.entradasSinTablaDeFuerza.join(', ')})`);
console.log(`  «todos»/«resto» expandidos: ${informe.comodinesExpandidos.length}; fuerzas negadas descartadas: ${informe.fuerzasNegadas.length}`);
console.log(`  campos faltantes: ${informe.camposFaltantes.length}`);
console.log(`  etiquetas sin tipo reconocido: ${informe.etiquetasSinTipo.length} filas, ${etiquetasSinTipoUnicas.length} distintas`);
for (const e of etiquetasSinTipoUnicas) console.log(`    - ${e}`);
if (informe.avisos.length > 0) for (const a of informe.avisos) console.log(`  aviso: ${a}`);
