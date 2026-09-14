# La interfaz

Primera pasada, 13 de septiembre de 2026. Descrita por Cristóbal, prototipada y
revisada mirándola. Lo que está aprobado se marca; lo que no, también.

Prototipo navegable:
<https://claude.ai/code/artifact/aadcd1ef-9673-4fea-9036-651aae455220>

**Construida el 14 de septiembre de 2026** en `packages/desktop`, sobre el
núcleo real: las pantallas 1, 2 y 3 tal como están descritas abajo, la
pantalla 5 aprobada, y tres instrumentos más un editor estructurado que cubre
a los 43 requisitos. La pantalla 4 sigue sin dibujar, a propósito. Lo que se
construyó, y qué decisiones se tomaron sin preguntar, está al final, en
[«Lo construido»](#lo-construido-14-de-septiembre).

## El principio: primitiva e instrumento, por tipo de parámetro

Salió de una corrección de Cristóbal sobre la primera versión, y ordena el resto
de la interfaz:

> *«No puede ser que repitamos la misma primitiva para todos los parámetros,
> porque no aplica… En el caso del color serán parchecitos de color, en el caso
> de la tipografía será un fragmento de texto, en el caso de la punta redondeada
> será un recuadro.»*

**Cada tipo de parámetro tiene dos cosas propias:**

| | |
|---|---|
| **Su primitiva** | cómo se muestra. Un color en parches, una familia en un fragmento de texto, una holgura en una caja con su aire visible, una retícula en columnas. |
| **Su instrumento** | cómo se define. Y se define **mirando**: el selector de tipografías para una familia, el lienzo con texto sobre un fondo para una holgura. |

Y de ahí la segunda mitad de la corrección: **los instrumentos no son etapas del
flujo, son ventanas que se abren desde el parámetro.**

> *«Si traigo una tipografía en PDF, ya la tengo, está, no necesito ir a la
> librería de tipografías. Si llego con una tipografía en un impreso, en una
> imagen, ahí sí necesito ir.»*

O sea: no existe una «pantalla de definición» genérica. Existe una lista de
parámetros, y cada uno abre lo suyo cuando hace falta.

Hay una novena primitiva que importa tanto como las ocho: **`sin definir`**, en
línea punteada. Un parámetro sin resolver tampoco puede parecerse a un color
gris.

## 1. Inicio — *pendiente de revisión*

No es una galería de trabajos previos. Es la pregunta **¿en qué vas a trabajar?**,
tomando el modelo de las aplicaciones de Adobe:

- **Los mundos**, en cuadrantes con ícono. Primero eliges el mundo, y recién
  dentro de él empiezas a construir. Cada mundo trae su propio núcleo (ver
  [`ARQUITECTURA.md`](ARQUITECTURA.md)).
- **Abrir**, con su botón grande y la lista de archivos recientes, para el que
  no viene a empezar algo nuevo.
- **Una tira abajo**, ocupando cerca de un tercio, con cuatro o cinco
  primitivas que muestran visualmente los sets ya creados. No es lo principal.

Los cuatro mundos del prototipo —Editorial, Marca y packaging, Digital,
Campaña— son **propuesta mía**, agrupando los seis que Cristóbal nombró
(packaging, editorial, campaña de marketing digital, web, libro, revista) en
los «tres o cuatro» que pidió. Sin confirmar.

## 2. Recolección — *pendiente de revisión*

El ciclo, tal como lo describió:

1. Se incorpora un insumo.
2. Se define **qué se quiere incorporar desde ese insumo** — no todo su
   contenido: inspirarse en un referente nunca significa adoptarlo entero.
3. Se registra, y cada extracción queda trazada al requisito que resuelve.
4. **El sistema pregunta:** ¿seguir incorporando insumos, o avanzar?

Arriba de la lista va la zona para **incorporar**, que acepta clic o arrastrar y
soltar. Un detalle que parece menor y no lo es: en la primera versión ese botón
decía «incorporar» y en realidad sólo pasaba al siguiente insumo de la lista. Un
control que dice una cosa y hace otra es peor que no tenerlo, sobre todo en un
prototipo, porque quien lo mira da por construido algo que no existe.

## 3. Definición — *pendiente de revisión*

El listado de lo que debería haber —el núcleo— mostrando cuáles ya vienen
resueltos desde los insumos y cuáles quedan pendientes. Cada pendiente ofrece
los tres caminos: **Insumo · Diseñador · ContOpe**.

La completitud es binaria y se ve: sin todo resuelto no se habilita la
armonización.

En el prototipo son los **43 requisitos reales** del manifiesto, en cinco
dimensiones.

**Cada requisito lleva su explicación.** Cristóbal la pidió mirando la pantalla:
*«¿qué quiere decir que cuenta con un fundamento de color efectivo? Eso necesita
ser explicado. Por lo menos, para mí no está claro.»* Están escritas las 43, en
castellano llano y con el ejemplo concreto cuando ayuda. Se abren con un `?` en
cada fila.

**Y un requisito puede venir de dos insumos a la vez.** Cuando pasa, quedan las
dos fuentes registradas y sale un aviso: cuál manda lo decide la armonización,
no la recolección.

## 4. Construcción y armonización — *sin dibujar*

El editor visual. La pieza más grande, y no se dibuja sin conversarla.

## 5. Elegir tipografía — **aprobado**

> *«Es exactamente lo que quería lo que hiciste con ese filtro de tipografía.»*

La especificación es de agosto (`vision-page-builder-wordpress.md` en el vault):
búsqueda semántica de tipografías al modo de **Adobe Retype**, con un árbol de
cuatro casos. La decisión de hoy es **no inventar vocabulario semántico
propio**: se trasplanta el sistema de Google tal cual.

> *«La forma en que Google lo hace está perfecta, entonces si podemos
> trasplantar su sistema para acá, está perfecto.»*

### El origen de los datos

```
https://fonts.google.com/metadata/fonts
```

Público, **sin clave**, ~2,7 MB, **1.946 familias**. Por familia entrega:
`family`, `displayName`, `category`, `stroke`, `classifications`, `fonts`
(pesos e itálicas), `axes` (ejes variables con rango), `subsets` y `languages`,
`designers`, `popularity`, `trending`, `dateAdded`, `isOpenSource`.

No confundir con la API de desarrollador (`googleapis.com/webfonts/v1`), que
**sí pide clave y entrega menos**: no trae `stroke` ni `classifications`.

### Los filtros, que son los de Google

| filtro | campo | familias |
|---|---|---|
| Categoría | `category` | Sans Serif 720 · Display 468 · Handwriting 358 · Serif 349 · Monospace 51 |
| Trazo | `stroke` | Sans Serif 916 · Serif 415 · Slab Serif 30 |
| Peso | claves de `fonts` | 555 con pesos 100–300 |
| Itálica | claves de `fonts` con sufijo `i` | 347 |
| Variable / Ancho | `axes` | 541 con `wght` · 97 con `wdth` |
| Idioma | `subsets` | 181 escrituras distintas |
| Orden | `popularity`, `trending`, `dateAdded` | — |

### Dos cosas medidas que hay que tener presentes

**`stroke` no está declarado en 585 de 1.946.** Al filtrar por trazo, esas
desaparecen. Desaparecer en silencio es el mismo defecto que el valor por
defecto: el resultado se ve completo y no lo está. **El contador debería decir
cuántas quedaron fuera por no declarar el campo**, no sólo cuántas calzaron.

**El ancho no siempre está en los metadatos.** 97 familias declaran el eje
`wdth`; otras 35 llevan el ancho **sólo en el nombre** (Archivo Narrow, Barlow
Condensed, Asap Condensed). Filtrar por ancho sin leer el nombre pierde fuentes
evidentes.

### Lo que esto reemplaza

La v1 se construyó el 13 de agosto: `TypographyFontPicker`, commit `a786216`,
con un **catálogo estático de 30 familias** escrito a mano
(`packages/shared/src/google-fonts-catalog.ts` en el repositorio anterior), más
`7c6ce14` para cargar la elegida en la vista previa. Su propio comentario decía
que guardaba `category` «for the future semantic filter (v2)».

Esto **es** esa v2, y **reemplaza** la v1: no conviven.

### La regla que no se toca

De la especificación de agosto, y sigue en pie:

> *«nunca se autoselecciona una sola candidata sin mostrar alternativas»*

El prefiltro llega puesto según lo leído del insumo, y es **modificable**. Es un
punto de partida, no una respuesta cerrada. La decisión final es del diseñador.

### El árbol de cuatro casos, sin cambios

1. **Nombre conocido y está en Google Fonts** → se usa directo, sin selector.
2. **Nombre conocido pero no está** (típico de un IDML con tipografía de pago) →
   hay nombre, no hay muestra. Se busca equivalencia por sus propiedades.
3. **Sólo hay muestra visual, sin nombre** → análisis de la muestra. El caso
   técnicamente más difícil; no está resuelto.
4. **Ni nombre ni muestra** → el sistema declara la tipografía no disponible.

El selector aparece en los casos 2, 3 y 4. En el 2 y el 3 llega prefiltrado.

## Lo construido (14 de septiembre)

Vive en `packages/desktop`. Corre de dos maneras: como ventana de escritorio
(`pnpm dev`, Electron) y como página en un navegador común (`pnpm dev:web`),
para poder revisarla sin instalar nada. Las dos usan el mismo código; sólo
cambia el puente al disco.

### Qué hay

| pantalla | estado | qué hace de verdad |
|---|---|---|
| 1. Inicio | construida, pendiente de revisión | Los cuatro mundos (propuesta), abrir, recientes, y la tira de sistemas ya construidos mostrados por sus colores y su familia. Dice en pantalla que el núcleo por mundo no está investigado. |
| 2. Recolección | construida, pendiente de revisión | Entran archivos reales, por el selector del sistema o arrastrados. Se leen **CSS** (colores, familias, longitudes), **tokens W3C** (color, fontFamily, dimension), **imágenes** (paleta dominante) e **IDML** (muestras de color, familias, estilos de párrafo). PDF y el resto se registran como referente y lo dicen. Cada candidato apunta al requisito que resuelve y declara lo que el insumo no trae (una licencia, por ejemplo). |
| 3. Definición | construida, pendiente de revisión | Los 43 requisitos reales, evaluados por `evaluateManifest` del núcleo: cada uno resuelto o no, con sus motivos. Tres caminos por pendiente; **Diseñador** abre el instrumento del parámetro, **ContOpe** crea el encargo, **Insumo** manda a recolección. Aprobar pide la fuerza. Explicaciones de las 43. |
| 4. Construcción y armonización | sin dibujar | Muestra el estado real por dimensión, los encargos y los conflictos de origen. Nada más, porque no se dibuja sin conversarla. |
| 5. Elegir tipografía | construida sobre lo aprobado | Las 1.946 familias de Google Fonts con los filtros de Google, muestra viva, contador de las que no declaran trazo, ancho leído del nombre, y el árbol de cuatro casos con prefiltro modificable. |

Instrumentos, además del selector de tipografías: **parches de color** para el
fundamento cromático (dim1.req01) y **la regla de escala espacial**
(dim3.req01). Para todo lo demás, un **editor estructurado** que sigue el
`payloadSchema` del requisito campo por campo —colores con parche, referencias
eligiendo entre lo ya definido, listas con filas— y evalúa en vivo con el
evaluador real. No es texto libre; es lo que falta mientras cada parámetro no
tenga su instrumento visual, y así lo dice en su barra.

### Decisiones tomadas sin preguntar

Todas son reversibles y están anotadas donde se tomaron. Se listan para que
se puedan revertir sabiendo por qué existían.

- **Electron + Vite + React.** No hay Rust instalado (Tauri no era opción sin
  cambiar el sistema); React es lo que más asistentes saben mantener; MIT las
  tres, compatibles con GPLv3.
- **El archivo del taller es `*.contope.json`** (`kind: contope/sistema`). Guarda
  el `DesignSetV0` tal cual lo define el núcleo, más lo que la interfaz
  necesita para retomar: insumos con sus candidatos, caminos asignados,
  conflictos, encargos, verificaciones y la última cápsula exportada (para
  continuar su linaje).
- **Toda definición entra como `propuesta`**, venga del insumo, del diseñador
  o de ContOpe. Aprobar es un acto aparte, y es donde se declara la fuerza.
  Editar una aprobada la devuelve a propuesta. Lo que viene de insumo entra
  `explorable`, lo más débil, hasta que alguien diga otra cosa.
- **Un segundo insumo para un requisito ya resuelto no lo pisa ni se mezcla:**
  queda como conflicto, para la armonización. Dos candidatos del MISMO insumo
  sí se unen.
- **Un encargo a ContOpe es una definición declarada y vacía** en la cápsula
  (`resolution: develop`, sin valor), con su `developmentTask` activa
  restringida por las dependencias ya resueltas. Traer de vuelta lo que la IA
  proponga **no está construido**.
- **La cápsula** son `design-contract.json` + `DESIGN.md`, calculados por los
  proyectores del núcleo. Una entrada aprobada es `human-confirmed`; de insumo
  sin aprobar, `deterministic-extraction`; de ContOpe, `model-proposal`.
- **Las rectoras (descriptor, mood wall) se pasan sin restricciones**, como en
  la fixture del núcleo, porque el taller no tiene todavía dónde declararlas.
- **El catálogo de Google Fonts viaja en el repositorio** como copia fechada
  (`datos/catalogo-google-fonts.json`, script en `scripts/`), para que el
  selector no quede vacío sin red. Actualizarlo desde el programa sólo funciona
  en Electron (Google no manda cabeceras CORS).
- **El reparto institucional/neutro de los colores extraídos es una propuesta**
  por croma, corregible en el instrumento. El CMYK de un IDML se muestra en
  hex aproximado y se dice.
- **Los mundos usan todos el mismo manifiesto**, y la pantalla lo dice. Cuando
  exista el core por mundo, ahí se conecta.

### Lo que falta, en orden de lo que más pesa

1. La pantalla 4: el editor visual y el artefacto de exhibición para la
   armonización. Sin conversarla, no.
2. Instrumentos visuales para el resto de los parámetros (roles de color,
   superficies, estados, roles tipográficos, retícula, imagen…). Hoy los
   resuelve el editor estructurado.
3. El caso 3 del selector tipográfico (sólo muestra visual) y la lectura de
   PDF.
4. Traer al archivo las propuestas que la IA de escritorio haga sobre los
   encargos.
5. Un instalador. Hoy se corre desde el repositorio.
