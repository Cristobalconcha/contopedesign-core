import { describe, expect, it } from 'vitest';
import {
  PREAJUSTES,
  configuracionVacia,
  mascaraDe,
  motivoDeHttp,
  peticionDe,
  textoDeRespuesta,
  validarConfiguracion,
  type Proveedor,
} from './proveedores.js';

const AHORA = '2026-09-19T09:00:00.000Z';

const MENSAJES = { sistema: 'eres la IA del taller', usuario: 'resuelve dim3.req02' };

const CLAUDE: Proveedor = {
  id: 'prov-claude',
  nombre: 'Claude',
  clase: 'anthropic',
  baseUrl: 'https://api.anthropic.com',
  modelo: 'claude-sonnet-5',
  credencial: 'clave',
  creadoEn: AHORA,
};

const CLAUDE_CODE: Proveedor = {
  id: 'prov-claude-code',
  nombre: 'Claude (Claude Code)',
  clase: 'anthropic',
  baseUrl: 'https://api.anthropic.com/',
  modelo: 'claude-sonnet-5',
  credencial: 'token-claude',
  creadoEn: AHORA,
};

const DEEPSEEK: Proveedor = {
  id: 'prov-deepseek',
  nombre: 'DeepSeek',
  clase: 'openai-chat',
  baseUrl: 'https://api.deepseek.com/v1',
  modelo: 'deepseek-v4-pro',
  credencial: 'clave',
  creadoEn: AHORA,
};

const OLLAMA: Proveedor = {
  id: 'prov-ollama',
  nombre: 'Ollama local',
  clase: 'openai-chat',
  baseUrl: 'http://localhost:11434/v1/',
  modelo: 'llama3.2',
  credencial: 'ninguna',
  creadoEn: AHORA,
};

const CODEX: Proveedor = {
  id: 'prov-codex',
  nombre: 'ChatGPT / Codex',
  clase: 'codex',
  baseUrl: 'https://chatgpt.com/backend-api',
  modelo: 'gpt-5.5',
  credencial: 'sesion-codex',
  creadoEn: AHORA,
};

describe('configuracionVacia', () => {
  it('parte sin proveedores y sin activo', () => {
    expect(configuracionVacia()).toEqual({ schemaVersion: 1, proveedores: [], activo: null });
  });
});

describe('validarConfiguracion', () => {
  it('acepta una configuración bien formada', () => {
    const r = validarConfiguracion({
      schemaVersion: 1,
      proveedores: [{ ...CLAUDE, mascara: 'sk-ant-***hijk' }],
      activo: CLAUDE.id,
    });
    expect(r.ok).toBe(true);
    if (!r.ok) throw new Error(r.motivo);
    expect(r.configuracion.proveedores).toHaveLength(1);
    expect(r.configuracion.proveedores[0]?.id).toBe(CLAUDE.id);
    expect(r.configuracion.proveedores[0]?.mascara).toBe('sk-ant-***hijk');
    expect(r.configuracion.activo).toBe(CLAUDE.id);
  });

  it('rechaza lo que no es un objeto', () => {
    expect(validarConfiguracion('hola')).toMatchObject({ ok: false });
    expect(validarConfiguracion(null)).toMatchObject({ ok: false });
    expect(validarConfiguracion([])).toMatchObject({ ok: false });
    expect(validarConfiguracion(7)).toMatchObject({ ok: false });
  });

  it('rechaza una versión de esquema rara o ausente', () => {
    expect(validarConfiguracion({ schemaVersion: 2, proveedores: [] })).toMatchObject({
      ok: false,
      motivo: expect.stringContaining('versión'),
    });
    expect(validarConfiguracion({ proveedores: [] })).toMatchObject({ ok: false });
    expect(validarConfiguracion({ schemaVersion: 1 })).toMatchObject({ ok: false, motivo: expect.stringContaining('lista') });
  });

  it('rechaza un proveedor con clase de API desconocida', () => {
    const r = validarConfiguracion({ schemaVersion: 1, proveedores: [{ ...CLAUDE, clase: 'gemini' }], activo: null });
    expect(r).toMatchObject({ ok: false, motivo: expect.stringContaining('clase') });
  });

  it('rechaza credenciales desconocidas y campos obligatorios ausentes', () => {
    expect(validarConfiguracion({ schemaVersion: 1, proveedores: [{ ...CLAUDE, credencial: 'magia' }], activo: null })).toMatchObject({
      ok: false,
      motivo: expect.stringContaining('credencial'),
    });
    expect(validarConfiguracion({ schemaVersion: 1, proveedores: [{ ...CLAUDE, modelo: '' }], activo: null })).toMatchObject({
      ok: false,
      motivo: expect.stringContaining('modelo'),
    });
  });

  it('rechaza un id reservado', () => {
    const r = validarConfiguracion({ schemaVersion: 1, proveedores: [{ ...CLAUDE, id: '__proto__' }], activo: null });
    expect(r).toMatchObject({ ok: false, motivo: expect.stringContaining('reservada') });
    expect(validarConfiguracion({ schemaVersion: 1, proveedores: [{ ...CLAUDE, id: 'constructor' }], activo: null })).toMatchObject({ ok: false });
  });

  it('un activo que no existe queda en null, sin rechazar', () => {
    const r = validarConfiguracion({ schemaVersion: 1, proveedores: [CLAUDE], activo: 'prov-fantasma' });
    expect(r.ok).toBe(true);
    if (!r.ok) throw new Error(r.motivo);
    expect(r.configuracion.activo).toBeNull();
  });
});

describe('mascaraDe', () => {
  it('muestra la familia de la clave y los últimos cuatro caracteres', () => {
    expect(mascaraDe('sk-ant-api03-abcdefghijk')).toBe('sk-ant-***hijk');
  });

  it('no muestra nada de un secreto muy corto', () => {
    expect(mascaraDe('sk-1234')).toBe('***');
    expect(mascaraDe('')).toBe('***');
  });

  it('sin familia en el secreto no inventa prefijo', () => {
    expect(mascaraDe('abcdefghijkl')).toBe('***ijkl');
  });
});

describe('PREAJUSTES', () => {
  it('ofrece las seis familias que el taller conoce', () => {
    expect(PREAJUSTES).toHaveLength(6);
    expect(PREAJUSTES.map((p) => p.clase)).toEqual([
      'anthropic',
      'anthropic',
      'codex',
      'openai-chat',
      'openai-chat',
      'openai-chat',
    ]);
    const ollama = PREAJUSTES.find((p) => p.nombre.startsWith('Ollama'));
    expect(ollama?.credencial).toBe('ninguna');
    expect(PREAJUSTES.find((p) => p.nombre === 'Claude')?.credencial).toBe('clave');
  });
});

describe('peticionDe', () => {
  it('anthropic con clave de API: x-api-key y el mensaje del usuario', () => {
    const p = peticionDe(CLAUDE, MENSAJES, { secreto: 'sk-ant-api03-abcdefghijk' });
    expect(p.url).toBe('https://api.anthropic.com/v1/messages');
    expect(p.headers['content-type']).toBe('application/json');
    expect(p.headers['anthropic-version']).toBe('2023-06-01');
    expect(p.headers['x-api-key']).toBe('sk-ant-api03-abcdefghijk');
    expect(p.headers['authorization']).toBeUndefined();
    const cuerpo = JSON.parse(p.body) as {
      model: string;
      max_tokens: number;
      system: string;
      messages: { role: string; content: string }[];
    };
    expect(cuerpo.model).toBe('claude-sonnet-5');
    expect(cuerpo.max_tokens).toBe(8000);
    expect(cuerpo.system).toBe('eres la IA del taller');
    expect(cuerpo.messages).toEqual([{ role: 'user', content: 'resuelve dim3.req02' }]);
  });

  it('anthropic con token OAuth de Claude Code: Bearer y las cabeceras del CLI', () => {
    const p = peticionDe(CLAUDE_CODE, MENSAJES, { secreto: 'sk-ant-oat-123' });
    expect(p.url).toBe('https://api.anthropic.com/v1/messages');
    expect(p.headers['authorization']).toBe('Bearer sk-ant-oat-123');
    expect(p.headers['anthropic-beta']).toBe('oauth-2025-04-20,claude-code-20250219');
    expect(p.headers['user-agent']).toBe('claude-cli/2.1.75');
    expect(p.headers['x-app']).toBe('cli');
    expect(p.headers['x-api-key']).toBeUndefined();
  });

  it('openai-chat: system y user, con Bearer cuando hay secreto', () => {
    const p = peticionDe(DEEPSEEK, MENSAJES, { secreto: 'sk-deepseek-123', maxTokens: 2000 });
    expect(p.url).toBe('https://api.deepseek.com/v1/chat/completions');
    expect(p.headers['authorization']).toBe('Bearer sk-deepseek-123');
    const cuerpo = JSON.parse(p.body) as {
      model: string;
      max_tokens: number;
      messages: { role: string; content: string }[];
    };
    expect(cuerpo.model).toBe('deepseek-v4-pro');
    expect(cuerpo.max_tokens).toBe(2000);
    expect(cuerpo.messages).toEqual([
      { role: 'system', content: 'eres la IA del taller' },
      { role: 'user', content: 'resuelve dim3.req02' },
    ]);
  });

  it('openai-chat sin credencial (Ollama local) no manda authorization', () => {
    const p = peticionDe(OLLAMA, MENSAJES, {});
    expect(p.url).toBe('http://localhost:11434/v1/chat/completions');
    expect(p.headers['authorization']).toBeUndefined();
  });

  it('codex: stream obligatorio, cuenta de ChatGPT y content de tipo input_text', () => {
    const p = peticionDe(CODEX, MENSAJES, { secreto: 'access-token', cuentaId: 'cta-123' });
    expect(p.url).toBe('https://chatgpt.com/backend-api/codex/responses');
    expect(p.headers['authorization']).toBe('Bearer access-token');
    expect(p.headers['chatgpt-account-id']).toBe('cta-123');
    expect(p.headers['originator']).toBe('contope-design');
    expect(p.headers['openai-beta']).toBe('responses=experimental');
    const cuerpo = JSON.parse(p.body) as {
      model: string;
      instructions: string;
      input: { role: string; content: { type: string; text: string }[] }[];
      store: boolean;
      stream: boolean;
    };
    expect(cuerpo.model).toBe('gpt-5.5');
    expect(cuerpo.instructions).toBe('eres la IA del taller');
    expect(cuerpo.input).toEqual([{ role: 'user', content: [{ type: 'input_text', text: 'resuelve dim3.req02' }] }]);
    expect(cuerpo.store).toBe(false);
    expect(cuerpo.stream).toBe(true);
  });
});

describe('textoDeRespuesta', () => {
  it('anthropic: concatena los bloques de texto', () => {
    const cuerpo = JSON.stringify({ content: [{ type: 'text', text: 'Hola ' }, { type: 'text', text: 'mundo' }] });
    expect(textoDeRespuesta('anthropic', cuerpo)).toEqual({ ok: true, texto: 'Hola mundo' });
  });

  it('anthropic: si no hay texto, lo dice con el cuerpo recortado', () => {
    const r = textoDeRespuesta('anthropic', JSON.stringify({ content: [] }));
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error('debería fallar');
    expect(r.motivo).toContain('texto');
    expect(r.motivo).toContain('cuerpo');
  });

  it('anthropic: un cuerpo que no es JSON se explica solo', () => {
    const r = textoDeRespuesta('anthropic', '<html>502 Bad Gateway</html>');
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error('debería fallar');
    expect(r.motivo).toContain('JSON');
  });

  it('openai-chat: el content del primer choice', () => {
    const cuerpo = JSON.stringify({ choices: [{ message: { role: 'assistant', content: 'Listo' } }] });
    expect(textoDeRespuesta('openai-chat', cuerpo)).toEqual({ ok: true, texto: 'Listo' });
  });

  it('openai-chat: un error del proveedor se lee como motivo', () => {
    const r = textoDeRespuesta('openai-chat', JSON.stringify({ error: { message: 'modelo desconocido' } }));
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error('debería fallar');
    expect(r.motivo).toContain('modelo desconocido');
  });

  it('codex: acumula los deltas del SSE e ignora [DONE]', () => {
    const sse = [
      'event: response.output_text.delta',
      'data: {"type":"response.output_text.delta","delta":"Ho"}',
      '',
      'data: {"type":"response.output_text.delta","delta":"la"}',
      '',
      'data: [DONE]',
      '',
    ].join('\n');
    expect(textoDeRespuesta('codex', sse)).toEqual({ ok: true, texto: 'Hola' });
  });

  it('codex: sin deltas, lee el evento response.completed', () => {
    const sse = [
      'data: {"type":"response.created"}',
      '',
      'data: {"type":"response.completed","response":{"output":[{"content":[{"type":"output_text","text":"Desde el final"}]}]}}',
      '',
      'data: [DONE]',
      '',
    ].join('\n');
    expect(textoDeRespuesta('codex', sse)).toEqual({ ok: true, texto: 'Desde el final' });
  });

  it('codex: sin texto útil, lo dice con el cuerpo recortado', () => {
    const r = textoDeRespuesta('codex', 'data: {"type":"response.created"}\n\n');
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error('debería fallar');
    expect(r.motivo).toContain('cuerpo');
  });
});

describe('motivoDeHttp', () => {
  it('401 y 403: la credencial fue rechazada', () => {
    expect(motivoDeHttp(401, '{"error":"invalid api key"}')).toContain('el proveedor rechazó la credencial');
    expect(motivoDeHttp(403, 'sin permiso')).toContain('el proveedor rechazó la credencial');
  });

  it('429: límite de uso', () => {
    expect(motivoDeHttp(429, 'rate limited')).toContain('límite de uso del proveedor');
  });

  it('5xx: el proveedor falló', () => {
    expect(motivoDeHttp(500, 'boom')).toContain('el proveedor falló (5xx)');
    expect(motivoDeHttp(503, '')).toBe('el proveedor falló (5xx)');
  });

  it('otro estado: lo dice tal cual', () => {
    expect(motivoDeHttp(404, 'no existe')).toContain('respuesta HTTP 404');
  });

  it('recorta el cuerpo a 200 caracteres', () => {
    const largo = 'a'.repeat(300);
    const motivo = motivoDeHttp(500, largo);
    expect(motivo).toContain('a'.repeat(200));
    expect(motivo.includes('a'.repeat(201))).toBe(false);
  });
});
