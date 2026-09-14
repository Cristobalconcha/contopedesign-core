# La interfaz

Primera pasada, 13 de septiembre de 2026. Descrita por Cristóbal, prototipada y
revisada mirándola. Lo que está aprobado se marca; lo que no, también.

Prototipo navegable:
<https://claude.ai/code/artifact/aadcd1ef-9673-4fea-9036-651aae455220>

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

## 3. Definición — *pendiente de revisión*

El listado de lo que debería haber —el núcleo— mostrando cuáles ya vienen
resueltos desde los insumos y cuáles quedan pendientes. Cada pendiente ofrece
los tres caminos: **Insumo · Diseñador · ContOpe**.

La completitud es binaria y se ve: sin todo resuelto no se habilita la
armonización.

En el prototipo son los **43 requisitos reales** del manifiesto, en cinco
dimensiones.

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
