/**
 * Inicio de sesión OAuth con PKCE contra OpenAI (la suscripción de ChatGPT que
 * también usa Codex CLI) para el proceso principal de Electron.
 *
 * Este módulo no importa `electron`: la aplicación le pasa `shell.openExternal`
 * como `abrirNavegador`. Sólo usa módulos de Node y el `fetch` global, y todas
 * las funciones que salen a la red reciben un `fetch` inyectable para poder
 * probarlas sin red.
 */

import { createHash, randomBytes } from 'node:crypto';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

/** Datos públicos del flujo de Codex CLI. */
const CLIENT_ID = 'app_EMoamEEZ73f0CkXaXp7hrann';
const URL_AUTORIZACION = 'https://auth.openai.com/oauth/authorize';
const URL_TOKEN = 'https://auth.openai.com/oauth/token';
const SCOPE = 'openid profile email offline_access';
const RUTA_CALLBACK = '/auth/callback';
const PUERTO_POR_OMISION = 1455;
const MS_ESPERA_CALLBACK = 120_000;
const MS_MARGEN_REFRESCO = 5 * 60_000;
const CLAVE_AUTH_OPENAI = 'https://api.openai.com/auth';

// --- Utilidades compartidas -------------------------------------------------

function esObjeto(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor);
}

function textoRequerido(valor: unknown, nombre: string): string {
  if (typeof valor !== 'string' || valor.trim().length === 0) {
    throw new Error(`La respuesta de OpenAI no trae «${nombre}».`);
  }
  return valor;
}

/** Error de la llamada a `/oauth/token`, con el código HTTP para distinguir casos. */
class ErrorDeToken extends Error {
  readonly estado: number;

  constructor(mensaje: string, estado: number) {
    super(mensaje);
    this.name = 'ErrorDeToken';
    this.estado = estado;
  }
}

async function pedirToken(cuerpo: URLSearchParams, fetchFn: typeof fetch): Promise<unknown> {
  const respuesta = await fetchFn(URL_TOKEN, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: cuerpo.toString(),
  });
  if (!respuesta.ok) {
    throw new ErrorDeToken(
      `OpenAI rechazó la solicitud de tokens (HTTP ${respuesta.status}). Puede que la sesión haya caducado: vuelve a iniciar sesión.`,
      respuesta.status,
    );
  }
  const json: unknown = await respuesta.json();
  return json;
}

// --- PKCE y URL de autorización ---------------------------------------------

export interface Pkce {
  verifier: string;
  challenge: string;
}

/** verifier = 32 bytes aleatorios en base64url; challenge = sha256(verifier) en base64url. */
export function generarPkce(): Pkce {
  const verifier = randomBytes(32).toString('base64url');
  const challenge = createHash('sha256').update(verifier).digest('base64url');
  return { verifier, challenge };
}

export function urlDeAutorizacion(opts: { redirectUri: string; state: string; challenge: string }): string {
  const parametros = new URLSearchParams({
    response_type: 'code',
    client_id: CLIENT_ID,
    redirect_uri: opts.redirectUri,
    scope: SCOPE,
    code_challenge: opts.challenge,
    code_challenge_method: 'S256',
    state: opts.state,
    codex_cli_simplified_flow: 'true',
    originator: 'contope-design',
    id_token_add_organizations: 'true',
  });
  return `${URL_AUTORIZACION}?${parametros.toString()}`;
}

// --- Tokens -----------------------------------------------------------------

export interface Tokens {
  accessToken: string;
  refreshToken: string;
  idToken: string;
  /** Vencimiento del access token, en milisegundos desde el epoch. */
  expiraEn: number;
  cuentaId: string | null;
  email: string | null;
}

/** Lee los claims del `id_token` (segunda parte del JWT). No valida la firma. */
export function claimsDeJwt(jwt: string): Record<string, unknown> | null {
  const partes = jwt.split('.');
  const cuerpo = partes[1];
  if (cuerpo === undefined || cuerpo.length === 0) return null;
  try {
    const texto = Buffer.from(cuerpo, 'base64url').toString('utf8');
    const json: unknown = JSON.parse(texto);
    if (!esObjeto(json)) return null;
    return json;
  } catch {
    return null;
  }
}

function cuentaDeClaims(claims: Record<string, unknown>): string | null {
  const auth = claims[CLAVE_AUTH_OPENAI];
  if (esObjeto(auth)) {
    const id = auth['chatgpt_account_id'];
    if (typeof id === 'string' && id.length > 0) return id;
  }
  const directo = claims['chatgpt_account_id'];
  if (typeof directo === 'string' && directo.length > 0) return directo;
  return null;
}

function correoDeClaims(claims: Record<string, unknown>): string | null {
  const correo = claims['email'];
  return typeof correo === 'string' && correo.length > 0 ? correo : null;
}

/**
 * Convierte la respuesta JSON de `/oauth/token` en `Tokens`.
 * Si no viene `refresh_token` se conserva `refreshAnterior` (el refresco suele
 * no devolver uno nuevo). Lanza Error con mensaje claro si falta algo esencial.
 */
export function tokensDeRespuesta(json: unknown, refreshAnterior: string | null, ahora: number = Date.now()): Tokens {
  if (!esObjeto(json)) {
    throw new Error('La respuesta de OpenAI no es un objeto JSON válido.');
  }

  const accessToken = textoRequerido(json['access_token'], 'access_token');
  const idToken = textoRequerido(json['id_token'], 'id_token');

  const refreshNuevo = json['refresh_token'];
  const refreshToken =
    typeof refreshNuevo === 'string' && refreshNuevo.length > 0 ? refreshNuevo : refreshAnterior;
  if (refreshToken === null || refreshToken.length === 0) {
    throw new Error('La respuesta de OpenAI no trae «refresh_token» y no había uno anterior que conservar.');
  }

  const segundos = json['expires_in'];
  if (typeof segundos !== 'number' || !Number.isFinite(segundos) || segundos <= 0) {
    throw new Error('La respuesta de OpenAI no trae un «expires_in» válido (segundos).');
  }

  const claims = claimsDeJwt(idToken);
  const cuentaId = claims === null ? null : cuentaDeClaims(claims);
  const email = claims === null ? null : correoDeClaims(claims);

  return {
    accessToken,
    refreshToken,
    idToken,
    expiraEn: ahora + Math.round(segundos * 1000),
    cuentaId,
    email,
  };
}

/** Canjea el código de autorización por tokens. */
export async function intercambiarCodigo(
  codigo: string,
  verifier: string,
  redirectUri: string,
  fetchFn: typeof fetch = fetch,
): Promise<Tokens> {
  const cuerpo = new URLSearchParams({
    grant_type: 'authorization_code',
    code: codigo,
    redirect_uri: redirectUri,
    client_id: CLIENT_ID,
    code_verifier: verifier,
  });
  const json = await pedirToken(cuerpo, fetchFn);
  return tokensDeRespuesta(json, null);
}

/** Renueva los tokens con el refresh token; conserva el anterior si no viene uno nuevo. */
export async function refrescar(refreshToken: string, fetchFn: typeof fetch = fetch): Promise<Tokens> {
  const cuerpo = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    client_id: CLIENT_ID,
  });
  const json = await pedirToken(cuerpo, fetchFn);
  return tokensDeRespuesta(json, refreshToken);
}

// --- Servidor local de callback ---------------------------------------------

export interface ServidorDeCallback {
  redirectUri: string;
  esperarCodigo(stateEsperado: string): Promise<string>;
  cerrar(): void;
}

interface Espera {
  state: string;
  resolver: (codigo: string) => void;
  rechazar: (error: Error) => void;
  temporizador: ReturnType<typeof setTimeout>;
}

interface ServidorCerrable {
  closeIdleConnections?: () => void;
}

function mensajeDePuerto(error: Error, puerto: number): string {
  const codigo = (error as { code?: unknown }).code;
  if (codigo === 'EADDRINUSE') {
    return `El puerto ${puerto} ya está ocupado. Cierra el programa que lo usa (por ejemplo, Codex CLI) y vuelve a intentar el inicio de sesión.`;
  }
  return `No se pudo abrir el servidor local de inicio de sesión en el puerto ${puerto}.`;
}

function paginaDeRespuesta(exito: boolean, titulo: string, detalle: string): string {
  const color = exito ? '#0f5132' : '#842029';
  return `<!doctype html>
<html lang="es-CL">
  <head>
    <meta charset="utf-8" />
    <title>${titulo} · ContOpe Design</title>
  </head>
  <body style="font-family: system-ui, sans-serif; margin: 4rem auto; max-width: 34rem; color: #1a1a1a;">
    <h1 style="color: ${color};">${titulo}</h1>
    <p>${detalle}</p>
  </body>
</html>
`;
}

/**
 * Abre un servidor HTTP local que atiende `GET /auth/callback`.
 * Se escucha en todas las interfaces para que sirvan tanto `localhost` (IPv6)
 * como `127.0.0.1`; el `state` aleatorio es lo que protege el flujo.
 */
export function abrirServidorDeCallback(puerto: number = PUERTO_POR_OMISION): Promise<ServidorDeCallback> {
  return new Promise<ServidorDeCallback>((resolver, rechazar) => {
    let escuchando = false;
    let cerrado = false;
    let puertoReal = puerto;
    let espera: Espera | null = null;

    const servidor: Server = createServer((peticion, respuesta) => {
      atender(peticion, respuesta);
    });

    const fallarEspera = (error: Error): void => {
      if (espera === null) return;
      const pendiente = espera;
      espera = null;
      clearTimeout(pendiente.temporizador);
      pendiente.rechazar(error);
    };

    const cerrarServidor = (): void => {
      fallarEspera(new Error('Se cerró el servidor de inicio de sesión antes de recibir el código.'));
      if (cerrado) return;
      cerrado = true;
      if (servidor.listening) servidor.close();
      (servidor as unknown as ServidorCerrable).closeIdleConnections?.();
    };

    const responder = (
      respuesta: ServerResponse,
      estado: number,
      titulo: string,
      detalle: string,
      alTerminar: (() => void) | null = null,
    ): void => {
      const html = paginaDeRespuesta(estado === 200, titulo, detalle);
      respuesta.writeHead(estado, {
        'content-type': 'text/html; charset=utf-8',
        'content-length': Buffer.byteLength(html),
      });
      if (alTerminar === null) respuesta.end(html);
      else respuesta.end(html, alTerminar);
    };

    const atender = (peticion: IncomingMessage, respuesta: ServerResponse): void => {
      const url = new URL(peticion.url ?? '/', `http://127.0.0.1:${puertoReal}`);
      if (peticion.method !== 'GET' || url.pathname !== RUTA_CALLBACK) {
        responder(respuesta, 404, 'Dirección no válida', 'Esta dirección no corresponde al inicio de sesión de ContOpe Design.');
        return;
      }

      const error = url.searchParams.get('error');
      if (error !== null) {
        fallarEspera(new Error(`OpenAI rechazó la autorización: ${error}.`));
        responder(
          respuesta,
          400,
          'No se pudo iniciar sesión',
          `OpenAI respondió con un error: ${error}. Puedes cerrar esta ventana y volver a ContOpe Design.`,
          cerrarServidor,
        );
        return;
      }

      const codigo = url.searchParams.get('code');
      const state = url.searchParams.get('state');
      const pendiente = espera;

      if (codigo === null || codigo.length === 0) {
        fallarEspera(new Error('La respuesta de OpenAI no trajo el código de autorización.'));
        responder(
          respuesta,
          400,
          'No se pudo iniciar sesión',
          'La respuesta no traía el código de autorización. Puedes cerrar esta ventana y volver a ContOpe Design.',
          cerrarServidor,
        );
        return;
      }

      if (pendiente === null || state !== pendiente.state) {
        fallarEspera(new Error('El parámetro «state» no calza con la sesión que se inició.'));
        responder(
          respuesta,
          400,
          'No se pudo iniciar sesión',
          'La respuesta no corresponde a esta sesión. Puedes cerrar esta ventana y volver a ContOpe Design.',
          cerrarServidor,
        );
        return;
      }

      espera = null;
      clearTimeout(pendiente.temporizador);
      responder(
        respuesta,
        200,
        'Sesión iniciada',
        'Sesión iniciada. Puedes cerrar esta ventana y volver a ContOpe Design.',
        cerrarServidor,
      );
      pendiente.resolver(codigo);
    };

    const esperarCodigo = (stateEsperado: string): Promise<string> => {
      if (cerrado) {
        return Promise.reject(new Error('El servidor de inicio de sesión ya se cerró.'));
      }
      if (espera !== null) {
        return Promise.reject(new Error('Ya hay una espera de código en curso en este servidor.'));
      }
      return new Promise<string>((resolverEspera, rechazarEspera) => {
        const temporizador = setTimeout(() => {
          espera = null;
          rechazarEspera(
            new Error('Se agotó el tiempo de espera (2 minutos) para completar el inicio de sesión. Vuelve a intentarlo.'),
          );
          cerrarServidor();
        }, MS_ESPERA_CALLBACK);
        espera = { state: stateEsperado, resolver: resolverEspera, rechazar: rechazarEspera, temporizador };
      });
    };

    servidor.on('error', (error: Error) => {
      if (!escuchando) {
        rechazar(new Error(mensajeDePuerto(error, puerto)));
        return;
      }
      cerrarServidor();
    });

    servidor.listen(puerto, () => {
      escuchando = true;
      const direccion = servidor.address();
      if (typeof direccion === 'object' && direccion !== null) puertoReal = direccion.port;
      resolver({
        redirectUri: `http://localhost:${puertoReal}${RUTA_CALLBACK}`,
        esperarCodigo,
        cerrar: cerrarServidor,
      });
    });
  });
}

// --- Almacén en disco -------------------------------------------------------

export interface AlmacenDeSesionCodex {
  leer(): Promise<Tokens | null>;
  guardar(tokens: Tokens): Promise<void>;
  borrar(): Promise<void>;
  /** Devuelve tokens vigentes (refrescando si hace falta y guardando el resultado); null si no hay sesión. */
  vigentes(): Promise<Tokens | null>;
}

function textoPlano(valor: unknown): string | null {
  return typeof valor === 'string' && valor.length > 0 ? valor : null;
}

/** null = ausente/vacío; undefined = presente pero con forma inválida. */
function textoAnulable(valor: unknown): string | null | undefined {
  if (valor === null || valor === undefined) return null;
  if (typeof valor !== 'string') return undefined;
  return valor.length > 0 ? valor : null;
}

function validarTokens(valor: unknown): Tokens | null {
  if (!esObjeto(valor)) return null;

  const accessToken = textoPlano(valor['accessToken']);
  const refreshToken = textoPlano(valor['refreshToken']);
  const idToken = textoPlano(valor['idToken']);
  if (accessToken === null || refreshToken === null || idToken === null) return null;

  const expiraEn = valor['expiraEn'];
  if (typeof expiraEn !== 'number' || !Number.isFinite(expiraEn) || expiraEn <= 0) return null;

  const cuentaId = textoAnulable(valor['cuentaId']);
  const email = textoAnulable(valor['email']);
  if (cuentaId === undefined || email === undefined) return null;

  return { accessToken, refreshToken, idToken, expiraEn, cuentaId, email };
}

/** Almacén en disco (JSON) con refresco automático 5 minutos antes de expirar. */
export function almacenDeSesionCodex(
  rutaArchivo: string,
  opciones?: { fetchFn?: typeof fetch; ahora?: () => number },
): AlmacenDeSesionCodex {
  const fetchFn = opciones?.fetchFn ?? fetch;
  const ahora = opciones?.ahora ?? ((): number => Date.now());

  const leer = async (): Promise<Tokens | null> => {
    let crudo: string;
    try {
      crudo = await readFile(rutaArchivo, 'utf8');
    } catch {
      return null;
    }
    let json: unknown;
    try {
      json = JSON.parse(crudo);
    } catch {
      return null;
    }
    return validarTokens(json);
  };

  const guardar = async (tokens: Tokens): Promise<void> => {
    await mkdir(dirname(rutaArchivo), { recursive: true });
    const temporal = `${rutaArchivo}.${randomBytes(6).toString('hex')}.tmp`;
    await writeFile(temporal, `${JSON.stringify(tokens, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
    try {
      await rename(temporal, rutaArchivo);
    } catch (error) {
      await rm(temporal, { force: true });
      throw error;
    }
  };

  const borrar = async (): Promise<void> => {
    await rm(rutaArchivo, { force: true });
  };

  const vigentes = async (): Promise<Tokens | null> => {
    const tokens = await leer();
    if (tokens === null) return null;
    if (tokens.expiraEn - ahora() > MS_MARGEN_REFRESCO) return tokens;

    try {
      const nuevos = await refrescar(tokens.refreshToken, fetchFn);
      await guardar(nuevos);
      return nuevos;
    } catch (error) {
      // El refresh token ya no sirve (4xx): la sesión está muerta, se borra y
      // se responde null para que la app ofrezca iniciar sesión de nuevo.
      if (error instanceof ErrorDeToken && error.estado >= 400 && error.estado < 500) {
        await borrar();
        return null;
      }
      throw error;
    }
  };

  return { leer, guardar, borrar, vigentes };
}

// --- Flujo completo ---------------------------------------------------------

/**
 * Flujo completo para el proceso principal: abre el servidor local, arma la URL
 * de autorización, se la pasa a `abrirNavegador` (la app usa `shell.openExternal`),
 * espera el código, lo canjea y guarda los tokens.
 */
export async function iniciarSesionCodex(
  almacen: AlmacenDeSesionCodex,
  abrirNavegador: (url: string) => Promise<void> | void,
  fetchFn: typeof fetch = fetch,
): Promise<Tokens> {
  const servidor = await abrirServidorDeCallback();
  try {
    const { verifier, challenge } = generarPkce();
    const state = randomBytes(32).toString('base64url');
    const url = urlDeAutorizacion({ redirectUri: servidor.redirectUri, state, challenge });
    const esperaDelCodigo = servidor.esperarCodigo(state);
    await abrirNavegador(url);
    const codigo = await esperaDelCodigo;
    const tokens = await intercambiarCodigo(codigo, verifier, servidor.redirectUri, fetchFn);
    await almacen.guardar(tokens);
    return tokens;
  } finally {
    servidor.cerrar();
  }
}
