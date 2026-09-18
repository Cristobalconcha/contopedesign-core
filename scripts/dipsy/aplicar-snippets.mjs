import fs from 'node:fs';
const [I, D] = process.argv.slice(2);
const app = (p, snip) => { const o = fs.readFileSync(p, 'utf8'); const nl = o.includes('\r\n') ? '\r\n' : '\n'; let s = o.replace(/\r\n/g, '\n'); let t = fs.readFileSync(snip, 'utf8').replace(/\r\n/g, '\n').trim(); const m = t.match(/^\/\/ IMPORTS: (.*)\n?/); if (m) { t = t.slice(m[0].length); s = s.replace(/^(import [^\n]*\n)+/, (imps) => imps + m[1].trim() + '\n'); console.log('imports +', m[1].trim()); } s = s.trimEnd() + '\n\n' + t + '\n'; fs.writeFileSync(p, s.replace(/\n/g, nl)); console.log('ok', p.split('/').pop()); };
app(`${D}/src/dominio/reductor.test.ts`, `${I}/reductor.test.snippet.ts`);
app(`${D}/src/dominio/persistencia.test.ts`, `${I}/persistencia.test.snippet.ts`);
app(`${D}/src/estilos.css`, `${I}/estilos.snippet.css`);
