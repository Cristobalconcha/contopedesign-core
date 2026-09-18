/**
 * Qué quiere decir cada requisito, en castellano y no en jerga.
 *
 * Escritas el 2026-09-13 porque Cristóbal lo pidió mirando el prototipo:
 * «¿qué quiere decir que cuenta con un fundamento de color efectivo? Eso
 * necesita ser explicado. Por lo menos, para mí no está claro.»
 *
 * Son las 43, una por requisito activo del manifiesto. La prueba de este
 * módulo comprueba que ninguna falte y que ninguna sobre.
 */
export const EXPLICACIONES: Readonly<Record<string, string>> = {
  'dim1.req01':
    'Los colores con los que se construye todo lo demás: los de la marca y los neutros (blancos, grises, negros). «Con procedencia declarada» quiere decir que de cada uno se sabe de dónde salió — el manual, un referente, una decisión tuya. No basta con tener los colores: hay que poder decir por qué son ésos.',
  'dim1.req02':
    'Un color suelto no sirve hasta que se sabe para qué es. Los 13 roles son los trabajos que el color hace: fondo, texto, acción, borde, superficie elevada, y así. Esto pregunta si cada uno de esos trabajos tiene su color asignado.',
  'dim1.req03':
    'El color de acción —el del botón que quieres que aprieten— tiene que ser uno solo. Si hay dos cosas compitiendo por ser «la acción», el que mira no sabe dónde ir.',
  'dim1.req04':
    'Una rampa es el mismo color en varios pasos, de claro a oscuro. Sirve para tener un fondo suave y un borde firme del mismo color, sin inventar uno nuevo cada vez que hace falta.',
  'dim1.req05':
    'Cuánto se despega una cosa de lo que tiene detrás: una tarjeta sobre la página, un panel sobre la tarjeta. Pregunta si esos niveles están declarados, en vez de decidirse a ojo cada vez.',
  'dim1.req06':
    'Un botón no se ve igual quieto, con el cursor encima, con el foco del teclado o apretado. Esto pregunta si cada uno de esos momentos tiene su color.',
  'dim1.req07':
    'Que el texto se lea sobre su fondo. Se mide (hay una fórmula), se fija un mínimo, y se anota el resultado. «Con evidencia registrada» quiere decir que la medición queda guardada, no que alguien dijo que se veía bien.',
  'dim1.req08':
    'Qué se puede hacer con los colores además de usarlos planos: ¿se admiten transparencias? ¿mezclas? ¿degradados? Declararlo evita que alguien meta un velo o un degradado que la marca no tiene.',
  'dim1.req09':
    'En una portada manda un color; en una página interior, otro. «Preponderancia por contexto» es decir cuál manda dónde, en vez de un porcentaje global que no describe ninguna página real.',
  'dim1.req10':
    'Si algo es rojo porque es un error, tiene que decirlo también de otra forma —un ícono, una palabra, una posición— para quien no distingue el rojo. Pregunta si cada significado que se codifica con color tiene esa segunda vía.',
  'dim1.req11':
    'Cada color debe saber de dónde salió, quién lo decidió y cuándo se revisó por última vez. Es la memoria del sistema: sin esto, en tres meses nadie sabe si un color es de la marca o un invento.',
  'dim1.req12':
    'La fuerza es cuánto se puede mover un color: inamovible (es la marca), prioritario (se cambia sólo con buena razón) o explorable (se puede probar otro). Declararla evita discusiones sobre qué es negociable.',
  'dim1.req13':
    'El color primario tiene que decir para qué sirve de verdad: el botón principal, el logotipo, los enlaces. Un primario «para todo» no dice nada.',
  'dim1.req14':
    'Cada color de la marca necesita su receta de imprenta: cómo se arma con tintas, cuánto tinta lleva cada plancha y cómo queda cuando la impresión sale en blanco y negro. Además hay un gris tope para el texto: si lo dejas más claro que ese, en papel ya no se lee, y tienes que dejar registrada la prueba que lo comprueba.',
  'dim2.req01':
    'Las familias tipográficas que usa el sistema, y de cada una: qué la reemplaza si no está (fallback), qué idiomas y caracteres cubre, y si se puede usar (licencia). Una tipografía sin licencia declarada es un problema esperando a aparecer en la imprenta.',
  'dim2.req02':
    'Los nueve trabajos que el texto hace: display, título, subtítulo, cuerpo, cita, nota, leyenda, dato y control. Esto pregunta si cada uno tiene su estilo: familia, tamaño, peso, interlínea.',
  'dim2.req03':
    'Que se note la diferencia entre un título y un subtítulo, y entre un subtítulo y el cuerpo. Si dos niveles tienen el mismo tamaño y el mismo peso, son el mismo nivel aunque se llamen distinto.',
  'dim2.req04':
    'Para el texto que se lee de corrido —cuerpo, citas, notas— hace falta más que un tamaño: el ancho de la línea (medida), el interlineado, la separación entre párrafos, la alineación. Es lo que hace que un texto largo se pueda leer sin cansancio.',
  'dim2.req05':
    'Cómo se ve una palabra en negrita, una en cursiva, una subrayada. Y dos detalles que se olvidan: si los números alinean en tablas (tabulares) o no, y cómo se compone una tabla dentro del texto.',
  'dim2.req06':
    'Lo que funciona en pantalla no siempre funciona en papel, y una interfaz densa no usa los mismos tamaños que una cómoda. Esto pregunta si el sistema dice cómo cambian sus reglas tipográficas entre esos casos.',
  'dim2.req07':
    'Un puente técnico: WordPress guarda la tipografía en siete campos fijos (fuente de títulos, de cuerpo, tamaño base…). Esto pregunta cómo se traducen los nueve roles del sistema a esos siete campos, para que nada se pierda al publicar.',
  'dim2.req08':
    'Una «voz» es la combinación de un rol con una familia: «los títulos van en Lora». Esto pregunta cuán fija es cada voz: si es la identidad (no se toca) o si podría cambiarse sin que la marca deje de ser ella.',
  'dim3.req01':
    'Una unidad base (4 px, 8 px, 6 pt…) y una escala de múltiplos de ella. Con eso, todos los espacios del sistema son parientes entre sí en vez de números sueltos.',
  'dim3.req02':
    'Tres distancias con nombre: dentro de un elemento (entre el ícono y su texto), entre elementos (entre dos botones) y entre secciones. Pregunta si cada una tiene su valor, tomado de la escala.',
  'dim3.req03':
    'El ritmo vertical es una cuadrícula invisible de líneas horizontales sobre la que apoyan textos y bloques. Da la sensación de orden aunque nadie la vea. Pregunta si existe y a qué se aplica.',
  'dim3.req04':
    'La retícula: cuántas columnas, cuánto canal entre ellas, cuánto mide un módulo. Al menos para un contexto (la página web, la doble página impresa).',
  'dim3.req05':
    'Las cajas en las que vive el contenido: un ancho máximo, un espacio interior, y cómo se relacionan con lo que las contiene —la ventana, la página—. Al menos dos, porque un solo contenedor no es un sistema.',
  'dim3.req06':
    'Qué pasa con los espacios cuando la pantalla se achica o cuando la interfaz tiene que ser más densa: qué se apila, en qué orden, qué se comprime. Si no está dicho, lo decide el navegador.',
  'dim3.req07':
    'Otro puente técnico: WordPress tiene un solo campo de espaciado (un número de 0 a 64). Esto pregunta cómo se relaciona la escala del sistema con ese único número.',
  'dim3.req08':
    'Acá tu sistema deja escrito qué formatos de hoja sabe producir, uno por uno, con el nombre que tú les das («carta vertical», «A5 apaisado»). Cada formato sale de una lista cerrada (carta, A4, legal, tabloid, A5, A3) o lleva su propia medida, pero nunca puede ser una hoja que nadie pidió. Además dices si va vertical o apaisado y si se arma por páginas fijas o con el contenido corrido. Si eliges «medida declarada» tienes que escribir el ancho y el alto, y ninguno de los dos lados puede pasar de 8000 px.',
  'dim3.req09':
    'Para cada formato que tu sistema soporta, acá dices cuánto sangra el fondo, cuánto espacio queda libre en cada borde para lo que sí debe verse, cuánto margen necesita el texto corrido y qué elementos pueden ir a sangre. Escribe «ninguno» cuando no haya nada a sangre: una lista vacía no cuenta como decisión. Si no alcanzas los 40 px libres y los 72 px de margen para el texto corrido, tienes que dejar escrita la razón; y si cumples los dos, no corresponde poner excusa. Tu sistema tiene que cubrir todos los formatos que declaró antes, sin dejar ninguno sin su sangrado.',
  'dim4.req01':
    'Antes de dibujar nada, el set dice con qué piezas geométricas trabaja: por ejemplo «superficie», «contenedor», «acción» y «separador». Cada una con su nombre y una frase que explique para qué sirve, así nadie tiene que adivinar qué es cada cosa.',
  'dim4.req02':
    'Para cada uno de esos roles, el set declara su forma: si es cuadrado de esquinas duras, redondeado o pastilla. Si eliges esquinas redondeadas, di el número exacto —«8px», «12px»— porque «redondeado» solo no alcanza para construir nada. Y no puede quedar ningún rol sin su forma: el listado de roles y el de formas tienen que calzar.',
  'dim4.req03':
    'Los bordes se guardan como estilos con nombre —«borde-sutil», «borde-enfasis»— y no como líneas sueltas que se apilan donde sea. Cada estilo dice a qué roles sirve y lista sus filetes en orden, con su grosor, su tipo, su color y dónde va: el color se toma de la paleta del sistema (o, si hace falta, se escribe un valor, igual que en los colores por estado). Un filete puede ser continuo o segmentado, y cuando un estilo lleva varios filetes y alguno es segmentado, la web tiene un tope: no puede dibujar todo eso junto. Por eso el set dice de antemano a qué se cae si eso pasa.',
  'dim4.req04':
    'Cada rol declara su altura en la pila: quién va encima de quién y qué puede tapar a qué. Así, cuando dos objetos coinciden en la pantalla, el orden no se decide al azar ni se descubre recién al mirar el resultado. Y no puede quedar ningún rol sin su profundidad declarada.',
  'dim4.req05':
    'El set dice si usa sombra, luz, transparencia o mezcla, y para cada una si está permitida o no y en qué partes. Por ejemplo: «sombra sí, sólo en tarjetas, nunca en el texto». En este sistema no hay degradados, así que no se ofrecen como opción.',
  'dim4.req06':
    'Acá se define con qué se recortan las imágenes, qué proporción tienen y en qué se aplican: círculo para un retrato, esquinas redondeadas para una tarjeta, arco para una portada. Cada recorte con su nombre y con su uso, para poder nombrarlo cuando lo apliques.',
  'dim4.req07':
    'Si un rol se declara «plano» o «sin sombra», el set tiene que explicar cómo se separa igual de lo que tiene al lado: un filete delgado, un cambio de superficie, más aire alrededor. Y si en el set no hay ningún caso así, también se escribe, con una frase propia que lo diga —algo como «no aplica: ningún rol plano»—, para que la ausencia se lea como decisión y no como olvido. «Sin sombra» sin esa explicación no es una decisión, es un vacío.',
  'dim4.req08':
    'Formas, bordes y profundidades no se repiten igual en todas partes: el set dice cómo cambian entre contextos —pantalla chica, impreso— o deja escrito que no cambian. «No se adapta» vale sólo si está dicho; una lista vacía no lo dice.',
  'dim5.req01':
    'Hacia dónde mira la imagen del sistema: qué tono, qué clima, qué tipo de fotografía o ilustración. «Enlazada al mood wall» quiere decir que apunta a algo concreto que se puede ver, no a una frase de inspiración.',
  'dim5.req02':
    'Cinco clases de imagen: fotografía, ilustración, iconografía, símbolos y marcas. Cada una tiene su tratamiento propio. Pregunta si los cinco están definidos, o si se declara cuáles no usa el sistema.',
  'dim5.req03':
    'Cómo se elige una imagen: qué tema, qué tan auténtica (¿banco de imágenes o foto propia?), qué diversidad, de dónde viene, qué calidad mínima. Los criterios escritos evitan que cada pieza elija a su gusto.',
  'dim5.req04':
    'Cómo se recorta y se coloca: la proporción, dónde está el punto de interés de la foto, cómo convive con el texto. Al menos para un contexto de uso.',
  'dim5.req05':
    'Si las fotos llevan un tratamiento común —desaturadas, cálidas, con grano— o si se declara explícitamente que van tal cual. Las dos son decisiones válidas; lo que no vale es no decidir.',
  'dim5.req06':
    'Qué se puede poner encima de una imagen: velos, filtros, mezclas. Y sobre todo qué no. Esto es lo que impide que aparezca un degradado que la marca no tiene «para que se lea el texto».',
  'dim5.req07':
    'La gramática de los dibujos y los íconos: qué forma tienen, qué grosor de trazo, a qué escala, qué significa cada uno. Que parezcan hechos por la misma mano.',
  'dim5.req08':
    'Cómo se usa el logotipo y cómo no: tamaños mínimos, fondos permitidos, qué no se le hace nunca. «Vinculantes para el resto» quiere decir que ninguna otra definición puede contradecir esto.',
  'dim5.req09':
    'Cada tipo de imagen —una foto, una ilustración, un ícono, un símbolo, una marca— tiene que decir su resolución mínima al tamaño en que se va a usar, o explicar por qué no le corresponde (un logo vectorial no se mide en puntos por pulgada). Y tiene que quedar escrito qué haces cuando una imagen no llega a esa resolución: la rechazas, la cambias o la aceptas avisando.',
  'dim6.req01':
    'En cada composición hay algo que domina, algo que acompaña y algo que calla. Y un orden en que el ojo recorre. Pregunta si eso está declarado al menos para un contexto.',
  'dim6.req02':
    'Cómo se sabe que dos cosas van juntas: porque están cerca, porque se continúan, o porque hay algo que las separa de lo demás. Tres principios; pregunta si cada uno tiene su criterio.',
  'dim6.req03':
    'Si la composición es simétrica o asimétrica, y cómo se maneja la tensión que eso produce. La asimetría no es desorden: es una decisión que hay que sostener.',
  'dim6.req04':
    'El patrón de repetición y dónde están las pausas. Una secuencia sin pausas cansa aunque cada pieza esté bien.',
  'dim6.req05':
    'Cuánto contenido por cuánto espacio vacío. Es la diferencia entre una página generosa y una apretada, y conviene que sea decisión y no accidente.',
  'dim6.req06':
    'Por dónde entra el ojo y cómo recorre. En editorial es el flujo de lectura; en digital, también el de navegación.',
  'dim6.req07':
    'Cómo se reacomoda la composición al cambiar de formato, o la decisión explícita de que no se reacomode.',
  'dim6.req08':
    'El sistema no describe una pieza en particular: declara qué estructuras sabe armar, como un folleto de doce páginas, un tríptico o un díptico. Para cada una deja escrito qué paneles tiene, qué rol cumple cada uno, en qué orden van, cómo se dobla, en qué orden se despliega al abrirla y qué elementos se repiten en todas las hojas, como el folio o la cabecera.',
  'dim6.req09':
    'Si el sistema sirve para carteles, afiches o volantes, aquí queda escrito cómo trata la línea dominante: cuántas palabras acepta como máximo, con qué tamaño mínimo aparece y cómo agrupa las cinco preguntas del aviso. Si no sirve para leerse de lejos, basta con que escribas la razón y no declares nada más, porque las dos cosas juntas se contradicen.',
  'dim7.req01':
    'Todo lo que se puede apretar o recorrer tiene que avisar que se puede. Si un botón, un enlace o una tarjeta no dan ninguna señal (forma, subrayado, cambio al pasar el puntero), la persona simplemente no lo intenta.',
  'dim7.req02':
    'Un mismo elemento se ve distinto según lo que está pasando con él: en reposo, con el puntero encima, con foco de teclado o apretado. Escribir qué significa cada estado evita que dos personas inventen dos conductas distintas para lo mismo.',
  'dim7.req03':
    'Dónde estoy, cuánto avancé, cómo vuelvo atrás y cómo llego a lo relacionado. Una galería con su «3 de 12», su botón de volver y un enlace al artículo completo ya es navegación declarada y no improvisada.',
  'dim7.req04':
    'Cada aviso necesita su propio trato: que se guardó bien, que ojo con esto, que algo falló y cómo se recupera. Si tratas los cuatro igual, un error se lee como una confirmación y nadie reacciona.',
  'dim7.req05':
    'Los controles de ingreso, edición y selección tienen que decir qué hacen: un campo de correo valida y avisa sin borrar lo escrito, una casilla marca y desmarca, un selector de fecha se puede abrir con el teclado.',
  'dim7.req06':
    'Si el color es lo único que dice «error», quien no distingue bien los colores se pierde. Cada significado necesita además algo que no sea color: un ícono, una palabra, un borde más grueso, una forma.',
  'dim7.req07':
    'Una interacción pensada para pantalla necesita su versión quieta para cuando no hay pantalla: el carrusel pasa a ser una lista de fotos con su pie, y así la intención no se pierde al imprimir.',
  'dim7.req08':
    'El botón de la acción principal no inventa su propio color: usa el rol de acento. Si además le escribes un color a mano, ese valor se desincroniza del tema, y el día que cambies el tema quedan dos verdades.',
  'dim8.req01':
    'Antes de animar nada, decide qué tiene que sentir quien mira: si el sistema es sobrio o juguetón, si va rápido o se toma su tiempo. Escribe esos principios y de dónde salen —por ejemplo, «nada rebota» viene del manual de marca—, porque todo lo demás se va a medir contra eso.',
  'dim8.req02':
    'Tienes seis papeles: entrada, salida, transición, feedback, orientación y énfasis. Para cada uno escribe qué significa en este diseño y cuánto dura, tomando el tiempo de tu escala. Si algún papel no existe acá, dilo y explica por qué; lo que no sirve es dejarlo en blanco.',
  'dim8.req03':
    'Haz una lista corta de duraciones con nombre —inmediata 160 ms, breve 240 ms, entrada 420 ms, por ejemplo— y de ahí saca los tiempos de todos tus movimientos. Así nadie inventa un número suelto y el sistema se siente parejo. El ritmo es cómo se encadenan esos tiempos y en qué momentos haces pausas.',
  'dim8.req04':
    'Un movimiento no queda completo si sólo dices cuánto dura: también necesitas la curva —si arranca despacio y frena al final, por ejemplo— y por dónde pasa. Si se desplaza, di cuánto recorre (24 px, media unidad de escala) y que sigue la misma retícula; si sólo aparece y desaparece, escríbelo igual.',
  'dim8.req05':
    'Escribe qué hace que cada movimiento parta: que la página cargue, que el bloque entre en pantalla, que el puntero pase por encima. Si el disparador es uno que el compilador ya entiende (carga, scroll, hover), márcalo; si es otro —recibir foco, un dato nuevo, el paso del tiempo— descríbelo con tus palabras.',
  'dim8.req06':
    'Cuando varios elementos se mueven juntos, di en qué orden entran y con cuánto atraso cada uno, y cómo se relacionan —por ejemplo: primero el titular, después la bajada, y el botón sólo cuando lo tocan—. También di qué pasa si la persona ya está interactuando y la secuencia programada se cruza con ella.',
  'dim8.req07':
    'Cuenta qué pasa cuando alguien pide menos movimiento. Si eliges la versión reducida o la estática, di qué reemplaza a cada rol y con qué se comunica el cambio sin animación (un borde, el color de acción del sistema, más peso visual). Y si decides que no hay movimiento decorativo, explica igual cómo se entiende qué cambió y qué es más importante.',
  'dim9.req01':
    'Escribe los diez arquetipos de patrón —acción, contenedor, navegación, feedback, entrada, secuencia editorial, lista, tabla, métricas y representación de datos— y al lado de cada uno qué significa en tu set. Si alguno no se usa, su línea va igual con «no aplica, porque…»: un afiche no tiene tablas, pero lo dice.',
  'dim9.req02':
    'Para cada arquetipo que sí usas, escribe qué piezas lo forman, cuáles son obligatorias y cuáles opcionales, y cómo se relaciona cada pieza con las demás. Si un arquetipo no aplica, basta la frase que lo declara; eso sí, nunca las dos cosas a la vez: o traes la lista de piezas, o dices que no aplica.',
  'dim9.req03':
    'Cada variante de un arquetipo dice de dónde hereda y qué cambia: «botón de contorno hereda del botón sólido, quita el relleno y deja sólo el borde». Si tu set no tiene variantes, escríbelo con su razón —«no hay variantes porque cada pieza se usa en su forma base»—: una lista vacía no cuenta como respuesta.',
  'dim9.req04':
    'Un dato puede viajar en la posición, el largo, el color, la forma o la textura. Declara los cinco portadores y qué comunicas con cada uno. Para el color, apunta al rol de color que ya dejaste escrito en tu paleta en vez de inventar un color nuevo; y si en este set el color no comunica nada, dilo y explica por qué.',
  'dim9.req05':
    'Di cómo tratas el contenido cuando se desborda, cuando llega vacío, cuando falta un dato y cuando hay un error. Escribe las cuatro respuestas aunque en algún caso no cambie nada: «el texto se recorta sin aviso, porque…». La pregunta es para el sistema completo; el arquetipo de cada línea sólo indica dónde lo observaste.',
  'dim9.req06':
    'Cuenta cómo se porta un patrón cuando cambia el contexto —pantalla angosta, impresión, otro idioma— y qué se ajusta en cada caso. Si no cambia nada, declara esa decisión: una lista vacía no cuenta como respuesta.',
  'dim9.req07':
    'Escribe cómo entra un patrón nuevo al sistema, cómo se migran los sets que ya existen y qué les pasa a los sets históricos. La idea es que agregar algo no deje mudos ni incompletos a los sets viejos sin que nadie se entere.',
};
