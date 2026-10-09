# @contope/trama

Las **tramas generativas** de ContOpe (decisión 36): el motor de la
«superficie de puntos» —una lámina 3D de puntos o líneas que se pliega y
evoluciona—, su línea de tiempo y el **archivo de trama** que las describe.

- **Core genera las tramas; Publisher sólo las muestra.** Este paquete es el
  motor, y existe **una sola vez**. El reproductor de Publisher no lo copia:
  trae los archivos de `dist/` y verifica su sha256 contra `MOTOR.json`.
- **La trama en vivo no tiene final.** Evoluciona sin fin desde un instante.
  Una **secuencia** se arma con capturas en el tiempo; si es circular, parte y
  termina en la misma captura.
- **Con o sin ADN.** Cada color anota de dónde viene (`adn`, con su rol y su
  huella, o `manual`); la metadata de ancestro de Células Madre va en
  `procedencia`. Sin sistema, la trama queda «sin ancestro» y funciona igual.
- **Salidas:** el archivo de trama (vivo, interactivo, para Publisher), video
  (cerrado: se calcula cuadro a cuadro con `cuadroEn`) y SVG/PNG (un cuadro
  quieto: `cuadroASvg`).

**Quién las genera.** Core: el generador de Células Madre
`packages/core/src/celulas-madre/generador-trama.ts` y la pantalla de la
trama del escritorio, que arman la trama con `armarTrama`
(`trama-del-adn.ts`) e importan este paquete por su fuente. Los colores que
salen del ADN quedan con `origen: 'adn'`, su `rol` y su `huella`; los
cambiados a mano, `manual` (en pantalla, «propio»).

TypeScript estricto y **puro**: sin DOM y sin `node:*`. `tsconfig.json` no
carga los tipos de ninguno de los dos, así que el compilador lo vigila; las
pruebas tienen su propio `tsconfig.pruebas.json`.

## Qué hay

```
src/motor/            el motor, portado fielmente de v7
  ruido.ts              Perlin mejorado con semilla fija (0x2f6b9a1d)
  camara.ts             matrices 4×4, rotaciones, traslación, suavizado
  configuracion.ts      ConfiguracionMotor (27 números), defaults, NOMBRE_V7
  lamina.ts             calcularLamina, escribirLamina, cuadroDeEstado (morf),
                        empaquetar, dimensionesDeLamina, MOTOR_ID/VERSION
src/dibujo/           lo que generador, SVG y reproductor dibujan igual
  color.ts              12 tonos por profundidad, 4 niveles de alfa, tinta
                        luz/tinta/auto (umbral de luminancia 0,4)
  modo.ts               puntos / líneas / mixto (y el `dotted` viejo)
  puntos.ts             recorrerPuntos: los 48 grupos tono × alfa
  tramos.ts             tramosDeLinea (lineTramos de v7), trazosDeTramo
  tiras.ts              tirasDeTramos: tramos → TRIANGLE_STRIP con grosor real
  mezcla.ts             mezclarCuadros: interpolar cuadros del buffer
  svg.ts                cuadroASvg (toSVG de v7)
src/linea-de-tiempo/  evaluar una trama en un instante, fiel a v7
  suavizados.ts         lineal, suave, entrada, salida, mantener, curva bezier
  parametros.ts         qué se anima y cómo (PARAMS de v7), grilla de 1/24 s
  evaluar.ts            interpolar, valorEn, evolucionEn (morf), estadoEn
  escenas.ts            escenas → keyframes, escena de cierre
src/formato/          el archivo de trama
  tipos.ts              los tipos, documentados campo por campo
  validar.ts            validarTrama: errores en español con la ruta
  normalizar.ts         normalizarTrama: completa defaults, regenera escenas
  codigo.ts             leerTrama (JSON, CT1, SP1), codificarTrama, compactar
  base64.ts, limites.ts, por-defecto.ts
src/reproduccion.ts   instanteDeCuadro, cuadrosDeSecuencia, cuadroEn
src/worker/           el protocolo del worker, puro (atendedor.ts)
src/entradas/         entradas de esbuild para dist/
scripts/construir.mjs construye dist/
dist/                 lo que Publisher trae (versionado)
```

## El motor

`calcularLamina(estado, ancho, alto, calidad)` devuelve el **cuadro**: un
`Float32Array` plano con cinco valores por punto —`x, y, radio, cercanía,
alfa`— para cada punto de cada línea, en orden. El tamaño es fijo para una
configuración y una calidad (`líneas × puntos × 5`): un punto detrás de la
cámara se escribe como cinco ceros y conserva su lugar. Por eso dos cuadros
se pueden mezclar valor a valor.

Es `computeSheet` de v7 sin cambiar fórmulas, constantes, semilla ni el orden
de las operaciones. El eje central se guarda en un `Float32Array` (como en
v7); el resto se calcula en 64 bits y se reduce a 32 al escribirse, como
`packFrame`. El morf (`cuadroDeEstado` con `mezcla`) calcula los dos estados
en 64 bits sobre la misma malla y mezcla antes de reducir, como
`computeState`.

**La huella.** La prueba de Publisher (`scripts/probar-trama.mjs`) fija
`9c130d7e7d11640b`: defaults, evolución 6, 1600×900, calidad 1, valores
redondeados a 2 decimales en Float32, sha256, 16 hex. Este paquete la
reproduce (y también a través de un `SP1.` convertido y del `dist/`
construido). Un cruce bit a bit contra el motor de `cod-trama.js`, con
cursor, paralaje, curvatura 0 y vista vertical, no dio diferencias. **Si un
cambio altera la huella, la imagen de toda trama publicada cambia**: eso pide
subir la versión mayor del motor y conservar la anterior.

## El archivo de trama

Un documento JSON (extensión sugerida `.trama.json`). Es una **receta**: con
ella y el motor cualquiera recalcula los mismos puntos.

### Ejemplo completo

```json
{
  "kind": "contope/trama",
  "version": 1,
  "motor": { "id": "superficie-de-puntos", "version": "1.0.0" },
  "nombre": "Portada Nocturno",
  "procedencia": {
    "kind": "contope/celula-madre",
    "sistema": { "id": "nocturno", "nombre": "Nocturno" },
    "generador": { "id": "trama", "version": "0.1.0" }
  },
  "lienzo": {
    "tipo": "proporcion", "proporcion": 1.7778,
    "formatoAdn": { "id": "pantalla-16-9", "requisito": "dim3.req05" }
  },
  "dibujo": { "modo": "mixto", "tinta": "auto" },
  "color": {
    "lejos": { "hex": "#1d3fb8", "origen": "adn", "rol": "dim1.req02:primario", "huella": "a1b2c3d4e5f60718" },
    "cerca": { "hex": "#3bb8a8", "origen": "adn", "rol": "dim1.req02:acento", "huella": "0f1e2d3c4b5a6978" },
    "fondo": "#000000"
  },
  "configuracion": { "lineas": 44, "puntosPorLinea": 300, "grosor": 2, "grosorLinea": 0.45, "opacidadLinea": 0.32 },
  "tiempo": {
    "modo": "secuencia", "inicio": 6, "duracion": 8, "cerrarCiclo": true, "alTerminar": "repetir",
    "cierre": { "transicion": "morph", "duracion": 1.5, "curva": [0.42, 0, 0.58, 1] },
    "escenas": [
      { "id": 1, "t": 0, "nombre": "Lámina plegada", "captura": { "evolucion": 6 } },
      { "id": 2, "t": 4, "nombre": "Ola amplia", "transicion": "morph", "duracion": 2,
        "curva": [0.75, 0, 0.25, 1], "evolucion": true,
        "captura": { "evolucion": 31.5, "configuracion": { "anchoLamina": 6, "torsion": 0.2, "pliegues": 2.4, "curvatura": 3 } } }
    ],
    "pistas": {
      "cursor.presencia": [ { "t": 1, "v": 0, "ease": "suave" }, { "t": 3, "v": 1, "ease": "mantener" }, { "t": 6, "v": 0 } ]
    }
  },
  "interaccion": { "cursor": true, "paralaje": false },
  "cuadroQuieto": 4
}
```

El mínimo válido es la cabecera (`kind`, `version`, `motor`): todo lo demás
toma su valor por defecto (el preset «Lámina plegada», en vivo desde la
evolución 6, que es exactamente el código de referencia de Publisher).

### Campo por campo

| campo | obligatorio | qué es |
|---|---|---|
| `kind` | sí | Siempre `"contope/trama"`. |
| `version` | sí | Versión del **formato** del archivo: `1`. Un lector rechaza otra. |
| `motor.id` | sí | `"superficie-de-puntos"`, el único motor que hay. |
| `motor.version` | sí | Versión `x.y.z` del motor con que se hizo. Se lee con cualquier `1.x`; otra mayor se rechaza (la imagen sería otra). |
| `nombre` | no | Texto para personas (≤ 200). Quien lo muestre, lo muestra como texto. |
| `procedencia` | no | La metadata de ancestro de Células Madre (decisión 35). Opaca: se guarda y se devuelve tal cual. Sólo datos JSON, ≤ 64 KB, ≤ 32 niveles. Sin ella: «sin ancestro». |
| `lienzo.tipo` | no (`libre`) | `libre`: llena el contenedor. `proporcion`: ancho/alto fijo (`lienzo.proporcion`, 0,05–20). `medida`: `lienzo.ancho` y `lienzo.alto` en px (la medida de exportación; en pantalla se escala). El motor depende de la proporción: bajo 1:1 abre el campo visual. |
| `lienzo.formatoAdn` | no | Si el lienzo sale de un formato del ADN: `id` (obligatorio), `requisito`, `nombre`, `huella`. |
| `dibujo.modo` | no (`puntos`) | `puntos`, `lineas` o `mixto` (las líneas debajo). |
| `dibujo.tinta` | no (`auto`) | `luz` (los puntos suman luz, fondo oscuro), `tinta` (oscurecen, como en papel) o `auto` (tinta si la luminancia del fondo pasa de 0,4). |
| `color.lejos` / `cerca` / `fondo` | no | Color de los puntos lejanos, de los cercanos y del fondo. Cada uno `{ hex, origen, rol?, huella? }`: `hex` es `#rrggbb` y nada más; `origen` es `adn` o `manual` (por defecto); `rol` y `huella` sólo con `adn`. Forma corta: el hex solo (`"#000000"`) = manual. Los tonos intermedios (12) son parte del dibujo, no colores nuevos del sistema. |
| `configuracion` | no | Los 27 números del motor; los que falten toman su defecto. Ver la tabla de abajo. |
| `tiempo.modo` | no (`vivo`) | `vivo` o `secuencia`. |
| `tiempo.inicio` | no (6) | Evolución en el instante 0. |
| `tiempo.duracion` | en secuencia | Segundos, 0 < d ≤ 600. |
| `tiempo.pistas` | no | Keyframes por ruta (ver «Rutas animables»). Cada keyframe: `t` (s, en orden estricto, 0..duración), `v` (número, o `#rrggbb` en las de color), `ease` (`lineal` por defecto, `suave`, `entrada`, `salida`, `mantener`, `curva`), `curva` (`[x1, y1, x2, y2]`, obligatoria con `curva`) y `escena` (si lo generó una escena: no se edita, se regenera). |
| `tiempo.escenas` | no | Capturas en el tiempo. Cada una: `id` (entero ≥ 1, único; el 0 es del cierre), `t`, `captura` (`evolucion`, `cursor {x, y, presencia}`, `configuracion` parcial, `color {lejos, cerca, fondo}`: todo opcional), `transicion` (`morph` por defecto o `corte`), `duracion` (1 s; 0,04–30), `curva` (suave por defecto), `evolucion` (sí por defecto: la escena también lleva la evolución a la de su captura, con morf de geometría), `nombre`. |
| `tiempo.cerrarCiclo` | no (no) | Agrega una escena de cierre en `duracion` con la captura del instante 0: el último cuadro es el primero, bit a bit. Una escena del usuario en ese instante queda reemplazada. |
| `tiempo.cierre` | no | Cómo llega la escena de cierre: `transicion`, `duracion` (1 s), `curva` (suave). |
| `tiempo.cursor` | no | Cursor grabado cuando su pista no está animada: `x`, `y` (0..1 desde abajo a la izquierda; 0,5), `presencia` (0..1; 0). |
| `tiempo.alTerminar` | no (`repetir`) | Qué hace el reproductor al final de una secuencia: `repetir` o `detener` (queda en el último instante). |
| `interaccion.cursor` | no (sí) | En vivo, la lámina se deforma con el cursor real. |
| `interaccion.paralaje` | no (no) | En vivo, la cámara gira un poco con el cursor real. |
| `cuadroQuieto` | no (0) | Instante (s) que se muestra quieto con `prefers-reduced-motion` o en modo estático (≤ duración en una secuencia). |

**Configuración** (nombre en el archivo → nombre en v7, defecto):
`lineas` lineCount 64 · `puntosPorLinea` points 480 · `anchoLamina` sheetWidth 4 ·
`largoLamina` sheetLength 13 · `serpenteo` meander 1 · `torsion` twist 0,5 ·
`pliegues` fold 1,8 · `frecuenciaPliegues` foldFreq 2 · `curvatura` curl 1,8 ·
`ondulacion` wave 0,22 · `frecuenciaOndulacion` waveFreq 1,3 · `velocidad` speed 0,25 ·
`grosor` size 1,6 · `crecimientoPorCercania` perspectiveSize 1 · `inclinacion` tilt 18 ·
`giro` roll −6 · `distancia` distance 5 · `desplazamientoX` offsetX 0 ·
`desplazamientoY` offsetY 0 · `brillo` intensity 1,1 · `apagadoPorDistancia` depthFade 1 ·
`paralaje` parallax 1 · `deformacionCursor` mouseForm 0,5 · `radioCursor` mouseRadius 0,22 ·
`opacidadPunto` dotAlpha 1 · `grosorLinea` lineWeight 1,4 · `opacidadLinea` lineAlpha 0,4.
La tabla viva es `NOMBRE_V7` en `motor/configuracion.ts`; cada campo está
documentado en `ConfiguracionMotor`.

**Rutas animables:** `evolucion`; toda la configuración menos `velocidad` y
`paralaje` (la evolución depende de la velocidad; el paralaje es reacción al
cursor real); `cursor.x`, `cursor.y`, `cursor.presencia`; `color.lejos`,
`color.cerca`, `color.fondo`. `lineas` y `puntosPorLinea` no se interpolan:
saltan en el keyframe (y cambian el tamaño del cuadro desde ahí).

### Cómo se evalúa en el tiempo

`estadoEn(trama, t, entorno?)` da el estado del motor, los colores, el modo y
la tinta en el instante `t`; `cuadroEn` calcula su cuadro. Es `evalState` de
v7: cada pista interpola sus keyframes; antes del primero y después del
último manda el valor del extremo. La **evolución** es especial: entre dos
keyframes, `lineal` recorre el tiempo del motor, `mantener` lo congela y
cualquier otro es **morf** (los dos momentos siguen vivos y el cuadro es su
mezcla con el peso de la curva); fuera de sus keyframes corre a 1 s por
segundo. En vivo, el `entorno` aporta el cursor y el paralaje reales si
`interaccion` lo permite; en una secuencia manda lo grabado.

`instanteDeCuadro(trama, k, fps)` es el reloj común de worker, reproductor y
video: en vivo `k / fps` sin fin; en una secuencia que se repite vuelve a 0 a
los `round(duración × fps)` cuadros (el instante `duración` no se dibuja: con
el ciclo cerrado es el 0).

### Validar, normalizar, leer

- `validarTrama(x)` → lista de `{ ruta, mensaje }` (vacía = válido), todos los
  errores a la vez, p. ej. `tiempo.pistas.pliegues[2].t: los keyframes deben
  ir en orden de t, sin repetir instantes`. Estricto: un campo desconocido es
  error (si el formato crece, sube su versión); un nombre de v7 en una pista
  avisa cómo se llama acá.
- `normalizarTrama(x)` → `Trama` completa (lanza `ErrorDeTrama` si no es
  válido). En una secuencia **regenera** los keyframes de las escenas, así un
  archivo no puede decir una cosa en sus escenas y otra en sus pistas.
- `leerTrama(texto | objeto)` → `{ ok, trama, origen, avisos }` o
  `{ ok: false, errores }`. Acepta JSON, `CT1.…` y `SP1.…`. **Nunca lanza.**

### Sólo datos

El archivo de trama es **sólo datos**: nunca código, nunca una URL que haya
que cargar. Los colores son `#rrggbb` validados (no pueden inyectar CSS ni
marcado en un SVG), los textos son texto y los números tienen **límites
duros** (`formato/limites.ts`): líneas ≤ 1000, puntos por línea ≤ 4000, ≤
500.000 puntos por cuadro, duración ≤ 600 s, ≤ 50.000 keyframes, ≤ 1000
escenas, texto ≤ 2 MB. Un archivo viene de afuera y se trata como dato no
confiable; esos límites impiden que uno congele el reproductor.

## Códigos de una línea: CT1 y SP1

**`CT1.…` (decisión de este paso).** Hacía falta una forma de una línea para
lo que hoy hace `SP1.`: pegar la trama en un atributo
(`data-cod-trama="CT1.…"`), en una receta del MCP o en el portapapeles. CT1 es
**el mismo documento**, compactado (`compactarTrama`: sin los valores iguales
a los por defecto, colores manuales en forma corta, sin los keyframes que
regeneran las escenas) y en **base64url** (sin `+`, `/` ni `=`: no hay nada
que escapar en HTML ni en una URL). No es otro formato: al leerse pasa por el
mismo validador y el mismo normalizador, y `leerTrama(codificarTrama(t))`
devuelve `t`. Sin compresión a propósito: deflate pediría una dependencia y
volvería el código opaco; una trama en vivo cabe en ~130 caracteres y una
secuencia con escenas en algunos cientos.

**`SP1.…` (compatibilidad).** Los códigos de captura de v7 (base64 del JSON de
un instante: `time`, `cfg` con los nombres de v7, `render` o `dotted`,
`format`…) se leen y se convierten (`capturaV7ATrama`): **un instante → modo
vivo con ese inicio**, la configuración traducida con `NOMBRE_V7`, los
colores y la tinta de `cfg`, el modo con las reglas de `modeOf` y
`format: "1920x1080"` como lienzo `medida`. Lo que no trae queda por defecto;
lo que no se entiende se ignora. Una captura tomada a mitad de un morf avisa
que se usó el momento de partida. El código de referencia de Publisher,
leído así, da la misma huella.

## dist/: lo que Publisher trae

```bash
pnpm trama:construir                                  # desde la raíz
node packages/trama/scripts/construir.mjs --verificar # ¿dist/ al día?
```

| archivo | qué es |
|---|---|
| `contope-trama.js` | IIFE sin dependencias con todo el paquete: `window.ContopeTrama` en una página, `module.exports` en Node. |
| `contope-trama-worker.js` | Worker **autónomo**: un archivo propio con el motor adentro, que se crea con `new Worker('…/contope-trama-worker.js')`. No se arma con `Function.toString()` ni con `blob:` (que una CSP estricta prohíbe). |
| `MOTOR.json` | Versión del paquete, del motor y del formato; sha256 y bytes de cada archivo; fecha (sólo cambia si cambia un archivo). |
| `package.json` | Sólo `"type": "commonjs"`, para que Node lea `dist/` como script. No se lleva. |

La construcción usa **esbuild**, que ya estaba en el monorepo (dependencia del
escritorio, nombrado en `onlyBuiltDependencies`); el paquete lo declara como
devDependency propia para no depender de otro paquete. La salida es
determinista y sin minificar (se puede leer y auditar; gzip se encarga del
peso). `dist/` se versiona (excepción en `.gitignore`) y una prueba falla si
quedó viejo respecto del código.

**Cómo lo trae Publisher.** Nunca copiado a mano ni pegado en otro archivo:
un script de Publisher descarga `contope-trama.js`, `contope-trama-worker.js`
y `MOTOR.json` de una versión fijada de este repositorio, **verifica el
sha256 de cada archivo contra `MOTOR.json`** y los deja tal cual en sus
assets; su prueba compara de nuevo los sha256 y la huella de referencia. El
reproductor (`cod-trama.js`) queda con el dibujo (WebGL, canvas de respaldo,
cursor en la GPU) y usa `ContopeTrama` para leer la trama, contar el tiempo,
mezclar cuadros y armar las tiras de las líneas.

**Protocolo del worker** (`worker/atendedor.ts`), el de Publisher hoy con la
trama en vez de una configuración suelta:

```
página → worker  { tipo: 'configurar', gen, trama, ancho, alto, fps, calidad? }
worker → página  { tipo: 'configurado', gen, lineas, puntos, avisos }
                 { tipo: 'error', gen, errores }             trama inválida
página → worker  { tipo: 'pedir', gen, hasta }               cuadros 0..hasta
worker → página  { tipo: 'cuadro', gen, k, t, datos, colores } datos: Float32Array transferido
```

`trama` puede ser el objeto, el JSON o un código CT1/SP1. `gen` numera las
configuraciones (lo de una generación vieja se ignora). Un cuadro por turno:
entre cuadro y cuadro el worker atiende mensajes.

## Pruebas

`pnpm --filter @contope/trama test`: la huella de referencia exacta;
determinismo y tamaño fijo del cuadro; tonos, tinta, tramos y tiras (cantidad
de vértices, grosor real, inglete); suavizados, keyframes, enteros, colores,
evolución con morf, escenas y ciclo cerrado (último cuadro = primero, bit a
bit); el validador (rutas y mensajes), el normalizador, CT1 de ida y vuelta,
SP1 convertido con la misma huella; y `dist/`: al día con el código, sha256
de `MOTOR.json`, worker sin `toString()` ni `blob:`, y el worker construido
entregando los mismos cuadros que el código fuente.
