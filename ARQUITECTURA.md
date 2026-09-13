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
- **La ausencia también se exhibe.** Una dimensión sin definiciones no es una
  lámina en blanco: es la información de que ahí falta trabajo. La completitud
  es binaria y el artefacto debería dejarla ver.
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
