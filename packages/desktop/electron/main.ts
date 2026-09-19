/**
 * Proceso principal de Electron: la ventana y el acceso al disco.
 *
 * Todo lo que toca archivos o red pasa por acá, a pedido del renderizador y
 * por IPC. El renderizador nunca recibe rutas que no haya elegido la persona
 * en un diálogo: abrir, guardar y elegir carpeta son gestos explícitos.
 *
 * `--smoke`: abre la ventana, espera a que cargue y sale con código 0. Sirve
 * para comprobar en una terminal que el programa arranca, sin mirar.
 */
import { app, BrowserWindow, dialog, ipcMain, net, safeStorage, shell } from 'electron';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { basename, extname, join } from 'node:path';
import { registrarIpcDeIA } from './ia.js';

const FILTRO_SISTEMA = [{ name: 'Sistema de ContOpe Design', extensions: ['contope.json', 'json'] }];
const FILTRO_INSUMOS = [
  { name: 'Insumos', extensions: ['idml', 'css', 'json', 'png', 'jpg', 'jpeg', 'webp', 'gif', 'svg', 'pdf', 'txt', 'md', 'html'] },
  { name: 'Todos los archivos', extensions: ['*'] },
];
const ORIGEN_CATALOGO = 'https://fonts.google.com/metadata/fonts';
const ES_SMOKE = process.argv.includes('--smoke');

function rutaRecientes(): string {
  return join(app.getPath('userData'), 'recientes.json');
}

interface Reciente {
  ruta: string;
  nombre: string;
  abiertoEn: string;
  vistazo?: unknown;
}

async function leerRecientes(): Promise<Reciente[]> {
  try {
    const crudo = await readFile(rutaRecientes(), 'utf8');
    const lista: unknown = JSON.parse(crudo);
    return Array.isArray(lista) ? (lista as Reciente[]) : [];
  } catch {
    return [];
  }
}

async function registrarReciente(ruta: string, nombre: string, vistazo?: unknown): Promise<void> {
  const previos = await leerRecientes();
  const previo = previos.find((r) => r.ruta === ruta);
  const lista = previos.filter((r) => r.ruta !== ruta);
  const v = vistazo ?? previo?.vistazo;
  lista.unshift({ ruta, nombre, abiertoEn: new Date().toISOString(), ...(v !== undefined ? { vistazo: v } : {}) });
  await mkdir(app.getPath('userData'), { recursive: true });
  await writeFile(rutaRecientes(), JSON.stringify(lista.slice(0, 12), null, 2));
}

/** El logotipo en PNG (public/images/contope.png, hecho con scripts/rasterizar-logo.cjs): en dist tras compilar, en public en desarrollo. */
function rutaDelIcono(): string | undefined {
  const candidatas = [join(__dirname, '..', 'images', 'contope.png'), join(app.getAppPath(), 'public', 'images', 'contope.png')];
  return candidatas.find((r) => existsSync(r));
}

function crearVentana(): BrowserWindow {
  const icono = rutaDelIcono();
  const ventana = new BrowserWindow({
    ...(icono !== undefined ? { icon: icono } : {}),
    width: 1280,
    height: 820,
    minWidth: 900,
    minHeight: 600,
    title: 'ContOpe Design',
    backgroundColor: '#eceded',
    webPreferences: {
      preload: join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  const urlDesarrollo = process.env['VITE_DEV_SERVER_URL'];
  if (urlDesarrollo !== undefined) {
    void ventana.loadURL(urlDesarrollo);
  } else {
    void ventana.loadFile(join(__dirname, '..', 'index.html'));
  }
  ventana.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://')) void shell.openExternal(url);
    return { action: 'deny' };
  });
  return ventana;
}

function registrarIpc(): void {
  ipcMain.handle('dialogo:abrir-sistema', async () => {
    const r = await dialog.showOpenDialog({ properties: ['openFile'], filters: FILTRO_SISTEMA });
    if (r.canceled || r.filePaths[0] === undefined) return null;
    const ruta = r.filePaths[0];
    const texto = await readFile(ruta, 'utf8');
    await registrarReciente(ruta, basename(ruta));
    return { ruta, nombre: basename(ruta), texto };
  });

  ipcMain.handle('archivo:leer-sistema', async (_e, ruta: string) => {
    const texto = await readFile(ruta, 'utf8');
    await registrarReciente(ruta, basename(ruta));
    return { ruta, nombre: basename(ruta), texto };
  });

  ipcMain.handle(
    'dialogo:guardar-sistema',
    async (_e, sugerido: string, texto: string, rutaActual: string | null, vistazo: unknown) => {
      let ruta = rutaActual;
      if (ruta === null) {
        const r = await dialog.showSaveDialog({ defaultPath: sugerido, filters: FILTRO_SISTEMA });
        if (r.canceled || r.filePath === undefined || r.filePath === '') return null;
        ruta = r.filePath;
      }
      await writeFile(ruta, texto, 'utf8');
      await registrarReciente(ruta, basename(ruta), vistazo);
      return { ruta, nombre: basename(ruta) };
    },
  );

  ipcMain.handle('dialogo:guardar-como', async (_e, sugerido: string, texto: string, vistazo: unknown) => {
    const r = await dialog.showSaveDialog({ defaultPath: sugerido, filters: FILTRO_SISTEMA });
    if (r.canceled || r.filePath === undefined || r.filePath === '') return null;
    await writeFile(r.filePath, texto, 'utf8');
    await registrarReciente(r.filePath, basename(r.filePath), vistazo);
    return { ruta: r.filePath, nombre: basename(r.filePath) };
  });

  ipcMain.handle('recientes:registrar', (_e, ruta: string, nombre: string, vistazo: unknown) =>
    registrarReciente(ruta, nombre, vistazo),
  );

  ipcMain.handle('dialogo:abrir-insumos', async () => {
    const r = await dialog.showOpenDialog({ properties: ['openFile', 'multiSelections'], filters: FILTRO_INSUMOS });
    if (r.canceled) return [];
    return Promise.all(
      r.filePaths.map(async (ruta) => {
        const bytes = await readFile(ruta);
        return {
          ruta,
          nombre: basename(ruta),
          extension: extname(ruta).slice(1).toLowerCase(),
          bytes: bytes.toString('base64'),
        };
      }),
    );
  });

  ipcMain.handle('dialogo:abrir-propuestas', async () => {
    const r = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [{ name: 'Propuestas de ContOpe', extensions: ['json'] }],
    });
    if (r.canceled || r.filePaths[0] === undefined) return null;
    const ruta = r.filePaths[0];
    return { ruta, nombre: basename(ruta), texto: await readFile(ruta, 'utf8') };
  });

  ipcMain.handle('dialogo:exportar-capsula', async (_e, archivos: Array<{ nombre: string; texto: string }>) => {
    const r = await dialog.showOpenDialog({ properties: ['openDirectory', 'createDirectory'], title: 'Carpeta para la cápsula' });
    if (r.canceled || r.filePaths[0] === undefined) return null;
    const carpeta = r.filePaths[0];
    for (const archivo of archivos) {
      const ruta = join(carpeta, archivo.nombre);
      await mkdir(join(ruta, '..'), { recursive: true });
      await writeFile(ruta, archivo.texto, 'utf8');
    }
    return carpeta;
  });

  ipcMain.handle('recientes:listar', () => leerRecientes());

  ipcMain.handle('catalogo:descargar', async () => {
    const respuesta = await net.fetch(ORIGEN_CATALOGO);
    if (!respuesta.ok) throw new Error(`Google Fonts respondió ${respuesta.status}`);
    return await respuesta.text();
  });
}

void app.whenReady().then(() => {
  registrarIpc();
  // net.fetch respeta el proxy del sistema; su firma difiere del fetch estándar sólo en el tipo del primer argumento.
  registrarIpcDeIA({ app, ipcMain, shell, safeStorage, fetchFn: net.fetch as unknown as typeof fetch });
  const ventana = crearVentana();
  if (ES_SMOKE) {
    ventana.webContents.once('did-finish-load', () => {
      // Que la página haya cargado no dice que la aplicación haya dibujado:
      // se pregunta por la portada y por el puente antes de dar por bueno.
      void ventana.webContents
        .executeJavaScript(
          'new Promise((r) => setTimeout(() => r({ portada: document.querySelector(".pregunta-grande")?.textContent ?? null, puente: typeof window.contope }), 400))',
        )
        .then((r: { portada: string | null; puente: string }) => {
          if (r.portada === null || r.puente !== 'object') {
            console.error(`smoke: la ventana cargó pero no dibujó (portada=${String(r.portada)}, puente=${r.puente})`);
            app.exit(1);
            return;
          }
          console.log(`smoke: dibujó «${r.portada}» y el puente está expuesto`);
          app.exit(0);
        })
        .catch((error: Error) => {
          console.error(`smoke: ${error.message}`);
          app.exit(1);
        });
    });
    ventana.webContents.once('did-fail-load', (_e, codigo, descripcion) => {
      console.error(`smoke: falló la carga (${codigo}) ${descripcion}`);
      app.exit(1);
    });
    setTimeout(() => {
      console.error('smoke: la ventana no cargó en 30 s');
      app.exit(1);
    }, 30_000);
  }
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) crearVentana();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
