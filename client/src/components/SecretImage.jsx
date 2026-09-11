import { useEffect, useRef, useState } from 'react';
import { universeMeta } from '../lib/universeMeta.js';
import { ImageIcon } from './Icon.jsx';

/**
 * O segredo em imagem, do jeito que ele chega: já reduzido.
 *
 * O que o servidor manda no degrau 0 é uma figura de seis pixels de largura —
 * seis pixels de verdade, não uma imagem inteira atrás de um `blur`. Então
 * aqui não há filtro para aplicar nem nada a esconder: a tela só amplia o que
 * recebeu, e `image-rendering: pixelated` faz o navegador ampliar sem inventar
 * o meio do caminho. O quadradão é honesto — é exatamente a informação que o
 * jogador tem.
 *
 * A marca-d'água do universo fica atrás, de moldura, e some quando o quadro
 * chega: enquanto o servidor prepara a escada (uns 40 ms na primeira rodada),
 * a caixa já tem a cara do universo em vez de ficar um buraco cinza.
 */
export default function SecretImage({ universe, picture, caption }) {
  const { level = 0, top = 0, src = null } = picture ?? {};
  const mark = universeMeta(universe).mark;

  // um pisca curto quando a nitidez sobe: sem isso a imagem muda no meio de uma
  // tela cheia de texto e o ganho — que é o prêmio do chute — passa batido
  const [flash, setFlash] = useState(false);
  const seen = useRef(level);
  useEffect(() => {
    if (level === seen.current) return;
    seen.current = level;
    setFlash(true);
    const at = setTimeout(() => setFlash(false), 620);
    return () => clearTimeout(at);
  }, [level]);

  const sharp = level >= top;

  return (
    <section className="secret-image">
      <div className={`frame ${flash ? 'sharper' : ''}`}>
        <img className="art" src={mark} alt="" aria-hidden />
        {src
          ? <img className="pix" src={src} alt="A imagem do segredo, ainda sem definição" />
          : <span className="qm">?</span>}
      </div>

      <div className="meta">
        <div className="k"><ImageIcon width={14} height={14} />Quem é?</div>
        <p>{caption}</p>

        {/* a escada à vista: quantos degraus já foram e quantos faltam */}
        <div className="ladder" aria-hidden>
          {Array.from({ length: top + 1 }, (_, i) => (
            <i key={i} className={i <= level ? 'on' : ''} />
          ))}
        </div>
        <small>
          {sharp
            ? 'Nitidez no máximo — daqui não clareia mais.'
            : <>Nitidez <b>{level}</b> de {top} · cada erro revela mais um pedaço</>}
        </small>
      </div>
    </section>
  );
}
