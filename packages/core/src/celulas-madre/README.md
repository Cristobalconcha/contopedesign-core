# Células Madre

> **Decisión 35** (Cristóbal, 08-10-2026, en el vault: `decisiones.md`): Core
> tiene dos partes. El **ADN** son las definiciones del sistema: qué color es el
> acento, qué retícula manda, cómo se mueve la marca. Es descripción. Las
> **Células Madre** son material hecho con ese ADN, en archivos que se importan
> tal cual en otra herramienta: *«una paleta de colores es más que una
> descripción, es un archivo que se puede importar. Igual que un archivo de
> gradientes o un archivo de animaciones de vectores»*; *«no es el ADN en sí,
> pero son células madre»*.

Las Células Madre son **un set de generadores**. Cada uno es una **extensión**
que toma su definición del ADN y construye archivos exportables. En la app, el
apartado Células Madre es **un menú** que ofrece generarlos
(`packages/desktop/src/pantallas/CelulasMadre.tsx`).

Y el requisito: **cada archivo lleva metadata que lo relaciona con su ancestro
de ADN**. Dentro del archivo cuando el formato lo permite, y siempre en su
ficha, porque formatos como `.ase` no tienen dónde guardarla.

**Cómo se entrega** (decisión 35, mismo día): *«descargarlo como zip con el
archivo fuente y la ficha como un readme del archivo»*. Cada generación baja
como **un `.zip`** (`<sistema>-<generador>.zip`: `econut-paleta-ase.zip`) con
los archivos en su formato y un **`LEEME.md`**: la ficha escrita para una
persona, que termina con la metadata en un bloque ```json para que ContOpe la
lea. Y al **exportar el ADN** (botón «Exportar ADN»), las Células Madre del
sistema van en el mismo zip que la cápsula, generadas de nuevo con ese ADN
(ver `packages/desktop/src/dominio/exportacion.ts`).

Lo que es pieza (el video de una campaña, la pantalla con la textura corriendo)
sigue fuera de Core.

## Qué hay

| archivo | qué hace |
|---|---|
| `tipos.ts` | `Generador` (la extensión), `Parametro`, `ArchivoGenerado`, `ArchivoRegistrado`, `MetadataDeCelula`, `FichaDeCelula`, `Vigencia`. |
| `huella.ts` | SHA-256 propio y síncrono, UTF-8, JSON canónico, `huella(payload)`. El núcleo no tiene `node:crypto` ni DOM (`lib` ES2023), y los generadores son síncronos. |
| `metadata.ts` | `metadataDeAncestro`, `fichaDe` (la metadata más la huella de cada archivo), `vigencia`, `leerMetadataDeCelula` y `leerFichaDeCelula` (desde JSON desconocido, fail-closed). |
| `leeme.ts` | `escribirLeeme` (la ficha para personas), `leerMetadataDeLeeme` (saca la ficha del bloque json de un `LEEME.md`), `NOMBRE_CORTO_DE_PREGUNTA`, `comoUsarArchivo` (por formato), `fechaEnPalabras`, `parametrosEnPalabras`. |
| `zip.ts` | `armarZip` (con `fflate`, determinista: fecha inyectada), `entradasDeCelula` (el LEEME y los archivos, opcionalmente en una carpeta), `zipDeCelula`, `nombreDePaquete`. |
| `registro.ts` | `GENERADORES`, `generadorPorId`, `resolverParametros`, `generarCelula` (comprueba, resuelve, genera, escribe el LEEME y arma el zip). |
| `color-del-adn.ts` | Lee los colores de la dimensión 1 y los pasa a sRGB (hex, rgb, hsl, oklch). |
| `ase.ts` | Escritor de Adobe Swatch Exchange 1.0. |
| `generador-paleta-ase.ts` | **Paleta de color** (`.ase`). |
| `generador-degradados-svg.ts` | **Degradados** (`.svg`). |
| `espacio-del-adn.ts` | Lee la dimensión 3 para dibujar: retículas, formatos de hoja (con su sangrado, zona segura y margen), línea base y unidad base, en px CSS y con la unidad en que se dibuja cada hoja. |
| `generador-grilla-svg.ts` | **Grilla** (`.svg`): la retícula sobre cada formato de hoja, en capas. |

Todo es puro: nada toca el disco. La única dependencia es `fflate` (zip puro,
sin `node:fs` ni DOM). Guardar es trabajo del escritorio (el puente:
`guardarArchivo`, un archivo con nombre sugerido).

## Cómo se agrega un generador

1. Un módulo `generador-<algo>.ts` que exporta un `Generador`:
   - `id` estable y en minúsculas (no cambia nunca: es lo que queda en la
     metadata de los archivos viejos) y `version` semver (se sube cuando cambia
     lo que escribe).
   - `nombre`, `descripcion`, `formato` y `queLee`, **en palabras de
     diseñador**: es lo que muestra el menú.
   - `lee`: los ids de requisito que consulta, o una función
     `(designSet, parametros) → ids` si depende de lo elegido. De acá salen los
     ancestros: lo que no esté en `lee` no deja el archivo desactualizado al
     cambiar.
   - `disponible(designSet)`: `{ ok: true }` o `{ ok: false, falta }`, con
     `falta` dicho para el diseñador y apuntando a dónde se define
     («Define primero los colores del sistema: en Definición › Color y
     superficies…»).
   - `parametros`: pocos, con valor por defecto. Cuatro clases: `si-no`,
     `numero` (con `min`, `max`, `paso`, `unidad`), `opcion` y `seleccion`
     (opciones que salen del ADN, opcionalmente `ordenada`, con `minimo` y
     con `maximo`; con `maximo: 1` el menú la muestra como elegir una).
   - `generar(designSet, parametros, contexto)`: devuelve los archivos
     (`{ nombre, tipoMime, contenido: Uint8Array | string }`). `contexto` trae
     el sistema, la fecha y la metadata ya armada: si el formato tiene dónde,
     el generador la mete adentro. **Determinista**: nada de `Date.now()` ni
     azar; la fecha viene en el contexto. Cada archivo puede traer un
     `detalle` (qué trae, en palabras), que el LEEME pone junto a su nombre.
   - `comoUsar` (opcional): si el generador sabe decir mejor que la receta
     del formato cómo se usan sus archivos (una grilla se coloca y se
     bloquea), el LEEME pone ese texto en «Cómo usarlo».
2. Sumarlo a `GENERADORES` en `registro.ts` y reexportarlo en `index.ts`. Si
   lee preguntas nuevas, darles nombre corto en `NOMBRE_CORTO_DE_PREGUNTA`
   (`leeme.ts`); si entrega un formato nuevo, decir cómo se usa en
   `COMO_USAR` (`leeme.ts`).
3. Pruebas: que el archivo se lea de vuelta con un lector propio de la prueba,
   que `disponible` diga qué falta, y que mismo ADN y parámetros den los mismos
   bytes.

El menú, el LEEME, el zip, el registro en el sistema, la exportación del ADN y
la vigencia no se tocan: salen solos.

## El `.zip` y su `LEEME.md`

```
econut-paleta-ase.zip
├── LEEME.md
└── econut-paleta.ase
```

El `LEEME.md` dice, sin jerga: qué es y para qué sirve (la `descripcion` del
generador), qué archivos trae, de qué sistema viene, generador y versión,
cuándo se generó (en hora de Chile), qué definiciones del ADN usó (nombre
corto, id, revisión y huella abreviada; las que consulta y no estaban
definidas, también), con qué parámetros (en palabras), cómo usar cada archivo
según su formato, y que queda desactualizado si las definiciones cambian. Al
final, una línea que dice que el bloque es para ContOpe y el bloque ```json
con la ficha (abajo). Si el generador entrega varios archivos, un solo LEEME
los describe todos. Si el JSON trajera comillas invertidas, la cerca se alarga.

El zip es determinista: las entradas llevan la fecha de la generación (en
cifras UTC, para no depender del huso del computador), en orden y con
compresión fija. Mismo ADN, parámetros y fecha → mismos bytes.

## La metadata

```json
{
  "kind": "contope/celula-madre",
  "schemaVersion": 1,
  "sistema": { "designId": "sistema-mf3k2a-x7q1", "nombre": "Econut", "designSetId": "ds-fixture-dim1" },
  "generador": { "id": "paleta-ase", "version": "1.0.0", "nombre": "Paleta de color" },
  "generadoEn": "2026-10-08T12:00:00.000Z",
  "consulta": ["dim1.req01", "dim1.req02"],
  "ancestros": [
    { "requirementId": "dim1.req01", "effectiveDefinitionId": "def-dim1.req01", "revision": 1,
      "huella": "sha256:d0083ebfb5ac799a7a3244e4bad9e2fc5fbff1191d46b9402eae4af1ca788905" },
    { "requirementId": "dim1.req02", "effectiveDefinitionId": "def-dim1.req02", "revision": 1,
      "huella": "sha256:98b862442f0b858850b91fe471df1c3f180f23acd68545bb971cc3306bce9b07" }
  ],
  "parametros": { "incluirRoles": true, "incluirRampas": false, "incluirImprenta": false },
  "archivos": [
    { "nombre": "econut-paleta.ase", "tipoMime": "application/octet-stream",
      "huella": "sha256:b0a3489020a3aa53029ed68291b0d2026c3e748804410137af57f2300379ff37" }
  ]
}
```

- `sistema.designId` es el id del sistema del taller; `designSetId`, el del set
  de definiciones. `vigencia` compara el segundo.
- `consulta`: las preguntas que el generador consulta (según los parámetros),
  estén o no definidas al generar. `ancestros`: las que existían, con su
  `effectiveDefinitionId`, su `revision` y la **huella**: `sha256:` + SHA-256
  del JSON canónico del payload (claves ordenadas, sin espacios).
- `archivos` sólo va en la ficha del `LEEME.md`: la huella de cada archivo que
  la acompaña en el zip; no puede ir dentro del mismo archivo sin morderse la
  cola. Lo demás es la metadata común (`MetadataDeCelula`), la misma que
  guarda el taller. `leerMetadataDeLeeme(texto)` la saca del último bloque
  ```json del LEEME, fail-closed.
- Dentro del archivo: SVG en `<metadata id="contope-celula-madre">` como JSON
  en CDATA; PNG irá en un chunk `iTXt` con la clave `contope:celula-madre`;
  una animación JSON, en su `meta`. El `.ase` sólo guarda la referencia corta
  en el nombre de cada grupo.

### Vigencia

`vigencia(metadata, designSetActual)`:

- **vigente**: todas las definiciones leídas tienen la misma huella.
- **desactualizada**, con la lista de cambios: una definición `cambio` (otra
  huella), fue `borrada`, o es `nueva` (el generador la consulta y al generar
  no estaba).
- **huérfana**: viene de otro set, o no queda ninguna de sus definiciones.

El taller guarda cada generación en `Sistema.celulasMadre` (metadata y huella
de cada archivo, no los archivos) y muestra el sello en el menú.

## Los generadores

**Paleta de color (`.ase`).** Un grupo por familia: institucionales, neutros
(`dim1.req01`), roles (`dim1.req02`, con el rol como nombre de muestra), cada
rampa (`dim1.req04`) e imprenta. Cada grupo se llama «<sistema> · ContOpe ·
<familia>», la única referencia al origen que cabe en un `.ase`. Muestras RGB
**globales**. Criterio sobre imprenta (`dim1.req14`), decidido sin preguntar:

- **CMYK, sí**, cuando el ADN declara la equivalencia con cuatro números (se
  leen como porcentaje si alguno pasa de 1). Es la receta de imprenta del
  sistema; convertir el RGB a CMYK acá sería inventarla.
- **Pantone, no.** El ADN guarda el nombre de la tinta, no sus valores de
  biblioteca, y una muestra plana necesita valores: poner los del RGB o el
  CMYK haría pasar una aproximación por la tinta.
- El alfa se descarta: el `.ase` no lo guarda.

**Degradados (`.svg`).** Con los colores que elija el diseñador, en su orden:
uno por par seguido o uno solo que pasa por todos; lineal (ángulo como en
Illustrator: 0° de izquierda a derecha, 90° de abajo hacia arriba) o radial.
`<linearGradient>`/`<radialGradient>` en `<defs>`, con id legible (Illustrator
lo usa como nombre de la muestra), paradas en hex sRGB y una lámina donde cada
degradado pinta una franja con su nombre.

**Grilla (`.svg`).** Lee la dimensión 3, como está en el manifiesto:

- `dim3.req04` **Retícula** (indispensable): `reticulas[]` con `contexto`,
  `columns` (1 a 8), `gap` (referencia a un paso de la escala de
  `dim3.req01`; también se acepta una longitud escrita) y `minColumnWidth`.
  No trae márgenes, filas ni módulos: es relativa a la hoja. Sin retícula,
  `disponible` dice «Define la retícula primero…».
- `dim3.req08` **Formatos de hoja** (indispensable, porque la retícula se
  reparte en la hoja): `formatos[]` con `nombre`, `formato` (letter, a4,
  legal, tabloid, a5, a3 o medida-declarada), `medida`, `orientacion` y
  `modo` (página fija o contenido corrido).
- `dim3.req09` **Sangrado y márgenes por formato** (opcional): el
  `sangrado`, la `zonaSegura` y el `margenTextoCorrido` del formato (se
  cruzan por nombre, como en el predicado). El margen del texto corrido es el
  margen de la grilla, igual en los cuatro lados. Sin él, la retícula ocupa la
  hoja entera y el LEEME lo dice.
- `dim3.req03` **Línea base** (opcional, sólo si se pide la capa) y
  `dim3.req01` **Unidad y escala** (el medianil y la línea base apuntan a su
  escala; la unidad base es una capa opcional, apagada por defecto).

Un SVG por cada retícula y cada formato elegidos (parámetros «Retículas» y
«Formatos de hoja»; por defecto, todos): la retícula no dice en qué hoja va.
Unidades: una hoja impresa con nombre se dibuja en mm (`width="210mm"`,
`viewBox` en mm: calza 1:1 al abrirla en Illustrator); una medida declarada,
en su propia unidad; el contenido corrido, en px (las hojas del insumo a
96/in: A4 794 × 1123). Las longitudes del ADN pasan por px CSS
(`lengthCssToPx`, que no adivina `%`, `em` ni `vw`) y de ahí a la unidad de la
hoja; las cotas dicen la medida en la unidad de la hoja y, si el ADN la
escribió en otra, como está escrita («4,23 mm (12pt)»).

Capas (un `<g>` de primer nivel cada una, con `id` ASCII y el nombre legible
en `inkscape:label` y `data-name`): Sangrado, Hoja, Zona segura, Márgenes,
Unidad base, Medianiles, Columnas, Línea base y Cotas. La hoja empieza en
(0, 0); si se dibuja el sangrado, el lienzo crece por fuera (`viewBox` con
origen negativo). Estilo «sólo líneas» (trazo de 0,25 pt, o 1 px en
pantalla, sin relleno) o «áreas translúcidas»; color de guía cian (o
magenta, o un color de rol o del fundamento, que entonces pasa a ser
ancestro). Las cotas escriben el ancho de cada columna, el medianil, el
margen y la línea base. Una retícula que no cabe en una hoja no genera y
dice cuál. El LEEME describe cada grilla en palabras y explica cómo usarla
en Illustrator, Figma e InDesign.

## Lo que falta

- **Animación vectorial de «Nocturno»** (texturas SVG animadas): el primer
  candidato según la decisión 35. Su programa corre en el computador de
  Cristóbal y no se ha revisado; cuando se traiga, entra como un generador más
  (y su `meta`, si exporta JSON, lleva esta metadata).
- **Texturas** (SVG y PNG con la metadata en `iTXt`): falta el codificador PNG
  en el núcleo (deflate sin dependencias, o un PNG sin comprimir).
- **Grillas como guías nativas** (InDesign: márgenes y columnas de la página
  maestra; Illustrator: guías): hoy la grilla es un SVG para colocar o
  convertir en guías a mano. Y **módulos**: el ADN no declara filas.
- **Librerías de estilo** (estilos de párrafo y carácter desde la dimensión 2:
  IDML parcial, o tokens W3C).
- Abrir un `.zip` de Célula Madre (o su `LEEME.md`) en el taller y decir de
  qué sistema viene y si está al día: `leerMetadataDeLeeme` ya lo lee; falta
  la pantalla (hoy la vigencia se ve sólo para lo generado desde el taller).
