# Mapa del repositorio

Escrito la noche del 17 al 18 de septiembre de 2026, leyendo el código, no
la memoria. [`ARQUITECTURA.md`](ARQUITECTURA.md) cuenta qué **es** el
programa; este archivo cuenta **dónde está cada cosa, qué depende de qué, y
qué hay que tocar para que una dimensión nueva quede completa**. Es la
herramienta para repartir trabajo entre varios agentes sin que se pisen.

Todo lo que dice acá está medido contra el commit `94933d8` (207 pruebas en
`packages/core`, 55 en `packages/desktop`, las dos verdes al empezar).

## 1. Los dos paquetes y la regla del barril

```
packages/core     @contope/core     — el núcleo: manifiesto, set, contrato. Sin React, sin disco.
packages/desktop  @contope/desktop  — la interfaz: Electron + Vite + React. Depende de @contope/core.
```

`packages/core/src/index.ts` es un barril puro: reexporta y no declara nada.
**Un archivo declara o reexporta, nunca las dos cosas.** Los módulos internos
importan del archivo concreto (`./types.js`), jamás del índice. El escritorio
importa siempre de `@contope/core`.

## 2. El núcleo, módulo por módulo

### 2.1 `requirement-manifest/` — C1, el manifiesto de requisitos

| archivo | qué hace | de quién depende |
|---|---|---|
| `types.ts` | Los tipos del contrato: `RequirementV0`, `RequirementManifestV0`, `PayloadType`, `RectoraV0`, resultados de evaluación. Y las **constantes cerradas**: `DIMENSION_IDS` (nueve, `dim1`…`dim9`), `EJES` (cinco), `RULE_KINDS` (catorce, los del compilador del plugin), `CORE_ROLES_13` (color), `CORE_ROLES_9` (tipografía), patrones de id. | `predicate.ts` (sólo tipo) |
| `predicate.ts` | El AST de cláusulas del `validityPredicate` (19 clases: `exists`, `singleton`, `covers`, `each`, `some`, `everyPar`, `and`, `or`, `not`, `compare`, `compareCss`, `reference`, `validCss`, `verified`, `noConflict`, `eachIn`, `someIn`, `everyDef`, `containsNoneOf`) y `evaluatePredicate`. Verdad-vacía **fail-closed**: colección ausente o vacía ⇒ falso con motivo. | `css-values.ts`, `no-conflict.ts` |
| `css-values.ts` | Parseo y comparación de `color-css` y `longitud-css`. | — |
| `payload.ts` | Validación de un payload contra su `payloadSchema`. | `types.ts` |
| `no-conflict.ts` | La cláusula `noConflict(rectoraId)`: cruza tags del payload contra `tagsRequeridos` / `tagsProhibidos` / `exclusiones` de la rectora. | `types.ts` |
| `graph.ts` | `parseRequirementManifest(raw)` (desde JSON desconocido), `validateManifestStructure(manifest)`, `detectCycles`, `isDimensionId`. Invariantes: ids con patrón, `dimensionId` coherente con el id, `dependsOn` a ids **que existan en el mismo documento** y no estén deprecados, sin ciclos, deprecaciones con registro. | `types.ts`, `predicate.ts` |
| `evaluate.ts` | `evaluateRequirement` y `evaluateManifest` → `DimensionEvaluationV0`: AND estricto sobre los activos; `contador` es sólo diagnóstico. | `graph.ts`, `payload.ts`, `predicate.ts` |
| `manifest-v0-dim1.ts` … `dim9.ts` | Un archivo por dimensión: exporta `DIMn_REQUIREMENTS_V0` y `DIMn_MANIFEST_V0`. Constructores locales de AST (`p`, `str`, `exists`, `each`, `covers`, `noConflict`, `objeto`, `lista`, `slot`…) copiados en cada archivo a propósito, para que cada manifiesto sea legible solo. **Cero prosa**: cada predicado es AST serializable, y la prueba hace round-trip por JSON. | `predicate.ts`, `types.ts` (sólo tipos) |
| `index.ts` | Barril del módulo. **Acá se registra cada dimensión nueva** (una línea `export * from './manifest-v0-dimN.js'`). | todos |

**La regla que ordena todo el reparto: cada manifiesto es una isla.** `graph.ts`
exige que `dependsOn` apunte a un id del **mismo** documento
(`dependencia-inexistente` si no). Las «dependencias orientativas» de la
taxonomía entre dimensiones (color → composición → interacción → movimiento →
patrones) **no se pueden expresar hoy** como `dependsOn`; viven como prosa en
`mappingNotes` (por ejemplo `dim1.req10` dice «la redundancia se expresa vía
dim7/dim9»). Consecuencia práctica: **dos dimensiones distintas se pueden
escribir en paralelo sin conflicto de código**; sólo comparten los registros
del §4.

### 2.2 `design-set/` — C2, la hoja de respuestas

| archivo | qué hace |
|---|---|
| `types.ts` | `DesignSetV0` (`manifestRefs` por dimensión + `entries`), `DesignSetEntryV0` (requisito, payload, camino de resolución, procedencia, fuerza, ciclo de vida, revisión, `mapsToKinds` copiado). Los caminos son **tres**: `insumo`, `diseñador`, `contope`; `nulo` se descartó (el comentario del tipo explica por qué). |
| `adapter.ts` | `toPayloadsMap(set, dim)` (lo que `evaluateManifest` consume), `findEntry`, `resolveRefValue` (sigue un `RefValue` a otra entrada del set). |
| `persistence.ts` | Exportar/importar el set con validación fail-closed. |
| `project-to-designruleset.ts` | Proyección a las reglas del compilador del plugin. Cubre `color`, `surface` (dim1) y `typography` (dim2.req02). `spacing`/`layout` (dim3) sin proyector a propósito. Tres requisitos declarados «sin cobertura» porque piden decisión de producto (ver `pendientes-aprobacion-cristobal.md` en el vault). |
| `dim1-fixture.ts` | Un set de ejemplo que resuelve dim1 entera; lo usan las pruebas de integración. |

### 2.3 `nucleo/` — los núcleos por mundo

| archivo | qué hace |
|---|---|
| `types.ts` | `NucleoDeMundoV0`: `entradas` (ids de requisito que el mundo no puede dejar sin responder, con su porqué medido) y `reglas` (`ReglaDeMundoV0`: umbral con cita, escrito con el AST de `predicate.ts`, evaluado encima del predicado del requisito; opcionalmente `condicion` sobre otra pregunta del set, para que rija sólo en el tipo de pieza que la fuente describe). |
| `evaluate.ts` | `evaluarNucleo` (recibe los resultados por requisito y los payloads; devuelve `cubierto`/`no-cubierto`, faltantes y el resultado de cada regla: `cumple`, `no-cumple` o `no-aplica`) y `validarNucleo` (ids existentes y activos, reglas con cita y sobre entradas del núcleo). |
| `nucleo-web.ts` | Los ocho roles del plugin como ids (dim1.req02, dim1.req07, dim2.req02, dim2.req04, dim8.req02) más la regla del contraste 4,5:1. |
| `nucleo-editorial.ts` | Cuarenta preguntas y cuatro reglas del mundo editorial impreso, medidas sobre el folleto real, Claude Design e InDesign; las reglas de tamaño de letra rigen sólo con `dim3.req08.modo = contenido-corrido`. |

El escritorio los conecta en `dominio/nucleos.ts` (`nucleoDeMundo`, `enNucleo`) y `dominio/evaluacion.ts` los evalúa junto con el manifiesto.

### 2.4 La cápsula — C3/C4

| archivo | qué hace |
|---|---|
| `design-contract.ts` | `design-contract.json`: definiciones con procedencia (`human-confirmed`, `deterministic-extraction`, `model-proposal`), `evidenceSourceIds`, `supersededValue`, `developmentTasks`. No enumera dimensiones. |
| `design-contract-design-md.ts` | Proyección determinista a `DESIGN.md`. |
| `design-contract-portable.ts` | El paquete portable `contope/design-model`. |
| `memoria-de-construccion.ts` | Las cuatro interfaces de la memoria (descriptor, referentes, mood wall, relato). Sólo tipos. |

Nada de esto cambia al agregar una dimensión.

## 3. El escritorio, módulo por módulo

```
src/main.tsx → App.tsx → pantallas/{Inicio,Recoleccion,Definicion,Construccion}.tsx
                        → instrumentos/{index,Ventana,Tipografia,ColorFundamento,EscalaEspacial,EditorEstructurado}.tsx
                        → componentes/Primitiva.tsx
dominio/   — todo lo que no dibuja
puente/    — el disco: electron.ts (IPC) o navegador.ts (File API); tipos.ts es el contrato
navegador/ — fuentes.ts (cargar una familia de Google), imagen.ts (paleta dominante)
electron/  — main.ts, preload.ts
scripts/   — desarrollo.mjs, empaquetar-electron.mjs, actualizar-catalogo-tipografico.mjs
datos/     — catalogo-google-fonts.json (1.946 familias, copia fechada)
```

### 3.1 `dominio/` — los tres registros que enumeran dimensiones

Estos tres archivos son **los únicos** del escritorio que saben cuántas
dimensiones hay. Todo lo demás los lee.

| archivo | qué registra | prueba que lo bloquea |
|---|---|---|
| `manifiesto.ts` | `MANIFIESTOS` (la lista de `DIMn_MANIFEST_V0` que la interfaz muestra), `NOMBRE_DIMENSION` (nombre en pantalla por id), y derivados: `DIMENSIONES`, `REQUISITOS` (activos, aplanados), `requisito(id)`, `manifiestoDe(dim)`, `dimensionDe(reqId)`, `dependientesDe(reqId)`. | — |
| `explicaciones.ts` | `EXPLICACIONES`: **una explicación en castellano llano por requisito activo**, ni una más ni una menos. | `explicaciones.test.ts` fija que las claves sean exactamente `REQUISITOS` y que sean **43** |
| `evaluacion.ts` | `evaluar(sistema)`: recorre `MANIFIESTOS`, llama a `evaluateManifest` por dimensión con rectoras sin restricciones, arma `porRequisito`, `porDimension`, `resueltos`, `total`, `completo`. | `evaluacion.test.ts` fija `total === 43` |

### 3.2 `dominio/` — lo que se adapta solo (o casi)

| archivo | qué hace | ¿toca una dimensión nueva? |
|---|---|---|
| `esquema.ts` | Valor inicial, descripción y lectura/escritura por ruta de cualquier `payloadSchema`. | No: es genérico. |
| `primitivas.ts` | `tipoDePaquete(packageId)` decide la primitiva por el **prefijo del paquete** (`color.`, `tipografia.`, `espacio.`, `forma.`/`borde`/`profundidad` → `radio`, `imagen.`, `composicion.`); lo no reconocido cae en `nada`. `muestraDePayload` tiene un `switch` por id de requisito (13 casos) y un `default` que resume en texto. | Opcional: un prefijo nuevo para que la fila no se vea en punteado, y casos en el `switch` sólo si hay algo visual que mostrar. |
| `reductor.ts` | Todas las acciones sobre el archivo del taller (`Sistema`): agregar insumo, adoptar candidato, aprobar, encargar, resolver conflicto… Al primer `entry` de una dimensión escribe `manifestRefs[dim]` desde el manifiesto real. | No. |
| `sistema.ts` | El tipo `Sistema` (el `.contope.json`) y su estado vacío. | No. |
| `capsula.ts` | Proyecta el `Sistema` a `design-contract.json` + `DESIGN.md` con los proyectores del núcleo. | No. |
| `catalogo.ts` | El catálogo tipográfico y sus filtros. | No. |
| `mundos.ts` | Los cuatro mundos (propuesta sin confirmar); hoy todos usan el mismo manifiesto y la pantalla lo dice. | No, hasta que exista un núcleo por mundo. |
| `extractores/{css,idml,imagen,tokens-w3c}.ts` | Cada extractor produce candidatos apuntando a ids concretos (`dim1.req01`, `dim2.req01`, `dim3.req01`…). | Sólo si un insumo trae algo de la dimensión nueva. No es obligatorio. |

### 3.3 Instrumentos y pantallas

| archivo | qué hace | ¿toca una dimensión nueva? |
|---|---|---|
| `instrumentos/index.tsx` | Elige instrumento por id: `dim2.req01` → Tipografía, `dim1.req01` → ColorFundamento, `dim3.req01` → EscalaEspacial, **todo lo demás → EditorEstructurado**. | No: el editor estructurado cubre cualquier `payloadSchema`. Un instrumento visual propio es trabajo aparte. |
| `pantallas/Definicion.tsx` | Itera `DIMENSIONES`, muestra `NOMBRE_DIMENSION[dim]`, cada requisito con su explicación y sus tres caminos. | No: lee los registros. |
| `pantallas/Construccion.tsx` | Estado por dimensión, encargos, conflictos. Pantalla 4 sin dibujar a propósito. | No. |
| `pantallas/Inicio.tsx`, `App.tsx` | La tira de sistemas usa `dim1.req01` y `dim2.req01` para la muestra. | No. |

## 4. Grafo de dependencias

```
                    types.ts ◄──── predicate.ts ◄─┬─ css-values.ts
                       ▲               ▲          └─ no-conflict.ts
                       │               │
                  payload.ts       graph.ts
                       ▲               ▲
                       └──── evaluate.ts
                                 ▲
       manifest-v0-dim{1,2,3,5,6}.ts  (sólo tipos de types/predicate; islas entre sí)
                                 ▲
                requirement-manifest/index.ts  ─────────────┐
                                                            │
       design-set/{types,adapter,persistence,project-…}.ts ─┤   core/index.ts (barril)
       design-contract*.ts, memoria-de-construccion.ts ─────┘         ▲
                                                                      │  @contope/core
       ┌──────────────────────────────────────────────────────────────┘
       │
  desktop/dominio/manifiesto.ts  ◄── explicaciones.ts (prueba: claves == REQUISITOS)
       ▲        ▲                ◄── evaluacion.ts   (prueba: total == 43)
       │        └── primitivas.ts, reductor.ts, capsula.ts, extractores/*
       │
  pantallas/*, instrumentos/*, App.tsx
```

## 5. Estado por dimensión (medido)

| dim | nombre (taxonomía) | spec en el vault | manifiesto en código | requisitos |
|---|---|---|---|---|
| 1 | Color y superficies | `spec-c1-requirement-manifest-2026-08-30.md`, auditada por Z | `manifest-v0-dim1.ts` | 13 |
| 2 | Tipografía y jerarquía escrita | `spec-c1-dim2-…`, auditada | `manifest-v0-dim2.ts` | 8 |
| 3 | Espacio, ritmo, retícula y contenedores | `spec-c1-dim3-…`, 2 pasadas | `manifest-v0-dim3.ts` | 7 |
| 4 | Forma, borde y profundidad | `spec-c1-dim4-forma-manifest-2026-09-18.md`, 2 pasadas de ZCode/GLM; los roles geométricos los declara el set (decisión 14) | `manifest-v0-dim4.ts` (18-09) | 8 |
| 5 | Imagen y lenguaje gráfico | `spec-c1-dim5-…`, 3 pasadas | `manifest-v0-dim5.ts` | 8 |
| 6 | Composición y jerarquía visual | `spec-c1-dim6-…`, 3 pasadas | `manifest-v0-dim6.ts` | 7 |
| 7 | Interacción, estados, navegación y feedback | `spec-c1-dim7-interaccion-manifest-2026-08-31.md`, 4 pasadas (2 de Claude, 2 de ZCode/GLM) | `manifest-v0-dim7.ts` (18-09) | 8 (I1 entró como req08) |
| 8 | Movimiento y temporalidad | `spec-c1-dim8-movimiento-manifest-2026-09-18.md`, 2 pasadas de ZCode/GLM | `manifest-v0-dim8.ts` (18-09) | 7 |
| 9 | Patrones reutilizables y representación de información | `spec-c1-dim9-patrones-manifest-2026-09-18.md`, 2 pasadas de ZCode/GLM | `manifest-v0-dim9.ts` (18-09) | 7 |

Total en código: **79** requisitos activos en las **nueve** dimensiones (43 en cinco al empezar la noche del 18-09; 73 al amanecer; 79 con la adenda del núcleo editorial: dim1 tiene 14, dim3 y dim6 tienen 9, dim5 tiene 9; `evaluacion.test.ts` clava el número vigente). Todas las dimensiones nuevas siguieron el mismo protocolo: spec → pasadas hostiles de ZCode/GLM → manifiesto y pruebas de Dipsy en cuarentena → integración con `scripts/integrar-dimension.mjs` → un commit por dimensión, con su decisión numerada en el vault. El protocolo
que usaron las dimensiones 2 a 6: spec en el vault → al menos dos pasadas
adversariales declaradas → manifiesto → pruebas → registro.

## 6. Receta: cómo se agrega una dimensión y qué es «completa»

Una dimensión está **completa** cuando los ocho pasos están hechos, las
pruebas están verdes y hay un commit que lo dice. Los pasos 1–4 son del
núcleo; 5–7 del escritorio; 8 de la documentación.

| # | dónde | qué | ¿paralelizable? |
|---|---|---|---|
| 1 | vault `spec-c1-dimN-<nombre>-manifest-<fecha>.md` | La spec con el formato de las anteriores: §1 insumos y citas, §2 nota de alcance, §3 requisitos (id, eje, `dependsOn`, `packageId`, pregunta, payload, predicado, `mapsToKinds`/`mappingNotes`), §4 tensiones, §5+ pasadas adversariales. | Sí, entre dimensiones. |
| 2 | `packages/core/src/requirement-manifest/manifest-v0-dimN.ts` | El manifiesto fiel a §3, con los constructores locales, cero prosa. | Sí, entre dimensiones. |
| 3 | `…/manifest-v0-dimN.test.ts` | Las pruebas que tienen todas: parsea limpio; ids exactos; `dependsOn` y ejes; `rectorBindings`; brechas con `mappingNotes`; round-trip JSON con clases conocidas; dimensión resuelta con payloads completos; AND estricto; uno o dos `covers` que fallan. | Sí. |
| 4 | `…/requirement-manifest/index.ts` | `export * from './manifest-v0-dimN.js'`. | **No**: archivo compartido; una línea por dimensión, se integra en serie. |
| 5 | `packages/desktop/src/dominio/manifiesto.ts` | Agregar `DIMN_MANIFEST_V0` a `MANIFIESTOS` (en orden de número) y el nombre a `NOMBRE_DIMENSION`. | **No**: compartido. |
| 6 | `packages/desktop/src/dominio/explicaciones.ts` | Una explicación por requisito nuevo, en castellano llano, más larga que 40 caracteres y distinta de la pregunta. | Las explicaciones sí (bloque propio por dimensión); el archivo es compartido. |
| 7 | `explicaciones.test.ts` y `evaluacion.test.ts` | Subir el total de requisitos **y el número de dimensiones** (`porDimension.size`). | **No**: se hace una vez al integrar. |
| 7b | `packages/desktop/src/dominio/primitivas.ts` | **Obligatorio, no opcional** (medido el 18-09): `primitivas.test.ts` exige que ningún requisito caiga en `nada`. Un prefijo nuevo de paquete (`interaccion.`, `movimiento.`, `patrones.`) necesita su línea en `tipoDePaquete`; mientras no exista primitiva visual, la honesta es `texto`. | Compartido. |
| 8 | `ARQUITECTURA.md` («Qué falta»), `INTERFAZ.md` (dice «cinco dimensiones» y «43»), **este `MAPA.md` (§5)**, vault `indice.md` | Que los documentos digan lo que hay. | Al final. |

Opcionales, que **no** son condición de completa: casos en `muestraDePayload`,
un instrumento visual propio, un extractor, un proyector a `designRuleSet`
(sólo tiene sentido si `mapsToKinds` no está vacío; la dimensión 6 declara
brecha en todos sus requisitos; la 7 proyecta `form` en req05 y
`button`/`color` en req08; la 8 proyecta `motion` en req03–req06).

### Trampas medidas

- **Los conteos están clavados en dos pruebas** (requisitos y número de
  dimensiones). Agregar un manifiesto al registro sin subir los conteos rompe
  el escritorio aunque el núcleo esté verde. `scripts/integrar-dimension.mjs`
  los sube solo (ver §7).
- **Un `ref` hacia otra dimensión no se puede validar en C1.** El `store` del
  predicado es por dimensión (`evaluate.ts`), así que `validCss`/`reference`
  sobre una ref cruzada dan `referencia-rota`; sólo `exists` pasa. C2 sí la
  resuelve (`adapter.resolveRefValue`, `findDanglingRefs`). Medido el 18-09 en
  dim4.req03; la forma que sirve es `union(refTo(dim1.req02), color-css)` +
  `exists`, con la verificación de la rama ref declarada en C2.
- **Vitest levanta todo `*.test.ts` del paquete.** Un archivo a medio hacer en
  el árbol rompe el verde de las demás dimensiones: los ayudantes escriben
  fuera del árbol y se prueba en un `git worktree` aparte.
- **`dependsOn` no cruza dimensiones.** Una dependencia hacia otra
  dimensión se declara en `mappingNotes` o en la spec, no en el grafo.
- **`dim1.req03` menciona `dim7.req10`** en el `valueNotes` de su
  `mapsToKinds` de `button` (`manifest-v0-dim1.ts:269`: «El puente completo
  se exige en dim7.req10 (implícito I1)»). La spec de dim7 tiene siete
  requisitos: ese id **no iba a existir**. *Corregida el 18-09 al integrar dim7:
  la nota apunta a `dim7.req08` y `DIM1_MANIFEST_V0` subió a 1.1 / revisión 2
  (commit `29a8cbc`).* *La primera versión de este mapa decía `req13`: lo escribí sin
  medir y lo pilló la auditoría hostil del plan. Medido el 18-09.*
- **`DIMENSIONES` se deriva del primer requisito de cada manifiesto** y
  `dimensionDe` cae en `dim1` si el id no tiene punto. No usar ids raros.
- **`tipoDePaquete` ya mapea `forma.`, `borde` y `profundidad` a `radio`**
  (primitiva sin datos todavía) y `composicion.` a `reticula`. Interacción,
  movimiento y patrones caen en `nada` hasta que alguien les dé primitiva.
- **La cápsula no enumera dimensiones**: un requisito nuevo entra a
  `design-contract.json` por el mismo camino que los demás.

## 7. Cómo repartir entre agentes sin que se pisen

- **Un agente por dimensión** puede escribir la spec, el manifiesto, su prueba
  y su bloque de explicaciones **en archivos nuevos o en un bloque propio**,
  sin tocar los cuatro registros compartidos (`index.ts`, `manifiesto.ts`,
  `explicaciones.ts` como archivo, los dos conteos).
- **Un integrador** (una sola persona o agente, en serie) conecta los
  registros, sube los conteos, corre `node --run test` desde la raíz y
  hace el commit de integración.
- Un manifiesto se puede probar solo con `pnpm --filter @contope/core test`
  antes de integrarlo, porque es una isla.
- Cada checkpoint: un commit chico con la causa medida en el mensaje, pruebas
  verdes, y si hubo una decisión tomada sin preguntar, su nota en
  `Contope-Design/vault_contope-design/decisiones.md` con el hash del commit.
