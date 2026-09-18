import fs from 'node:fs'; import path from 'node:path';
const [inp, out] = process.argv.slice(2);
const lines = fs.readFileSync(inp, 'utf8').split(/\r?\n/);
let name = null, buf = [];
const flush = () => { if (!name) return; while (buf.length && buf[0].trim() === '') buf.shift(); if (buf.length && /^```[a-z]*$/.test(buf[0].trim())) buf.shift(); while (buf.length && buf[buf.length-1].trim() === '') buf.pop(); if (buf.length && /^```$/.test(buf[buf.length-1].trim())) buf.pop(); const p = path.join(out, name); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, buf.join('\n') + '\n'); console.log(name, buf.length, 'líneas'); name = null; buf = []; };
for (const l of lines) { const m = l.match(/^===== ARCHIVO: (.+?) =====$/); if (m) { flush(); name = m[1]; continue; } if (/^===== FIN =====$/.test(l)) { flush(); continue; } if (name) buf.push(l); }
flush();
