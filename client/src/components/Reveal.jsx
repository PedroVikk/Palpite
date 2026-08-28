import { revealChips } from '../lib/format.js';

/** O segredo, mostrado so quando a rodada fecha. */
export default function Reveal({ universe, secret }) {
  const art = secret.artwork ?? secret.sprite ?? null;   // ha universos sem imagem (LOTR)

  /**
   * A arte grande do reveal continua vindo da CDN de origem — espelhar as ~9 mil
   * em tamanho cheio custaria centenas de MB. Quando ela nao carrega, cai na
   * miniatura, que e local: com a fonte fora do ar o reveal perde resolucao, nao
   * a imagem.
   */
  const fallbackToSprite = (e) => {
    if (!secret.sprite || e.currentTarget.src.endsWith(secret.sprite)) return;
    e.currentTarget.src = secret.sprite;
  };

  return (
    <div className="reveal">
      {art && <img src={art} alt={secret.name} onError={fallbackToSprite} />}
      <div>
        <span className="label">O segredo era</span>
        <h2>{secret.name}</h2>
        <div className="chips">
          {revealChips(universe, secret).map(chip => (
            <span key={chip.key} className="chip" title={chip.label}>{chip.text}</span>
          ))}
        </div>
      </div>
    </div>
  );
}
