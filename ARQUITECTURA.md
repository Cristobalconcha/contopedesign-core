# Cómo funciona el programa

Descrito por Cristóbal Concha el 13 de septiembre de 2026. Lo que sigue es su
diseño; donde agrego algo, lo digo.

## Lo que es, y lo que no

ContOpe Design **no es un recolector de variables de estilo.** Es un
**organizador**, con una capa de inteligencia encima que permite el proceso de
armonización.

Esa distinción decide el producto entero. Un recolector se mide por cuántas
variables junta; se puede evaluar leyendo una lista. Un organizador se mide por
si las partes se sostienen unas a otras — y eso **no se puede leer, hay que
verlo.** De ahí sale todo lo demás.

> *«Para que verdaderamente valga la pena como sistema, más que un recolector o
> recopilador de variables de estilo.»*

## Las cuatro fases

### 1. Recolección

Entran los referentes y los insumos: un IDML, tokens del W3C, una configuración
de Tailwind, variables CSS, imágenes, páginas, lo que sea. Se registran como
fuentes, con su procedencia.

### 2. Definición

Acá se construye, y **requiere una capa visual** — algo del orden de lo que
GrapesJS le da al plugin de Web.

La razón no es comodidad. Es que una definición de diseño no se puede tomar
leyendo su código:

> *«No voy a poner un color que es un código, necesito mostrarlo. Necesito ver
> un tratamiento de foto, necesito ver cómo actúa una fotografía, o un fondo, o
> los espacios, la sangría, las tipografías. Todo eso tiene que ser visible,
> visual.»*

Un `#70745E` no es una decisión; es la anotación de una decisión que se tomó
mirando. El programa tiene que devolver la mirada, no el código.

### 3. Cierre de definición

Cuando el diseñador terminó de definir lo que tiene o quiere, **la IA construye
lo que le quedó asignado** — las dimensiones requeridas cuyo camino de
resolución es ContOpe, usando los sistemas conocidos como referentes para
integrar las variables correctas.

### 4. Armonización

**La fase más importante del ciclo**, y la que justifica que esto sea un
sistema y no una planilla.

También tiene que manifestarse visualmente. No se armoniza una lista: se
armoniza lo que se ve junto.

Acá el sistema **señala** las disonancias, y el diseñador las valida, las anota
o las corrige (ver [`prompts/identidad.md`](prompts/identidad.md)).

**También los conflictos de origen.** Si dos insumos resuelven el mismo
requisito con valores distintos, la recolección registra los dos y sigue: cuál
manda lo decide la armonización. Una disonancia de procedencia es una
disonancia como cualquier otra.

El contrato ya lo modela: `evidenceSourceIds` es una lista, y `supersededValue`
guarda lo que quedó de lado. **Con un límite conocido:** `supersededValue` es
uno solo, así que con tres fuentes en conflicto se perdería el registro de una.
Anotado, no resuelto.

## El flujo completo, paso a paso

Precisado por Cristóbal el 18 de septiembre de 2026, después de medir lo que
Claude Design define para impreso. Las cuatro fases de arriba siguen valiendo;
esto las ordena en seis pasos y agrega los dos que faltaban: el **alcance** al
principio y los **árbitros** al final. Dos ideas atraviesan todo el flujo:

- **ContOpe produce sistemas de diseño, no piezas.** En el core no hay encargo;
  el encargo es trabajo de la aplicación de destino, que arma la pieza con el
  ADN que el sistema declaró.
- **Lo que el diseñador declara al principio sirve para una sola cosa:** acotar
  qué se le va a exigir al sistema. No dirige la definición ni la reemplaza.

No es un flujo nuevo. El 29 de agosto Cristóbal ya había descrito tres de sus
piezas (vault, `vision-flujo-definicion-cristobal-2026-08-29.md`): seleccionar
qué se toma de cada insumo, dos caminos para lo que ningún insumo cubre
(diseñador o IA), y GrapesJS dentro del escritorio como el lugar donde se
define lo manual. Lo que agrega el 18 de septiembre es el paso de alcance al
principio, la separación entre referentes y cortapisas, y los árbitros por
universo al final.

### 0. Alcance: qué sistema se va a definir

El diseñador elige el mundo, o describe en pocas palabras el trabajo al que va
el sistema: una línea de cartelería, un sitio, una revista. No es un brief de
pieza. Es la forma de saber qué dimensiones importan.

Con eso, el programa **desglosa las dimensiones del mundo**: el catálogo entero
de ese mundo, con las del núcleo marcadas como irrenunciables. El diseñador
marca con casillas cuáles más quiere que queden definidas. El resultado es el
**paquete de definiciones** del sistema:

> *«Una personalización del universo de dimensiones establecido por el core
> para un tipo de trabajo.»*

Desde ahí, la completitud se mide contra ese paquete y no contra el manifiesto
entero (decisión del 13 de septiembre). Lo que no está en el paquete no es una
ausencia: es algo que este sistema no declara.

*Estado:* **construida el 18 de septiembre** (`pantallas/Alcance.tsx`, commit
`8b7187d`): la línea de propósito, el desglose con casillas, las del núcleo
fijas, y Definición mide contra el paquete. El catálogo tiene 84 preguntas en
diez dimensiones; los núcleos de dos mundos viven en `packages/core/src/nucleo/`.

### 1. Insumos, en dos carriles

**Carril de referentes.** Piezas o sistemas de los que se toma algo. De cada
uno se marca, sobre el mismo desglose de dimensiones, **qué se toma**: la
paleta de este, la retícula de aquel. Inspirarse en un referente nunca es
adoptarlo entero.

**Carril de cortapisas.** El manual de estilo, el logotipo, la paleta
institucional; o el sistema anterior, cuando lo nuevo es una variante suya. Lo
que traen no se discute: entra como restricción, y en el core es una rectora.
También acá se marca qué se toma y qué queda abierto para cambiar.

Los dos carriles reciben lo mismo (IDML, PDF, tokens, CSS, imágenes, páginas
web); lo que cambia es la fuerza con que entra lo que traen.

*Estado:* **construido el 18 de septiembre** (commit `2587a3a`): el conmutador
referente/cortapisa, los chips de «qué tomo de este insumo» por dimensión, y
la cortapisa entrando aprobada e inamovible (si desplaza a un referente, lo
desplazado queda en conflictos para la armonización). Recolección lee CSS,
tokens W3C, imágenes e IDML; PDF y páginas web sólo se registran. Las rectoras
del núcleo (descriptor, mood wall) siguen sin restricciones: una cortapisa se
expresa por fuerza y ciclo de vida, no por tags.

### 2. Rieles: quién resuelve cada vacío

Restando lo que trajeron los insumos del paquete declarado, quedan los vacíos.
Cada uno se asigna: lo define el diseñador o lo define la IA. Son los tres
rieles de la taxonomía (insumo, diseñador, ContOpe). Recién con todos los
vacíos asignados empieza la definición.

**Pero la asignación no es una puerta cerrada.** Definir algo puede abrir
vacíos nuevos, porque una respuesta apunta a otra (un estilo de borde que usa
un color de la paleta, una regla de escala que pide una base). Cuando aparece
un vacío nuevo, se asigna ahí mismo, sin volver al principio; y una asignación
hecha se puede cambiar de riel en cualquier momento (Cristóbal, 18 de
septiembre).

*Estado:* existe, y ya se comporta así: cada pregunta pendiente ofrece los tres
caminos desde Definición, sin una pantalla de asignación previa que haya que
cerrar. Cada pregunta pendiente ofrece los tres caminos, y un encargo
a ContOpe queda como definición declarada y vacía en la cápsula.

### 3. Definición: el manifiesto con sus primitivas, y el editor

Se muestra el manifiesto con todo lo que ya se tomó, **exhibido con la
primitiva de cada dimensión** (color en parches, tipografía en texto, holgura
en una caja con su aire). Para lo asignado al diseñador, «nuevo» **abre el
editor en el apartado de la variable que toca**: si es la paleta, el apartado
de color. Lo definido ahí se guarda en el set, por variable.

El editor puede ser GrapesJS, el mismo del plugin web. No es obligatorio, es
una opción ya construida; pero tiene una virtud que no tiene ningún otro: amarra
la definición con el universo web, donde ya hay un destino real que lee esas
mismas variables. Es compatible con el principio de INTERFAZ.md: un instrumento
por tipo de parámetro, que se abre desde el parámetro.

#### Tres formas de definir, según lo que se define — aceptado (decisión 26); la declaración tiene instrumento desde el 18-09

Cristóbal puso el caso límite: *«Libro de 48 páginas en pliegos de 8 con
corchete y hotmelt»*. Una primitiva que exprese el sistema de encuadernación
abarca demasiadas cosas indefinidas; tendría la complejidad de todo el sistema.
Su intuición: esas definiciones **pasan como prompt**, y el destino (InDesign)
guarda esas definiciones en una memoria propia. Lo que propongo es darle forma
a eso sin inventar nada nuevo en el core:

| forma | qué define | cómo se muestra | cómo se comprueba | dónde vive en el core |
|---|---|---|---|---|
| **Por variable** | color, tipografía, espacio, borde, retícula, imagen: lo que se reduce a valores con rol | primitiva e instrumento propios; GrapesJS para el subconjunto que es CSS | predicado del manifiesto (máquina) | los payloads de hoy |
| **Por declaración** | encuadernación, materialidad, acabado, terminaciones, plegado, y todo lo que no cabe en un valor | una tarjeta con el texto, tal cual, junto a las demás primitivas (instrumento `Declaracion.tsx`: texto, qué acota, quién ejecuta, o «no aplica» con porqué) | no la valida un predicado: la lee la IA en la armonización (que es la etapa que trabaja con IA, decisión 23) y la confirma el diseñador | payload `texto` + cláusula `verified`, que ya existen |
| **Por referencia** | «como en el sistema anterior», «como en este referente» | la primitiva del referente, marcada como tomada | `ref` + presencia | los referentes y las cortapisas del paso 1 |

Lo que hace que la declaración no sea texto suelto son dos campos, además del
texto: **qué acota** (las preguntas o dimensiones sobre las que manda: el
libro de 48 en pliegos de 8 acota los formatos, las estructuras físicas y las
zonas seguras) y **quién la ejecuta** (el destino). Con eso, la armonización
puede cruzarla contra lo definido por variable, y la IA puede señalar si la
zona segura o el sangrado no calzan con lo que la declaración exige.

**La memoria en el destino ya tiene nombre:** la cápsula. `DESIGN.md` es el
canal en prosa y `design-contract.json` el canal por variable; el plugin de
destino (InDesign, WordPress) guarda la cápsula y le entrega las declaraciones
a la IA que opera ahí. Eso calza con el mandato de siempre: la IA opera la
herramienta real, y con «pliegos de 8, corchete y hotmelt» arma el documento
como lo armaría un diseñador. Lo que el destino aprenda al ejecutar (la
imposición real, por ejemplo) vuelve como verificación, no como cambio del set.

Consecuencia sobre la décima dimensión: si materialidad, acabado, terminaciones
y encuadernación entran como declaraciones, la dimensión es barata: preguntas
con payload `texto`, sin predicados que inventar. **Hecho el mismo día**
(`dim10`, «Salida física», cinco preguntas, commit `0d37e33`): la primera vez
que el formato de ids cambió, como decía la spec que pasaría.

**Cristóbal estuvo de acuerdo, y agregó el marco:** esto es la versión alfa,
cero. Se parte con un set de dimensiones, y cuando se note que faltaban cosas,
se agregan en su momento. Es un sistema propietario; se mejora a medida que
surgen necesidades. Dicho de otro modo: que las dimensiones sean nueve, o diez,
no es una verdad del diseño, es el estado del catálogo hoy. Lo que sí es fijo
es la forma de agregar una (MAPA.md, «cómo se agrega una dimensión») y que una
dimensión nueva es un cambio mayor del formato, no un parche.

*Estado:* Definición muestra las 84 preguntas con su explicación; hay tres
instrumentos visuales y un editor estructurado por campo para el resto. Las
primitivas de las cuatro dimensiones nuevas se muestran como texto. **GrapesJS
no está en el escritorio.**

### 4. La IA construye lo suyo

La IA construye sus propuestas para lo que le quedó asignado, usando como
referencia los sistemas conocidos. **Cuándo, da lo mismo, con una sola
condición: antes de armonizar.** Y por lógica de tiempo conviene que sea **en
simultáneo con las definiciones del diseñador**, porque él no necesita a la IA
para lo que define por sí mismo (Cristóbal, 18 de septiembre). El único cuidado
es el de las dependencias: una propuesta de la IA que apunte a algo que el
diseñador todavía no definió se rehace cuando eso quede definido.

**Y acá nace el modelo.** Mientras el diseñador resuelve, todo lo que resuelve
(qué marcó en el alcance, qué tomó de cada insumo, qué definió por sí mismo, qué
aprobó y con qué fuerza) puede ir entrenando **en modo sombra un modelo local**:
un modelo que observa sin intervenir y aprende el estilo de ese diseñador, es
decir, cómo resuelve él las dimensiones. Con eso el modelo llega a **habitar el
ContOpe core del diseñador**: no un asistente genérico que propone lo habitual,
sino uno que propone como propondría él. Cristóbal lo dijo sin rodeos: *«esto es
el modelo»*. No es una función más del paso 4; es lo que el paso 4 termina
siendo cuando hay datos. Los datos ya existen en el formato del taller
(`*.contope.json`: caminos asignados, propuestas, aprobaciones con fuerza,
cápsulas), y la regla de fuerza del set (`human-confirmed` contra
`model-proposal`) es justo la etiqueta que un entrenamiento así necesita.

*Estado:* el encargo existe; **traer de vuelta lo que la IA proponga no está
construido**, y el modo sombra no está ni diseñado. Lo que sí está es el registro
de lo que el diseñador resuelve, que es su materia prima.

### 5. Armonización, con árbitros por universo

Cuando todas las casillas del paquete están llenas viene la etapa más
importante. Ahí entran los sistemas de diseño de referencia, y la precisión
nueva es que **cada uno arbitra un universo**: hay sistemas que sirven para el
diseño editorial, otros para el web, otros para marketing o para interfaces.
Ninguno sirve para todo.

Esto se midió el mismo día: las reglas de impreso de Claude Design describen un
documento de oficina, y el folleto real de Santa Luisa, que es imprenta, las
contradice en cuerpo, notas y filetes, y se imprimió bien (vault,
`nucleo-mundo-editorial-medicion-2026-09-18.md`). Un árbitro aplicado fuera de
su universo no armoniza: corrige lo que estaba bien. Por eso cada regla por
mundo lleva cita de su base de conocimiento y condición sobre lo que el sistema
declara soportar, y por eso los árbitros se eligen por universo.

**La armonización es una etapa, no un aviso que corre mientras se define.**
Propuse que los árbitros avisaran en vivo durante la definición, para no llegar
tarde; Cristóbal lo descartó, y el motivo ordena el resto: armonizar **requiere
IA** y se hace **iterativamente**. Definir es trabajo del diseñador; armonizar
es cuando trabaja el sistema. Se entra con todas las casillas del paquete
llenas, el sistema señala, el diseñador valida, anota o redefine, y se vuelve a
pasar, las veces que haga falta. La evaluación en vivo que hoy hace el
escritorio (resuelto o no, con motivos) no es armonización: es completitud.

**Cuando un árbitro choca con una cortapisa, gana la cortapisa.** Lo decidió
Cristóbal el mismo 18 de septiembre: si la paleta institucional entró como
restricción y el árbitro dice que ese color no tiene contraste sobre ese fondo,
el color no se toca. Lo que se redefine es el resto, hasta que armonice: el
color del texto, el tamaño, el fondo, lo que esté abierto. La armonización
señala la disonancia y pide esa redefinición; nunca «corrige» una cortapisa.

*Estado:* la armonización no existe (`constraintDefinitionIds` sigue reservado
y vacío). Lo que sí existe es la forma de un árbitro: reglas con umbral, cita y
condición en `nucleo/`, y la constatación de que hacen falta varios (oficina e
imprenta no son el mismo árbitro).

### Qué cambia respecto de las cuatro fases

| fase (13-09) | pasos (18-09) | lo nuevo |
|---|---|---|
| — | 0. Alcance | el paquete de definiciones, por casillas, antes de recolectar |
| 1. Recolección | 1. Insumos | dos carriles: referentes y cortapisas; marca de «qué tomo» |
| 2. Definición | 2. Rieles · 3. Definición | los rieles se asignan antes de definir; el editor abre en la variable |
| 3. Cierre | 4. La IA construye | sin cambio |
| 4. Armonización | 5. Armonización | árbitros específicos por universo, con cita y condición |

Lo que esto cambia en cada pantalla está en [`INTERFAZ.md`](INTERFAZ.md),
«Lo que el flujo del 18 de septiembre cambia».

## El artefacto de exhibición

Para que la armonización sea posible hace falta **un artefacto que exhiba las
reglas que se definieron.**

La referencia es el kit de Material Design que se abre en Figma: un conjunto de
aplicaciones que se derivan de las definiciones de color y tipografía. Pero
sirve como referencia, no como modelo, por dos razones que Cristóbal separa:

1. **Es demasiado rígido.** Se deriva sólo de color y tipografía. Las
   definiciones de este sistema son bastante más que eso.

2. **Y es más de fondo:** lo que hace Material con ese artefacto es *seguir
   mostrando el diseño de Material*, con variantes. Es su diseño teñido con tus
   colores.

> *«Lo que nosotros necesitamos es un artefacto como ese, pero para mostrar el
> catálogo de propiedades que acabamos de construir.»*

### Lo que eso implica — agregado mío, para revisión

Si el artefacto muestra **el catálogo propio** y no una plantilla teñida,
entonces se genera desde lo declarado, y hereda las reglas del set:

- **Sólo puede exhibir lo que está declarado.** No completa con «lo habitual»
  para que la lámina se vea llena.
- **Tiene que exhibirlo todo.** Una propiedad declarada que el artefacto no
  muestra es una propiedad que nadie va a armonizar.
- **La ausencia se exhibe.** Un requisito del núcleo sin resolver no es una
  lámina en blanco: es la información de que ahí falta trabajo, y tiene que
  verse como falta. La completitud es binaria y el artefacto debería dejarlo
  ver de un vistazo.
- **Lo que no está en el núcleo no es una ausencia.** Es, simplemente, algo que
  este sistema no declara. No se exhibe como hueco ni se ofrece para llenar:
  la forma del catálogo es la forma del sistema.
- **Las excepciones declaradas se muestran como excepciones**, con su nota al
  lado. Si el artefacto las aplana, la próxima revisión las «corrige».

Dicho de otro modo: el kit de Material es un diseño fijo parametrizado por
tokens. Este tiene que ser lo contrario — una exhibición **generada por lo que
el set declara**, que cambia de forma cuando el set cambia de forma, no sólo de
color.

## Qué falta construir

Lo que está hecho es el núcleo —el manifiesto de requisitos, el set, el
contrato y su forma portable— y, desde el 14 de septiembre, la primera pasada
de la interfaz en `packages/desktop`: recolección, definición y los primeros
instrumentos (ver [`INTERFAZ.md`](INTERFAZ.md)).

**Desde la noche del 17 al 18 de septiembre, el manifiesto cubre las nueve
dimensiones de la taxonomía** —73 requisitos: 13 de color, 8 de tipografía, 7 de
espacio, 8 de forma, 8 de imagen, 7 de composición, 8 de interacción, 7 de
movimiento y 7 de patrones—, cada una con su especificación en el vault y sus
pasadas adversariales. **Y desde la mañana del 18 de septiembre existen dos núcleos por mundo**
(`packages/core/src/nucleo/`): el web, que son los ocho roles del plugin dichos como
preguntas más la regla del contraste; y el editorial impreso, con cuarenta preguntas
y cuatro reglas, medido sobre el folleto real de Santa Luisa, las reglas de impreso
de Claude Design y el inventario de InDesign. Un núcleo son dos cosas: las
preguntas que ese mundo no puede dejar sin responder y las reglas con umbral y cita
que dicen cuándo una respuesta está bien; las reglas llevan condición cuando la
fuente describe un tipo de pieza (los umbrales de Claude Design valen para un
documento de oficina, no para un folleto de imprenta). Desde la tarde del 18 de septiembre los cuatro mundos tienen núcleo:
marca, medido sobre la identidad real de Santa Luisa y las referencias de marca de
Claude Design (sin pieza de packaging, y se dice); campaña, sobre las piezas para
redes (con la regla de 1080 px de ancho mínimo). Ver
`nucleo-mundos-marca-campana-medicion-2026-09-18.md` en el vault.
Y dos límites del formato que salieron medidos esa noche: una dependencia o una
referencia hacia **otra dimensión** no se puede **resolver** dentro del manifiesto
(el validador comprueba a qué requisito apunta, pero el evaluador arma su contexto
por dimensión y no la navega), así que esas relaciones viven en prosa y se resuelven
en el set; y un valor cerrado sólo entra si tiene cita, por
lo que los roles geométricos de la dimensión 4 los declara cada set y no el
manifiesto. [`MAPA.md`](MAPA.md) dice dónde vive cada cosa.

Lo que **todavía no existe** es lo que este documento dice que más importa: el
cierre de definición con la IA construyendo lo encargado, y la armonización
con su artefacto de exhibición. Eso es la capa visual grande, y no se dibuja
sin conversarla. La equivalente en el plugin de Web tomó meses.

Y desde el 18 de septiembre hay dos piezas más chicas que van **antes** que
esa, porque sin ellas el resto mide mal: la pantalla de alcance (el paquete de
definiciones por casillas) y los dos carriles de insumos con la marca de «qué
tomo». Están en «El flujo completo, paso a paso», más arriba.

## El core, y por qué no hay un cuarto camino

Durante unas horas del 13 de septiembre hubo un cuarto camino de resolución,
`nulo`: dejar una variable voluntariamente indefinida. Se descartó el mismo
día, y el motivo vale más que la regla.

### El supuesto falso

`nulo` daba por sentado que **todas las variables empiezan indefinidas** y el
trabajo consiste en irlas cerrando una por una, con la opción de cerrar algunas
diciendo «acá no va nada».

No es así:

> *«Hay un paquete base de definiciones que es el mínimo, es el core. Por eso se
> llama core, la aplicación me parece bien puesta por eso. Entonces, más bien,
> lo que puede hacer el diseñador es aumentar el número de variables, es que hay
> cosas nuevas que no están consideradas ahí. Entonces no tiene sentido poner
> variables en null.»*

El movimiento del diseñador sobre el core es **agregar**, no anular. Lo que no
está en el core simplemente no se declara —y no hace falta un camino de
resolución para decir que algo no existe—. Lo que sí está en el core no se
puede dejar sin resolver, porque sin eso **no hay con qué construir**: queda una
incógnita abierta.

Con el core haciendo ese trabajo, el cuarto camino deja de tener sentido. Los
caminos vuelven a ser tres: **insumo, diseñador, ContOpe.**

### El core no es uno solo

Depende del tipo de proyecto. No necesita las mismas definiciones un packaging
que una revista, ni una campaña de marketing digital que un libro.

> *«Cada uno de esos mundos, que tal vez habría que simplificarlos en unos tres
> o cuatro, tiene un paquete de definiciones que es el núcleo, que no puede no
> estar.»*

Hay además una segunda granularidad que Cristóbal mencionó y que conviene no
confundir con la anterior: **el core por cada bloque.** Un bloque —un botón, una
tabla, una galería— también tiene un mínimo sin el cual no se puede dibujar.
Queda anotado; cómo se relacionan las dos escalas está por trabajarse.

### Lo que falta: una investigación, no una implementación

Determinar **cuál es el núcleo de cada mundo**. Es trabajo de taxonomía y de
investigación de referencias, no de código. Cristóbal propuso hacerlo
justamente como un research de definiciones por tipo de proyecto.

Hasta que exista, el manifiesto no distingue entre un requisito que puede
faltar y uno sin el cual no hay nada que construir. **Eso sigue abierto.**

### Por qué no es teórico

Medido en el plugin el 2026-09-13: el destino aplica **seis** valores de
respaldo por su cuenta cuando el set calla, y tres son los colores del panel de
WordPress.

| variable | lo que pone el destino |
|---|---|
| `--cod-color-accent` | `#2271b1` |
| `--cod-color-ink` | `#1d2327` |
| `--cod-color-surface` | `#f0f0f1` |

Si el set no define el acento, el sitio se pinta del azul de WordPress, en
silencio, y el resultado **se ve razonable** —que es lo peor que puede pasar—.

Esas tres son justamente candidatas al core del mundo «web»: si pertenecen al
núcleo, el respaldo no debería ser un color sino un **error que diga qué falta**.
→ [`contope-publisher#9`](https://github.com/Cristobalconcha/contope-publisher/issues/9)
