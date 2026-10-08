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
de ADN**. Dentro del archivo cuando el formato lo permite, y siempre en un
archivo hermano `<archivo>.contope.json`, porque formatos como `.ase` no tienen
dónde guardarla.

Lo que es pieza (el video de una campaña, la pantalla con la textura corriendo)
sigue fuera de Core.

## Qué hay

| archivo | qué hace |
|---|---|
| `tipos.ts` | `Generador` (la extensión), `Parametro`, `ArchivoGenerado`, `MetadataDeCelula`, `HermanoDeCelula`, `Vigencia`. |
| `huella.ts` | SHA-256 propio y síncrono, UTF-8, JSON canónico, `huella(payload)`. El núcleo no tiene `node:crypto` ni DOM (`lib` ES2023), y los generadores son síncronos. |
| `metadata.ts` | `metadataDeAncestro`, `hermanoDe` (el `.contope.json`), `vigencia`, `leerMetadataDeCelula` (desde JSON desconocido, fail-closed). |
| `registro.ts` | `GENERADORES`, `generadorPorId`, `resolverParametros`, `generarCelula` (comprueba, resuelve, genera y agrega los hermanos). |
| `color-del-adn.ts` | Lee los colores de la dimensión 1 y los pasa a sRGB (hex, rgb, hsl, oklch). |
| `ase.ts` | Escritor de Adobe Swatch Exchange 1.0. |
| `generador-paleta-ase.ts` | **Paleta de color** (`.ase`). |
| `generador-degradados-svg.ts` | **Degradados** (`.svg`). |

Todo es puro: nada toca el disco. Guardar es trabajo del escritorio (el puente:
`guardarArchivos`).

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
     (opciones que salen del ADN, opcionalmente `ordenada` y con `minimo`).
   - `generar(designSet, parametros, contexto)`: devuelve los archivos
     (`{ nombre, tipoMime, contenido: Uint8Array | string }`). `contexto` trae
     el sistema, la fecha y la metadata ya armada: si el formato tiene dónde,
     el generador la mete adentro. **Determinista**: nada de `Date.now()` ni
     azar; la fecha viene en el contexto.
2. Sumarlo a `GENERADORES` en `registro.ts` y reexportarlo en `index.ts`.
3. Pruebas: que el archivo se lea de vuelta con un lector propio de la prueba,
   que `disponible` diga qué falta, y que mismo ADN y parámetros den los mismos
   bytes.

El menú, el registro en el sistema y la vigencia no se tocan: salen solos.

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
  "archivo": { "nombre": "econut-paleta.ase", "tipoMime": "application/octet-stream",
    "huella": "sha256:b0a3489020a3aa53029ed68291b0d2026c3e748804410137af57f2300379ff37" }
}
```

- `sistema.designId` es el id del sistema del taller; `designSetId`, el del set
  de definiciones. `vigencia` compara el segundo.
- `consulta`: las preguntas que el generador consulta (según los parámetros),
  estén o no definidas al generar. `ancestros`: las que existían, con su
  `effectiveDefinitionId`, su `revision` y la **huella**: `sha256:` + SHA-256
  del JSON canónico del payload (claves ordenadas, sin espacios).
- `archivo` sólo va en el `.contope.json` hermano: es la huella del archivo
  que acompaña, y no puede ir dentro del mismo archivo sin morderse la cola.
- Dentro del archivo: SVG en `<metadata id="contope-celula-madre">` como JSON
  en CDATA; PNG irá en un chunk `iTXt` con la clave `contope:celula-madre`;
  una animación JSON, en su `meta`.
- El hermano se llama como el archivo más `.contope.json`
  (`econut-paleta.ase.contope.json`).

### Vigencia

`vigencia(metadata, designSetActual)`:

- **vigente**: todas las definiciones leídas tienen la misma huella.
- **desactualizada**, con la lista de cambios: una definición `cambio` (otra
  huella), fue `borrada`, o es `nueva` (el generador la consulta y al generar
  no estaba).
- **huérfana**: viene de otro set, o no queda ninguna de sus definiciones.

El taller guarda cada generación en `Sistema.celulasMadre` (metadata y huella
de cada archivo, no los archivos) y muestra el sello en el menú.

## Los dos primeros generadores

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

## Lo que falta

- **Animación vectorial de «Nocturno»** (texturas SVG animadas): el primer
  candidato según la decisión 35. Su programa corre en el computador de
  Cristóbal y no se ha revisado; cuando se traiga, entra como un generador más
  (y su `meta`, si exporta JSON, lleva esta metadata).
- **Texturas** (SVG y PNG con la metadata en `iTXt`): falta el codificador PNG
  en el núcleo (deflate sin dependencias, o un PNG sin comprimir).
- **Grillas** (desde la dimensión 3: retícula, columnas, medianil): como SVG,
  y quizás como guías de InDesign/Illustrator.
- **Librerías de estilo** (estilos de párrafo y carácter desde la dimensión 2:
  IDML parcial, o tokens W3C).
- Abrir un `.contope.json` suelto en el taller y decir de qué sistema viene y
  si está vigente (hoy la vigencia se ve sólo para lo generado desde el taller).
