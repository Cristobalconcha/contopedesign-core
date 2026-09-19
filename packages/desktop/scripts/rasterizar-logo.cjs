// Dibuja public/images/marca.svg a PNG con el propio Electron (ventana oculta + capturePage).
// Uso: npx electron scripts/rasterizar-logo.cjs
const { app, BrowserWindow } = require('electron');
const { readFileSync, writeFileSync, mkdirSync } = require('node:fs');
const { join } = require('node:path');
const raiz = join(__dirname, '..');
const svg = readFileSync(join(raiz, 'public', 'images', 'marca.svg'), 'utf8');
// Un solo tamaño: en una pantalla a escala 2 sale de 1024 px, que sirve para todo.
const tamanos = [512];
app.whenReady().then(async () => {
  for (const t of tamanos) {
    const v = new BrowserWindow({ show: false, width: t, height: t, frame: false, transparent: true, webPreferences: { offscreen: true } });
    const html = `<!doctype html><html><body style="margin:0;background:transparent;width:${t}px;height:${t}px;display:flex;align-items:center;justify-content:center"><img src="data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}" style="width:${Math.round(t * 0.92)}px;height:auto"></body></html>`;
    await v.loadURL('data:text/html;base64,' + Buffer.from(html).toString('base64'));
    await new Promise((r) => setTimeout(r, 400));
    const img = await v.webContents.capturePage({ x: 0, y: 0, width: t, height: t });
    mkdirSync(join(raiz, 'public', 'images'), { recursive: true });
    const salida = join(raiz, 'public', 'images', t === 512 ? 'contope.png' : `contope-${t}.png`);
    writeFileSync(salida, img.toPNG());
    console.log('escrito', salida, img.getSize());
    v.destroy();
  }
  app.exit(0);
});
