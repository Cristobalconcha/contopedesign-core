import { describe, expect, it } from 'vitest';
import { estadoEn } from '../linea-de-tiempo/evaluar.js';
import { PARAMETROS_ANIMABLES } from '../linea-de-tiempo/parametros.js';
import { codificarTrama, leerTrama } from './codigo.js';
import {
  capturaDeV7,
  configuracionDeV7,
  estadoV7DeCaptura,
  estadoV7DeTrama,
  keyframeAV7,
  keyframeDeV7,
  lineaEnUso,
  regenerarPistasV7,
  RUTA_DE_V7,
  RUTA_V7,
  tramaDeEstadoV7,
  type EstadoV7,
  type LineaV7,
} from './generador-v7.js';
import { normalizarTrama } from './normalizar.js';
import { validarTrama } from './validar.js';

/** La `config` por defecto de v7, tal como está escrita en su HTML. */
const CONFIG_V7 = {
  lineCount: 64, points: 480, sheetWidth: 4, sheetLength: 13, meander: 1.0, twist: 0.5, fold: 1.8, foldFreq: 2.0, curl: 1.8, wave: 0.22, waveFreq: 1.3,
  speed: 0.25, size: 1.6, perspectiveSize: 1.0, tilt: 18, roll: -6, distance: 5.0, offsetX: 0, offsetY: 0, intensity: 1.1, depthFade: 1.0, parallax: 1.0,
  mouseForm: 0.5, mouseRadius: 0.22, colorDeep: '#2a52d6', colorAccent: '#3dd6c0', dotAlpha: 1.0, lineWeight: 1.4, lineAlpha: 0.4, colorBg: '#000000', inkMode: 'auto',
};

const st = (time: number, cfg: Record<string, unknown>) => ({ time, cam: [0, 0], mouse: [0.5, 0.5], presence: 0, cfg: { ...CONFIG_V7, ...cfg }, render: 'puntos' });

/** Una línea de tiempo de v7 como la deja su interfaz: dos escenas, una pista a mano con curva y una de color. */
function linea(): LineaV7 {
  const tl: LineaV7 = {
    duration: 6,
    startTime: 6,
    cursor: { x: 0.5, y: 0.5, presence: 0 },
    tracks: {
      twist: [{ t: 0.5, v: 0.2, ease: 'curve', curve: [0.3, 1.45, 0.6, 1] }, { t: 2, v: 1.6, ease: 'hold' }, { t: 4, v: -1, ease: 'linear' }],
      colorBg: [{ t: 0, v: '#000000', ease: 'ease' }, { t: 5, v: '#102030', ease: 'linear' }],
    },
    scenes: [
      { id: 1, t: 1, snap: 1, st: st(20, { fold: 2.4, colorAccent: '#ff0000' }), type: 'morph', dur: 1, curve: [0.42, 0, 0.58, 1], evo: true },
      { id: 2, t: 3.5, snap: 3, st: st(40, { curl: -2, lineCount: 90 }), type: 'cut', dur: 1, curve: [0.42, 0, 0.58, 1], evo: false },
    ],
  };
  tl.tracks = regenerarPistasV7(tl, CONFIG_V7);
  return tl;
}

describe('nombres de v7', () => {
  it('cada ruta animable tiene su path de v7, ida y vuelta', () => {
    for (const p of PARAMETROS_ANIMABLES) expect(RUTA_DE_V7[RUTA_V7[p.ruta]]).toBe(p.ruta);
    expect(RUTA_V7['evolucion']).toBe('time');
    expect(RUTA_V7['cursor.presencia']).toBe('cursor.presence');
    expect(RUTA_V7['color.fondo']).toBe('colorBg');
    expect(RUTA_V7['anchoLamina']).toBe('sheetWidth');
  });
  it('keyframes: ease, curva y escena, ida y vuelta; una curva sin curva queda lineal (como la dibuja v7)', () => {
    const k = { t: 1, v: 2, ease: 'curve' as const, curve: [0.1, 0.2, 0.3, 0.4] as [number, number, number, number], scene: 3 };
    expect(keyframeDeV7(k)).toEqual({ t: 1, v: 2, ease: 'curva', curva: [0.1, 0.2, 0.3, 0.4], escena: 3 });
    expect(keyframeAV7(keyframeDeV7(k))).toEqual(k);
    expect(keyframeDeV7({ t: 0, v: 1, ease: 'curve' })).toEqual({ t: 0, v: 1, ease: 'lineal' });
    expect(keyframeDeV7({ t: 0, v: 1, ease: 'hold' }).ease).toBe('mantener');
  });
  it('la configuración del motor sale de la de v7 sin tocar los valores', () => {
    const c = configuracionDeV7(CONFIG_V7);
    expect(c.anchoLamina).toBe(4);
    expect(c.paralaje).toBe(1);
    expect(c.opacidadLinea).toBe(0.4);
  });
  it('captura de v7 → captura del formato → captura de v7', () => {
    const c = capturaDeV7(st(12.5, { fold: 2 }));
    expect(c.evolucion).toBe(12.5);
    expect(c.configuracion?.pliegues).toBe(2);
    expect(c.color).toEqual({ lejos: '#2a52d6', cerca: '#3dd6c0', fondo: '#000000' });
    const v = estadoV7DeCaptura(c);
    expect(v.time).toBe(12.5);
    expect(v.mouse).toEqual([0.5, 0.5]);
    expect(v.cfg['fold']).toBe(2);
    expect(v.cfg['colorBg']).toBe('#000000');
  });
});

describe('escenas de v7 con el motor único', () => {
  it('regenerarPistasV7 genera los keyframes que generaba regenerateScenes de v7', () => {
    const tl = linea();
    // morph de 1 s con curva hasta la escena 1 en t = 1 (desde 0), y la evolución también
    expect(tl.tracks['fold']).toEqual([
      { t: 0, v: 1.8, ease: 'curve', curve: [0.42, 0, 0.58, 1], scene: 1 },
      { t: 1, v: 2.4, ease: 'linear', scene: 1 },
      // la escena 2 trae la captura entera: su corte devuelve los pliegues a los suyos
      { t: 3.5 - 1 / 24, v: 2.4, ease: 'hold', scene: 2 },
      { t: 3.5, v: 1.8, ease: 'linear', scene: 2 },
    ]);
    expect(tl.tracks['time']![1]).toEqual({ t: 1, v: 20, ease: 'linear', scene: 1 });
    // corte en 3,5: mantener hasta un cuadro antes; sin evolución
    expect(tl.tracks['curl']).toEqual([
      { t: 3.5 - 1 / 24, v: 1.8, ease: 'hold', scene: 2 },
      { t: 3.5, v: -2, ease: 'linear', scene: 2 },
    ]);
    expect(tl.tracks['time']!.some((k) => k.scene === 2)).toBe(false);
    // la pista a mano queda tal cual
    expect(tl.tracks['twist']!.find((k) => !k.scene)).toEqual({ t: 0.5, v: 0.2, ease: 'curve', curve: [0.3, 1.45, 0.6, 1] });
  });
});

describe('v7 → archivo de trama → v7', () => {
  const estado = (): EstadoV7 => ({ cfg: { ...CONFIG_V7, inkMode: 'tinta' }, render: 'mixto', time: 9, format: '1632x1056', tl: linea(), nombre: 'Ola amplia' });

  it('sin línea de tiempo es una trama en vivo que parte en la evolución en pantalla', () => {
    const t = tramaDeEstadoV7({ ...estado(), tl: { ...linea(), tracks: {}, scenes: [] }, format: 'free' });
    expect(validarTrama(t)).toEqual([]);
    expect(t.tiempo).toEqual({ modo: 'vivo', inicio: 9 });
    expect(t.lienzo).toEqual({ tipo: 'libre' });
    expect(t.dibujo).toEqual({ modo: 'mixto', tinta: 'tinta' });
    expect(t.interaccion).toEqual({ cursor: true, paralaje: true });
    expect(lineaEnUso(null)).toBe(false);
  });

  it('con línea de tiempo es una secuencia: pistas a mano, escenas, cursor, duración y nombre', () => {
    const t = tramaDeEstadoV7(estado());
    expect(validarTrama(t)).toEqual([]);
    expect(t.nombre).toBe('Ola amplia');
    expect(t.lienzo).toEqual({ tipo: 'medida', ancho: 1632, alto: 1056 });
    if (t.tiempo.modo !== 'secuencia') throw new Error('se esperaba una secuencia');
    expect(t.tiempo.duracion).toBe(6);
    expect(t.tiempo.inicio).toBe(6);
    expect(t.tiempo.cerrarCiclo).toBe(false);
    expect(t.tiempo.escenas.map((e) => [e.id, e.t, e.transicion, e.nombre])).toEqual([[1, 1, 'morph', 'Captura 1'], [2, 3.5, 'corte', 'Captura 3']]);
    expect(t.tiempo.pistas.torsion!.filter((k) => k.escena === undefined)).toEqual([{ t: 0.5, v: 0.2, ease: 'curva', curva: [0.3, 1.45, 0.6, 1] }, { t: 2, v: 1.6, ease: 'mantener' }, { t: 4, v: -1, ease: 'lineal' }]);
    // las pistas de las escenas que regenera el normalizador son las mismas que las de v7
    expect(t.tiempo.pistas.pliegues).toEqual(linea().tracks['fold']!.map(keyframeDeV7));
  });

  it('lo que se ve es lo mismo: el estado del motor en cada instante coincide con el de las pistas de v7', () => {
    const t = tramaDeEstadoV7(estado());
    const tl = linea();
    for (const s of [0, 0.5, 1, 2.7, 3.49, 3.5, 5.9]) {
      const e = estadoEn(t, s);
      // la escena 2 trae la captura entera: el corte también devuelve los pliegues a 1,8
      const esperado = s >= 3.5 ? 1.8 : s >= tl.tracks['fold']![1]!.t ? 2.4 : undefined;
      if (esperado !== undefined) expect(e.motor.configuracion.pliegues).toBe(esperado);
      expect(e.motor.configuracion.lineas).toBe(s >= 3.5 ? 90 : 64);
    }
  });

  it('los colores del ADN conservan su origen mientras v7 no los cambie', () => {
    const adn = { hex: '#3dd6c0', origen: 'adn' as const, rol: 'dim1.req02:accent', huella: 'sha256:abc' };
    const t = tramaDeEstadoV7(estado(), { colores: { cerca: adn, fondo: { hex: '#ffffff', origen: 'adn', rol: 'dim1.req02:background' } } });
    expect(t.color.cerca).toEqual(adn);
    expect(t.color.fondo).toEqual({ hex: '#000000', origen: 'manual' });
  });

  it('un formato de hoja del ADN viaja con su formatoAdn', () => {
    const lienzo = { tipo: 'medida' as const, ancho: 1632, alto: 1056, formatoAdn: { id: 'doble', requisito: 'dim3.req08' } };
    expect(tramaDeEstadoV7(estado(), { lienzo }).lienzo).toEqual(lienzo);
  });

  it('ida y vuelta exacta por el archivo JSON y por el código CT1', () => {
    const t = tramaDeEstadoV7(estado());
    const porJson = leerTrama(JSON.stringify(t));
    const porCt1 = leerTrama(codificarTrama(t));
    if (!porJson.ok || !porCt1.ok) throw new Error('no se leyó');
    expect(porJson.trama).toEqual(t);
    expect(porCt1.trama).toEqual(t);
    // y de vuelta a v7: la misma trama otra vez
    const v = estadoV7DeTrama(porCt1.trama);
    expect(v.render).toBe('mixto');
    expect(v.format).toBe('1632x1056');
    expect(v.cfg['inkMode']).toBe('tinta');
    expect(v.tl!.scenes.map((s) => [s.id, s.snap, s.type])).toEqual([[1, 1, 'morph'], [2, 3, 'cut']]);
    v.tl!.tracks = regenerarPistasV7(v.tl!, v.cfg);
    expect(tramaDeEstadoV7(v)).toEqual(t);
  });

  it('las pistas que pasan del final se recortan sin cambiar lo que se ve hasta el final', () => {
    const e = estado();
    e.tl!.duration = 3;
    const t = tramaDeEstadoV7(e);
    expect(validarTrama(t)).toEqual([]);
    if (t.tiempo.modo !== 'secuencia') throw new Error();
    expect(t.tiempo.escenas.map((s) => s.id)).toEqual([1]);
    expect(t.tiempo.pistas.torsion!.at(-1)).toEqual({ t: 3, v: 1.6, ease: 'lineal' });
  });

  it('una secuencia con el ciclo cerrado llega a v7 con su escena de cierre al final', () => {
    const t = normalizarTrama({
      kind: 'contope/trama', version: 1, motor: { id: 'superficie-de-puntos', version: '1.0.0' },
      tiempo: { modo: 'secuencia', duracion: 4, cerrarCiclo: true, escenas: [{ id: 1, t: 0, captura: { evolucion: 4, configuracion: { pliegues: 0.6 } } }, { id: 2, t: 2, captura: { configuracion: { pliegues: 2.2 } } }] },
    });
    const v = estadoV7DeTrama(t);
    expect(v.tl!.scenes.map((s) => s.t)).toEqual([0, 2, 4]);
    expect(v.tl!.scenes[2]!.st.cfg['fold']).toBe(0.6);
    expect(v.tl!.scenes[2]!.st.time).toBe(4);
    v.tl!.tracks = regenerarPistasV7(v.tl!, v.cfg);
    const otra = tramaDeEstadoV7(v);
    for (const s of [0, 1, 2, 3, 3.5, 4]) expect(estadoEn(otra, s).motor).toEqual(estadoEn(t, s).motor);
  });
});
