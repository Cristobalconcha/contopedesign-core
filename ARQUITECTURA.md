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
- **La ausencia se exhibe, y hay dos ausencias distintas.** Una dimensión sin
  definiciones es trabajo pendiente. Una variable resuelta como **nulo** es una
  decisión tomada: el diseñador dijo que ahí no va nada. El artefacto tiene que
  distinguirlas, porque si las muestra igual, la primera parece resuelta y la
  segunda parece olvidada.
- **Las excepciones declaradas se muestran como excepciones**, con su nota al
  lado. Si el artefacto las aplana, la próxima revisión las «corrige».

Dicho de otro modo: el kit de Material es un diseño fijo parametrizado por
tokens. Este tiene que ser lo contrario — una exhibición **generada por lo que
el set declara**, que cambia de forma cuando el set cambia de forma, no sólo de
color.

## Qué falta construir

Lo que está hecho es el núcleo: el manifiesto de requisitos, el set, el
contrato y su forma portable. Todo lo de arriba que sea interfaz —las cuatro
fases y el artefacto— **todavía no existe**, en ningún repositorio.

La capa visual es la pieza más grande del trabajo. La equivalente en el plugin
de Web tomó meses.

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
