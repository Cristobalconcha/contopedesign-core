# ContOpeDesign Core

El núcleo de **ContOpe Design**: un programa para **construir un sistema de
diseño**, no para generar piezas con él.

Toma insumos —un IDML de InDesign, tokens del estándar W3C, una configuración de
Tailwind, variables CSS, referentes, o lo que una persona decida a mano— y los
convierte, en ciclos, en un conjunto de definiciones completo y trazable.

Cuando el sistema está completo, guarda un archivo. Ahí termina su trabajo.

*ContOpe* es **Content Opener**. *Design* es una de sus ramas.

## Qué no hace

**No se conecta con nada.** No publica sitios, no abre InDesign, no habla con
ningún servidor. Produce una cápsula, y lo que se haga con ella es asunto de
quien la reciba: una IA que la lea para construir en otra herramienta, una
persona que la use de referencia, o un exportador que la convierta en paleta
para Illustrator.

Está ligado al resto del sistema **por pertenencia, no por acoplamiento**.

## Las tres formas de resolver una definición

Cada requisito se resuelve por uno de tres caminos, y el camino queda
registrado:

| | |
|---|---|
| **Insumo** | se incorpora desde un referente, un manual, un IDML, una interfaz |
| **Diseñador** | la persona la construye o la edita |
| **ContOpe** | la IA la propone, con la evidencia y las restricciones a la vista |

Una definición confirmada por una persona no se cambia porque un referente se
vea distinto o un modelo proponga algo más bonito.

## Completitud

El set se mide **contra lo que declaraste necesitar**, no contra un manifiesto
entero. Es como declarar tipos: lo que está declarado existe, y lo que no,
no existe. **Que algo no esté prohibido no significa que esté disponible.**

## Qué hay en este repositorio

```
packages/core/src/
  requirement-manifest/   el manifiesto versionado de requisitos, sus
                          predicados de validez, el grafo de dependencias
                          y las definiciones de cinco dimensiones
  design-set/             el set de diseño, su persistencia y su proyección
  design-contract*.ts     el contrato: procedencia, autoridad y ciclo de
                          vida de cada definición, y su forma portable
  memoria-de-construccion.ts   el estado del set mientras se arma
skills/
  leer-contrato-de-diseno/     cómo una IA lee la cápsula y la honra
```

## Por qué este repositorio existe aparte

Hubo uno anterior, [`Contope-Design`](https://github.com/Cristobalconcha/contope-design),
que empezó como un fork de **open-codesign** (de OpenCoworkAI Contributors,
licencia MIT). Ese repositorio se descargó para ver si hacía lo que hacía falta.
No lo hacía: generaba piezas gráficas a partir de una conversación.

Medido el 13 de septiembre de 2026, antes de separar: de 44.480 líneas de
código real, 9.759 eran propias. Y el único punto de contacto entre esas 9.759
y el motor heredado era **una línea**, un `import type` de dos interfaces que
TypeScript borra al compilar. Cero dependencia en tiempo de ejecución.

Este repositorio es esas 9.759 líneas, más 94 líneas de declaraciones de tipo
reescritas. Nada más. Por eso no lleva aviso de atribución: no queda nada que
atribuir.

El repositorio anterior sigue publicado con su `NOTICE.md` intacto, como archivo
del linaje.

### Qué se dejó allá a propósito

- Una comprobación de que el `DESIGN.md` que produce este código pasa el
  validador de formato heredado (396 líneas). Traerlo habría devuelto la
  obligación que este repositorio existe para no tener. La compatibilidad se
  sigue verificando allá; acá se comprueba lo que le toca a este código.
- Las once secciones de prompts, que describen el producto anterior.
- La conexión con modelos y el bucle del agente, que este programa no necesita:
  la IA con la que trabaja es la de escritorio, y lee la cápsula por un skill.

## Cómo funciona

Cuatro fases —recolección, definición, cierre y **armonización**— y un
artefacto que exhibe el catálogo de propiedades construido, para que la
armonización sea posible. Está descrito en [`ARQUITECTURA.md`](ARQUITECTURA.md),
con las palabras de quien lo diseñó.

## La interfaz

Primera pasada descrita y prototipada el 13 de septiembre: el inicio por mundos,
el ciclo de insumos, la asignación del núcleo y el selector de tipografía sobre
las 1.946 familias de Google Fonts. Está en [`INTERFAZ.md`](INTERFAZ.md), con
lo aprobado marcado aparte de lo que espera revisión.

## Estado

Núcleo funcionando y probado. **Todavía no hay interfaz** — ni ventana, ni línea
de comandos. Es lo que sigue.

```bash
pnpm install && pnpm test && pnpm typecheck
```

17 archivos de prueba, 207 pruebas.

## Licencia

Copyright © 2026 Cristóbal Diego Concha Mathiesen.

Software libre bajo la **Licencia Pública General de GNU, versión 3** o
posterior. El texto completo está en [`LICENSE`](LICENSE).

Esto significa que cualquiera puede usar, estudiar, modificar y redistribuir
este programa —y que quien construya algo sobre él está obligado a publicar su
trabajo bajo la misma licencia. Lo que es abierto sigue siendo abierto.

Se eligió la versión 3 por ser la vigente. El plugin
[ContOpe Publisher](https://github.com/Cristobalconcha/contope-publisher) usa
la versión 2 porque WordPress lo exige, no porque se haya elegido.

Este programa se distribuye con la esperanza de que sea útil, pero **SIN
NINGUNA GARANTÍA**; ni siquiera la garantía implícita de COMERCIABILIDAD o
APTITUD PARA UN PROPÓSITO PARTICULAR. Véase la Licencia Pública General de GNU
para más detalles.
