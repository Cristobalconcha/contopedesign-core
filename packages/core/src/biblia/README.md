# La Biblia del diseño, como datos

La Biblia es el conocimiento de oficio que ContOpe le ofrece al diseñador
(composición, color, tipografía, grilla…), escrita en el vault
(`contope-design/vault_contope-design/biblia/`, un capítulo por tema, con su
`README.md` y su `ESTADO.md`). Esta carpeta es esa Biblia compilada a datos que
el programa consulta. La spec de tipos de producto (§5.2) pide que consultarla
sea «una búsqueda por tipo y rol, sin juicio en tiempo de uso»: acá no hay reglas
nuevas, sólo lo que dicen los capítulos, con el tipo de producto normalizado para
poder buscar.

## De dónde salen los datos

`biblia.generada.json` lo escribe `scripts/biblia/compilar.mjs` (Node, sin
dependencias). **No se edita a mano.** Para regenerarlo:

```bash
pnpm biblia:compilar                                 # vault en ../contope-design/vault_contope-design/biblia
pnpm biblia:compilar --vault <carpeta>               # u otra carpeta
BIBLIA_VAULT=<carpeta> pnpm biblia:compilar          # o por variable
```

El compilador lee:

- de cada capítulo `NN-slug.md`, las entradas `## ENN. Título` y sus párrafos
  con etiqueta en negrita (`**Enunciado.**`, `**Tipo.**`, `**Posturas.**`,
  `**Fuerza por tipo y rol.**`, `**Para aprender.**`, `**Fuentes.**`,
  `**Contradicciones abiertas.**`); las notas transversales (`### N1.`…) no son
  entradas y no entran;
- de la tabla de fuerza de cada entrada (la que tiene una columna «fuerza»),
  cada fila: la etiqueta cruda, los tipos de producto normalizados, el rol, las
  fuerzas nombradas en la celda en orden de aparición, la celda y el porqué;
- de `ESTADO.md`, el estado de cada tema: `aprobado` si la fila dice «aprobado
  por Cristóbal», `por-revisar` si dice «síntesis y verificación hechas»,
  `borrador` si no.

Guarda también el commit del vault (`fuente.commit`) y un `informe` con todo lo
que no pudo leer sin adivinar. El resumen se imprime al compilar.

## Qué hace la consulta

`consultarBiblia({ temas?, tipos?, soloEstados? })` (en `consultar.ts`) es una
función pura: devuelve las entradas de esos temas y estados, cada una con **sólo
las filas de fuerza que nombran alguno de esos tipos**, y omite las que se quedan
sin filas. No decide qué fuerza gana ni resume; las filas «no aplica» vienen
también (filtrarlas es cosa de quien presenta).

El escritorio la usa en `dominio/biblia.ts`: el tipo sale del mundo
(`TIPOS_POR_MUNDO`), los temas del `packageId` de cada pregunta encargada
(`TEMAS_POR_PAQUETE`), y el resultado va al prompt de encargo como la sección
«LA BIBLIA DEL DISEÑO» y a la ayuda de cada pregunta en la pantalla de
definición («Qué dice la Biblia»).

## Límites (medidos el 29-09-2026, vault `6ee2d2d`)

- **Estados.** Sólo el tema 01 está aprobado; 02 a 14 están «por revisar» (con la
  síntesis de la ronda 1 hecha, sin la revisión del dueño) y entran al prompt
  marcados así. Un tema en borrador no entra (`ESTADOS_EN_PROMPT`).
- **Informe del compilador.** 168 entradas y 1.626 filas de fuerza; 89,2 % de las
  celdas con una sola fuerza, 9,5 % con varias y 1,3 % sin fuerza reconocible;
  11 entradas sin tabla de fuerza y 5 etiquetas sin tipo (pictograma, braille,
  tres sobre la UE y C2PA).
- **Normalización de tipos.** Es una tabla escrita a mano en el compilador
  (`PREFIJOS`), con las decisiones marcadas: «editorial» a secas vale por libro y
  revista; las funciones de señalética (identificación, dirección, seguridad…)
  al comienzo de una etiqueta valen por señalética; «todos los impresos», por
  libro, revista, afiche y packaging. **«todos» vale por los ocho tipos y «resto»
  por los que la tabla no nombró**: medido en los capítulos, «todos» es literal
  (02.E07, 04.E03, 09.E11–E13) y «resto» nunca lo es. Las etiquetas que no se
  reconocen («app nativa», «rol pictograma», «quien usa IA en la UE…») quedan con
  `tipos: []` y en el informe.
- **Fuerzas.** Se buscan las cuatro palabras en la celda, con o sin negrita (la
  mayoría no la lleva); «no es cortapisa», «sin cortapisa» y parecidas se
  descartan y van al informe. Las celdas que remiten a otra fila («como afiche»,
  «ídem editorial») quedan sin fuerza: no se resuelven.
- **Entradas sin tabla.** Diez entradas dan su fuerza sólo en prosa
  (`notaFuerza`); una consulta por tipo no las devuelve.
- **Tamaño.** El JSON pesa ~1,3 MB y entra entero al paquete del renderizador
  (sube de ~0,9 MB a ~1,9 MB). Si molesta, se puede compilar una versión sin
  `fuentes` ni `contradicciones` para el renderizador.
- **Contraste 4,5:1.** Los núcleos web, editorial, marca y campaña
  (`nucleo/nucleo-*.ts`) llevan la regla «contraste ≥ 4,5:1» como umbral del
  mundo. La Biblia (tema 05, E01 y E08) y la spec §5.1 dicen otra cosa: fuera de
  la web del sector público y de lo normado (sellos, señalética de seguridad y
  vial), el 4,5:1 es **recomendación fuerte** o **divergencia**, no cortapisa, y
  en la web del Estado de Chile la cortapisa es el nivel A (1.4.1), no el 4,5:1.
  Los núcleos no se tocaron en este cambio; queda anotado para decidirlo.
