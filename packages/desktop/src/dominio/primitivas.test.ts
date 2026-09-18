import { describe, expect, it } from 'vitest';
import { sistemaConDim3Completa } from './evaluacion.test.js';
import { REQUISITOS } from './manifiesto.js';
import { muestraDePayload, tipoDePaquete } from './primitivas.js';
import { reducir } from './reductor.js';
import { nuevoSistema } from './sistema.js';

describe('tipoDePaquete', () => {
  it('cada requisito del manifiesto tiene una primitiva que no es "nada"', () => {
    for (const r of REQUISITOS) expect(tipoDePaquete(r.packageId)).not.toBe('nada');
  });
  it('superficies, familia y roles se distinguen del resto de su dimensión', () => {
    expect(tipoDePaquete('pkg.color.superficies')).toBe('superficie');
    expect(tipoDePaquete('pkg.color.roles')).toBe('color');
    expect(tipoDePaquete('pkg.tipografia.fundamento')).toBe('familia');
    expect(tipoDePaquete('pkg.tipografia.lectura')).toBe('roles');
    expect(tipoDePaquete('pkg.espacio.reticula')).toBe('reticula');
  });
});

describe('muestraDePayload', () => {
  it('sin entrada es "nada": lo no resuelto no se parece a un color gris', () => {
    expect(muestraDePayload(nuevoSistema('digital', 'x').designSet, 'dim1.req01')).toEqual({ tipo: 'nada' });
  });

  it('lee los colores del fundamento y resuelve referencias en los roles', () => {
    let s = nuevoSistema('digital', 'x');
    s = reducir(s, {
      tipo: 'definir',
      requirementId: 'dim1.req01',
      payload: { institucionales: [{ name: 'oliva', value: '#70745e' }], neutros: [{ name: 'papel', value: '#f6f6f3' }] },
      camino: 'diseñador',
      fuerza: 'inamovible',
    });
    s = reducir(s, {
      tipo: 'definir',
      requirementId: 'dim1.req02',
      payload: {
        roleColors: [
          { role: 'background', color: { refReqId: 'dim1.req01', refPath: ['neutros', 0, 'value'] }, source: 'x', derivation: { of: 'dim1.req01' } },
          { role: 'accent', color: '#cda23d', source: 'x', derivation: { of: 'direct', rule: 'r' } },
        ],
      },
      camino: 'diseñador',
      fuerza: 'inamovible',
    });
    expect(muestraDePayload(s.designSet, 'dim1.req01')).toEqual({ tipo: 'color', colores: ['#70745e', '#f6f6f3'] });
    expect(muestraDePayload(s.designSet, 'dim1.req02')).toEqual({ tipo: 'color', colores: ['#f6f6f3', '#cda23d'] });
  });

  it('espacio: la escala, los roles (con refs) y la retícula', () => {
    const set = sistemaConDim3Completa().designSet;
    expect(muestraDePayload(set, 'dim3.req01')).toEqual({ tipo: 'espacio', valores: ['4px', '8px', '16px'] });
    expect(muestraDePayload(set, 'dim3.req02')).toEqual({ tipo: 'espacio', valores: ['4px', '8px', '32px'] });
    expect(muestraDePayload(set, 'dim3.req04')).toEqual({ tipo: 'reticula', columnas: 4 });
    expect(muestraDePayload(set, 'dim3.req07').tipo).toBe('texto');
  });
});

describe('declaraciones', () => {
  it('definir por declaración muestra el texto declarado', () => {
    let s = nuevoSistema('digital', 'x');
    s = reducir(s, {
      tipo: 'definir',
      requirementId: 'dim10.req04',
      payload: { declaracion: 'Pliegos de 8, corchete y hotmelt', ejecuta: 'proveedor' },
      camino: 'diseñador',
      fuerza: 'inamovible',
    });
    expect(muestraDePayload(s.designSet, 'dim10.req04')).toEqual({ tipo: 'texto', texto: 'Pliegos de 8, corchete y hotmelt' });
  });

  it('el «no aplica» escrito se muestra como tal', () => {
    let s = nuevoSistema('digital', 'x');
    s = reducir(s, {
      tipo: 'definir',
      requirementId: 'dim10.req02',
      payload: { noAplica: 'sólo vive en pantalla' },
      camino: 'diseñador',
      fuerza: 'inamovible',
    });
    const m = muestraDePayload(s.designSet, 'dim10.req02');
    expect(m.tipo).toBe('texto');
    if (m.tipo !== 'texto') throw new Error('se esperaba una muestra de texto');
    expect(m.texto.startsWith('no aplica: ')).toBe(true);
  });
});

describe('primitivas de forma, interacción, movimiento y patrones', () => {
  it('tipoDePaquete: interacción, movimiento y patrones tienen primitiva propia', () => {
    expect(tipoDePaquete('pkg.interaccion.estados')).toBe('estados');
    expect(tipoDePaquete('pkg.movimiento.tiempo')).toBe('movimiento');
    expect(tipoDePaquete('pkg.patrones.anatomia')).toBe('arquetipos');
    expect(tipoDePaquete('pkg.forma.borde')).toBe('radio');
  });

  it('dim4.req02: el radio del primer rol con medida se muestra como tal', () => {
    let s = nuevoSistema('digital', 'x');
    s = reducir(s, {
      tipo: 'definir',
      requirementId: 'dim4.req01',
      payload: { roles: [{ nombre: 'tarjeta', descripcion: 'caja con aire interno' }] },
      camino: 'diseñador',
      fuerza: 'inamovible',
    });
    s = reducir(s, {
      tipo: 'definir',
      requirementId: 'dim4.req02',
      payload: {
        formas: [
          {
            rol: { refReqId: 'dim4.req01', refPath: ['roles', 0] },
            vocabulario: 'recto con esquinas suaves',
            radio: 'longitud',
            radioValor: '12px',
          },
        ],
      },
      camino: 'diseñador',
      fuerza: 'inamovible',
    });
    expect(muestraDePayload(s.designSet, 'dim4.req02')).toEqual({ tipo: 'radio', radio: '12px' });
  });

  it('dim4.req02: un vocabulario sin radio se muestra como 0', () => {
    let s = nuevoSistema('digital', 'x');
    s = reducir(s, {
      tipo: 'definir',
      requirementId: 'dim4.req01',
      payload: { roles: [{ nombre: 'franja', descripcion: 'banda a sangre' }] },
      camino: 'diseñador',
      fuerza: 'inamovible',
    });
    s = reducir(s, {
      tipo: 'definir',
      requirementId: 'dim4.req02',
      payload: {
        formas: [
          {
            rol: { refReqId: 'dim4.req01', refPath: ['roles', 0] },
            vocabulario: 'cuadrado',
            radio: 'none',
          },
        ],
      },
      camino: 'diseñador',
      fuerza: 'inamovible',
    });
    expect(muestraDePayload(s.designSet, 'dim4.req02')).toEqual({ tipo: 'radio', radio: '0' });
  });

  it('dim4.req03: el primer filete del primer estilo da el borde', () => {
    let s = nuevoSistema('digital', 'x');
    s = reducir(s, {
      tipo: 'definir',
      requirementId: 'dim4.req01',
      payload: { roles: [{ nombre: 'tarjeta', descripcion: 'caja con aire interno' }] },
      camino: 'diseñador',
      fuerza: 'inamovible',
    });
    s = reducir(s, {
      tipo: 'definir',
      requirementId: 'dim4.req03',
      payload: {
        estilosDeBorde: [
          {
            nombre: 'filete de tarjeta',
            roles: [{ refReqId: 'dim4.req01', refPath: ['roles', 0] }],
            filetes: [{ grosor: '1px', tipo: 'solid', color: '#cda23d', posicion: 'borde inferior' }],
            limiteConocido: 'un filete por caja: el destino no dibuja dos',
          },
        ],
      },
      camino: 'diseñador',
      fuerza: 'inamovible',
    });
    expect(muestraDePayload(s.designSet, 'dim4.req03')).toEqual({
      tipo: 'radio',
      borde: { ancho: '1px', estilo: 'solid', color: '#cda23d' },
    });
  });

  it('dim4.req03: sin filetes, el recuadro a secas', () => {
    let s = nuevoSistema('digital', 'x');
    s = reducir(s, {
      tipo: 'definir',
      requirementId: 'dim4.req01',
      payload: { roles: [{ nombre: 'tarjeta', descripcion: 'caja con aire interno' }] },
      camino: 'diseñador',
      fuerza: 'inamovible',
    });
    s = reducir(s, {
      tipo: 'definir',
      requirementId: 'dim4.req03',
      payload: {
        estilosDeBorde: [
          {
            nombre: 'estilo sin filetes',
            roles: [{ refReqId: 'dim4.req01', refPath: ['roles', 0] }],
            filetes: [],
            limiteConocido: 'no se declaran filetes: el aire separa',
          },
        ],
      },
      camino: 'diseñador',
      fuerza: 'inamovible',
    });
    expect(muestraDePayload(s.designSet, 'dim4.req03')).toEqual({ tipo: 'radio' });
  });

  it('dim4.req04: un nivel de profundidad mayor que cero enciende la sombra', () => {
    let s = nuevoSistema('digital', 'x');
    s = reducir(s, {
      tipo: 'definir',
      requirementId: 'dim4.req01',
      payload: { roles: [{ nombre: 'tarjeta', descripcion: 'caja con aire interno' }] },
      camino: 'diseñador',
      fuerza: 'inamovible',
    });
    s = reducir(s, {
      tipo: 'definir',
      requirementId: 'dim4.req04',
      payload: {
        profundidades: [
          {
            rol: { refReqId: 'dim4.req01', refPath: ['roles', 0] },
            nivel: 2,
            stacking: 'sobre el fondo',
            oclusion: 'nunca tapa la acción',
          },
        ],
      },
      camino: 'diseñador',
      fuerza: 'inamovible',
    });
    expect(muestraDePayload(s.designSet, 'dim4.req04')).toEqual({ tipo: 'radio', sombra: true });
  });

  it('dim4.req05 y dim4.req08: sin forma propia, el recuadro a secas', () => {
    let s = nuevoSistema('digital', 'x');
    s = reducir(s, {
      tipo: 'definir',
      requirementId: 'dim4.req05',
      payload: {
        materiales: [
          { efecto: 'sombra', permitido: true, alcance: 'tarjetas' },
          { efecto: 'luz', permitido: false, alcance: 'no se usa' },
          { efecto: 'transparencia', permitido: true, alcance: 'capas de fondo' },
          { efecto: 'mezcla', permitido: false, alcance: 'no se usa' },
        ],
      },
      camino: 'diseñador',
      fuerza: 'inamovible',
    });
    s = reducir(s, {
      tipo: 'definir',
      requirementId: 'dim4.req08',
      payload: { adaptaciones: [{ contexto: 'impreso', ajuste: 'sin sombras ni radios' }] },
      camino: 'diseñador',
      fuerza: 'inamovible',
    });
    expect(muestraDePayload(s.designSet, 'dim4.req05')).toEqual({ tipo: 'radio' });
    expect(muestraDePayload(s.designSet, 'dim4.req08')).toEqual({ tipo: 'radio' });
  });

  it('dim7.req02: los diez estados declarados, cada uno con su tono', () => {
    let s = nuevoSistema('digital', 'x');
    s = reducir(s, {
      tipo: 'definir',
      requirementId: 'dim7.req02',
      payload: {
        estados: [
          { nombre: 'normal', significado: 'en reposo', scopeStateReal: 'default' },
          { nombre: 'hover', significado: 'el puntero se posa', scopeStateReal: 'hover' },
          { nombre: 'foco', significado: 'el teclado llega', scopeStateReal: 'focus' },
          { nombre: 'activo', significado: 'se está usando ahora', scopeStateReal: 'active' },
          { nombre: 'seleccionado', significado: 'quedó elegido' },
          { nombre: 'inactivo', significado: 'existe, pero no se puede usar' },
          { nombre: 'bloqueado', significado: 'espera una condición' },
          { nombre: 'carga', significado: 'está trabajando' },
          { nombre: 'exito', significado: 'salió bien' },
          { nombre: 'error', significado: 'salió mal' },
        ],
      },
      camino: 'diseñador',
      fuerza: 'inamovible',
    });
    expect(muestraDePayload(s.designSet, 'dim7.req02')).toEqual({
      tipo: 'estados',
      estados: [
        { nombre: 'normal', tono: 'neutro' },
        { nombre: 'hover', tono: 'acento' },
        { nombre: 'foco', tono: 'acento' },
        { nombre: 'activo', tono: 'acento' },
        { nombre: 'seleccionado', tono: 'acento' },
        { nombre: 'inactivo', tono: 'neutro' },
        { nombre: 'bloqueado', tono: 'neutro' },
        { nombre: 'carga', tono: 'neutro' },
        { nombre: 'exito', tono: 'ok' },
        { nombre: 'error', tono: 'error' },
      ],
    });
  });

  it('dim7.req04: los cuatro tipos de feedback, con el tono de su tipo', () => {
    let s = nuevoSistema('digital', 'x');
    s = reducir(s, {
      tipo: 'definir',
      requirementId: 'dim7.req04',
      payload: {
        feedback: [
          { tipo: 'confirmacion', tratamiento: 'marca breve y mensaje en una línea' },
          { tipo: 'advertencia', tratamiento: 'borde bronce y texto que explica' },
          { tipo: 'error', tratamiento: 'mensaje junto al campo' },
          { tipo: 'recuperacion', tratamiento: 'ofrece deshacer' },
        ],
      },
      camino: 'diseñador',
      fuerza: 'inamovible',
    });
    expect(muestraDePayload(s.designSet, 'dim7.req04')).toEqual({
      tipo: 'estados',
      estados: [
        { nombre: 'confirmacion', tono: 'ok' },
        { nombre: 'advertencia', tono: 'aviso' },
        { nombre: 'error', tono: 'error' },
        { nombre: 'recuperacion', tono: 'acento' },
      ],
    });
  });

  it('dim7.req01: el fundamento de interacción sigue siendo texto', () => {
    let s = nuevoSistema('digital', 'x');
    s = reducir(s, {
      tipo: 'definir',
      requirementId: 'dim7.req01',
      payload: { affordances: [{ elemento: 'botón', senal: 'cursor y elevación al pasar' }] },
      camino: 'diseñador',
      fuerza: 'inamovible',
    });
    expect(muestraDePayload(s.designSet, 'dim7.req01').tipo).toBe('texto');
  });

  it('dim8.req02: los seis roles, todos neutros salvo feedback y énfasis', () => {
    let s = nuevoSistema('digital', 'x');
    s = reducir(s, {
      tipo: 'definir',
      requirementId: 'dim8.req02',
      payload: {
        roles: [
          { nombre: 'entrada', significado: 'aparece', duracionMs: 180 },
          { nombre: 'salida', significado: 'se retira', duracionMs: 140 },
          { nombre: 'transicion', significado: 'cambia de estado', duracionMs: 220 },
          { nombre: 'feedback', significado: 'responde al toque', duracionMs: 120 },
          { nombre: 'orientacion', significado: 'guía la lectura', duracionMs: 260 },
          { nombre: 'enfasis', significado: 'subraya lo importante', duracionMs: 320 },
        ],
      },
      camino: 'diseñador',
      fuerza: 'inamovible',
    });
    expect(muestraDePayload(s.designSet, 'dim8.req02')).toEqual({
      tipo: 'estados',
      estados: [
        { nombre: 'entrada', tono: 'neutro' },
        { nombre: 'salida', tono: 'neutro' },
        { nombre: 'transicion', tono: 'neutro' },
        { nombre: 'feedback', tono: 'acento' },
        { nombre: 'orientacion', tono: 'neutro' },
        { nombre: 'enfasis', tono: 'aviso' },
      ],
    });
  });

  it('dim8.req03: la escala nombrada se muestra paso a paso', () => {
    let s = nuevoSistema('digital', 'x');
    s = reducir(s, {
      tipo: 'definir',
      requirementId: 'dim8.req03',
      payload: {
        escala: [
          { nombre: 'breve', duracion: 120 },
          { nombre: 'media', duracion: 240 },
        ],
        ritmo: { descripcion: 'pausas parejas', sinPausas: 'el ritmo lo marca la escala' },
      },
      camino: 'diseñador',
      fuerza: 'inamovible',
    });
    expect(muestraDePayload(s.designSet, 'dim8.req03')).toEqual({
      tipo: 'movimiento',
      movimientos: [
        { nombre: 'breve', ms: 120 },
        { nombre: 'media', ms: 240 },
      ],
    });
  });

  it('dim8.req04: cada movimiento con su duración, resolviendo la ref a la escala', () => {
    let s = nuevoSistema('digital', 'x');
    s = reducir(s, {
      tipo: 'definir',
      requirementId: 'dim8.req03',
      payload: {
        escala: [
          { nombre: 'breve', duracion: 120 },
          { nombre: 'media', duracion: 240 },
        ],
        ritmo: { descripcion: 'pausas parejas', sinPausas: 'el ritmo lo marca la escala' },
      },
      camino: 'diseñador',
      fuerza: 'inamovible',
    });
    s = reducir(s, {
      tipo: 'definir',
      requirementId: 'dim8.req04',
      payload: {
        movimientos: [
          {
            caso: 'la tarjeta entra',
            curva: 'ease-out',
            trayectoria: 'desde abajo',
            continuidadEspacial: 'continúa el flujo de la grilla',
            duracionMs: 240,
          },
          {
            caso: 'el aviso se desvanece',
            curva: 'ease-in',
            trayectoria: 'hacia el centro',
            continuidadEspacial: 'vuelve al punto de origen',
            tiempo: { refReqId: 'dim8.req03', refPath: ['escala', 0, 'duracion'] },
          },
        ],
        sinAmplitud: 'sin desplazamiento: sólo opacidad',
      },
      camino: 'diseñador',
      fuerza: 'inamovible',
    });
    expect(muestraDePayload(s.designSet, 'dim8.req04')).toEqual({
      tipo: 'movimiento',
      movimientos: [
        { nombre: 'la tarjeta entra', ms: 240 },
        { nombre: 'el aviso se desvanece', ms: 120 },
      ],
    });
  });

  it('dim9.req01: los diez arquetipos declarados, con su nombre', () => {
    let s = nuevoSistema('digital', 'x');
    s = reducir(s, {
      tipo: 'definir',
      requirementId: 'dim9.req01',
      payload: {
        arquetipos: [
          { nombre: 'accion', decision: 'aplica: botón primario y secundario' },
          { nombre: 'contenedor', decision: 'aplica: tarjeta' },
          { nombre: 'navegacion', decision: 'aplica: barra superior' },
          { nombre: 'feedback', decision: 'aplica: aviso en línea' },
          { nombre: 'entrada', decision: 'aplica: formulario de contacto' },
          { nombre: 'secuencia-editorial', decision: 'no aplica, porque este set no publica relatos' },
          { nombre: 'lista', decision: 'aplica: listado de resultados' },
          { nombre: 'tabla', decision: 'aplica: tabla de precios' },
          { nombre: 'metricas', decision: 'no aplica, porque no hay tablero' },
          { nombre: 'representacion-de-datos', decision: 'aplica: gráfico de barras' },
        ],
      },
      camino: 'diseñador',
      fuerza: 'inamovible',
    });
    expect(muestraDePayload(s.designSet, 'dim9.req01')).toEqual({
      tipo: 'arquetipos',
      arquetipos: [
        { nombre: 'accion' },
        { nombre: 'contenedor' },
        { nombre: 'navegacion' },
        { nombre: 'feedback' },
        { nombre: 'entrada' },
        { nombre: 'secuencia-editorial' },
        { nombre: 'lista' },
        { nombre: 'tabla' },
        { nombre: 'metricas' },
        { nombre: 'representacion-de-datos' },
      ],
    });
  });

  it('dim9.req02: cada anatomía con sus slots o con su no-aplica', () => {
    let s = nuevoSistema('digital', 'x');
    s = reducir(s, {
      tipo: 'definir',
      requirementId: 'dim9.req02',
      payload: {
        anatomias: [
          {
            arquetipo: 'accion',
            slots: [
              { nombre: 'etiqueta', obligatoriedad: 'obligatorio', relacion: 'nombra la acción' },
              { nombre: 'ícono', obligatoriedad: 'opcional', relacion: 'acompaña a la etiqueta' },
            ],
          },
          { arquetipo: 'contenedor', noAplica: 'no hay contenedor propio en este set' },
          { arquetipo: 'navegacion', noAplica: 'la navegación vive en el armazón, no en un patrón' },
          { arquetipo: 'feedback', noAplica: 'sin feedback propio todavía' },
          { arquetipo: 'entrada', noAplica: 'sin formularios en este set' },
          { arquetipo: 'secuencia-editorial', noAplica: 'no publica relatos' },
          {
            arquetipo: 'lista',
            slots: [{ nombre: 'filas', obligatoriedad: 'obligatorio', relacion: 'cada fila repite el mismo molde' }],
          },
          { arquetipo: 'tabla', noAplica: 'sin tablas en este set' },
          { arquetipo: 'metricas', noAplica: 'sin tablero' },
          { arquetipo: 'representacion-de-datos', noAplica: 'sin gráficos' },
        ],
      },
      camino: 'diseñador',
      fuerza: 'inamovible',
    });
    expect(muestraDePayload(s.designSet, 'dim9.req02')).toEqual({
      tipo: 'arquetipos',
      arquetipos: [
        { nombre: 'accion', slots: 2 },
        { nombre: 'contenedor', noAplica: true },
        { nombre: 'navegacion', noAplica: true },
        { nombre: 'feedback', noAplica: true },
        { nombre: 'entrada', noAplica: true },
        { nombre: 'secuencia-editorial', noAplica: true },
        { nombre: 'lista', slots: 1 },
        { nombre: 'tabla', noAplica: true },
        { nombre: 'metricas', noAplica: true },
        { nombre: 'representacion-de-datos', noAplica: true },
      ],
    });
  });

  it('dim9.req03: las variantes siguen siendo texto', () => {
    let s = nuevoSistema('digital', 'x');
    s = reducir(s, {
      tipo: 'definir',
      requirementId: 'dim9.req03',
      payload: { sinVariantes: 'cada arquetipo tiene una sola forma en este set' },
      camino: 'diseñador',
      fuerza: 'inamovible',
    });
    expect(muestraDePayload(s.designSet, 'dim9.req03').tipo).toBe('texto');
  });
});
