import { strToU8, zlibSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { evaluar } from '../evaluacion.js';
import { reducir } from '../reductor.js';
import { nuevoSistema } from '../sistema.js';
import { extraer } from './index.js';
import {
  candidatosDePdf,
  coloresDeContenido,
  decodificarFlujo,
  evaluarFuncionTipo4,
  familiaDeFuente,
  leerPdf,
  resumenDePdf,
  type ColorPdf,
} from './pdf.js';

/**
 * Arma un PDF mínimo con los objetos dados. Los flujos pueden ir comprimidos
 * (FlateDecode) o a la vista. No hace falta una tabla de referencias correcta:
 * el lector no la usa.
 */
function pdf(objetos: Array<string | { diccionario: string; contenido: string; comprimir?: boolean }>): Uint8Array {
  const partes: Uint8Array[] = [strToU8('%PDF-1.7\n%\xe2\xe3\xcf\xd3\n', true)];
  objetos.forEach((o, i) => {
    const n = i + 1;
    if (typeof o === 'string') {
      partes.push(strToU8(`${n} 0 obj\n${o}\nendobj\n`, true));
      return;
    }
    const crudo = strToU8(o.contenido, true);
    const datos = o.comprimir ? zlibSync(crudo) : crudo;
    const filtro = o.comprimir ? ' /Filter /FlateDecode' : '';
    partes.push(strToU8(`${n} 0 obj\n<< ${o.diccionario} /Length ${datos.length}${filtro} >>\nstream\n`, true));
    partes.push(datos);
    partes.push(strToU8('\nendstream\nendobj\n', true));
  });
  partes.push(strToU8('trailer\n<< /Root 1 0 R >>\n%%EOF\n', true));
  const total = partes.reduce((s, p) => s + p.length, 0);
  const salida = new Uint8Array(total);
  let pos = 0;
  for (const p of partes) {
    salida.set(p, pos);
    pos += p.length;
  }
  return salida;
}

const CONTENIDO = `
q
0 0.95 1 0 k
0 0 100 100 re f
0.2 0.4 0.6 rg
0 0 50 50 re f
0 0.95 1 0 k
10 10 20 20 re f
0 0 0 1 K
2 w 0 0 m 100 100 l S
/CS0 cs 1 scn
0 0 5 5 re f
/DeviceCMYK cs 1 0 0 0 sc
0 0 5 5 re f
BT /F1 24 Tf (texto con 1 0 0 rg adentro \\) y 0 0 1 rg) Tj ET
Q
`;

const PAGINA_A3_CON_SANGRADO = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 858.9 1207.6] /TrimBox [8.5 8.5 850.4 1199.1]
   /Resources << /Font << /F1 5 0 R /F2 6 0 R >> /ColorSpace << /CS0 [/Separation /PANTONE#20485#20C /DeviceCMYK 7 0 R] >> >>
   /Contents 4 0 R >>`;

function pdfDePrueba(): Uint8Array {
  return pdf([
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R 8 0 R] /Count 2 >>',
    PAGINA_A3_CON_SANGRADO,
    { diccionario: '', contenido: CONTENIDO, comprimir: true },
    '<< /Type /Font /Subtype /Type1 /BaseFont /ABCDEF+Anton-Regular >>',
    '<< /Type /Font /Subtype /TrueType /BaseFont /GHIJKL+Montserrat-Bold >>',
    '<< /FunctionType 2 /Domain [0 1] /C0 [0 0 0 0] /C1 [0 0.95 1 0] /N 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 858.9 1207.6] /Contents 9 0 R >>',
    { diccionario: '', contenido: '0 0 0 1 k 0 0 10 10 re f', comprimir: false },
  ]);
}

describe('pdf: operadores de color', () => {
  it('cuenta cada color por espacio y salta cadenas, espacios con nombre y datos de imagen en línea', () => {
    const cuenta = new Map<string, ColorPdf>();
    coloresDeContenido(CONTENIDO, cuenta);
    const colores = [...cuenta.values()];
    const clave = (c: ColorPdf) => `${c.espacio} ${c.componentes.join(' ')} ×${c.usos}`;
    expect(colores.map(clave).sort()).toEqual(['CMYK 0 0 0 1 ×1', 'CMYK 0 0.95 1 0 ×2', 'CMYK 1 0 0 0 ×1', 'RGB 0.2 0.4 0.6 ×1'].sort());
  });

  it('una imagen en línea no aporta colores falsos', () => {
    const cuenta = new Map<string, ColorPdf>();
    coloresDeContenido('BI /W 1 /H 1 /BPC 8 /CS /RGB ID \x01 1 0 0 rg \x02 EI 0.5 g', cuenta);
    expect([...cuenta.values()].map((c) => `${c.espacio} ${c.componentes.join(' ')}`)).toEqual(['Gris 0.5']);
  });
});

describe('pdf: lectura', () => {
  it('lee colores (con su CMYK), la tinta plana con su equivalente, familias y la medida al corte', () => {
    const l = leerPdf(pdfDePrueba());
    expect(l.cifrado).toBe(false);
    expect(l.paginas).toBe(2);
    expect(l.medida).toEqual({ ancho: 297, alto: 420, caja: 'TrimBox' });
    expect(l.soporte).toEqual({ ancho: 303, alto: 426, caja: 'MediaBox' });
    expect(l.fuentes).toEqual(['Anton-Regular', 'Montserrat-Bold']);
    expect(l.familias).toEqual(['Anton', 'Montserrat']);
    expect(l.tintasPlanas).toEqual([{ nombre: 'PANTONE 485 C', alternativo: 'CMYK', componentes: [0, 0.95, 1, 0], hex: '#ff0d00' }]);
    // El negro de la segunda página (a la vista, sin comprimir) suma usos al del trazo.
    expect(l.colores[0]).toMatchObject({ espacio: 'CMYK', componentes: [0, 0.95, 1, 0], usos: 2 });
    expect(l.colores.find((c) => c.componentes.join() === '0,0,0,1')?.usos).toBe(2);
    expect(l.flujosSinLeer).toBe(0);
  });

  it('respeta /Length: un flujo comprimido que termina en 0x0A no pierde su último byte', () => {
    // Se busca un contenido cuyo zlib termine en un salto de línea (el caso del
    // letrero de Econut exportado por InDesign, que dejaba un flujo sin leer).
    let contenido = '';
    let datos = new Uint8Array();
    for (let n = 0; n < 5000; n += 1) {
      // Un comentario de largo variable mueve la suma de control de zlib por todos sus valores.
      contenido = `% ${'a'.repeat(n)}\n0 0 0 1 k 0 0 1 1 re f`;
      datos = zlibSync(strToU8(contenido));
      if (datos[datos.length - 1] === 0x0a) break;
    }
    expect(datos[datos.length - 1]).toBe(0x0a);
    const bytes = pdf(['<< /Type /Page /MediaBox [0 0 100 100] >>', { diccionario: '', contenido, comprimir: true }]);
    const l = leerPdf(bytes);
    expect(l.flujosSinLeer).toBe(0);
    expect(l.colores.map((c) => c.componentes.join(' '))).toEqual(['0 0 0 1']);
  });

  it('sin fuentes, el resumen dice que el texto puede venir en trazados', () => {
    const l = leerPdf(pdf(['<< /Type /Page /MediaBox [0 0 100 100] >>', { diccionario: '', contenido: '0 g 0 0 1 1 re f' }]));
    expect(resumenDePdf(l)).toMatch(/No trae fuentes: el texto puede estar convertido en trazados/);
  });

  it('un PDF cifrado no se lee y lo dice', () => {
    const bytes = pdf(['<< /Type /Catalog >>']);
    const cifrado = new Uint8Array([...bytes, ...strToU8('trailer << /Encrypt 9 0 R >>')]);
    const l = leerPdf(cifrado);
    expect(l.cifrado).toBe(true);
    expect(resumenDePdf(l)).toMatch(/cifrado/);
    expect(candidatosDePdf(l, 'x')).toEqual([]);
  });

  it('un filtro que no se lee se cuenta, no se esconde', () => {
    const bytes = pdf([{ diccionario: '/Filter /LZWDecode', contenido: 'basura' }]);
    expect(leerPdf(bytes).flujosSinLeer).toBe(1);
  });

  it('un archivo que no es PDF se rechaza', () => {
    expect(() => leerPdf(strToU8('hola'))).toThrow(/PDF/);
  });

  it('la familia sale del nombre PostScript', () => {
    expect(familiaDeFuente('ABCDEF+Anton-Regular')).toBe('Anton');
    expect(familiaDeFuente('Arial,Bold')).toBe('Arial');
    expect(familiaDeFuente('HelveticaNeue')).toBe('HelveticaNeue');
  });
});

describe('pdf: filtros y funciones de tinta', () => {
  it('encadena ASCII85 y Flate, como los escribe ReportLab', () => {
    // «0 0 0 1 k» comprimido y luego en ASCII85.
    const flate = zlibSync(strToU8('0 0 0 1 k'));
    let a85 = '';
    for (let i = 0; i < flate.length; i += 4) {
      const grupo = [...flate.subarray(i, i + 4)];
      const n = grupo.length;
      while (grupo.length < 4) grupo.push(0);
      let v = ((grupo[0] ?? 0) * 2 ** 24 + (grupo[1] ?? 0) * 2 ** 16 + (grupo[2] ?? 0) * 2 ** 8 + (grupo[3] ?? 0)) >>> 0;
      const c: string[] = [];
      for (let k = 0; k < 5; k += 1) {
        c.unshift(String.fromCharCode((v % 85) + 33));
        v = Math.floor(v / 85);
      }
      a85 += c.slice(0, n + 1).join('');
    }
    const datos = decodificarFlujo('<< /Filter [/ASCII85Decode /FlateDecode] >>', strToU8(`${a85}~>`, true));
    expect(new TextDecoder().decode(datos)).toBe('0 0 0 1 k');
    expect(decodificarFlujo('<< /Filter /AHx >>', strToU8('30206B>'))).toEqual(strToU8('0 k'));
    expect(decodificarFlujo('<< /Filter /LZWDecode >>', strToU8('x'))).toBeUndefined();
  });

  it('evalúa la función de tinta de tipo 4 con la tinta llena', () => {
    expect(evaluarFuncionTipo4('{ dup 0.9 mul exch dup 0 mul exch dup 1 mul exch 0.3 mul }', 1)).toEqual([0.9, 0, 1, 0.3]);
    expect(evaluarFuncionTipo4('{ 1 exch sub }', 1)).toEqual([0]);
    expect(evaluarFuncionTipo4('{ dup sin }', 1)).toBeUndefined();
  });

  it('lee el equivalente de una tinta plana cuya función es un flujo de tipo 4 por referencia', () => {
    const bytes = pdf([
      '<< /Type /Page /MediaBox [0 0 100 100] /Resources << /ColorSpace << /CS0 [/Separation /PANTONE#20356#20C /DeviceCMYK 2 0 R] >> >> >>',
      { diccionario: '/FunctionType 4 /Domain [0 1] /Range [0 1 0 1 0 1 0 1]', contenido: '{ dup 0.9 mul exch dup 0 mul exch dup 1 mul exch 0.3 mul }', comprimir: true },
    ]);
    expect(leerPdf(bytes).tintasPlanas).toEqual([{ nombre: 'PANTONE 356 C', alternativo: 'CMYK', componentes: [0.9, 0, 1, 0.3], hex: '#12b300' }]);
  });
});

describe('pdf: candidatos', () => {
  it('apuntan a dim1.req01 y dim2.req01; el CMYK va en el nombre y se dice aproximado', () => {
    const c = candidatosDePdf(leerPdf(pdfDePrueba()), 'i1');
    expect(c.map((x) => x.requirementId)).toEqual(['dim1.req01', 'dim2.req01']);
    const colores = c[0];
    expect(colores?.detalle).toMatch(/PANTONE 485 C/);
    expect(colores?.detalle).toMatch(/aproximada/);
    const frag = colores?.fragmento as { institucionales: Array<{ name: string; value: string }>; neutros: Array<{ name: string }> };
    expect(frag.institucionales[0]).toEqual({ name: 'PANTONE 485 C', value: '#ff0d00' });
    expect(frag.institucionales.map((e) => e.name)).toContain('CMYK C0 M95 Y100 K0');
    expect(frag.neutros.map((e) => e.name)).toContain('CMYK C0 M0 Y0 K100');
    expect(c[1]?.faltante).toMatch(/PostScript/);
  });

  it('una tinta plana sin equivalente legible se declara como faltante', () => {
    const bytes = pdf([
      '<< /Type /Page /MediaBox [0 0 100 100] /Resources << /ColorSpace << /CS0 [/Separation /Oro#20Especial /DeviceCMYK 3 0 R] >> >> >>',
      { diccionario: '', contenido: '0 0 0 1 k 0 0 1 1 re f' },
      '<< /FunctionType 4 /Domain [0 1] /Range [0 1 0 1 0 1 0 1] >>',
    ]);
    const c = candidatosDePdf(leerPdf(bytes), 'i1');
    expect(c[0]?.faltante).toMatch(/Oro Especial/);
  });

  it('el fragmento de colores incorporado resuelve dim1.req01 en el evaluador real', async () => {
    const insumo = await extraer({ nombre: 'afiche.pdf', extension: 'pdf', bytes: pdfDePrueba() });
    expect(insumo.tipo).toBe('pdf');
    expect(insumo.resumen).toMatch(/2 páginas: 297 × 420 mm al corte \(303 × 426 mm con sangrado\)/);
    const candidato = insumo.candidatos.find((c) => c.requirementId === 'dim1.req01');
    let s = reducir(nuevoSistema('editorial', 'Prueba', '2026-09-27T00:00:00.000Z'), { tipo: 'agregar-insumo', insumo });
    s = reducir(s, { tipo: 'incorporar', insumoId: insumo.id, candidatoIds: [candidato?.id ?? ''] });
    expect(evaluar(s).porRequisito.get('dim1.req01')?.resultado).toBe('resuelto');
  });
});

describe('pdf: miniatura', () => {
  it('con rasterizador, la miniatura queda en el insumo; su paleta sólo entra si no hay colores vectoriales', async () => {
    const rasterizarPdf = async () => ({
      ancho: 10,
      alto: 10,
      pixeles: new Uint8ClampedArray([200, 30, 30, 255, 200, 30, 30, 255]),
      miniatura: 'data:image/jpeg;base64,AAAA',
    });
    const conVector = await extraer({ nombre: 'a.pdf', extension: 'pdf', bytes: pdfDePrueba() }, { rasterizarPdf });
    expect(conVector.miniatura).toBe('data:image/jpeg;base64,AAAA');
    expect(conVector.candidatos.filter((c) => c.requirementId === 'dim1.req01')).toHaveLength(1);
    expect(conVector.candidatos.some((c) => c.etiqueta === 'Paleta dominante')).toBe(false);

    const escaneo = pdf(['<< /Type /Page /MediaBox [0 0 595 842] >>']);
    const sinVector = await extraer({ nombre: 'escaneo.pdf', extension: 'pdf', bytes: escaneo }, { rasterizarPdf });
    expect(sinVector.candidatos.map((c) => c.etiqueta)).toEqual(['Paleta dominante']);
    expect(sinVector.resumen).toMatch(/Sin colores vectoriales/);
  });

  it('si dibujar falla, el insumo entra igual con lo leído y lo dice', async () => {
    const rasterizarPdf = async () => {
      throw new Error('sin lienzo');
    };
    const insumo = await extraer({ nombre: 'a.pdf', extension: 'pdf', bytes: pdfDePrueba() }, { rasterizarPdf });
    expect(insumo.miniatura).toBeUndefined();
    expect(insumo.candidatos).toHaveLength(2);
    expect(insumo.resumen).toMatch(/No se pudo dibujar la página: sin lienzo/);
  });
});
