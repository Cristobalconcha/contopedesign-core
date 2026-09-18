import { strToU8, zipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { evaluar } from '../evaluacion.js';
import { reducir } from '../reductor.js';
import { nuevoSistema } from '../sistema.js';
import { aHex, cmykARgb, esNeutro, normalizarColorCss } from './color.js';
import { candidatosDeCss, leerCss } from './css.js';
import { candidatosDeIdml, leerIdml } from './idml.js';
import { paletaDePixeles } from './imagen.js';
import { extraer, tipoDeArchivo } from './index.js';
import { candidatosDeTokens, leerTokens } from './tokens-w3c.js';

const CSS = `
:root {
  --oliva-700: #70745E;
  --dorado-500: rgb(205, 162, 61);
  --papel: #f6f6f3;
  --tinta: #1a1f23;
  --fuente-titulos: "Lora", Georgia, serif;
  --espacio-1: 4px;
  --espacio-2: 8px;
}
h1 { font-family: Archivo, sans-serif; margin-bottom: 1.5rem; color: #6E5F5F; }
p { padding: 16px; }
`;

describe('color', () => {
  it('normaliza hex y rgb(); clasifica neutros por saturación; CMYK aproximado', () => {
    expect(normalizarColorCss('#ABC')).toBe('#aabbcc');
    expect(normalizarColorCss('rgb(205, 162, 61)')).toBe('#cda23d');
    expect(normalizarColorCss('var(--x)')).toBeUndefined();
    expect(esNeutro({ r: 246, g: 246, b: 243 })).toBe(true);
    expect(esNeutro({ r: 205, g: 162, b: 61 })).toBe(false);
    expect(aHex(cmykARgb(0, 0, 0, 100))).toBe('#000000');
    expect(aHex(cmykARgb(0, 0, 0, 0))).toBe('#ffffff');
  });
});

describe('css', () => {
  it('lee variables y declaraciones: colores con nombre, familias con su stack, longitudes', () => {
    const l = leerCss(CSS);
    expect(l.colores).toEqual([
      { nombre: 'oliva-700', valor: '#70745e' },
      { nombre: 'dorado-500', valor: '#cda23d' },
      { nombre: 'papel', valor: '#f6f6f3' },
      { nombre: 'tinta', valor: '#1a1f23' },
      { nombre: '', valor: '#6e5f5f' },
    ]);
    expect(l.familias).toEqual([
      { nombre: 'Lora', stack: ['Lora', 'Georgia', 'serif'] },
      { nombre: 'Archivo', stack: ['Archivo', 'sans-serif'] },
    ]);
    expect(l.longitudes).toEqual(['4px', '8px', '1.5rem', '16px']);
  });

  it('los candidatos apuntan a los requisitos reales y declaran lo que falta', () => {
    const c = candidatosDeCss(leerCss(CSS), 'x');
    expect(c.map((k) => k.requirementId)).toEqual(['dim1.req01', 'dim2.req01', 'dim3.req01']);
    const familias = c[1]!;
    expect(familias.faltante).toMatch(/licencia/);
    const colores = c[0]!.fragmento as { institucionales: unknown[]; neutros: unknown[] };
    expect(colores.institucionales).toHaveLength(3);
    expect(colores.neutros).toHaveLength(2);
    const escala = c[2]!.fragmento as { unidad: string; escala: Array<{ step: number; value: string }> };
    expect(escala.unidad).toBe('4px');
    expect(escala.escala.map((e) => e.value)).toEqual(['4px', '8px', '16px', '1.5rem']);
  });

  it('el fragmento de colores incorporado resuelve dim1.req01 en el evaluador real', () => {
    let s = nuevoSistema('digital', 'P', '2026-09-14T00:00:00.000Z');
    const candidatos = candidatosDeCss(leerCss(CSS), 'x');
    s = reducir(s, {
      tipo: 'agregar-insumo',
      insumo: { id: 'i', nombre: 'a.css', extension: 'css', tipo: 'css', tamanoBytes: 1, incorporadoEn: '', resumen: '', carril: 'referente', tomar: null, candidatos },
    });
    s = reducir(s, { tipo: 'incorporar', insumoId: 'i', candidatoIds: candidatos.map((c) => c.id) });
    const e = evaluar(s);
    expect(e.porRequisito.get('dim1.req01')?.resultado).toBe('resuelto');
    expect(e.porRequisito.get('dim3.req01')?.resultado).toBe('resuelto');
    // Sin licencia ni idiomas, tipografía queda no-resuelta y lo dice.
    const tipo = e.porRequisito.get('dim2.req01');
    expect(tipo?.resultado).toBe('no-resuelto');
    expect(tipo?.motivos.map((m) => m.mensaje).join(' ')).toMatch(/licencia|idiomas/);
  });
});

describe('tokens w3c', () => {
  it('recorre el árbol heredando $type y agrupa por tipo', () => {
    const l = leerTokens({
      color: { $type: 'color', marca: { oliva: { $value: '#70745E' }, gris: { $value: '#888888' } } },
      fuente: { titulos: { $type: 'fontFamily', $value: ['Lora', 'serif'] } },
      espacio: { $type: 'dimension', chico: { $value: '4px' }, grande: { $value: { value: 16, unit: 'px' } } },
    });
    expect(l.total).toBe(5);
    expect(l.colores).toEqual([
      { nombre: 'color.marca.oliva', valor: '#70745e' },
      { nombre: 'color.marca.gris', valor: '#888888' },
    ]);
    expect(l.familias).toEqual([{ nombre: 'Lora', stack: ['Lora', 'serif'] }]);
    expect(l.longitudes).toEqual([
      { nombre: 'espacio.chico', valor: '4px' },
      { nombre: 'espacio.grande', valor: '16px' },
    ]);
    const c = candidatosDeTokens(l, 't');
    expect(c.map((k) => k.requirementId)).toEqual(['dim1.req01', 'dim2.req01', 'dim3.req01']);
  });
});

describe('idml', () => {
  const GRAPHIC = `<?xml version="1.0"?><idPkg:Graphic xmlns:idPkg="x">
    <Color Self="Color/Black" Model="Process" Space="CMYK" ColorValue="0 0 0 100" Name="Black"/>
    <Color Self="Color/oliva" Model="Process" Space="CMYK" ColorValue="30 20 60 20" Name="Oliva 700"/>
    <Color Self="Color/rgb" Model="Process" Space="RGB" ColorValue="205 162 61" Name="Dorado"/>
    <Color Self="Color/u" Model="Process" Space="CMYK" ColorValue="0 0 0 0" Name="$ID/Paper"/>
  </idPkg:Graphic>`;
  const FONTS = `<idPkg:Fonts xmlns:idPkg="x"><FontFamily Self="f1" Name="Adobe Caslon Pro"><Font Self="f1a" FontFamily="Adobe Caslon Pro" Name="Adobe Caslon Pro Regular"/></FontFamily><FontFamily Self="f2" Name="Lora"/></idPkg:Fonts>`;
  const STYLES = `<idPkg:Styles xmlns:idPkg="x"><RootParagraphStyleGroup>
    <ParagraphStyle Self="ParagraphStyle/$ID/NormalParagraphStyle" Name="$ID/NormalParagraphStyle"/>
    <ParagraphStyle Self="ParagraphStyle/Titulo" Name="Título" PointSize="24" FontStyle="Bold"><Properties><AppliedFont type="string">Lora</AppliedFont><Leading type="unit">28</Leading></Properties></ParagraphStyle>
    <ParagraphStyle Self="ParagraphStyle/Cuerpo" Name="Cuerpo" PointSize="10.5" AppliedFont="Adobe Caslon Pro" Leading="14"/>
  </RootParagraphStyleGroup></idPkg:Styles>`;

  const zip = zipSync({
    'mimetype': strToU8('application/vnd.adobe.indesign-idml-package'),
    'Resources/Graphic.xml': strToU8(GRAPHIC),
    'Resources/Fonts.xml': strToU8(FONTS),
    'Resources/Styles.xml': strToU8(STYLES),
  });

  it('lee colores (sin los de sistema), familias y estilos de párrafo del ZIP', () => {
    const l = leerIdml(zip);
    expect(l.colores.map((c) => c.nombre)).toEqual(['Oliva 700', 'Dorado']);
    expect(l.colores[1]?.hex).toBe('#cda23d');
    expect(l.colores[0]?.espacio).toBe('CMYK');
    expect(l.familias).toEqual(['Adobe Caslon Pro', 'Lora']);
    expect(l.estilos).toEqual([
      { nombre: 'Título', familia: 'Lora', estilo: 'Bold', cuerpo: 24, interlinea: 28 },
      { nombre: 'Cuerpo', familia: 'Adobe Caslon Pro', estilo: undefined, cuerpo: 10.5, interlinea: 14 },
    ]);
  });

  it('los candidatos dicen que el CMYK es aproximado y no mapean estilos a roles por su cuenta', () => {
    const c = candidatosDeIdml(leerIdml(zip), 'i');
    expect(c[0]?.detalle).toMatch(/CMYK/);
    const estilos = c.find((k) => k.requirementId === 'dim2.req02');
    expect(estilos?.fragmento).toEqual({});
    expect(estilos?.faltante).toMatch(/a mano/);
  });

  it('extraer() enruta por extensión y un archivo ilegible queda registrado igual', async () => {
    const bueno = await extraer({ nombre: 'doc.idml', extension: 'idml', bytes: zip }, { ahora: 'x' });
    expect(bueno.tipo).toBe('idml');
    expect(bueno.candidatos.length).toBe(3);
    const malo = await extraer({ nombre: 'doc.idml', extension: 'idml', bytes: new Uint8Array([1, 2, 3]) });
    expect(malo.candidatos).toEqual([]);
    expect(malo.resumen).toMatch(/No se pudo leer/);
    const pdf = await extraer({ nombre: 'x.pdf', extension: 'pdf', bytes: new Uint8Array() });
    expect(pdf.resumen).toMatch(/no está construido/);
  });
});

describe('imagen', () => {
  it('encuentra los colores dominantes y separa los casi iguales', () => {
    const px: number[] = [];
    for (let i = 0; i < 1000; i++) px.push(112, 116, 94, 255); // oliva
    for (let i = 0; i < 500; i++) px.push(205, 162, 61, 255); // dorado
    for (let i = 0; i < 300; i++) px.push(114, 118, 96, 255); // oliva casi igual
    for (let i = 0; i < 10; i++) px.push(0, 0, 255, 0); // transparente, se ignora
    const paleta = paletaDePixeles(new Uint8ClampedArray(px), 5).map(aHex);
    expect(paleta).toEqual(['#70745e', '#cda23d']);
  });
});

describe('tipoDeArchivo', () => {
  it('distingue tokens W3C de un JSON cualquiera por sus claves', () => {
    expect(tipoDeArchivo('json', strToU8('{"a":{"$value":"#fff","$type":"color"}}'))).toBe('tokens-w3c');
    expect(tipoDeArchivo('json', strToU8('{"a":1}'))).toBe('otro');
    expect(tipoDeArchivo('JPG')).toBe('imagen');
    expect(tipoDeArchivo('scss')).toBe('css');
  });
});
