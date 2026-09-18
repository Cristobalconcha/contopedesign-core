/**
 * El espécimen: ver de cerca una familia antes de decidir. Es lo que hace la
 * página de detalle de una familia en Google Fonts —texto propio, tamaño,
 * peso, itálica y color, con todos los pesos a la vista— para elegir con el
 * ojo y no con los metadatos. El texto que se escribe acá es de acá: no toca
 * el de la lista del selector. El espécimen no modifica el set; lo único que
 * devuelve es la familia elegida, y el selector decide qué hacer con ella.
 */
import { useEffect, useState, type ReactNode } from 'react';
import { genericaDe, type FamiliaCatalogo } from '../dominio/catalogo.js';
import { cargarFamiliaCompleta } from '../navegador/fuentes.js';

const HEX = /^#[0-9a-f]{6}$/i;
const TINTA = 'var(--tinta)';
const PANEL = 'var(--panel)';
const TAM_MIN = 12;
const TAM_MAX = 160;
const TAM_INICIAL = 64;

interface Props {
  familia: FamiliaCatalogo;
  colores: ReadonlyArray<{ name: string; value: string }>;
  textoInicial: string;
  onElegir: (familia: FamiliaCatalogo) => void;
  onVolver: () => void;
}

/** El hex que muestra el selector libre cuando el color elegido es un token del set. */
function hexDe(color: string, porDefecto: string): string {
  if (HEX.test(color)) return color;
  return color === PANEL ? '#ffffff' : porDefecto;
}

function acotar(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

export function Especimen({ familia: f, colores, textoInicial, onElegir, onVolver }: Props) {
  const pesos = f.w.length ? [...f.w].sort((a, b) => a - b) : [400];
  const [texto, setTexto] = useState(textoInicial);
  const [tam, setTam] = useState(TAM_INICIAL);
  const [peso, setPeso] = useState(() => (pesos.includes(400) ? 400 : (pesos[0] ?? 400)));
  const [italica, setItalica] = useState(false);
  const [colorTexto, setColorTexto] = useState(TINTA);
  const [colorFondo, setColorFondo] = useState(PANEL);

  useEffect(() => {
    cargarFamiliaCompleta(f);
  }, [f]);

  const tipografia = `'${f.f}', ${genericaDe(f)}`;
  const muestra = texto.trim() ? texto : 'Aa';

  const filas: Array<{ peso: number; italica: boolean }> = [];
  for (const w of pesos) {
    filas.push({ peso: w, italica: false });
    if (f.i === 1) filas.push({ peso: w, italica: true });
  }

  const cambiarTam = (v: string): void => {
    const n = Number(v);
    if (Number.isFinite(n)) setTam(acotar(Math.round(n), TAM_MIN, TAM_MAX));
  };

  const invertir = (): void => {
    setColorTexto(colorFondo);
    setColorFondo(colorTexto);
  };

  const sinColor = (): void => {
    setColorTexto(TINTA);
    setColorFondo(PANEL);
  };

  const filaDeColor = (etiqueta: string, actual: string, poner: (v: string) => void, porDefecto: string): ReactNode => (
    <>
      <span className="rot">{etiqueta}</span>
      <div className="chips">
        {colores.map((c) => (
          <button key={c.name} className="chip2" aria-pressed={actual === c.value} title={c.value} onClick={() => poner(c.value)}>
            <span className="esp-muestra-color" style={{ background: c.value }} />
            {c.name}
          </button>
        ))}
        {colores.length ? null : <span className="esp-paleta-vacia">El set todavía no trae paleta: elige un color libre.</span>}
        <input type="color" value={hexDe(actual, porDefecto)} onChange={(e) => poner(e.target.value)} aria-label={etiqueta} />
      </div>
    </>
  );

  return (
    <div className="especimen">
      <header className="esp-cab">
        <div className="esp-titulo">
          <b style={{ fontFamily: tipografia }}>{f.f}</b>
          <span className="esp-meta">
            <i>{f.c}</i>
            {f.s && f.s !== f.c ? <i>{f.s}</i> : null}
            <i>
              {pesos.length} {pesos.length === 1 ? 'peso' : 'pesos'}
            </i>
            {f.i === 1 ? <i>itálica</i> : null}
            {f.v.length ? <i>variable</i> : null}
            {f.wd ? (
              <i>
                ancho {f.wd[0]}–{f.wd[1]}
              </i>
            ) : null}
            <i>{f.o ? 'código abierto (Google Fonts)' : 'sin licencia declarada'}</i>
          </span>
        </div>
        <div className="esp-acciones">
          <button className="btn" onClick={onVolver}>
            Volver a la lista
          </button>
          <button className="btn fuerte" onClick={() => onElegir(f)}>
            Elegir esta familia
          </button>
        </div>
      </header>

      <div className="esp-controles">
        <div className="esp-campo esp-campo-texto">
          <span className="rot">Texto</span>
          <textarea className="esp-texto" value={texto} onChange={(e) => setTexto(e.target.value)} aria-label="Texto del espécimen" />
        </div>

        <div className="esp-campo">
          <span className="rot">Tamaño</span>
          <div className="esp-fila">
            <input type="range" min={TAM_MIN} max={TAM_MAX} value={tam} onChange={(e) => cambiarTam(e.target.value)} aria-label="Tamaño de la muestra" />
            <input className="esp-num" type="number" min={TAM_MIN} max={TAM_MAX} value={tam} onChange={(e) => cambiarTam(e.target.value)} aria-label="Tamaño en píxeles" />
            <span className="tenue">px</span>
          </div>
        </div>

        <div className="esp-campo">
          <span className="rot">Peso</span>
          <div className="chips">
            {pesos.map((w) => (
              <button key={w} className="chip2" aria-pressed={peso === w} onClick={() => setPeso(w)}>
                {w}
              </button>
            ))}
          </div>
        </div>

        {f.i === 1 ? (
          <div className="esp-campo">
            <span className="rot">Estilo</span>
            <div className="chips">
              <button className="chip2" aria-pressed={italica} onClick={() => setItalica(!italica)}>
                Itálica
              </button>
            </div>
          </div>
        ) : null}

        <div className="esp-campo esp-campo-color">
          {filaDeColor('Color del texto', colorTexto, setColorTexto, '#1a1f23')}
          {filaDeColor('Color del fondo', colorFondo, setColorFondo, '#ffffff')}
          <div className="chips">
            <button className="chip2" onClick={invertir} title="Intercambia el color del texto y el del fondo">
              Invertir
            </button>
            <button className="chip2" onClick={sinColor} title="Vuelve a la tinta sobre el panel">
              Sin color
            </button>
          </div>
        </div>
      </div>

      <div
        className="esp-muestra"
        style={{
          background: colorFondo,
          color: colorTexto,
          fontFamily: tipografia,
          fontSize: `${tam}px`,
          fontWeight: peso,
          fontStyle: italica ? 'italic' : 'normal',
          lineHeight: 1.2,
          whiteSpace: 'pre-wrap',
        }}
      >
        {muestra}
      </div>

      <div className="esp-todos">
        <span className="rot">Todos los pesos</span>
        {filas.map((fila) => (
          <div key={`${fila.peso}${fila.italica ? 'i' : 'n'}`} className="esp-fila-peso">
            <span className="esp-etiqueta">
              {fila.peso}
              {fila.italica ? ' itálica' : ''}
            </span>
            <span className="esp-linea" style={{ fontFamily: tipografia, fontWeight: fila.peso, fontStyle: fila.italica ? 'italic' : 'normal' }}>
              {muestra}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
