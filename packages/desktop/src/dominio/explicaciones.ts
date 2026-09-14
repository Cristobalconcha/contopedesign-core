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
};
