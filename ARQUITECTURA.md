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

## Pendiente abierto: hasta dónde llega `nulo`

Cristóbal levantó esto el mismo día que definió el cuarto camino, y tiene
razón. En términos lógicos `nulo` es correcto; en términos prácticos hay un
caso que no resuelve:

> *«Si necesito mostrar algo en mi página, no puedo generar un valor por
> defecto, no tengo definido el color, y quiero mostrar un texto o un recuadro.
> ¿Qué hago con ese valor? Que no puede ser ni por defecto, y está, además,
> voluntariamente no definido.»*

### La distinción que lo ordena

Hay dos clases de propiedad, y `nulo` significa cosas distintas en cada una:

- **Las que pueden no estar.** Sombra, borde, textura, animación. `nulo`
  funciona limpio: no se dibuja, no hace falta ningún valor.
- **Las que el medio resuelve siempre.** El color de un texto, el fondo de algo
  que se pinta, el tamaño de la letra. Acá **no existe «no decidir»**: si el
  set no decide, decide el navegador, o decide el destino. Para éstas `nulo` no
  está prohibido — **es inalcanzable**. No hay un estado del mundo donde el
  texto no tenga color.

### La salida propuesta

Un **mínimo irreducible** —el *core dentro del core* que Cristóbal intuyó—:
un conjunto chico de requisitos donde `nulo` no es un camino legal.

No porque el sistema los rellene, sino porque **el sistema se niega a darse por
completo hasta que alguien los defina.** Es lo contrario de un valor por
defecto:

| | |
|---|---|
| **Valor por defecto** | el sistema rellena en silencio, nadie se entera |
| **Mínimo irreducible** | el sistema no se completa, y lo dice |

La maquinaria ya existe: la completitud es binaria. Esos requisitos
simplemente no admiten `nulo`.

Y hay una tercera resolución que tampoco es un default y cubre muchos casos:
**herencia declarada.** El fondo de un recuadro puede resolverse como «el rol
superficie». Eso no inventa un valor: declara de dónde viene, y queda escrito.

### Por qué no es teórico

Medido en el plugin el 2026-09-13: el destino ya aplica **seis** valores de
respaldo por su cuenta, y tres son los colores del panel de WordPress.

| variable | lo que pone el destino |
|---|---|
| `--cod-color-accent` | `#2271b1` |
| `--cod-color-ink` | `#1d2327` |
| `--cod-color-surface` | `#f0f0f1` |

Si el set no define el acento, el sitio se pinta del azul de WordPress. Eso es
exactamente el problema, ya ocurriendo, antes de que `nulo` existiera.

### Qué falta

Definir **cuáles** requisitos componen ese mínimo. Es trabajo de la taxonomía,
no de la implementación. Hasta entonces el tipo acepta `nulo` en cualquier
requisito y nada lo impide: está anotado como pendiente, no como decisión.
