import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  abrirServidorDeCallback,
  almacenDeSesionCodex,
  claimsDeJwt,
  generarPkce,
  intercambiarCodigo,
  refrescar,
  tokensDeRespuesta,
  urlDeAutorizacion,
  type Tokens,
} from './codex-oauth.js';

type Fetch = typeof fetch;

interface Llamada {
  url: string;
  metodo: string;
  cuerpo: URLSearchParams;
  tipoContenido: string | null;
}

function respuestaJson(cuerpo: unknown, estado: number = 200): Response {
  return new Response(JSON.stringify(cuerpo), {
    status: estado,
    headers: { 'content-type': 'application/json' },
  });
}

/** JWT con estructura real pero firma falsa: sólo se prueban los claims. */
function jwtFalso(claims: Record<string, unknown>): string {
  const cabecera = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
  const cuerpo = Buffer.from(JSON.stringify(claims)).toString('base64url');
  return `${cabecera}.${cuerpo}.firma-falsa`;
}

function espiaFetch(responder: (url: string) => Response): { fetchFn: Fetch; llamadas: Llamada[] } {
  const llamadas: Llamada[] = [];
  const fetchFn: Fetch = async (entrada, init) => {
    const url = typeof entrada === 'string' ? entrada : entrada instanceof URL ? entrada.href : entrada.url;
    const crudo = typeof init?.body === 'string' ? init.body : '';
    const cabeceras = new Headers(init?.headers);
    llamadas.push({
      url,
      metodo: init?.method ?? 'GET',
      cuerpo: new URLSearchParams(crudo),
      tipoContenido: cabeceras.get('content-type'),
    });
    return responder(url);
  };
  return { fetchFn, llamadas };
}

describe('generarPkce', () => {
  it('usa 32 bytes aleatorios y el challenge es su sha256 en base64url', () => {
    const { verifier, challenge } = generarPkce();

    expect(verifier).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(Buffer.from(verifier, 'base64url')).toHaveLength(32);
    expect(challenge).toBe(createHash('sha256').update(verifier).digest('base64url'));
    expect(challenge).toMatch(/^[A-Za-z0-9_-]+$/);

    const otro = generarPkce();
    expect(otro.verifier).not.toBe(verifier);
    expect(otro.challenge).not.toBe(challenge);
  });
});

describe('urlDeAutorizacion', () => {
  it('arma la URL con todos los parámetros del flujo', () => {
    const url = new URL(
      urlDeAutorizacion({
        redirectUri: 'http://localhost:1455/auth/callback',
        state: 'estado-1',
        challenge: 'reto-1',
      }),
    );

    expect(`${url.origin}${url.pathname}`).toBe('https://auth.openai.com/oauth/authorize');
    expect(url.searchParams.get('response_type')).toBe('code');
    expect(url.searchParams.get('client_id')).toBe('app_EMoamEEZ73f0CkXaXp7hrann');
    expect(url.searchParams.get('redirect_uri')).toBe('http://localhost:1455/auth/callback');
    expect(url.searchParams.get('scope')).toBe('openid profile email offline_access');
    expect(url.searchParams.get('code_challenge')).toBe('reto-1');
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
    expect(url.searchParams.get('state')).toBe('estado-1');
    expect(url.searchParams.get('codex_cli_simplified_flow')).toBe('true');
    expect(url.searchParams.get('originator')).toBe('contope-design');
    expect(url.searchParams.get('id_token_add_organizations')).toBe('true');
  });
});

describe('claimsDeJwt', () => {
  it('lee los claims del id_token', () => {
    const jwt = jwtFalso({
      email: 'ana@ejemplo.cl',
      'https://api.openai.com/auth': { chatgpt_account_id: 'cta-123' },
    });

    const claims = claimsDeJwt(jwt);
    expect(claims?.['email']).toBe('ana@ejemplo.cl');
    const auth = claims?.['https://api.openai.com/auth'];
    expect(auth).toMatchObject({ chatgpt_account_id: 'cta-123' });
  });

  it('devuelve null cuando no es un JWT', () => {
    expect(claimsDeJwt('no-es-un-jwt')).toBeNull();
    expect(claimsDeJwt('a.!!!.c')).toBeNull();
    expect(claimsDeJwt('')).toBeNull();
  });
});

describe('tokensDeRespuesta', () => {
  it('calcula la expiración y saca la cuenta y el correo del id_token', () => {
    const ahora = 1_700_000_000_000;
    const tokens = tokensDeRespuesta(
      {
        access_token: 'acc-1',
        refresh_token: 'ref-1',
        id_token: jwtFalso({
          email: 'ana@ejemplo.cl',
          'https://api.openai.com/auth': { chatgpt_account_id: 'cta-9' },
        }),
        expires_in: 1800,
      },
      null,
      ahora,
    );

    expect(tokens.accessToken).toBe('acc-1');
    expect(tokens.refreshToken).toBe('ref-1');
    expect(tokens.expiraEn).toBe(ahora + 1_800_000);
    expect(tokens.cuentaId).toBe('cta-9');
    expect(tokens.email).toBe('ana@ejemplo.cl');
  });

  it('conserva el refresh anterior si la respuesta no trae uno nuevo', () => {
    const tokens = tokensDeRespuesta(
      { access_token: 'acc-2', id_token: jwtFalso({}), expires_in: 3600 },
      'ref-viejo',
    );

    expect(tokens.refreshToken).toBe('ref-viejo');
    expect(tokens.cuentaId).toBeNull();
    expect(tokens.email).toBeNull();
  });

  it('lanza con mensaje claro si falta algo esencial', () => {
    expect(() =>
      tokensDeRespuesta({ refresh_token: 'ref', id_token: jwtFalso({}), expires_in: 3600 }, 'ref-viejo'),
    ).toThrow(/access_token/);

    expect(() =>
      tokensDeRespuesta({ access_token: 'acc', id_token: jwtFalso({}), expires_in: 3600 }, null),
    ).toThrow(/refresh_token/);

    expect(() => tokensDeRespuesta({ access_token: 'acc', id_token: jwtFalso({}) }, 'ref-viejo')).toThrow(
      /expires_in/,
    );

    expect(() => tokensDeRespuesta('no es un objeto', 'ref-viejo')).toThrow(/objeto JSON/);
  });
});

describe('intercambiarCodigo', () => {
  it('hace el POST de canje con PKCE', async () => {
    const { fetchFn, llamadas } = espiaFetch(() =>
      respuestaJson({
        access_token: 'acc-nuevo',
        refresh_token: 'ref-nuevo',
        id_token: jwtFalso({ email: 'ana@ejemplo.cl' }),
        expires_in: 3600,
      }),
    );

    const tokens = await intercambiarCodigo('codigo-1', 'verifier-1', 'http://localhost:1455/auth/callback', fetchFn);

    expect(llamadas).toHaveLength(1);
    expect(llamadas[0]?.url).toBe('https://auth.openai.com/oauth/token');
    expect(llamadas[0]?.metodo).toBe('POST');
    expect(llamadas[0]?.tipoContenido).toContain('application/x-www-form-urlencoded');
    expect(llamadas[0]?.cuerpo.get('grant_type')).toBe('authorization_code');
    expect(llamadas[0]?.cuerpo.get('code')).toBe('codigo-1');
    expect(llamadas[0]?.cuerpo.get('code_verifier')).toBe('verifier-1');
    expect(llamadas[0]?.cuerpo.get('redirect_uri')).toBe('http://localhost:1455/auth/callback');
    expect(llamadas[0]?.cuerpo.get('client_id')).toBe('app_EMoamEEZ73f0CkXaXp7hrann');

    expect(tokens.accessToken).toBe('acc-nuevo');
    expect(tokens.refreshToken).toBe('ref-nuevo');
    expect(tokens.expiraEn).toBeGreaterThan(Date.now());
  });

  it('lanza un error legible si OpenAI responde con error', async () => {
    const { fetchFn } = espiaFetch(() => respuestaJson({ error: 'invalid_grant' }, 400));
    await expect(intercambiarCodigo('codigo-malo', 'verifier-1', 'http://localhost:1455/auth/callback', fetchFn)).rejects.toThrow(
      /HTTP 400/,
    );
  });
});

describe('refrescar', () => {
  it('pide el refresco y conserva el refresh token anterior', async () => {
    const { fetchFn, llamadas } = espiaFetch(() =>
      respuestaJson({ access_token: 'acc-2', id_token: jwtFalso({}), expires_in: 3600 }),
    );

    const tokens = await refrescar('ref-1', fetchFn);

    expect(llamadas).toHaveLength(1);
    expect(llamadas[0]?.url).toBe('https://auth.openai.com/oauth/token');
    expect(llamadas[0]?.metodo).toBe('POST');
    expect(llamadas[0]?.cuerpo.get('grant_type')).toBe('refresh_token');
    expect(llamadas[0]?.cuerpo.get('refresh_token')).toBe('ref-1');
    expect(llamadas[0]?.cuerpo.get('client_id')).toBe('app_EMoamEEZ73f0CkXaXp7hrann');
    expect(tokens.accessToken).toBe('acc-2');
    expect(tokens.refreshToken).toBe('ref-1');
  });

  it('usa el refresh token nuevo cuando la respuesta lo trae', async () => {
    const { fetchFn } = espiaFetch(() =>
      respuestaJson({
        access_token: 'acc-3',
        refresh_token: 'ref-3',
        id_token: jwtFalso({}),
        expires_in: 3600,
      }),
    );

    const tokens = await refrescar('ref-1', fetchFn);
    expect(tokens.refreshToken).toBe('ref-3');
  });
});

describe('almacén de sesión', () => {
  let carpeta: string | null = null;

  const crearCarpeta = async (): Promise<string> => {
    carpeta = await mkdtemp(join(tmpdir(), 'contope-codex-'));
    return carpeta;
  };

  const tokensDeEjemplo = (expiraEn: number): Tokens => ({
    accessToken: 'acc-viejo',
    refreshToken: 'ref-viejo',
    idToken: jwtFalso({ email: 'ana@ejemplo.cl' }),
    expiraEn,
    cuentaId: 'cta-1',
    email: 'ana@ejemplo.cl',
  });

  afterEach(async () => {
    if (carpeta !== null) {
      await rm(carpeta, { recursive: true, force: true });
      carpeta = null;
    }
  });

  it('guarda y lee los tokens (ida y vuelta)', async () => {
    const ruta = join(await crearCarpeta(), 'sesion-codex.json');
    const almacen = almacenDeSesionCodex(ruta);
    const tokens: Tokens = {
      accessToken: 'acc-1',
      refreshToken: 'ref-1',
      idToken: jwtFalso({ email: 'ana@ejemplo.cl' }),
      expiraEn: Date.now() + 3_600_000,
      cuentaId: 'cta-1',
      email: 'ana@ejemplo.cl',
    };

    await almacen.guardar(tokens);

    await expect(almacen.leer()).resolves.toEqual(tokens);
    const crudo = await readFile(ruta, 'utf8');
    expect(JSON.parse(crudo) as unknown).toMatchObject({ accessToken: 'acc-1', refreshToken: 'ref-1' });

    await almacen.borrar();
    await expect(almacen.leer()).resolves.toBeNull();
  });

  it('devuelve null si no hay archivo o está corrupto', async () => {
    const ruta = join(await crearCarpeta(), 'sesion-codex.json');
    const almacen = almacenDeSesionCodex(ruta);

    await expect(almacen.leer()).resolves.toBeNull();
    await expect(almacen.vigentes()).resolves.toBeNull();

    await writeFile(ruta, '{ esto no es json', 'utf8');
    await expect(almacen.leer()).resolves.toBeNull();

    await writeFile(ruta, JSON.stringify({ accessToken: '', expiraEn: -1 }), 'utf8');
    await expect(almacen.leer()).resolves.toBeNull();

    await writeFile(ruta, JSON.stringify({ accessToken: 'acc', refreshToken: 'ref', idToken: 'jwt', expiraEn: 0 }), 'utf8');
    await expect(almacen.leer()).resolves.toBeNull();
  });

  it('no refresca si todavía le queda harta vigencia', async () => {
    const ruta = join(await crearCarpeta(), 'sesion-codex.json');
    const ahora = 1_700_000_000_000;
    const { fetchFn, llamadas } = espiaFetch(() => respuestaJson({ access_token: 'acc-nuevo', id_token: jwtFalso({}), expires_in: 3600 }));
    const almacen = almacenDeSesionCodex(ruta, { fetchFn, ahora: () => ahora });

    await almacen.guardar(tokensDeEjemplo(ahora + 3_600_000));
    const vigentes = await almacen.vigentes();

    expect(vigentes?.accessToken).toBe('acc-viejo');
    expect(llamadas).toHaveLength(0);
  });

  it('refresca cuando está por expirar y guarda el resultado', async () => {
    const ruta = join(await crearCarpeta(), 'sesion-codex.json');
    const ahora = 1_700_000_000_000;
    const { fetchFn, llamadas } = espiaFetch(() =>
      respuestaJson({ access_token: 'acc-nuevo', id_token: jwtFalso({ email: 'ana@ejemplo.cl' }), expires_in: 3600 }),
    );
    const almacen = almacenDeSesionCodex(ruta, { fetchFn, ahora: () => ahora });

    // Expira en 1 minuto: menos que el margen de 5 minutos.
    await almacen.guardar(tokensDeEjemplo(ahora + 60_000));
    const vigentes = await almacen.vigentes();

    expect(llamadas).toHaveLength(1);
    expect(llamadas[0]?.cuerpo.get('grant_type')).toBe('refresh_token');
    expect(llamadas[0]?.cuerpo.get('refresh_token')).toBe('ref-viejo');
    expect(vigentes?.accessToken).toBe('acc-nuevo');
    expect(vigentes?.refreshToken).toBe('ref-viejo');

    // El resultado quedó guardado en disco.
    const enDisco = await almacen.leer();
    expect(enDisco).toEqual(vigentes);
    expect(enDisco?.accessToken).toBe('acc-nuevo');
  });

  it('borra la sesión y devuelve null si el refresh token ya no sirve', async () => {
    const ruta = join(await crearCarpeta(), 'sesion-codex.json');
    const ahora = 1_700_000_000_000;
    const { fetchFn } = espiaFetch(() => respuestaJson({ error: 'invalid_grant' }, 400));
    const almacen = almacenDeSesionCodex(ruta, { fetchFn, ahora: () => ahora });

    await almacen.guardar(tokensDeEjemplo(ahora + 60_000));
    await expect(almacen.vigentes()).resolves.toBeNull();
    await expect(almacen.leer()).resolves.toBeNull();
  });
});

describe('servidor de callback', () => {
  it('resuelve el código cuando llega el GET con el state esperado', async () => {
    const servidor = await abrirServidorDeCallback(0);
    try {
      const espera = servidor.esperarCodigo('estado-1');
      const respuesta = await fetch(`${servidor.redirectUri}?code=codigo-1&state=estado-1`);
      const html = await respuesta.text();

      expect(respuesta.status).toBe(200);
      expect(html).toContain('Sesión iniciada');
      expect(html).toContain('Puedes cerrar esta ventana y volver a ContOpe Design');
      await expect(espera).resolves.toBe('codigo-1');
    } finally {
      servidor.cerrar();
    }
  });

  it('rechaza cuando el state no calza', async () => {
    const servidor = await abrirServidorDeCallback(0);
    try {
      const espera = expect(servidor.esperarCodigo('estado-bueno')).rejects.toThrow(/state/);
      const respuesta = await fetch(`${servidor.redirectUri}?code=codigo-1&state=estado-malo`);

      expect(respuesta.status).toBe(400);
      await espera;
    } finally {
      servidor.cerrar();
    }
  });

  it('rechaza cuando OpenAI manda un error en la query', async () => {
    const servidor = await abrirServidorDeCallback(0);
    try {
      const espera = expect(servidor.esperarCodigo('estado-1')).rejects.toThrow(/access_denied/);
      const respuesta = await fetch(`${servidor.redirectUri}?error=access_denied&state=estado-1`);

      expect(respuesta.status).toBe(400);
      await espera;
    } finally {
      servidor.cerrar();
    }
  });

  it('responde 404 en otras rutas', async () => {
    const servidor = await abrirServidorDeCallback(0);
    try {
      const base = new URL(servidor.redirectUri);
      const respuesta = await fetch(`http://localhost:${base.port}/otra-cosa`);
      expect(respuesta.status).toBe(404);
    } finally {
      servidor.cerrar();
    }
  });

  it('avisa cuando el puerto está ocupado', async () => {
    const primero = await abrirServidorDeCallback(0);
    try {
      const puerto = Number(new URL(primero.redirectUri).port);
      await expect(abrirServidorDeCallback(puerto)).rejects.toThrow(/ocupado/);
    } finally {
      primero.cerrar();
    }
  });
});
