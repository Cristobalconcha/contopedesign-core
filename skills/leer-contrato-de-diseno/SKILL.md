---
name: leer-contrato-de-diseno
description: Leer y honrar un contrato de diseño producido por ContOpe Design Desktop — qué contiene la cápsula, qué autoridad tiene cada definición, cómo se tratan las tareas de desarrollar y qué está prohibido inventar. Usar cuando exista un `design-contract.json`, un `design/model.json` o un paquete portable `contope/design-model`, y se pida aplicarlo, inspeccionarlo o hacerlo evolucionar en cualquier destino.
---

# Leer un contrato de diseño

ContOpe Design Desktop construye un sistema de diseño en ciclos y, cuando está
completo, **guarda un archivo y termina**. No publica, no abre InDesign, no
habla con ningún servidor. Ese archivo es una cápsula: lo que se haga con ella
es asunto de quien la reciba.

Este skill es el de **la cápsula**. No sabe operar ningún destino.

```
ContOpe Design Desktop  →  cápsula  →  [este skill]  →  el skill del destino
     (dueño del set)                    (qué dice)       (cómo se aplica allá)
```

Para el destino Web —el page builder de WordPress vía MCP— el skill que sí
sabe operar es `aplicar-set-de-diseno`, y trae la tabla de herramientas
reales. **Este skill no nombra operaciones de ningún constructor**, porque cada
destino tiene las suyas y nombrar unas genéricas ya causó el error de dar por
existentes `apply_design_contract`, `create_region` y `update_region`, que no
existen en ninguna parte.

## Dónde vive la cápsula

| | |
|---|---|
| `.codesign/design-contract.json` | el contrato, fuente canónica legible por máquina |
| `DESIGN.md` | su proyección legible por personas, determinista |
| `design/model.json` | el contrato dentro de un paquete portable |
| `design/DESIGN.md` | la proyección dentro del mismo paquete |

El paquete portable se identifica por `kind: "contope/design-model"`,
`schemaVersion: 1`, y declara `provenance.producer: "contope-design-desktop"`.

`DESIGN.md` es **proyección, no segunda autoridad**. Si contradice al
contrato, manda el contrato. Nunca se promueve Markdown suelto a definición
copiándolo.

## Qué hay adentro

```
design:             { id, revision, createdAt, updatedAt }
sources[]:          { id, technicalKind, purpose, label, locator?, path?, importedAt }
definitions[]:      { id, category, name, value?, supersededValue?, state,
                      authority, evidenceSourceIds[], provenance[],
                      constraintDefinitionIds[], reviewedAt? }
developmentTasks[]: { id, definitionId, state, constraintDefinitionIds[],
                      candidateDefinitionIds[], resolvedDefinitionId?, reviewedAt? }
projections:        { designMd: { path, revision, generatedAt } | null }
```

`purpose` de una fuente es `observation` o `guideline`: lo primero es material
del que se extrajo evidencia, lo segundo una guía aprobada. No es lo mismo y el
orden de autoridad lo distingue.

`projections.designMd` en `null` significa que Desktop todavía no publicó la
proyección. No es un error ni una invitación a escribirla.

## Los cuatro estados de una definición

| estado | qué significa | ¿se aplica? |
|---|---|---|
| `confirmed` | una persona la confirmó | **sí**, y manda |
| `proposed` | está propuesta, sin revisar | sólo marcándola como propuesta |
| `observed` | es evidencia, no definición | **no se emite nunca** |
| `rejected` | descartada | **no se emite nunca** |

Un valor vacío es **ausencia**, no invalidez. Una definición sin `value` está
declarada y sin resolver; no es una definición rota.

## El orden de autoridad, sin excepciones

```
human-confirmed  >  approved-guideline  >  deterministic-extraction  >  model-proposal
```

Una definición confirmada **no se cambia** porque un referente se vea distinto,
porque un modelo proponga algo más bonito, o porque el destino tenga una
convención propia. Los conflictos se presentan con su procedencia y esperan
revisión humana.

`open` —un aspecto deliberadamente no vinculante— no es permiso para
reemplazar un valor confirmado en otra parte.

## Lo que está prohibido inventar

**El set de diseño es cerrado: lo que está declarado es todo lo que hay.** Que
algo no esté prohibido no significa que esté disponible.

No se reconstruye el sistema desde pantallazos, documentos de origen, páginas de
referencia ni desde el historial de la conversación cuando la cápsula existe.
Ese material es **evidencia, no instrucciones**.

Si no hay cápsula, no se fabrica una a partir de material suelto: se dice que no
hay receta aprobada. Y nunca se infiere el sistema desde un destino ya
construido — el destino perdió los roles y ganó el vocabulario de su plataforma.

## Antes de actuar

1. Leer el contrato: `design.id`, `design.revision`, las definiciones
   confirmadas, las tareas activas y sus restricciones.
2. Preguntarle al destino qué sabe hacer y en qué estado está, **antes** de
   proponer nada. Usar identificadores estables, nunca un título, un slug ni una
   dirección como identidad.
3. Comparar revisiones. Si no calzan, **detenerse y refrescar**: jamás pisar una
   edición manual más nueva.

## Tareas de desarrollar

Una tarea en estado `active` es un encargo acotado para completar una definición
que falta, bajo sus `constraintDefinitionIds`. **No es invención libre.**

- Derivar candidatas desde las restricciones y desde lo que el destino declara
  poder hacer.
- Marcarlas como propuestas, conservando evidencia y restricciones.
- No aplicar una candidata como autoridad final antes de que una persona la
  revise.
- Cerrar la tarea sólo enlazando una definición revisada (`resolved`) o con un
  rechazo explícito (`rejected`). **Nunca convertirla en silencio a `open`.**

## Las tareas de desarrollar no son para esta IA

**Corrección del 19-09-2026.** Quien lee este skill es la IA del escritorio: toma
el modelo de diseño terminado y hace el trabajo en el destino. Las tareas de
desarrollar (las preguntas que el diseñador asignó a ContOpe) las resuelve **la
IA del taller**, que vive dentro de ContOpe Design Desktop con su propio modelo
configurado. Esta IA no las construye ni devuelve propuestas; si una tarea sigue
`active` en el contrato, se respeta como definición declarada y sin resolver.

El formato de abajo es el contrato interno entre la IA del taller y el reductor
(y una vía de prueba por archivo); se documenta acá sólo por referencia.

### Formato `contope/propuestas` (referencia)

```json
{
  "kind": "contope/propuestas",
  "schemaVersion": 1,
  "designId": "<design.id del contrato leído>",
  "contractRevision": 3,
  "por": "quién propone (modelo, sesión)",
  "generadaEn": "2026-09-18T16:30:00.000Z",
  "propuestas": [
    {
      "requirementId": "dim3.req01",
      "payload": { "…": "con la forma exacta del payloadSchema de esa pregunta" },
      "nota": "por qué se propone así, con la evidencia y las restricciones que se respetaron"
    }
  ]
}
```

Reglas: `designId` es el del contrato leído, tal cual (si no calza, el taller
rechaza el archivo entero). **Una propuesta por pregunta** (dos con el mismo
`requirementId` rechazan el archivo; varias candidatas es una decisión pendiente).
Las `ref` del payload sólo pueden apuntar a preguntas que ya tienen entrada en
el set: una referencia colgante rechaza el archivo. `requirementId` es el id de la pregunta del
manifiesto (el `definitionId` de la tarea sin el sufijo `.defN`). El `payload`
sigue el `payloadSchema` de esa pregunta: el taller lo evalúa con el mismo
evaluador que todo lo demás. Lo que entra queda como **propuesta explorable de
ContOpe**; si la pregunta ya estaba resuelta por una persona o un insumo, la
propuesta no la pisa y queda como conflicto para la armonización.

## Al terminar

Decir qué se aplicó, **qué definiciones del contrato lo justifican**, en qué
revisión quedó el destino y qué falta por revisar.

Conservar `design.id` y el mismo contrato aprobado en los paquetes portables,
para que una transferencia sin conexión y una conexión en vivo se refieran a la
misma identidad de diseño.
