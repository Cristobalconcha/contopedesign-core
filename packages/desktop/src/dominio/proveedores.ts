/**
 * Los proveedores de IA del taller.
 *
 * La IA que resuelve los encargos vive DENTRO de la aplicación (Cristóbal,
 * 19-09-2026), con un proveedor que la persona elige y configura: Claude (con
 * clave de API o con el token OAuth de una sesión de Claude Code), ChatGPT /
 * Codex (con la sesión de la cuenta de ChatGPT), o cualquier servicio
 * compatible con la API de OpenAI (DeepSeek, Z.ai, un Ollama local).
 *
 * Este módulo es la parte PURA: qué forma tiene la configuración que se
 * guarda en disco, cómo se valida al leerla, cómo se arma la petición HTTP de
 * cada clase de API y cómo se saca el texto de la respuesta. Acá no hay red,
 * ni Electron, ni React: el proceso principal es el único que tiene el
 * secreto, y este módulo sólo decide qué se manda y qué se lee.
 *
 * El secreto NUNCA se guarda acá: en el archivo va la clase de credencial y, a
 * lo más, una máscara para mostrar (`sk-ant-***hijk`). El secreto real lo
 * guarda Electron aparte (llavero del sistema) y no entra a un `.contope.json`.
 */
export type ClaseDeProveedor = 'anthropic' | 'openai-chat' | 'codex';

export interface Proveedor {
  /** Estable; lo pone la app al crear el proveedor (`prov-…`). */
  id: string;
  /** «Claude», «ChatGPT (Codex)», «DeepSeek»: lo que la persona escriba. */
  nombre: string;
  clase: ClaseDeProveedor;
  /**
   * anthropic: 'https://api.anthropic.com'; openai-chat: la base con `/v1`
   * (DeepSeek: 'https://api.deepseek.com/v1'); codex:
   * 'https://chatgpt.com/backend-api'.
   */
  baseUrl: string;
  /** Id del modelo, ej. 'claude-sonnet-5', 'deepseek-v4-pro', 'gpt-5.5'. */
  modelo: string;
  /**
   * Cómo se autentica: clave de API, token OAuth de Claude Code
   * (`sk-ant-oat…`), o la sesión de Codex (la guarda Electron aparte).
   */
  credencial: 'clave' | 'token-claude' | 'sesion-codex' | 'ninguna';
  /** Sólo para mostrar: 'sk-ant-***xyz9'. El secreto real NUNCA está acá. */
  mascara?: string;
  creadoEn: string;
}

export interface ConfiguracionDeIA {
  schemaVersion: 1;
  proveedores: Proveedor[];
  /** Id del proveedor que usa la IA del taller; null = ninguno configurado. */
  activo: string | null;
}

export interface Mensajes {
  sistema: string;
  usuario: string;
}

export interface Peticion {
  url: string;
  headers: Record<string, string>;
  body: string;
}

const MAX_TOKENS_POR_OMISION = 8000;

/** Claves que jamás se aceptan como id: romperían los mapas del taller. */
const CLAVES_RESERVADAS: ReadonlySet<string> = new Set(['__proto__', 'constructor', 'prototype']);

const CLASES: readonly ClaseDeProveedor[] = ['anthropic', 'openai-chat', 'codex'];

const CREDENCIALES: readonly Proveedor['credencial'][] = ['clave', 'token-claude', 'sesion-codex', 'ninguna'];

function esRecord(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor);
}

function esClase(valor: unknown): valor is ClaseDeProveedor {
  return typeof valor === 'string' && (CLASES as readonly string[]).includes(valor);
}

function esCredencial(valor: unknown): valor is Proveedor['credencial'] {
  return typeof valor === 'string' && (CREDENCIALES as readonly string[]).includes(valor);
}

/** Un texto de verdad, o nada: la cadena vacía no es una credencial. */
function textoPresente(valor: string | undefined): string | undefined {
  return valor === undefined || valor === '' ? undefined : valor;
}

export function configuracionVacia(): ConfiguracionDeIA {
  return { schemaVersion: 1, proveedores: [], activo: null };
}

/**
 * Valida en la frontera (el archivo en disco): forma inesperada, configuración
 * rechazada entera con el motivo. Un `activo` que no está entre los
 * proveedores no rechaza: se lee como «ninguno» (`null`), que es lo que la
 * persona ve cuando borra un proveedor a mano.
 */
export function validarConfiguracion(valor: unknown): { ok: true; configuracion: ConfiguracionDeIA } | { ok: false; motivo: string } {
  if (!esRecord(valor)) return { ok: false, motivo: 'la configuración de IA no es un objeto' };
  if (valor['schemaVersion'] !== 1) {
    return { ok: false, motivo: `versión de configuración de IA desconocida: ${String(valor['schemaVersion'])}` };
  }
  const crudos = valor['proveedores'];
  if (!Array.isArray(crudos)) return { ok: false, motivo: "'proveedores' debe ser una lista" };
  const lista: unknown[] = crudos;
  const proveedores: Proveedor[] = [];
  const ids = new Set<string>();
  for (const [i, crudo] of lista.entries()) {
    const n = i + 1;
    if (!esRecord(crudo)) return { ok: false, motivo: `el proveedor ${n} no es un objeto` };
    const id = crudo['id'];
    if (typeof id !== 'string' || id === '') return { ok: false, motivo: `el proveedor ${n} no tiene id` };
    if (CLAVES_RESERVADAS.has(id)) return { ok: false, motivo: `el id del proveedor ${n} usa una clave reservada: ${id}` };
    if (ids.has(id)) return { ok: false, motivo: `hay dos proveedores con el mismo id: ${id}` };
    ids.add(id);
    const nombre = crudo['nombre'];
    if (typeof nombre !== 'string' || nombre === '') return { ok: false, motivo: `el proveedor ${n} no tiene nombre` };
    const clase = crudo['clase'];
    if (!esClase(clase)) return { ok: false, motivo: `el proveedor ${n} usa una clase de API desconocida: ${String(clase)}` };
    const baseUrl = crudo['baseUrl'];
    if (typeof baseUrl !== 'string' || baseUrl === '') return { ok: false, motivo: `el proveedor ${n} no tiene baseUrl` };
    const modelo = crudo['modelo'];
    if (typeof modelo !== 'string' || modelo === '') return { ok: false, motivo: `el proveedor ${n} no tiene modelo` };
    const credencial = crudo['credencial'];
    if (!esCredencial(credencial)) {
      return { ok: false, motivo: `el proveedor ${n} usa una credencial desconocida: ${String(credencial)}` };
    }
    const creadoEn = crudo['creadoEn'];
    if (typeof creadoEn !== 'string' || creadoEn === '') return { ok: false, motivo: `el proveedor ${n} no dice cuándo se creó` };
    const mascara = crudo['mascara'];
    if (mascara !== undefined && typeof mascara !== 'string') {
      return { ok: false, motivo: `la máscara del proveedor ${n} debe ser texto` };
    }
    proveedores.push({
      id,
      nombre,
      clase,
      baseUrl,
      modelo,
      credencial,
      ...(typeof mascara === 'string' ? { mascara } : {}),
      creadoEn,
    });
  }
  const activoCrudo = valor['activo'];
  if (activoCrudo !== null && activoCrudo !== undefined && typeof activoCrudo !== 'string') {
    return { ok: false, motivo: "'activo' debe ser el id de un proveedor o null" };
  }
  const activo = typeof activoCrudo === 'string' && ids.has(activoCrudo) ? activoCrudo : null;
  return { ok: true, configuracion: { schemaVersion: 1, proveedores, activo } };
}

/**
 * La única parte del secreto que se muestra: la familia de la clave (hasta el
 * segundo guion: `sk-ant-`) y los últimos cuatro caracteres. Un secreto muy
 * corto no se muestra nunca: no alcanza para reconocerlo sin filtrarlo.
 */
export function mascaraDe(secreto: string): string {
  if (secreto.length < 8) return '***';
  const primero = secreto.indexOf('-');
  const segundo = primero === -1 ? -1 : secreto.indexOf('-', primero + 1);
  const corte = segundo !== -1 ? segundo : primero;
  const prefijo = corte === -1 ? '' : secreto.slice(0, corte + 1);
  return `${prefijo}***${secreto.slice(-4)}`;
}

/** Los preajustes que la pantalla ofrece para crear un proveedor con un clic. */
export const PREAJUSTES: ReadonlyArray<{
  nombre: string;
  clase: ClaseDeProveedor;
  baseUrl: string;
  modelo: string;
  credencial: Proveedor['credencial'];
  nota: string;
}> = [
  {
    nombre: 'Claude',
    clase: 'anthropic',
    baseUrl: 'https://api.anthropic.com',
    modelo: 'claude-sonnet-5',
    credencial: 'clave',
    nota: 'clave de API de Anthropic',
  },
  {
    nombre: 'Claude (Claude Code)',
    clase: 'anthropic',
    baseUrl: 'https://api.anthropic.com',
    modelo: 'claude-sonnet-5',
    credencial: 'token-claude',
    nota: 'token OAuth sk-ant-oat… de una sesión de Claude Code',
  },
  {
    nombre: 'ChatGPT / Codex',
    clase: 'codex',
    baseUrl: 'https://chatgpt.com/backend-api',
    modelo: 'gpt-5.5',
    credencial: 'sesion-codex',
    nota: 'inicia sesión con tu cuenta de ChatGPT',
  },
  {
    nombre: 'DeepSeek',
    clase: 'openai-chat',
    baseUrl: 'https://api.deepseek.com/v1',
    modelo: 'deepseek-v4-pro',
    credencial: 'clave',
    nota: 'clave de API de DeepSeek',
  },
  {
    nombre: 'Z.ai',
    clase: 'openai-chat',
    baseUrl: 'https://api.z.ai/api/paas/v4',
    modelo: 'glm-5.3',
    credencial: 'clave',
    nota: 'clave de API de Z.ai',
  },
  {
    nombre: 'Ollama local',
    clase: 'openai-chat',
    baseUrl: 'http://localhost:11434/v1',
    modelo: 'llama3.2',
    credencial: 'ninguna',
    nota: 'sin credencial: Ollama corre en tu equipo',
  },
];

/**
 * Arma la petición HTTP para pedirle al modelo una respuesta de texto. Sin
 * streaming, salvo codex (su API lo exige): la respuesta llega como SSE y la
 * lee `textoDeRespuesta`. `baseUrl` se normaliza sin barra final.
 */
export function peticionDe(
  proveedor: Proveedor,
  mensajes: Mensajes,
  opciones: { secreto?: string; cuentaId?: string; maxTokens?: number },
): Peticion {
  const base = proveedor.baseUrl.replace(/\/+$/, '');
  const maxTokens = opciones.maxTokens ?? MAX_TOKENS_POR_OMISION;
  const secreto = textoPresente(opciones.secreto);
  const cuentaId = textoPresente(opciones.cuentaId);

  if (proveedor.clase === 'anthropic') {
    const headers: Record<string, string> = {
      'content-type': 'application/json',
      'anthropic-version': '2023-06-01',
    };
    if (proveedor.credencial === 'token-claude') {
      // Así lo exige la API para tokens de Claude Code: se presenta como el CLI.
      headers['anthropic-beta'] = 'oauth-2025-04-20,claude-code-20250219';
      headers['user-agent'] = 'claude-cli/2.1.75';
      headers['x-app'] = 'cli';
      if (secreto !== undefined) headers['authorization'] = `Bearer ${secreto}`;
    } else if (secreto !== undefined) {
      headers['x-api-key'] = secreto;
    }
    const body = {
      model: proveedor.modelo,
      max_tokens: maxTokens,
      system: mensajes.sistema,
      messages: [{ role: 'user', content: mensajes.usuario }],
    };
    return { url: `${base}/v1/messages`, headers, body: JSON.stringify(body) };
  }

  if (proveedor.clase === 'openai-chat') {
    const headers: Record<string, string> = { 'content-type': 'application/json' };
    if (secreto !== undefined) headers['authorization'] = `Bearer ${secreto}`;
    const body = {
      model: proveedor.modelo,
      max_tokens: maxTokens,
      messages: [
        { role: 'system', content: mensajes.sistema },
        { role: 'user', content: mensajes.usuario },
      ],
    };
    return { url: `${base}/chat/completions`, headers, body: JSON.stringify(body) };
  }

  const headers: Record<string, string> = {
    'content-type': 'application/json',
    originator: 'contope-design',
    'openai-beta': 'responses=experimental',
  };
  if (secreto !== undefined) headers['authorization'] = `Bearer ${secreto}`;
  if (cuentaId !== undefined) headers['chatgpt-account-id'] = cuentaId;
  const body = {
    model: proveedor.modelo,
    instructions: mensajes.sistema,
    input: [{ role: 'user', content: [{ type: 'input_text', text: mensajes.usuario }] }],
    store: false,
    stream: true,
  };
  return { url: `${base}/codex/responses`, headers, body: JSON.stringify(body) };
}

/** Los primeros 200 caracteres del cuerpo, para que el motivo sea útil. */
function recorte(cuerpo: string): string {
  const limpio = cuerpo.trim();
  return limpio.length > 200 ? `${limpio.slice(0, 200)}…` : limpio;
}

function noSePudoLeer(cuerpo: string, detalle: string): { ok: false; motivo: string } {
  const trozo = recorte(cuerpo);
  return { ok: false, motivo: trozo === '' ? detalle : `${detalle} (cuerpo: ${trozo})` };
}

function leeJson(cuerpo: string): Record<string, unknown> | undefined {
  try {
    const valor: unknown = JSON.parse(cuerpo);
    return esRecord(valor) ? valor : undefined;
  } catch {
    return undefined;
  }
}

function textoDeAnthropic(cuerpo: string): { ok: true; texto: string } | { ok: false; motivo: string } {
  const valor = leeJson(cuerpo);
  if (valor === undefined) return noSePudoLeer(cuerpo, 'la respuesta de Anthropic no es JSON');
  const crudo = valor['content'];
  if (!Array.isArray(crudo)) return noSePudoLeer(cuerpo, "la respuesta de Anthropic no trae 'content'");
  const bloques: unknown[] = crudo;
  const textos: string[] = [];
  for (const bloque of bloques) {
    if (!esRecord(bloque)) continue;
    if (bloque['type'] !== 'text') continue;
    const texto = bloque['text'];
    if (typeof texto === 'string') textos.push(texto);
  }
  if (textos.length === 0) return noSePudoLeer(cuerpo, 'la respuesta de Anthropic no trae ningún bloque de texto');
  return { ok: true, texto: textos.join('') };
}

function textoDeOpenAi(cuerpo: string): { ok: true; texto: string } | { ok: false; motivo: string } {
  const valor = leeJson(cuerpo);
  if (valor === undefined) return noSePudoLeer(cuerpo, 'la respuesta del proveedor no es JSON');
  const crudo = valor['choices'];
  if (Array.isArray(crudo)) {
    const elecciones: unknown[] = crudo;
    const primera = elecciones[0];
    if (esRecord(primera)) {
      const mensaje = primera['message'];
      if (esRecord(mensaje)) {
        const contenido = mensaje['content'];
        if (typeof contenido === 'string') return { ok: true, texto: contenido };
      }
    }
  }
  const error = valor['error'];
  if (esRecord(error)) {
    const detalle = error['message'];
    if (typeof detalle === 'string') return noSePudoLeer(cuerpo, `el proveedor respondió con un error: ${detalle}`);
  }
  return noSePudoLeer(cuerpo, 'la respuesta no trae texto en choices[0].message.content');
}

/** El texto de un evento `response.completed` de Codex (o de la respuesta pelada). */
function textoDeCompletado(evento: Record<string, unknown>): string | undefined {
  const respuesta = esRecord(evento['response']) ? evento['response'] : evento;
  const crudo = respuesta['output'];
  if (!Array.isArray(crudo)) return undefined;
  const items: unknown[] = crudo;
  const textos: string[] = [];
  for (const item of items) {
    if (!esRecord(item)) continue;
    const contenido = item['content'];
    if (!Array.isArray(contenido)) continue;
    const bloques: unknown[] = contenido;
    for (const bloque of bloques) {
      if (!esRecord(bloque)) continue;
      const texto = bloque['text'];
      if (typeof texto === 'string') textos.push(texto);
    }
  }
  return textos.length === 0 ? undefined : textos.join('');
}

function textoDeCodex(cuerpo: string): { ok: true; texto: string } | { ok: false; motivo: string } {
  let acumulado = '';
  let completado: Record<string, unknown> | undefined;
  for (const linea of cuerpo.split(/\r?\n/)) {
    const limpia = linea.trim();
    if (!limpia.startsWith('data:')) continue;
    const dato = limpia.slice('data:'.length).trim();
    if (dato === '' || dato === '[DONE]') continue;
    let evento: unknown;
    try {
      evento = JSON.parse(dato);
    } catch {
      continue;
    }
    if (!esRecord(evento)) continue;
    const tipo = evento['type'];
    if (tipo === 'response.output_text.delta') {
      const delta = evento['delta'];
      if (typeof delta === 'string') acumulado += delta;
      continue;
    }
    if (tipo === 'response.completed') completado = evento;
  }
  if (acumulado !== '') return { ok: true, texto: acumulado };
  if (completado !== undefined) {
    const texto = textoDeCompletado(completado);
    if (texto !== undefined) return { ok: true, texto };
  }
  return noSePudoLeer(cuerpo, 'no se encontró texto en la respuesta de Codex');
}

/** Saca el texto de la respuesta cruda de cada clase de API. */
export function textoDeRespuesta(clase: ClaseDeProveedor, cuerpo: string): { ok: true; texto: string } | { ok: false; motivo: string } {
  if (clase === 'anthropic') return textoDeAnthropic(cuerpo);
  if (clase === 'openai-chat') return textoDeOpenAi(cuerpo);
  return textoDeCodex(cuerpo);
}

/** Mensaje legible para un estado HTTP de error, con el cuerpo recortado. */
export function motivoDeHttp(estado: number, cuerpo: string): string {
  let base: string;
  if (estado === 401 || estado === 403) base = 'el proveedor rechazó la credencial';
  else if (estado === 429) base = 'límite de uso del proveedor';
  else if (estado >= 500 && estado <= 599) base = 'el proveedor falló (5xx)';
  else base = `respuesta HTTP ${estado}`;
  const trozo = recorte(cuerpo);
  return trozo === '' ? base : `${base}: ${trozo}`;
}

/** Un id estable para un proveedor nuevo (`prov-<tiempo>-<azar>`). */
export function nuevoIdDeProveedor(): string {
  return `prov-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
