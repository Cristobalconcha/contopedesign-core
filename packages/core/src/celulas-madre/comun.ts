/** Lo que comparten los generadores: nombres de archivo y escape de XML. */

/** `Santa Luisa de Palpi` → `santa-luisa-de-palpi` (sin acentos ni espacios); vacío → `sistema`. */
export function baseDeNombre(nombre: string): string {
  const base = nombre
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
  return base || 'sistema';
}

/** Texto seguro dentro de un elemento o atributo XML. */
export function escaparXml(texto: string): string {
  return texto.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

/** JSON dentro de un CDATA: la única secuencia prohibida es `]]>`, que se parte en dos secciones. */
export function cdata(texto: string): string {
  return `<![CDATA[${texto.replace(/]]>/g, ']]]]><![CDATA[>')}]]>`;
}
