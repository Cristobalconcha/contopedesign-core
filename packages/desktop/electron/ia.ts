/**
 * La IA del taller, lado del proceso principal (decisión 32, 19-09-2026): los
 * proveedores que la persona configuró, sus secretos cifrados con
 * `safeStorage` en `userData` (nunca en el archivo del sistema ni en el
 * renderizador), la sesión de ChatGPT/Codex por OAuth, y la llamada al modelo.
 * El renderizador arma el prompt y lee la respuesta (`dominio/encargo.ts`);
 * acá sólo se guarda, se cifra y se habla con la red.
 */
import type { App, IpcMain, SafeStorage, Shell } from 'electron';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  configuracionVacia,
  motivoDeHttp,
  peticionDe,
  textoDeRespuesta,
  validarConfiguracion,
  type ConfiguracionDeIA,
  type Mensajes,
  type Proveedor,
} from '../src/dominio/proveedores.js';
import { almacenDeSesionCodex, iniciarSesionCodex, type AlmacenDeSesionCodex } from './codex-oauth.js';

export interface EstadoDeIA {
  configuracion: ConfiguracionDeIA;
  codex: { sesion: boolean; email: string | null };
  /** El proceso principal puede cifrar; si no (Linux sin llavero), se dice y no se guardan claves. */
  puedeCifrar: boolean;
  /** Por id de proveedor: si su `claveDeEntorno` existe (y no está vacía) en este equipo. */
  entorno: Record<string, boolean>;
}

export type RespuestaDeIA = { ok: true; texto: string } | { ok: false; motivo: string };

interface Dependencias {
  app: App;
  ipcMain: IpcMain;
  shell: Shell;
  safeStorage: SafeStorage;
  fetchFn: typeof fetch;
}

function esRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** Una variable de entorno del equipo, sólo si existe y no está vacía. */
function varDeEntorno(nombre: string): string | null {
  const valor = process.env[nombre];
  return valor === undefined || valor === '' ? null : valor;
}

function varDeEntornoPresente(nombre: string): boolean {
  return varDeEntorno(nombre) !== null;
}

async function escribirAtomico(ruta: string, texto: string): Promise<void> {
  await mkdir(join(ruta, '..'), { recursive: true });
  const temporal = `${ruta}.tmp-${process.pid}`;
  await writeFile(temporal, texto, 'utf8');
  await rename(temporal, ruta);
}

export function registrarIpcDeIA(deps: Dependencias): void {
  const { app, ipcMain, shell, safeStorage, fetchFn } = deps;
  const rutaConfig = (): string => join(app.getPath('userData'), 'ia.json');
  const rutaSecretos = (): string => join(app.getPath('userData'), 'ia-secretos.json');
  const rutaCodex = (): string => join(app.getPath('userData'), 'codex-sesion.json');
  let almacenCodex: AlmacenDeSesionCodex | null = null;
  const codex = (): AlmacenDeSesionCodex => {
    if (almacenCodex === null) almacenCodex = almacenDeSesionCodex(rutaCodex(), { fetchFn });
    return almacenCodex;
  };

  async function leerConfiguracion(): Promise<ConfiguracionDeIA> {
    try {
      const v = validarConfiguracion(JSON.parse(await readFile(rutaConfig(), 'utf8')));
      return v.ok ? v.configuracion : configuracionVacia();
    } catch {
      return configuracionVacia();
    }
  }
  async function guardarConfiguracion(c: ConfiguracionDeIA): Promise<void> {
    await escribirAtomico(rutaConfig(), JSON.stringify(c, null, 2) + '\n');
  }
  async function leerSecretos(): Promise<Record<string, string>> {
    try {
      const crudo: unknown = JSON.parse(await readFile(rutaSecretos(), 'utf8'));
      if (!esRecord(crudo)) return {};
      const salida: Record<string, string> = {};
      for (const [id, v] of Object.entries(crudo)) if (typeof v === 'string') salida[id] = v;
      return salida;
    } catch {
      return {};
    }
  }
  async function guardarSecretos(s: Record<string, string>): Promise<void> {
    await escribirAtomico(rutaSecretos(), JSON.stringify(s, null, 2) + '\n');
  }
  async function secretoDe(proveedorId: string): Promise<string | null> {
    const cifrado = (await leerSecretos())[proveedorId];
    if (cifrado === undefined || !safeStorage.isEncryptionAvailable()) return null;
    try {
      return safeStorage.decryptString(Buffer.from(cifrado, 'base64'));
    } catch {
      return null;
    }
  }
  async function estado(): Promise<EstadoDeIA> {
    const sesion = await codex().leer();
    const configuracion = await leerConfiguracion();
    const entorno: Record<string, boolean> = {};
    for (const p of configuracion.proveedores) {
      if (p.claveDeEntorno !== undefined) entorno[p.id] = varDeEntornoPresente(p.claveDeEntorno);
    }
    return {
      configuracion,
      codex: { sesion: sesion !== null, email: sesion?.email ?? null },
      puedeCifrar: safeStorage.isEncryptionAvailable(),
      entorno,
    };
  }

  ipcMain.handle('ia:estado', () => estado());

  ipcMain.handle('ia:guardar-proveedor', async (_e, proveedor: Proveedor, secreto: string | null) => {
    const c = await leerConfiguracion();
    const otros = c.proveedores.filter((p) => p.id !== proveedor.id);
    if (secreto !== null && secreto !== '') {
      if (!safeStorage.isEncryptionAvailable()) throw new Error('Este equipo no puede cifrar la clave; no se guarda.');
      const secretos = await leerSecretos();
      secretos[proveedor.id] = safeStorage.encryptString(secreto).toString('base64');
      await guardarSecretos(secretos);
    }
    await guardarConfiguracion({ ...c, proveedores: [...otros, proveedor], activo: c.activo ?? proveedor.id });
    return estado();
  });

  ipcMain.handle('ia:quitar-proveedor', async (_e, id: string) => {
    const c = await leerConfiguracion();
    const secretos = await leerSecretos();
    delete secretos[id];
    await guardarSecretos(secretos);
    const proveedores = c.proveedores.filter((p) => p.id !== id);
    await guardarConfiguracion({ ...c, proveedores, activo: c.activo === id ? (proveedores[0]?.id ?? null) : c.activo });
    return estado();
  });

  ipcMain.handle('ia:activar', async (_e, id: string | null) => {
    const c = await leerConfiguracion();
    await guardarConfiguracion({ ...c, activo: id !== null && c.proveedores.some((p) => p.id === id) ? id : null });
    return estado();
  });

  ipcMain.handle('ia:codex-iniciar-sesion', async () => {
    await iniciarSesionCodex(codex(), (url) => shell.openExternal(url), fetchFn);
    return estado();
  });

  ipcMain.handle('ia:codex-cerrar-sesion', async () => {
    await codex().borrar();
    return estado();
  });

  ipcMain.handle('ia:pedir', async (_e, proveedorId: string, mensajes: Mensajes): Promise<RespuestaDeIA> => {
    const c = await leerConfiguracion();
    const proveedor = c.proveedores.find((p) => p.id === proveedorId);
    if (!proveedor) return { ok: false, motivo: 'El proveedor elegido ya no está configurado.' };
    let secreto: string | undefined;
    let cuentaId: string | undefined;
    if (proveedor.credencial === 'sesion-codex') {
      const tokens = await codex().vigentes();
      if (tokens === null) return { ok: false, motivo: 'No hay sesión de ChatGPT: inicia sesión en la configuración de la IA.' };
      secreto = tokens.accessToken;
      if (tokens.cuentaId !== null) cuentaId = tokens.cuentaId;
    } else if (proveedor.credencial !== 'ninguna') {
      const guardado = await secretoDe(proveedor.id);
      const delEntorno = guardado === null && proveedor.claveDeEntorno !== undefined ? varDeEntorno(proveedor.claveDeEntorno) : null;
      const s = guardado ?? delEntorno;
      if (s === null) {
        const mencion =
          proveedor.claveDeEntorno !== undefined
            ? `, ni está definida la variable de entorno ${proveedor.claveDeEntorno} en este equipo`
            : '';
        return { ok: false, motivo: `Falta la credencial de ${proveedor.nombre}: vuelve a guardarla en la configuración de la IA${mencion}.` };
      }
      secreto = s;
    }
    const peticion = peticionDe(proveedor, mensajes, { ...(secreto !== undefined ? { secreto } : {}), ...(cuentaId !== undefined ? { cuentaId } : {}) });
    let respuesta: Response;
    try {
      respuesta = await fetchFn(peticion.url, { method: 'POST', headers: peticion.headers, body: peticion.body });
    } catch (error) {
      return { ok: false, motivo: `No se pudo llegar a ${proveedor.nombre}: ${(error as Error).message}` };
    }
    const cuerpo = await respuesta.text();
    if (!respuesta.ok) return { ok: false, motivo: `${proveedor.nombre}: ${motivoDeHttp(respuesta.status, cuerpo)}` };
    return textoDeRespuesta(proveedor.clase, cuerpo);
  });
}
