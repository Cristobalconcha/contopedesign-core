/**
 * Los instrumentos: ventanas que se abren desde un parámetro, no etapas del
 * flujo (INTERFAZ.md, «El principio»). Cada tipo de parámetro define
 * mirando: el selector de tipografías para una familia, los parches para el
 * fundamento cromático, la regla para la escala espacial. Para todo lo que
 * todavía no tiene su instrumento visual está el editor estructurado, que
 * sigue el payloadSchema del requisito campo por campo, y el instrumento por
 * declaración, para lo que no cabe en un valor (la salida física).
 */
import { ColorFundamento } from './ColorFundamento.js';
import { Declaracion } from './Declaracion.js';
import { EditorEstructurado } from './EditorEstructurado.js';
import { EscalaEspacial } from './EscalaEspacial.js';
import { Tipografia } from './Tipografia.js';
import { requisito } from '../dominio/manifiesto.js';
import { useTaller, type Instrumento } from '../taller.js';

/** Qué instrumento le toca a un requisito cuando la persona elige «Definir». */
export function instrumentoPara(requirementId: string): (id: string) => Instrumento {
  // La salida física (pkg.salida.*) se define por declaración; la confirmación
  // de quien la ejecuta (dim10.req05) es una verificación y sigue en el editor.
  if (requirementId !== 'dim10.req05' && requisito(requirementId)?.packageId.startsWith('pkg.salida.')) {
    return (id) => ({ tipo: 'declaracion', requirementId: id });
  }
  switch (requirementId) {
    case 'dim2.req01':
      return (id) => ({ tipo: 'tipografia', requirementId: id });
    case 'dim1.req01':
      return (id) => ({ tipo: 'color', requirementId: id });
    case 'dim3.req01':
      return (id) => ({ tipo: 'espacio', requirementId: id });
    default:
      return (id) => ({ tipo: 'editor', requirementId: id });
  }
}

export function Instrumentos() {
  const { taller } = useTaller();
  const i = taller.instrumento;
  if (!i) return null;
  switch (i.tipo) {
    case 'tipografia':
      return <Tipografia requirementId={i.requirementId} {...(i.nombreBuscado !== undefined ? { nombreBuscado: i.nombreBuscado } : {})} />;
    case 'color':
      return <ColorFundamento requirementId={i.requirementId} />;
    case 'espacio':
      return <EscalaEspacial requirementId={i.requirementId} />;
    case 'declaracion':
      return <Declaracion requirementId={i.requirementId} />;
    case 'editor':
      return <EditorEstructurado requirementId={i.requirementId} />;
  }
}
