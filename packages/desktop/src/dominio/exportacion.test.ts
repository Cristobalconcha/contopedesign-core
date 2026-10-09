import { GENERADORES, generadorDegradadosSvg, generadorGrillaSvg, generadorPaletaAse, huella, leerMetadataDeLeeme, type Generador } from '@contope/core';
import { strFromU8, unzipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { generarEnElTaller, type CelulaGenerada } from './celulas.js';
import { exportarAdn } from './exportacion.js';
import { reducir } from './reductor.js';
import { nuevoSistema, type Sistema } from './sistema.js';

const AHORA = '2026-10-08T12:00:00.000Z';
const DESPUES = '2026-10-09T15:30:00.000Z';

function definirColor(s: Sistema, institucionales: Array<{ name: string; value: string }>, neutros: Array<{ name: string; value: string }>): Sistema {
  return reducir(
    s,
    { tipo: 'definir', requirementId: 'dim1.req01', payload: { institucionales, neutros }, camino: 'diseñador', fuerza: 'prioritaria' },
    AHORA,
  );
}

function conColor(): Sistema {
  return definirColor(
    nuevoSistema('marca', 'Econut', AHORA),
    [
      { name: 'Azul', value: '#1d4ed8' },
      { name: 'Verde', value: '#15803d' },
    ],
    [{ name: 'Tinta', value: '#1a1f23' }],
  );
}

function registrar(s: Sistema, generador: Generador, parametros: Record<string, unknown> = {}): { sistema: Sistema; celula: CelulaGenerada } {
  const r = generarEnElTaller(s, generador, parametros, AHORA);
  if (!r.ok) throw new Error(r.falta);
  return { sistema: reducir(s, { tipo: 'registrar-celula', celula: r.celula }, AHORA), celula: r.celula };
}

describe('Exportar el ADN', () => {
  it('un solo zip: la cápsula en la raíz y una carpeta por Célula Madre, cada una con su LEEME y su archivo', () => {
    let s = conColor();
    s = registrar(s, generadorPaletaAse).sistema;
    s = registrar(s, generadorDegradadosSvg).sistema;
    const e = exportarAdn(s, DESPUES);
    expect(e.zip.nombre).toBe('econut-adn.zip');
    expect(e.zip.tipoMime).toBe('application/zip');
    const dentro = unzipSync(e.zip.contenido);
    expect(Object.keys(dentro)).toEqual([
      'LEEME.md',
      'design-contract.json',
      'DESIGN.md',
      'celulas-madre/econut-paleta-ase/LEEME.md',
      'celulas-madre/econut-paleta-ase/econut-paleta.ase',
      'celulas-madre/econut-degradados-svg/LEEME.md',
      'celulas-madre/econut-degradados-svg/econut-degradados.svg',
    ]);
    expect(strFromU8(dentro['design-contract.json']!)).toBe(e.capsula.archivos[0]!.texto);
    expect(strFromU8(dentro['DESIGN.md']!)).toBe(e.capsula.designMd);
    // Cada LEEME de Célula Madre es el mismo que el de su zip suelto, y su ficha nombra el archivo que está al lado.
    const suelto = generarEnElTaller(s, generadorPaletaAse, {}, DESPUES);
    if (!suelto.ok) throw new Error(suelto.falta);
    expect(strFromU8(dentro['celulas-madre/econut-paleta-ase/LEEME.md']!)).toBe(suelto.leeme.contenido);
    expect(dentro['celulas-madre/econut-paleta-ase/econut-paleta.ase']).toEqual(suelto.archivos[0]!.contenido);
    const raiz = strFromU8(dentro['LEEME.md']!);
    expect(raiz).toContain('# Econut · ADN exportado');
    expect(raiz).toContain('- `design-contract.json`: las definiciones del sistema');
    expect(raiz).toContain('- `celulas-madre/econut-paleta-ase/`: Paleta de color (versión 1.0.0), con `econut-paleta.ase`. Al día con este ADN; lo anotado en «Lo generado» ya estaba al día.');
    expect(raiz).not.toContain('Lo que quedó fuera');
    expect(e.incluidas.map((c) => c.carpeta)).toEqual(['celulas-madre/econut-paleta-ase', 'celulas-madre/econut-degradados-svg']);
  });

  it('una Célula Madre que el ADN ya no alcanza queda fuera y anotada en el LEEME de la raíz', () => {
    let s = conColor();
    s = registrar(s, generadorPaletaAse).sistema;
    s = registrar(s, generadorDegradadosSvg).sistema;
    // Queda un solo color: la paleta se puede hacer; un degradado, no.
    s = definirColor(s, [{ name: 'Azul', value: '#1d4ed8' }], []);
    s = { ...s, celulasMadre: [...s.celulasMadre, { ...s.celulasMadre[0]!, id: 'celula-fantasma', metadata: { ...s.celulasMadre[0]!.metadata, generador: { id: 'ya-no-existe', version: '1.0.0', nombre: 'Retícula vieja' } } }] };
    const e = exportarAdn(s, DESPUES);
    const dentro = unzipSync(e.zip.contenido);
    expect(Object.keys(dentro).filter((r) => r.startsWith('celulas-madre/'))).toEqual([
      'celulas-madre/econut-paleta-ase/LEEME.md',
      'celulas-madre/econut-paleta-ase/econut-paleta.ase',
    ]);
    expect(e.omitidas.map((o) => o.nombre)).toEqual(['Degradados', 'Retícula vieja']);
    const raiz = strFromU8(dentro['LEEME.md']!);
    expect(raiz).toContain('## Lo que quedó fuera');
    expect(raiz).toContain('- Degradados: no se pudo generar con este ADN. Un degradado necesita al menos dos colores');
    expect(raiz).toContain('- Retícula vieja: este generador ya no existe en esta versión de la app.');
  });

  it('regenera con el ADN que se exporta: la huella del ancestro es la de hoy, no la del registro', () => {
    const { sistema: s0, celula } = registrar(conColor(), generadorPaletaAse, { incluirRoles: false });
    const s = definirColor(s0, [{ name: 'Azul', value: '#0000ff' }], [{ name: 'Tinta', value: '#1a1f23' }]);
    const e = exportarAdn(s, DESPUES);
    const leeme = strFromU8(unzipSync(e.zip.contenido)['celulas-madre/econut-paleta-ase/LEEME.md']!);
    const ficha = leerMetadataDeLeeme(leeme);
    if (!ficha.ok) throw new Error(ficha.motivo);
    const hoy = huella(s.designSet.entries.find((x) => x.requirementId === 'dim1.req01')!.payload);
    const antes = celula.metadata.ancestros.find((a) => a.requirementId === 'dim1.req01')!.huella;
    expect(antes).not.toBe(hoy);
    expect(ficha.metadata.ancestros.find((a) => a.requirementId === 'dim1.req01')!.huella).toBe(hoy);
    // Con los parámetros guardados y la fecha de la exportación.
    expect(ficha.metadata.parametros['incluirRoles']).toBe(false);
    expect(ficha.metadata.generadoEn).toBe(DESPUES);
    expect(e.incluidas[0]!.antes).toEqual({ estado: 'desactualizada', cambios: [{ requirementId: 'dim1.req01', motivo: 'cambio' }] });
    expect(strFromU8(unzipSync(e.zip.contenido)['LEEME.md']!)).toContain('lo anotado en «Lo generado» estaba desactualizado: cambió «Fundamento cromático».');
    // El registro del taller no se toca.
    expect(s.celulasMadre).toEqual([celula]);
  });

  it('es determinista, y dos generaciones del mismo generador van en carpetas distintas', () => {
    let s = conColor();
    s = registrar(s, generadorDegradadosSvg).sistema;
    s = registrar(s, generadorDegradadosSvg, { forma: 'radial' }).sistema;
    const a = exportarAdn(s, DESPUES);
    expect(a.zip.contenido).toEqual(exportarAdn(s, DESPUES).zip.contenido);
    expect(a.incluidas.map((c) => c.carpeta)).toEqual(['celulas-madre/econut-degradados-svg', 'celulas-madre/econut-degradados-svg-2']);
  });

  it('sin Células Madre, el zip trae la cápsula y el LEEME lo dice', () => {
    const e = exportarAdn(conColor(), DESPUES);
    const dentro = unzipSync(e.zip.contenido);
    expect(Object.keys(dentro)).toEqual(['LEEME.md', 'design-contract.json', 'DESIGN.md']);
    expect(strFromU8(dentro['LEEME.md']!)).toContain('Este sistema todavía no tiene Células Madre generadas.');
  });

  it('la Grilla entra sola, por estar en el registro: su carpeta trae el LEEME y un SVG por retícula y formato', () => {
    expect(GENERADORES).toContain(generadorGrillaSvg);
    const definir = (sis: Sistema, requirementId: string, payload: Record<string, unknown>): Sistema =>
      reducir(sis, { tipo: 'definir', requirementId, payload, camino: 'diseñador', fuerza: 'prioritaria' }, AHORA);
    let s = conColor();
    s = definir(s, 'dim3.req01', { unidad: '1mm', escala: [{ step: 4, value: '4mm' }, { step: 5, value: '5mm' }] });
    s = definir(s, 'dim3.req04', { reticulas: [{ contexto: 'folleto', columns: 3, gap: { refReqId: 'dim3.req01', refPath: ['escala', 1] } }] });
    s = definir(s, 'dim3.req08', { formatos: [{ nombre: 'carta', formato: 'letter', orientacion: 'vertical', modo: 'pagina-fija' }] });
    s = definir(s, 'dim3.req09', {
      porFormato: [{ formato: { refReqId: 'dim3.req08', refPath: ['formatos', 0] }, sangrado: '5mm', zonaSegura: '15mm', margenTextoCorrido: '20mm', aSangre: ['fondos'] }],
    });
    s = registrar(s, generadorGrillaSvg).sistema;
    const e = exportarAdn(s, DESPUES);
    const dentro = unzipSync(e.zip.contenido);
    expect(Object.keys(dentro).filter((r) => r.startsWith('celulas-madre/'))).toEqual([
      'celulas-madre/econut-grilla-svg/LEEME.md',
      'celulas-madre/econut-grilla-svg/econut-grilla-folleto-carta.svg',
    ]);
    const svg = strFromU8(dentro['celulas-madre/econut-grilla-svg/econut-grilla-folleto-carta.svg']!);
    expect(svg).toContain('width="225.9mm" height="289.4mm" viewBox="-5 -5 225.9 289.4"');
    const leeme = strFromU8(dentro['celulas-madre/econut-grilla-svg/LEEME.md']!);
    expect(leeme).toContain('3 columnas de 55,3 mm con medianil de 5 mm; márgenes de 20 mm por lado');
    expect(strFromU8(dentro['LEEME.md']!)).toContain('- `celulas-madre/econut-grilla-svg/`: Grilla (versión 1.1.0), con `econut-grilla-folleto-carta.svg`.');
  });
});
